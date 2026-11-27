/**
 * lib/analytics/regime-opportunities.ts
 * Long-Only Regime Opportunity & Downside Hedge Quant Engine (Option A):
 * - Detects live Market Regime (Tech Selloff + Yield Pressure, Risk-Off, Correction Dip, Broad Rotation, Risk-On)
 * - Scans curated liquid US Sector / Dividend / Bond / Gold ETFs + unheld Watchlist items (cached 20m)
 * - Scores opportunities on 4 verifiable dimensions (Relative Strength vs QQQ, 60D Hedge Correlation, Entry Timing, Portfolio Fit)
 * - Simulates portfolio downside shock reduction (-15% Tech drop) using real 60D Beta
 */

import type { HoldingItem } from './holdings'
import { classifySector } from './risk-sentinel'
import { calculateSMA, calculateWildersRSI } from '../market-data/technical-signals'
import { getObservationTime } from '../ai/advisor-evidence'
import { getYahooQuoteSummary } from '../market-data/yahoo-crumb'

export type MarketRegimeCode =
  | 'TECH_SELLOFF_YIELD_PRESSURE'
  | 'RISK_OFF_DEFENSIVE'
  | 'TECH_CORRECTION_DIP'
  | 'BROAD_ROTATION'
  | 'RISK_ON_EXPANSION'

export type OpportunityRole =
  | 'DEFENSIVE_HEDGE'
  | 'SECTOR_ROTATION'
  | 'INCOME_BUFFER'
  | 'CONTRARIAN_DIP'

export type EntryReadinessStatus =
  | 'READY_TO_ENTER'
  | 'WAIT_PULLBACK'
  | 'TOO_HIGH_DO_NOT_CHASE'

export interface DailySeriesSnapshot {
  symbol: string
  name: string
  market: string
  currency: string
  currentPrice: number
  changePercent: number
  observedAt: string
  closes: number[]
  highs: number[]
  lows: number[]
  return5D: number
  return21D: number
  return63D: number
  rsi14: number | null
  sma50: number | null
  supportS1: number | null
  resistanceR1: number | null
  pullbackFrom6MHigh: number
}

export interface DetectedMarketRegime {
  code: MarketRegimeCode
  labelTh: string
  badgeTone: 'rose' | 'amber' | 'indigo' | 'emerald'
  summaryTh: string
  qqqReturn21D: number
  spyReturn21D: number
  qqqVsSpySpread21D: number
  vixPrice: number | null
  us10yYield: number | null
  preferredRoles: OpportunityRole[]
  rotationExitTriggerTh: string
}

export interface HedgeImpactEstimate {
  suggestedWeightPct: number
  betaToQqq: number
  shockPercent: number
  baselineLossBase: number
  hedgedLossBase: number
  lossReductionBase: number
  lossReductionPct: number
  summaryTh: string
}

export interface RegimeOpportunityCandidate {
  ticker: string
  name: string
  category: string
  market: string
  currency: string
  isWatchlist: boolean
  currentPrice: number
  changePercent: number
  observedAt: string
  role: OpportunityRole
  roleLabelTh: string
  totalScore: number
  scoreBreakdown: {
    relativeStrength: number
    hedgePower: number
    entryTiming: number
    portfolioFit: number
  }
  rsVsQqq5D: number
  rsVsQqq21D: number
  rsVsQqq63D: number
  corr60DWithQqq: number
  rsi14: number | null
  sma50: number | null
  supportS1: number | null
  resistanceR1: number | null
  pullbackFrom6MHigh: number
  entryReadiness: EntryReadinessStatus
  entryVerdictLabelTh: string
  distanceAboveSma50Pct: number | null
  upsideToR1Pct: number | null
  downsideToS1Pct: number | null
  riskRewardRatio: number | null
  forwardPe: number | null
  trailingPe: number | null
  valuationWarningTh: string | null
  entryCaution: string | null
  alreadyHeldPct: number
  entryZoneTh: string
  stopLossRefTh: string
  exitTriggerTh: string
  hedgeImpact: HedgeImpactEstimate | null
  quantReasons: string[]
}

export interface RegimeOpportunitiesReport {
  generatedAt: string
  regime: DetectedMarketRegime
  techExposurePercent: number
  goldExposurePercent: number
  cashPercent: number
  baseCurrency: string
  candidates: RegimeOpportunityCandidate[]
  topSummaryTh: string
}

interface UniverseSpec {
  ticker: string
  name: string
  category: string
  defaultRole: OpportunityRole
  market: 'US'
}

export const REGIME_ETF_UNIVERSE: UniverseSpec[] = [
  { ticker: 'GLD', name: 'SPDR Gold Shares (ทองคำโลก)', category: 'Gold', defaultRole: 'DEFENSIVE_HEDGE', market: 'US' },
  { ticker: 'TLT', name: 'iShares 20+ Year Treasury Bond ETF', category: 'Bonds', defaultRole: 'DEFENSIVE_HEDGE', market: 'US' },
  { ticker: 'IEF', name: 'iShares 7-10 Year Treasury Bond ETF', category: 'Bonds', defaultRole: 'DEFENSIVE_HEDGE', market: 'US' },
  { ticker: 'SGOV', name: 'iShares 0-3 Month Treasury Bond (ดอกเบี้ยระยะสั้น)', category: 'CashYield', defaultRole: 'INCOME_BUFFER', market: 'US' },
  { ticker: 'XLV', name: 'Health Care Select Sector SPDR', category: 'Healthcare', defaultRole: 'DEFENSIVE_HEDGE', market: 'US' },
  { ticker: 'XLP', name: 'Consumer Staples Select Sector SPDR', category: 'Staples', defaultRole: 'DEFENSIVE_HEDGE', market: 'US' },
  { ticker: 'XLU', name: 'Utilities Select Sector SPDR', category: 'Utilities', defaultRole: 'DEFENSIVE_HEDGE', market: 'US' },
  { ticker: 'SCHD', name: 'Schwab U.S. Dividend Equity ETF', category: 'Dividend', defaultRole: 'INCOME_BUFFER', market: 'US' },
  { ticker: 'VYM', name: 'Vanguard High Dividend Yield ETF', category: 'Dividend', defaultRole: 'INCOME_BUFFER', market: 'US' },
  { ticker: 'XLE', name: 'Energy Select Sector SPDR', category: 'Energy', defaultRole: 'SECTOR_ROTATION', market: 'US' },
  { ticker: 'XLF', name: 'Financial Select Sector SPDR', category: 'Financials', defaultRole: 'SECTOR_ROTATION', market: 'US' },
  { ticker: 'XLI', name: 'Industrial Select Sector SPDR', category: 'Industrials', defaultRole: 'SECTOR_ROTATION', market: 'US' },
  { ticker: 'VOO', name: 'Vanguard S&P 500 ETF', category: 'CoreIndex', defaultRole: 'SECTOR_ROTATION', market: 'US' },
]

