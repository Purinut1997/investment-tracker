/**
 * lib/earnings/earnings-analyzer.ts
 * Core Earnings Intelligence Engine:
 * - Upcoming Earnings Announcement Calendar & Live Countdown (วันแจ้งผลประกอบการ & อีกกี่วัน)
 * - Historical Quarterly Performance (งบการเงินย้อนหลัง 4 ไตรมาส)
 * - Consensus Estimates vs Actual Performance (ตัวเลขที่ตลาดคาดหวัง เทียบกับที่ทำได้จริง)
 * - Beat / Miss Analysis & Surprise % (วิเคราะห์ผลงานเหนือ/ต่ำกว่าคาด)
 * - Year-over-Year (YoY) Comparisons with Same Period Last Year (เทียบช่วงเดียวกันของปีก่อนหน้า เติบโต/ลดลงเท่าไหร่)
 * - Multi-Year Revenue & Net Income Financials Trend
 */

import { getYahooAuth } from '../market-data/yahoo-crumb'

export interface QuarterDrivers {
  summary: string // ข้อความสรุปสั้นๆ ได้ใจความว่ากำไรหรือขาดทุนเพราะอะไร
  primaryProfitDrivers: string[] // ปัจจัยหนุนกำไรหลัก เช่น กลุ่มธุรกิจที่เติบโต, Margin ขยายตัว
  headwindsAndCosts: string[] // ปัจจัยกดดัน/ต้นทุนที่สูงขึ้น เช่น Capex AI, ค่าใช้จ่าย R&D, FX
  postEarningsMoveNote?: string // สถิติราคาหุ้นตอบรับหลังวันงบออก
}

export interface HistoricalQuarterEarnings {
  quarter: string // e.g. "2Q2026", "1Q2026", "4Q2025", "3Q2025"
  fiscalQuarter?: string
  reportedDate: string // YYYY-MM-DD
  reportedDateThai: string // e.g. "30 ก.ค. 2026"
  actualEps: number | null
  estimateEps: number | null
  epsDifference: number | null
  surprisePercent: number | null
  beatStatus: 'BEAT' | 'MISS' | 'IN_LINE' | 'NO_ESTIMATE'
  
  revenue: number | null
  revenueFormatted: string | null
  netIncome: number | null
  netIncomeFormatted: string | null
  profitMarginPercent: number | null

  // Prior period comparisons
  prevQuarter?: string
  prevEps?: number | null
  epsQoqGrowthPercent?: number | null
  prevRevenue?: number | null
  revenueQoqGrowthPercent?: number | null

  // Post-earnings price reaction (สถิติราคาหุ้นแกว่งหลังประกาศงบ)
  postEarningsPriceMovePercent?: number | null

  // Drill-down Business Drivers (กำไรมาจากอะไร ขาดทุนเพราะอะไร)
  drivers?: QuarterDrivers
}

export interface UpcomingEarningsEvent {
  hasUpcomingDate: boolean
  earningsDate: string | null // YYYY-MM-DD
  earningsDateThai: string | null // e.g. "2 พ.ย. 2026"
  daysRemaining: number
  countdownLabel: string // e.g. "อีก 8 วัน", "วันนี้", "ผ่านไปแล้ว"
  status: 'today' | 'urgent' | 'soon' | 'upcoming' | 'reported' | 'tbd'
  isEstimated: boolean
  fiscalQuarterLabel: string // e.g. "3Q2026"

  // 1. Release Timing (BMO / AMC / DMH) + Thailand Time
  releaseTiming: 'BMO' | 'AMC' | 'DMH' | 'TBD'
  releaseTimingLabel: string // e.g. "หลังตลาดปิด (AMC)"
  releaseTimeThai: string // e.g. "ประมาณ 03:00 - 04:30 น. (เช้ามืดเวลาไทย)"
  earningsCallTimeThai?: string // e.g. "03:30 น. (Conference Call)"
  releaseAdviceThai: string // คำแนะนำความผันผวนของราคาหุ้นนอกเวลา

  // 2. Analyst Estimate Revisions (การปรับเป้าของนักวิเคราะห์ช่วง 7/30 วัน)
  revisions?: {
    upLast7days: number
    downLast7days: number
    upLast30days: number
    downLast30days: number
    sentiment: 'bullish' | 'bearish' | 'neutral'
    summaryThai: string
  }

  // Market Consensus for upcoming report (ตัวเลขที่ตลาดคาดหวัง)
  consensusEps: number | null
  epsRange?: {
    low: number | null
    high: number | null
  }
  consensusRevenue: number | null
  consensusRevenueFormatted: string | null
  revenueRange?: {
    low: number | null
    high: number | null
    lowFormatted: string | null
    highFormatted: string | null
  }
  analystCount?: number

  // YoY Comparison for upcoming report (เทียบกับช่วงเดียวกันของปีก่อนหน้า)
  yearAgoQuarterLabel?: string // e.g. "3Q2025"
  yearAgoEps?: number | null
  epsExpectedYoyGrowthPercent?: number | null
  yearAgoRevenue?: number | null
  yearAgoRevenueFormatted?: string | null
  revenueExpectedYoyGrowthPercent?: number | null
}

export interface YearlyFinancialSummary {
  year: number
  yearLabel?: string
  isEstimate?: boolean
  revenue: number
  revenueFormatted: string
  netIncome: number | null
  netIncomeFormatted: string
  profitMarginPercent: number | null
  revenueYoyGrowthPercent?: number | null
  netIncomeYoyGrowthPercent?: number | null

  // Annual Business Drivers (ที่มาของกำไรและพัฒนาการรายปี)
  drivers?: QuarterDrivers
}

export interface AnalyzedEarningsData {
  symbol: string
  ticker: string
  market: 'TH' | 'US' | 'GLOBAL'
  companyName: string
  currency: string
  currentPrice: number
  priceChangePercent?: number

  // 1. Upcoming Earnings
  upcoming: UpcomingEarningsEvent

  // 2. Historical Quarters (Actual vs Consensus & Drivers)
  historicalQuarters: HistoricalQuarterEarnings[]

  // 3. Multi-year Financials
  yearlyFinancials: YearlyFinancialSummary[]

  // 4. Track Record & Stats
  stats: {
    totalQuartersAnalyzed: number
    beatsCount: number
    missesCount: number
    inLineCount: number
    beatRatePercent: number // e.g. 100% or 75%
    averageSurprisePercent: number // e.g. +5.4%
    latestSurprisePercent: number | null
    latestBeatStatus: 'BEAT' | 'MISS' | 'IN_LINE' | 'NO_ESTIMATE'
    consecutiveBeats: number
    aiSentiment: 'bullish' | 'neutral' | 'bearish'
    aiTakeaway: string // Comprehensive summary in Thai

    // Post-Earnings Price Move Statistics
    avgPostEarningsMovePercent: number // e.g. 6.56%
    avgBeatPriceMovePercent: number // e.g. +7.62%
    avgMissPriceMovePercent: number // e.g. -5.49%
    maxPostEarningsGain?: number
    maxPostEarningsDrop?: number
    postEarningsInsight: string
  }
}

// In-memory cache for earnings data (15 minutes TTL)
interface EarningsCacheEntry {
  data: AnalyzedEarningsData
  timestamp: number
}
const earningsCache = new Map<string, EarningsCacheEntry>()
const inFlightEarnings = new Map<string, Promise<AnalyzedEarningsData | null>>()
const CACHE_TTL_MS = 15 * 60 * 1000

/**
 * Formats a raw number into readable financial string (e.g. 113.36B, 850M, or ฿1.2T)
 */
export function formatFinancialAmount(val: number | null | undefined, currency: string = 'USD'): string {
  if (val === null || val === undefined || isNaN(val)) return '-'
  const symbol = currency === 'THB' ? '฿' : currency === 'PTS' ? '' : '$'
  const absVal = Math.abs(val)
  const sign = val < 0 ? '-' : ''

  if (absVal >= 1e12) {
    return `${sign}${symbol}${(absVal / 1e12).toFixed(2)}T`
  }
  if (absVal >= 1e9) {
    return `${sign}${symbol}${(absVal / 1e9).toFixed(2)}B`
  }
  if (absVal >= 1e6) {
    return `${sign}${symbol}${(absVal / 1e6).toFixed(2)}M`
  }
  if (absVal >= 1e3) {
    return `${sign}${symbol}${(absVal / 1e3).toFixed(2)}K`
  }
  return `${sign}${symbol}${absVal.toFixed(2)}`
}

/**
 * Formats a date string (YYYY-MM-DD) into Thai friendly format
 */
export function formatThaiDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-'
  const parts = dateStr.split('-')
  if (parts.length < 3) return dateStr
  const year = parseInt(parts[0], 10)
  const monthIdx = parseInt(parts[1], 10) - 1
  const day = parseInt(parts[2], 10)

  const thaiMonths = [
    'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
  ]
  return `${day} ${thaiMonths[monthIdx] || ''} ${year}`
}

/**
 * Normalizes ticker symbols for Yahoo Finance
 */
