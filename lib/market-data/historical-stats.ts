export interface HistoricalDividendItem {
  date: string
  timestamp: number
  amount: number
  formattedDate: string
  year: number
}

export interface AnnualDividendSummary {
  year: number
  totalAmount: number
  count: number
  growthPercent: number | null
}

export interface DividendIntelligence {
  hasDividends: boolean
  frequency: 'Quarterly' | 'Semi-Annual' | 'Monthly' | 'Annual' | 'Irregular' | 'None'
  frequencyLabel: string
  payoutMonths: string[]
  ttmDividends: number
  ttmYield: number | null
  latestPayout: HistoricalDividendItem | null
  previousPayout: HistoricalDividendItem | null
  history: HistoricalDividendItem[]
  annualBreakdown: AnnualDividendSummary[]
}

export interface HistoricalPerformance {
  return1M: number | null
  return3M: number | null
  return6M: number | null
  return1Y: number | null
  return3Y: number | null
  return5Y: number | null
  pullbackFrom52wHigh: number | null
  fiftyTwoWeekHigh: number | null
  fiftyTwoWeekLow: number | null
}

export interface StockSplitItem {
  date: string
  timestamp: number
  formattedDate: string
  ratio: string
  description: string
}

export interface HistoricalStockStats {
  dividends: DividendIntelligence
  performance: HistoricalPerformance
  splits: StockSplitItem[]
  userDividends?: {
    totalReceived: number
    count: number
    lastDate: string | null
  } | null
}

const THAI_MONTH_NAMES = [
  'ม.ค.',
  'ก.พ.',
  'มี.ค.',
  'เม.ย.',
  'พ.ค.',
  'มิ.ย.',
  'ก.ค.',
  'ส.ค.',
  'ก.ย.',
  'ต.ค.',
  'พ.ย.',
  'ธ.ค.',
]

const THAI_FULL_MONTHS = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม',
]

export function formatThaiDate(timestampMs: number): string {
  const d = new Date(timestampMs)
  if (isNaN(d.getTime())) return ''
  return `${d.getDate()} ${THAI_MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`
}

/**
 * Parses Yahoo Chart 5Y response with events=div|split into rich statistics
 */
