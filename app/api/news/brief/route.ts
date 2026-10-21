import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { calculateUserHoldings } from '@/lib/analytics/holdings'
import { fetchSingleTickerTechnicalSignal } from '@/lib/market-data/technical-signals'
import { refreshPortfolioAndMarketNews } from '@/lib/news/fetch-news'
import { generateDailyBrief, invalidateDailyBriefCache } from '@/lib/news/news-analyzer'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id

  try {
    let targetDate: string | undefined = undefined
    try {
      const body = await req.json()
      if (body?.date) targetDate = body.date
    } catch {
      // no body
    }

    invalidateDailyBriefCache(userId, targetDate)
    const userSettings = await prisma.userSettings.findUnique({
      where: { userId },
      select: { baseCurrency: true, geminiApiKeyEncrypted: true },
    })
    const baseCurrency = userSettings?.baseCurrency ?? 'THB'
    const holdingsResult = await calculateUserHoldings(userId, baseCurrency)
    const activeHoldings = holdingsResult.holdings.filter((h) => h.quantity > 0)

    // 1. Fetch fresh live news for market & all active holdings and prune stale news > 7 days
    await refreshPortfolioAndMarketNews(activeHoldings)

    // 2. Build technical context for holdings
    const userHoldingContexts = await Promise.all(
      activeHoldings.map(async (h) => {
        const marketHint = h.market || (h.currency === 'THB' ? 'TH' : 'US')
        let sig = null
        try {
          sig = await fetchSingleTickerTechnicalSignal(h.ticker, marketHint)
        } catch {
          // ignore error and proceed
        }
        const price = sig?.currentPrice && sig.currentPrice > 0 ? sig.currentPrice : h.currentPrice

        return {
          ticker: h.ticker.toUpperCase(),
          assetName: h.assetName,
          assetType: h.assetType,
          allocationPercent: Math.round(h.allocationPercent * 10) / 10,
          unrealizedPnLPercent: Math.round(h.unrealizedPnLPercent * 10) / 10,
          currentPrice: price,
          currency: h.currency,
          supportS1: sig?.supportS1 ?? (price > 0 ? Number((price * 0.975).toFixed(2)) : null),
          supportS2: sig?.supportS2 ?? (price > 0 ? Number((price * 0.95).toFixed(2)) : null),
          resistanceR1: sig?.resistanceR1 ?? (price > 0 ? Number((price * 1.03).toFixed(2)) : null),
          sma50: sig?.sma50 ?? null,
          sma200: sig?.sma200 ?? null,
          rsi14: sig?.rsi14 ?? null,
          isNearSupport: sig?.isNearSupport ?? false,
          isOversold: sig?.isOversold ?? false,
          technicalSummary: sig?.metricSummary ?? '',
        }
      })
    )

    // 3. Query only recent news within last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const recentNews = await prisma.newsItem.findMany({
      where: {
        publishedAt: { gte: sevenDaysAgo },
      },
      orderBy: { publishedAt: 'desc' },
      take: 45,
    })

    const hasGeminiKey = Boolean(userSettings?.geminiApiKeyEncrypted || process.env.GEMINI_API_KEY)
    const brief = await generateDailyBrief(
      userId,
      userHoldingContexts,
      recentNews,
      hasGeminiKey,
      true,
      targetDate
    )

    return NextResponse.json({ brief, date: targetDate })
  } catch (error: any) {
    console.error('[news brief POST]', error)
    return NextResponse.json({ error: error.message || 'Failed to generate brief' }, { status: 500 })
  }
}
