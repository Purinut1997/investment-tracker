import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { fetchMarketNews, fetchCompanyNews } from '@/lib/news/fetch-news'
import { calculateUserHoldings } from '@/lib/analytics/holdings'
import { fetchSingleTickerTechnicalSignal } from '@/lib/market-data/technical-signals'
import {
  detectSentiment,
  classifyNewsCategory,
  generateThaiSynthesis,
  generateDailyBrief,
  NewsCategory,
} from '@/lib/news/news-analyzer'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id
  const { searchParams } = req.nextUrl
  const categoryParam = (searchParams.get('category') ?? 'portfolio') as NewsCategory
  const symbol = searchParams.get('symbol')

  try {
    // 1. Get user settings and active holdings
    const userSettings = await prisma.userSettings.findUnique({
      where: { userId },
      select: { baseCurrency: true, geminiApiKeyEncrypted: true },
    })
    const baseCurrency = userSettings?.baseCurrency ?? 'THB'
    const holdingsResult = await calculateUserHoldings(userId, baseCurrency)
    const activeHoldings = holdingsResult.holdings.filter((h) => h.quantity > 0)
    const userTickers = activeHoldings.map((h) => h.ticker.toUpperCase())

    // 2. Fetch news items
    let whereClause: any = {}

    if (symbol) {
      whereClause.symbol = symbol.toUpperCase()
    } else if (categoryParam === 'portfolio') {
      if (userTickers.length > 0) {
        whereClause.OR = [
          { symbol: { in: userTickers } },
          ...userTickers.map((t) => ({ headline: { contains: t, mode: 'insensitive' as const } })),
        ]
      } else {
        whereClause.symbol = { not: null }
      }
    } else if (categoryParam === 'earnings') {
      whereClause.OR = [
        { headline: { contains: 'earnings', mode: 'insensitive' as const } },
        { headline: { contains: 'revenue', mode: 'insensitive' as const } },
        { headline: { contains: 'eps', mode: 'insensitive' as const } },
        { headline: { contains: 'dividend', mode: 'insensitive' as const } },
        { headline: { contains: 'quarterly', mode: 'insensitive' as const } },
        { summary: { contains: 'earnings', mode: 'insensitive' as const } },
      ]
    } else if (categoryParam === 'macro') {
      whereClause.OR = [
        { headline: { contains: 'fed', mode: 'insensitive' as const } },
        { headline: { contains: 'rate', mode: 'insensitive' as const } },
        { headline: { contains: 'inflation', mode: 'insensitive' as const } },
        { headline: { contains: 'cpi', mode: 'insensitive' as const } },
        { headline: { contains: 'yield', mode: 'insensitive' as const } },
        { headline: { contains: 'powell', mode: 'insensitive' as const } },
      ]
    } else {
      // General market
      // Allow all
    }

    let rawItems = await prisma.newsItem.findMany({
      where: whereClause,
      orderBy: { publishedAt: 'desc' },
      take: 40,
    })

    // If cache is empty or sparse, trigger fresh fetch and re-query
    if (rawItems.length < 5) {
      if (categoryParam === 'general' || categoryParam === 'macro') {
        await fetchMarketNews()
      } else if (userTickers.length > 0) {
        await Promise.all(userTickers.slice(0, 4).map((t) => fetchCompanyNews(t)))
      } else {
        await fetchMarketNews()
      }

      rawItems = await prisma.newsItem.findMany({
        where: whereClause,
        orderBy: { publishedAt: 'desc' },
        take: 40,
      })
    }

    // 3. Enrich items with sentiment & Thai synthesis
    const enrichedItems = rawItems.map((item) => {
      const sentiment = item.sentiment ?? detectSentiment(item.headline, item.summary)
      const isHeld = item.symbol ? userTickers.includes(item.symbol.toUpperCase()) : false
      const inferredCategory = classifyNewsCategory(item.headline, item.summary, isHeld)
      const synthesis = generateThaiSynthesis(item.headline, item.summary, item.symbol, sentiment)

      return {
        id: item.id,
        symbol: item.symbol,
        headline: item.headline,
        summary: item.summary,
        sourceName: item.sourceName,
        sourceUrl: item.sourceUrl,
        publishedAt: item.publishedAt.toISOString(),
        sentiment,
        category: inferredCategory,
        synthesis,
      }
    })

    // 4. Calculate Holdings Sentiment Summary for quick strip
    const holdingsSummary = activeHoldings.map((h) => {
      const sym = h.ticker.toUpperCase()
      const symbolNews = rawItems.filter(
        (n) => n.symbol === sym || n.headline.toUpperCase().includes(sym)
      )
      const pos = symbolNews.filter((n) => (n.sentiment ?? detectSentiment(n.headline, n.summary)) === 'positive').length
      const neg = symbolNews.filter((n) => (n.sentiment ?? detectSentiment(n.headline, n.summary)) === 'negative').length
      const neu = symbolNews.filter((n) => (n.sentiment ?? detectSentiment(n.headline, n.summary)) === 'neutral').length

      return {
        symbol: sym,
        assetName: h.assetName,
        allocationPercent: Math.round(h.allocationPercent * 10) / 10,
        positiveCount: pos,
        negativeCount: neg,
        neutralCount: neu,
        totalNewsCount: symbolNews.length,
      }
    })

    // 5. Generate or get Daily Brief with grounded technical signals
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

    const hasGeminiKey = Boolean(userSettings?.geminiApiKeyEncrypted || process.env.GEMINI_API_KEY)
    const dailyBrief = await generateDailyBrief(userId, userHoldingContexts, rawItems, hasGeminiKey, false)

    return NextResponse.json({
      items: enrichedItems,
      userTickers,
      userHoldingsSummary: holdingsSummary,
      dailyBrief,
      category: categoryParam,
      totalCount: enrichedItems.length,
    })
  } catch (error) {
    console.error('[news GET]', error)
    return NextResponse.json({ error: 'Failed to fetch news' }, { status: 500 })
  }
}
