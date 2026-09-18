import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

interface ChartPoint {
  time: string
  price: number
  timestamp: number
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

  // Map timeframe to Yahoo parameters
  let yfRange = '1mo'
  let yfInterval = '1d'

  switch (range) {
    case '1d':
      yfRange = '1d'
      yfInterval = '5m'
      break
    case '1w':
    case '5d':
      yfRange = '5d'
      yfInterval = '15m'
      break
    case '1m':
    case '1mo':
      yfRange = '1mo'
      yfInterval = '1d'
      break
    case '1y':
      yfRange = '1y'
      yfInterval = '1wk'
      break
    default:
      yfRange = '1mo'
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
    // 1. Fetch Yahoo Chart Data
    const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      yfTicker
    )}?range=${yfRange}&interval=${yfInterval}`

    const yahooPromise = fetch(chartUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json',
      },
      next: { revalidate: 60 },
    })
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null)

    // 2. Fetch Finnhub data if available and applicable (mostly US equities)
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
          { next: { revalidate: 3600 } }
        )
          .then((res) => (res.ok ? res.json() : null))
          .catch(() => null)
      : Promise.resolve(null)

    const finnhubTargetPromise = shouldFetchFinnhub
      ? fetch(
          `https://finnhub.io/api/v1/stock/price-target?symbol=${encodeURIComponent(
            rawSymbol
          )}&token=${finnhubKey}`,
          { next: { revalidate: 3600 } }
        )
          .then((res) => (res.ok ? res.json() : null))
          .catch(() => null)
      : Promise.resolve(null)

    const finnhubRecomPromise = shouldFetchFinnhub
      ? fetch(
          `https://finnhub.io/api/v1/stock/recommendation?symbol=${encodeURIComponent(
            rawSymbol
          )}&token=${finnhubKey}`,
          { next: { revalidate: 3600 } }
        )
          .then((res) => (res.ok ? res.json() : null))
          .catch(() => null)
      : Promise.resolve(null)

    // 3. Fetch user's own position for this asset if in portfolio
    const transactionsPromise = prisma.transaction.findMany({
      where: {
        userId: session.user.id,
        asset: {
          ticker: rawSymbol,
        },
      },
      orderBy: { txnDate: 'asc' },
    })

    const [yahooData, finnhubMetric, finnhubTarget, finnhubRecom, userTxns] =
      await Promise.all([
        yahooPromise,
        finnhubMetricPromise,
        finnhubTargetPromise,
        finnhubRecomPromise,
        transactionsPromise,
      ])

    const result = yahooData?.chart?.result?.[0]
    const meta = result?.meta || {}
    const timestamps: number[] = result?.timestamp || []
    const closes: (number | null)[] =
      result?.indicators?.quote?.[0]?.close || []

    // Build clean chart points
    const chartPoints: ChartPoint[] = []
    const isIntraday = range === '1d' || range === '1w'

    for (let i = 0; i < timestamps.length; i++) {
      const p = closes[i]
      if (p !== null && p !== undefined && !isNaN(p)) {
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

        chartPoints.push({
          time: timeLabel,
          price: Number(p.toFixed(2)),
          timestamp: timestamps[i],
        })
      }
    }

    // Price change calculation
    const currentPrice = Number(meta.regularMarketPrice ?? chartPoints[chartPoints.length - 1]?.price ?? 0)
    const prevClose = Number(meta.chartPreviousClose ?? chartPoints[0]?.price ?? currentPrice)
    const change = currentPrice - prevClose
    const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0

    // 52-Week Range
    const fiftyTwoWeekHigh = Number(
      finnhubMetric?.metric?.['52WeekHigh'] ?? meta.fiftyTwoWeekHigh ?? 0
    )
    const fiftyTwoWeekLow = Number(
      finnhubMetric?.metric?.['52WeekLow'] ?? meta.fiftyTwoWeekLow ?? 0
    )

    // Valuation & Dividend
    const pe = finnhubMetric?.metric?.peBasicExclExtraItemsTTM ?? null
    const dividendYield =
      finnhubMetric?.metric?.dividendYieldIndicatedAnnual ?? null
    const marketCap = finnhubMetric?.metric?.marketCapitalization ?? null

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

    // User Position Summary
    let userPosition: {
      shares: number
      avgCost: number
      totalCost: number
      currentValue: number
      unrealizedGain: number
      unrealizedGainPercent: number
    } | null = null

    if (userTxns.length > 0) {
      let totalShares = 0
      let totalCostBasis = 0

      for (const t of userTxns) {
        const qty = Number(t.quantity || 0)
        const pricePerUnit = Number(t.pricePerUnit || 0)
        if (t.txnType === 'BUY') {
          totalShares += qty
          totalCostBasis += qty * pricePerUnit
        } else if (t.txnType === 'SELL') {
          totalShares -= qty
          // reduce cost basis proportionally
          if (totalShares > 0) {
            totalCostBasis = totalShares * (totalCostBasis / (totalShares + qty))
          } else {
            totalShares = 0
            totalCostBasis = 0
          }
        }
      }

      if (totalShares > 0) {
        const avg = totalCostBasis / totalShares
        const curVal = totalShares * currentPrice
        const gain = curVal - totalCostBasis
        const gainPct = totalCostBasis > 0 ? (gain / totalCostBasis) * 100 : 0

        userPosition = {
          shares: totalShares,
          avgCost: Number(avg.toFixed(2)),
          totalCost: Number(totalCostBasis.toFixed(2)),
          currentValue: Number(curVal.toFixed(2)),
          unrealizedGain: Number(gain.toFixed(2)),
          unrealizedGainPercent: Number(gainPct.toFixed(2)),
        }
      }
    }

    return NextResponse.json({
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
      dividendYield: dividendYield ? Number(dividendYield.toFixed(2)) : null,
      marketCap: marketCap ? Number(marketCap.toFixed(0)) : null,
      analystTarget,
      userPosition,
      chartPoints,
      range,
    })
  } catch (error) {
    console.error('[stock-detail GET error]', error)
    return NextResponse.json({ error: 'Failed to fetch stock detail' }, { status: 500 })
  }
}
