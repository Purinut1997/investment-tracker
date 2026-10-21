import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import {
  fetchMarketNews,
  fetchCompanyNews,
  refreshPortfolioAndMarketNews,
} from '@/lib/news/fetch-news'
import { calculateUserHoldings } from '@/lib/analytics/holdings'
import { fetchSingleTickerTechnicalSignal } from '@/lib/market-data/technical-signals'
import {
  detectSentiment,
  classifyNewsCategory,
  generateThaiSynthesis,
  generateDailyBrief,
  getDailyBriefHistoryList,
  getDailyBriefByDate,
  getTodayBangkokDateString,
  isHeadlineRelevantToTicker,
  invalidateDailyBriefCache,
  NewsCategory,
} from '@/lib/news/news-analyzer'

export const maxDuration = 45

const NEWS_STALE_THRESHOLD_MS = 90 * 60 * 1000 // Refresh news if oldest latest fetch > 90 minutes
const MIN_RECENT_NEWS_WINDOW_MS = 7 * 24 * 60 * 60 * 1000 // Only show & analyze news within last 7 days

// Track last full refresh timestamp per user in memory to avoid redundant RSS bursts within 5 mins
const lastUserNewsSyncMap = new Map<string, number>()

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id
  const { searchParams } = req.nextUrl
  const categoryParam = (searchParams.get('category') ?? 'portfolio') as NewsCategory
  const symbol = searchParams.get('symbol')
  const dateParam = searchParams.get('date')
  const forceRefreshParam = searchParams.get('refresh') === '1'

  const todayDate = getTodayBangkokDateString()
  const selectedDate = dateParam || todayDate
  const isHistorical = selectedDate !== todayDate

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

    // 2. Fetch history dates metadata for date selector
    const historyDates = await getDailyBriefHistoryList(userId)

    const sevenDaysAgo = new Date(Date.now() - MIN_RECENT_NEWS_WINDOW_MS)

    // 3. Build query filter (restrict to recent news within last 7 days)
    const buildWhereClause = () => {
      const clause: any = {
        publishedAt: { gte: sevenDaysAgo },
      }

      if (symbol) {
        const cleanSym = symbol.toUpperCase()
        clause.OR = [
          { symbol: cleanSym },
          { headline: { contains: cleanSym, mode: 'insensitive' as const } },
        ]
      } else if (categoryParam === 'portfolio') {
        if (userTickers.length > 0) {
          clause.OR = [
            { symbol: { in: userTickers } },
            ...userTickers.map((t) => ({ headline: { contains: t, mode: 'insensitive' as const } })),
          ]
        } else {
          clause.symbol = { not: null }
        }
      } else if (categoryParam === 'earnings') {
        clause.OR = [
          { headline: { contains: 'earnings', mode: 'insensitive' as const } },
          { headline: { contains: 'revenue', mode: 'insensitive' as const } },
          { headline: { contains: 'eps', mode: 'insensitive' as const } },
          { headline: { contains: 'dividend', mode: 'insensitive' as const } },
          { headline: { contains: 'quarterly', mode: 'insensitive' as const } },
          { summary: { contains: 'earnings', mode: 'insensitive' as const } },
        ]
      } else if (categoryParam === 'macro') {
        clause.OR = [
          { headline: { contains: 'fed', mode: 'insensitive' as const } },
          { headline: { contains: 'rate', mode: 'insensitive' as const } },
          { headline: { contains: 'inflation', mode: 'insensitive' as const } },
          { headline: { contains: 'cpi', mode: 'insensitive' as const } },
          { headline: { contains: 'yield', mode: 'insensitive' as const } },
          { headline: { contains: 'powell', mode: 'insensitive' as const } },
        ]
      }

      return clause
    }

    let rawItems = await prisma.newsItem.findMany({
      where: buildWhereClause(),
      orderBy: { publishedAt: 'desc' },
      take: 50,
    })

    // Check if news in DB is stale or missing coverage for ANY of the user's holdings
    const nowMs = Date.now()
    const latestFetchedAtMs =
      rawItems.length > 0
        ? Math.max(...rawItems.map((i) => new Date(i.fetchedAt || i.publishedAt).getTime()))
        : 0
    const isNewsStale = nowMs - latestFetchedAtMs > NEWS_STALE_THRESHOLD_MS

    // Find any active holdings that currently have 0 news items in DB (e.g., newly bought stock)
    const existingSymbolsResult = await prisma.newsItem.groupBy({
      by: ['symbol'],
      where: {
        publishedAt: { gte: sevenDaysAgo },
        symbol: { in: userTickers },
      },
    })
    const coveredSymbolSet = new Set(
      existingSymbolsResult.map((r) => (r.symbol || '').toUpperCase())
    )
    const uncoveredHoldings = activeHoldings.filter(
      (h) => !coveredSymbolSet.has(h.ticker.toUpperCase())
    )

    const lastSyncMs = lastUserNewsSyncMap.get(userId) ?? 0
    const cooldownPassed = nowMs - lastSyncMs > 3 * 60 * 1000

    let didFetchFreshNews = false

    if (forceRefreshParam || rawItems.length < 6 || isNewsStale) {
      lastUserNewsSyncMap.set(userId, nowMs)
      didFetchFreshNews = true

      if (symbol) {
        const holdingMatch = activeHoldings.find(
          (h) => h.ticker.toUpperCase() === symbol.toUpperCase()
        )
        const marketHint = holdingMatch
          ? holdingMatch.market || (holdingMatch.currency === 'THB' ? 'TH' : 'US')
          : undefined
        await fetchCompanyNews(symbol, marketHint)
      } else if (activeHoldings.length > 0) {
        await refreshPortfolioAndMarketNews(activeHoldings)
      } else {
        await fetchMarketNews()
      }

      rawItems = await prisma.newsItem.findMany({
        where: buildWhereClause(),
        orderBy: { publishedAt: 'desc' },
        take: 60,
      })
    } else if (uncoveredHoldings.length > 0 && cooldownPassed) {
      // Immediately fetch news for any newly added stock in the user's portfolio
      lastUserNewsSyncMap.set(userId, nowMs)
      didFetchFreshNews = true

      await Promise.allSettled(
        uncoveredHoldings.map((h) =>
          fetchCompanyNews(h.ticker, h.market || (h.currency === 'THB' ? 'TH' : 'US'))
        )
      )

      rawItems = await prisma.newsItem.findMany({
        where: buildWhereClause(),
        orderBy: { publishedAt: 'desc' },
        take: 60,
      })
    }

    // Also load all recent portfolio news (within 7 days) so the holdings sentiment strip
    // and AI daily brief always have full coverage across all held tickers regardless of active UI filter
    const allRecentNews = await prisma.newsItem.findMany({
      where: {
        publishedAt: { gte: sevenDaysAgo },
      },
      orderBy: { publishedAt: 'desc' },
      take: 60,
    })

    // 4. Enrich items with sentiment & Thai synthesis
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

    // 5. Calculate Holdings Sentiment Summary across all recent news (last 7 days)
    const holdingsSummary = activeHoldings.map((h) => {
      const sym = h.ticker.toUpperCase()
      const symbolNews = allRecentNews.filter(
        (n) => n.symbol === sym || isHeadlineRelevantToTicker(n.headline, sym, n.summary)
      )
      const pos = symbolNews.filter(
        (n) => (n.sentiment ?? detectSentiment(n.headline, n.summary)) === 'positive'
      ).length
      const neg = symbolNews.filter(
        (n) => (n.sentiment ?? detectSentiment(n.headline, n.summary)) === 'negative'
      ).length
      const neu = symbolNews.filter(
        (n) => (n.sentiment ?? detectSentiment(n.headline, n.summary)) === 'neutral'
      ).length

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

    // 6. Generate or retrieve Daily Brief (Historical Archive vs Today's Live/Cached Brief)
    let dailyBrief = null

    if (isHistorical) {
      dailyBrief = await getDailyBriefByDate(userId, selectedDate)
    } else {
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

      const hasGeminiKey = Boolean(
        userSettings?.geminiApiKeyEncrypted || process.env.GEMINI_API_KEY
      )

      // If we just fetched fresh news because the DB previously only had stale news,
      // invalidate any cached brief for today so the brief reflects the fresh news immediately.
      const shouldForceBriefRefresh = forceRefreshParam || didFetchFreshNews
      if (shouldForceBriefRefresh) {
        invalidateDailyBriefCache(userId, todayDate)
      }

      dailyBrief = await generateDailyBrief(
        userId,
        userHoldingContexts,
        allRecentNews,
        hasGeminiKey,
        shouldForceBriefRefresh,
        todayDate
      )
    }

    return NextResponse.json({
      items: enrichedItems,
      userTickers,
      userHoldingsSummary: holdingsSummary,
      dailyBrief,
      historyDates,
      selectedDate,
      todayDate,
      isHistorical,
      category: categoryParam,
      totalCount: enrichedItems.length,
    })
  } catch (error) {
    console.error('[news GET]', error)
    return NextResponse.json({ error: 'Failed to fetch news' }, { status: 500 })
  }
}
