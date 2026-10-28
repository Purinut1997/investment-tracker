/**
 * Real Human Sentiment Engine: CNN Fear & Greed Index & Crypto Fear & Greed
 * Captures true human emotion (Fear, Greed, Panic, Complacency) directly from institutional sentiment feeds
 */

export interface FearAndGreedData {
  score: number // 0 to 100
  rating: 'extreme_fear' | 'fear' | 'neutral' | 'greed' | 'extreme_greed'
  ratingLabelTh: string
  previousClose: number
  previous1Week: number
  previous1Month: number
  timestamp: string
  source: 'CNN_LIVE' | 'CALCULATED_FALLBACK'
}

let cachedCnnData: FearAndGreedData | null = null
let lastFetchTime = 0
const CACHE_DURATION_MS = 10 * 60 * 1000 // 10 minutes cache

export async function fetchRealHumanSentiment(): Promise<FearAndGreedData> {
  const now = Date.now()
  if (cachedCnnData && now - lastFetchTime < CACHE_DURATION_MS) {
    return cachedCnnData
  }

  try {
    const res = await fetch('https://production.dataviz.cnn.io/index/fearandgreed/graphdata', {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(4000),
      next: { revalidate: 600 },
    })

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }

    const data = await res.json()
    const fg = data?.fear_and_greed

    if (!fg || fg.score === undefined) {
      throw new Error('Invalid CNN payload structure')
    }

    const rawScore = Math.round(Number(fg.score))
    const ratingRaw = String(fg.rating || 'neutral').toLowerCase()

    let rating: FearAndGreedData['rating'] = 'neutral'
    let ratingLabelTh = 'สมดุล / ลังเล (Neutral)'

    if (rawScore <= 25 || ratingRaw.includes('extreme_fear')) {
      rating = 'extreme_fear'
      ratingLabelTh = 'กลัวจัด / ตื่นตระหนก (Extreme Fear)'
    } else if (rawScore <= 45 || ratingRaw.includes('fear')) {
      rating = 'fear'
      ratingLabelTh = 'ตลาดกังวล / ขวัญผวา (Fear)'
    } else if (rawScore <= 55 || ratingRaw.includes('neutral')) {
      rating = 'neutral'
      ratingLabelTh = 'สมดุล / ชะลอดูทิศทาง (Neutral)'
    } else if (rawScore <= 75 || ratingRaw.includes('greed')) {
      rating = 'greed'
      ratingLabelTh = 'กล้าเสี่ยง / มั่นใจ (Greed)'
    } else {
      rating = 'extreme_greed'
      ratingLabelTh = 'โลภจัด / ร้อนแรงเกินพิกัด (Extreme Greed)'
    }

    cachedCnnData = {
      score: rawScore,
      rating,
      ratingLabelTh,
      previousClose: Math.round(Number(fg.previous_close || rawScore)),
      previous1Week: Math.round(Number(fg.previous_1_week || rawScore)),
      previous1Month: Math.round(Number(fg.previous_1_month || rawScore)),
      timestamp: fg.timestamp || new Date().toISOString(),
      source: 'CNN_LIVE',
    }
    lastFetchTime = now
    return cachedCnnData
  } catch (err: any) {
    console.warn('[fetchRealHumanSentiment] Failed to fetch live CNN Fear & Greed, using fallback:', err.message)
    if (cachedCnnData) return cachedCnnData

    // Fallback safe defaults if CNN network is down
    return {
      score: 35,
      rating: 'fear',
      ratingLabelTh: 'ตลาดกังวล / ระมัดระวัง (Fear)',
      previousClose: 34,
      previous1Week: 31,
      previous1Month: 32,
      timestamp: new Date().toISOString(),
      source: 'CALCULATED_FALLBACK',
    }
  }
}
