/**
 * lib/analytics/stock-daily-advisor.ts
 * Pure TypeScript Quant Risk Assessment, Price Zone Calculator, and Interactive DCA Simulator.
 * ZERO Prisma or fetch imports so client UI, server routes, and Node unit tests all share the exact logic.
 */

export type RiskLevel = 'low' | 'moderate' | 'elevated' | 'high'
export type DailyVerdict =
  | 'ACCUMULATE'
  | 'WAIT_AT_SUPPORT'
  | 'HOLD'
  | 'TRIM_PROFIT'
  | 'CAUTION'
export type RiskDimensionKey = 'technical' | 'fundamental' | 'portfolio' | 'sentiment'

export interface RiskDimensionScore {
  key: RiskDimensionKey
  label: string
  score: number
  level: RiskLevel
  levelLabelTh: string
  drivers: string[]
}

export interface PriceZones {
  currentPrice: number
  support1: number | null
  support2: number | null
  resistance1: number | null
  resistance2: number | null
  ema200: number | null
  pivot: number | null
  avgCost: number | null
  breakevenGainPct: number | null
  distToS1Pct: number | null
  distToS2Pct: number | null
  distToR1Pct: number | null
}

export interface StockRiskAssessment {
  overallScore: number
  overallLevel: RiskLevel
  overallLabelTh: string
  defaultVerdict: DailyVerdict
  defaultVerdictLabelTh: string
  dimensions: RiskDimensionScore[]
  priceZones: PriceZones
  annualizedVolatility30dPct: number | null
}

export interface DcaSimulationInput {
  currentShares: number
  currentAvgCost: number
  currentPrice: number
  addedAmount: number
  entryPrice: number
  totalPortfolioValueNative: number | null
  maxSinglePositionPct: number
}

export interface DcaSimulationResult {
  addedShares: number
  newTotalShares: number
  newTotalCost: number
  newAvgCost: number
  avgCostReductionPct: number
  currentBreakevenPct: number | null
  newBreakevenPct: number | null
  newUnrealizedPnLPctAtCurrent: number
  newPortfolioWeightPct: number | null
  exceedsRiskCap: boolean
}

export interface DailyStockAiReport {
  verdict: DailyVerdict
  verdictLabelTh: string
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
  executiveSummary: string
  historicalContext: string
  liveMarketContext: string
  forwardOutlook: string
  riskAnalysis: {
    technical: string
    fundamental: string
    portfolio: string
    sentiment: string
  }
  scenarios: {
    bull: string
    base: string
    bear: string
  }
  actionPlan: {
    entryPlan: string
    exitOrTrimPlan: string
    riskControlPlan: string
  }
  dailyChecklist: string[]
}

export interface DailyStockAdvisorResponse {
  symbol: string
  name: string
  market: string
  reportDate: string
  quant: StockRiskAssessment
  contextSnapshot: {
    currentPrice: number
    currency: string
    todayChangePercent: number
    fiftyTwoWeekHigh: number | null
    fiftyTwoWeekLow: number | null
    pullbackFrom52wHigh: number | null
    historicalReturns: {
      return1M: number | null
      return3M: number | null
      return6M: number | null
      return1Y: number | null
      return3Y: number | null
      return5Y: number | null
    }
    technical: {
      rsi: number | null
      rsiStatus: string | null
      ema200: number | null
      trendVsEma200: string | null
      s1: number | null
      s2: number | null
      r1: number | null
      r2: number | null
      pivot: number | null
      vol30dPct: number | null
    }
    macro: {
      vixPrice: number | null
      vixChangePct: number | null
      sp500ChangePct: number | null
      fearGreedScore: number | null
      fearGreedLabel: string | null
    }
    news: Array<{
      headline: string
      sourceName: string
      sentiment: string
      publishedAt: string
      sourceUrl: string
    }>
    position: {
      shares: number
      avgCost: number
      totalCost: number
      currentValue: number
      unrealizedGain: number
      unrealizedGainPercent: number
      portfolioWeightPct: number | null
      totalPortfolioValueNative: number | null
      bucketName: string | null
      bucketStrategyType: string | null
      takeProfitPct: number | null
      stopLossPct: number | null
      maxSinglePositionPct: number
    } | null
    forward: {
      targetLow: number | null
      targetMean: number | null
      targetHigh: number | null
      upsidePercent: number | null
      recommendation: string | null
      trailingPe: number | null
      forwardPe: number | null
      dividendYield: number | null
      payoutRatio: number | null
      revenueGrowth: number | null
      debtToEquity: number | null
      earningsLabel: string | null
      earningsDateThai: string | null
      daysToEarnings: number | null
      nextXdDate: string | null
      nextXdDays: number | null
      nextXdAmount: number | null
    }
  }
  aiReport: DailyStockAiReport | null
  modelUsed: string | null
  updatedAt: string | null
  isTodayReport: boolean
  cached: boolean
}

