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

  // 2. Historical Quarters (Actual vs Consensus)
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
            revenueFormatted: formatFinancialAmount(revenue, currency),
            netIncome,
            netIncomeFormatted: formatFinancialAmount(netIncome, currency),
            profitMarginPercent,
            prevQuarter,
            prevEps,
            epsQoqGrowthPercent,
            prevRevenue,
            revenueQoqGrowthPercent,
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

        yearlyFinancials.push({
          year,
          yearLabel: `${year}`,
          isEstimate: false,
          revenue,
          revenueFormatted: formatFinancialAmount(revenue, currency),
          netIncome,
          netIncomeFormatted: formatFinancialAmount(netIncome, currency),
          profitMarginPercent: Number(profitMarginPercent.toFixed(2)),
          revenueYoyGrowthPercent,
          netIncomeYoyGrowthPercent,
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

          yearlyFinancials.push({
            year: estYear,
            yearLabel: `${estYear} (Est.)`,
            isEstimate: true,
            revenue: estRev,
            revenueFormatted: formatFinancialAmount(estRev, currency),
            netIncome: null,
            netIncomeFormatted: 'รอประกาศจริง',
            profitMarginPercent: null,
            revenueYoyGrowthPercent: estGrowth,
            netIncomeYoyGrowthPercent: null,
          })
        }
      }

      // --- E. Compute Summary Stats & AI Insights ---
      let beatsCount = 0
      let missesCount = 0
      let inLineCount = 0
      let totalSurpriseSum = 0
      let surpriseCount = 0
      let consecutiveBeats = 0

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
      }

      const totalQuartersAnalyzed = historicalQuarters.length
      const beatRatePercent = totalQuartersAnalyzed > 0
        ? Number(((beatsCount / totalQuartersAnalyzed) * 100).toFixed(1))
        : 0
      const averageSurprisePercent = surpriseCount > 0
        ? Number((totalSurpriseSum / surpriseCount).toFixed(2))
        : 0

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