const ROLE_LABELS_TH: Record<OpportunityRole, string> = {
  DEFENSIVE_HEDGE: '🛡️ กันกระแทกพอร์ต',
  SECTOR_ROTATION: '🔄 หมุนกลุ่มทำกำไร',
  INCOME_BUFFER: '💰 ปันผล/ดอกเบี้ยรอจังหวะ',
  CONTRARIAN_DIP: '🎯 ช้อนของดีย่อตัว',
}

const SERIES_CACHE_TTL_MS = 20 * 60 * 1000
const seriesCache = new Map<string, { data: DailySeriesSnapshot; timestamp: number }>()
const inFlightSeries = new Map<string, Promise<DailySeriesSnapshot | null>>()

export function invalidateRegimeSeriesCache(symbol?: string) {
  if (symbol) {
    seriesCache.delete(symbol.trim().toUpperCase())
  } else {
    seriesCache.clear()
  }
}

export function computeDailyReturns(closes: number[]): number[] {
  if (!Array.isArray(closes) || closes.length < 2) return []
  const returns: number[] = []
  for (let i = 1; i < closes.length; i++) {
    const prev = closes[i - 1]
    const curr = closes[i]
    if (prev > 0 && Number.isFinite(curr) && Number.isFinite(prev)) {
      returns.push((curr - prev) / prev)
    }
  }
  return returns
}

export function calculatePearsonCorrelation(
  seriesA: number[],
  seriesB: number[],
  lookback = 60
): number {
  const retA = computeDailyReturns(seriesA)
  const retB = computeDailyReturns(seriesB)
  const len = Math.min(retA.length, retB.length, lookback)
  if (len < 12) return 0

  const a = retA.slice(-len)
  const b = retB.slice(-len)

  const meanA = a.reduce((s, v) => s + v, 0) / len
  const meanB = b.reduce((s, v) => s + v, 0) / len

  let num = 0
  let varA = 0
  let varB = 0
  for (let i = 0; i < len; i++) {
    const da = a[i] - meanA
    const db = b[i] - meanB
    num += da * db
    varA += da * da
    varB += db * db
  }

  const denom = Math.sqrt(varA * varB)
  if (!(denom > 1e-12)) return 0
  const corr = Math.max(-1, Math.min(1, num / denom))
  return Number(corr.toFixed(2))
}

export function calculateBetaToBenchmark(
  assetCloses: number[],
  benchCloses: number[],
  lookback = 60
): number {
  const retAsset = computeDailyReturns(assetCloses)
  const retBench = computeDailyReturns(benchCloses)
  const len = Math.min(retAsset.length, retBench.length, lookback)
  if (len < 12) return 0.5

  const a = retAsset.slice(-len)
  const b = retBench.slice(-len)

  const meanA = a.reduce((s, v) => s + v, 0) / len
  const meanB = b.reduce((s, v) => s + v, 0) / len

  let cov = 0
  let varB = 0
  for (let i = 0; i < len; i++) {
    const da = a[i] - meanA
    const db = b[i] - meanB
    cov += da * db
    varB += db * db
  }

  if (!(varB > 1e-12)) return 0.5
  const beta = Math.max(-1.5, Math.min(2.5, cov / varB))
  return Number(beta.toFixed(2))
}

function windowReturnPct(closes: number[], days: number): number {
  if (closes.length <= days) {
    if (closes.length < 2) return 0
    const first = closes[0]
    const last = closes[closes.length - 1]
    return first > 0 ? Number((((last - first) / first) * 100).toFixed(2)) : 0
  }
  const base = closes[closes.length - 1 - days]
  const last = closes[closes.length - 1]
  if (!(base > 0)) return 0
  return Number((((last - base) / base) * 100).toFixed(2))
}