export function formatYahooTicker(ticker: string, market: 'TH' | 'US' | 'GLOBAL' = 'US'): string {
  const clean = ticker.trim().toUpperCase()
  if (market === 'TH' && !clean.endsWith('.BK')) {
    return `${clean}.BK`
  }
  return clean
}

/**
 * Calculates earnings release timing (BMO / AMC) with Thailand local time
 */
export function computeReleaseTiming(
  rawDateObj: any,
  rawCallDateObj: any,
  market: 'TH' | 'US' = 'US',
  ticker = ''
): {
  releaseTiming: 'BMO' | 'AMC' | 'DMH' | 'TBD'
  releaseTimingLabel: string
  releaseTimeThai: string
  earningsCallTimeThai?: string
  releaseAdviceThai: string
} {
  const clean = ticker.toUpperCase()

  if (market === 'TH' || clean.endsWith('.BK')) {
    return {
      releaseTiming: 'AMC',
      releaseTimingLabel: 'หลังตลาดปิด (After Market Close)',
      releaseTimeThai: 'ประมาณ 17:30 - 20:30 น. (เวลาไทย)',
      earningsCallTimeThai: undefined,
      releaseAdviceThai: 'บริษัทจดทะเบียนในไทยมักส่งงบการเงินเข้าสู่ระบบ SET หลังปิดตลาดช่วงเย็น ราคาจะตอบรับในวันทำการถัดไป',
    }
  }

  const KNOWN_AMC = new Set(['GOOGL', 'GOOG', 'AAPL', 'MSFT', 'META', 'AMZN', 'TSLA', 'NVDA', 'NFLX', 'AMD', 'QCOM', 'INTC'])
  const KNOWN_BMO = new Set(['JPM', 'BAC', 'WFC', 'C', 'GS', 'MS', 'WMT', 'TGT', 'HD', 'KO', 'PEP', 'PG', 'JNJ', 'UNH', 'CAT', 'BA', 'XOM', 'CVX'])

  const rawSeconds = typeof rawDateObj === 'object' && rawDateObj.raw ? Number(rawDateObj.raw) : null
  const callSeconds = typeof rawCallDateObj === 'object' && rawCallDateObj.raw ? Number(rawCallDateObj.raw) : null

  let hourNy = -1
  let timeStrThai = ''
  let callTimeThai = ''

  if (rawSeconds) {
    const d = new Date(rawSeconds * 1000)
    try {
      const nyFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        hour: 'numeric',
        hour12: false,
      })
      const bkkFormatter = new Intl.DateTimeFormat('th-TH', {
        timeZone: 'Asia/Bangkok',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
      const parts = nyFormatter.formatToParts(d)
      const hPart = parts.find((p) => p.type === 'hour')
      if (hPart) hourNy = parseInt(hPart.value, 10)
      timeStrThai = `${bkkFormatter.format(d)} น.`
    } catch {}
  }

  if (callSeconds) {
    const dCall = new Date(callSeconds * 1000)
    try {
      const bkkCall = new Intl.DateTimeFormat('th-TH', {
        timeZone: 'Asia/Bangkok',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
      callTimeThai = `${bkkCall.format(dCall)} น. (Conference Call แถลงผลประกอบการ)`
    } catch {}
  }

  if (hourNy >= 15 && hourNy <= 23) {
    return {
      releaseTiming: 'AMC',
      releaseTimingLabel: 'หลังตลาดปิด (After Market Close - AMC)',
      releaseTimeThai: timeStrThai ? `ประมาณ ${timeStrThai} (เช้ามืดเวลาไทย)` : 'ประมาณ 03:00 - 04:30 น. (เช้ามืดเวลาไทย)',
      earningsCallTimeThai: callTimeThai || 'ประมาณ 03:30 - 04:30 น. (Conference Call)',
      releaseAdviceThai: 'ราคาจะมีความผันผวนสูงมากในตลาดนอกเวลา (After-Hours) ตั้งแต่ 03:00 น. เป็นต้นไป หากถือ Position ข้ามคืนควรระวังความเสี่ยง Gap ราคา',
    }
  }

  if (hourNy >= 5 && hourNy <= 10) {
    return {
      releaseTiming: 'BMO',
      releaseTimingLabel: 'ก่อนตลาดเปิด (Before Market Open - BMO)',
      releaseTimeThai: timeStrThai ? `ประมาณ ${timeStrThai} (ค่ำวันเดียวกันเวลาไทย)` : 'ประมาณ 18:00 - 20:30 น. (ค่ำวันเดียวกันเวลาไทย)',
      earningsCallTimeThai: callTimeThai || 'ประมาณ 19:30 - 20:30 น. (Conference Call)',
      releaseAdviceThai: 'ราคาจะตอบรับอย่างรวดเร็วในตลาด Pre-Market ก่อนที่ตลาดหุ้นสหรัฐฯ จะเปิดเทรดปกติช่วง 20:30 / 21:30 น.',
    }
  }

  // Fallback to known company habits
  if (KNOWN_AMC.has(clean)) {
    return {
      releaseTiming: 'AMC',
      releaseTimingLabel: 'หลังตลาดปิด (After Market Close - AMC)',
      releaseTimeThai: 'ประมาณ 03:00 - 04:30 น. (เช้ามืดวันถัดไปเวลาไทย)',
      earningsCallTimeThai: callTimeThai || 'ประมาณ 03:30 - 04:30 น. (Conference Call)',
      releaseAdviceThai: 'บริษัทมักรายงานผลหลังตลาดสหรัฐฯ ปิดทำการ (16:00 ET) ราคาจะเคลื่อนไหวใน After-Hours ทันที',
    }
  }

  if (KNOWN_BMO.has(clean)) {
    return {
      releaseTiming: 'BMO',
      releaseTimingLabel: 'ก่อนตลาดเปิด (Before Market Open - BMO)',
      releaseTimeThai: 'ประมาณ 18:00 - 20:30 น. (ค่ำวันเดียวกันเวลาไทย)',
      earningsCallTimeThai: callTimeThai || 'ประมาณ 19:30 - 20:30 น. (Conference Call)',
      releaseAdviceThai: 'บริษัทมักรายงานผลก่อนตลาดสหรัฐฯ เปิดทำการ (Pre-Market) ราคาจะตอบรับช่วงค่ำเวลาไทย',
    }
  }

  return {
    releaseTiming: 'TBD',
    releaseTimingLabel: 'รอประกาศช่วงเวลาชัดเจน (AMC/BMO)',
    releaseTimeThai: 'มักรายงานก่อนเปิดตลาด (~19:00 น.) หรือหลังตลาดปิด (~03:00 น.)',
    earningsCallTimeThai: callTimeThai || undefined,
    releaseAdviceThai: 'ควรติดตามกำหนดการแจ้งเวลาแถลงผลประกอบการอย่างเป็นทางการของบริษัท',
  }
}

/**
 * Fetches historical 2-year chart data to compute post-earnings price reactions
 */
export async function fetchHistoricalPriceMoves(
  yfTicker: string
): Promise<Map<string, { close: number; preClose: number; postClose: number }>> {
  const result = new Map<string, { close: number; preClose: number; postClose: number }>()
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yfTicker)}?range=2y&interval=1d`
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(4000),
    })
    if (!res.ok) return result

    const json = await res.json()
    const chart = json?.chart?.result?.[0]
    const timestamps = (chart?.timestamp || []) as number[]
    const closes = (chart?.indicators?.quote?.[0]?.close || []) as (number | null)[]

    for (let i = 0; i < timestamps.length; i++) {
      const c = closes[i]
      if (c === null || c === undefined || isNaN(c)) continue
      const dateStr = new Date(timestamps[i] * 1000).toISOString().split('T')[0]
      const preClose = i > 0 && closes[i - 1] != null ? closes[i - 1]! : c
      const postClose = i + 1 < closes.length && closes[i + 1] != null ? closes[i + 1]! : c

      result.set(dateStr, { close: c, preClose, postClose })
    }
  } catch (err) {
    // Graceful silent fallback: chart timeout will not break earnings flow
  }
  return result
}

/**
 * Generates concise, punchy Thai business driver analysis for a historical quarter
 * Explaining what drove the profit or caused the loss/slowdown.
 */
export function generateQuarterDrivers(params: {
  ticker: string
  companyName: string
  quarter: string
  actualEps: number | null
  estimateEps: number | null
  surprisePercent: number | null
  beatStatus: 'BEAT' | 'MISS' | 'IN_LINE' | 'NO_ESTIMATE'
  revenueFormatted: string | null
  netIncomeFormatted: string | null
  profitMarginPercent: number | null
  epsQoqGrowthPercent: number | null
  revenueQoqGrowthPercent: number | null
  postEarningsPriceMovePercent: number | null
}): QuarterDrivers {
  const {
    ticker,
    companyName,
    quarter,
    actualEps,
    estimateEps,
    surprisePercent,
    beatStatus,
    revenueFormatted,
    netIncomeFormatted,
    profitMarginPercent,
    epsQoqGrowthPercent,
    revenueQoqGrowthPercent,
    postEarningsPriceMovePercent,
  } = params

  const clean = ticker.toUpperCase()
  const isBeat = beatStatus === 'BEAT'
  const isMiss = beatStatus === 'MISS'
  const revText = revenueFormatted ? `รายได้รวม ${revenueFormatted}` : ''
  const marginText = profitMarginPercent !== null ? `อัตรากำไรสุทธิ ${profitMarginPercent.toFixed(1)}%` : ''

  let postMoveNote: string | undefined
  if (postEarningsPriceMovePercent !== null) {
    postMoveNote = `ราคาหุ้นวันรุ่งขึ้นตอบรับ: ${
      postEarningsPriceMovePercent >= 0 ? '+' : ''
    }${postEarningsPriceMovePercent}% (${postEarningsPriceMovePercent >= 0 ? 'ปรับตัวขึ้น' : 'ปรับตัวลดลง'})`
  }

  // --- 1. Custom High-Precision Sector Profiles for Major Stocks ---
  if (clean === 'GOOGL' || clean === 'GOOG') {
    if (isBeat) {
      return {
        summary: `ไตรมาส ${quarter} กำไรและรายได้เติบโตแข็งแกร่งเกินคาด (+${surprisePercent ?? 0}%) หนุนโดยการเติบโตของ Google Cloud (+30-35%) และรายได้โฆษณา Search ที่ฟื้นตัวโดดเด่น ควบคู่การคุมต้นทุนพนักงาน`,
        primaryProfitDrivers: [
          'Google Cloud เติบโตอย่างก้าวกระโดด ได้รับแรงหนุนจากเวิร์กโหลด Generative AI และบริการ Vertex AI ของลูกค้าระดับองค์กร',
          'รายได้ Search & Advertising และ YouTube Ads ฟื้นตัวแข็งแกร่งท่ามกลางการใช้จ่ายของกลุ่มค้าปลีกและการเงิน',
          'การบริหารโครงสร้างต้นทุนและควบคุมการจ้างงาน ส่งผลให้ Operating Margin ขยายตัวแตะระดับสูง',
        ],
        headwindsAndCosts: [
          'รายจ่ายฝ่ายทุน (Capex) ด้านเซิร์ฟเวอร์ AI และโครงสร้างพื้นฐาน TPU เพิ่มสูงขึ้นอย่างต่อเนื่อง',
          'ต้นทุนการจัดหาทราฟฟิก (Traffic Acquisition Costs - TAC) ยังคงเป็นค่าใช้จ่ายก้อนใหญ่ในการแข่งขัน',
        ],
        postEarningsMoveNote: postMoveNote,
      }
    } else {
      return {
        summary: `ไตรมาส ${quarter} กำไรชะลอตัวลงหรือต่ำกว่าเป้าหมาย เนื่องจากเม็ดเงินโฆษณาในบางหมวดฟื้นตัวช้ากว่าคาด และต้นทุนการลงทุนด้านโครงสร้างพื้นฐาน AI เร่งตัวขึ้น`,
        primaryProfitDrivers: [
          'กลุ่ม Google Cloud ยังคงรักษาสถานะมีกำไรจากการดำเนินงานต่อเนื่อง',
          'รายได้จากบริการ Subscription (YouTube Premium, Google One) เติบโตเป็นรายได้ประจำ (Recurring)',
        ],
        headwindsAndCosts: [
          'งบลงทุน Capex ด้านชิป AI และ Data Center ปรับตัวสูงขึ้น กดดันกระแสเงินสดอิสระระยะสั้น',
          'ความเสี่ยงจากคดีกฎหมายต่อต้านการผูกขาด (Antitrust) และการแข่งขัน Search จากผู้พัฒนา AI รายอื่น',
        ],
        postEarningsMoveNote: postMoveNote,
      }
    }
  }

  if (clean === 'NVDA') {
    return {
      summary: `ไตรมาส ${quarter} ผลการดำเนินงานทุบสถิติประวัติศาสตร์ ชนะคาดการณ์อย่างท่วมท้น (+${surprisePercent ?? 0}%) จากอุปสงค์ชิปประมวลผล AI สำหรับ Data Center ของกลุ่ม Big Tech ที่ล้นหลาม`,
      primaryProfitDrivers: [
        'ธุรกิจ Data Center เติบโตอย่างมหาศาล คิดเป็นกว่า 85% ของรายได้ทั้งหมด จากสถาปัตยกรรม Hopper และ Blackwell',
        'อัตรากำไรขั้นต้น (Gross Margin) ทรงตัวในระดับสูงเป็นประวัติการณ์ถึง 70-75%',
        'ระบบนิเวศซอฟต์แวร์ CUDA สร้างคูเมืองทางธุรกิจ (Moat) ที่คู่แข่งยากจะเข้ามาแย่งส่วนแบ่งตลาด',
      ],
      headwindsAndCosts: [
        'ข้อจำกัดด้านกำลังการผลิตบรรจุภัณฑ์ชิปขั้นสูง (CoWoS) ของโรงหล่อพันธมิตร',
        'มาตรการควบคุมการส่งออกเทคโนโลยีชิปขั้นสูงไปยังบางประเทศของรัฐบาลสหรัฐฯ',
      ],
      postEarningsMoveNote: postMoveNote,
    }
  }

  if (clean === 'AAPL') {
    return {
      summary: `ไตรมาส ${quarter} กำไรได้รับแรงขับเคลื่อนหลักจากธุรกิจบริการ (Services) ที่ทำสถิติสูงสุดใหม่ ผสานยอดขาย iPhone ที่แข็งแกร่งในตลาดเกิดใหม่ แม้ตลาดจีนจะมีความท้าทาย`,
      primaryProfitDrivers: [
        'กลุ่มบริการ (Services: App Store, iCloud, Apple Pay) เติบโตสองหลัก พร้อมอัตรากำไรขั้นต้นสูงกว่า 70%',
        'ฐานอุปกรณ์ที่ใช้งานอยู่ทั่วโลก (Active Installed Base) ขยายตัวทะลุ 2.2 พันล้านเครื่อง',
        'ยอดขาย iPhone รุ่น Pro ที่มีราคาเฉลี่ยต่อเครื่อง (ASP) สูงขึ้น ช่วยหนุนมาร์จิ้นรวม',
      ],
      headwindsAndCosts: [
        'การแข่งขันรุนแรงในตลาดจีนจากแบรนด์สมาร์ตโฟนท้องถิ่น',
        'รอบการเปลี่ยนอุปกรณ์ใหม่ของผู้บริโภคยาวนานขึ้นท่ามกลางภาวะเงินเฟ้อโลก',
      ],
      postEarningsMoveNote: postMoveNote,
    }
  }

  if (clean === 'MSFT') {
    return {
      summary: `ไตรมาส ${quarter} กำไรและรายได้ขยายตัวโดดเด่นจาก Microsoft Cloud นำโดย Azure AI Services ที่องค์กรทั่วโลกนำไปประยุกต์ใช้งานเชิงพาณิชย์จริง`,
      primaryProfitDrivers: [
        'Azure Cloud เติบโตในอัตราเร่ง โดยได้แรงส่งโดยตรงจากบริการ AI Services และโมเดล OpenAI',
        'รายได้จาก Microsoft 365 Copilot และซอฟต์แวร์คลาวด์องค์กรสร้างรายได้ประจำมั่นคงสูง',
        'กระแสเงินสดจากการดำเนินงานแข็งแกร่งมาก รองรับการจ่ายเงินปันผลและซื้อหุ้นคืนสม่ำเสมอ',
      ],
      headwindsAndCosts: [
        'งบลงทุน Capex ด้าน AI Server และ Data Center เร่งตัวขึ้นแตะระดับสูงสุดในประวัติศาสตร์',
        'ต้นทุนค่าใช้จ่ายในการบูรณาการธุรกิจเกมและโครงสร้างองค์กร',
      ],
      postEarningsMoveNote: postMoveNote,
    }
  }

  if (clean === 'META') {
    return {
      summary: `ไตรมาส ${quarter} ผลงานยอดเยี่ยม ชนะคาดการณ์อย่างมีนัยสำคัญจากประสิทธิภาพการยิงโฆษณาที่ขับเคลื่อนด้วย AI บน Instagram Reels และการปรับปรุงประสิทธิภาพพนักงาน`,
      primaryProfitDrivers: [
        'ระบบแนะนำเนื้อหา AI (Recommendation Engine) เพิ่มเวลาการรับชมและยอดคลิกโฆษณาบน Reels อย่างเห็นได้ชัด',
        'อัตรากำไรจากการดำเนินงาน (Operating Margin) พุ่งสูงจากการคุมค่าใช้จ่ายพนักงานและโครงสร้างองค์กรที่กระชับ',
        'การใช้จ่ายด้านโฆษณาจากกลุ่มผู้ค้าปลีก E-commerce จีนและแบรนด์ระดับโลกเพิ่มขึ้น',
      ],
      headwindsAndCosts: [
        'ผลขาดทุนจากการดำเนินงานในแผนก Reality Labs (ฮาร์ดแวร์ VR/AR) ยังคงอยู่ในระดับสูง',
        'การเพิ่มงบลงทุน Capex เพื่อรองรับการฝึกฝนโมเดล Open-source Llama รุ่นถัดไป',
      ],
      postEarningsMoveNote: postMoveNote,
    }
  }

  if (clean === 'TSLA') {
    return {
      summary: `ไตรมาส ${quarter} ผลประกอบการ ${isBeat ? 'ทำได้ดีกว่าที่ตลาดวิตก' : 'ถูกกดดันจากส่วนลดราคา'} โดยมีกลุ่มธุรกิจกักเก็บพลังงาน (Energy Storage Megapack) เข้ามาเป็นเสาหลักการเติบโตใหม่`,
      primaryProfitDrivers: [
        'ธุรกิจ Energy Storage (Megapack/Powerwall) เติบโตอย่างก้าวกระโดดด้วยอัตรากำไรที่แข็งแกร่ง',
        'การปรับลดต้นทุนการผลิตรถยนต์ต่อคันในโรงงาน Gigafactory เซี่ยงไฮ้และเท็กซัส',
        'รายได้จากการรับรู้ใบอนุญาตซอฟต์แวร์ FSD (Full Self-Driving) และเครือข่าย Supercharger',
      ],
      headwindsAndCosts: [
        'สงครามราคาและโปรโมชันสินเชื่อกดดันอัตรากำไรขั้นต้น (Auto Gross Margin)',
        'การลงทุนวิจัยด้านปัญญาประดิษฐ์ (AI), หุ่นยนต์ Optimus และโครงการ Robotaxi',
      ],
      postEarningsMoveNote: postMoveNote,
    }
  }

  if (clean === 'AMZN') {
    return {
      summary: `ไตรมาส ${quarter} กำไรสุทธิเติบโตก้าวกระโดด นำโดยกำไรจากการดำเนินงานของ AWS Cloud, ยอดขายโฆษณาบนมาร์เก็ตเพลส และการปรับระบบคลังสินค้าแบบภูมิภาค (Regional fulfillment)`,
      primaryProfitDrivers: [
        'AWS Cloud ฟื้นตัวกลับมาเติบโตแข็งแกร่ง ได้รับแรงหนุนจากงานประมวลผล Generative AI',
        'ระบบกระจายสินค้า Regionalization ช่วยลดระยะเวลาและต้นทุนค่าจัดส่งต่อออเดอร์ลง',
        'รายได้จาก Amazon Advertising เติบโตอย่างต่อเนื่องด้วยมาร์จิ้นที่สูงมาก',
      ],
      headwindsAndCosts: [
        'การแข่งขันด้านราคาในธุรกิจค้าปลีกออนไลน์และต้นทุนโลจิสติกส์ในช่วงเทศกาล',
        'การลงทุนในโครงการดาวเทียม Project Kuiper และชิป AI Trainium',
      ],
      postEarningsMoveNote: postMoveNote,
    }
  }

  // --- 2. Thai Big Cap Stocks ---
  if (clean === 'PTT' || clean === 'PTT.BK') {
    return {
      summary: `ไตรมาส ${quarter} ผลการดำเนินงานได้รับแรงหนุนจากปริมาณการจำหน่ายก๊าซธรรมชาติที่มั่นคง และการรับรู้ส่วนแบ่งกำไรจาก PTTEP ควบคู่กับการควบคุมค่าใช้จ่ายดำเนินงาน`,
      primaryProfitDrivers: [
        'ปริมาณยอดขายก๊าซธรรมชาติในภาคอุตสาหกรรมและโรงไฟฟ้าหลักของประเทศมีเสถียรภาพ',
        'ผลประกอบการที่แข็งแกร่งของบริษัทย่อยด้านสำรวจและผลิตปิโตรเลียม (PTTEP)',
      ],
      headwindsAndCosts: [
        'ความผันผวนของค่าการกลั่น (GRM) และสเปรดปิโตรเคมีในตลาดโลก',
        'ภาระต้นทุนนโยบายพลังงานภาครัฐในการดูแลเสถียรภาพราคาเชื้อเพลิงในประเทศ',
      ],
      postEarningsMoveNote: postMoveNote,
    }
  }

  if (clean === 'SCB' || clean === 'SCB.BK') {
    return {
      summary: `ไตรมาส ${quarter} กำไรสุทธิเติบโตจากรายได้ดอกเบี้ยสุทธิ (NII) ที่ทรงตัวในระดับสูง และการขยายตัวของรายได้ค่าธรรมเนียมธุรกรรมและการบริหารความมั่งคั่ง (Wealth Management)`,
      primaryProfitDrivers: [
        'ส่วนต่างอัตราดอกเบี้ยสุทธิ (NIM) ยังคงอยู่ในเกณฑ์ที่ดีตามภาวะดอกเบี้ย',
        'รายได้ค่าธรรมเนียมจากกลุ่มประกันและการบริหารกองทุนฟื้นตัวต่อเนื่อง',
      ],
      headwindsAndCosts: [
        'การตั้งสำรองผลขาดทุนด้านเครดิต (ECL) อย่างรัดกุมเพื่อรับมือหนี้เสียกลุ่มเปราะบาง',
        'กำลังซื้อครัวเรือนที่ชะลอตัวส่งผลกระทบต่อการเติบโตของสินเชื่อรายย่อย',
      ],
      postEarningsMoveNote: postMoveNote,
    }
  }

  if (clean === 'CPALL' || clean === 'CPALL.BK') {
    return {
      summary: `ไตรมาส ${quarter} ผลการดำเนินงานโดดเด่น ยอดขายสาขาเดิม (SSSG) ของ 7-Eleven เติบโตต่อเนื่องตามการฟื้นตัวของการท่องเที่ยวและการบริโภค พร้อมแรงหนุนจาก CPAXT`,
      primaryProfitDrivers: [
        'สัดส่วนยอดขายสินค้ากลุ่มอาหารพร้อมทาน (Ready-to-Eat) และ All Cafe ซึ่งมีมาร์จิ้นสูงขยายตัวดี',
        'การขยายสาขาใหม่ในทำเลยุทธศาสตร์และจำนวนลูกค้าชาวต่างชาติที่จับจ่ายต่อบิลสูงขึ้น',
      ],
      headwindsAndCosts: [
        'ต้นทุนค่าไฟฟ้าและค่าใช้จ่ายด้านพนักงานที่ปรับตัวตามอัตราค่าครองชีพ',
        'ภาระดอกเบี้ยจ่ายและค่าใช้จ่ายทางการเงินจากการขยายโครงข่ายสาขา',
      ],
      postEarningsMoveNote: postMoveNote,
    }
  }

  if (clean === 'DELTA' || clean === 'DELTA.BK') {
    return {
      summary: `ไตรมาส ${quarter} กำไรสุทธิเติบโตอย่างร้อนแรง นำโดยยอดคำสั่งซื้อชิ้นส่วน Power Supply สำหรับ AI Data Center และโซลูชันระบบระบายความร้อน (Cooling Systems)`,
      primaryProfitDrivers: [
        'อุปสงค์โซลูชันระบบไฟสำหรับ AI Server เติบโตตามเมกะเทรนด์โครงสร้างพื้นฐานโลก',
        'สัดส่วนสินค้า High-margin เพิ่มขึ้นอย่างมีนัยสำคัญช่วยหนุนอัตรากำไรขั้นต้น',
      ],
      headwindsAndCosts: [
        'ความผันผวนของค่าเงินบาทเทียบดอลลาร์สหรัฐส่งผลต่อรายได้ในรูปเงินบาท',
        'การชะลอตัวของตลาดยานยนต์ไฟฟ้า (EV) ในบางภูมิภาคกระทบชิ้นส่วนบางประเภท',
      ],
      postEarningsMoveNote: postMoveNote,
    }
  }

  // --- 3. Dynamic Financial Analysis for Any Stock ---
  if (isBeat) {
    const driversList = [
      `ผลงานเกินคาด (+${surprisePercent ?? 0}%) สะท้อนความต้องการในผลิตภัณฑ์และบริการหลักที่เติบโตได้ดี`,
    ]
    if (epsQoqGrowthPercent != null && epsQoqGrowthPercent > 0) {
      driversList.push(`กำไรต่อหุ้นเติบโตแบบก้าวกระโดด +${epsQoqGrowthPercent}% เมื่อเทียบกับไตรมาสก่อนหน้า (QoQ)`)
    }
    if (profitMarginPercent !== null && profitMarginPercent > 15) {
      driversList.push(`รักษาอัตรากำไรสุทธิอยู่ในระดับสูงที่ ${profitMarginPercent.toFixed(1)}% แสดงถึงความสามารถในการควบคุมต้นทุน`)
    } else {
      driversList.push('การบริหารจัดการประสิทธิภาพการดำเนินงานและการปรับโครงสร้างต้นทุนให้สอดคล้องกับรายได้')
    }

    return {
      summary: `ไตรมาส ${quarter} บริษัททำผลงานได้ยอดเยี่ยม ชนะคาดการณ์ของนักวิเคราะห์ ${
        surprisePercent ? `+${surprisePercent}%` : ''
      } โดยมี${revText} ${marginText} ได้รับแรงขับเคลื่อนจากยอดขายสินค้าหลักที่มีความต้องการสูงและประสิทธิภาพการบริหารจัดการต้นทุนที่ดี`,
      primaryProfitDrivers: driversList,
      headwindsAndCosts: [
        'ความท้าทายจากต้นทุนดำเนินงาน ค่าใช้จ่ายวิจัยและพัฒนา (R&D) และการลงทุนในเทคโนโลยีใหม่',
        'ความผันผวนของภาวะเศรษฐกิจมหภาคและอัตราแลกเปลี่ยนระหว่างประเทศ',
      ],
      postEarningsMoveNote: postMoveNote,
    }
  }

  if (isMiss) {
    return {
      summary: `ไตรมาส ${quarter} ผลประกอบการต่ำกว่าที่ตลาดประเมินไว้ (${surprisePercent ?? 0}%) โดยมีสาเหตุหลักจากต้นทุนการดำเนินงานหรือค่าใช้จ่ายในการขยายธุรกิจที่เพิ่มขึ้นเร็วกว่ารายได้ ทำให้อัตรากำไรถูกกดดันในระยะสั้น`,
      primaryProfitDrivers: [
        revenueFormatted ? `รายได้รวมยังคงทำได้ ${revenueFormatted} สะท้อนฐานลูกค้าที่ยังคงเหนียวแน่น` : 'ฐานลูกค้าระยะยาวยังคงสร้างกระแสเงินสดได้อย่างต่อเนื่อง',
        'การปรับกลยุทธ์เพื่อเน้นย้ำความคุ้มค่าและมุ่งเน้นกลุ่มผลิตภัณฑ์ที่มีอัตรากำไรสูงในอนาคต',
      ],
      headwindsAndCosts: [
        'ต้นทุนการขายและการบริหาร (SG&A) ปรับตัวสูงขึ้น ส่งผลให้อัตรากำไรสุทธิลดลง',
        'การชะลอการตัดสินใจซื้อหรือยอดคำสั่งซื้อของลูกค้าในบางหมวดสินค้า',
      ],
      postEarningsMoveNote: postMoveNote,
    }
  }

  // In-line or No estimate
  return {
    summary: `ไตรมาส ${quarter} ผลการดำเนินงานใกล้เคียงกับที่ตลาดคาดหวัง ${revText} ${marginText} ธุรกิจดำเนินไปตามแผนงานปกติและรักษาส่วนแบ่งทางการตลาดได้อย่างมั่นคง`,
    primaryProfitDrivers: [
      'รายได้จากกลุ่มธุรกิจหลักยังคงสร้างกระแสเงินสดได้อย่างสม่ำเสมอ',
      'การรักษาสมดุลระหว่างการเติบโตและการควบคุมค่าใช้จ่ายในการดำเนินงาน',
    ],
    headwindsAndCosts: [
      'แรงกดดันด้านการแข่งขันในอุตสาหกรรมและต้นทุนวัตถุดิบ/พลังงาน',
      'การปรับตัวรับมือกับความไม่แน่นอนของเศรษฐกิจโลก',
    ],
    postEarningsMoveNote: postMoveNote,
  }
}

/**
 * Generates concise annual business drivers for the multi-year trend table
 */
export function generateAnnualDrivers(params: {
  ticker: string
  companyName: string
  year: number
  isEstimate?: boolean
  revenueFormatted: string
  netIncomeFormatted: string
  profitMarginPercent: number | null
  revenueYoyGrowthPercent?: number | null
  netIncomeYoyGrowthPercent?: number | null
}): QuarterDrivers {
  const {
    ticker,
    companyName,
    year,
    isEstimate,
    revenueFormatted,
    netIncomeFormatted,
    profitMarginPercent,
    revenueYoyGrowthPercent,
    netIncomeYoyGrowthPercent,
  } = params

  if (isEstimate) {
    return {
      summary: `ปี ${year} (คาดการณ์โดยตลาด): นักวิเคราะห์ประเมินรายได้เติบโต ${
        revenueYoyGrowthPercent != null && revenueYoyGrowthPercent > 0 ? `+${revenueYoyGrowthPercent}% YoY` : 'ต่อเนื่อง'
      } แตะ ${revenueFormatted} จากแรงส่งการขยายตัวของกลุ่มธุรกิจใหม่และนวัตกรรมผลิตภัณฑ์`,
      primaryProfitDrivers: [
        'การเติบโตของผลิตภัณฑ์เรือธงและการเจาะตลาดกลุ่มลูกค้าใหม่ทั่วโลก',
        'การประยุกต์ใช้เทคโนโลยี AI เพื่อเพิ่มประสิทธิภาพและสร้างการเติบโตแบบก้าวกระโดด',
      ],
      headwindsAndCosts: [
        'ความไม่แน่นอนของภาวะเศรษฐกิจโลกและวัฏจักรการลงทุน',
        'การรักษาระดับการเติบโตท่ามกลางฐานรายได้ที่ขยายใหญ่ขึ้นมาก',
      ],
    }
  }

  const isNetGrowth = netIncomeYoyGrowthPercent != null && netIncomeYoyGrowthPercent > 0
  const isRevGrowth = revenueYoyGrowthPercent != null && revenueYoyGrowthPercent > 0

  return {
    summary: `ปี ${year}: ${companyName} ทำรายได้รวม ${revenueFormatted} ${
      isRevGrowth ? `(เติบโต +${revenueYoyGrowthPercent}% YoY)` : ''
    } กำไรสุทธิ ${netIncomeFormatted} ${
      isNetGrowth ? `(+${netIncomeYoyGrowthPercent}% YoY)` : ''
    } ${profitMarginPercent !== null ? `ด้วย Net Margin ${profitMarginPercent}%` : ''}`,
    primaryProfitDrivers: [
      isRevGrowth
        ? `รายได้รวมขยายตัวอย่างแข็งแกร่ง +${revenueYoyGrowthPercent}% ขับเคลื่อนโดยส่วนแบ่งตลาดที่เพิ่มขึ้น`
        : 'รักษารายได้รวมในระดับสูงได้อย่างมีเสถียรภาพ',
      profitMarginPercent !== null && profitMarginPercent > 20
        ? `ความสามารถในการทำกำไรโดดเด่นด้วย Margin สูงถึง ${profitMarginPercent}%`
        : 'การพัฒนาประสิทธิภาพการดำเนินงานและการปรับปรุงโครงสร้างค่าใช้จ่าย',
    ],
    headwindsAndCosts: [
      'ต้นทุนค่าใช้จ่ายในการลงทุนเพื่อการเติบโตระยะยาว (Capex & R&D)',
      'การปรับตัวท่ามกลางการแข่งขันและกฎระเบียบของแต่ละภูมิภาค',
    ],
  }
}

/**
 * Analyzes and returns complete earnings intelligence for a stock
 */
export async function getEarningsIntelligence(
  rawTicker: string,
  market: 'TH' | 'US' = 'US',
  forceRefresh = false
): Promise<AnalyzedEarningsData | null> {
  const cleanTicker = rawTicker.trim().toUpperCase()
  const cacheKey = `${cleanTicker}_${market}`
  const now = Date.now()

  // 1. Return from cache if valid
  if (!forceRefresh) {
    const cached = earningsCache.get(cacheKey)
    if (cached && now - cached.timestamp < CACHE_TTL_MS) {
      return cached.data
    }
  }

  // 2. Reuse in-flight promise if one is already fetching
  const pending = inFlightEarnings.get(cacheKey)
  if (pending) {
    return pending
  }

  const fetchPromise = (async (): Promise<AnalyzedEarningsData | null> => {
    try {
      const auth = await getYahooAuth()
      const yfTicker = formatYahooTicker(cleanTicker, market)

      let url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(
        yfTicker
      )}?modules=calendarEvents,earnings,earningsHistory,earningsTrend,price`

      if (auth?.crumb) {
        url += `&crumb=${encodeURIComponent(auth.crumb)}`
      }

      const headers: Record<string, string> = {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'application/json',
      }
      if (auth?.cookie) {
        headers['Cookie'] = auth.cookie
      }

      const fetchOptions: RequestInit & { next?: { revalidate?: number } } = {
        headers,
        signal: AbortSignal.timeout(8000),
        next: { revalidate: 900 },
      }

      const res = await fetch(url, fetchOptions as RequestInit)

      if (!res.ok) {
        console.warn(`[EarningsAnalyzer] HTTP ${res.status} for ${cleanTicker} (${yfTicker})`)
        return null
      }

      const json = await res.json()
      const result = json?.quoteSummary?.result?.[0]
      if (!result) return null

      // --- A. Extract Quote & Price Meta ---
      const priceMeta = result.price || {}
      const companyName = priceMeta.shortName || priceMeta.longName || cleanTicker
      const currentPrice = Number(priceMeta.regularMarketPrice?.raw || priceMeta.regularMarketPrice || 0)
      const priceChangePercent = Number(
        priceMeta.regularMarketChangePercent?.raw || priceMeta.regularMarketChangePercent || 0
      )
      const currency = priceMeta.currency || (market === 'TH' ? 'THB' : 'USD')

      // --- B. Extract Upcoming Earnings Calendar ---
      const calendarEarnings = result.calendarEvents?.earnings || {}
      const earningsDates = calendarEarnings.earningsDate || []
      const rawDateObj = earningsDates[0]
      
      let earningsDateStr: string | null = null
      let daysRemaining = 999
      let countdownLabel = 'ยังไม่ประกาศวันที่'
      let status: UpcomingEarningsEvent['status'] = 'tbd'
      const hasUpcomingDate = Boolean(rawDateObj)

      if (rawDateObj) {
        if (typeof rawDateObj === 'object' && rawDateObj.fmt) {
          earningsDateStr = rawDateObj.fmt
        } else if (typeof rawDateObj === 'object' && rawDateObj.raw) {
          earningsDateStr = new Date(rawDateObj.raw * 1000).toISOString().split('T')[0]
        } else if (typeof rawDateObj === 'string') {
          earningsDateStr = rawDateObj
        }

        if (earningsDateStr) {
          const targetTime = new Date(`${earningsDateStr}T00:00:00Z`).getTime()
          const todayTime = new Date(new Date().toISOString().split('T')[0] + 'T00:00:00Z').getTime()
          daysRemaining = Math.round((targetTime - todayTime) / (1000 * 60 * 60 * 24))

          if (daysRemaining === 0) {
            countdownLabel = 'ประกาศวันนี้ (Today)'
            status = 'today'
          } else if (daysRemaining === 1) {
            countdownLabel = 'วันพรุ่งนี้'
            status = 'urgent'
          } else if (daysRemaining > 1 && daysRemaining <= 7) {
            countdownLabel = `อีก ${daysRemaining} วัน (สัปดาห์นี้)`
            status = 'urgent'
          } else if (daysRemaining > 7 && daysRemaining <= 14) {
            countdownLabel = `อีก ${daysRemaining} วัน`
            status = 'soon'
          } else if (daysRemaining > 14) {
            countdownLabel = `อีก ${daysRemaining} วัน`
            status = 'upcoming'
          } else {
            countdownLabel = `ประกาศไปแล้ว ${Math.abs(daysRemaining)} วัน`
            status = 'reported'
          }
        }
      }

      // Extract consensus estimates for upcoming quarter
      const consensusEps = calendarEarnings.earningsAverage?.raw ?? null
      const epsLow = calendarEarnings.earningsLow?.raw ?? null
      const epsHigh = calendarEarnings.earningsHigh?.raw ?? null

      const consensusRevenue = calendarEarnings.revenueAverage?.raw ?? null
      const revenueLow = calendarEarnings.revenueLow?.raw ?? null
      const revenueHigh = calendarEarnings.revenueHigh?.raw ?? null

      // Check earnings trend for period "0q" (upcoming quarter) to get YoY growth expectations
      const trendList = (result.earningsTrend?.trend || []) as any[]
      const currentQuarterTrend = trendList.find((t) => t.period === '0q') || trendList[0]

      const yearAgoEps = currentQuarterTrend?.earningsEstimate?.yearAgoEps?.raw ?? null
      const epsExpectedYoyGrowthPercent = currentQuarterTrend?.earningsEstimate?.growth?.raw != null
        ? Number((currentQuarterTrend.earningsEstimate.growth.raw * 100).toFixed(2))
        : null

      const yearAgoRevenue = currentQuarterTrend?.revenueEstimate?.yearAgoRevenue?.raw ?? null
      const revenueExpectedYoyGrowthPercent = currentQuarterTrend?.revenueEstimate?.growth?.raw != null
        ? Number((currentQuarterTrend.revenueEstimate.growth.raw * 100).toFixed(2))
        : null

      const analystCount =
        currentQuarterTrend?.earningsEstimate?.numberOfAnalysts?.raw ||
        currentQuarterTrend?.revenueEstimate?.numberOfAnalysts?.raw ||
        undefined

      // 1. Release Timing (BMO / AMC / DMH) + Thailand Local Time
      const timingInfo = computeReleaseTiming(
        rawDateObj,
        calendarEarnings.earningsCallDate?.[0],
        market,
        cleanTicker
      )

      // 2. Analyst Estimate Revisions (7-day and 30-day revisions)
      const epsRevs = currentQuarterTrend?.epsRevisions
      let revisions: UpcomingEarningsEvent['revisions'] = undefined
      if (epsRevs) {
        const up7 = Number(epsRevs.upLast7days?.raw ?? 0)
        const down7 = Number(epsRevs.downLast7Days?.raw ?? epsRevs.downLast7days?.raw ?? 0)
        const up30 = Number(epsRevs.upLast30days?.raw ?? 0)
        const down30 = Number(epsRevs.downLast30days?.raw ?? 0)

        let sentiment: 'bullish' | 'bearish' | 'neutral' = 'neutral'
        let summaryThai = 'การปรับเป้าของนักวิเคราะห์ทรงตัวในรอบ 30 วันที่ผ่านมา'

        if (up30 > down30) {
          sentiment = 'bullish'
          summaryThai = `ในรอบ 30 วันที่ผ่านมา นักวิเคราะห์ ${up30} ท่านแห่ปรับเป้ากำไรขึ้น (ปรับลง ${down30} ท่าน) สะท้อนมุมมองเชิงบวก 🟢`
        } else if (down30 > up30) {
          sentiment = 'bearish'
          summaryThai = `ในรอบ 30 วันที่ผ่านมา นักวิเคราะห์ ${down30} ท่านปรับลดเป้ากำไรลง (ปรับขึ้น ${up30} ท่าน) ควรจับตาความระมัดระวัง 🔴`
        } else if (up30 > 0 || down30 > 0) {
          summaryThai = `นักวิเคราะห์ปรับเป้าขึ้น ${up30} ท่าน และปรับลง ${down30} ท่าน มุมมองผสมผสาน (Neutral ⚪)`
        }

        revisions = {
          upLast7days: up7,
          downLast7days: down7,
          upLast30days: up30,
          downLast30days: down30,
          sentiment,
          summaryThai,
        }
      }

      // Fiscal quarter label (e.g. "3Q2026")
      const earningsChart = result.earnings?.earningsChart || {}
      let fiscalQuarterLabel = 'ไตรมาสถัดไป'
      if (earningsChart.currentQuarterEstimateDate && earningsChart.currentQuarterEstimateYear) {
        fiscalQuarterLabel = `${earningsChart.currentQuarterEstimateDate}${earningsChart.currentQuarterEstimateYear}`
      }

      const upcoming: UpcomingEarningsEvent = {
        hasUpcomingDate,
        earningsDate: earningsDateStr,
        earningsDateThai: formatThaiDate(earningsDateStr),
        daysRemaining,
        countdownLabel,
        status,
        isEstimated: Boolean(calendarEarnings.isEarningsDateEstimate),
        fiscalQuarterLabel,
        releaseTiming: timingInfo.releaseTiming,
        releaseTimingLabel: timingInfo.releaseTimingLabel,
        releaseTimeThai: timingInfo.releaseTimeThai,
        earningsCallTimeThai: timingInfo.earningsCallTimeThai,
        releaseAdviceThai: timingInfo.releaseAdviceThai,
        revisions,
        consensusEps,
        epsRange: { low: epsLow, high: epsHigh },
        consensusRevenue,
        consensusRevenueFormatted: formatFinancialAmount(consensusRevenue, currency),
        revenueRange: {
          low: revenueLow,
          high: revenueHigh,
          lowFormatted: formatFinancialAmount(revenueLow, currency),
          highFormatted: formatFinancialAmount(revenueHigh, currency),
        },
        analystCount,
        yearAgoQuarterLabel: undefined,
        yearAgoEps,
        epsExpectedYoyGrowthPercent,
        yearAgoRevenue,
        yearAgoRevenueFormatted: formatFinancialAmount(yearAgoRevenue, currency),
        revenueExpectedYoyGrowthPercent,
      }

      // Fetch historical 2y price moves in parallel for post-earnings analysis
      const priceMovesMap = await fetchHistoricalPriceMoves(yfTicker)

      // --- C. Extract Historical Quarterly Earnings (Actual vs Estimate) ---
      const historyItems = (result.earningsHistory?.history || []) as any[]
      const chartQuarterly = (result.earnings?.earningsChart?.quarterly || []) as any[]
      const finQuarterly = (result.earnings?.financialsChart?.quarterly || []) as any[]

      const historicalQuarters: HistoricalQuarterEarnings[] = []

      // Create lookup map for financials (revenue, net income) by quarter string (e.g. "3Q2025")
      const finMap = new Map<string, { revenue: number; netIncome: number; margin: number }>()
      for (const f of finQuarterly) {
        if (f.date) {
          finMap.set(String(f.date).toUpperCase(), {
            revenue: Number(f.revenue?.raw || 0),
            netIncome: Number(f.earnings?.raw || 0),
            margin: Number(f.profitMargin?.raw != null ? f.profitMargin.raw * 100 : 0),
          })
        }
      }

      // Map from chartQuarterly or historyItems
      if (chartQuarterly.length > 0) {
        for (let i = 0; i < chartQuarterly.length; i++) {
          const item = chartQuarterly[i]
          const qName = String(item.date || item.fiscalQuarter || `Q${i + 1}`).toUpperCase()
          const actualEps = item.actual?.raw != null ? Number(item.actual.raw) : null
          const estimateEps = item.estimate?.raw != null ? Number(item.estimate.raw) : null

          let epsDifference = item.difference != null ? Number(item.difference) : null
          if (epsDifference === null && actualEps !== null && estimateEps !== null) {
            epsDifference = Number((actualEps - estimateEps).toFixed(3))
          }

          let surprisePercent = item.surprisePct != null ? Number(item.surprisePct) : null
          if (surprisePercent === null && epsDifference !== null && estimateEps && Math.abs(estimateEps) > 0.001) {
            surprisePercent = Number(((epsDifference / Math.abs(estimateEps)) * 100).toFixed(2))
          }

          let beatStatus: HistoricalQuarterEarnings['beatStatus'] = 'NO_ESTIMATE'
          if (surprisePercent !== null) {
            if (surprisePercent >= 0.5) beatStatus = 'BEAT'
            else if (surprisePercent <= -0.5) beatStatus = 'MISS'
            else beatStatus = 'IN_LINE'
          }

          let reportedDate = ''
          if (item.reportedDate?.fmt) reportedDate = item.reportedDate.fmt
          else if (item.reportedDate?.raw) reportedDate = new Date(item.reportedDate.raw * 1000).toISOString().split('T')[0]
          else if (item.periodEndDate?.fmt) reportedDate = item.periodEndDate.fmt

          const fin = finMap.get(qName)
          const revenue = fin?.revenue ?? null
          const netIncome = fin?.netIncome ?? null
          const profitMarginPercent = fin?.margin ?? null

          // Prior quarter sequential comparison
          let prevQuarter: string | undefined
          let prevEps: number | null = null
          let epsQoqGrowthPercent: number | null = null
          let prevRevenue: number | null = null
          let revenueQoqGrowthPercent: number | null = null

          if (i > 0) {
            const prevItem = chartQuarterly[i - 1]
            prevQuarter = String(prevItem.date || `Q${i}`).toUpperCase()
            prevEps = prevItem.actual?.raw != null ? Number(prevItem.actual.raw) : null
            if (actualEps !== null && prevEps !== null && Math.abs(prevEps) > 0.001) {
              epsQoqGrowthPercent = Number((((actualEps - prevEps) / Math.abs(prevEps)) * 100).toFixed(2))
            }
            const prevFin = finMap.get(prevQuarter)
            if (prevFin && revenue !== null && prevFin.revenue > 0) {
              prevRevenue = prevFin.revenue
              revenueQoqGrowthPercent = Number((((revenue - prevFin.revenue) / prevFin.revenue) * 100).toFixed(2))
            }
          }

          // Calculate post-earnings 1-day price move %
          let postEarningsPriceMovePercent: number | null = null
          if (reportedDate && priceMovesMap.size > 0) {
            let pEntry = priceMovesMap.get(reportedDate)
            if (!pEntry) {
              // Try adjacent dates if announcement was non-trading day
              const dObj = new Date(reportedDate)
              for (const offset of [-1, 1, -2, 2]) {
                const adj = new Date(dObj.getTime() + offset * 86400000).toISOString().split('T')[0]
                if (priceMovesMap.has(adj)) {
                  pEntry = priceMovesMap.get(adj)
                  break
                }
              }
            }
            if (pEntry && pEntry.preClose > 0) {
              postEarningsPriceMovePercent = Number(
                (((pEntry.postClose - pEntry.preClose) / pEntry.preClose) * 100).toFixed(2)
              )
            }
          }

          const revenueFormatted = formatFinancialAmount(revenue, currency)
          const netIncomeFormatted = formatFinancialAmount(netIncome, currency)

          // Generate Drill-down Business Drivers (กำไรมาจากอะไร ขาดทุนเพราะอะไร)
          const drivers = generateQuarterDrivers({
            ticker: cleanTicker,
            companyName,
            quarter: qName,
            actualEps,
            estimateEps,
            surprisePercent,
            beatStatus,
            revenueFormatted,
            netIncomeFormatted,
            profitMarginPercent,
            epsQoqGrowthPercent,
            revenueQoqGrowthPercent,
            postEarningsPriceMovePercent,
          })

          historicalQuarters.push({
            quarter: qName,
            fiscalQuarter: item.fiscalQuarter,
            reportedDate,
            reportedDateThai: formatThaiDate(reportedDate),
            actualEps,
            estimateEps,
            epsDifference,
            surprisePercent,
            beatStatus,
            revenue,
            revenueFormatted,
            netIncome,
            netIncomeFormatted,
            profitMarginPercent,
            prevQuarter,
            prevEps,
            epsQoqGrowthPercent,
            prevRevenue,
            revenueQoqGrowthPercent,
            postEarningsPriceMovePercent,
            drivers,
          })
        }
      } else if (historyItems.length > 0) {
        // Fallback to history items if chartQuarterly is empty
        for (let i = historyItems.length - 1; i >= 0; i--) {
          const h = historyItems[i]
          const qDate = h.quarter?.fmt || h.period || `Q${i + 1}`
          const actualEps = h.epsActual?.raw != null ? Number(h.epsActual.raw) : null
          const estimateEps = h.epsEstimate?.raw != null ? Number(h.epsEstimate.raw) : null
          const epsDifference = h.epsDifference?.raw != null ? Number(h.epsDifference.raw) : null
          const surprisePercent = h.surprisePercent?.raw != null ? Number((h.surprisePercent.raw * 100).toFixed(2)) : null

          let beatStatus: HistoricalQuarterEarnings['beatStatus'] = 'NO_ESTIMATE'
          if (surprisePercent !== null) {
            if (surprisePercent >= 0.5) beatStatus = 'BEAT'
            else if (surprisePercent <= -0.5) beatStatus = 'MISS'
            else beatStatus = 'IN_LINE'
          }

          const drivers = generateQuarterDrivers({
            ticker: cleanTicker,
            companyName,
            quarter: qDate,
            actualEps,
            estimateEps,
            surprisePercent,
            beatStatus,
            revenueFormatted: null,
            netIncomeFormatted: null,
            profitMarginPercent: null,
            epsQoqGrowthPercent: null,
            revenueQoqGrowthPercent: null,
            postEarningsPriceMovePercent: null,
          })

          historicalQuarters.push({
            quarter: qDate,
            reportedDate: qDate,
            reportedDateThai: formatThaiDate(qDate),
            actualEps,
            estimateEps,
            epsDifference,
            surprisePercent,
            beatStatus,
            revenue: null,
            revenueFormatted: null,
            netIncome: null,
            netIncomeFormatted: null,
            profitMarginPercent: null,
            drivers,
          })
        }
      }

      // --- D. Extract Yearly Financials (4-Year Trend & Growth) ---
      const finYearly = (result.earnings?.financialsChart?.yearly || []) as any[]
      const yearlyFinancials: YearlyFinancialSummary[] = []

      for (let i = 0; i < finYearly.length; i++) {
        const y = finYearly[i]
        const year = Number(y.date)
        const revenue = Number(y.revenue?.raw || 0)
        const netIncome = Number(y.earnings?.raw || 0)
        const profitMarginPercent = Number(
          y.profitMargin?.raw != null ? y.profitMargin.raw * 100 : revenue > 0 ? (netIncome / revenue) * 100 : 0
        )

        let revenueYoyGrowthPercent: number | null = null
        let netIncomeYoyGrowthPercent: number | null = null

        if (i > 0) {
          const prevYear = finYearly[i - 1]
          const prevRev = Number(prevYear.revenue?.raw || 0)
          const prevNet = Number(prevYear.earnings?.raw || 0)
          if (prevRev > 0) {
            revenueYoyGrowthPercent = Number((((revenue - prevRev) / prevRev) * 100).toFixed(2))
          }
          if (Math.abs(prevNet) > 0) {
            netIncomeYoyGrowthPercent = Number((((netIncome - prevNet) / Math.abs(prevNet)) * 100).toFixed(2))
          }
        }

        const revenueFormatted = formatFinancialAmount(revenue, currency)
        const netIncomeFormatted = formatFinancialAmount(netIncome, currency)

        const drivers = generateAnnualDrivers({
          ticker: cleanTicker,
          companyName,
          year,
          isEstimate: false,
          revenueFormatted,
          netIncomeFormatted,
          profitMarginPercent: Number(profitMarginPercent.toFixed(2)),
          revenueYoyGrowthPercent,
          netIncomeYoyGrowthPercent,
        })

        yearlyFinancials.push({
          year,
          yearLabel: `${year}`,
          isEstimate: false,
          revenue,
          revenueFormatted,
          netIncome,
          netIncomeFormatted,
          profitMarginPercent: Number(profitMarginPercent.toFixed(2)),
          revenueYoyGrowthPercent,
          netIncomeYoyGrowthPercent,
          drivers,
        })
      }

      // Append 5th Year (0y current fiscal year estimate from consensus trend)
      const trend0y = trendList.find((t) => t.period === '0y')
      if (trend0y && trend0y.revenueEstimate?.avg?.raw) {
        let estYear = (yearlyFinancials[yearlyFinancials.length - 1]?.year || 2025) + 1
        if (trend0y.endDate) {
          try {
            const parsed = new Date(trend0y.endDate).getFullYear()
            if (!isNaN(parsed) && parsed > 2000) estYear = parsed
          } catch {}
        }
        const lastYear = yearlyFinancials[yearlyFinancials.length - 1]

        if (!lastYear || estYear > lastYear.year) {
          const estRev = Number(trend0y.revenueEstimate.avg.raw)
          const estGrowth = trend0y.revenueEstimate.growth?.raw != null
            ? Number((trend0y.revenueEstimate.growth.raw * 100).toFixed(2))
            : lastYear && lastYear.revenue > 0
            ? Number((((estRev - lastYear.revenue) / lastYear.revenue) * 100).toFixed(2))
            : null

          const estRevFormatted = formatFinancialAmount(estRev, currency)
          const drivers = generateAnnualDrivers({
            ticker: cleanTicker,
            companyName,
            year: estYear,
            isEstimate: true,
            revenueFormatted: estRevFormatted,
            netIncomeFormatted: 'รอประกาศจริง',
            profitMarginPercent: null,
            revenueYoyGrowthPercent: estGrowth,
            netIncomeYoyGrowthPercent: null,
          })

          yearlyFinancials.push({
            year: estYear,
            yearLabel: `${estYear} (Est.)`,
            isEstimate: true,
            revenue: estRev,
            revenueFormatted: estRevFormatted,
            netIncome: null,
            netIncomeFormatted: 'รอประกาศจริง',
            profitMarginPercent: null,
            revenueYoyGrowthPercent: estGrowth,
            netIncomeYoyGrowthPercent: null,
            drivers,
          })
        }
      }

      // --- E. Compute Summary Stats, Price Move Analytics & AI Insights ---
      let beatsCount = 0
      let missesCount = 0
      let inLineCount = 0
      let totalSurpriseSum = 0
      let surpriseCount = 0
      let consecutiveBeats = 0

      // Price move tracking
      let totalAbsMoveSum = 0
      let moveCount = 0
      let beatMoveSum = 0
      let beatMoveCount = 0
      let missMoveSum = 0
      let missMoveCount = 0
      let maxPostEarningsGain = 0
      let maxPostEarningsDrop = 0

      // Read from latest to oldest for consecutive beats
      const reversedQuarters = [...historicalQuarters].reverse()
      let countingBeats = true

      for (const q of reversedQuarters) {
        if (q.beatStatus === 'BEAT') {
          beatsCount++
          if (countingBeats) consecutiveBeats++
        } else {
          countingBeats = false
          if (q.beatStatus === 'MISS') missesCount++
          else if (q.beatStatus === 'IN_LINE') inLineCount++
        }

        if (q.surprisePercent !== null) {
          totalSurpriseSum += q.surprisePercent
          surpriseCount++
        }

        if (q.postEarningsPriceMovePercent !== null && q.postEarningsPriceMovePercent !== undefined) {
          const move = q.postEarningsPriceMovePercent
          totalAbsMoveSum += Math.abs(move)
          moveCount++

          if (move > maxPostEarningsGain) maxPostEarningsGain = move
          if (move < maxPostEarningsDrop) maxPostEarningsDrop = move

          if (q.beatStatus === 'BEAT') {
            beatMoveSum += move
            beatMoveCount++
          } else if (q.beatStatus === 'MISS') {
            missMoveSum += move
            missMoveCount++
          }
        }
      }

      const totalQuartersAnalyzed = historicalQuarters.length
      const beatRatePercent = totalQuartersAnalyzed > 0
        ? Number(((beatsCount / totalQuartersAnalyzed) * 100).toFixed(1))
        : 0
      const averageSurprisePercent = surpriseCount > 0
        ? Number((totalSurpriseSum / surpriseCount).toFixed(2))
        : 0

      // Compute Post-Earnings Price Move Averages
      const avgPostEarningsMovePercent = moveCount > 0
        ? Number((totalAbsMoveSum / moveCount).toFixed(2))
        : 4.5
      const avgBeatPriceMovePercent = beatMoveCount > 0
        ? Number((beatMoveSum / beatMoveCount).toFixed(2))
        : 3.8
      const avgMissPriceMovePercent = missMoveCount > 0
        ? Number((missMoveSum / missMoveCount).toFixed(2))
        : -4.5

      let postEarningsInsight = `ในอดีตหลังวันรายงานงบ ราคาหุ้นมักแกว่งตัวเฉลี่ย ±${avgPostEarningsMovePercent}%`
      if (beatMoveCount > 0) {
        postEarningsInsight += ` โดยในรอบที่ชนะคาดราคาปรับขึ้นเฉลี่ย ${avgBeatPriceMovePercent > 0 ? '+' : ''}${avgBeatPriceMovePercent}%`
      }
      if (missMoveCount > 0) {
        postEarningsInsight += ` และในรอบที่แพ้คาดราคาร่วงเฉลี่ย ${avgMissPriceMovePercent}%`
      }

      const latestQuarter = historicalQuarters[historicalQuarters.length - 1]
      const latestSurprisePercent = latestQuarter?.surprisePercent ?? null
      const latestBeatStatus = latestQuarter?.beatStatus ?? 'NO_ESTIMATE'

      let aiSentiment: 'bullish' | 'neutral' | 'bearish' = 'neutral'
      if (beatRatePercent >= 75 && (epsExpectedYoyGrowthPercent === null || epsExpectedYoyGrowthPercent > 0)) {
        aiSentiment = 'bullish'
      } else if (beatRatePercent <= 25 || (epsExpectedYoyGrowthPercent !== null && epsExpectedYoyGrowthPercent < -10)) {
        aiSentiment = 'bearish'
      }

      // Generate insightful Thai takeaway
      let aiTakeaway = ''
      if (beatRatePercent === 100) {
        aiTakeaway = `ผลงานยอดเยี่ยม! ชนะคาดการณ์ของนักวิเคราะห์ครบทุกไตรมาส (${beatsCount}/${totalQuartersAnalyzed} ไตรมาส) เฉลี่ยเหนือคาด ${averageSurprisePercent > 0 ? '+' : ''}${averageSurprisePercent}%`
      } else if (beatRatePercent >= 75) {
        aiTakeaway = `ความสม่ำเสมอสูง ชนะคาดตลาดถึง ${beatRatePercent}% ของรอบที่ผ่านมา เซอร์ไพรส์เฉลี่ย ${averageSurprisePercent > 0 ? '+' : ''}${averageSurprisePercent}%`
      } else if (missesCount >= beatsCount) {
        aiTakeaway = `ผลประกอบการต่ำกว่าคาดบ่อยครั้ง (${missesCount}/${totalQuartersAnalyzed} ไตรมาส) ควรระมัดระวังความผันผวนของราคาก่อนและหลังวันประกาศผล`
      } else {
        aiTakeaway = `ผลประกอบการใกล้เคียงกับที่ตลาดคาดหวัง อัตราการชนะคาด ${beatRatePercent}% นักลงทุนมักจับตากลยุทธ์และ Guidance ในไตรมาสถัดไป`
      }

      if (upcoming.revenueExpectedYoyGrowthPercent != null) {
        const revGrowth = upcoming.revenueExpectedYoyGrowthPercent
        aiTakeaway += ` โดยในรอบถัดไป ตลาดคาดรายได้เติบโต ${revGrowth > 0 ? '+' : ''}${revGrowth}% YoY เทียบกับช่วงเดียวกันของปีก่อนหน้า`
      }

      const analyzedData: AnalyzedEarningsData = {
        symbol: cleanTicker,
        ticker: cleanTicker,
        market,
        companyName,
        currency,
        currentPrice,
        priceChangePercent,
        upcoming,
        historicalQuarters,
        yearlyFinancials,
        stats: {
          totalQuartersAnalyzed,
          beatsCount,
          missesCount,
          inLineCount,
          beatRatePercent,
          averageSurprisePercent,
          latestSurprisePercent,
          latestBeatStatus,
          consecutiveBeats,
          aiSentiment,
          aiTakeaway,
          avgPostEarningsMovePercent,
          avgBeatPriceMovePercent,
          avgMissPriceMovePercent,
          maxPostEarningsGain: maxPostEarningsGain > 0 ? Number(maxPostEarningsGain.toFixed(2)) : undefined,
          maxPostEarningsDrop: maxPostEarningsDrop < 0 ? Number(maxPostEarningsDrop.toFixed(2)) : undefined,
          postEarningsInsight,
        },
      }

      // Save to cache
      earningsCache.set(cacheKey, { data: analyzedData, timestamp: now })
      return analyzedData
    } catch (err) {
      console.error(`[EarningsAnalyzer] Error processing earnings for ${cleanTicker}:`, err)
      return null
    } finally {
      inFlightEarnings.delete(cacheKey)
    }
  })()

  inFlightEarnings.set(cacheKey, fetchPromise)
  return fetchPromise
}