export interface RiskAssessmentInput {
  currentPrice: number
  todayChangePercent: number
  pullbackFrom52wHigh?: number | null
  dailyCloses?: number[]
  rsi?: number | null
  ema200?: number | null
  trendVsEma200?: string | null
  s1?: number | null
  s2?: number | null
  r1?: number | null
  r2?: number | null
  pivot?: number | null
  pe?: number | null
  forwardPe?: number | null
  debtToEquity?: number | null
  freeCashflow?: number | null
  payoutRatio?: number | null
  daysToEarnings?: number | null
  vixPrice?: number | null
  fearGreedScore?: number | null
  newsSentiments?: Array<'positive' | 'negative' | 'neutral' | string | null>
  position?: {
    shares: number
    avgCost: number
    unrealizedGainPercent: number
    portfolioWeightPct: number | null
    maxSinglePositionPct: number
    takeProfitPct?: number | null
    stopLossPct?: number | null
  } | null
}

const VERDICT_LABELS_TH: Record<DailyVerdict, string> = {
  ACCUMULATE: 'ทยอยสะสมเพิ่ม (Accumulate)',
  WAIT_AT_SUPPORT: 'รอรับตามแนวรับ (Wait at Support)',
  HOLD: 'ถือติดตามตามแผน (Hold)',
  TRIM_PROFIT: 'พิจารณาแบ่งขายทำกำไร (Trim Profit)',
  CAUTION: 'เฝ้าระวัง / ชะลอเพิ่มน้ำหนัก (Caution)',
}

export function getVerdictLabelTh(verdict: DailyVerdict): string {
  return VERDICT_LABELS_TH[verdict] || VERDICT_LABELS_TH.HOLD
}