export function parseHistoricalStats(
  chartResult: any,
  currentPrice: number,
  userTxns?: any[]
): HistoricalStockStats {
  const meta = chartResult?.meta || {}
  const events = chartResult?.events || {}
  const rawDividends = events.dividends || {}
  const rawSplits = events.splits || {}
  const timestamps: number[] = chartResult?.timestamp || []
  const closes: (number | null)[] = chartResult?.indicators?.quote?.[0]?.close || []

  // 1. Process Dividends
  const divEntries = Object.values(rawDividends) as Array<{ amount: number; date: number }>
  divEntries.sort((a, b) => b.date - a.date)

  const history: HistoricalDividendItem[] = divEntries.map((item) => {
    const tsMs = item.date * 1000
    const d = new Date(tsMs)
    return {
      date: d.toISOString().split('T')[0],
      timestamp: item.date,
      amount: Number(item.amount.toFixed(4)),
      formattedDate: formatThaiDate(tsMs),
      year: d.getFullYear(),
    }
  })

  const hasDividends = history.length > 0
  const latestPayout = history[0] || null
  const previousPayout = history[1] || null

  // Calculate TTM Dividends (past 365 days from now)
  const oneYearAgoSec = Math.floor(Date.now() / 1000) - 365 * 24 * 60 * 60
  const ttmItems = history.filter((h) => h.timestamp >= oneYearAgoSec)
  const ttmDividends = Number(
    ttmItems.reduce((acc, cur) => acc + cur.amount, 0).toFixed(4)
  )

  const ttmYield =
    currentPrice > 0 && ttmDividends > 0
      ? Number(((ttmDividends / currentPrice) * 100).toFixed(2))
      : null

  // Group by Year for Annual Breakdown & YoY Growth
  const yearMap = new Map<number, { total: number; count: number }>()
  for (const item of history) {
    const yr = item.year
    const prev = yearMap.get(yr) || { total: 0, count: 0 }
    yearMap.set(yr, {
      total: prev.total + item.amount,
      count: prev.count + 1,
    })
  }

  const sortedYears = Array.from(yearMap.keys()).sort((a, b) => b - a)
  const annualBreakdown: AnnualDividendSummary[] = []

  for (let i = 0; i < sortedYears.length; i++) {
    const yr = sortedYears[i]
    const cur = yearMap.get(yr)!
    const prevYrData = yearMap.get(yr - 1)
    let growthPercent: number | null = null

    if (prevYrData && prevYrData.total > 0) {
      growthPercent = Number(
        (((cur.total - prevYrData.total) / prevYrData.total) * 100).toFixed(1)
      )
    }

    annualBreakdown.push({
      year: yr,
      totalAmount: Number(cur.total.toFixed(4)),
      count: cur.count,
      growthPercent,
    })
  }

  // Detect Frequency & Common Months
  let frequency: DividendIntelligence['frequency'] = 'None'
  let frequencyLabel = 'ไม่มีข้อมูลการจ่ายปันผล'
  const payoutMonthsSet = new Set<string>()

  if (hasDividends) {
    // Check months
    for (const item of history.slice(0, 10)) {
      const d = new Date(item.timestamp * 1000)
      payoutMonthsSet.add(THAI_FULL_MONTHS[d.getMonth()])
    }

    // Determine average frequency per calendar year
    // Look at last 2 full years if available
    const currentYear = new Date().getFullYear()
    const fullYears = annualBreakdown.filter((a) => a.year < currentYear)
    const avgCount =
      fullYears.length > 0
        ? fullYears.reduce((acc, y) => acc + y.count, 0) / fullYears.length
        : history.length / Math.max(1, sortedYears.length)

    if (avgCount >= 10) {
      frequency = 'Monthly'
      frequencyLabel = 'จ่ายรายเดือน (12 ครั้ง/ปี)'
    } else if (avgCount >= 3.5) {
      frequency = 'Quarterly'
      frequencyLabel = 'จ่ายรายไตรมาส (4 ครั้ง/ปี)'
    } else if (avgCount >= 1.7) {
      frequency = 'Semi-Annual'
      frequencyLabel = 'จ่ายปีละ 2 ครั้ง (กึ่งประจำปี)'
    } else if (avgCount >= 0.8) {
      frequency = 'Annual'
      frequencyLabel = 'จ่ายปีละ 1 ครั้ง'
    } else {
      frequency = 'Irregular'
      frequencyLabel = 'จ่ายตามโอกาส / ไม่แน่นอน'
    }
  }

  const dividendIntelligence: DividendIntelligence = {
    hasDividends,
    frequency,
    frequencyLabel,
    payoutMonths: Array.from(payoutMonthsSet),
    ttmDividends,
    ttmYield,
    latestPayout,
    previousPayout,
    history: history.slice(0, 20), // Top 20 recent dividend payouts
    annualBreakdown,
  }

  // 2. Process Performance & Trailing Returns
  const validPoints: Array<{ time: number; close: number }> = []
  for (let i = 0; i < timestamps.length; i++) {
    const c = closes[i]
    if (c !== null && c !== undefined && !isNaN(c) && c > 0) {
      validPoints.push({ time: timestamps[i], close: c })
    }
  }

  const calcReturn = (monthsAgo: number): number | null => {
    if (validPoints.length === 0 || currentPrice <= 0) return null
    const targetIdx = validPoints.length - 1 - monthsAgo
    if (targetIdx < 0 || !validPoints[targetIdx]) return null
    const pastPrice = validPoints[targetIdx].close
    if (pastPrice <= 0) return null
    return Number((((currentPrice - pastPrice) / pastPrice) * 100).toFixed(2))
  }

  const return1M = calcReturn(1)
  const return3M = calcReturn(3)
  const return6M = calcReturn(6)
  const return1Y = calcReturn(12)
  const return3Y = calcReturn(36)
  const return5Y = validPoints.length > 0 ? calcReturn(validPoints.length - 1) : null

  const fiftyTwoWeekHigh = meta.fiftyTwoWeekHigh || null
  const fiftyTwoWeekLow = meta.fiftyTwoWeekLow || null
  const pullbackFrom52wHigh =
    fiftyTwoWeekHigh && fiftyTwoWeekHigh > 0 && currentPrice > 0
      ? Number((((currentPrice - fiftyTwoWeekHigh) / fiftyTwoWeekHigh) * 100).toFixed(2))
      : null

  const performance: HistoricalPerformance = {
    return1M,
    return3M,
    return6M,
    return1Y,
    return3Y,
    return5Y,
    pullbackFrom52wHigh,
    fiftyTwoWeekHigh,
    fiftyTwoWeekLow,
  }

  // 3. Process Splits
  const rawSplitsList = Object.values(rawSplits) as Array<{
    date: number
    numerator: number
    denominator: number
    splitRatio: string
  }>
  rawSplitsList.sort((a, b) => b.date - a.date)

  const splits: StockSplitItem[] = rawSplitsList.map((s) => {
    const tsMs = s.date * 1000
    const d = new Date(tsMs)
    return {
      date: d.toISOString().split('T')[0],
      timestamp: s.date,
      formattedDate: formatThaiDate(tsMs),
      ratio: s.splitRatio || `${s.numerator}:${s.denominator}`,
      description: `แตกพาร์ ${s.numerator} ต่อ ${s.denominator}`,
    }
  })

  // 4. Process User Dividends (if user holds transactions)
  let userDividends: HistoricalStockStats['userDividends'] = null
  if (userTxns && userTxns.length > 0) {
    const divTxns = userTxns.filter((t) => t.txnType === 'DIVIDEND')
    if (divTxns.length > 0) {
      const totalReceived = divTxns.reduce(
        (sum, t) => sum + Number(t.totalAmount || 0),
        0
      )
      const sorted = [...divTxns].sort(
        (a, b) => new Date(b.txnDate).getTime() - new Date(a.txnDate).getTime()
      )
      const lastDate = sorted[0]?.txnDate
        ? formatThaiDate(new Date(sorted[0].txnDate).getTime())
        : null

      userDividends = {
        totalReceived: Number(totalReceived.toFixed(2)),
        count: divTxns.length,
        lastDate,
      }
    }
  }

  return {
    dividends: dividendIntelligence,
    performance,
    splits,
    userDividends,
  }
}