export function detectMarketRegime(params: {
  qqqReturn21D: number
  spyReturn21D: number
  qqqPullback6M: number
  qqqAboveSma50: boolean
  spyAboveSma50: boolean
  vixPrice: number | null
  us10yYield: number | null
}): DetectedMarketRegime {
  const { qqqReturn21D, spyReturn21D, qqqPullback6M, qqqAboveSma50, vixPrice, us10yYield } = params
  const spread = Number((qqqReturn21D - spyReturn21D).toFixed(2))

  if ((vixPrice !== null && vixPrice >= 23) || (spyReturn21D <= -4 && qqqReturn21D <= -5)) {
    return {
      code: 'RISK_OFF_DEFENSIVE',
      labelTh: '🛡️ ตลาดผันผวนสูง / โหมดหลบภัย (Risk-Off)',
      badgeTone: 'rose',
      summaryTh: `VIX ${vixPrice !== null ? `${vixPrice.toFixed(1)}` : 'สูง'} และตลาดหลักอ่อนตัว ควรเพิ่มสินทรัพย์กันกระแทกที่ Correlation ต่ำ (ทองคำ, พันธบัตร, Healthcare/Staples) เพื่อลด Drawdown`,
      qqqReturn21D,
      spyReturn21D,
      qqqVsSpySpread21D: spread,
      vixPrice,
      us10yYield,
      preferredRoles: ['DEFENSIVE_HEDGE', 'INCOME_BUFFER'],
      rotationExitTriggerTh: 'ขายลดสัดส่วน Defensive กลับเข้า Growth เมื่อ VIX ลดต่ำกว่า 19 และ QQQ ยืนเหนือ SMA50 ต่อเนื่อง 3-5 วันทำการ',
    }
  }

  if ((spread <= -1.5 || qqqReturn21D <= -3) && us10yYield !== null && us10yYield >= 4.25) {
    return {
      code: 'TECH_SELLOFF_YIELD_PRESSURE',
      labelTh: '⚡ หุ้นเทคถูกกดดันจาก Yield (Tech Rotation)',
      badgeTone: 'rose',
      summaryTh: `QQQ 1M (${qqqReturn21D >= 0 ? '+' : ''}${qqqReturn21D.toFixed(1)}%) อ่อนกว่า SPY (${spyReturn21D >= 0 ? '+' : ''}${spyReturn21D.toFixed(1)}%) ร่วมกับ US 10Y Yield ${us10yYield.toFixed(2)}% ตึงตัว เงินมีแนวโน้มหมุนเข้า Value/ปันผล, ทองคำ และกลุ่มพลังงาน/การเงิน`,
      qqqReturn21D,
      spyReturn21D,
      qqqVsSpySpread21D: spread,
      vixPrice,
      us10yYield,
      preferredRoles: ['SECTOR_ROTATION', 'DEFENSIVE_HEDGE', 'INCOME_BUFFER'],
      rotationExitTriggerTh: 'ทยอยหมุนกำไรกลับเข้า Tech เมื่อ US 10Y Yield ชะลอต่ำกว่า 4.20% หรือ QQQ กลับมาแกร่งกว่า SPY',
    }
  }

  if (qqqPullback6M <= -6 && (vixPrice === null || vixPrice < 24)) {
    return {
      code: 'TECH_CORRECTION_DIP',
      labelTh: '🎯 เทคปรับฐานลงมาโซนน่าเลือกช้อน (Controlled Dip)',
      badgeTone: 'amber',
      summaryTh: `QQQ ย่อจากจุดสูงสุด 6 เดือน ${qqqPullback6M.toFixed(1)}% โดย VIX ยังไม่ตื่นตระหนก เหมาะจับคู่ถือ Defensive/ปันผลประคองพอร์ตควบคู่ทยอยเก็บของดีที่ลงมาใกล้แนวรับ S1`,
      qqqReturn21D,
      spyReturn21D,
      qqqVsSpySpread21D: spread,
      vixPrice,
      us10yYield,
      preferredRoles: ['CONTRARIAN_DIP', 'INCOME_BUFFER', 'DEFENSIVE_HEDGE'],
      rotationExitTriggerTh: 'เมื่อตลาดกลับเข้าสู่ขาขึ้นเต็มตัว (QQQ > SMA50) ให้รักษาวินัย Rebalance ตามเพดานสัดส่วน',
    }
  }

  if (spread <= -1.0 || !qqqAboveSma50) {
    return {
      code: 'BROAD_ROTATION',
      labelTh: '🔄 ตลาดกำลังหมุนกลุ่ม (Sector Rotation)',
      badgeTone: 'indigo',
      summaryTh: `โมเมนตัม QQQ ชะลอเมื่อเทียบ SPY (${spread.toFixed(1)}%) เงินกำลังกระจายออกนอกกลุ่ม Mega-cap Tech สู่กลุ่มปันผล คุณภาพ และ Value`,
      qqqReturn21D,
      spyReturn21D,
      qqqVsSpySpread21D: spread,
      vixPrice,
      us10yYield,
      preferredRoles: ['SECTOR_ROTATION', 'INCOME_BUFFER', 'DEFENSIVE_HEDGE'],
      rotationExitTriggerTh: 'สลับน้ำหนักกลับเมื่อกลุ่ม Growth กลับมานำตลาด (RS 21D > 0) และไม่ขัดกฎ Max Position',
    }
  }

  return {
    code: 'RISK_ON_EXPANSION',
    labelTh: '🚀 ตลาดเอื้อสินทรัพย์เสี่ยง (Risk-On Expansion)',
    badgeTone: 'emerald',
    summaryTh: `ดัชนีหลักยังรักษาทรงขาขึ้นและ VIX ต่ำ — เหมาะใช้ ETF ปันผล/ทองคำเป็นตัวปรับสมดุลพอร์ตไม่ให้กระจุกตัวเกินเพดาน หรือเลือกช้อนหุ้น Watchlist ที่ย่อตัว`,
    qqqReturn21D,
    spyReturn21D,
    qqqVsSpySpread21D: spread,
    vixPrice,
    us10yYield,
    preferredRoles: ['CONTRARIAN_DIP', 'INCOME_BUFFER', 'SECTOR_ROTATION'],
    rotationExitTriggerTh: 'คงสัดส่วน Hedge/Defensive ขั้นต่ำไว้เป็นเกราะป้องกัน และทยอยเติมตามวินัย DCA',
  }
}

export interface EntryReadinessEvaluation {
  entryReadiness: EntryReadinessStatus
  entryVerdictLabelTh: string
  entryTimingScore: number
  entryCaution: string | null
  distanceAboveSma50Pct: number | null
  upsideToR1Pct: number | null
  downsideToS1Pct: number | null
  riskRewardRatio: number | null
  valuationWarningTh: string | null
}

const DEFENSIVE_LOW_VOL_CATEGORIES = new Set([
  'Bonds',
  'Staples',
  'Utilities',
  'Dividend',
  'Healthcare',
])

