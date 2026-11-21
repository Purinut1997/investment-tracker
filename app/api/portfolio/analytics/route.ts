import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { invalidateUserPortfolioCache } from '@/lib/analytics/holdings'
import { invalidatePriceCache } from '@/lib/market-data/cache-layer'
import { calculatePortfolioAnalytics } from '@/lib/analytics/portfolio-analytics'
import { BENCHMARK_OPTIONS, BenchmarkId } from '@/lib/analytics/portfolio-analytics-math'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id
  const { searchParams } = req.nextUrl
  const rawBenchmark = (searchParams.get('benchmark') || 'SP500').toUpperCase()
  const benchmarkId: BenchmarkId = BENCHMARK_OPTIONS.some((b) => b.id === rawBenchmark)
    ? (rawBenchmark as BenchmarkId)
    : 'SP500'
  const forceRefresh = searchParams.get('refresh') === 'true'

  try {
    if (forceRefresh) {
      invalidatePriceCache()
      invalidateUserPortfolioCache(userId)
    }

    const userSettings = await prisma.userSettings.findUnique({
      where: { userId },
      select: { baseCurrency: true },
    })
    const baseCurrency = userSettings?.baseCurrency ?? 'THB'

    const payload = await calculatePortfolioAnalytics(
      userId,
      baseCurrency,
      benchmarkId,
      forceRefresh
    )

    return NextResponse.json(payload)
  } catch (error) {
    console.error('[portfolio analytics GET]', error)
    return NextResponse.json(
      { error: 'Failed to calculate portfolio analytics' },
      { status: 500 }
    )
  }
}
