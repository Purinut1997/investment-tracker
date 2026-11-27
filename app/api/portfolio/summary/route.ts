import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import {
  calculateUserHoldings,
  reconcileHoldingPrice,
  invalidateUserPortfolioCache,
  getUserSummaryCache,
  setUserSummaryCache,
  getInFlightSummary,
  setInFlightSummary,
} from '@/lib/analytics/holdings'
import { invalidatePriceCache, syncAssetLivePrice, fetchLiveAssetQuote } from '@/lib/market-data/cache-layer'
import { calculatePortfolioHealthScore } from '@/lib/analytics/health-score'
import {
  calculatePortfolioPerformance,
  calculatePortfolioRiskMetrics,
} from '@/lib/analytics/performance'
import {
  StockSplitEvent,
  getSplitMultiplier,
  mergeTxnsAndSplits,
} from '@/lib/analytics/stock-splits'
import { getExchangeRate, valueCashAccounts } from '@/lib/market-data/frankfurter'

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
    if (forceRefresh) {
      invalidatePriceCache()
      invalidateUserPortfolioCache(userId)
    } else {
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
        getExchangeRate('USD', baseCurrency),
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
      const splitsByAssetRecord = holdingsResult.splitsByAssetRecord || {}
      const allSplits: StockSplitEvent[] = Object.values(splitsByAssetRecord).flat()

      // 4. In-Memory: Calculate true FIFO REALIZED GAIN & XIRR cash flows with stock splits (0 DB queries)
      const sortedTxns = [...txns].sort(
        (a: any, b: any) => new Date(a.txnDate).getTime() - new Date(b.txnDate).getTime()
      )
      const timeline = mergeTxnsAndSplits(sortedTxns, allSplits)
      const fifoLots = new Map<string, Array<{ qty: number; unitCost: number }>>()
      let totalRealizedGainBase = 0
      let totalRealizedGainUSD = 0
      const xirrCashFlows: Array<{ amount: number; date: Date }> = []

      for (const ev of timeline) {
        if (ev.kind === 'SPLIT') {
          const lots = fifoLots.get(ev.split.assetId)
          const mult = getSplitMultiplier(ev.split)
          if (lots && mult !== 1) {
            for (const lot of lots) {
              lot.qty *= mult
              lot.unitCost /= mult
            }
          }
          continue
        }

        const t = ev.txn
        const assetId = t.assetId
        if (!fifoLots.has(assetId)) {
          fifoLots.set(assetId, [])
        }
        const lots = fifoLots.get(assetId)!
        const qty = Number(t.quantity || 0)
        const price = Number(t.pricePerUnit || 0)
        const fee = Number(t.fee || 0)
        const isUSD =
          t.asset?.currency === 'USD' ||
          t.asset?.market === 'US' ||
          t.asset?.market === 'CRYPTO'
        const currency = isUSD ? 'USD' : (t.asset?.currency || 'THB').toUpperCase()
        const fx = holdingsResult.fxRates?.[currency]?.rate ?? (currency === baseCurrency ? 1 : 0)
        const txnDate = new Date(t.txnDate)

        if (t.txnType === 'BUY' && qty > 0) {
          const unitCost = (qty * price + fee) / qty
          lots.push({ qty, unitCost })
          const outflowBase = Math.abs(Number(t.totalAmount || qty * price + fee) * fx)
          if (outflowBase > 0) {
            xirrCashFlows.push({ amount: -outflowBase, date: txnDate })
          }
        } else if (t.txnType === 'SELL' && qty > 0) {
          let qtyToSell = qty
          let costBasis = 0
          while (qtyToSell > 0.0000001 && lots.length > 0) {
            const lot = lots[0]
            if (lot.qty <= qtyToSell) {
              costBasis += lot.qty * lot.unitCost
              qtyToSell -= lot.qty
              lots.shift()
            } else {
              costBasis += qtyToSell * lot.unitCost
              lot.qty -= qtyToSell
              qtyToSell = 0
            }
          }
          const proceeds = Number(t.totalAmount || qty * price - fee)
          const realizedGain = proceeds - costBasis
          totalRealizedGainBase += realizedGain * fx
          if (isUSD) {
            totalRealizedGainUSD += realizedGain
          }
          const inflowBase = Math.abs(proceeds * fx)
          if (inflowBase > 0) {
            xirrCashFlows.push({ amount: inflowBase, date: txnDate })
          }
        } else if (t.txnType === 'DIVIDEND') {
          const divInflowBase = Math.abs(Number(t.totalAmount || 0) * fx)
          if (divInflowBase > 0) {
            xirrCashFlows.push({ amount: divInflowBase, date: txnDate })
          }
        }
      }

      // 5. In-Memory: Total dividends received from preloaded DIVIDEND transactions (0 DB queries)
      const divTxns = txns.filter((t: any) => t.txnType === 'DIVIDEND')
      const totalDividendsBase = divTxns.reduce((sum: number, t: any) => {
        const isUSD =
          t.asset?.currency === 'USD' ||
          t.asset?.market === 'US' ||
          t.asset?.market === 'CRYPTO'
        const currency = isUSD ? 'USD' : (t.asset?.currency || 'THB').toUpperCase()
        const fx = holdingsResult.fxRates?.[currency]?.rate ?? (currency === baseCurrency ? 1 : 0)
        return sum + Number(t.totalAmount || 0) * fx
      }, 0)

      const totalDividendsUSD = divTxns.reduce((sum: number, t: any) => {
        const isUSD =
          t.asset?.currency === 'USD' ||
          t.asset?.market === 'US' ||
          t.asset?.market === 'CRYPTO'
        return sum + (isUSD ? Number(t.totalAmount || 0) : 0)
      }, 0)

      // 6. Calculate total cash & net worth across user accounts
      const { totalCash, valuationIssues: cashIssues, rates: cashRates } = await valueCashAccounts(accounts, baseCurrency)

      // 7. Calculate Today's P&L and synchronize individual live prices
      let todayPnLBase = 0
      const holdingsWithDaily = await Promise.all(
        holdingsResult.holdings.map(async (h) => {
          let quote = null
          try {
            quote = await fetchLiveAssetQuote(
              {
                id: h.assetId,
                ticker: h.ticker,
                market: h.market,
                assetType: h.assetType,
              },
              forceRefresh
            )
          } catch {}

          let reconciled = h
          if (quote && quote.price > 0) {
            if (Math.abs(quote.price - h.currentPrice) > 0.0001) {
              reconciled = reconcileHoldingPrice(h, quote.price, usdThbRate)
              syncAssetLivePrice(h.assetId, quote.price, quote.provider || 'yahoo', quote.observationTimestamp).catch(() => {})
            }
          }

          const changePercent = quote?.changePercent ?? 0
          const holdingTodayPnLBase =
            changePercent > -100
              ? reconciled.currentValueBase - reconciled.currentValueBase / (1 + changePercent / 100)
              : 0
          todayPnLBase += holdingTodayPnLBase

          return {
            ...reconciled,
            todayChangePercent: changePercent,
            todayPnLBase: holdingTodayPnLBase,
          }
        })
      )

      // Recalculate portfolio totals & allocations from reconciled holdings so everything matches 100%
      const reconciledTotalValueBase = holdingsWithDaily.reduce(
        (sum, h) => sum + h.currentValueBase,
        0
      )
      if (reconciledTotalValueBase > 0) {
        for (const h of holdingsWithDaily) {
          h.allocationPercent = (h.currentValueBase / reconciledTotalValueBase) * 100
        }
      }
      const unrealizedPnL = reconciledTotalValueBase - holdingsResult.totalCostBase
      const unrealizedPnLPercent =
        holdingsResult.totalCostBase > 0
          ? (unrealizedPnL / holdingsResult.totalCostBase) * 100
          : 0
      const reconciledNetWorth = reconciledTotalValueBase + totalCash

      const prevTotalValueBase = reconciledTotalValueBase - todayPnLBase
      const todayPnLPercent =
        prevTotalValueBase > 0 ? (todayPnLBase / prevTotalValueBase) * 100 : 0

      // 8. Calculate health score after live price reconciliation using default preset targets
      const defaultPreset = presets.find((p: any) => p.isDefault) || presets[0] || null
      const rawTargetAlloc = (defaultPreset?.targetAllocation as Record<string, unknown>) || undefined
      const cleanTargetAlloc = rawTargetAlloc
        ? (Object.fromEntries(
            Object.entries(rawTargetAlloc).filter(
              ([k, v]) => !k.startsWith('_') && typeof v === 'number'
            )
          ) as Record<string, number>)
        : undefined
      const healthScore = calculatePortfolioHealthScore(
        holdingsWithDaily,
        cleanTargetAlloc && Object.keys(cleanTargetAlloc).length > 0 ? cleanTargetAlloc : undefined
      )

      // 9. Calculate historical portfolio growth milestones & risk metrics reusing preloaded txns & splits (0 DB queries)
      const performanceData = await calculatePortfolioPerformance(
        userId,
        reconciledTotalValueBase,
        baseCurrency,
        txns,
        splitsByAssetRecord
      )

      if (reconciledTotalValueBase > 0 && xirrCashFlows.length > 0) {
        xirrCashFlows.push({ amount: reconciledTotalValueBase, date: new Date() })
      }
      const quantMetrics = calculatePortfolioRiskMetrics(performanceData, {
        baseCurrency,
        cashFlows: xirrCashFlows,
      })

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
          percent: reconciledNetWorth > 0 ? Number(((item.value / reconciledNetWorth) * 100).toFixed(1)) : 0,
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

      const summaryPayload = {
        baseCurrency,
        usdThbRate,
        totalValue: reconciledTotalValueBase,
        totalCost: holdingsResult.totalCostBase,
        netWorth: reconciledNetWorth,
        totalCash,
        valuationIssues: [...new Set([...(holdingsResult.valuationIssues ?? []), ...cashIssues])],
        valuationRates: { ...holdingsResult.fxRates, ...cashRates },
        todayPnL: todayPnLBase,
        todayPnLPercent,
        unrealizedPnL,
        unrealizedPnLPercent,
        totalRealizedGain: totalRealizedGainBase,
        totalRealizedGainUSD: totalRealizedGainUSD,
        totalDividends: totalDividendsBase,
        totalDividendsUSD,
        assetCount: holdingsResult.holdings.length,
        healthScore,
        performanceData,
        quantMetrics,
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
