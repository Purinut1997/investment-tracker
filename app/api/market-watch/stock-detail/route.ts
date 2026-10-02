import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getYahooQuoteSummary } from '@/lib/market-data/yahoo-crumb'
import { parseHistoricalStats, HistoricalStockStats } from '@/lib/market-data/historical-stats'

export interface ChartPoint {
  time: string
  price: number
  open: number
  high: number
  low: number
  close: number
  volume: number
  timestamp: number
  sma20?: number | null
  sma50?: number | null
}

export interface TechnicalLevels {
  pivot: number
  r1: number
  r2: number
  s1: number
  s2: number
  periodHigh: number
  periodLow: number
  currentPrice: number
}

interface CachedChartResult {
  chartPoints: ChartPoint[]
  technicalLevels: TechnicalLevels | null
  currentPrice: number
  previousClose: number
  todayChange: number
  todayChangePercent: number
  rangeChange: number
  rangeChangePercent: number
  dayHigh: number | null
  dayLow: number | null
  volume: number | null
  currency: string
  name: string
  metaFiftyTwoHigh: number | null
  metaFiftyTwoLow: number | null
  rawChartResult: any
}

interface CachedFundamentalsResult {
  pe: number | null
  forwardPe: number | null
  pb: number | null
  evEbitda: number | null
  dividendYield: number | null
  payoutRatio: number | null
  revenue: number | null
  revenueGrowth: number | null
  eps: number | null
  freeCashflow: number | null
  marketCap: number | null
  analystTarget: any
  fiftyTwoWeekHigh: number | null
  fiftyTwoWeekLow: number | null
  rawHistoryChartResult: any
}

// 1. Chart cache (3 minutes) to avoid repeated Yahoo queries on timeframe switches
const chartCache = new Map<string, { data: CachedChartResult; timestamp: number }>()
const inFlightCharts = new Map<string, Promise<CachedChartResult | null>>()
const CHART_CACHE_TTL_MS = 3 * 60 * 1000 // 3 minutes

// 2. Fundamentals cache (20 minutes) - PE, PB, Revenue, 5Y dividends do not change on every click
const fundamentalsCache = new Map<string, { data: CachedFundamentalsResult; timestamp: number }>()
const inFlightFundamentals = new Map<string, Promise<CachedFundamentalsResult | null>>()
const FUNDAMENTALS_CACHE_TTL_MS = 20 * 60 * 1000 // 20 minutes

function formatTicker(rawSymbol: string, market: string): string {
  if (rawSymbol === 'GOLD' || rawSymbol === 'XAU') return 'GC=F'
  if (rawSymbol === 'BTC') return 'BTC-USD'
  if (rawSymbol === 'ETH') return 'ETH-USD'
  if (rawSymbol === 'SOL') return 'SOL-USD'
  if (market === 'TH' && !rawSymbol.endsWith('.BK')) return `${rawSymbol}.BK`
  return rawSymbol
}

