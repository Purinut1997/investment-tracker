/**
 * lib/market-data/technical-signals.ts
 * Real-time Institutional Technical Indicators & Support/Resistance Engine:
 * - 14-Day Wilder's RSI (Relative Strength Index)
 * - 50-Day and 200-Day Simple Moving Averages (SMA 50, SMA 200)
 * - Floor Trader Pivot Points (Pivot, S1, S2, R1, R2)
 * - 52-Week High/Low & Percentage Pullback (Dip calculation)
 * - Distance to Key Support Levels
 */

export interface TechnicalSignal {
  ticker: string
  currentPrice: number
  changePercent: number
  rsi14: number | null
  sma50: number | null
  sma200: number | null
  supportS1: number | null
  supportS2: number | null
  resistanceR1: number | null
  fiftyTwoWeekHigh: number | null
  fiftyTwoWeekLow: number | null
  pullbackFromHigh: number // e.g. -8.5%
  isNearSupport: boolean // within 2.5% of S1 or SMA50/SMA200
  isOversold: boolean // RSI < 35
  isOverbought: boolean // RSI > 70
  signalType: 'STRONG_DIP_BUY' | 'NEAR_SUPPORT' | 'ACCUMULATE' | 'OVERBOUGHT_RESISTANCE' | 'NEUTRAL'
  badgeText: string
  badgeClass: string
  metricSummary: string
  technicalReason: string
}

// 5-minute memory cache to prevent rate-limits and ensure superfast response
const technicalCache = new Map<string, { data: TechnicalSignal; timestamp: number }>()
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

export function calculateWildersRSI(closes: number[], period = 14): number | null {
  if (closes.length <= period) return null

  let gains = 0
  let losses = 0

  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1]
    if (diff >= 0) gains += diff
    else losses += Math.abs(diff)
  }

  let avgGain = gains / period
  let avgLoss = losses / period

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1]
    if (diff >= 0) {
      avgGain = (avgGain * (period - 1) + diff) / period
      avgLoss = (avgLoss * (period - 1)) / period
    } else {
      avgGain = (avgGain * (period - 1)) / period
      avgLoss = (avgLoss * (period - 1) + Math.abs(diff)) / period
    }
  }

  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return Number((100 - 100 / (1 + rs)).toFixed(1))
}

export function calculateSMA(closes: number[], period: number): number | null {
  if (closes.length < period) return null
  const slice = closes.slice(-period)
  const sum = slice.reduce((a, b) => a + b, 0)
  return Number((sum / period).toFixed(2))
}

