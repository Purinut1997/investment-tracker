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

const stockDetailMemoryCache = new Map<string, { data: any; timestamp: number }>()
const STOCK_DETAIL_CACHE_TTL_MS = 60 * 1000 // 60 seconds in-memory cache

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

  const cacheKey = `${session.user.id}_${rawSymbol}_${market}_${range}`
  const now = Date.now()
  const cached = stockDetailMemoryCache.get(cacheKey)
  if (cached && now - cached.timestamp < STOCK_DETAIL_CACHE_TTL_MS) {
    return NextResponse.json(cached.data)
  }

  // Map timeframe to Yahoo parameters with warm-up buffer for full-span moving averages
  let yfRange = '1mo'
  let yfInterval = '1d'
  let fetchRange = '3mo'

  switch (range) {
    case '1d':
      yfRange = '1d'
      fetchRange = '5d'
      yfInterval = '5m'
      break
    case '1w':
    case '5d':
      yfRange = '5d'
      fetchRange = '1mo'
      yfInterval = '15m'
      break
    case '1m':
    case '1mo':
      yfRange = '1mo'
      fetchRange = '3mo'
      yfInterval = '1d'
      break
    case '1y':
      yfRange = '1y'
      fetchRange = '2y'
      yfInterval = '1wk'
      break
    default:
      yfRange = '1mo'
      fetchRange = '3mo'
      yfInterval = '1d'
  }

  // Format Yahoo Ticker
  let yfTicker = rawSymbol
  if (rawSymbol === 'GOLD' || rawSymbol === 'XAU') {
    yfTicker = 'GC=F'
  } else if (rawSymbol === 'BTC') {
    yfTicker = 'BTC-USD'
  } else if (rawSymbol === 'ETH') {
    yfTicker = 'ETH-USD'
  } else if (rawSymbol === 'SOL') {
    yfTicker = 'SOL-USD'
  } else if (market === 'TH' && !rawSymbol.endsWith('.BK')) {
    yfTicker = `${rawSymbol}.BK`
  }

  try {
    // 1. Fetch Yahoo Chart Data (with warm-up buffer for full-span SMA lines)
    const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      yfTicker
    )}?range=${fetchRange}&interval=${yfInterval}`

    const yahooPromise = fetch(chartUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(3500),
      next: { revalidate: 60 },
    })
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null)

    // 1.1 Fetch 5Y monthly data for dividend history and performance matrix
    const historyUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      yfTicker
    )}?range=5y&interval=1mo&events=div|split`

    const yahooHistoryPromise = fetch(historyUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(3500),
      next: { revalidate: 300 },
    })
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null)

    // 2. Fetch Finnhub data if available
    const finnhubKey = process.env.FINNHUB_API_KEY
    const shouldFetchFinnhub =
      Boolean(finnhubKey) &&
      market === 'US' &&
      !rawSymbol.includes('-') &&
      !rawSymbol.includes('=')

    const finnhubMetricPromise = shouldFetchFinnhub
      ? fetch(
          `https://finnhub.io/api/v1/stock/metric?symbol=${encodeURIComponent(
            rawSymbol
          )}&metric=all&token=${finnhubKey}`,
          {
            signal: AbortSignal.timeout(3000),
            next: { revalidate: 3600 },
          }
        )
          .then((res) => (res.ok ? res.json() : null))
          .catch(() => null)
      : Promise.resolve(null)

    const finnhubTargetPromise = shouldFetchFinnhub
      ? fetch(
          `https://finnhub.io/api/v1/stock/price-target?symbol=${encodeURIComponent(
            rawSymbol
          )}&token=${finnhubKey}`,
          {
            signal: AbortSignal.timeout(3000),
            next: { revalidate: 3600 },
          }
        )
          .then((res) => (res.ok ? res.json() : null))
          .catch(() => null)
      : Promise.resolve(null)

    const finnhubRecomPromise = shouldFetchFinnhub
      ? fetch(
          `https://finnhub.io/api/v1/stock/recommendation?symbol=${encodeURIComponent(
            rawSymbol
          )}&token=${finnhubKey}`,
          {
            signal: AbortSignal.timeout(3000),
            next: { revalidate: 3600 },
          }
        )
          .then((res) => (res.ok ? res.json() : null))
          .catch(() => null)
      : Promise.resolve(null)

    // 3. Fetch user's own position for this asset
    const transactionsPromise = prisma.transaction.findMany({
      where: {
        userId: session.user.id,
        asset: {
          ticker: rawSymbol,
        },
      },
      orderBy: { txnDate: 'asc' },
    })

    const [yahooData, yahooHistoryData, finnhubMetric, finnhubTarget, finnhubRecom, userTxns] =
      await Promise.all([
        yahooPromise,
        yahooHistoryPromise,
        finnhubMetricPromise,
        finnhubTargetPromise,
        finnhubRecomPromise,
        transactionsPromise,
      ])

    const result = yahooData?.chart?.result?.[0]
    const meta = result?.meta || {}
    const timestamps: number[] = result?.timestamp || []
    const quote = result?.indicators?.quote?.[0] || {}
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

    // Slice down to the exact requested timeframe for display
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

    // Price change calculation
    const currentPrice = Number(meta.regularMarketPrice ?? chartPoints[chartPoints.length - 1]?.price ?? 0)
    let prevClose = Number(meta.chartPreviousClose ?? chartPoints[0]?.price ?? currentPrice)
    if (range !== '1d' && chartPoints.length > 0) {
      prevClose = chartPoints[0].price
    }
    const change = currentPrice - prevClose
    const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0

    // Technical Levels: Support & Resistance (Pivot Points Standard & Extremes)
    let technicalLevels: TechnicalLevels | null = null
    if (chartPoints.length > 0) {
      const allHighs = chartPoints.map((p) => p.high)
      const allLows = chartPoints.map((p) => p.low)
      const periodHigh = Math.max(...allHighs)
      const periodLow = Math.min(...allLows)
      const periodClose = chartPoints[chartPoints.length - 1].close

      // Classic Pivot Point Formula
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

    // 52-Week Range
    const fiftyTwoWeekHigh = Number(
      finnhubMetric?.metric?.['52WeekHigh'] ?? meta.fiftyTwoWeekHigh ?? 0
    )
    const fiftyTwoWeekLow = Number(
      finnhubMetric?.metric?.['52WeekLow'] ?? meta.fiftyTwoWeekLow ?? 0
    )

    // Valuation & Dividend
    let pe: number | null = finnhubMetric?.metric?.peBasicExclExtraItemsTTM ?? null
    let dividendYield: number | null =
      finnhubMetric?.metric?.dividendYieldIndicatedAnnual ?? null
    let marketCap: number | null = finnhubMetric?.metric?.marketCapitalization ?? null

    // Fallback to Yahoo Quote Summary if Finnhub is not configured / returns null
    if (!pe || !marketCap || dividendYield === null) {
      const ySummary = await getYahooQuoteSummary(yfTicker)
      if (ySummary) {
        if (!pe && ySummary.pe) pe = ySummary.pe
        if (!marketCap && ySummary.marketCap) marketCap = ySummary.marketCap
        if (dividendYield === null && ySummary.dividendYield !== null) dividendYield = ySummary.dividendYield
      }
    }

    // Analyst Consensus & Target Price
    let analystTarget: {
      targetHigh: number | null
      targetLow: number | null
      targetMean: number | null
      upsidePercent: number | null
      recommendation: string | null
    } | null = null

    if (finnhubTarget && finnhubTarget.targetMean) {
      const mean = Number(finnhubTarget.targetMean)
      const upside = currentPrice > 0 ? ((mean - currentPrice) / currentPrice) * 100 : 0
      const latestRecom = Array.isArray(finnhubRecom) && finnhubRecom.length > 0 ? finnhubRecom[0] : null

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
        upsidePercent: Number(upside.toFixed(2)),
        recommendation: recomLabel,
      }
    }

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

    // Always try to populate rich metrics from Yahoo Quote Summary
    const ySummary = await getYahooQuoteSummary(yfTicker)
    if (ySummary) {
      if (!pe && ySummary.pe) pe = ySummary.pe
      if (!marketCap && ySummary.marketCap) marketCap = ySummary.marketCap
      if (dividendYield === null && ySummary.dividendYield !== null) dividendYield = ySummary.dividendYield
    }

    // Historical Dividends, Splits & Return Performance Matrix
    const historicalStats = parseHistoricalStats(
      yahooHistoryData?.chart?.result?.[0] || yahooData?.chart?.result?.[0],
      currentPrice,
      userTxns,
      userPosition,
      ySummary?.payoutRatio !== null && ySummary?.payoutRatio !== undefined ? Number(ySummary.payoutRatio.toFixed(2)) : null
    )

    const payload = {
      symbol: rawSymbol,
      name: meta.longName || meta.shortName || rawSymbol,
      currency: meta.currency || (market === 'TH' ? 'THB' : 'USD'),
      market,
      currentPrice,
      change,
      changePercent,
      dayHigh: meta.regularMarketDayHigh ?? null,
      dayLow: meta.regularMarketDayLow ?? null,
      volume: meta.regularMarketVolume ?? null,
      fiftyTwoWeekHigh: fiftyTwoWeekHigh || null,
      fiftyTwoWeekLow: fiftyTwoWeekLow || null,
      pe: pe ? Number(pe.toFixed(2)) : null,
      forwardPe: ySummary?.forwardPe ? Number(ySummary.forwardPe.toFixed(2)) : null,
      pb: ySummary?.pb ? Number(ySummary.pb.toFixed(2)) : null,
      evEbitda: ySummary?.evEbitda ? Number(ySummary.evEbitda.toFixed(2)) : null,
      dividendYield: dividendYield !== null ? Number(dividendYield.toFixed(2)) : (historicalStats.dividends.ttmYield ?? null),
      payoutRatio: ySummary?.payoutRatio !== null && ySummary?.payoutRatio !== undefined ? Number(ySummary.payoutRatio.toFixed(2)) : null,
      revenue: ySummary?.revenue ?? null,
      revenueGrowth: ySummary?.revenueGrowth !== null && ySummary?.revenueGrowth !== undefined ? Number(ySummary.revenueGrowth.toFixed(2)) : null,
      eps: ySummary?.eps !== null && ySummary?.eps !== undefined ? Number(ySummary.eps.toFixed(2)) : null,
      freeCashflow: ySummary?.freeCashflow ?? null,
      marketCap: marketCap ? Number(marketCap) : null,
      analystTarget,
      userPosition,
      chartPoints,
      technicalLevels,
      range,
      historicalStats,
    }

    stockDetailMemoryCache.set(cacheKey, { data: payload, timestamp: now })

    return NextResponse.json(payload)
  } catch (error) {
    console.error('[stock-detail GET error]', error)
    return NextResponse.json({ error: 'Failed to fetch stock detail' }, { status: 500 })
  }
}