export function evaluateEntryReadiness(params: {
  category: string
  isWatchlist: boolean
  role?: OpportunityRole
  currentPrice: number
  currency?: string
  rsi14: number | null
  sma50: number | null
  supportS1: number | null
  resistanceR1: number | null
  forwardPe?: number | null
  trailingPe?: number | null
}): EntryReadinessEvaluation {
  const {
    category,
    isWatchlist,
    role = 'SECTOR_ROTATION',
    currentPrice,
    currency = 'USD',
    rsi14,
    sma50,
    supportS1,
    resistanceR1,
    forwardPe = null,
    trailingPe = null,
  } = params

  const distanceAboveSma50Pct =
    sma50 && sma50 > 0 && currentPrice > 0
      ? Number((((currentPrice - sma50) / sma50) * 100).toFixed(1))
      : null

  const upsideToR1Pct =
    resistanceR1 && currentPrice > 0
      ? Number((((resistanceR1 - currentPrice) / currentPrice) * 100).toFixed(1))
      : null

  const downsideToS1Pct =
    supportS1 && currentPrice > 0
      ? Number((((currentPrice - supportS1) / currentPrice) * 100).toFixed(1))
      : null

  let riskRewardRatio: number | null = null
  if (upsideToR1Pct !== null && downsideToS1Pct !== null) {
    if (upsideToR1Pct <= 0) {
      riskRewardRatio = 0
    } else if (downsideToS1Pct <= 0.3) {
      riskRewardRatio = 3.5
    } else {
      riskRewardRatio = Number((upsideToR1Pct / downsideToS1Pct).toFixed(2))
    }
  }

  if (category === 'CashYield') {
    return {
      entryReadiness: 'READY_TO_ENTER',
      entryVerdictLabelTh: '🟢 พักเงินรับดอกเบี้ยได้ทันที',
      entryTimingScore: 17,
      entryCaution: null,
      distanceAboveSma50Pct,
      upsideToR1Pct,
      downsideToS1Pct,
      riskRewardRatio,
      valuationWarningTh: null,
    }
  }

  const effectivePe = forwardPe ?? trailingPe ?? null
  const isValuationStretched = Boolean(isWatchlist && effectivePe !== null && effectivePe > 40)
  const valuationWarningTh = isValuationStretched
    ? `Valuation ตึงตัว (${forwardPe ? `Fwd P/E ${forwardPe.toFixed(1)}x` : `P/E ${trailingPe!.toFixed(1)}x`})`
    : null

  const isLowVolGroup = DEFENSIVE_LOW_VOL_CATEGORIES.has(category)
  const mildSmaThreshold = isLowVolGroup ? 6 : 8
  const severeSmaThreshold = isLowVolGroup ? 9 : 12

  const severeReasons: string[] = []
  if (rsi14 !== null && rsi14 > 72) {
    severeReasons.push(`RSI ${rsi14.toFixed(1)} (>72 Overbought)`)
  }
  if (distanceAboveSma50Pct !== null && distanceAboveSma50Pct >= severeSmaThreshold) {
    severeReasons.push(`ราคาห่าง SMA50 +${distanceAboveSma50Pct.toFixed(1)}% (ตึงตัวสูง)`)
  }
  if (
    upsideToR1Pct !== null &&
    downsideToS1Pct !== null &&
    upsideToR1Pct <= 0.5 &&
    downsideToS1Pct >= 2.5
  ) {
    severeReasons.push(`ราคาจ่อ/ชนแนวต้าน R1 (Upside เหลือ ${upsideToR1Pct.toFixed(1)}% vs Downside -${downsideToS1Pct.toFixed(1)}%)`)
  }
  if (isValuationStretched && rsi14 !== null && rsi14 >= 62) {
    severeReasons.push(`${valuationWarningTh} + RSI สูง (${rsi14.toFixed(1)})`)
  }

  const mildReasons: string[] = []
  if (rsi14 !== null && rsi14 >= 64) {
    mildReasons.push(`RSI ${rsi14.toFixed(1)} เริ่มสูง`)
  }
  if (distanceAboveSma50Pct !== null && distanceAboveSma50Pct >= mildSmaThreshold) {
    mildReasons.push(`ห่าง SMA50 +${distanceAboveSma50Pct.toFixed(1)}%`)
  }
  if (
    riskRewardRatio !== null &&
    riskRewardRatio < 1.0 &&
    downsideToS1Pct !== null &&
    downsideToS1Pct >= 2.0
  ) {
    mildReasons.push(`R:R ${riskRewardRatio.toFixed(2)}x ไม่คุ้ม (<1.0x)`)
  }
  if (isValuationStretched) {
    mildReasons.push(valuationWarningTh!)
  }

  let entryReadiness: EntryReadinessStatus = 'READY_TO_ENTER'
  let entryVerdictLabelTh = '🟢 เข้าทยอยซื้อได้'
  let entryTimingScore = 15

  if (severeReasons.length > 0) {
    entryReadiness = 'TOO_HIGH_DO_NOT_CHASE'
    entryVerdictLabelTh = '🔴 สูงเกินเข้า (ห้ามไล่ราคา)'
    entryTimingScore = 3
  } else if (mildReasons.length > 0) {
    entryReadiness = 'WAIT_PULLBACK'
    entryVerdictLabelTh = '🟡 รอย่อก่อนค่อยเข้า'
    entryTimingScore = mildReasons.length >= 2 ? 7 : 9
  } else {
    if (rsi14 !== null && rsi14 <= 42) entryTimingScore = 18
    else if (rsi14 !== null && rsi14 <= 56) entryTimingScore = 16
    else entryTimingScore = 14

    if (downsideToS1Pct !== null && downsideToS1Pct <= 3.0) {
      entryTimingScore = Math.min(20, entryTimingScore + 2)
    }
    if (riskRewardRatio !== null && riskRewardRatio >= 1.8) {
      entryTimingScore = Math.min(20, entryTimingScore + 2)
    }
    if (sma50 && currentPrice >= sma50 * 0.99 && role !== 'CONTRARIAN_DIP') {
      entryTimingScore = Math.min(20, entryTimingScore + 1)
    }
  }

  const currSym = currency === 'THB' ? '฿' : '$'
  const s1Suggestion =
    supportS1 && downsideToS1Pct !== null && downsideToS1Pct > 0.5
      ? ` รอย่อ -${downsideToS1Pct.toFixed(1)}% แถวแนวรับ S1 (${currSym}${supportS1.toFixed(2)})`
      : supportS1
      ? ` อ้างอิงแนวรับ S1 (${currSym}${supportS1.toFixed(2)})`
      : ''

  let entryCaution: string | null = null
  if (entryReadiness === 'TOO_HIGH_DO_NOT_CHASE') {
    entryCaution = `ราคาสูง/ตึงตัวเกินเข้า: ${severeReasons.join(' · ')} — ห้ามไล่ราคา${s1Suggestion}`
  } else if (entryReadiness === 'WAIT_PULLBACK') {
    entryCaution = `ควรรอจังหวะย่อ: ${mildReasons.join(' · ')}${s1Suggestion}`
  }

  return {
    entryReadiness,
    entryVerdictLabelTh,
    entryTimingScore,
    entryCaution,
    distanceAboveSma50Pct,
    upsideToR1Pct,
    downsideToS1Pct,
    riskRewardRatio,
    valuationWarningTh,
  }
}