export async function fetchSingleTickerTechnicalSignal(
  rawSymbol: string,
  market = 'US'
): Promise<TechnicalSignal> {
  const cleanSymbol = rawSymbol.trim().toUpperCase()
  const cacheKey = `${cleanSymbol}_${market}`
  const cached = technicalCache.get(cacheKey)
  const now = Date.now()

  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return cached.data
  }

  // Format Yahoo Ticker
  let yfTicker = cleanSymbol
  if (cleanSymbol === 'GOLD' || cleanSymbol === 'XAU') {
    yfTicker = 'GC=F'
  } else if (cleanSymbol === 'BTC') {
    yfTicker = 'BTC-USD'
  } else if (cleanSymbol === 'ETH') {
    yfTicker = 'ETH-USD'
  } else if (cleanSymbol === 'SOL') {
    yfTicker = 'SOL-USD'
  } else if (market === 'TH' && !cleanSymbol.endsWith('.BK')) {
    yfTicker = `${cleanSymbol}.BK`
  }

  try {
    // Fetch 6 months of daily candles for robust SMA50 and RSI14
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      yfTicker
    )}?range=6mo&interval=1d`

    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(3500),
      next: { revalidate: 300 },
    })

    if (!res.ok) throw new Error(`Yahoo Finance responded ${res.status}`)

    const json = await res.json()
    const result = json?.chart?.result?.[0]
    const meta = result?.meta || {}
    const quote = result?.indicators?.quote?.[0] || {}

    const closesRaw: (number | null)[] = quote.close || []
    const highsRaw: (number | null)[] = quote.high || []
    const lowsRaw: (number | null)[] = quote.low || []

    const validCloses: number[] = []
    const validHighs: number[] = []
    const validLows: number[] = []

    for (let i = 0; i < closesRaw.length; i++) {
      const c = closesRaw[i]
      if (c !== null && c !== undefined && !isNaN(c)) {
        validCloses.push(Number(c.toFixed(2)))
        validHighs.push(Number((highsRaw[i] ?? c).toFixed(2)))
        validLows.push(Number((lowsRaw[i] ?? c).toFixed(2)))
      }
    }

    const currentPrice = Number(
      meta.regularMarketPrice ?? validCloses[validCloses.length - 1] ?? 0
    )
    const prevClose = Number(
      meta.chartPreviousClose ?? validCloses[validCloses.length - 2] ?? currentPrice
    )
    const changePercent = prevClose > 0 ? ((currentPrice - prevClose) / prevClose) * 100 : 0

    // 1. Calculate Real Wilder's RSI(14)
    const rsi14 = calculateWildersRSI(validCloses, 14)

    // 2. Calculate Moving Averages (SMA 50, SMA 200 if enough data)
    const sma50 = calculateSMA(validCloses, 50)
    const sma200 = calculateSMA(validCloses, 200)

    // 3. Calculate Pivot Points from recent 30-day swing
    let supportS1: number | null = null
    let supportS2: number | null = null
    let resistanceR1: number | null = null

    if (validHighs.length >= 20 && validLows.length >= 20) {
      const recentHighs = validHighs.slice(-30)
      const recentLows = validLows.slice(-30)
      const periodHigh = Math.max(...recentHighs)
      const periodLow = Math.min(...recentLows)
      const periodClose = validCloses[validCloses.length - 1]

      const pivot = (periodHigh + periodLow + periodClose) / 3
      supportS1 = Number((2 * pivot - periodHigh).toFixed(2))
      supportS2 = Number((pivot - (periodHigh - periodLow)).toFixed(2))
      resistanceR1 = Number((2 * pivot - periodLow).toFixed(2))
    }

    // 4. 52-Week Range & Pullback
    const fiftyTwoWeekHigh = Number(meta.fiftyTwoWeekHigh ?? (validHighs.length > 0 ? Math.max(...validHighs) : currentPrice))
    const fiftyTwoWeekLow = Number(meta.fiftyTwoWeekLow ?? (validLows.length > 0 ? Math.min(...validLows) : currentPrice))
    const pullbackFromHigh =
      fiftyTwoWeekHigh > 0 ? ((currentPrice - fiftyTwoWeekHigh) / fiftyTwoWeekHigh) * 100 : 0

    // 5. Evaluate Proximity to Real Support
    const isNearS1 = supportS1 !== null && currentPrice <= supportS1 * 1.025 && currentPrice >= supportS1 * 0.97
    const isNearSMA50 = sma50 !== null && currentPrice <= sma50 * 1.02 && currentPrice >= sma50 * 0.98
    const isNearSMA200 = sma200 !== null && currentPrice <= sma200 * 1.025 && currentPrice >= sma200 * 0.975

    const isNearSupport = isNearS1 || isNearSMA50 || isNearSMA200
    const isOversold = rsi14 !== null && rsi14 < 35
    const isOverbought = rsi14 !== null && rsi14 > 68

    // 6. Institutional Signal Classification
    let signalType: TechnicalSignal['signalType'] = 'NEUTRAL'
    let badgeText = '⚪ ราคาเคลื่อนไหวปกติ'
    let badgeClass = 'bg-slate-500/15 text-slate-300 border-white/[0.08]'
    let technicalReason = 'ราคาแกว่งตัวในกรอบปกติ ไม่มีสัญญาณ Overbought หรือ Oversold รุนแรง'

    if (isOversold || (isNearSupport && pullbackFromHigh <= -7)) {
      signalType = 'STRONG_DIP_BUY'
      badgeText = '🔥 ชนแนวรับจริง / RSI Oversold (น่าช้อน)'
      badgeClass = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-xs shadow-emerald-950/30'
      technicalReason = `ราคา $${currentPrice.toFixed(2)} ย่อตัว ${pullbackFromHigh.toFixed(1)}% จากจุดสูงสุด 52W ${
        rsi14 ? `(RSI ${rsi14} อยู่ในเขต Oversold)` : ''
      } ${supportS1 ? `และทดสอบแนวรับ S1 ที่ $${supportS1}` : ''} เป็นจุดช้อนซื้อที่ได้เปรียบสูง`
    } else if (isNearSupport) {
      signalType = 'NEAR_SUPPORT'
      badgeText = '🟢 ทดสอบแนวรับสำคัญ (Test Support)'
      badgeClass = 'bg-teal-500/20 text-teal-300 border-teal-500/30'
      technicalReason = `ราคาทดสอบโซนแนวรับ ${supportS1 ? `S1 ($${supportS1})` : ''} ${
        sma50 ? `หรือ SMA50 ($${sma50})` : ''
      } มีแรงซื้อพยุง`
    } else if (isOverbought) {
      signalType = 'OVERBOUGHT_RESISTANCE'
      badgeText = '⚠️ ชนแนวต้าน / RSI Overbought (ชะลอซื้อ)'
      badgeClass = 'bg-amber-500/20 text-amber-300 border-amber-500/30'
      technicalReason = `RSI อยู่ที่ ${rsi14} (เขตซื้อมากเกินไป) ${
        resistanceR1 ? `และใกล้แนวต้าน R1 ($${resistanceR1})` : ''
      } เสี่ยงต่อการปรับฐานระยะสั้น ควรงดไล่ราคา`
    } else if (pullbackFromHigh <= -5) {
      signalType = 'ACCUMULATE'
      badgeText = '🔵 ย่อตัวระยะสั้น / ทยอยสะสม (Dip)'
      badgeClass = 'bg-blue-500/20 text-blue-300 border-blue-500/30'
      technicalReason = `ราคาย่อตัวลงมา ${pullbackFromHigh.toFixed(1)}% จากจุดสูงสุดรอบปี ทยอยสะสมตามแผน DCA ได้`
    }

    const metricSummary = [
      rsi14 ? `RSI ${rsi14}` : null,
      supportS1 ? `แนวรับ S1: $${supportS1}` : null,
      pullbackFromHigh !== 0 ? `ย่อตัว ${pullbackFromHigh.toFixed(1)}%` : null,
    ]
      .filter(Boolean)
      .join(' | ')

    const signalData: TechnicalSignal = {
      ticker: cleanSymbol,
      currentPrice: Number(currentPrice.toFixed(2)),
      changePercent: Number(changePercent.toFixed(2)),
      rsi14,
      sma50,
      sma200,
      supportS1,
      supportS2,
      resistanceR1,
      fiftyTwoWeekHigh,
      fiftyTwoWeekLow,
      pullbackFromHigh: Number(pullbackFromHigh.toFixed(1)),
      isNearSupport,
      isOversold,
      isOverbought,
      signalType,
      badgeText,
      badgeClass,
      metricSummary,
      technicalReason,
    }

    technicalCache.set(cacheKey, { data: signalData, timestamp: now })
    return signalData
  } catch (err) {
    console.error(`[fetchSingleTickerTechnicalSignal] Error for ${cleanSymbol}:`, err)
    // Safe Fallback based on basic info
    const fallback: TechnicalSignal = {
      ticker: cleanSymbol,
      currentPrice: 0,
      changePercent: 0,
      rsi14: null,
      sma50: null,
      sma200: null,
      supportS1: null,
      supportS2: null,
      resistanceR1: null,
      fiftyTwoWeekHigh: null,
      fiftyTwoWeekLow: null,
      pullbackFromHigh: 0,
      isNearSupport: false,
      isOversold: false,
      isOverbought: false,
      signalType: 'NEUTRAL',
      badgeText: '📊 สะสมตามสัดส่วนแผน',
      badgeClass: 'bg-slate-500/15 text-slate-300 border-white/[0.08]',
      metricSummary: 'วิเคราะห์ตามสัดส่วนเป้าหมาย',
      technicalReason: 'สัดส่วนจัดสรรตามแผนการลงทุนหลัก',
    }
    return fallback
  }
}

export async function getBatchTechnicalSignals(
  tickers: Array<{ ticker: string; market?: string }>
): Promise<Record<string, TechnicalSignal>> {
  const results: Record<string, TechnicalSignal> = {}

  // Parallel fetch with concurrency control
  const promises = tickers.map(async (t) => {
    const sig = await fetchSingleTickerTechnicalSignal(t.ticker, t.market)
    results[t.ticker.toUpperCase()] = sig
  })

  await Promise.all(promises)
  return results
}
