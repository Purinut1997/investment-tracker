import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import {
  calculateUserHoldings,
  getUserSummaryCache,
  setUserSummaryCache,
  getInFlightSummary,
  setInFlightSummary,
} from '@/lib/analytics/holdings'
import { calculatePortfolioHealthScore } from '@/lib/analytics/health-score'
import { calculatePortfolioPerformance } from '@/lib/analytics/performance'
import { getExchangeRate } from '@/lib/market-data/frankfurter'
import { yahooFinanceProvider } from '@/lib/market-data/yahoo'
import { coinGeckoProvider } from '@/lib/market-data/coingecko'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id
  const forceRefresh = req.nextUrl.searchParams.get('refresh') === 'true'

  try {
    // 1. Get user settings for baseCurrency
    const userSettings = await prisma.userSettings.findUnique({
      where: { userId },
    })
    const baseCurrency = userSettings?.baseCurrency ?? 'THB'

    // 2. Check in-memory cache (<0.5ms)
    if (!forceRefresh) {
      const cached = getUserSummaryCache(userId, baseCurrency)
      if (cached) {
        return NextResponse.json(cached)
      }

      const inFlight = getInFlightSummary(userId, baseCurrency)
      if (inFlight) {
        const result = await inFlight
        return NextResponse.json(result)
      }
    }

    const computePromise = (async () => {
      // 3. Parallel fetch FX rate, holdings, accounts, presets, digest, and alert in one shot
      const [
        usdThbRateRaw,
        holdingsResult,
        accounts,
        presets,
        latestDigest,
        unackAlert,
      ] = await Promise.all([
        getExchangeRate('USD', baseCurrency).catch(() => 35.5),
        calculateUserHoldings(userId, baseCurrency, forceRefresh),
        prisma.investmentAccount.findMany({
          where: { userId },
          orderBy: { createdAt: 'asc' },
        }),
        prisma.investmentPreset.findMany({
          where: { userId },
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
        }),
        prisma.weeklyDigest.findFirst({
          where: { userId },
          orderBy: { weekOf: 'desc' },
        }),
        prisma.allocationAlert.findFirst({
          where: { userId, acknowledged: false },
          orderBy: { triggeredAt: 'desc' },
        }),
      ])

      const usdThbRate = usdThbRateRaw ?? 35.5
      const txns = holdingsResult.txns || []

      // 4. Calculate health score
      const healthScore = calculatePortfolioHealthScore(holdingsResult.holdings)

      // 5. In-Memory: Calculate total REALIZED GAIN from preloaded SELL transactions (0 DB queries)
      const sellTxns = txns.filter((t: any) => t.txnType === 'SELL')
      const totalRealizedProceedsBase = sellTxns.reduce((sum: number, t: any) => {
        const isUSD = t.asset?.currency === 'USD' || t.asset?.market === 'US'
        const fx = isUSD ? usdThbRate : 1.0
        return sum + Number(t.totalAmount || 0) * fx
      }, 0)

      const totalRealizedProceedsUSD = sellTxns.reduce((sum: number, t: any) => {
        const isUSD = t.asset?.currency === 'USD' || t.asset?.market === 'US'
        return sum + (isUSD ? Number(t.totalAmount || 0) : 0)
      }, 0)

      // 6. In-Memory: Total dividends received from preloaded DIVIDEND transactions (0 DB queries)
      const divTxns = txns.filter((t: any) => t.txnType === 'DIVIDEND')
      const totalDividendsBase = divTxns.reduce((sum: number, t: any) => {
        const isUSD = t.asset?.currency === 'USD' || t.asset?.market === 'US'
        const fx = isUSD ? usdThbRate : 1.0
        return sum + Number(t.totalAmount || 0) * fx
      }, 0)

      const totalDividendsUSD = divTxns.reduce((sum: number, t: any) => {
        const isUSD = t.asset?.currency === 'USD' || t.asset?.market === 'US'
        return sum + (isUSD ? Number(t.totalAmount || 0) : 0)
      }, 0)

      // 7. Calculate historical portfolio growth milestones reusing preloaded txns (0 DB queries)
      const performanceData = await calculatePortfolioPerformance(
        userId,
        holdingsResult.totalValueBase,
        baseCurrency,
        txns
      )

      // 8. Calculate total cash & net worth across user accounts
      let totalCash = 0
      for (const acc of accounts) {
        const bal = Number(acc.cashBalance) || 0
        const isUSD = acc.currency === 'USD'
        const fx = isUSD ? usdThbRate : 1.0
        totalCash += bal * fx
      }
      const netWorth = holdingsResult.totalValueBase + totalCash

      // 9. Calculate Today's P&L and individual daily price changes
      let todayPnLBase = 0
      const holdingsWithDaily = await Promise.all(
        holdingsResult.holdings.map(async (h) => {
          let quote = null
          try {
            if (h.assetType === 'crypto' || h.market === 'CRYPTO') {
              quote = await coinGeckoProvider.getQuote(h.ticker)
            } else {
              quote = await yahooFinanceProvider.getQuote(h.ticker, h.market)
            }
          } catch {}

          const changePercent = quote?.changePercent ?? 0
          const holdingTodayPnLBase = h.currentValueBase * (changePercent / 100)
          todayPnLBase += holdingTodayPnLBase

          return {
            ...h,
            todayChangePercent: changePercent,
            todayPnLBase: holdingTodayPnLBase,
          }
        })
      )

      const todayPnLPercent =
        holdingsResult.totalValueBase > 0
          ? (todayPnLBase / holdingsResult.totalValueBase) * 100
          : 0

      // 10. Group by Asset Class (Macro Allocation)
      const classMap: Record<string, { label: string; value: number; color: string }> = {
        stock: { label: 'หุ้นรายตัว (Stocks)', value: 0, color: '#6366f1' },
        fund: { label: 'กองทุน & ETF', value: 0, color: '#10b981' },
        crypto: { label: 'คริปโต (Crypto)', value: 0, color: '#f59e0b' },
        bond: { label: 'ตราสารหนี้ (Bonds)', value: 0, color: '#06b6d4' },
        gold: { label: 'ทองคำ & สินค้าโภคภัณฑ์', value: 0, color: '#eab308' },
        cash: { label: 'เงินสดพร้อมลงทุน (Cash)', value: totalCash, color: '#14b8a6' },
      }

      for (const h of holdingsWithDaily) {
        const type = (h.assetType || 'stock').toLowerCase()
        if (classMap[type]) {
          classMap[type].value += h.currentValueBase
        } else {
          classMap.stock.value += h.currentValueBase
        }
      }

      const assetClassAllocation = Object.entries(classMap)
        .filter(([_, item]) => item.value > 0)
        .map(([key, item]) => ({
          key,
          name: item.label,
          value: Math.round(item.value),
          percent: netWorth > 0 ? Number(((item.value / netWorth) * 100).toFixed(1)) : 0,
          color: item.color,
        }))

      // 11. Upcoming Catalysts (Dividends & Earnings)
      const userTickers = holdingsResult.holdings.map((h) => h.ticker.toUpperCase())
      const upcomingCatalysts: Array<{
        type: 'dividend' | 'earnings'
        symbol: string
        title: string
        subtitle: string
        badge: string
      }> = []

      const knownDivTickers: Record<string, { name: string; estimateNote: string }> = {
        SCHD: { name: 'Schwab U.S. Dividend Equity ETF', estimateNote: 'XD ไตรมาส 4 (ธ.ค.)' },
        VOO: { name: 'Vanguard S&P 500 ETF', estimateNote: 'XD ไตรมาส 4 (ธ.ค.)' },
        SPY: { name: 'SPDR S&P 500 ETF Trust', estimateNote: 'XD ไตรมาส 4 (ธ.ค.)' },
        AAPL: { name: 'Apple Inc.', estimateNote: 'XD ไตรมาส 4 (พ.ย.)' },
        MSFT: { name: 'Microsoft Corporation', estimateNote: 'XD ไตรมาส 4 (พ.ย.)' },
        O: { name: 'Realty Income Corp', estimateNote: 'จ่ายปันผลรายเดือน (ทุกสิ้นเดือน)' },
      }

      for (const h of holdingsResult.holdings) {
        const t = h.ticker.toUpperCase()
        if (knownDivTickers[t] && upcomingCatalysts.length < 3) {
          upcomingCatalysts.push({
            type: 'dividend',
            symbol: t,
            title: `${t} — ${knownDivTickers[t].estimateNote}`,
            subtitle: knownDivTickers[t].name,
            badge: 'ปันผล',
          })
        }
      }

      // Check for recent catalyst news for held assets
      if (userTickers.length > 0) {
        const recentCatalystNews = await prisma.newsItem.findFirst({
          where: {
            OR: [
              { headline: { contains: 'earnings', mode: 'insensitive' } },
              { headline: { contains: 'guidance', mode: 'insensitive' } },
              { headline: { contains: 'revenue', mode: 'insensitive' } },
            ],
            symbol: { in: userTickers },
          },
          orderBy: { publishedAt: 'desc' },
        })

        if (recentCatalystNews && recentCatalystNews.symbol && upcomingCatalysts.length < 3) {
          upcomingCatalysts.push({
            type: 'earnings',
            symbol: recentCatalystNews.symbol,
            title: `${recentCatalystNews.symbol} — อัปเดตผลการดำเนินงาน`,
            subtitle: recentCatalystNews.headline,
            badge: 'งบการเงิน',
          })
        }
      }

      // 12. Market Pulse summary linking to news
      const topNews = await prisma.newsItem.findFirst({
        where: userTickers.length > 0 ? { OR: [{ symbol: { in: userTickers } }, { symbol: null }] } : undefined,
        orderBy: { publishedAt: 'desc' },
      })

      const marketPulse = topNews
        ? {
            symbol: topNews.symbol,
            headline: topNews.headline,
            sentiment: topNews.sentiment || 'neutral',
          }
        : null

      const defaultPreset = presets.find((p: any) => p.isDefault) || presets[0] || null

      const summaryPayload = {
        baseCurrency,
        usdThbRate,
        totalValue: holdingsResult.totalValueBase,
        totalCost: holdingsResult.totalCostBase,
        netWorth,
        totalCash,
        todayPnL: todayPnLBase,
        todayPnLPercent,
        unrealizedPnL: holdingsResult.unrealizedPnLBase,
        unrealizedPnLPercent: holdingsResult.unrealizedPnLPercent,
        totalRealizedGain: totalRealizedProceedsBase,
        totalRealizedGainUSD: totalRealizedProceedsUSD,
        totalDividends: totalDividendsBase,
        totalDividendsUSD,
        assetCount: holdingsResult.holdings.length,
        healthScore,
        performanceData,
        holdings: holdingsWithDaily,
        assetClassAllocation,
        upcomingCatalysts,
        marketPulse,
        accounts,
        presets,
        activePreset: defaultPreset,
        latestDigest,
        unackAlert,
        timestamp: Date.now(),
      }

      setUserSummaryCache(userId, baseCurrency, summaryPayload)
      return summaryPayload
    })()

    setInFlightSummary(userId, baseCurrency, computePromise)
    const summaryPayload = await computePromise

    return NextResponse.json(summaryPayload)
  } catch (error) {
    console.error('[portfolio summary GET]', error)
    return NextResponse.json({ error: 'Failed to calculate portfolio summary' }, { status: 500 })
  }
}