export function computeRegimeOpportunityScore(params: {
  role: OpportunityRole
  category?: string
  isWatchlist?: boolean
  currency?: string
  regime: DetectedMarketRegime
  rsVsQqq5D: number
  rsVsQqq21D: number
  rsVsQqq63D: number
  corr60DWithQqq: number
  rsi14: number | null
  currentPrice: number
  supportS1: number | null
  resistanceR1?: number | null
  sma50: number | null
  pullbackFrom6MHigh: number
  techExposurePercent: number
  alreadyHeldPct: number
  effectiveCategoryHeldPct?: number
  maxSinglePositionPercent: number
  forwardPe?: number | null
  trailingPe?: number | null
}): {
  totalScore: number
  scoreBreakdown: {
    relativeStrength: number
    hedgePower: number
    entryTiming: number
    portfolioFit: number
  }
  entryCaution: string | null
  readiness: EntryReadinessEvaluation
} {
  const {
    role,
    category = 'Other',
    isWatchlist = false,
    currency = 'USD',
    regime,
    rsVsQqq5D,
    rsVsQqq21D,
    rsVsQqq63D,
    corr60DWithQqq,
    rsi14,
    currentPrice,
    supportS1,
    resistanceR1 = null,
    sma50,
    pullbackFrom6MHigh,
    techExposurePercent,
    alreadyHeldPct,
    effectiveCategoryHeldPct = alreadyHeldPct,
    maxSinglePositionPercent,
    forwardPe = null,
    trailingPe = null,
  } = params

  // 1. Relative Strength vs QQQ (0 - 35)
  let relativeStrength = 16
  if (role === 'CONTRARIAN_DIP') {
    const dipScore = pullbackFrom6MHigh <= -6 && pullbackFrom6MHigh >= -25
      ? Math.min(20, Math.round(Math.abs(pullbackFrom6MHigh) * 1.1))
      : pullbackFrom6MHigh < -25
      ? 10
      : 6
    const bounceScore = rsVsQqq5D >= 0 ? Math.min(15, Math.round(8 + rsVsQqq5D * 1.5)) : Math.max(2, Math.round(7 + rsVsQqq5D))
    relativeStrength = Math.max(0, Math.min(35, dipScore + bounceScore))
  } else {
    const weightedRs = rsVsQqq5D * 0.3 + rsVsQqq21D * 0.45 + rsVsQqq63D * 0.25
    relativeStrength = Math.max(0, Math.min(35, Math.round(17 + weightedRs * 1.8)))
  }

  // 2. Hedge Power & Regime Alignment (0 - 25)
  let hedgePower = 4
  if (corr60DWithQqq <= 0.05) hedgePower = 22
  else if (corr60DWithQqq <= 0.25) hedgePower = 19
  else if (corr60DWithQqq <= 0.45) hedgePower = 15
  else if (corr60DWithQqq <= 0.65) hedgePower = 10
  else hedgePower = 5

  if (regime.preferredRoles[0] === role) hedgePower += 3
  else if (regime.preferredRoles.includes(role)) hedgePower += 2
  hedgePower = Math.max(0, Math.min(25, hedgePower))

  // 3. Entry Timing, Overextension & Risk/Reward Guardrail (0 - 20)
  const readiness = evaluateEntryReadiness({
    category,
    isWatchlist,
    role,
    currentPrice,
    currency,
    rsi14,
    sma50,
    supportS1,
    resistanceR1,
    forwardPe,
    trailingPe,
  })
  const entryTiming = readiness.entryTimingScore
  const entryCaution = readiness.entryCaution

  // 4. Portfolio Fit vs Concentration & AI Memory Cap (0 - 20)
  const cap = Math.max(0.01, maxSinglePositionPercent || 20)
  const effectivePct = Math.max(alreadyHeldPct, effectiveCategoryHeldPct)
  let portfolioFit = 12
  if (effectivePct >= cap) {
    portfolioFit = 2
  } else if (effectivePct >= cap * 0.75) {
    portfolioFit = 7
  } else {
    const diversifyBonus = techExposurePercent >= 35 && corr60DWithQqq <= 0.45 ? 5 : 2
    const unheldBonus = alreadyHeldPct < 1 ? 3 : 1
    portfolioFit = Math.min(20, 11 + diversifyBonus + unheldBonus)
  }

  const totalScore = Math.max(0, Math.min(100, relativeStrength + hedgePower + entryTiming + portfolioFit))
  return {
    totalScore,
    scoreBreakdown: { relativeStrength, hedgePower, entryTiming, portfolioFit },
    entryCaution,
    readiness,
  }
}

export function simulateHedgeImpact(params: {
  totalPortfolioValueBase: number
  techValueBase: number
  suggestedWeightPct: number
  betaToQqq: number
  baseCurrency: string
  shockPercent?: number
}): HedgeImpactEstimate | null {
  const {
    totalPortfolioValueBase,
    techValueBase,
    suggestedWeightPct,
    betaToQqq,
    baseCurrency,
    shockPercent = -15,
  } = params

  if (!(totalPortfolioValueBase > 0) || !(techValueBase > 0) || !(suggestedWeightPct > 0)) {
    return null
  }

  // Assume Tech cluster moves ~1.12x QQQ during sharp Tech selloffs
  const techBeta = 1.12
  const absShock = Math.abs(shockPercent) / 100
  const shiftAmount = totalPortfolioValueBase * (Math.min(30, suggestedWeightPct) / 100)
  const reducedTechValue = Math.max(0, techValueBase - shiftAmount)
  const effectiveShift = techValueBase - reducedTechValue

  if (!(effectiveShift > 0)) return null

  const baselineTechLoss = techValueBase * absShock * techBeta
  const shiftedCandidateLoss = effectiveShift * absShock * Math.max(-0.5, Math.min(1.5, betaToQqq))
  const remainingTechLoss = reducedTechValue * absShock * techBeta
  const hedgedLoss = Math.max(0, remainingTechLoss + shiftedCandidateLoss)
  const lossReductionBase = Math.max(0, Math.round(baselineTechLoss - hedgedLoss))
  const lossReductionPct = baselineTechLoss > 0
    ? Number(((lossReductionBase / baselineTechLoss) * 100).toFixed(1))
    : 0

  const sym = baseCurrency === 'THB' ? '฿' : '$'
  return {
    suggestedWeightPct,
    betaToQqq,
    shockPercent,
    baselineLossBase: Math.round(baselineTechLoss),
    hedgedLossBase: Math.round(hedgedLoss),
    lossReductionBase,
    lossReductionPct,
    summaryTh:
      lossReductionBase > 0
        ? `จำลองจากสถิติ 60 วัน: หากแบ่งสัดส่วน ${suggestedWeightPct}% (Beta ${betaToQqq.toFixed(2)}) และ Tech ร่วง ${shockPercent}% ช่วยลดแรงกระแทกฝั่ง Tech ได้ราว ${sym}${lossReductionBase.toLocaleString('th-TH')} (-${lossReductionPct}%)`
        : `ตัวนี้มีความผันผวนใกล้เคียงตลาด (Beta ${betaToQqq.toFixed(2)}) ใช้เพื่อหมุนหาโอกาสผลตอบแทนมากกว่าลด Drawdown`,
  }
}

