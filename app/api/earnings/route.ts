import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { calculateUserHoldings } from '@/lib/analytics/holdings'
import {
  getEarningsIntelligence,
  AnalyzedEarningsData,
} from '@/lib/earnings/earnings-analyzer'

export interface PortfolioEarningsItem {
  holding: {
    assetId: string
    ticker: string
    assetName: string
    market: 'TH' | 'US'
    currency: string
    quantity: number
    avgCost: number
    currentPrice: number
    currentValue: number
    unrealizedPnLPercent: number
  }
  earningsData: AnalyzedEarningsData
}

export interface MarketEarningsItem {
  ticker: string
  market: 'TH' | 'US'
  earningsData: AnalyzedEarningsData
}

// Set maximum duration for Vercel serverless function (up to 60s)
export const maxDuration = 30

// Default benchmark/watch ideas for quick exploration (compact high-impact selection)
const DEFAULT_BENCHMARKS = [
  { ticker: 'NVDA', market: 'US' as const },
  { ticker: 'AAPL', market: 'US' as const },
  { ticker: 'MSFT', market: 'US' as const },
  { ticker: 'TSLA', market: 'US' as const },
  { ticker: 'PTT', market: 'TH' as const },
  { ticker: 'DELTA', market: 'TH' as const },
]

