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
  isCurrentYear?: boolean
  statusLabel?: string
}

export interface EstimatedNextPayout {
  estimatedDate: string
  estimatedMonthYear: string
  estimatedAmount: number
  daysRemaining: number
  countdownText: string
  isNear: boolean
  isPastEstimatedDate: boolean
}

export interface DividendSafety {
  payoutRatio: number | null
  payoutRatioStatus: 'healthy' | 'moderate' | 'high_risk' | 'not_applicable'
  payoutRatioLabel: string
  payoutRatioDescription: string
  growthStreakYears: number
  streakBadge: string
  streakDescription: string
  cagr3Y: number | null
  cagr5Y: number | null
  safetyScore: 'high' | 'medium' | 'caution'
}

export interface UserPositionStats {
  shares: number
  avgCost: number
  totalCost: number
  currentValue: number
  unrealizedGain: number
  unrealizedGainPercent: number
  yieldOnCost: number
  yocDifference: number
  annualEstimatedIncome: number
  monthlyEstimatedIncome: number
  perPeriodEstimatedIncome: number
  totalReceived: number
  receivedCount: number
  lastReceivedDate: string | null
  paybackPercent: number
}

export interface DividendIntelligence {
  hasDividends: boolean
  frequency: 'Quarterly' | 'Semi-Annual' | 'Monthly' | 'Annual' | 'Irregular' | 'None'
  frequencyTitle?: string
  frequencyBadge?: string
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
  safety?: DividendSafety
  estimatedNextPayout?: EstimatedNextPayout | null
  userDividends?: {
    totalReceived: number
    count: number
    lastDate: string | null
  } | null
  userPositionStats?: UserPositionStats | null
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

export function formatThaiDate(timestampMs: number): string {
  const d = new Date(timestampMs)
  if (isNaN(d.getTime())) return ''
  return `${d.getDate()} ${THAI_MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`
}

/**
 * Parses Yahoo Chart response with events=div|split into rich statistics,
 * calculating Dividend Intelligence, Safety, Next Estimated XD, YoC and Performance Matrix.
 */
export function parseHistoricalStats(
  chartResult: any,
  currentPrice: number,
  userTxns?: any[],
  userPosition?: {
    shares: number
    avgCost: number
    totalCost?: number
    currentValue?: number
    unrealizedGain?: number
    unrealizedGainPercent?: number
  } | null,
  payoutRatio?: number | null
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
  const currentYear = new Date().getFullYear()

  for (let i = 0; i < sortedYears.length; i++) {
    const yr = sortedYears[i]
    const cur = yearMap.get(yr)!
    const prevYrData = yearMap.get(yr - 1)
    let growthPercent: number | null = null
    const isCurrentYear = yr === currentYear

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
      isCurrentYear,
      statusLabel: isCurrentYear ? `YTD (${cur.count} งวด)` : undefined,
    })
  }

  // 2. Frequency & Payout Months Detection (Robust logic)
  let frequency: DividendIntelligence['frequency'] = 'None'
  let frequencyLabel = 'ไม่มีข้อมูลการจ่ายปันผล'
  let frequencyTitle = 'ไม่มีเงินปันผล'
  let frequencyBadge = ''
  let payoutMonths: string[] = []

  let avgDaysBetween: number | null = null

  if (hasDividends) {
    // Unique months where dividends occurred
    const monthIndexes = new Set<number>()
    for (const item of history.slice(0, 16)) {
      const d = new Date(item.timestamp * 1000)
      monthIndexes.add(d.getMonth())
    }
    const sortedMonthIndexes = Array.from(monthIndexes).sort((a, b) => a - b)
    payoutMonths = sortedMonthIndexes.map((m) => THAI_MONTH_NAMES[m])

    // Average interval between consecutive recent payouts
    if (history.length >= 2) {
      const diffs: number[] = []
      for (let i = 0; i < Math.min(history.length - 1, 6); i++) {
        const diffDays = (history[i].timestamp - history[i + 1].timestamp) / 86400
        if (diffDays > 10 && diffDays < 400) diffs.push(diffDays)
      }
      if (diffs.length > 0) {
        avgDaysBetween = diffs.reduce((a, b) => a + b, 0) / diffs.length
      }
    }

    // Determine average frequency per calendar year
    const fullYears = annualBreakdown.filter((a) => a.year < currentYear)
    const avgCount =
      fullYears.length > 0
        ? fullYears.reduce((acc, y) => acc + y.count, 0) / fullYears.length
        : history.length / Math.max(1, sortedYears.length)

    // Accurate Frequency Classification
    if (
      monthIndexes.size >= 10 ||
      (avgDaysBetween !== null && avgDaysBetween <= 45) ||
      avgCount >= 10
    ) {
      frequency = 'Monthly'
      frequencyTitle = 'จ่ายรายเดือน'
      frequencyBadge = '12 ครั้ง/ปี'
      frequencyLabel = 'จ่ายรายเดือน (12 ครั้ง/ปี)'
    } else if (
      monthIndexes.size >= 4 ||
      (avgDaysBetween !== null && avgDaysBetween >= 65 && avgDaysBetween <= 125) ||
      avgCount >= 3.2
    ) {
      frequency = 'Quarterly'
      frequencyTitle = 'จ่ายรายไตรมาส'
      frequencyBadge = '4 ครั้ง/ปี'
      frequencyLabel = 'จ่ายรายไตรมาส (4 ครั้ง/ปี)'
    } else if (
      monthIndexes.size >= 2 ||
      (avgDaysBetween !== null && avgDaysBetween >= 130 && avgDaysBetween <= 240) ||
      avgCount >= 1.6
    ) {
      frequency = 'Semi-Annual'
      frequencyTitle = 'จ่ายปีละ 2 ครั้ง'
      frequencyBadge = '2 ครั้ง/ปี'
      frequencyLabel = 'จ่ายปีละ 2 ครั้ง (กึ่งประจำปี)'
    } else if (
      (avgDaysBetween !== null && avgDaysBetween >= 250) ||
      avgCount >= 0.8
    ) {
      frequency = 'Annual'
      frequencyTitle = 'จ่ายปีละ 1 ครั้ง'
      frequencyBadge = '1 ครั้ง/ปี'
      frequencyLabel = 'จ่ายปีละ 1 ครั้ง'
    } else {
      frequency = 'Irregular'
      frequencyTitle = 'จ่ายตามโอกาส'
      frequencyBadge = 'ไม่แน่นอน'
      frequencyLabel = 'จ่ายตามโอกาส / ไม่แน่นอน'
    }
  }

  const dividendIntelligence: DividendIntelligence = {
    hasDividends,
    frequency,
    frequencyTitle,
    frequencyBadge,
    frequencyLabel,
    payoutMonths,
    ttmDividends,
    ttmYield,
    latestPayout,
    previousPayout,
    history: history.slice(0, 20),
    annualBreakdown,
  }

  // 3. Next Estimated XD Countdown
  let estimatedNextPayout: EstimatedNextPayout | null = null
  if (hasDividends && latestPayout) {
    let stepDays = 91.25 // default quarterly
    if (frequency === 'Monthly') stepDays = 30.5
    else if (frequency === 'Quarterly') stepDays = 91.25
    else if (frequency === 'Semi-Annual') stepDays = 182.5
    else if (frequency === 'Annual') stepDays = 365
    else if (avgDaysBetween && avgDaysBetween > 15) stepDays = avgDaysBetween

    const nowMs = Date.now()
    let candidateMs = latestPayout.timestamp * 1000 + stepDays * 86400 * 1000

    // If candidate timestamp already passed by more than 10 days, project forward
    while (candidateMs < nowMs - 10 * 86400 * 1000) {
      candidateMs += stepDays * 86400 * 1000
    }

    const nextDateObj = new Date(candidateMs)
    const daysRemaining = Math.ceil((candidateMs - nowMs) / (86400 * 1000))
    const nextMonthIdx = nextDateObj.getMonth()
    const nextYear = nextDateObj.getFullYear()
    const thaiMonth = THAI_MONTH_NAMES[nextMonthIdx]
    const estDateFormatted = `${nextDateObj.getDate()} ${thaiMonth} ${nextYear}`
    const partOfMonth =
      nextDateObj.getDate() > 20 ? 'ปลาย' : nextDateObj.getDate() < 10 ? 'ต้น' : 'กลาง'
    const estMonthYear = `~${partOfMonth}เดือน ${thaiMonth} ${nextYear}`

    let countdownText = ''
    if (daysRemaining > 45) {
      const months = Math.round(daysRemaining / 30)
      countdownText = `เหลือเวลาสะสมอีก ~${months} เดือน (${daysRemaining} วัน)`
    } else if (daysRemaining > 0) {
      countdownText = `เหลือเวลาสะสมอีก ~${daysRemaining} วัน`
    } else {
      countdownText = 'กำลังเข้าสู่ช่วงประกาศวัน XD รอบใหม่'
    }

    estimatedNextPayout = {
      estimatedDate: estDateFormatted,
      estimatedMonthYear: estMonthYear,
      estimatedAmount: latestPayout.amount,
      daysRemaining,
      countdownText,
      isNear: daysRemaining <= 30 && daysRemaining >= 0,
      isPastEstimatedDate: daysRemaining < 0,
    }
  }

  // 4. Dividend Safety & Sustainability Scorecard
  const fullYears = annualBreakdown.filter((a) => a.year < currentYear)
  let growthStreakYears = 0
  if (fullYears.length >= 2) {
    for (let i = 0; i < fullYears.length - 1; i++) {
      const curYr = fullYears[i]
      const prevYr = fullYears[i + 1]
      if (curYr.totalAmount >= prevYr.totalAmount * 0.985) {
        growthStreakYears++
      } else {
        break
      }
    }
  }

  let streakBadge = 'จ่ายสม่ำเสมอ'
  let streakDescription = 'มีประวัติจ่ายเงินปันผลสม่ำเสมอในอดีต'
  if (growthStreakYears >= 25) {
    streakBadge = '👑 Dividend King'
    streakDescription = `เพิ่มปันผลต่อเนื่อง ${growthStreakYears} ปีขึ้นไป ระดับราชาปันผล`
  } else if (growthStreakYears >= 10) {
    streakBadge = '🏆 Dividend Contender'
    streakDescription = `เพิ่มปันผลต่อเนื่อง ${growthStreakYears} ปีขึ้นไป ระดับบลูชิพชั้นนำ`
  } else if (growthStreakYears >= 5) {
    streakBadge = '⭐ Dividend Challenger'
    streakDescription = `เพิ่มปันผลต่อเนื่อง ${growthStreakYears} ปีติดต่อกัน`
  } else if (growthStreakYears >= 2) {
    streakBadge = '🌱 เติบโตต่อเนื่อง'
    streakDescription = `เพิ่มปันผลต่อเนื่อง ${growthStreakYears} ปีล่าสุด`
  }

  // CAGR calculation
  let cagr3Y: number | null = null
  let cagr5Y: number | null = null
  if (fullYears.length >= 4) {
    const endVal = fullYears[0].totalAmount
    const start3Val = fullYears[3].totalAmount
    if (start3Val > 0 && endVal > 0) {
      cagr3Y = Number(((Math.pow(endVal / start3Val, 1 / 3) - 1) * 100).toFixed(1))
    }
  }
  if (fullYears.length >= 6) {
    const endVal = fullYears[0].totalAmount
    const start5Val = fullYears[5].totalAmount
    if (start5Val > 0 && endVal > 0) {
      cagr5Y = Number(((Math.pow(endVal / start5Val, 1 / 5) - 1) * 100).toFixed(1))
    }
  }

  // Payout Ratio analysis
  let payoutRatioStatus: DividendSafety['payoutRatioStatus'] = 'not_applicable'
  let payoutRatioLabel = 'ดัชนี ETF / หุ้นกลุ่มทุน'
  let payoutRatioDescription = 'กองทุน ETF กระจายความเสี่ยงจากเงินปันผลของหุ้นในตะกร้า'

  if (payoutRatio !== null && payoutRatio !== undefined && payoutRatio > 0) {
    if (payoutRatio <= 65) {
      payoutRatioStatus = 'healthy'
      payoutRatioLabel = 'ปลอดภัยมาก (Very Safe)'
      payoutRatioDescription = `ใช้กำไรเพียง ${payoutRatio.toFixed(1)}% ในการจ่ายปันผล เหลือเงินสดหมุนเวียนสูง`
    } else if (payoutRatio <= 80) {
      payoutRatioStatus = 'healthy'
      payoutRatioLabel = 'มั่นคงสมดุล (Safe Payout)'
      payoutRatioDescription = `อัตราจ่ายปันผล ${payoutRatio.toFixed(1)}% อยู่ในเกณฑ์มาตรฐานที่ปลอดภัย`
    } else if (payoutRatio <= 95) {
      payoutRatioStatus = 'moderate'
      payoutRatioLabel = 'เริ่มตึงตัว (Moderate)'
      payoutRatioDescription = `ใช้กำไรส่วนใหญ่ ${payoutRatio.toFixed(1)}% มีสภาพคล่องสำรองจำกัด`
    } else {
      payoutRatioStatus = 'high_risk'
      payoutRatioLabel = 'ระวัง เสี่ยงลดปันผล (High Risk)'
      payoutRatioDescription = `จ่ายปันผลสูงถึง ${payoutRatio.toFixed(1)}% ของกำไร อาจไม่ยั่งยืนหากกำไรชะลอตัว`
    }
  }

  let safetyScore: DividendSafety['safetyScore'] = 'high'
  if (payoutRatioStatus === 'high_risk') {
    safetyScore = 'caution'
  } else if (payoutRatioStatus === 'moderate') {
    safetyScore = 'medium'
  } else if (growthStreakYears >= 5 || (cagr3Y !== null && cagr3Y > 0)) {
    safetyScore = 'high'
  }

  const safety: DividendSafety = {
    payoutRatio: payoutRatio ?? null,
    payoutRatioStatus,
    payoutRatioLabel,
    payoutRatioDescription,
    growthStreakYears,
    streakBadge,
    streakDescription,
    cagr3Y,
    cagr5Y,
    safetyScore,
  }

  // 5. Process Performance & Trailing Returns
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

  // 6. Process Splits
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

  // 7. Process User Dividends (from transactions)
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

  // 8. Process User Position & Yield on Cost (YoC)
  let userPositionStats: UserPositionStats | null = null
  if (userPosition && userPosition.shares > 0.0001) {
    const shares = userPosition.shares
    const avgCost = userPosition.avgCost
    const totalCost = userPosition.totalCost || shares * avgCost
    const currentValue = userPosition.currentValue || shares * currentPrice
    const unrealizedGain = userPosition.unrealizedGain || currentValue - totalCost
    const unrealizedGainPercent =
      userPosition.unrealizedGainPercent ||
      (totalCost > 0 ? (unrealizedGain / totalCost) * 100 : 0)

    const yieldOnCost =
      avgCost > 0 && ttmDividends > 0
        ? Number(((ttmDividends / avgCost) * 100).toFixed(2))
        : 0

    const marketYieldVal = ttmYield ?? 0
    const yocDifference = Number((yieldOnCost - marketYieldVal).toFixed(2))

    const annualEstimatedIncome = Number((shares * ttmDividends).toFixed(2))
    const monthlyEstimatedIncome = Number((annualEstimatedIncome / 12).toFixed(2))

    const periodDiv =
      frequency === 'Monthly'
        ? 12
        : frequency === 'Quarterly'
        ? 4
        : frequency === 'Semi-Annual'
        ? 2
        : 1
    const perPeriodEstimatedIncome = Number((annualEstimatedIncome / periodDiv).toFixed(2))

    const totalReceived = userDividends?.totalReceived || 0
    const receivedCount = userDividends?.count || 0
    const lastReceivedDate = userDividends?.lastDate || null
    const paybackPercent =
      totalCost > 0 ? Number(((totalReceived / totalCost) * 100).toFixed(2)) : 0

    userPositionStats = {
      shares,
      avgCost,
      totalCost: Number(totalCost.toFixed(2)),
      currentValue: Number(currentValue.toFixed(2)),
      unrealizedGain: Number(unrealizedGain.toFixed(2)),
      unrealizedGainPercent: Number(unrealizedGainPercent.toFixed(2)),
      yieldOnCost,
      yocDifference,
      annualEstimatedIncome,
      monthlyEstimatedIncome,
      perPeriodEstimatedIncome,
      totalReceived,
      receivedCount,
      lastReceivedDate,
      paybackPercent,
    }
  }

  return {
    dividends: dividendIntelligence,
    performance,
    splits,
    safety,
    estimatedNextPayout,
    userDividends,
    userPositionStats,
  }
}