export function rankRegimeOpportunities(params: {
  regime: DetectedMarketRegime
  qqqSeries: DailySeriesSnapshot
  candidates: Array<{
    spec: {
      ticker: string
      name: string
      category: string
      defaultRole: OpportunityRole
      isWatchlist: boolean
      market: string
      forwardPe?: number | null
      trailingPe?: number | null
    }
    series: DailySeriesSnapshot
  }>
  holdings: HoldingItem[]
  totalCashBase: number
  baseCurrency: string
  maxSinglePositionPercent: number
  positionBasis?: 'totalPortfolio' | 'investedAssets'
}): {
  candidates: RegimeOpportunityCandidate[]
  techExposurePercent: number
  goldExposurePercent: number
  cashPercent: number
} {
  const { regime, qqqSeries, candidates, holdings, totalCashBase, baseCurrency, maxSinglePositionPercent } = params
  const investedTotal = holdings.reduce((s, h) => s + Number(h.currentValueBase || 0), 0)
  const grandTotal = investedTotal + totalCashBase
  const cashPercent = grandTotal > 0 ? Number(((totalCashBase / grandTotal) * 100).toFixed(1)) : 0

  let techValue = 0
  let goldValue = 0
  const heldPctByTicker = new Map<string, number>()

  for (const h of holdings) {
    const val = Number(h.currentValueBase || 0)
    const broad = classifySector(h.ticker, h.assetType, h.market).broad
    if (broad === 'Technology') techValue += val
    if (broad === 'Gold & Commodities' || h.assetType === 'gold') goldValue += val
    const positionTotal = params.positionBasis === 'investedAssets' ? investedTotal : grandTotal
    const weight = positionTotal > 0 ? (val / positionTotal) * 100 : Number(h.allocationPercent || 0)
    const clean = h.ticker.toUpperCase().replace(/\.BK$/, '')
    heldPctByTicker.set(h.ticker.toUpperCase(), weight)
    if (!heldPctByTicker.has(clean)) heldPctByTicker.set(clean, weight)
  }

  const techExposurePercent = grandTotal > 0 ? Number(((techValue / grandTotal) * 100).toFixed(1)) : 0
  const goldExposurePercent = grandTotal > 0 ? Number(((goldValue / grandTotal) * 100).toFixed(1)) : 0

  const scored: RegimeOpportunityCandidate[] = candidates.map(({ spec, series }) => {
    const rsVsQqq5D = Number((series.return5D - qqqSeries.return5D).toFixed(2))
    const rsVsQqq21D = Number((series.return21D - qqqSeries.return21D).toFixed(2))
    const rsVsQqq63D = Number((series.return63D - qqqSeries.return63D).toFixed(2))
    const corr60DWithQqq = calculatePearsonCorrelation(series.closes, qqqSeries.closes, 60)
    const betaToQqq = calculateBetaToBenchmark(series.closes, qqqSeries.closes, 60)

    let role: OpportunityRole = spec.defaultRole
    if (spec.isWatchlist) {
      const broad = classifySector(spec.ticker, undefined, spec.market).broad
      if (broad === 'Gold & Commodities' || broad === 'Bonds & Fixed Income' || corr60DWithQqq <= 0.25) {
        role = 'DEFENSIVE_HEDGE'
      } else if (series.pullbackFrom6MHigh <= -6 || (series.rsi14 !== null && series.rsi14 <= 40)) {
        role = 'CONTRARIAN_DIP'
      } else {
        role = 'SECTOR_ROTATION'
      }
    }

    const cleanTicker = spec.ticker.toUpperCase().replace(/\.BK$/, '')
    const alreadyHeldPct = Number((heldPctByTicker.get(spec.ticker.toUpperCase()) ?? heldPctByTicker.get(cleanTicker) ?? 0).toFixed(1))
    const effectiveCategoryHeldPct = spec.category === 'Gold' ? Math.max(alreadyHeldPct, goldExposurePercent) : alreadyHeldPct

    const scoring = computeRegimeOpportunityScore({
      role,
      category: spec.category,
      isWatchlist: spec.isWatchlist,
      currency: series.currency,
      regime,
      rsVsQqq5D,
      rsVsQqq21D,
      rsVsQqq63D,
      corr60DWithQqq,
      rsi14: series.rsi14,
      currentPrice: series.currentPrice,
      supportS1: series.supportS1,
      resistanceR1: series.resistanceR1,
      sma50: series.sma50,
      pullbackFrom6MHigh: series.pullbackFrom6MHigh,
      techExposurePercent,
      alreadyHeldPct,
      effectiveCategoryHeldPct,
      maxSinglePositionPercent,
      forwardPe: spec.forwardPe ?? null,
      trailingPe: spec.trailingPe ?? null,
    })

    const suggestedWeightPct =
      role === 'DEFENSIVE_HEDGE'
        ? Math.min(maxSinglePositionPercent, 12, Math.max(5, Math.round(maxSinglePositionPercent * 0.5)))
        : Math.min(maxSinglePositionPercent, 10, Math.max(5, Math.round(maxSinglePositionPercent * 0.4)))

    const hedgeImpact =
      techValue > 0 && grandTotal > 0 && betaToQqq < 0.85
        ? simulateHedgeImpact({
            totalPortfolioValueBase: grandTotal,
            techValueBase: techValue,
            suggestedWeightPct,
            betaToQqq,
            baseCurrency,
          })
        : null

    const currSym = series.currency === 'THB' ? '฿' : '$'
    const entryZoneTh = series.supportS1
      ? `แบ่งไม้รอรับแถว ${currSym}${series.supportS1.toFixed(2)} – ${currSym}${series.currentPrice.toFixed(2)}`
      : `ราคาอ้างอิง ${currSym}${series.currentPrice.toFixed(2)}`

    const stopLossRefTh = series.supportS1
      ? `ทบทวน/หยุดถัวหากปิดหลุด ${currSym}${(series.supportS1 * 0.96).toFixed(2)} (-4% ใต้ S1)`
      : 'ตั้งจุดทบทวนตาม Max Drawdown ใน AI Memory'

    const quantReasons: string[] = [
      `1M ทำผลตอบแทน ${series.return21D >= 0 ? '+' : ''}${series.return21D.toFixed(1)}% (ดีกว่า/ต่างจาก QQQ ${rsVsQqq21D >= 0 ? '+' : ''}${rsVsQqq21D.toFixed(1)}%)`,
      `Correlation 60 วันกับ QQQ = ${corr60DWithQqq.toFixed(2)} (${corr60DWithQqq <= 0.2 ? 'กันกระแทกพอร์ต Tech ดีมาก' : corr60DWithQqq <= 0.45 ? 'ช่วยกระจายความเสี่ยงได้ดี' : 'อิงตลาดบางส่วน'})`,
      series.rsi14 !== null
        ? `RSI(14) = ${series.rsi14.toFixed(1)}${series.supportS1 ? ` | แนวรับ S1: ${currSym}${series.supportS1.toFixed(2)}` : ''}`
        : `แนวรับอ้างอิง S1: ${series.supportS1 ? `${currSym}${series.supportS1.toFixed(2)}` : 'ไม่มีข้อมูล'}`,
    ]

    return {
      ticker: spec.ticker,
      name: spec.name,
      category: spec.category,
      market: spec.market,
      currency: series.currency,
      isWatchlist: spec.isWatchlist,
      currentPrice: series.currentPrice,
      changePercent: series.changePercent,
      observedAt: series.observedAt,
      role,
      roleLabelTh: ROLE_LABELS_TH[role],
      totalScore: scoring.totalScore,
      scoreBreakdown: scoring.scoreBreakdown,
      rsVsQqq5D,
      rsVsQqq21D,
      rsVsQqq63D,
      corr60DWithQqq,
      rsi14: series.rsi14,
      sma50: series.sma50,
      supportS1: series.supportS1,
      resistanceR1: series.resistanceR1,
      pullbackFrom6MHigh: series.pullbackFrom6MHigh,
      entryReadiness: scoring.readiness.entryReadiness,
      entryVerdictLabelTh: scoring.readiness.entryVerdictLabelTh,
      distanceAboveSma50Pct: scoring.readiness.distanceAboveSma50Pct,
      upsideToR1Pct: scoring.readiness.upsideToR1Pct,
      downsideToS1Pct: scoring.readiness.downsideToS1Pct,
      riskRewardRatio: scoring.readiness.riskRewardRatio,
      forwardPe: spec.forwardPe ?? null,
      trailingPe: spec.trailingPe ?? null,
      valuationWarningTh: scoring.readiness.valuationWarningTh,
      entryCaution: scoring.entryCaution,
      alreadyHeldPct,
      entryZoneTh,
      stopLossRefTh,
      exitTriggerTh: regime.rotationExitTriggerTh,
      hedgeImpact,
      quantReasons,
    }
  })

  scored.sort((a, b) => b.totalScore - a.totalScore)

  // Pick diverse Top 5 (max 2 per category) so user gets a balanced mix across Gold/Bonds/Dividend/Defensive/Watchlist
  const picked: RegimeOpportunityCandidate[] = []
  const categoryCount = new Map<string, number>()
  for (const item of scored) {
    const count = categoryCount.get(item.category) || 0
    if (count >= 2 && picked.length < scored.length - 1) continue
    picked.push(item)
    categoryCount.set(item.category, count + 1)
    if (picked.length >= 5) break
  }

  return {
    candidates: picked,
    techExposurePercent,
    goldExposurePercent,
    cashPercent,
  }
}

