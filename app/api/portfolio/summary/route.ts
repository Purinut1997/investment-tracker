import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { calculateUserHoldings } from '@/lib/analytics/holdings'
import { calculatePortfolioHealthScore } from '@/lib/analytics/health-score'

import { calculatePortfolioPerformance } from '@/lib/analytics/performance'

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

    // 2. Calculate holdings & live value
    const holdingsResult = await calculateUserHoldings(userId, baseCurrency)

    // 3. Calculate health score
    const healthScore = calculatePortfolioHealthScore(holdingsResult.holdings)

    // 4. Calculate total realized gain from SELL transactions
    const sellTxns = await prisma.transaction.findMany({
      where: { userId, txnType: 'SELL' },
      select: { totalAmount: true, quantity: true, pricePerUnit: true, fee: true },
    })

    const totalRealizedGain = sellTxns.reduce(
      (sum, t) => sum + Number(t.totalAmount || 0),
      0
    )

    // 5. Total dividends received
    const divTxns = await prisma.transaction.findMany({
      where: { userId, txnType: 'DIVIDEND' },
      select: { totalAmount: true },
    })
    const totalDividends = divTxns.reduce(
      (sum, t) => sum + Number(t.totalAmount || 0),
      0
    )

    // 6. Calculate historical portfolio growth milestones vs SPX benchmark
    const performanceData = await calculatePortfolioPerformance(
      userId,
      holdingsResult.totalValueBase,
      baseCurrency
    )

    // 7. Latest Weekly Digest if exists
    const latestDigest = await prisma.weeklyDigest.findFirst({
      where: { userId },
      orderBy: { weekOf: 'desc' },
    })

    // 8. Allocation Alert if unacknowledged exists
    const unackAlert = await prisma.allocationAlert.findFirst({
      where: { userId, acknowledged: false },
      orderBy: { triggeredAt: 'desc' },
    })

    return NextResponse.json({
      baseCurrency,
      totalValue: holdingsResult.totalValueBase,
      totalCost: holdingsResult.totalCostBase,
      unrealizedPnL: holdingsResult.unrealizedPnLBase,
      unrealizedPnLPercent: holdingsResult.unrealizedPnLPercent,
      totalRealizedGain,
      totalDividends,
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
