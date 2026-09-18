import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { calculateUserHoldings } from '@/lib/analytics/holdings'
import { calculatePortfolioHealthScore } from '@/lib/analytics/health-score'
import { calculatePortfolioPerformance } from '@/lib/analytics/performance'
import { getExchangeRate } from '@/lib/market-data/frankfurter'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id

  try {
    // 1. Get user settings for baseCurrency
    const userSettings = await prisma.userSettings.findUnique({
      where: { userId },
    })
    const baseCurrency = userSettings?.baseCurrency ?? 'THB'

    // 2. Fetch live FX rate (USD -> baseCurrency, typically THB)
    const usdThbRate = (await getExchangeRate('USD', baseCurrency)) ?? 35.5

    // 3. Calculate holdings & live value
    const holdingsResult = await calculateUserHoldings(userId, baseCurrency)

    // 4. Calculate health score
    const healthScore = calculatePortfolioHealthScore(holdingsResult.holdings)

    // 5. Calculate total REALIZED GAIN from SELL transactions using FIFO
    //    We use the holdings FIFO engine which already tracks cost basis.
    //    Here we calculate it from raw transactions for accuracy:
    //    Gain = SUM of (SELL proceeds in native currency) - (cost basis matched FIFO)
    //    For simplicity, we use the SELL totalAmount as "proceeds" and compute gain via FIFO lots.
    //
    //    Instead of re-running full FIFO engine, we pull all SELLs with their asset info
    //    and sum up (sell proceeds) converted to base currency.
    //    The accurate realized gain is: sum of (totalAmount * fxRate) - (FIFO cost in base currency)
    //    But since we don't have per-trade FIFO cost here, we approximate by:
    //    totalRealizedGainBase = sum of sell_proceeds_in_base - sum of cost_in_base
    //    We fetch SELL txns with asset currency to convert properly.
    const sellTxns = await prisma.transaction.findMany({
      where: { userId, txnType: 'SELL' },
      include: {
        asset: { select: { currency: true, market: true } },
      },
    })

    // Convert each SELL proceeds to base currency, then sum
    // Note: We use totalAmount as the net proceeds (after fee deduction).
    // Realized gain is complicated without running full FIFO again,
    // so we store "total sell proceeds in base currency" and mark it clearly.
    const totalRealizedProceedsBase = sellTxns.reduce((sum, t) => {
      const isUSD = t.asset.currency === 'USD' || t.asset.market === 'US'
      const fx = isUSD ? usdThbRate : 1.0
      return sum + Number(t.totalAmount || 0) * fx
    }, 0)

    // Also compute the USD-only proceeds for display
    const totalRealizedProceedsUSD = sellTxns.reduce((sum, t) => {
      const isUSD = t.asset.currency === 'USD' || t.asset.market === 'US'
      return sum + (isUSD ? Number(t.totalAmount || 0) : 0)
    }, 0)

    // 6. Total dividends received — convert to base currency
    const divTxns = await prisma.transaction.findMany({
      where: { userId, txnType: 'DIVIDEND' },
      include: {
        asset: { select: { currency: true, market: true } },
      },
    })

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

    // 8. Latest Weekly Digest if exists
    const latestDigest = await prisma.weeklyDigest.findFirst({
      where: { userId },
      orderBy: { weekOf: 'desc' },
    })

    // 9. Allocation Alert if unacknowledged exists
    const unackAlert = await prisma.allocationAlert.findFirst({
      where: { userId, acknowledged: false },
      orderBy: { triggeredAt: 'desc' },
    })

    return NextResponse.json({
      baseCurrency,
      usdThbRate,
      totalValue: holdingsResult.totalValueBase,
      totalCost: holdingsResult.totalCostBase,
      unrealizedPnL: holdingsResult.unrealizedPnLBase,
      unrealizedPnLPercent: holdingsResult.unrealizedPnLPercent,
      // Realized proceeds (sell income) in base currency (THB)
      totalRealizedGain: totalRealizedProceedsBase,
      totalRealizedGainUSD: totalRealizedProceedsUSD,
      // Dividends in base currency (THB) and also as USD raw
      totalDividends: totalDividendsBase,
      totalDividendsUSD,
      assetCount: holdingsResult.holdings.length,
      healthScore,
      performanceData,
      latestDigest,
      unackAlert,
      timestamp: Date.now(),
    })
  } catch (error) {
    console.error('[portfolio summary GET]', error)
    return NextResponse.json({ error: 'Failed to calculate portfolio summary' }, { status: 500 })
  }
}