async function fetchYahooDailySeriesSnapshot(
  rawSymbol: string,
  market: string,
  displayName: string,
  forceRefresh = false
): Promise<DailySeriesSnapshot | null> {
  const clean = rawSymbol.trim().toUpperCase()
  const yfSymbol = clean.startsWith('^')
    ? clean
    : market === 'TH' && !clean.endsWith('.BK')
    ? `${clean}.BK`
    : clean
  const cacheKey = yfSymbol

  const cached = seriesCache.get(cacheKey)
  const now = Date.now()
  if (!forceRefresh && cached && now - cached.timestamp < SERIES_CACHE_TTL_MS) {
    return cached.data
  }

  const inflight = inFlightSeries.get(cacheKey)
  if (inflight) return inflight

  const reqPromise = (async (): Promise<DailySeriesSnapshot | null> => {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
        yfSymbol
      )}?range=6mo&interval=1d`
      const res = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(4000),
        cache: 'no-store',
      })
      if (!res.ok) return cached?.data ?? null
      const json = await res.json()
      const result = json?.chart?.result?.[0]
      if (!result) return cached?.data ?? null

      const meta = result.meta || {}
      const timestamps: number[] = result.timestamp || []
      const quote = result.indicators?.quote?.[0] || {}
      const highsRaw: Array<number | null> = quote.high || []
      const lowsRaw: Array<number | null> = quote.low || []
      const closesRaw: Array<number | null> = quote.close || []

      const closes: number[] = []
      const highs: number[] = []
      const lows: number[] = []
      let lastBarMs: number | undefined

      for (let i = 0; i < timestamps.length; i++) {
        const c = closesRaw[i]
        if (c !== null && c !== undefined && Number.isFinite(c) && c > 0) {
          lastBarMs = timestamps[i] * 1000
          closes.push(Number(c))
          highs.push(Number(highsRaw[i] ?? c))
          lows.push(Number(lowsRaw[i] ?? c))
        }
      }

      if (closes.length < 15) return cached?.data ?? null

      const currentPrice = Number(meta.regularMarketPrice ?? closes[closes.length - 1])
      if (!(currentPrice > 0)) return cached?.data ?? null

      const prevClose = Number(
        meta.previousClose ??
          meta.regularMarketPreviousClose ??
          meta.chartPreviousClose ??
          closes[closes.length - 2] ??
          currentPrice
      )
      const changePercent =
        typeof meta.regularMarketChangePercent === 'number' && Number.isFinite(meta.regularMarketChangePercent)
          ? Number(meta.regularMarketChangePercent.toFixed(2))
          : prevClose > 0
          ? Number((((currentPrice - prevClose) / prevClose) * 100).toFixed(2))
          : 0

      const obsMs = typeof meta.regularMarketTime === 'number' ? meta.regularMarketTime * 1000 : lastBarMs
      const observedAt = getObservationTime(obsMs, Date.now())
      if (!observedAt) return null

      const rsi14 = calculateWildersRSI(closes, 14)
      const sma50 = calculateSMA(closes, 50)

      // 22 trading-day Pivot Support/Resistance
      const pivotBars = closes.slice(-22)
      const pivotHigh = Math.max(...highs.slice(-22))
      const pivotLow = Math.min(...lows.slice(-22))
      const pivotClose = pivotBars[pivotBars.length - 1]
      const pivot = (pivotHigh + pivotLow + pivotClose) / 3
      const supportS1 = Number((2 * pivot - pivotHigh).toFixed(2))
      const resistanceR1 = Number((2 * pivot - pivotLow).toFixed(2))

      const sixMonthHigh = Math.max(...highs, currentPrice)
      const pullbackFrom6MHigh = sixMonthHigh > 0
        ? Number((((currentPrice - sixMonthHigh) / sixMonthHigh) * 100).toFixed(2))
        : 0

      const snap: DailySeriesSnapshot = {
        symbol: clean,
        name: displayName || meta.shortName || meta.longName || clean,
        market,
        currency: String(meta.currency || (market === 'TH' ? 'THB' : 'USD')),
        currentPrice: Number(currentPrice.toFixed(2)),
        changePercent,
        observedAt,
        closes,
        highs,
        lows,
        return5D: windowReturnPct(closes, 5),
        return21D: windowReturnPct(closes, 21),
        return63D: windowReturnPct(closes, 63),
        rsi14,
        sma50,
        supportS1,
        resistanceR1,
        pullbackFrom6MHigh,
      }

      seriesCache.set(cacheKey, { data: snap, timestamp: Date.now() })
      return snap
    } catch {
      return cached?.data ?? null
    } finally {
      inFlightSeries.delete(cacheKey)
    }
  })()

  inFlightSeries.set(cacheKey, reqPromise)
  return reqPromise
}

export async function getLiveRegimeOpportunities(params: {
  holdings: HoldingItem[]
  watchlists: Array<{ symbol: string; displayName: string; itemType: string }>
  totalCashBase: number
  baseCurrency: string
  maxSinglePositionPercent?: number
  positionBasis?: 'totalPortfolio' | 'investedAssets'
  forceRefresh?: boolean
}): Promise<RegimeOpportunitiesReport | null> {
  const {
    holdings,
    watchlists,
    totalCashBase,
    baseCurrency,
    maxSinglePositionPercent = 20,
    positionBasis,
    forceRefresh = false,
  } = params

  const etfSet = new Set(REGIME_ETF_UNIVERSE.map((u) => u.ticker))
  const heldSet = new Set(holdings.map((h) => h.ticker.toUpperCase()))

  const extraWatchlistSpecs = watchlists
    .filter((w) => {
      const sym = w.symbol.trim().toUpperCase()
      return sym && w.itemType !== 'crypto' && !etfSet.has(sym) && !heldSet.has(sym)
    })
    .slice(0, 6)
    .map((w) => {
      const sym = w.symbol.trim().toUpperCase()
      const market = sym.endsWith('.BK') ? 'TH' : 'US'
      return {
        ticker: sym,
        name: w.displayName || sym,
        category: 'Watchlist',
        defaultRole: 'CONTRARIAN_DIP' as OpportunityRole,
        isWatchlist: true,
        market,
      }
    })

  const candidateSpecs = [
    ...REGIME_ETF_UNIVERSE.map((u) => ({ ...u, isWatchlist: false })),
    ...extraWatchlistSpecs,
  ]

  const [qqqSeries, spySeries, vixSeries, tnxSeries, candidateSeriesList] = await Promise.all([
    fetchYahooDailySeriesSnapshot('QQQ', 'US', 'Invesco QQQ Trust', forceRefresh),
    fetchYahooDailySeriesSnapshot('SPY', 'US', 'SPDR S&P 500 ETF', forceRefresh),
    fetchYahooDailySeriesSnapshot('^VIX', 'US', 'CBOE VIX Index', forceRefresh),
    fetchYahooDailySeriesSnapshot('^TNX', 'US', 'US 10Y Treasury Yield', forceRefresh),
    Promise.all(
      candidateSpecs.map(async (spec) => {
        const yfSummarySym =
          spec.market === 'TH' && !spec.ticker.endsWith('.BK') ? `${spec.ticker}.BK` : spec.ticker
        const [series, summary] = await Promise.all([
          fetchYahooDailySeriesSnapshot(spec.ticker, spec.market, spec.name, forceRefresh),
          spec.isWatchlist
            ? getYahooQuoteSummary(yfSummarySym).catch(() => null)
            : Promise.resolve(null),
        ])
        return {
          spec: {
            ...spec,
            forwardPe: summary?.forwardPe ?? null,
            trailingPe: summary?.pe ?? null,
          },
          series,
        }
      })
    ),
  ])

  if (!qqqSeries || !spySeries) return null

  const validCandidates = candidateSeriesList.filter(
    (entry): entry is {
      spec: (typeof candidateSpecs)[number] & { forwardPe: number | null; trailingPe: number | null }
      series: DailySeriesSnapshot
    } => Boolean(entry.series && entry.series.currentPrice > 0)
  )

  if (validCandidates.length === 0) return null

  const regime = detectMarketRegime({
    qqqReturn21D: qqqSeries.return21D,
    spyReturn21D: spySeries.return21D,
    qqqPullback6M: qqqSeries.pullbackFrom6MHigh,
    qqqAboveSma50: qqqSeries.sma50 ? qqqSeries.currentPrice >= qqqSeries.sma50 : true,
    spyAboveSma50: spySeries.sma50 ? spySeries.currentPrice >= spySeries.sma50 : true,
    vixPrice: vixSeries?.currentPrice ?? null,
    us10yYield: tnxSeries?.currentPrice ?? null,
  })

  const ranked = rankRegimeOpportunities({
    regime,
    qqqSeries,
    candidates: validCandidates,
    holdings,
    totalCashBase,
    baseCurrency,
    maxSinglePositionPercent,
    positionBasis,
  })

  const top = ranked.candidates[0]
  const topSummaryTh = top
    ? `สภาวะตลาด: ${regime.labelTh} | ตัวเด่นอันดับ 1: ${top.ticker} (${top.totalScore}/100, RS 1M vs QQQ ${top.rsVsQqq21D >= 0 ? '+' : ''}${top.rsVsQqq21D.toFixed(1)}%, Corr ${top.corr60DWithQqq.toFixed(2)})`
    : regime.summaryTh

  return {
    generatedAt: new Date().toISOString(),
    regime,
    techExposurePercent: ranked.techExposurePercent,
    goldExposurePercent: ranked.goldExposurePercent,
    cashPercent: ranked.cashPercent,
    baseCurrency,
    candidates: ranked.candidates,
    topSummaryTh,
  }
}

export function formatRegimeOpportunitiesForPrompt(report: RegimeOpportunitiesReport): string {
  const lines: string[] = [
    `=== โอกาสทำกำไรและตัวกันกระแทกตามสภาวะตลาด (LONG-ONLY QUANT REGIME ALPHA) ===`,
    `- สภาวะตลาดที่ตรวจพบ: ${report.regime.labelTh} | QQQ 1M: ${report.regime.qqqReturn21D >= 0 ? '+' : ''}${report.regime.qqqReturn21D}% vs SPY 1M: ${report.regime.spyReturn21D >= 0 ? '+' : ''}${report.regime.spyReturn21D}% | VIX: ${report.regime.vixPrice ?? 'N/A'} | US10Y: ${report.regime.us10yYield ?? 'N/A'}%`,
    `- น้ำหนักพอร์ตปัจจุบัน: Tech ${report.techExposurePercent}% | Gold ${report.goldExposurePercent}% | Cash ${report.cashPercent}%`,
  ]

  for (const c of report.candidates) {
    const curr = c.currency === 'THB' ? '฿' : '$'
    const smaStr = c.distanceAboveSma50Pct !== null ? `${c.distanceAboveSma50Pct >= 0 ? '+' : ''}${c.distanceAboveSma50Pct}%` : 'N/A'
    const rrStr = c.riskRewardRatio !== null ? `${c.riskRewardRatio.toFixed(2)}x` : 'N/A'
    lines.push(
      `  • [${c.ticker}] ${c.name} (${c.roleLabelTh}) | สถานะเข้าซื้อ: ${c.entryVerdictLabelTh} | Score ${c.totalScore}/100 | ราคา ${curr}${c.currentPrice} (ณ ${c.observedAt.slice(0, 10)}) | RS 1M vs QQQ: ${c.rsVsQqq21D >= 0 ? '+' : ''}${c.rsVsQqq21D}% | Corr 60D: ${c.corr60DWithQqq} | RSI ${c.rsi14 ?? 'N/A'} | ห่าง SMA50: ${smaStr} | R:R: ${rrStr} | S1 ${c.supportS1 ?? 'N/A'} | ถืออยู่แล้ว ${c.alreadyHeldPct}%${c.valuationWarningTh ? ` | ⚠️ ${c.valuationWarningTh}` : ''}${c.entryCaution ? ` | ⚠️ ${c.entryCaution}` : ''}${c.hedgeImpact ? ` | ${c.hedgeImpact.summaryTh}` : ''}`
    )
  }

  return lines.join('\n')
}
