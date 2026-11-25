import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { callGemini } from '@/lib/ai/gemini-client'
import { getObservationTime } from '@/lib/ai/advisor-evidence'
import { parseUserInvestmentMemory } from '@/lib/ai/outcome-evaluator'
import {
  calculateSingleAssetFifoPosition,
  calculateUserHoldings,
} from '@/lib/analytics/holdings'
import { getAssetSplitsForSingleAsset } from '@/lib/analytics/stock-splits'
import { extractStrategyBuckets } from '@/lib/analytics/strategy-buckets'
import {
  DailyStockAdvisorResponse,
  computeAnnualizedVolatility30d,
  computeStockRiskAssessment,
  getBangkokDateKey,
  parseDailyStockAiReport,
} from '@/lib/analytics/stock-daily-advisor'
import { getEarningsIntelligence } from '@/lib/earnings/earnings-analyzer'
import { fetchRealHumanSentiment } from '@/lib/market-data/fear-greed'
import { getExchangeRate } from '@/lib/market-data/frankfurter'
import { parseHistoricalStats } from '@/lib/market-data/historical-stats'
import { yahooFinanceProvider } from '@/lib/market-data/yahoo'
import { getYahooQuoteSummary } from '@/lib/market-data/yahoo-crumb'

export const maxDuration = 45

function formatYahooTicker(rawSymbol: string, market: string): string {
  if (
    rawSymbol === 'GOLD' ||
    rawSymbol === 'XAU' ||
    rawSymbol === 'XAUUSD' ||
    rawSymbol === 'GOLD9999' ||
    rawSymbol === 'GOLD965' ||
    rawSymbol === 'DIME-GOLD'
  ) {
    return 'GC=F'
  }
  if (rawSymbol === 'BTC') return 'BTC-USD'
  if (rawSymbol === 'ETH') return 'ETH-USD'
  if (rawSymbol === 'SOL') return 'SOL-USD'
  if (market === 'TH' && !rawSymbol.endsWith('.BK')) return `${rawSymbol}.BK`
  return rawSymbol
}

interface DailyTechnicalSnapshot {
  observationTimestamp: number | undefined
  name: string
  currency: string
  currentPrice: number
  todayChangePercent: number
  fiftyTwoWeekHigh: number | null
  fiftyTwoWeekLow: number | null
  dailyCloses: number[]
  rsi: number | null
  rsiStatus: 'oversold' | 'overbought' | 'neutral' | null
  ema200: number | null
  trendVsEma200: 'bullish' | 'bearish' | null
  s1: number | null
  s2: number | null
  r1: number | null
  r2: number | null
  pivot: number | null
  rawChartResult: any
}