export function getBangkokDateKey(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function classifyRiskLevel(score: number): { level: RiskLevel; labelTh: string } {
  if (score >= 75) return { level: 'high', labelTh: 'สูงมาก' }
  if (score >= 55) return { level: 'elevated', labelTh: 'ค่อนข้างสูง' }
  if (score >= 35) return { level: 'moderate', labelTh: 'ปานกลาง' }
  return { level: 'low', labelTh: 'ต่ำ' }
}

function clampScore(val: number): number {
  return Math.max(5, Math.min(98, Math.round(val)))
}

function pctDiff(target: number | null | undefined, base: number): number | null {
  if (target === null || target === undefined || !Number.isFinite(target) || target <= 0 || base <= 0) {
    return null
  }
  return Number((((target - base) / base) * 100).toFixed(2))
}

/**
 * Computes annualized volatility (%) over the trailing 30 daily trading closes.
 */
export function computeAnnualizedVolatility30d(dailyCloses: number[]): number | null {
  if (!Array.isArray(dailyCloses)) return null
  const valid = dailyCloses.filter((c) => Number.isFinite(c) && c > 0)
  const slice = valid.slice(-31)
  if (slice.length < 11) return null

  const returns: number[] = []
  for (let i = 1; i < slice.length; i++) {
    returns.push((slice[i] - slice[i - 1]) / slice[i - 1])
  }
  if (returns.length < 10) return null

  const mean = returns.reduce((s, r) => s + r, 0) / returns.length
  const variance =
    returns.reduce((s, r) => s + (r - mean) ** 2, 0) / Math.max(1, returns.length - 1)
  return Number((Math.sqrt(variance) * Math.sqrt(252) * 100).toFixed(2))
}

/**
 * Deterministic 4-dimension quantitative risk assessment & actionable price zones.
 */
export function computeStockRiskAssessment(input: RiskAssessmentInput): StockRiskAssessment {
  const {
    currentPrice,
    todayChangePercent,
    pullbackFrom52wHigh = null,
    dailyCloses = [],
    rsi = null,
    ema200 = null,
    trendVsEma200 = null,
    s1 = null,
    s2 = null,
    r1 = null,
    r2 = null,
    pivot = null,
    pe = null,
    forwardPe = null,
    debtToEquity = null,
    freeCashflow = null,
    payoutRatio = null,
    daysToEarnings = null,
    vixPrice = null,
    fearGreedScore = null,
    newsSentiments = [],
    position = null,
  } = input

  const vol30d = computeAnnualizedVolatility30d(dailyCloses)

  // 1. Technical & Volatility Dimension
  let techScore = 25
  const techDrivers: string[] = []
  const absToday = Math.abs(todayChangePercent || 0)

  if (absToday >= 10) {
    techScore += 30
    techDrivers.push(`ราคาวันนี้ผันผวนรุนแรง ${todayChangePercent >= 0 ? '+' : ''}${todayChangePercent.toFixed(2)}%`)
  } else if (absToday >= 5) {
    techScore += 18
    techDrivers.push(`ราคาวันนี้แกว่งตัวแรง ${todayChangePercent >= 0 ? '+' : ''}${todayChangePercent.toFixed(2)}%`)
  } else if (absToday >= 2.5) {
    techScore += 8
  }

  if (pullbackFrom52wHigh !== null) {
    if (pullbackFrom52wHigh <= -40) {
      techScore += 22
      techDrivers.push(`ย่อจากจุดสูงสุด 52 สัปดาห์ลึกถึง ${pullbackFrom52wHigh.toFixed(1)}%`)
    } else if (pullbackFrom52wHigh <= -25) {
      techScore += 14
      techDrivers.push(`ปรับฐานจาก High 52 สัปดาห์ ${pullbackFrom52wHigh.toFixed(1)}%`)
    } else if (pullbackFrom52wHigh <= -12) {
      techScore += 7
      techDrivers.push(`ย่อตัวจาก High 52 สัปดาห์ ${pullbackFrom52wHigh.toFixed(1)}%`)
    }
  }

  if (trendVsEma200 === 'bearish') {
    techScore += 15
    techDrivers.push('ราคาต่ำกว่าเส้นค่าเฉลี่ยระยะยาว EMA200 (แนวโน้มขาลง)')
  } else if (trendVsEma200 === 'bullish') {
    techScore -= 5
    techDrivers.push('ราคายืนเหนือ EMA200 (โครงสร้างหลักยังเป็นขาขึ้น)')
  }

  if (rsi !== null && Number.isFinite(rsi)) {
    if (rsi <= 30) {
      techScore += 8
      techDrivers.push(`RSI(14) = ${rsi.toFixed(1)} เข้าเขตขายมากเกินไป (Oversold — รอแท่งกลับตัว)`)
    } else if (rsi >= 75) {
      techScore += 18
      techDrivers.push(`RSI(14) = ${rsi.toFixed(1)} เข้าเขตซื้อมากเกินไป (Overbought — เสี่ยงย่อระยะสั้น)`)
    } else {
      techDrivers.push(`RSI(14) = ${rsi.toFixed(1)} อยู่ในกรอบสมดุล`)
    }
  }

  if (vol30d !== null) {
    if (vol30d >= 60) {
      techScore += 16
      techDrivers.push(`ความผันผวน 30 วันสูงมาก (${vol30d.toFixed(1)}%/ปี)`)
    } else if (vol30d >= 40) {
      techScore += 9
      techDrivers.push(`ความผันผวน 30 วันค่อนข้างสูง (${vol30d.toFixed(1)}%/ปี)`)
    }
  }

  if (techDrivers.length === 0) {
    techDrivers.push('ความผันผวนระยะสั้นอยู่ในระดับปกติ')
  }

  const finalTechScore = clampScore(techScore)
  const techMeta = classifyRiskLevel(finalTechScore)

  // 2. Fundamental & Valuation Dimension
  let fundScore = 25
  const fundDrivers: string[] = []

  if (pe !== null && Number.isFinite(pe)) {
    if (pe <= 0) {
      fundScore += 22
      fundDrivers.push('บริษัทยังมีกำไรสุทธิติดลบ (Negative P/E)')
    } else if (pe > 60) {
      fundScore += 18
      fundDrivers.push(`Trailing P/E สูง (${pe.toFixed(1)}x) คาดหวังการเติบโตสูงมาก`)
    } else if (pe > 40) {
      fundScore += 10
      fundDrivers.push(`Trailing P/E ค่อนข้างตึง (${pe.toFixed(1)}x)`)
    } else if (pe < 15) {
      fundScore -= 5
      fundDrivers.push(`Valuation ไม่แพง (P/E ${pe.toFixed(1)}x)`)
    }
  }

  if (forwardPe !== null && Number.isFinite(forwardPe) && forwardPe > 45) {
    fundScore += 12
    fundDrivers.push(`Forward P/E อยู่ที่ ${forwardPe.toFixed(1)}x`)
  }

  if (debtToEquity !== null && Number.isFinite(debtToEquity)) {
    if (debtToEquity > 2.5) {
      fundScore += 18
      fundDrivers.push(`หนี้สินต่อทุนสูง (D/E ${debtToEquity.toFixed(2)}x)`)
    } else if (debtToEquity > 1.5) {
      fundScore += 10
      fundDrivers.push(`ภาระหนี้ปานกลาง-สูง (D/E ${debtToEquity.toFixed(2)}x)`)
    }
  }

  if (freeCashflow !== null && Number.isFinite(freeCashflow) && freeCashflow < 0) {
    fundScore += 18
    fundDrivers.push('กระแสเงินสดอิสระ (Free Cash Flow) ติดลบ')
  }

  if (payoutRatio !== null && Number.isFinite(payoutRatio) && payoutRatio > 95) {
    fundScore += 12
    fundDrivers.push(`อัตราจ่ายปันผลสูงเกินกำไร (Payout ${payoutRatio.toFixed(1)}%)`)
  }

  if (daysToEarnings !== null && Number.isFinite(daysToEarnings) && Math.abs(daysToEarnings) <= 7) {
    fundScore += 18
    const timingDesc =
      daysToEarnings < 0
        ? `เพิ่งประกาศงบเมื่อ ${Math.abs(daysToEarnings)} วันก่อน — ตลาดกำลังปรับ Price-in`
        : daysToEarnings === 0
        ? 'ประกาศงบวันนี้ — เสี่ยงราคาเปิดกระโดด (Earnings Gap)'
        : `ใกล้วันประกาศงบในอีก ${daysToEarnings} วัน — เสี่ยงผันผวนแรง`
    fundDrivers.push(timingDesc)
  }

  if (fundDrivers.length === 0) {
    fundDrivers.push('ปัจจัยพื้นฐานและมูลค่าอยู่ในเกณฑ์สมดุล')
  }

  const finalFundScore = clampScore(fundScore)
  const fundMeta = classifyRiskLevel(finalFundScore)

  // 3. Portfolio & Position Sizing Dimension
  let portScore = 30
  const portDrivers: string[] = []

  if (!position || position.shares <= 0) {
    portDrivers.push('ยังไม่ได้ถือครองในพอร์ต (ไม่มีความเสี่ยงกระจุกตัว)')
  } else {
    portScore = 25
    const w = position.portfolioWeightPct
    const maxW = position.maxSinglePositionPct || 20
    const pnlPct = position.unrealizedGainPercent

    if (w !== null && w > maxW) {
      portScore += 28
      portDrivers.push(`สัดส่วนในพอร์ต ${w.toFixed(1)}% เกินเพดานที่ตั้งไว้ (${maxW}%)`)
    } else if (w !== null && w >= maxW * 0.8) {
      portScore += 14
      portDrivers.push(`สัดส่วนในพอร์ต ${w.toFixed(1)}% ใกล้เพดาน ${maxW}%`)
    } else if (w !== null) {
      portDrivers.push(`สัดส่วนในพอร์ต ${w.toFixed(1)}% (อยู่ในกรอบปลอดภัย ≤ ${maxW}%)`)
    }

    if (position.stopLossPct !== null && position.stopLossPct !== undefined && pnlPct <= -Math.abs(position.stopLossPct)) {
      portScore += 30
      portDrivers.push(`ขาดทุน ${pnlPct.toFixed(1)}% ทะลุเกณฑ์ Stop Loss (-${Math.abs(position.stopLossPct)}%)`)
    } else if (pnlPct <= -20) {
      portScore += 25
      portDrivers.push(`สถานะในพอร์ตติดลบหนัก ${pnlPct.toFixed(2)}% (ต้นทุน ${position.avgCost.toFixed(2)})`)
    } else if (pnlPct <= -10) {
      portScore += 14
      portDrivers.push(`สถานะในพอร์ตติดลบ ${pnlPct.toFixed(2)}%`)
    } else if (position.takeProfitPct !== null && position.takeProfitPct !== undefined && pnlPct >= position.takeProfitPct) {
      portScore += 12
      portDrivers.push(`กำไร +${pnlPct.toFixed(1)}% ทะลุเป้า Take Profit (+${position.takeProfitPct}%) ควรระวังกำไรหด`)
    } else {
      portDrivers.push(`สถานะในพอร์ต ${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%`)
    }
  }

  const finalPortScore = clampScore(portScore)
  const portMeta = classifyRiskLevel(finalPortScore)

  // 4. Sentiment & Macro Dimension
  let sentScore = 30
  const sentDrivers: string[] = []

  if (vixPrice !== null && Number.isFinite(vixPrice)) {
    if (vixPrice >= 30) {
      sentScore += 26
      sentDrivers.push(`ดัชนีความกลัว VIX พุ่งสูง (${vixPrice.toFixed(1)}) ตลาดตื่นตระหนก`)
    } else if (vixPrice >= 22) {
      sentScore += 15
      sentDrivers.push(`VIX อยู่ระดับผันผวน (${vixPrice.toFixed(1)})`)
    } else if (vixPrice < 15) {
      sentScore -= 6
      sentDrivers.push(`VIX ต่ำ (${vixPrice.toFixed(1)}) บรรยากาศตลาดสงบ`)
    }
  }

  if (fearGreedScore !== null && Number.isFinite(fearGreedScore)) {
    if (fearGreedScore <= 25) {
      sentScore += 15
      sentDrivers.push(`Fear & Greed Index = ${fearGreedScore} (Extreme Fear — ตลาดกลัวจัด)`)
    } else if (fearGreedScore >= 75) {
      sentScore += 14
      sentDrivers.push(`Fear & Greed Index = ${fearGreedScore} (Extreme Greed — ระวังแรงขายทำกำไร)`)
    }
  }

  let negNews = 0
  let posNews = 0
  for (const s of newsSentiments) {
    if (s === 'negative') negNews++
    else if (s === 'positive') posNews++
  }
  if (negNews > 0 || posNews > 0) {
    sentScore += negNews * 10 - posNews * 5
    sentDrivers.push(`ข่าวล่าสุดของหุ้น: เชิงบวก ${posNews} ข่าว / เชิงลบ ${negNews} ข่าว`)
  } else {
    sentDrivers.push('ยังไม่มีข่าวลบเฉพาะตัวที่กดดันเพิ่มเติมในระบบ')
  }

  const finalSentScore = clampScore(sentScore)
  const sentMeta = classifyRiskLevel(finalSentScore)

  const overallScore = clampScore(
    0.3 * finalTechScore + 0.25 * finalFundScore + 0.25 * finalPortScore + 0.2 * finalSentScore
  )
  const overallMeta = classifyRiskLevel(overallScore)

  // Determine deterministic baseline verdict
  const distToS1Pct = pctDiff(s1, currentPrice)
  const distToS2Pct = pctDiff(s2, currentPrice)
  const distToR1Pct = pctDiff(r1, currentPrice)
  const breakevenGainPct =
    position && position.avgCost > 0 && currentPrice > 0 && position.avgCost > currentPrice
      ? Number((((position.avgCost - currentPrice) / currentPrice) * 100).toFixed(2))
      : position && position.avgCost > 0 && currentPrice > 0
      ? Number((((position.avgCost - currentPrice) / currentPrice) * 100).toFixed(2))
      : null

  let defaultVerdict: DailyVerdict = 'HOLD'
  const takeProfitHit =
    position?.takeProfitPct !== null &&
    position?.takeProfitPct !== undefined &&
    position.unrealizedGainPercent >= position.takeProfitPct

  if (takeProfitHit || (rsi !== null && rsi >= 75 && (position?.unrealizedGainPercent ?? 0) >= 15)) {
    defaultVerdict = 'TRIM_PROFIT'
  } else if (overallScore >= 75 || (todayChangePercent <= -8 && trendVsEma200 === 'bearish')) {
    if (position && position.portfolioWeightPct !== null && position.portfolioWeightPct > position.maxSinglePositionPct) {
      defaultVerdict = 'CAUTION'
    } else {
      defaultVerdict = 'WAIT_AT_SUPPORT'
    }
  } else if (
    ((rsi !== null && rsi <= 35) || (distToS1Pct !== null && distToS1Pct >= -4 && distToS1Pct <= 1)) &&
    overallScore < 65
  ) {
    defaultVerdict = 'ACCUMULATE'
  } else if (overallScore >= 65) {
    defaultVerdict = 'CAUTION'
  }

  return {
    overallScore,
    overallLevel: overallMeta.level,
    overallLabelTh: overallMeta.labelTh,
    defaultVerdict,
    defaultVerdictLabelTh: getVerdictLabelTh(defaultVerdict),
    dimensions: [
      {
        key: 'technical',
        label: 'เทคนิคอล & ความผันผวน',
        score: finalTechScore,
        level: techMeta.level,
        levelLabelTh: techMeta.labelTh,
        drivers: techDrivers,
      },
      {
        key: 'fundamental',
        label: 'มูลค่า & ปัจจัยพื้นฐาน',
        score: finalFundScore,
        level: fundMeta.level,
        levelLabelTh: fundMeta.labelTh,
        drivers: fundDrivers,
      },
      {
        key: 'portfolio',
        label: 'ความเสี่ยงต่อพอร์ตคุณ',
        score: finalPortScore,
        level: portMeta.level,
        levelLabelTh: portMeta.labelTh,
        drivers: portDrivers,
      },
      {
        key: 'sentiment',
        label: 'ข่าว & ภาวะตลาดรวม',
        score: finalSentScore,
        level: sentMeta.level,
        levelLabelTh: sentMeta.labelTh,
        drivers: sentDrivers,
      },
    ],
    priceZones: {
      currentPrice: Number(currentPrice.toFixed(2)),
      support1: s1 !== null && s1 > 0 ? Number(s1.toFixed(2)) : null,
      support2: s2 !== null && s2 > 0 ? Number(s2.toFixed(2)) : null,
      resistance1: r1 !== null && r1 > 0 ? Number(r1.toFixed(2)) : null,
      resistance2: r2 !== null && r2 > 0 ? Number(r2.toFixed(2)) : null,
      ema200: ema200 !== null && ema200 > 0 ? Number(ema200.toFixed(2)) : null,
      pivot: pivot !== null && pivot > 0 ? Number(pivot.toFixed(2)) : null,
      avgCost: position && position.avgCost > 0 ? Number(position.avgCost.toFixed(2)) : null,
      breakevenGainPct,
      distToS1Pct,
      distToS2Pct,
      distToR1Pct,
    },
    annualizedVolatility30dPct: vol30d,
  }
}

/**
 * Simulates adding capital into a position at a chosen entry price, computing
 * new average cost, breakeven reduction, and updated portfolio weight.
 */
export function simulateDcaPosition(input: DcaSimulationInput): DcaSimulationResult {
  const curShares = Math.max(0, Number(input.currentShares) || 0)
  const curAvg = Math.max(0, Number(input.currentAvgCost) || 0)
  const curPrice = Math.max(0, Number(input.currentPrice) || 0)
  const added = Math.max(0, Number(input.addedAmount) || 0)
  const entry = Number(input.entryPrice) > 0 ? Number(input.entryPrice) : curPrice

  const curTotalCost = curShares * curAvg
  const addedShares = entry > 0 && added > 0 ? added / entry : 0
  const newTotalShares = curShares + addedShares
  const newTotalCost = curTotalCost + added
  const newAvgCost = newTotalShares > 0 ? newTotalCost / newTotalShares : entry

  const avgCostReductionPct =
    curShares > 0 && curAvg > 0 ? ((newAvgCost - curAvg) / curAvg) * 100 : 0

  const currentBreakevenPct =
    curShares > 0 && curAvg > 0 && curPrice > 0 ? ((curAvg - curPrice) / curPrice) * 100 : null
  const newBreakevenPct =
    newTotalShares > 0 && newAvgCost > 0 && curPrice > 0
      ? ((newAvgCost - curPrice) / curPrice) * 100
      : null

  const newValueAtCurrent = newTotalShares * curPrice
  const newUnrealizedPnLPctAtCurrent =
    newTotalCost > 0 ? ((newValueAtCurrent - newTotalCost) / newTotalCost) * 100 : 0

  let newPortfolioWeightPct: number | null = null
  if (input.totalPortfolioValueNative !== null && input.totalPortfolioValueNative >= 0) {
    const curPosVal = curShares * curPrice
    const otherPortVal = Math.max(0, input.totalPortfolioValueNative - curPosVal)
    const newPosValAtEntry = curPosVal + added
    const newPortTotal = otherPortVal + newPosValAtEntry
    newPortfolioWeightPct = newPortTotal > 0 ? (newPosValAtEntry / newPortTotal) * 100 : null
  }

  const cap = input.maxSinglePositionPct > 0 ? input.maxSinglePositionPct : 20
  const exceedsRiskCap = newPortfolioWeightPct !== null && newPortfolioWeightPct > cap

  return {
    addedShares: Number(addedShares.toFixed(6)),
    newTotalShares: Number(newTotalShares.toFixed(6)),
    newTotalCost: Number(newTotalCost.toFixed(2)),
    newAvgCost: Number(newAvgCost.toFixed(2)),
    avgCostReductionPct: Number(avgCostReductionPct.toFixed(2)),
    currentBreakevenPct: currentBreakevenPct !== null ? Number(currentBreakevenPct.toFixed(2)) : null,
    newBreakevenPct: newBreakevenPct !== null ? Number(newBreakevenPct.toFixed(2)) : null,
    newUnrealizedPnLPctAtCurrent: Number(newUnrealizedPnLPctAtCurrent.toFixed(2)),
    newPortfolioWeightPct:
      newPortfolioWeightPct !== null ? Number(newPortfolioWeightPct.toFixed(2)) : null,
    exceedsRiskCap,
  }
}

const VALID_VERDICTS = new Set<DailyVerdict>([
  'ACCUMULATE',
  'WAIT_AT_SUPPORT',
  'HOLD',
  'TRIM_PROFIT',
  'CAUTION',
])

/**
 * Parses and validates Gemini JSON output for the daily stock risk & action report.
 * Rejects non-Thai or structurally broken payloads.
 */
export function parseDailyStockAiReport(
  rawText: string | null | undefined
): DailyStockAiReport | null {
  if (!rawText || typeof rawText !== 'string') return null
  try {
    const cleaned = rawText
      .replace(/^```json\s*/i, '')
      .replace(/```json\s*/gi, '')
      .replace(/```\s*$/g, '')
      .trim()

    const parsed = JSON.parse(cleaned)
    if (!parsed || typeof parsed !== 'object') return null

    const executiveSummary =
      typeof parsed.executiveSummary === 'string' ? parsed.executiveSummary.trim() : ''
    if (!executiveSummary || !/[ก-๙]/.test(executiveSummary)) {
      return null
    }

    const rawVerdict = String(parsed.verdict || '').toUpperCase().trim() as DailyVerdict
    const verdict: DailyVerdict = VALID_VERDICTS.has(rawVerdict) ? rawVerdict : 'HOLD'

    const rawConf = String(parsed.confidence || 'MEDIUM').toUpperCase().trim()
    const confidence: DailyStockAiReport['confidence'] =
      rawConf === 'HIGH' || rawConf === 'LOW' ? rawConf : 'MEDIUM'

    const asStr = (val: unknown, fallback = '—') =>
      typeof val === 'string' && val.trim().length > 0 ? val.trim() : fallback

    const riskAnalysisObj = parsed.riskAnalysis && typeof parsed.riskAnalysis === 'object' ? parsed.riskAnalysis : {}
    const scenariosObj = parsed.scenarios && typeof parsed.scenarios === 'object' ? parsed.scenarios : {}
    const actionPlanObj = parsed.actionPlan && typeof parsed.actionPlan === 'object' ? parsed.actionPlan : {}

    const checklist = Array.isArray(parsed.dailyChecklist)
      ? parsed.dailyChecklist
          .filter((item: unknown) => typeof item === 'string' && item.trim().length > 0)
          .map((item: string) => item.trim())
          .slice(0, 6)
      : []

    return {
      verdict,
      verdictLabelTh:
        typeof parsed.verdictLabelTh === 'string' && parsed.verdictLabelTh.trim().length > 0
          ? parsed.verdictLabelTh.trim()
          : getVerdictLabelTh(verdict),
      confidence,
      executiveSummary,
      historicalContext: asStr(parsed.historicalContext),
      liveMarketContext: asStr(parsed.liveMarketContext),
      forwardOutlook: asStr(parsed.forwardOutlook),
      riskAnalysis: {
        technical: asStr(riskAnalysisObj.technical),
        fundamental: asStr(riskAnalysisObj.fundamental),
        portfolio: asStr(riskAnalysisObj.portfolio),
        sentiment: asStr(riskAnalysisObj.sentiment),
      },
      scenarios: {
        bull: asStr(scenariosObj.bull),
        base: asStr(scenariosObj.base),
        bear: asStr(scenariosObj.bear),
      },
      actionPlan: {
        entryPlan: asStr(actionPlanObj.entryPlan),
        exitOrTrimPlan: asStr(actionPlanObj.exitOrTrimPlan),
        riskControlPlan: asStr(actionPlanObj.riskControlPlan),
      },
      dailyChecklist: checklist,
    }
  } catch {
    return null
  }
}