// In-memory cache for fast navigation and preventing Vercel function timeouts
interface EarningsCacheEntry {
  payload: any
  timestamp: number
}
const earningsRouteCache = new Map<string, EarningsCacheEntry>()
const ROUTE_CACHE_TTL = 15 * 60 * 1000 // 15 minutes

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const searchTicker = searchParams.get('search')
  const searchMarket = (searchParams.get('market') || 'US').toUpperCase() as 'TH' | 'US'
  const forceRefresh = searchParams.get('refresh') === 'true'

  try {
    const userSettings = await prisma.userSettings.findUnique({
      where: { userId: session.user.id },
    })
    const baseCurrency = userSettings?.baseCurrency ?? 'THB'

    // Case 1: Search for a single stock
    if (searchTicker && searchTicker.trim()) {
      const cleanTicker = searchTicker.trim().toUpperCase()
      const analyzed = await getEarningsIntelligence(cleanTicker, searchMarket, forceRefresh)

      if (!analyzed) {
        return NextResponse.json(
          { error: `ไม่พบข้อมูลผลประกอบการของ ${cleanTicker}` },
          { status: 404 }
        )
      }

      // Check if user holds this stock in portfolio
      const portfolioResult = await calculateUserHoldings(session.user.id, baseCurrency)
      const existingHolding = portfolioResult.holdings.find(
        (h) => h.ticker.toUpperCase() === cleanTicker
      )

      let userHolding = null
      if (existingHolding) {
        userHolding = {
          quantity: existingHolding.quantity,
          avgCost: existingHolding.avgCost,
          currentValue: existingHolding.currentValue,
          unrealizedPnLPercent: existingHolding.unrealizedPnLPercent,
          currency: existingHolding.currency,
        }
      }

      return NextResponse.json({
        data: analyzed,
        userHolding,
      })
    }

    // Check in-memory route cache for Case 2
    const cacheKey = `${session.user.id}_${baseCurrency}`
    if (!forceRefresh) {
      const cached = earningsRouteCache.get(cacheKey)
      if (cached && Date.now() - cached.timestamp < ROUTE_CACHE_TTL) {
        return NextResponse.json(cached.payload)
      }
    }

    // Case 2: Fetch portfolio earnings & curated benchmarks
    const portfolioResult = await calculateUserHoldings(session.user.id, baseCurrency, forceRefresh)
    const stockHoldings = portfolioResult.holdings.filter(
      (h) =>
        (h.assetType === 'stock' || h.assetType === 'fund' || !h.assetType) &&
        h.quantity > 0 &&
        (h.market === 'TH' || h.market === 'US')
    )

    // Process user holdings in parallel
    const portfolioPromises = stockHoldings.map(async (holding) => {
      const analyzed = await getEarningsIntelligence(
        holding.ticker,
        holding.market as 'TH' | 'US',
        forceRefresh
      )
      if (!analyzed) return null

      const item: PortfolioEarningsItem = {
        holding: {
          assetId: holding.assetId,
          ticker: holding.ticker,
          assetName: holding.assetName,
          market: holding.market as 'TH' | 'US',
          currency: holding.currency,
          quantity: holding.quantity,
          avgCost: holding.avgCost,
          currentPrice: holding.currentPrice,
          currentValue: holding.currentValue,
          unrealizedPnLPercent: holding.unrealizedPnLPercent,
        },
        earningsData: analyzed,
      }
      return item
    })

    // Process benchmarks in parallel (skipping ones already in portfolio)
    const portfolioTickers = new Set(stockHoldings.map((h) => h.ticker.toUpperCase()))
    const benchmarkCandidates = DEFAULT_BENCHMARKS.filter(
      (b) => !portfolioTickers.has(b.ticker.toUpperCase())
    )

    const benchmarkPromises = benchmarkCandidates.map(async (bench) => {
      const analyzed = await getEarningsIntelligence(bench.ticker, bench.market, forceRefresh)
      if (!analyzed) return null
      return {
        ticker: bench.ticker,
        market: bench.market,
        earningsData: analyzed,
      } as MarketEarningsItem
    })

    const [portfolioSettled, benchmarkSettled] = await Promise.all([
      Promise.allSettled(portfolioPromises),
      Promise.allSettled(benchmarkPromises),
    ])

    const portfolioItems: PortfolioEarningsItem[] = portfolioSettled
      .filter((r): r is PromiseFulfilledResult<PortfolioEarningsItem | null> => r.status === 'fulfilled')
      .map((r) => r.value)
      .filter((v): v is PortfolioEarningsItem => Boolean(v && v.earningsData && v.earningsData.ticker))

    const marketItems: MarketEarningsItem[] = benchmarkSettled
      .filter((r): r is PromiseFulfilledResult<MarketEarningsItem | null> => r.status === 'fulfilled')
      .map((r) => r.value)
      .filter((v): v is MarketEarningsItem => Boolean(v && v.earningsData && v.earningsData.ticker))

    // Sort items by upcoming earnings date ascending (closest date first)
    const sortByDate = (a: { earningsData: AnalyzedEarningsData }, b: { earningsData: AnalyzedEarningsData }) => {
      const aDays = a.earningsData?.upcoming?.daysRemaining ?? 999
      const bDays = b.earningsData?.upcoming?.daysRemaining ?? 999
      // Positive days first sorted ascending, then past dates, then 999 (tbd)
      const aWeight = aDays >= 0 ? aDays : 1000 + Math.abs(aDays)
      const bWeight = bDays >= 0 ? bDays : 1000 + Math.abs(bDays)
      return aWeight - bWeight
    }

    portfolioItems.sort(sortByDate)
    marketItems.sort(sortByDate)

    // Summary calculations
    const upcoming30Days = portfolioItems.filter(
      (i) =>
        i.earningsData?.upcoming?.daysRemaining !== undefined &&
        i.earningsData.upcoming.daysRemaining >= 0 &&
        i.earningsData.upcoming.daysRemaining <= 30
    )
    const upcoming7Days = portfolioItems.filter(
      (i) =>
        i.earningsData?.upcoming?.daysRemaining !== undefined &&
        i.earningsData.upcoming.daysRemaining >= 0 &&
        i.earningsData.upcoming.daysRemaining <= 7
    )
    const closestHolding = upcoming30Days[0] || null

    const responsePayload = {
      portfolioItems,
      marketItems,
      summary: {
        portfolioTotalHoldings: stockHoldings.length,
        portfolioMonitoredCount: portfolioItems.length,
        upcoming30DaysCount: upcoming30Days.length,
        upcoming7DaysCount: upcoming7Days.length,
        closestHolding: closestHolding
          ? {
              ticker: closestHolding.holding.ticker,
              daysRemaining: closestHolding.earningsData.upcoming.daysRemaining,
              dateThai: closestHolding.earningsData.upcoming.earningsDateThai,
            }
          : null,
      },
    }

    // Save to route cache
    earningsRouteCache.set(cacheKey, {
      payload: responsePayload,
      timestamp: Date.now(),
    })

    return NextResponse.json(responsePayload)
  } catch (error) {
    console.error('[API /api/earnings] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
