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
      // 3. Parallel fetch FX rate, holdings, sell transactions, dividend transactions, digest, and alert
      const [
        usdThbRateRaw,
        holdingsResult,
        sellTxns,
        divTxns,
        latestDigest,
        unackAlert,
      ] = await Promise.all([
        getExchangeRate('USD', baseCurrency).catch(() => 35.5),
        calculateUserHoldings(userId, baseCurrency, forceRefresh),
        prisma.transaction.findMany({
          where: { userId, txnType: 'SELL' },
          include: {
            asset: { select: { currency: true, market: true } },
          },
        }),
        prisma.transaction.findMany({
          where: { userId, txnType: 'DIVIDEND' },
          include: {
            asset: { select: { currency: true, market: true } },
          },
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

      // 4. Calculate health score
      const healthScore = calculatePortfolioHealthScore(holdingsResult.holdings)

      // 5. Calculate total REALIZED GAIN from SELL transactions
      const totalRealizedProceedsBase = sellTxns.reduce((sum, t) => {
        const isUSD = t.asset.currency === 'USD' || t.asset.market === 'US'
        const fx = isUSD ? usdThbRate : 1.0
        return sum + Number(t.totalAmount || 0) * fx
      }, 0)

      const totalRealizedProceedsUSD = sellTxns.reduce((sum, t) => {
        const isUSD = t.asset.currency === 'USD' || t.asset.market === 'US'
        return sum + (isUSD ? Number(t.totalAmount || 0) : 0)
      }, 0)

      // 6. Total dividends received
      const totalDividendsBase = divTxns.reduce((sum, t) => {
        const isUSD = t.asset.currency === 'USD' || t.asset.market === 'US'
        const fx = isUSD ? usdThbRate : 1.0
        return sum + Number(t.totalAmount || 0) * fx
      }, 0)

      const totalDividendsUSD = divTxns.reduce((sum, t) => {
        const isUSD = t.asset.currency === 'USD' || t.asset.market === 'US'
        return sum + (isUSD ? Number(t.totalAmount || 0) : 0)
      }, 0)

      // 7. Calculate historical portfolio growth milestones vs SPX benchmark
      const performanceData = await calculatePortfolioPerformance(
        userId,
        holdingsResult.totalValueBase,
        baseCurrency
      )

      const summaryPayload = {
        baseCurrency,
        usdThbRate,
        totalValue: holdingsResult.totalValueBase,
        totalCost: holdingsResult.totalCostBase,
        unrealizedPnL: holdingsResult.unrealizedPnLBase,
        unrealizedPnLPercent: holdingsResult.unrealizedPnLPercent,
        totalRealizedGain: totalRealizedProceedsBase,
        totalRealizedGainUSD: totalRealizedProceedsUSD,
        totalDividends: totalDividendsBase,
        totalDividendsUSD,
        assetCount: holdingsResult.holdings.length,
        healthScore,
        performanceData,
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