async function fetchChartData(
  rawSymbol: string,
  market: string,
  range: string
): Promise<CachedChartResult | null> {
  const cacheKey = `${rawSymbol}_${market}_${range}`
  const now = Date.now()

  const cached = chartCache.get(cacheKey)
  if (cached && now - cached.timestamp < CHART_CACHE_TTL_MS) {
    return cached.data
  }

  const pending = inFlightCharts.get(cacheKey)
  if (pending) return pending

  const fetchPromise = (async () => {
    let yfInterval = '1d'
    let fetchRange = '3mo'

    switch (range) {
      case '1d':
        fetchRange = '5d' // 5-day buffer for full 20/50-bar moving averages
        yfInterval = '5m'
        break
      case '1w':
      case '5d':
        fetchRange = '1mo'
        yfInterval = '15m'
        break
      case '1m':
      case '1mo':
        fetchRange = '3mo'
        yfInterval = '1d'
        break
      case '1y':
        fetchRange = '2y'
        yfInterval = '1wk'
        break
      default:
        fetchRange = '3mo'
        yfInterval = '1d'
    }

    const yfTicker = formatTicker(rawSymbol, market)
    const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      yfTicker
    )}?range=${fetchRange}&interval=${yfInterval}`

    try {
      const res = await fetch(chartUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(4000),
        next: { revalidate: 180 },
      })

      if (!res.ok) return null
      const yahooData = await res.json()
      const result = yahooData?.chart?.result?.[0]
      if (!result) return null

      const meta = result.meta || {}
      const timestamps: number[] = result.timestamp || []
      const quote = result.indicators?.quote?.[0] || {}
      const opens: (number | null)[] = quote.open || []
      const highs: (number | null)[] = quote.high || []
      const lows: (number | null)[] = quote.low || []
      const closes: (number | null)[] = quote.close || []
      const volumes: (number | null)[] = quote.volume || []

      // Build clean chart points from all buffered bars
      const allPoints: ChartPoint[] = []

      for (let i = 0; i < timestamps.length; i++) {
        const c = closes[i]
        if (c !== null && c !== undefined && !isNaN(c) && c > 0) {
          const o = opens[i] ?? c
          const h = highs[i] ?? Math.max(o, c)
          const l = lows[i] ?? Math.min(o, c)
          const v = volumes[i] ?? 0

          const dateObj = new Date(timestamps[i] * 1000)
          let timeLabel = ''
          if (range === '1d') {
            timeLabel = dateObj.toLocaleTimeString('th-TH', {
              hour: '2-digit',
              minute: '2-digit',
            })
          } else if (range === '1w') {
            timeLabel = `${dateObj.getDate()}/${dateObj.getMonth() + 1} ${dateObj.toLocaleTimeString('th-TH', {
              hour: '2-digit',
              minute: '2-digit',
            })}`
          } else {
            timeLabel = `${dateObj.getDate()}/${dateObj.getMonth() + 1}/${String(
              dateObj.getFullYear()
            ).slice(-2)}`
          }

          allPoints.push({
            time: timeLabel,
            price: Number(c.toFixed(2)),
            open: Number(o.toFixed(2)),
            high: Number(h.toFixed(2)),
            low: Number(l.toFixed(2)),
            close: Number(c.toFixed(2)),
            volume: Number(v),
            timestamp: timestamps[i],
          })
        }
      }

      // Calculate Moving Averages (SMA 20, SMA 50) on the FULL buffered dataset
      for (let i = 0; i < allPoints.length; i++) {
        if (i >= 19) {
          const slice20 = allPoints.slice(i - 19, i + 1)
          const sum20 = slice20.reduce((acc, p) => acc + p.close, 0)
          allPoints[i].sma20 = Number((sum20 / 20).toFixed(2))
        } else {
          const slice = allPoints.slice(0, i + 1)
          const sum = slice.reduce((acc, p) => acc + p.close, 0)
          allPoints[i].sma20 = Number((sum / slice.length).toFixed(2))
        }

        if (i >= 49) {
          const slice50 = allPoints.slice(i - 49, i + 1)
          const sum50 = slice50.reduce((acc, p) => acc + p.close, 0)
          allPoints[i].sma50 = Number((sum50 / 50).toFixed(2))
        } else {
          const slice = allPoints.slice(0, i + 1)
          const sum = slice.reduce((acc, p) => acc + p.close, 0)
          allPoints[i].sma50 = Number((sum / slice.length).toFixed(2))
        }
      }

      // Slice down to requested timeframe for display
      let chartPoints: ChartPoint[] = allPoints
      if (allPoints.length > 0) {
        const latestTs = allPoints[allPoints.length - 1].timestamp
        const latestDate = new Date(latestTs * 1000)

        if (range === '1d') {
          const latestDayStr = latestDate.toDateString()
          const dayPoints = allPoints.filter(
            (p) => new Date(p.timestamp * 1000).toDateString() === latestDayStr
          )
          chartPoints = dayPoints.length >= 5 ? dayPoints : allPoints.slice(-78)
        } else if (range === '1w') {
          const oneWeekAgo = latestTs - 7 * 86400
          const weekPoints = allPoints.filter((p) => p.timestamp >= oneWeekAgo)
          chartPoints = weekPoints.length >= 5 ? weekPoints : allPoints.slice(-35)
        } else if (range === '1m') {
          const oneMonthAgo = latestTs - 32 * 86400
          const monthPoints = allPoints.filter((p) => p.timestamp >= oneMonthAgo)
          chartPoints = monthPoints.length >= 10 ? monthPoints : allPoints.slice(-25)
        } else if (range === '1y') {
          const oneYearAgo = latestTs - 366 * 86400
          const yearPoints = allPoints.filter((p) => p.timestamp >= oneYearAgo)
          chartPoints = yearPoints.length >= 20 ? yearPoints : allPoints.slice(-52)
        }
      }

      // Price calculation: CRITICAL FIX FOR DAILY CHANGE
      const currentPrice = Number(
        meta.regularMarketPrice ?? chartPoints[chartPoints.length - 1]?.price ?? 0
      )

      // Always use the official previous day close (meta.previousClose)
      // DO NOT use meta.chartPreviousClose because for range=5d it is 5 days ago!
      const officialPrevClose = Number(
        meta.previousClose ??
          meta.regularMarketPreviousClose ??
          meta.chartPreviousClose ??
          chartPoints[0]?.price ??
          currentPrice
      )

      const todayChange = Number(
        meta.regularMarketChange !== undefined && meta.regularMarketChange !== null
          ? meta.regularMarketChange
          : currentPrice - officialPrevClose
      )
      const todayChangePercent = Number(
        meta.regularMarketChangePercent !== undefined && meta.regularMarketChangePercent !== null
          ? meta.regularMarketChangePercent
          : officialPrevClose > 0
          ? (todayChange / officialPrevClose) * 100
          : 0
      )

      // Timeframe change (rangeChange): compares current price with the first bar of the selected timeframe
      let rangeChange = todayChange
      let rangeChangePercent = todayChangePercent
      if (range !== '1d' && chartPoints.length > 0) {
        const rangeStart = chartPoints[0].price
        rangeChange = currentPrice - rangeStart
        rangeChangePercent = rangeStart > 0 ? (rangeChange / rangeStart) * 100 : 0
      }

      // Support & Resistance (Pivot Points)
      let technicalLevels: TechnicalLevels | null = null
      if (chartPoints.length > 0) {
        const allHighs = chartPoints.map((p) => p.high)
        const allLows = chartPoints.map((p) => p.low)
        const periodHigh = Math.max(...allHighs)
        const periodLow = Math.min(...allLows)
        const periodClose = chartPoints[chartPoints.length - 1].close

        const pivot = (periodHigh + periodLow + periodClose) / 3
        const r1 = 2 * pivot - periodLow
        const s1 = 2 * pivot - periodHigh
        const r2 = pivot + (periodHigh - periodLow)
        const s2 = pivot - (periodHigh - periodLow)

        technicalLevels = {
          pivot: Number(pivot.toFixed(2)),
          r1: Number(r1.toFixed(2)),
          r2: Number(r2.toFixed(2)),
          s1: Number(s1.toFixed(2)),
          s2: Number(s2.toFixed(2)),
          periodHigh: Number(periodHigh.toFixed(2)),
          periodLow: Number(periodLow.toFixed(2)),
          currentPrice: Number(currentPrice.toFixed(2)),
        }
      }

      const chartResult: CachedChartResult = {
        chartPoints,
        technicalLevels,
        currentPrice,
        previousClose: officialPrevClose,
        todayChange: Number(todayChange.toFixed(2)),
        todayChangePercent: Number(todayChangePercent.toFixed(2)),
        rangeChange: Number(rangeChange.toFixed(2)),
        rangeChangePercent: Number(rangeChangePercent.toFixed(2)),
        dayHigh: meta.regularMarketDayHigh ?? null,
        dayLow: meta.regularMarketDayLow ?? null,
        volume: meta.regularMarketVolume ?? null,
        currency: meta.currency || (market === 'TH' ? 'THB' : 'USD'),
        name: meta.longName || meta.shortName || rawSymbol,
        metaFiftyTwoHigh: meta.fiftyTwoWeekHigh ? Number(meta.fiftyTwoWeekHigh) : null,
        metaFiftyTwoLow: meta.fiftyTwoWeekLow ? Number(meta.fiftyTwoWeekLow) : null,
        rawChartResult: result,
      }

      chartCache.set(cacheKey, { data: chartResult, timestamp: Date.now() })
      return chartResult
    } catch (err) {
      console.error(`[fetchChartData error] ${rawSymbol}:`, err)
      return null
    } finally {
      inFlightCharts.delete(cacheKey)
    }
  })()

  inFlightCharts.set(cacheKey, fetchPromise)
  return fetchPromise
}

async function fetchFundamentalsData(
  rawSymbol: string,
  market: string
): Promise<CachedFundamentalsResult> {
  const cacheKey = `${rawSymbol}_${market}`
  const now = Date.now()

  const cached = fundamentalsCache.get(cacheKey)
  if (cached && now - cached.timestamp < FUNDAMENTALS_CACHE_TTL_MS) {
    return cached.data
  }

  const pending = inFlightFundamentals.get(cacheKey)
  if (pending) return (await pending) || ({} as CachedFundamentalsResult)

  const fetchPromise = (async () => {
    const yfTicker = formatTicker(rawSymbol, market)
    const finnhubKey = process.env.FINNHUB_API_KEY
    const shouldFetchFinnhub =
      Boolean(finnhubKey) && market === 'US' && !rawSymbol.includes('-') && !rawSymbol.includes('=')

    // 1. Fetch 5Y monthly data for dividend history (cached for 20 mins)
    const historyUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      yfTicker
    )}?range=5y&interval=1mo&events=div|split`

    const yahooHistoryPromise = fetch(historyUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(4000),
      next: { revalidate: 600 },
    })
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null)

    // 2. Fetch Finnhub metrics & targets
    const finnhubMetricPromise = shouldFetchFinnhub
      ? fetch(
          `https://finnhub.io/api/v1/stock/metric?symbol=${encodeURIComponent(
            rawSymbol
          )}&metric=all&token=${finnhubKey}`,
          { signal: AbortSignal.timeout(3000), next: { revalidate: 3600 } }
        )
          .then((res) => (res.ok ? res.json() : null))
          .catch(() => null)
      : Promise.resolve(null)

    const finnhubTargetPromise = shouldFetchFinnhub
      ? fetch(
          `https://finnhub.io/api/v1/stock/price-target?symbol=${encodeURIComponent(
            rawSymbol
          )}&token=${finnhubKey}`,
          { signal: AbortSignal.timeout(3000), next: { revalidate: 3600 } }
        )
          .then((res) => (res.ok ? res.json() : null))
          .catch(() => null)
      : Promise.resolve(null)

    const finnhubRecomPromise = shouldFetchFinnhub
      ? fetch(
          `https://finnhub.io/api/v1/stock/recommendation?symbol=${encodeURIComponent(
            rawSymbol
          )}&token=${finnhubKey}`,
          { signal: AbortSignal.timeout(3000), next: { revalidate: 3600 } }
        )
          .then((res) => (res.ok ? res.json() : null))
          .catch(() => null)
      : Promise.resolve(null)

    // 3. Fetch Yahoo Quote Summary (single call, internal 30-min cache)
    const ySummaryPromise = getYahooQuoteSummary(yfTicker)

    const [yahooHistoryData, finnhubMetric, finnhubTarget, finnhubRecom, ySummary] =
      await Promise.all([
        yahooHistoryPromise,
        finnhubMetricPromise,
        finnhubTargetPromise,
        finnhubRecomPromise,
        ySummaryPromise,
      ])

    const fiftyTwoWeekHigh = Number(
      finnhubMetric?.metric?.['52WeekHigh'] ?? 0
    )
    const fiftyTwoWeekLow = Number(
      finnhubMetric?.metric?.['52WeekLow'] ?? 0
    )

    let pe: number | null = finnhubMetric?.metric?.peBasicExclExtraItemsTTM ?? ySummary?.pe ?? null
    let dividendYield: number | null =
      finnhubMetric?.metric?.dividendYieldIndicatedAnnual ?? ySummary?.dividendYield ?? null
    let marketCap: number | null =
      finnhubMetric?.metric?.marketCapitalization ?? ySummary?.marketCap ?? null

    let analystTarget: any = null
    if (finnhubTarget && finnhubTarget.targetMean) {
      const mean = Number(finnhubTarget.targetMean)
      const latestRecom =
        Array.isArray(finnhubRecom) && finnhubRecom.length > 0 ? finnhubRecom[0] : null

      let recomLabel = 'HOLD'
      if (latestRecom) {
        const buyScore = (latestRecom.strongBuy || 0) * 2 + (latestRecom.buy || 0)
        const sellScore = (latestRecom.strongSell || 0) * 2 + (latestRecom.sell || 0)
        if (buyScore > sellScore * 1.5) recomLabel = 'STRONG BUY'
        else if (buyScore > sellScore) recomLabel = 'BUY'
        else if (sellScore > buyScore) recomLabel = 'UNDERPERFORM'
      }

      analystTarget = {
        targetHigh: finnhubTarget.targetHigh ? Number(finnhubTarget.targetHigh) : null,
        targetLow: finnhubTarget.targetLow ? Number(finnhubTarget.targetLow) : null,
        targetMean: mean,
        recommendation: recomLabel,
      }
    }

    const result: CachedFundamentalsResult = {
      pe: pe ? Number(pe.toFixed(2)) : null,
      forwardPe: ySummary?.forwardPe ? Number(ySummary.forwardPe.toFixed(2)) : null,
      pb: ySummary?.pb ? Number(ySummary.pb.toFixed(2)) : null,
      evEbitda: ySummary?.evEbitda ? Number(ySummary.evEbitda.toFixed(2)) : null,
      dividendYield: dividendYield !== null ? Number(dividendYield.toFixed(2)) : null,
      payoutRatio:
        ySummary?.payoutRatio !== null && ySummary?.payoutRatio !== undefined
          ? Number(ySummary.payoutRatio.toFixed(2))
          : null,
      revenue: ySummary?.revenue ?? null,
      revenueGrowth:
        ySummary?.revenueGrowth !== null && ySummary?.revenueGrowth !== undefined
          ? Number(ySummary.revenueGrowth.toFixed(2))
          : null,
      eps:
        ySummary?.eps !== null && ySummary?.eps !== undefined
          ? Number(ySummary.eps.toFixed(2))
          : null,
      freeCashflow: ySummary?.freeCashflow ?? null,
      marketCap: marketCap ? Number(marketCap) : null,
      analystTarget,
      fiftyTwoWeekHigh: fiftyTwoWeekHigh || null,
      fiftyTwoWeekLow: fiftyTwoWeekLow || null,
      rawHistoryChartResult: yahooHistoryData?.chart?.result?.[0] || null,
    }

    fundamentalsCache.set(cacheKey, { data: result, timestamp: Date.now() })
    return result
  })()

  inFlightFundamentals.set(cacheKey, fetchPromise)
  return fetchPromise
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const rawSymbol = searchParams.get('symbol')?.trim()?.toUpperCase()
  const market = searchParams.get('market')?.trim()?.toUpperCase() || 'US'
  const range = searchParams.get('range')?.trim()?.toLowerCase() || '1m'

  if (!rawSymbol) {
    return NextResponse.json({ error: 'Missing symbol' }, { status: 400 })
  }

  try {
    // 1. Fetch Chart, Fundamentals, and User Position in parallel
    // Fundamentals & Chart are both cached in-memory with long TTLs to prevent API blocking
    const [chartData, fundamentals, userTxns] = await Promise.all([
      fetchChartData(rawSymbol, market, range),
      fetchFundamentalsData(rawSymbol, market),
      prisma.transaction.findMany({
        where: {
          userId: session.user.id,
          asset: {
            ticker: rawSymbol,
          },
        },
        orderBy: { txnDate: 'asc' },
      }),
    ])

    if (!chartData) {
      return NextResponse.json(
        { error: `ไม่สามารถดึงข้อมูลกราฟของ ${rawSymbol} ได้ในขณะนี้` },
        { status: 502 }
      )
    }

    const currentPrice = chartData.currentPrice

    // User Position Summary (Using FIFO)
    let userPosition: {
      shares: number
      avgCost: number
      totalCost: number
      currentValue: number
      unrealizedGain: number
      unrealizedGainPercent: number
    } | null = null

    if (userTxns.length > 0) {
      const lots: { qty: number; price: number }[] = []

      for (const t of userTxns) {
        const qty = Number(t.quantity || 0)
        const price = Number(t.pricePerUnit || 0)
        if (t.txnType === 'BUY') {
          lots.push({ qty, price })
        } else if (t.txnType === 'SELL') {
          let rem = qty
          while (rem > 0.000001 && lots.length > 0) {
            if (lots[0].qty <= rem) {
              rem -= lots[0].qty
              lots.shift()
            } else {
              lots[0].qty -= rem
              rem = 0
            }
          }
        }
      }

      const totalShares = lots.reduce((acc, l) => acc + l.qty, 0)
      const totalCostBasis = lots.reduce((acc, l) => acc + l.qty * l.price, 0)

      if (totalShares > 0.00001) {
        const avg = totalCostBasis / totalShares
        const curVal = totalShares * currentPrice
        const gain = curVal - totalCostBasis
        const gainPct = totalCostBasis > 0 ? (gain / totalCostBasis) * 100 : 0

        userPosition = {
          shares: Number(totalShares.toFixed(4)),
          avgCost: Number(avg.toFixed(2)),
          totalCost: Number(totalCostBasis.toFixed(2)),
          currentValue: Number(curVal.toFixed(2)),
          unrealizedGain: Number(gain.toFixed(2)),
          unrealizedGainPercent: Number(gainPct.toFixed(2)),
        }
      }
    }

    // Historical Dividends, Splits & Return Performance Matrix
    const historicalStats = parseHistoricalStats(
      fundamentals.rawHistoryChartResult || chartData.rawChartResult,
      currentPrice,
      userTxns,
      userPosition,
      fundamentals.payoutRatio
    )

    // Compute analyst upside with actual currentPrice
    let analystTarget = fundamentals.analystTarget
    if (analystTarget && analystTarget.targetMean && currentPrice > 0) {
      const upside = ((analystTarget.targetMean - currentPrice) / currentPrice) * 100
      analystTarget = {
        ...analystTarget,
        upsidePercent: Number(upside.toFixed(2)),
      }
    }

    const fiftyTwoWeekHigh =
      fundamentals.fiftyTwoWeekHigh || chartData.metaFiftyTwoHigh || null
    const fiftyTwoWeekLow =
      fundamentals.fiftyTwoWeekLow || chartData.metaFiftyTwoLow || null

    const dividendYield =
      fundamentals.dividendYield !== null
        ? fundamentals.dividendYield
        : (historicalStats?.dividends?.ttmYield ?? null)

    const payload = {
      symbol: rawSymbol,
      name: chartData.name,
      currency: chartData.currency,
      market,
      currentPrice,
      previousClose: chartData.previousClose,
      change: range === '1d' ? chartData.todayChange : chartData.rangeChange,
      changePercent: range === '1d' ? chartData.todayChangePercent : chartData.rangeChangePercent,
      todayChange: chartData.todayChange,
      todayChangePercent: chartData.todayChangePercent,
      rangeChange: chartData.rangeChange,
      rangeChangePercent: chartData.rangeChangePercent,
      dayHigh: chartData.dayHigh,
      dayLow: chartData.dayLow,
      volume: chartData.volume,
      fiftyTwoWeekHigh,
      fiftyTwoWeekLow,
      pe: fundamentals.pe,
      forwardPe: fundamentals.forwardPe,
      pb: fundamentals.pb,
      evEbitda: fundamentals.evEbitda,
      dividendYield,
      payoutRatio: fundamentals.payoutRatio,
      revenue: fundamentals.revenue,
      revenueGrowth: fundamentals.revenueGrowth,
      eps: fundamentals.eps,
      freeCashflow: fundamentals.freeCashflow,
      marketCap: fundamentals.marketCap,
      analystTarget,
      userPosition,
      chartPoints: chartData.chartPoints,
      technicalLevels: chartData.technicalLevels,
      range,
      historicalStats,
    }

    return NextResponse.json(payload)
  } catch (error) {
    console.error('[stock-detail GET error]', error)
    return NextResponse.json({ error: 'Failed to fetch stock detail' }, { status: 500 })
  }
}