async function fetchDailyChartAndTechnicals(
  rawSymbol: string,
  market: string
): Promise<DailyTechnicalSnapshot | null> {
  const yfTicker = formatYahooTicker(rawSymbol, market)
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    yfTicker
  )}?range=1y&interval=1d`

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(4500),
    })
    if (!res.ok) return null
    const json = await res.json()
    const result = json?.chart?.result?.[0]
    if (!result) return null

    const meta = result.meta || {}
    const timestamps: number[] = result.timestamp || []
    const quote = result.indicators?.quote?.[0] || {}
    const highs: Array<number | null> = quote.high || []
    const lows: Array<number | null> = quote.low || []
    const closes: Array<number | null> = quote.close || []

    const validBars: Array<{ high: number; low: number; close: number }> = []
    let lastCloseTime: number | undefined
    for (let i = 0; i < timestamps.length; i++) {
      const c = closes[i]
      if (c !== null && c !== undefined && Number.isFinite(c) && c > 0) {
        lastCloseTime = timestamps[i] * 1000
        validBars.push({
          high: Number(highs[i] ?? c),
          low: Number(lows[i] ?? c),
          close: Number(c),
        })
      }
    }

    const dailyCloses = validBars.map((b) => b.close)
    const currentPrice = Number(
      meta.regularMarketPrice ?? dailyCloses[dailyCloses.length - 1] ?? 0
    )
    const prevClose = Number(
      meta.previousClose ??
        meta.regularMarketPreviousClose ??
        meta.chartPreviousClose ??
        dailyCloses[dailyCloses.length - 2] ??
        currentPrice
    )
    const todayChange =
      meta.regularMarketChange !== undefined && meta.regularMarketChange !== null
        ? Number(meta.regularMarketChange)
        : currentPrice - prevClose
    const todayChangePercent =
      meta.regularMarketChangePercent !== undefined && meta.regularMarketChangePercent !== null
        ? Number(meta.regularMarketChangePercent)
        : prevClose > 0
        ? (todayChange / prevClose) * 100
        : 0

    // EMA 200
    let ema200: number | null = null
    if (dailyCloses.length >= 20) {
      const seedLen = Math.min(200, dailyCloses.length)
      let ema = dailyCloses.slice(0, seedLen).reduce((a, b) => a + b, 0) / seedLen
      const k = 2 / (200 + 1)
      for (let i = seedLen; i < dailyCloses.length; i++) {
        ema = dailyCloses[i] * k + ema * (1 - k)
      }
      ema200 = Number(ema.toFixed(2))
    }

    // Wilder RSI(14)
    let rsi: number | null = null
    if (dailyCloses.length > 14) {
      let gains = 0
      let losses = 0
      for (let i = 1; i <= 14; i++) {
        const diff = dailyCloses[i] - dailyCloses[i - 1]
        if (diff >= 0) gains += diff
        else losses += Math.abs(diff)
      }
      let avgGain = gains / 14
      let avgLoss = losses / 14
      for (let i = 15; i < dailyCloses.length; i++) {
        const diff = dailyCloses[i] - dailyCloses[i - 1]
        avgGain = (avgGain * 13 + (diff > 0 ? diff : 0)) / 14
        avgLoss = (avgLoss * 13 + (diff < 0 ? Math.abs(diff) : 0)) / 14
      }
      rsi = avgLoss === 0 ? 100 : Number((100 - 100 / (1 + avgGain / avgLoss)).toFixed(1))
    }

    const rsiStatus: DailyTechnicalSnapshot['rsiStatus'] =
      rsi === null ? null : rsi <= 30 ? 'oversold' : rsi >= 70 ? 'overbought' : 'neutral'
    const trendVsEma200: DailyTechnicalSnapshot['trendVsEma200'] =
      ema200 !== null && currentPrice > 0 ? (currentPrice >= ema200 ? 'bullish' : 'bearish') : null

    // Pivot S1/S2/R1/R2 over last 22 trading days (1M window)
    const recentBars = validBars.slice(-22)
    let pivot: number | null = null
    let r1: number | null = null
    let r2: number | null = null
    let s1: number | null = null
    let s2: number | null = null
    if (recentBars.length > 0) {
      const pHigh = Math.max(...recentBars.map((b) => b.high))
      const pLow = Math.min(...recentBars.map((b) => b.low))
      const pClose = recentBars[recentBars.length - 1].close
      const p = (pHigh + pLow + pClose) / 3
      pivot = Number(p.toFixed(2))
      r1 = Number((2 * p - pLow).toFixed(2))
      s1 = Number((2 * p - pHigh).toFixed(2))
      r2 = Number((p + (pHigh - pLow)).toFixed(2))
      s2 = Number((p - (pHigh - pLow)).toFixed(2))
    }

    return {
      observationTimestamp: typeof meta.regularMarketTime === 'number' ? meta.regularMarketTime * 1000 : lastCloseTime,
      name: meta.longName || meta.shortName || rawSymbol,
      currency: meta.currency || (market === 'TH' ? 'THB' : 'USD'),
      currentPrice: Number(currentPrice.toFixed(4)),
      todayChangePercent: Number(todayChangePercent.toFixed(2)),
      fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh ? Number(meta.fiftyTwoWeekHigh) : null,
      fiftyTwoWeekLow: meta.fiftyTwoWeekLow ? Number(meta.fiftyTwoWeekLow) : null,
      dailyCloses,
      rsi,
      rsiStatus,
      ema200,
      trendVsEma200,
      s1,
      s2,
      r1,
      r2,
      pivot,
      rawChartResult: result,
    }
  } catch {
    return null
  }
}

async function assembleDailyStockContext(
  userId: string,
  rawSymbol: string,
  market: string
): Promise<{
  response: DailyStockAdvisorResponse
  userMemorySummary: string
  freeCashflow: number | null
  todayTag: string
  observedAt: string | null
}> {
  const cleanSymbol = rawSymbol.trim().toUpperCase()
  const cleanMarket = market.trim().toUpperCase() || 'US'
  const yfTicker = formatYahooTicker(cleanSymbol, cleanMarket)
  const reportDate = getBangkokDateKey()
  const symbolPrefix = `[daily-stock:v2:${cleanMarket}:${cleanSymbol}:`
  const todayTag = `${symbolPrefix}${reportDate}]`

  const finnhubKey = process.env.FINNHUB_API_KEY
  const shouldFetchFinnhub =
    Boolean(finnhubKey) &&
    cleanMarket === 'US' &&
    !cleanSymbol.includes('-') &&
    !cleanSymbol.includes('=')

  // Parallel fetches across Yahoo, Finnhub, Prisma, News, Macro, and Earnings
  const [
    dailyChart,
    yahoo5yJson,
    ySummary,
    finnhubTarget,
    finnhubRecom,
    finnhubMetric,
    userSettings,
    userTxns,
    defaultPreset,
    holdingsResult,
    usdThbRateRaw,
    tickerNews,
    vixQuote,
    sp500Quote,
    fearGreed,
    earningsIntel,
    todayAdviceLog,
    latestAdviceLog,
  ] = await Promise.all([
    fetchDailyChartAndTechnicals(cleanSymbol, cleanMarket),
    fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
        yfTicker
      )}?range=5y&interval=1mo&events=div|split`,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(4000),
      }
    )
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null),
    getYahooQuoteSummary(yfTicker).catch(() => null),
    shouldFetchFinnhub
      ? fetch(
          `https://finnhub.io/api/v1/stock/price-target?symbol=${encodeURIComponent(
            cleanSymbol
          )}&token=${finnhubKey}`,
          { signal: AbortSignal.timeout(3000) }
        )
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null)
      : Promise.resolve(null),
    shouldFetchFinnhub
      ? fetch(
          `https://finnhub.io/api/v1/stock/recommendation?symbol=${encodeURIComponent(
            cleanSymbol
          )}&token=${finnhubKey}`,
          { signal: AbortSignal.timeout(3000) }
        )
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null)
      : Promise.resolve(null),
    shouldFetchFinnhub
      ? fetch(
          `https://finnhub.io/api/v1/stock/metric?symbol=${encodeURIComponent(
            cleanSymbol
          )}&metric=all&token=${finnhubKey}`,
          { signal: AbortSignal.timeout(3000) }
        )
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null)
      : Promise.resolve(null),
    prisma.userSettings.findUnique({ where: { userId } }),
    prisma.transaction.findMany({
      where: { userId, asset: { ticker: cleanSymbol } },
      orderBy: { txnDate: 'asc' },
    }),
    prisma.investmentPreset.findFirst({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    }),
    calculateUserHoldings(userId, 'THB', false).catch(() => null),
    getExchangeRate('USD', 'THB').catch(() => 35.5),
    prisma.newsItem
      .findMany({
        where: { symbol: cleanSymbol },
        orderBy: { publishedAt: 'desc' },
        take: 5,
        select: {
          headline: true,
          sourceName: true,
          sentiment: true,
          publishedAt: true,
          sourceUrl: true,
        },
      })
      .catch(() => []),
    yahooFinanceProvider.getQuote('VIX', 'US').catch(() => null),
    yahooFinanceProvider.getQuote('S&P 500', 'US').catch(() => null),
    fetchRealHumanSentiment().catch(() => null),
    getEarningsIntelligence(cleanSymbol, cleanMarket === 'TH' ? 'TH' : 'US').catch(() => null),
    prisma.aiAdviceLog.findFirst({
      where: { userId, prompt: { contains: todayTag } },
      orderBy: { createdAt: 'desc' },
      select: { response: true, modelUsed: true, createdAt: true },
    }),
    prisma.aiAdviceLog.findFirst({
      where: { userId, prompt: { contains: symbolPrefix } },
      orderBy: { createdAt: 'desc' },
      select: { response: true, modelUsed: true, createdAt: true },
    }),
  ])

  const usdThbRate = usdThbRateRaw ?? 35.5
  const baseCurrency = userSettings?.baseCurrency ?? 'THB'
  const userMemory = parseUserInvestmentMemory(userSettings?.defaultRiskProfile)

  const currentPrice = dailyChart?.currentPrice ?? 0
  const currency = dailyChart?.currency || (cleanMarket === 'TH' ? 'THB' : 'USD')
  const todayChangePercent = dailyChart?.todayChangePercent ?? 0

  // Asset splits & FIFO user position
  const assetSplits =
    userTxns.length > 0 ? await getAssetSplitsForSingleAsset(userId, userTxns[0].assetId) : []
  const rawPos =
    userTxns.length > 0
      ? calculateSingleAssetFifoPosition(userTxns, currentPrice, assetSplits)
      : null

  const yahoo5yResult = yahoo5yJson?.chart?.result?.[0] || dailyChart?.rawChartResult || null
  const payoutRatio = ySummary?.payoutRatio ?? null
  const historicalStats = yahoo5yResult
    ? parseHistoricalStats(yahoo5yResult, currentPrice, userTxns, rawPos, payoutRatio)
    : null

  // Total portfolio value converted to this stock's native currency
  let position: DailyStockAdvisorResponse['contextSnapshot']['position'] = null
  if (rawPos && rawPos.shares > 0) {
    const isStockUsd = currency === 'USD'
    let totalPortfolioValueNative: number | null = null
    if (holdingsResult && holdingsResult.totalValueBase > 0) {
      totalPortfolioValueNative = isStockUsd
        ? holdingsResult.totalValueBase / usdThbRate
        : holdingsResult.totalValueBase
      totalPortfolioValueNative = Number(
        Math.max(rawPos.currentValue, totalPortfolioValueNative).toFixed(2)
      )
    }

    const portfolioWeightPct =
      totalPortfolioValueNative && totalPortfolioValueNative > 0
        ? Number(((rawPos.currentValue / totalPortfolioValueNative) * 100).toFixed(2))
        : null

    const buckets = extractStrategyBuckets(
      (defaultPreset?.targetAllocation as Record<string, any> | null | undefined) ?? null,
      holdingsResult?.holdings ?? []
    )
    const matchedBucket = buckets.find((b) =>
      b.tickers.some((t) => t.toUpperCase() === cleanSymbol)
    )

    position = {
      shares: rawPos.shares,
      avgCost: rawPos.avgCost,
      totalCost: rawPos.totalCost,
      currentValue: rawPos.currentValue,
      unrealizedGain: rawPos.unrealizedGain,
      unrealizedGainPercent: rawPos.unrealizedGainPercent,
      portfolioWeightPct,
      totalPortfolioValueNative,
      bucketName: matchedBucket?.name ?? null,
      bucketStrategyType: matchedBucket?.strategyType ?? null,
      takeProfitPct: matchedBucket?.takeProfitPercent ?? null,
      stopLossPct: matchedBucket?.stopLossPercent ?? null,
      maxSinglePositionPct: userMemory.maxSinglePositionPercent,
    }
  }

  // Fallback to general news if ticker has no specific news
  const newsRows =
    tickerNews.length > 0
      ? tickerNews
      : await prisma.newsItem
          .findMany({
            where: { symbol: null },
            orderBy: { publishedAt: 'desc' },
            take: 3,
            select: {
              headline: true,
              sourceName: true,
              sentiment: true,
              publishedAt: true,
              sourceUrl: true,
            },
          })
          .catch(() => [])

  const news = newsRows.map((n) => ({
    headline: n.headline,
    sourceName: n.sourceName,
    sentiment: n.sentiment || 'neutral',
    publishedAt: new Date(n.publishedAt).toISOString(),
    sourceUrl: n.sourceUrl,
  }))

  // 52w High/Low & Pullback
  const fiftyTwoWeekHigh =
    Number(finnhubMetric?.metric?.['52WeekHigh'] || 0) ||
    dailyChart?.fiftyTwoWeekHigh ||
    historicalStats?.performance?.fiftyTwoWeekHigh ||
    null
  const fiftyTwoWeekLow =
    Number(finnhubMetric?.metric?.['52WeekLow'] || 0) ||
    dailyChart?.fiftyTwoWeekLow ||
    historicalStats?.performance?.fiftyTwoWeekLow ||
    null
  const pullbackFrom52wHigh =
    fiftyTwoWeekHigh && fiftyTwoWeekHigh > 0 && currentPrice > 0
      ? Number((((currentPrice - fiftyTwoWeekHigh) / fiftyTwoWeekHigh) * 100).toFixed(2))
      : historicalStats?.performance?.pullbackFrom52wHigh ?? null

  // Analyst Target
  let targetLow: number | null = null
  let targetMean: number | null = null
  let targetHigh: number | null = null
  let upsidePercent: number | null = null
  let recommendation: string | null = null

  if (finnhubTarget && finnhubTarget.targetMean) {
    targetMean = Number(finnhubTarget.targetMean)
    targetHigh = finnhubTarget.targetHigh ? Number(finnhubTarget.targetHigh) : null
    targetLow = finnhubTarget.targetLow ? Number(finnhubTarget.targetLow) : null
    if (currentPrice > 0) {
      upsidePercent = Number((((targetMean - currentPrice) / currentPrice) * 100).toFixed(2))
    }
    const latestRecom =
      Array.isArray(finnhubRecom) && finnhubRecom.length > 0 ? finnhubRecom[0] : null
    if (latestRecom) {
      const buyScore = (latestRecom.strongBuy || 0) * 2 + (latestRecom.buy || 0)
      const sellScore = (latestRecom.strongSell || 0) * 2 + (latestRecom.sell || 0)
      recommendation =
        buyScore > sellScore * 1.5
          ? 'STRONG BUY'
          : buyScore > sellScore
          ? 'BUY'
          : sellScore > buyScore
          ? 'UNDERPERFORM'
          : 'HOLD'
    }
  }

  const trailingPe =
    finnhubMetric?.metric?.peBasicExclExtraItemsTTM ?? ySummary?.pe ?? null
  const forwardPe = ySummary?.forwardPe ?? null
  const dividendYield =
    finnhubMetric?.metric?.dividendYieldIndicatedAnnual ??
    ySummary?.dividendYield ??
    historicalStats?.dividends?.ttmYield ??
    null
  const revenueGrowth = ySummary?.revenueGrowth ?? null
  const debtToEquity = ySummary?.debtToEquity ?? null

  const upcomingEarnings = earningsIntel?.upcoming ?? null
  const daysToEarnings = upcomingEarnings?.hasUpcomingDate ? upcomingEarnings.daysRemaining : null
  const nextXd = historicalStats?.estimatedNextPayout ?? null

  const vol30dPct = computeAnnualizedVolatility30d(dailyChart?.dailyCloses ?? [])

  const quant = computeStockRiskAssessment({
    currentPrice,
    todayChangePercent,
    pullbackFrom52wHigh,
    dailyCloses: dailyChart?.dailyCloses ?? [],
    rsi: dailyChart?.rsi ?? null,
    ema200: dailyChart?.ema200 ?? null,
    trendVsEma200: dailyChart?.trendVsEma200 ?? null,
    s1: dailyChart?.s1 ?? null,
    s2: dailyChart?.s2 ?? null,
    r1: dailyChart?.r1 ?? null,
    r2: dailyChart?.r2 ?? null,
    pivot: dailyChart?.pivot ?? null,
    pe: trailingPe !== null ? Number(trailingPe) : null,
    forwardPe: forwardPe !== null ? Number(forwardPe) : null,
    debtToEquity,
    freeCashflow: ySummary?.freeCashflow ?? null,
    payoutRatio,
    daysToEarnings,
    vixPrice: vixQuote?.price ?? null,
    fearGreedScore: fearGreed?.source === 'CNN_LIVE' && getObservationTime(Date.parse(fearGreed.timestamp), Date.now()) ? fearGreed.score : null,
    newsSentiments: news.map((n) => n.sentiment),
    position,
  })

  // Check cached AI report (today first, else latest)
  const chosenLog = todayAdviceLog || latestAdviceLog
  const isTodayReport = Boolean(todayAdviceLog)
  const parsedReport = chosenLog ? parseDailyStockAiReport(chosenLog.response) : null

  const response: DailyStockAdvisorResponse = {
    symbol: cleanSymbol,
    name: dailyChart?.name || cleanSymbol,
    market: cleanMarket,
    reportDate,
    quant,
    contextSnapshot: {
      currentPrice,
      currency,
      todayChangePercent,
      fiftyTwoWeekHigh,
      fiftyTwoWeekLow,
      pullbackFrom52wHigh,
      historicalReturns: {
        return1M: historicalStats?.performance?.return1M ?? null,
        return3M: historicalStats?.performance?.return3M ?? null,
        return6M: historicalStats?.performance?.return6M ?? null,
        return1Y: historicalStats?.performance?.return1Y ?? null,
        return3Y: historicalStats?.performance?.return3Y ?? null,
        return5Y: historicalStats?.performance?.return5Y ?? null,
      },
      technical: {
        rsi: dailyChart?.rsi ?? null,
        rsiStatus: dailyChart?.rsiStatus ?? null,
        ema200: dailyChart?.ema200 ?? null,
        trendVsEma200: dailyChart?.trendVsEma200 ?? null,
        s1: dailyChart?.s1 ?? null,
        s2: dailyChart?.s2 ?? null,
        r1: dailyChart?.r1 ?? null,
        r2: dailyChart?.r2 ?? null,
        pivot: dailyChart?.pivot ?? null,
        vol30dPct,
      },
      macro: {
        vixPrice: vixQuote?.price ?? null,
        vixChangePct: vixQuote?.changePercent ?? null,
        sp500ChangePct: sp500Quote?.changePercent ?? null,
        fearGreedScore: fearGreed?.source === 'CNN_LIVE' && getObservationTime(Date.parse(fearGreed.timestamp), Date.now()) ? fearGreed.score : null,
        fearGreedLabel: fearGreed?.source === 'CNN_LIVE' && getObservationTime(Date.parse(fearGreed.timestamp), Date.now()) ? fearGreed.ratingLabelTh : null,
      },
      news,
      position,
      forward: {
        targetLow,
        targetMean,
        targetHigh,
        upsidePercent,
        recommendation,
        trailingPe: trailingPe !== null ? Number(Number(trailingPe).toFixed(2)) : null,
        forwardPe: forwardPe !== null ? Number(Number(forwardPe).toFixed(2)) : null,
        dividendYield: dividendYield !== null ? Number(Number(dividendYield).toFixed(2)) : null,
        payoutRatio: payoutRatio !== null ? Number(Number(payoutRatio).toFixed(2)) : null,
        revenueGrowth: revenueGrowth !== null ? Number(Number(revenueGrowth).toFixed(2)) : null,
        debtToEquity,
        earningsLabel: upcomingEarnings?.hasUpcomingDate ? upcomingEarnings.countdownLabel : null,
        earningsDateThai: upcomingEarnings?.earningsDateThai ?? null,
        daysToEarnings,
        nextXdDate: nextXd?.estimatedDate ?? null,
        nextXdDays: nextXd?.daysRemaining ?? null,
        nextXdAmount: nextXd?.estimatedAmount ?? null,
      },
    },
    aiReport: parsedReport,
    modelUsed: parsedReport && chosenLog ? chosenLog.modelUsed : null,
    updatedAt: parsedReport && chosenLog ? chosenLog.createdAt.toISOString() : null,
    isTodayReport: Boolean(parsedReport && isTodayReport),
    cached: Boolean(parsedReport),
  }

  const userMemorySummary = `สไตล์: ${userMemory.preferredStyle}, รับความเสี่ยง: ${userMemory.riskTolerance}, ระยะลงทุน: ${userMemory.horizonYears} ปี, สัดส่วนสูงสุดต่อหุ้น: ${userMemory.maxSinglePositionPercent}%, กฎส่วนตัว: ${userMemory.personalRules} (สกุลเงินหลัก ${baseCurrency})`

  return {
    response,
    userMemorySummary,
    freeCashflow: ySummary?.freeCashflow ?? null,
    todayTag,
    observedAt: getObservationTime(dailyChart?.observationTimestamp, Date.now()),
  }
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = req.nextUrl
  const symbol = searchParams.get('symbol')?.trim()?.toUpperCase()
  const market = searchParams.get('market')?.trim()?.toUpperCase() || 'US'

  if (!symbol) {
    return NextResponse.json({ error: 'Missing symbol' }, { status: 400 })
  }

  try {
    const { response } = await assembleDailyStockContext(session.user.id, symbol, market)
    return NextResponse.json(response)
  } catch (error: any) {
    console.error('[daily-risk-advisor GET]', error)
    return NextResponse.json(
      { error: error.message || 'Failed to assemble daily stock risk data' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const symbol = String(body?.symbol || '').trim().toUpperCase()
    const market = String(body?.market || 'US').trim().toUpperCase() || 'US'
    const forceRefresh = Boolean(body?.forceRefresh)

    if (!symbol) {
      return NextResponse.json({ error: 'Missing symbol' }, { status: 400 })
    }

    const { response, userMemorySummary, freeCashflow, todayTag, observedAt } =
      await assembleDailyStockContext(session.user.id, symbol, market)

    if (!observedAt || !(response.contextSnapshot.currentPrice > 0)) {
      return NextResponse.json({ error: 'ไม่มีราคาที่ใหม่พอสำหรับสร้างรายงานความเสี่ยงรายวัน' }, { status: 503 })
    }
    if (!forceRefresh && response.isTodayReport && response.aiReport) {
      return NextResponse.json({ ...response, cached: true })
    }

    const snap = response.contextSnapshot
    const q = response.quant
    const currSym = snap.currency === 'THB' ? '฿' : '$'

    const newsText =
      snap.news.length > 0
        ? snap.news
            .map(
              (n, i) =>
                `  ${i + 1}. [${n.sentiment.toUpperCase()}] ${n.headline} (${n.sourceName}, ${n.publishedAt.slice(0, 10)})`
            )
            .join('\n')
        : '  - ไม่มีข่าวเฉพาะตัวล่าสุดในฐานข้อมูล'

    const posText = snap.position
      ? `- ถือครองอยู่: ${snap.position.shares} หน่วย, ต้นทุนเฉลี่ย ${currSym}${snap.position.avgCost.toFixed(2)}, มูลค่าปัจจุบัน ${currSym}${snap.position.currentValue.toFixed(2)}, กำไร/ขาดทุน ${snap.position.unrealizedGainPercent >= 0 ? '+' : ''}${snap.position.unrealizedGainPercent.toFixed(2)}% (${currSym}${snap.position.unrealizedGain.toFixed(2)}), น้ำหนักในพอร์ต ${snap.position.portfolioWeightPct ?? 'N/A'}% (เพดาน ${snap.position.maxSinglePositionPct}%), ตะกร้ากลยุทธ์: ${snap.position.bucketName || 'ไม่ระบุ'} (TP ${snap.position.takeProfitPct ?? '-'}% / SL ${snap.position.stopLossPct ?? '-'}%)`
      : '- ยังไม่ได้ถือครองหุ้นตัวนี้ในพอร์ต (ประเมินจากมุมมองการเข้าซื้อใหม่)'

    const prompt = `${todayTag}
ราคาที่ใช้ประกอบรายงานมาจาก Yahoo Finance เวลา ${observedAt} เป็นการสังเกตล่าสุดที่ระบบยืนยันได้
คุณคือ Senior Quantitative Risk Officer & Multi-Asset Portfolio Strategist ที่ให้คำแนะนำรายวันเฉพาะบุคคล
กรุณาสังเคราะห์ข้อมูลจริงทั้งหมดด้านล่าง (ข้อมูลเก่า + ข้อมูลสดวันนี้ + ข้อมูลคาดการณ์ + พอร์ตจริงของผู้ใช้ + คะแนนความเสี่ยงเชิงปริมาณ) เพื่อออกรายงาน "วิเคราะห์ความเสี่ยง & แผนปฏิบัติการรายวัน" สำหรับ ${response.symbol} (${response.name})

1) โปรไฟล์นักลงทุน:
- ${userMemorySummary}

2) สถานะพอร์ตจริงของนักลงทุนในหุ้น ${response.symbol}:
${posText}

3) ข้อมูลเก่า (Historical Performance):
- ผลตอบแทนย้อนหลัง: 1M=${snap.historicalReturns.return1M ?? 'N/A'}%, 3M=${snap.historicalReturns.return3M ?? 'N/A'}%, 6M=${snap.historicalReturns.return6M ?? 'N/A'}%, 1Y=${snap.historicalReturns.return1Y ?? 'N/A'}%, 3Y=${snap.historicalReturns.return3Y ?? 'N/A'}%
- กรอบ 52 สัปดาห์: Low ${snap.fiftyTwoWeekLow ?? 'N/A'} - High ${snap.fiftyTwoWeekHigh ?? 'N/A'} (ย่อจากจุดสูงสุด ${snap.pullbackFrom52wHigh ?? 'N/A'}%)
- ความผันผวนย้อนหลัง 30 วัน: ${snap.technical.vol30dPct ?? 'N/A'}%/ปี

4) ข้อมูลสดวันนี้ (Live Market & Technicals & Macro):
- ราคาปัจจุบัน: ${currSym}${snap.currentPrice} (วันนี้ ${snap.todayChangePercent >= 0 ? '+' : ''}${snap.todayChangePercent}%)
- แนวรับ-แนวต้านจริง (Pivot 1M): S2=${q.priceZones.support2 ?? 'N/A'}, S1=${q.priceZones.support1 ?? 'N/A'}, Pivot=${q.priceZones.pivot ?? 'N/A'}, R1=${q.priceZones.resistance1 ?? 'N/A'}, R2=${q.priceZones.resistance2 ?? 'N/A'}, EMA200=${q.priceZones.ema200 ?? 'N/A'} (${snap.technical.trendVsEma200 ?? 'N/A'}), RSI(14)=${snap.technical.rsi ?? 'N/A'}
- มหภาคตลาดวันนี้: VIX=${snap.macro.vixPrice ?? 'N/A'} (${snap.macro.vixChangePct ?? 'N/A'}%), S&P 500 วันนี้ ${snap.macro.sp500ChangePct ?? 'N/A'}%, CNN Fear & Greed=${snap.macro.fearGreedScore ?? 'N/A'} (${snap.macro.fearGreedLabel ?? 'N/A'})
- ข่าวล่าสุดที่ดึงได้:
${newsText}

5) ข้อมูลคาดการณ์ (Forward Outlook):
- Wall St Consensus: ${snap.forward.recommendation ?? 'N/A'}, Target Low=${snap.forward.targetLow ?? 'N/A'}, Mean=${snap.forward.targetMean ?? 'N/A'}, High=${snap.forward.targetHigh ?? 'N/A'} (Upside ${snap.forward.upsidePercent ?? 'N/A'}%)
- Valuation & Balance Sheet: Trailing P/E=${snap.forward.trailingPe ?? 'N/A'}x, Forward P/E=${snap.forward.forwardPe ?? 'N/A'}x, Revenue Growth=${snap.forward.revenueGrowth ?? 'N/A'}%, D/E=${snap.forward.debtToEquity ?? 'N/A'}x, FCF=${freeCashflow ?? 'N/A'}, Dividend Yield=${snap.forward.dividendYield ?? 'N/A'}%, Payout=${snap.forward.payoutRatio ?? 'N/A'}%
- งบการเงิน (Earnings): ${snap.forward.earningsLabel ?? 'ไม่มีข้อมูลกำหนดการ'} (${snap.forward.earningsDateThai ?? '-'})
- ปันผลรอบถัดไป (Est. Next XD): ${snap.forward.nextXdDate ?? 'ไม่มีปันผล'} (อีก ${snap.forward.nextXdDays ?? '-'} วัน, คาดการณ์ ${snap.forward.nextXdAmount ?? '-'})

6) คะแนนความเสี่ยงที่ระบบคำนวณไว้แล้ว (Quant Risk Scorecard):
- คะแนนความเสี่ยงรวม: ${q.overallScore}/100 (${q.overallLabelTh}) • สัญญาณตั้งต้น: ${q.defaultVerdict}
${q.dimensions.map((d) => `- ${d.label}: ${d.score}/100 (${d.levelLabelTh}) -> ${d.drivers.join('; ')}`).join('\n')}

กฎเหล็ก:
- ห้ามแต่งตัวเลขราคา แนวรับ แนวต้าน เปอร์เซ็นต์ หรือข่าวที่ไม่ปรากฏในข้อมูลข้างต้น
- เขียนคำอธิบายเป็นภาษาไทยที่กระชับ ชัดเจน นำไปตัดสินใจปฏิบัติได้จริงในวันนี้ (อนุญาตให้ใช้รหัส Ticker และศัพท์เทคนิคสากล เช่น RSI, EMA200, S1, R1, P/E, FCF, XD)
- ตอบเป็น JSON Object ตาม Schema นี้เท่านั้น:
{
  "verdict": "ACCUMULATE | WAIT_AT_SUPPORT | HOLD | TRIM_PROFIT | CAUTION",
  "verdictLabelTh": "ป้ายสรุปภาษาไทยสั้นๆ",
  "confidence": "HIGH | MEDIUM | LOW",
  "executiveSummary": "สรุปคำแนะนำรายวัน 2-3 ประโยค เชื่อมโยงราคาวันนี้ ต้นทุนพอร์ต และความเสี่ยงหลัก",
  "historicalContext": "สรุปบริบทจากข้อมูลเก่า (1M-1Y, ระยะย่อจาก High 52w, ความผันผวน) เป็นภาษาไทย 2 ประโยค",
  "liveMarketContext": "สรุปบริบทสดวันนี้ (สัญญาณเทคนิคอล, ข่าว, ภาวะตลาด VIX/Fear&Greed) เป็นภาษาไทย 2 ประโยค",
  "forwardOutlook": "สรุปมุมมองคาดการณ์ (Wall St Target, Forward P/E, งบ, รอบ XD ถัดไป) เป็นภาษาไทย 2 ประโยค",
  "riskAnalysis": {
    "technical": "เหตุผลความเสี่ยงด้านเทคนิคอลและความผันผวนวันนี้",
    "fundamental": "เหตุผลความเสี่ยงด้านมูลค่า งบ และฐานะการเงิน",
    "portfolio": "เหตุผลความเสี่ยงต่อพอร์ตและต้นทุนจริงของคุณ",
    "sentiment": "เหตุผลความเสี่ยงจากข่าวและบรรยากาศตลาดรวม"
  },
  "scenarios": {
    "bull": "กรณีดี (Bull Case): เงื่อนไขกลับตัวและเป้าแนวต้านอ้างอิงจาก R1/R2/Target",
    "base": "กรณีฐาน (Base Case): กรอบแกว่งตัวและความคาดหวังระยะ 1-3 เดือน",
    "bear": "กรณีเสี่ยง (Bear Case): ปัจจัยกดดันและโซนแนวรับสำคัญ S1/S2 ที่ต้องระวัง"
  },
  "actionPlan": {
    "entryPlan": "แผนการเข้าซื้อหรือถัวเฉลี่ยวันนี้ (ระบุเงื่อนไขราคาอิง S1/S2/EMA200 จริง)",
    "exitOrTrimPlan": "แผนแบ่งขายทำกำไรหรือจุดกลับตัวคุ้มทุนเทียบต้นทุนเฉลี่ย",
    "riskControlPlan": "การคุมขนาดพอร์ต (Position Sizing) และการจัดการความเสี่ยง"
  },
  "dailyChecklist": [
    "เช็กลิสต์ข้อ 1 สำหรับตัดสินใจวันนี้",
    "เช็กลิสต์ข้อ 2 สำหรับตัดสินใจวันนี้",
    "เช็กลิสต์ข้อ 3 สำหรับตัดสินใจวันนี้"
  ]
}`

    const systemInstruction =
      'คุณคือ Senior Quantitative Risk Officer & Portfolio Strategist ที่ปรึกษาการลงทุนระดับสถาบัน ใช้เฉพาะข้อเท็จจริงและตัวเลขจากข้อมูลที่ได้รับเท่านั้น ห้ามแต่งตัวเลขหรือข่าวเอง ตอบกลับเป็น JSON ภาษาไทย 100%'

    const aiRes = await callGemini({
      userId: session.user.id,
      prompt,
      systemInstruction,
      logType: 'daily_brief',
      responseMimeType: 'application/json',
      validateJson: (value) => parseDailyStockAiReport(JSON.stringify(value)) !== null,
      thinkingBudget: 1024,
      skipLog: true,
    })

    const parsedReport = parseDailyStockAiReport(aiRes.text)
    if (!parsedReport) {
      return NextResponse.json(
        { error: 'AI ส่งผลลัพธ์ไม่ตรงรูปแบบที่กำหนด กรุณากดวิเคราะห์ใหม่อีกครั้ง' },
        { status: 502 }
      )
    }

    const savedLog = await prisma.aiAdviceLog.create({
      data: {
        userId: session.user.id,
        logType: 'advisor',
        prompt,
        response: JSON.stringify(parsedReport),
        modelUsed: aiRes.modelUsed,
      },
      select: { createdAt: true },
    })

    return NextResponse.json({
      ...response,
      aiReport: parsedReport,
      modelUsed: aiRes.modelUsed,
      updatedAt: savedLog.createdAt.toISOString(),
      isTodayReport: true,
      cached: false,
    })
  } catch (error: any) {
    console.error('[daily-risk-advisor POST]', error)
    return NextResponse.json(
      { error: error.message || 'ไม่สามารถสร้างคำแนะนำความเสี่ยงรายวันด้วย AI ได้' },
      { status: 500 }
    )
  }
}
