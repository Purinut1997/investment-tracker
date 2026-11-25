import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { calculateUserHoldings } from '@/lib/analytics/holdings'
import { yahooFinanceProvider } from '@/lib/market-data/yahoo'
import type { MarketQuote } from '@/lib/market-data/types'
import { coinGeckoProvider } from '@/lib/market-data/coingecko'
import { fetchRealHumanSentiment } from '@/lib/market-data/fear-greed'
import { getBatchTechnicalSignals } from '@/lib/market-data/technical-signals'
import { callGemini } from '@/lib/ai/gemini-client'
import { formatMarketObservation, getObservationTime } from '@/lib/ai/advisor-evidence'
import { parseModelJson } from '@/lib/ai/model-contracts'
import { z } from 'zod'
import { sumAccountCashInBaseCurrency } from '@/lib/market-data/frankfurter'
import {
  gatherPortfolioDeepIntelligence,
  computeAdviceOutcomeMetrics,
  formatOutcomeMetricsForPrompt,
  AdviceOutcomeMetrics,
} from '@/lib/ai/portfolio-intelligence'

export const maxDuration = 45

const tacticalText = z.string().trim().max(2000)
const tacticalNarrativeSchema = z.object({
  marketRegime: z.object({
    status: z.enum(['VOLATILE_CAUTION', 'EARLY_ACCUMULATION', 'BULL_EXPANSION', 'DEFENSIVE_ROTATION']),
    statusLabelTh: tacticalText,
    summaryTh: tacticalText,
    pillars: z.object({
      sentiment: z.object({ summary: tacticalText.optional() }).optional(),
      momentum: z.object({
        spxEmaStatus: tacticalText.optional(), nasdaqEmaStatus: tacticalText.optional(),
        breadthStatus: tacticalText.optional(), summary: tacticalText.optional(),
      }).optional(),
      macroLiquidity: z.object({
        fedPolicyStance: tacticalText.optional(), inflationExpectation: tacticalText.optional(), summary: tacticalText.optional(),
      }).optional(),
      catalystsAndFlows: z.object({
        safeHavenFlow: z.enum(['RISK_ON', 'DEFENSIVE_ROTATION', 'CASH_PRESERVATION']).optional(),
        safeHavenFlowLabel: tacticalText.optional(), keyCatalysts: z.array(tacticalText).max(12).optional(),
        summary: tacticalText.optional(),
      }).optional(),
      formula: z.object({ greenlightTrigger: tacticalText.optional(), redflagTrigger: tacticalText.optional() }).optional(),
    }).optional(),
  }),
  portfolioResilience: z.object({
    score: z.number().min(0).max(100), status: z.enum(['STRONG', 'MODERATE', 'FRAGILE']),
    statusLabelTh: tacticalText, strengths: z.array(tacticalText).max(20), vulnerabilities: z.array(tacticalText).max(20),
    thematicRiskAlert: tacticalText.nullish(),
  }),
  tacticalActions: z.array(z.object({
    ticker: z.string().min(1).max(32), market: z.enum(['US', 'TH', 'CRYPTO']),
    action: z.enum(['ACCUMULATE', 'HOLD_WATCH', 'TRIM_PROFIT', 'CASH_PRESERVE']),
    actionLabel: tacticalText, badgeColor: z.enum(['emerald', 'amber', 'rose', 'indigo', 'sky']),
    targetZone: tacticalText, tranchePlan: tacticalText, stopLossPoint: tacticalText, rationale: tacticalText,
    taxImpactNote: tacticalText.nullish(),
  })).max(30),
  cashStrategy: z.object({ recommendedCashPercent: z.number().min(0).max(100), guidanceText: tacticalText }),
  trackRecordReview: z.array(z.object({
    period: tacticalText, recommendationSummary: tacticalText, outcomeAssessment: tacticalText,
    accuracyStatus: z.enum(['ACCURATE', 'NEUTRAL', 'CAUTION']),
  })).max(15).optional(),
})

class MarketEvidenceUnavailable extends Error {}

export interface TacticalActionItem {
  id: string
  ticker: string
  assetName: string
  market: 'US' | 'TH' | 'CRYPTO'
  action: 'ACCUMULATE' | 'HOLD_WATCH' | 'TRIM_PROFIT' | 'CASH_PRESERVE'
  actionLabel: string
  badgeColor: 'emerald' | 'amber' | 'rose' | 'indigo' | 'sky'
  currentPrice: number
  currency: string
  targetZone: string
  tranchePlan: string
  stopLossPoint: string
  rationale: string
  taxImpactNote?: string
}

export interface MarketSentimentPillar {
  fearGreedScore: number
  fearGreedRating: string
  fearGreedLabelTh: string
  fearGreed1WDiff: number // difference from 1 week ago (e.g. -3 pts)
  previous1WeekScore: number
  vixValue: number
  vixStatus: 'NORMAL' | 'ELEVATED' | 'HIGH' | 'PANIC'
  vixStatusLabel: string
  summary: string
}

export interface MarketMomentumPillar {
  spxPrice: number
  spxChangePercent: number
  spxFiftyTwoHigh?: number
  spxDrawdownPercent: number
  spxEmaStatus: string
  nasdaqPrice: number
  nasdaqChangePercent: number
  nasdaqFiftyTwoHigh?: number
  nasdaqDrawdownPercent: number
  nasdaqEmaStatus: string
  breadthStatus: string
  summary: string
}

export interface MarketMacroLiquidityPillar {
  us10yYield: number
  yieldPressureLevel: 'LOW' | 'MODERATE' | 'HIGH'
  yieldPressureLabel: string
  fedPolicyStance: string
  inflationExpectation: string
  summary: string
}

export interface MarketCatalystsAndFlowsPillar {
  safeHavenFlow: 'RISK_ON' | 'DEFENSIVE_ROTATION' | 'CASH_PRESERVATION'
  safeHavenFlowLabel: string
  goldPrice: number
  goldChangePercent?: number
  dxyPrice: number
  oilPrice?: number
  keyCatalysts: string[]
  summary: string
}

export interface MarketClimateFormula {
  calculatedRiskScore: number // 1 - 5
  calculatedRiskLabel: string
  posture: 'BULL_AGGRESSIVE' | 'DEFENSIVE_TACTICAL' | 'CASH_PRESERVATION'
  postureLabelTh: string
  postureSubtitleTh: string
  formulaEquation: string
  greenlightTrigger: string
  redflagTrigger: string
}

export interface MarketPillarsData {
  sentiment: MarketSentimentPillar
  momentum: MarketMomentumPillar
  macroLiquidity: MarketMacroLiquidityPillar
  catalystsAndFlows: MarketCatalystsAndFlowsPillar
  formula: MarketClimateFormula
}

export interface TacticalAdvisorPayload {
  asOfDate: string
  asOfDateThai: string
  marketRegime: {
    status: 'VOLATILE_CAUTION' | 'EARLY_ACCUMULATION' | 'BULL_EXPANSION' | 'DEFENSIVE_ROTATION'
    statusLabelTh: string
    summaryTh: string
    riskLevel: number // 1 - 5
    riskLevelLabel: string
    fearGreedScore: number
    fearGreedLabel: string
    macroDrivers: string[]
    pillars: MarketPillarsData
  }
  portfolioResilience: {
    score: number // 0 - 100
    status: 'STRONG' | 'MODERATE' | 'FRAGILE'
    statusLabelTh: string
    strengths: string[]
    vulnerabilities: string[]
    thematicRiskAlert?: string | null
  }
  tacticalActions: TacticalActionItem[]
  cashStrategy: {
    recommendedCashPercent: number
    currentCashPercent: number
    currentCashTotalBase: number
    baseCurrency: string
    guidanceText: string
  }
  trackRecordReview: Array<{
    period: string
    recommendationSummary: string
    outcomeAssessment: string
    accuracyStatus: 'ACCURATE' | 'NEUTRAL' | 'CAUTION'
  }>
  outcomeMetrics?: AdviceOutcomeMetrics
  modelUsed?: string
  generatedAt: string
  marketEvidence?: Array<{ symbol: string; provider: string; observedAt: string }>
}

export function getBangkokDateString(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return formatter.format(date)
}

export function formatThaiDate(date: Date): string {
  return date.toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Bangkok',
  })
}

export function parseAdviceResponse(rawText: string): any {
  return parseModelJson(rawText)
}

export function createFallbackPillars(rawJson: any): MarketPillarsData {
  const fgScore = Number(rawJson?.marketRegime?.fearGreedScore) || 39
  const riskLevel = Number(rawJson?.marketRegime?.riskLevel) || 4
  const riskLevelLabel = rawJson?.marketRegime?.riskLevelLabel || 'ความเสี่ยงระดับสูง'
  const macroDrivers = rawJson?.marketRegime?.macroDrivers || [
    'ดัชนีตลาดหุ้นสหรัฐฯ (S&P 500, NASDAQ) ปรับตัวลงต่อเนื่องในรอบสัปดาห์',
    'อัตราผลตอบแทนพันธบัตรรัฐบาลสหรัฐฯ 10 ปี (US 10Y Bond Yield) ทรงตัวสูง บ่งชี้แรงกดดันเงินเฟ้อ',
    'ดัชนีความผันผวน VIX อยู่ในระดับสูง สะท้อนความกังวลของตลาด',
  ]

  let posture: 'BULL_AGGRESSIVE' | 'DEFENSIVE_TACTICAL' | 'CASH_PRESERVATION' = 'DEFENSIVE_TACTICAL'
  let postureLabelTh = '🛡️ ตั้งรับรอจังหวะ (Defensive Tactical)'
  let postureSubtitleTh = 'แบ่งไม้สะสมเฉพาะหุ้นพื้นฐานแกร่งที่ลงมาแนวรับสำคัญ ไม่ไล่ราคา'
  if (riskLevel <= 2) {
    posture = 'BULL_AGGRESSIVE'
    postureLabelTh = '🚀 บุกสะสมเชิงรุก (Aggressive Accumulation)'
    postureSubtitleTh = 'ตลาดเอื้ออำนวย ความเสี่ยงต่ำ ทยอยเพิ่มสัดส่วนสินทรัพย์เติบโต'
  } else if (riskLevel >= 5) {
    posture = 'CASH_PRESERVATION'
    postureLabelTh = '🔴 ถือเงินสดหลบภัย (Capital Preservation)'
    postureSubtitleTh = 'ความเสี่ยงสูงผิดปกติ หยุดซื้อถัว ถือเงินสดสำรองรอจุดกลับตัว'
  }

  return {
    sentiment: {
      fearGreedScore: fgScore,
      fearGreedRating: fgScore <= 25 ? 'extreme_fear' : fgScore <= 45 ? 'fear' : 'neutral',
      fearGreedLabelTh: rawJson?.marketRegime?.fearGreedLabel || 'ตลาดกังวล (Fear)',
      fearGreed1WDiff: -3,
      previous1WeekScore: fgScore + 3,
      vixValue: 19.3,
      vixStatus: 'NORMAL',
      vixStatusLabel: '<20 สภาวะปกติ / เสถียรภาพสูง',
      summary: 'ความรู้สึกของนักลงทุนอยู่ในแดนกังวล (Fear) สะท้อนความผันผวนและการพักฐานระยะสั้น',
    },
    momentum: {
      spxPrice: 7561.67,
      spxChangePercent: -0.42,
      spxFiftyTwoHigh: 7844.52,
      spxDrawdownPercent: -3.61,
      spxEmaStatus: 'พักฐานทดสอบแนวรับ EMA 50 วัน / ยังยืนเหนือ EMA 200 วัน',
      nasdaqPrice: 25136.27,
      nasdaqChangePercent: -0.84,
      nasdaqFiftyTwoHigh: 27722.75,
      nasdaqDrawdownPercent: -9.33,
      nasdaqEmaStatus: 'กลุ่มเทคโนโลยีย่อตัวทดสอบแนวรับสำคัญหลังทำ All-Time High',
      breadthStatus: 'หุ้นใหญ่ประคองดัชนี ขณะที่หุ้นกลาง-เล็กเผชิญแรงขายปรับฐาน (Mega-cap Divergence)',
      summary: 'ดัชนีหลักย่อตัวจากจุดสูงสุด (% Drawdown) อยู่ในโซนปรับฐานปกติ ยังไม่เสียโครงสร้างใหญ่',
    },
    macroLiquidity: {
      us10yYield: 4.42,
      yieldPressureLevel: 'HIGH',
      yieldPressureLabel: '>4.40% แรงกดดันสูง (High Pressure)',
      fedPolicyStance: 'คาดการณ์ Fed คงอัตราดอกเบี้ยระดับสูง ชะลอการปรับลดดอกเบี้ยนโยบาย',
      inflationExpectation: 'ตัวเลขเงินเฟ้อ CPI/PCE ทรงตัวหนืด กดดันต้นทุนทางการเงินในระยะยาว',
      summary: 'Bond Yield สหรัฐฯ ทรงตัวสูง เป็นอุปสรรคต่อ Valuation และทวีความผันผวนต่อหุ้น Growth',
    },
    catalystsAndFlows: {
      safeHavenFlow: 'DEFENSIVE_ROTATION',
      safeHavenFlowLabel: 'กระจายเข้าสินทรัพย์ปลอดภัย (Safe-Haven)',
      goldPrice: 3886.3,
      goldChangePercent: 0.45,
      dxyPrice: 103.41,
      oilPrice: 88.56,
      keyCatalysts: macroDrivers,
      summary: 'มีแรงซื้อเข้าหาสินทรัพย์ปลอดภัย เช่น ทองคำและดอลลาร์สหรัฐฯ เพื่อลดความเสี่ยง',
    },
    formula: {
      calculatedRiskScore: riskLevel,
      calculatedRiskLabel: riskLevelLabel,
      posture,
      postureLabelTh,
      postureSubtitleTh,
      formulaEquation: `โมเมนตัม S&P 500 ย่อตัว (-3.6%) + อารมณ์กังวล (F&G ${fgScore}) + Bond Yield ตึงตัว ➔ ระดับความเสี่ยง (${riskLevel}/5)`,
      greenlightTrigger: 'VIX ปรับตัวลงต่ำกว่า 20 หรือ Fear & Greed ดิ่งแตะโซน Extreme Fear (<25) ร่วมกับ S&P 500 ยืนเหนือแนวรับ EMA 200 วัน',
      redflagTrigger: 'US 10Y Yield ดีดทะลุ 4.60% หรือ VIX พุ่งทะลุ 30 จุด (ต้องหยุดช้อนซื้อและถือเงินสดเข้มงวด)',
    },
  }
}

export function computeDeterministicClimate(params: {
  spxDrawdown: number
  nasdaqDrawdown: number
  fearGreedScore: number
  vixPrice: number
  us10yYield: number
}) {
  const { spxDrawdown, fearGreedScore, vixPrice, us10yYield } = params

  // 1. Drawdown factor (1 - 5)
  let drawdownRisk = 2
  if (spxDrawdown > -2) drawdownRisk = 1
  else if (spxDrawdown > -5) drawdownRisk = 2
  else if (spxDrawdown > -10) drawdownRisk = 3
  else if (spxDrawdown > -15) drawdownRisk = 4
  else drawdownRisk = 5

  // 2. Fear & Volatility factor (1 - 5)
  let fearRisk = 2
  if (fearGreedScore < 0) fearRisk = vixPrice < 18 ? 1 : vixPrice < 20 ? 2 : vixPrice <= 25 ? 3 : vixPrice < 30 ? 4 : 5
  else if (fearGreedScore >= 60 && vixPrice < 18) fearRisk = 1
  else if (fearGreedScore >= 45 && vixPrice < 20) fearRisk = 2
  else if (fearGreedScore >= 35 || (vixPrice >= 20 && vixPrice <= 25)) fearRisk = 3
  else if (fearGreedScore >= 25 || (vixPrice > 25 && vixPrice <= 30)) fearRisk = 4
  else fearRisk = 5 // Extreme Fear or VIX > 30

  // 3. Rate & Yield pressure factor (1 - 5)
  let yieldRisk = 2
  if (us10yYield < 3.9) yieldRisk = 1
  else if (us10yYield <= 4.2) yieldRisk = 2
  else if (us10yYield <= 4.45) yieldRisk = 3
  else if (us10yYield <= 4.7) yieldRisk = 4
  else yieldRisk = 5

  const combinedRisk = Math.min(
    5,
    Math.max(1, Math.round(drawdownRisk * 0.35 + fearRisk * 0.35 + yieldRisk * 0.3))
  )

  let posture: 'BULL_AGGRESSIVE' | 'DEFENSIVE_TACTICAL' | 'CASH_PRESERVATION' = 'DEFENSIVE_TACTICAL'
  let postureLabelTh = '🛡️ ตั้งรับรอจังหวะ (Defensive Tactical)'
  let postureSubtitleTh = 'แบ่งไม้ทยอยสะสมเฉพาะหุ้นพื้นฐานแกร่งที่ลงมาแนวรับสำคัญ ไม่ไล่ราคา'

  if (combinedRisk <= 2) {
    posture = 'BULL_AGGRESSIVE'
    postureLabelTh = '🚀 บุกสะสมเชิงรุก (Aggressive Accumulation)'
    postureSubtitleTh = 'ตลาดเอื้ออำนวย ความเสี่ยงต่ำ ทยอยเพิ่มสัดส่วนสินทรัพย์เติบโต'
  } else if (combinedRisk >= 5 || vixPrice >= 30 || (fearGreedScore >= 0 && fearGreedScore <= 20)) {
    posture = 'CASH_PRESERVATION'
    postureLabelTh = '🔴 ถือเงินสดหลบภัย (Capital Preservation)'
    postureSubtitleTh = 'ตลาดมีความเสี่ยงสูงผิดปกติ หยุดซื้อถัว ถือเงินสดสำรองรอจุดกลับตัว'
  }

  const riskLabels: Record<number, string> = {
    1: 'ความเสี่ยงต่ำมาก (Low Risk)',
    2: 'ความเสี่ยงต่ำ (Moderate-Low)',
    3: 'ความเสี่ยงปานกลาง (Balanced)',
    4: 'ความเสี่ยงระดับสูง (Elevated Caution)',
    5: 'ความเสี่ยงวิกฤต/ผันผวนรุนแรง (High Risk)',
  }

  return {
    riskScore: combinedRisk,
    riskLabel: riskLabels[combinedRisk] || 'ความเสี่ยงระดับสูง',
    posture,
    postureLabelTh,
    postureSubtitleTh,
  }
}

function reconcileMarketPillars(
  rawPillars: any,
  real: {
    spxPrice: number
    spxChangePercent: number
    spxFiftyTwoHigh: number
    spxDrawdownPercent: number
    nasdaqPrice: number
    nasdaqChangePercent: number
    nasdaqFiftyTwoHigh: number
    nasdaqDrawdownPercent: number
    vixPrice: number
    us10yYield: number
    fearGreedScore: number
    fearGreedLabelTh: string
    fearGreed1WDiff: number
    previous1WeekScore: number
    dxyPrice: number
    goldPrice: number
    oilPrice?: number
    goldChangePercent?: number
    deterministicClimate: ReturnType<typeof computeDeterministicClimate>
  }
): MarketPillarsData {
  const vixStatus =
    real.vixPrice < 20
      ? 'NORMAL'
      : real.vixPrice < 25
      ? 'ELEVATED'
      : real.vixPrice < 30
      ? 'HIGH'
      : 'PANIC'

  const vixStatusLabel =
    real.vixPrice < 20
      ? '<20 สภาวะปกติ / เสถียรภาพสูง'
      : real.vixPrice < 25
      ? '20-25 กังวล / ผันผวนยกระดับ'
      : real.vixPrice < 30
      ? '25-30 ความเสี่ยงสูง / ผันผวนหนัก'
      : '>30 ตื่นตระหนกสุดขีด / Panic'

  const yieldPressureLevel =
    real.us10yYield < 4.0
      ? 'LOW'
      : real.us10yYield <= 4.4
      ? 'MODERATE'
      : 'HIGH'

  const yieldPressureLabel =
    real.us10yYield < 4.0
      ? '<4.00% ผ่อนคลาย เอื้อต่อสินทรัพย์เสี่ยง'
      : real.us10yYield <= 4.4
      ? '4.00-4.40% ตึงตัวปานกลาง'
      : '>4.40% แรงกดดันสูง (High Pressure)'

  return {
    sentiment: {
      fearGreedScore: real.fearGreedScore,
      fearGreedRating:
        real.fearGreedScore < 0 ? 'unavailable' : real.fearGreedScore <= 25 ? 'extreme_fear' : real.fearGreedScore <= 45 ? 'fear' : 'neutral',
      fearGreedLabelTh: real.fearGreedLabelTh,
      fearGreed1WDiff: real.fearGreed1WDiff,
      previous1WeekScore: real.previous1WeekScore,
      vixValue: real.vixPrice,
      vixStatus,
      vixStatusLabel,
      summary:
        rawPillars?.sentiment?.summary ||
        `VIX อยู่ที่ ${real.vixPrice.toFixed(2)} จุด (${vixStatusLabel})`,
    },
    momentum: {
      spxPrice: real.spxPrice,
      spxChangePercent: real.spxChangePercent,
      spxFiftyTwoHigh: real.spxFiftyTwoHigh,
      spxDrawdownPercent: real.spxDrawdownPercent,
      spxEmaStatus:
        rawPillars?.momentum?.spxEmaStatus ||
        'ไม่มีข้อมูล EMA ของดัชนีในรายงานนี้',
      nasdaqPrice: real.nasdaqPrice,
      nasdaqChangePercent: real.nasdaqChangePercent,
      nasdaqFiftyTwoHigh: real.nasdaqFiftyTwoHigh,
      nasdaqDrawdownPercent: real.nasdaqDrawdownPercent,
      nasdaqEmaStatus:
        rawPillars?.momentum?.nasdaqEmaStatus ||
        'ไม่มีข้อมูล EMA ของดัชนีในรายงานนี้',
      breadthStatus:
        rawPillars?.momentum?.breadthStatus ||
        'ไม่มีข้อมูล Market Breadth โดยตรง',
      summary:
        rawPillars?.momentum?.summary ||
        `ดัชนีหลักอยู่ในช่วงปรับฐานย่อตัว โดย S&P 500 ย่อตัว ${real.spxDrawdownPercent.toFixed(2)}% และ NASDAQ ย่อตัว ${real.nasdaqDrawdownPercent.toFixed(2)}%`,
    },
    macroLiquidity: {
      us10yYield: real.us10yYield,
      yieldPressureLevel,
      yieldPressureLabel,
      fedPolicyStance:
        rawPillars?.macroLiquidity?.fedPolicyStance ||
        'ไม่มีข้อมูลยืนยันแนวโน้มนโยบาย Fed',
      inflationExpectation:
        rawPillars?.macroLiquidity?.inflationExpectation ||
        'ไม่มีข้อมูล CPI/PCE ที่ใช้ยืนยันแนวโน้มในรอบนี้',
      summary:
        rawPillars?.macroLiquidity?.summary ||
        `US 10Y Yield อยู่ที่ ${real.us10yYield.toFixed(2)}% (${yieldPressureLabel}) ส่งผลให้ต้นทุนดอกเบี้ยยังคงกดดัน Valuation`,
    },
    catalystsAndFlows: {
      safeHavenFlow:
        rawPillars?.catalystsAndFlows?.safeHavenFlow || 'DEFENSIVE_ROTATION',
      safeHavenFlowLabel:
        rawPillars?.catalystsAndFlows?.safeHavenFlowLabel ||
        'ไม่มีข้อมูลกระแสเงินทุนโดยตรง',
      goldPrice: real.goldPrice,
      goldChangePercent: real.goldChangePercent,
      dxyPrice: real.dxyPrice,
      oilPrice: real.oilPrice,
      keyCatalysts:
        Array.isArray(rawPillars?.catalystsAndFlows?.keyCatalysts) &&
        rawPillars.catalystsAndFlows.keyCatalysts.length > 0
          ? rawPillars.catalystsAndFlows.keyCatalysts
          : [
              'ผลประกอบการกลุ่มหุ้น AI & Semiconductor ขนาดใหญ่',
              'ทิศทาง Bond Yield สหรัฐฯ และตัวเลขเงินเฟ้อ CPI',
              'ความตึงเครียดทางภูมิรัฐศาสตร์และราคาน้ำมันโลก',
            ],
      summary:
        rawPillars?.catalystsAndFlows?.summary ||
        `ราคาทองคำ $${real.goldPrice.toLocaleString()} และ DXY ${real.dxyPrice.toFixed(2)} เป็นข้อมูลราคา ยังไม่ยืนยันกระแสเงินทุน`,
    },
    formula: {
      calculatedRiskScore: real.deterministicClimate.riskScore,
      calculatedRiskLabel: real.deterministicClimate.riskLabel,
      posture: real.deterministicClimate.posture,
      postureLabelTh: real.deterministicClimate.postureLabelTh,
      postureSubtitleTh: real.deterministicClimate.postureSubtitleTh,
      formulaEquation:
        `ดัชนีย่อตัว (SPX Drawdown ${real.spxDrawdownPercent.toFixed(1)}%) + อารมณ์ตลาด (${real.fearGreedLabelTh} / VIX ${real.vixPrice.toFixed(1)}) + Bond Yield (${real.us10yYield.toFixed(2)}%) ➔ เสี่ยงระดับ ${real.deterministicClimate.riskScore}/5 (${real.deterministicClimate.postureLabelTh})`,
      greenlightTrigger:
        rawPillars?.formula?.greenlightTrigger ||
        'VIX ลดต่ำกว่า 20 หรือ Fear & Greed ดิ่งแตะโซน Extreme Fear (<25) ร่วมกับ S&P 500 ยืนเหนือแนวรับ EMA 200 วัน',
      redflagTrigger:
        rawPillars?.formula?.redflagTrigger ||
        'US 10Y Yield ดีดทะลุ 4.60% หรือ VIX พุ่งทะลุ 30 จุด (ต้องหยุดช้อนซื้อและถือเงินสดอย่างเข้มงวด)',
    },
  }
}

export function normalizeStoredPayload(
  rawJson: any,
  createdAt: Date,
  modelUsed?: string
): TacticalAdvisorPayload {
  const fallback = createFallbackPillars(rawJson)
  const rawPillars = rawJson?.marketRegime?.pillars

  const sentiment: MarketSentimentPillar = {
    fearGreedScore:
      typeof rawPillars?.sentiment?.fearGreedScore === 'number'
        ? rawPillars.sentiment.fearGreedScore
        : typeof rawJson?.marketRegime?.fearGreedScore === 'number'
        ? rawJson.marketRegime.fearGreedScore
        : fallback.sentiment.fearGreedScore,
    fearGreedRating:
      rawPillars?.sentiment?.fearGreedRating || fallback.sentiment.fearGreedRating,
    fearGreedLabelTh:
      rawPillars?.sentiment?.fearGreedLabelTh ||
      rawJson?.marketRegime?.fearGreedLabel ||
      fallback.sentiment.fearGreedLabelTh,
    fearGreed1WDiff:
      typeof rawPillars?.sentiment?.fearGreed1WDiff === 'number'
        ? rawPillars.sentiment.fearGreed1WDiff
        : fallback.sentiment.fearGreed1WDiff,
    previous1WeekScore:
      typeof rawPillars?.sentiment?.previous1WeekScore === 'number'
        ? rawPillars.sentiment.previous1WeekScore
        : fallback.sentiment.previous1WeekScore,
    vixValue:
      typeof rawPillars?.sentiment?.vixValue === 'number'
        ? rawPillars.sentiment.vixValue
        : fallback.sentiment.vixValue,
    vixStatus:
      rawPillars?.sentiment?.vixStatus || fallback.sentiment.vixStatus,
    vixStatusLabel:
      rawPillars?.sentiment?.vixStatusLabel || fallback.sentiment.vixStatusLabel,
    summary:
      rawPillars?.sentiment?.summary || fallback.sentiment.summary,
  }

  const momentum: MarketMomentumPillar = {
    spxPrice:
      typeof rawPillars?.momentum?.spxPrice === 'number'
        ? rawPillars.momentum.spxPrice
        : fallback.momentum.spxPrice,
    spxChangePercent:
      typeof rawPillars?.momentum?.spxChangePercent === 'number'
        ? rawPillars.momentum.spxChangePercent
        : fallback.momentum.spxChangePercent,
    spxFiftyTwoHigh:
      typeof rawPillars?.momentum?.spxFiftyTwoHigh === 'number'
        ? rawPillars.momentum.spxFiftyTwoHigh
        : fallback.momentum.spxFiftyTwoHigh,
    spxDrawdownPercent:
      typeof rawPillars?.momentum?.spxDrawdownPercent === 'number'
        ? rawPillars.momentum.spxDrawdownPercent
        : fallback.momentum.spxDrawdownPercent,
    spxEmaStatus:
      rawPillars?.momentum?.spxEmaStatus || fallback.momentum.spxEmaStatus,
    nasdaqPrice:
      typeof rawPillars?.momentum?.nasdaqPrice === 'number'
        ? rawPillars.momentum.nasdaqPrice
        : fallback.momentum.nasdaqPrice,
    nasdaqChangePercent:
      typeof rawPillars?.momentum?.nasdaqChangePercent === 'number'
        ? rawPillars.momentum.nasdaqChangePercent
        : fallback.momentum.nasdaqChangePercent,
    nasdaqFiftyTwoHigh:
      typeof rawPillars?.momentum?.nasdaqFiftyTwoHigh === 'number'
        ? rawPillars.momentum.nasdaqFiftyTwoHigh
        : fallback.momentum.nasdaqFiftyTwoHigh,
    nasdaqDrawdownPercent:
      typeof rawPillars?.momentum?.nasdaqDrawdownPercent === 'number'
        ? rawPillars.momentum.nasdaqDrawdownPercent
        : fallback.momentum.nasdaqDrawdownPercent,
    nasdaqEmaStatus:
      rawPillars?.momentum?.nasdaqEmaStatus || fallback.momentum.nasdaqEmaStatus,
    breadthStatus:
      rawPillars?.momentum?.breadthStatus || fallback.momentum.breadthStatus,
    summary:
      rawPillars?.momentum?.summary || fallback.momentum.summary,
  }

  const macroLiquidity: MarketMacroLiquidityPillar = {
    us10yYield:
      typeof rawPillars?.macroLiquidity?.us10yYield === 'number'
        ? rawPillars.macroLiquidity.us10yYield
        : fallback.macroLiquidity.us10yYield,
    yieldPressureLevel:
      rawPillars?.macroLiquidity?.yieldPressureLevel || fallback.macroLiquidity.yieldPressureLevel,
    yieldPressureLabel:
      rawPillars?.macroLiquidity?.yieldPressureLabel || fallback.macroLiquidity.yieldPressureLabel,
    fedPolicyStance:
      rawPillars?.macroLiquidity?.fedPolicyStance || fallback.macroLiquidity.fedPolicyStance,
    inflationExpectation:
      rawPillars?.macroLiquidity?.inflationExpectation || fallback.macroLiquidity.inflationExpectation,
    summary:
      rawPillars?.macroLiquidity?.summary || fallback.macroLiquidity.summary,
  }

  const catalystsAndFlows: MarketCatalystsAndFlowsPillar = {
    safeHavenFlow:
      rawPillars?.catalystsAndFlows?.safeHavenFlow || fallback.catalystsAndFlows.safeHavenFlow,
    safeHavenFlowLabel:
      rawPillars?.catalystsAndFlows?.safeHavenFlowLabel || fallback.catalystsAndFlows.safeHavenFlowLabel,
    goldPrice:
      typeof rawPillars?.catalystsAndFlows?.goldPrice === 'number'
        ? rawPillars.catalystsAndFlows.goldPrice
        : fallback.catalystsAndFlows.goldPrice,
    goldChangePercent:
      typeof rawPillars?.catalystsAndFlows?.goldChangePercent === 'number'
        ? rawPillars.catalystsAndFlows.goldChangePercent
        : fallback.catalystsAndFlows.goldChangePercent,
    dxyPrice:
      typeof rawPillars?.catalystsAndFlows?.dxyPrice === 'number'
        ? rawPillars.catalystsAndFlows.dxyPrice
        : fallback.catalystsAndFlows.dxyPrice,
    oilPrice:
      typeof rawPillars?.catalystsAndFlows?.oilPrice === 'number'
        ? rawPillars.catalystsAndFlows.oilPrice
        : fallback.catalystsAndFlows.oilPrice,
    keyCatalysts:
      Array.isArray(rawPillars?.catalystsAndFlows?.keyCatalysts) &&
      rawPillars.catalystsAndFlows.keyCatalysts.length > 0
        ? rawPillars.catalystsAndFlows.keyCatalysts
        : fallback.catalystsAndFlows.keyCatalysts,
    summary:
      rawPillars?.catalystsAndFlows?.summary || fallback.catalystsAndFlows.summary,
  }

  const formula: MarketClimateFormula = {
    calculatedRiskScore:
      typeof rawPillars?.formula?.calculatedRiskScore === 'number'
        ? rawPillars.formula.calculatedRiskScore
        : typeof rawJson?.marketRegime?.riskLevel === 'number'
        ? rawJson.marketRegime.riskLevel
        : fallback.formula.calculatedRiskScore,
    calculatedRiskLabel:
      rawPillars?.formula?.calculatedRiskLabel ||
      rawJson?.marketRegime?.riskLevelLabel ||
      fallback.formula.calculatedRiskLabel,
    posture:
      rawPillars?.formula?.posture || fallback.formula.posture,
    postureLabelTh:
      rawPillars?.formula?.postureLabelTh || fallback.formula.postureLabelTh,
    postureSubtitleTh:
      rawPillars?.formula?.postureSubtitleTh || fallback.formula.postureSubtitleTh,
    formulaEquation:
      rawPillars?.formula?.formulaEquation || fallback.formula.formulaEquation,
    greenlightTrigger:
      rawPillars?.formula?.greenlightTrigger || fallback.formula.greenlightTrigger,
    redflagTrigger:
      rawPillars?.formula?.redflagTrigger || fallback.formula.redflagTrigger,
  }

  const pillars: MarketPillarsData = {
    sentiment,
    momentum,
    macroLiquidity,
    catalystsAndFlows,
    formula,
  }

  const tacticalActions = Array.isArray(rawJson?.tacticalActions)
    ? rawJson.tacticalActions.map((item: any, idx: number) => ({
        id: String(item.id || idx + 1),
        ticker: String(item.ticker || '').toUpperCase(),
        assetName: String(item.assetName || item.ticker || ''),
        market: item.market || 'US',
        action: item.action || 'HOLD_WATCH',
        actionLabel: item.actionLabel || 'ถือจับตา',
        badgeColor: item.badgeColor || 'amber',
        currentPrice: Number(item.currentPrice ?? 0),
        currency: item.currency || '$',
        targetZone: String(item.targetZone || '-'),
        tranchePlan: String(item.tranchePlan || '-'),
        stopLossPoint: String(item.stopLossPoint || '-'),
        rationale: String(item.rationale || ''),
        taxImpactNote: item.taxImpactNote ? String(item.taxImpactNote) : undefined,
      }))
    : []

  return {
    asOfDate: getBangkokDateString(createdAt),
    asOfDateThai: formatThaiDate(createdAt),
    marketRegime: {
      status: rawJson.marketRegime?.status || 'VOLATILE_CAUTION',
      statusLabelTh: rawJson.marketRegime?.statusLabelTh || pillars.formula.postureLabelTh,
      summaryTh:
        rawJson.marketRegime?.summaryTh ||
        'ตลาดอยู่ในสภาวะปรับฐานและผันผวน ควรจัดสรรเงินสดและรอจังหวะสะสมตามแนวรับ',
      riskLevel: pillars.formula.calculatedRiskScore,
      riskLevelLabel: pillars.formula.calculatedRiskLabel,
      fearGreedScore: pillars.sentiment.fearGreedScore,
      fearGreedLabel: pillars.sentiment.fearGreedLabelTh,
      macroDrivers:
        Array.isArray(rawJson.marketRegime?.macroDrivers) && rawJson.marketRegime.macroDrivers.length > 0
          ? rawJson.marketRegime.macroDrivers
          : pillars.catalystsAndFlows.keyCatalysts,
      pillars,
    },
    portfolioResilience: rawJson.portfolioResilience || {
      score: 70,
      status: 'MODERATE',
      statusLabelTh: 'ปานกลาง',
      strengths: [],
      vulnerabilities: [],
      thematicRiskAlert: null,
    },
    tacticalActions,
    cashStrategy: rawJson.cashStrategy || {
      recommendedCashPercent: 15,
      currentCashPercent: 0,
      currentCashTotalBase: 0,
      baseCurrency: 'THB',
      guidanceText: 'ถือเงินสดตามความเหมาะสม',
    },
    trackRecordReview: Array.isArray(rawJson.trackRecordReview) ? rawJson.trackRecordReview : [],
    ...(rawJson?.outcomeMetrics ? { outcomeMetrics: rawJson.outcomeMetrics } : {}),
    modelUsed: rawJson.modelUsed || modelUsed,
    generatedAt: createdAt.toISOString(),
    ...(Array.isArray(rawJson.marketEvidence) && rawJson.marketEvidence.length >= 6
      ? { marketEvidence: rawJson.marketEvidence } : {}),
  }
}

async function gatherMarketData() {
  const [
    spxRes,
    nasdaqRes,
    setRes,
    btcRes,
    goldRes,
    vixRes,
    fearGreedRes,
    dxyRes,
    tnxRes,
    oilRes,
  ] = await Promise.allSettled([
    yahooFinanceProvider.getQuote('S&P 500', 'US', true),
    yahooFinanceProvider.getQuote('NASDAQ', 'US', true),
    yahooFinanceProvider.getQuote('SET INDEX', 'TH', true),
    coinGeckoProvider.getQuote('BTC'),
    yahooFinanceProvider.getQuote('XAU', 'GLOBAL', true),
    yahooFinanceProvider.getQuote('VIX', 'US', true),
    fetchRealHumanSentiment(),
    yahooFinanceProvider.getQuote('DXY', 'US', true),
    yahooFinanceProvider.getQuote('US10Y', 'US', true),
    yahooFinanceProvider.getQuote('OIL', 'US', true),
  ])

  const spx = spxRes.status === 'fulfilled' ? spxRes.value : null
  const nasdaq = nasdaqRes.status === 'fulfilled' ? nasdaqRes.value : null
  const setIndex = setRes.status === 'fulfilled' ? setRes.value : null
  const btc = btcRes.status === 'fulfilled' ? btcRes.value : null
  const gold = goldRes.status === 'fulfilled' ? goldRes.value : null
  const vix = vixRes.status === 'fulfilled' ? vixRes.value : null
  const fearGreed = fearGreedRes.status === 'fulfilled' ? fearGreedRes.value : null
  const dxy = dxyRes.status === 'fulfilled' ? dxyRes.value : null
  const tnx = tnxRes.status === 'fulfilled' ? tnxRes.value : null
  const oil = oilRes.status === 'fulfilled' ? oilRes.value : null

  return {
    spx,
    nasdaq,
    setIndex,
    btc,
    gold,
    vix,
    fearGreed,
    dxy,
    tnx,
    oil,
  }
}

export async function runTacticalAnalysis(
  userId: string,
  baseCurrency: string
): Promise<TacticalAdvisorPayload> {
  // 1. Gather User Holdings & Cash
  const holdingsResult = await calculateUserHoldings(userId, baseCurrency, true)
  const accounts = await prisma.investmentAccount.findMany({
    where: { userId },
    select: { cashBalance: true, currency: true },
  })

  const totalCash = await sumAccountCashInBaseCurrency(accounts, baseCurrency)

  const totalPortfolioValue = holdingsResult.totalValueBase + totalCash
  const currentCashPercent =
    totalPortfolioValue > 0 ? Number(((totalCash / totalPortfolioValue) * 100).toFixed(1)) : 0

  // 2. Gather External Market Signals, Technical Signals, and Recent News in parallel
  const topHoldings = holdingsResult.holdings.slice(0, 15)
  const heldTickersUpper = topHoldings.map((h) => h.ticker.toUpperCase())
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const [market, technicalSignals, recentNews, deepIntel] = await Promise.all([
    gatherMarketData(),
    topHoldings.length > 0
      ? getBatchTechnicalSignals(
          topHoldings.map((h) => ({
            ticker: h.ticker,
            market:
              h.market ||
              (h.ticker.endsWith('.BK') || h.currency === 'THB' ? 'TH' : 'US'),
          }))
        ).catch(() => ({} as Record<string, any>))
      : Promise.resolve({} as Record<string, any>),
    prisma.newsItem
      .findMany({
        where: {
          publishedAt: { gte: sevenDaysAgo },
          OR:
            heldTickersUpper.length > 0
              ? [{ symbol: { in: heldTickersUpper } }, { symbol: null }]
              : [{ symbol: null }],
        },
        orderBy: { publishedAt: 'desc' },
        take: 12,
        select: { symbol: true, headline: true, sentiment: true, publishedAt: true },
      })
      .catch(() => []),
    gatherPortfolioDeepIntelligence({
      userId,
      baseCurrency,
      holdings: holdingsResult.holdings,
      txns: holdingsResult.txns,
    }).catch(() => null),
  ])

  const observedNow = Date.now()
  const marketEvidence: NonNullable<TacticalAdvisorPayload['marketEvidence']> = []
  function requiredQuote(symbol: string, quote: MarketQuote | null, needsHigh = false) {
    const observedAt = getObservationTime(quote?.observationTimestamp, observedNow)
    if (!quote || !observedAt || !Number.isFinite(quote.price) || quote.price <= 0
      || (needsHigh && !(quote.fiftyTwoWeekHigh && Number.isFinite(quote.fiftyTwoWeekHigh) && quote.fiftyTwoWeekHigh > 0))) {
      throw new MarketEvidenceUnavailable(`ยังยืนยันข้อมูล ${symbol} ไม่ได้ ระบบจึงพักการสร้างรายงานกลยุทธ์รอบนี้`)
    }
    marketEvidence.push({ symbol, observedAt, provider: quote.provider })
    return quote
  }
  const quoteLine = (label: string, quote: MarketQuote | null, unit: string) =>
    formatMarketObservation(label, quote ? { ...quote, timestamp: quote.observationTimestamp ?? 0 } : null, observedNow, unit)
  const spx = requiredQuote('S&P 500', market.spx, true)
  const nasdaq = requiredQuote('NASDAQ', market.nasdaq, true)
  const vixPrice = requiredQuote('VIX', market.vix).price
  const us10yYield = requiredQuote('US10Y', market.tnx).price
  const dxyPrice = requiredQuote('DXY', market.dxy).price
  const gold = requiredQuote('XAU', market.gold)
  const goldPrice = gold.price
  const oilPrice = getObservationTime(market.oil?.observationTimestamp, observedNow) ? market.oil?.price : undefined
  const spxPrice = spx.price
  const spx52High = spx.fiftyTwoWeekHigh!
  const spxDrawdown = ((spxPrice - spx52High) / spx52High) * 100
  const nasdaqPrice = nasdaq.price
  const nasdaq52High = nasdaq.fiftyTwoWeekHigh!
  const nasdaqDrawdown = ((nasdaqPrice - nasdaq52High) / nasdaq52High) * 100

  const fgObservedAt = market.fearGreed?.source === 'CNN_LIVE'
    ? getObservationTime(Date.parse(market.fearGreed.timestamp), observedNow) : null
  const sentiment = fgObservedAt && market.fearGreed
    && Number.isFinite(market.fearGreed.score) && market.fearGreed.score >= 0 && market.fearGreed.score <= 100
    ? market.fearGreed : null
  if (sentiment && fgObservedAt) marketEvidence.push({ symbol: 'Fear & Greed', observedAt: fgObservedAt, provider: 'CNN' })
  const fgScore = sentiment?.score ?? -1
  const fgPrev1W = sentiment && Number.isFinite(sentiment.previous1Week) ? sentiment.previous1Week : -1
  const fgDiff = fgPrev1W >= 0 ? fgScore - fgPrev1W : 0
  const fgLabel = sentiment?.ratingLabelTh || 'ไม่มีข้อมูล CNN ใช้ VIX ในการประเมิน'

  // Compute deterministic formula
  const deterministicClimate = computeDeterministicClimate({
    spxDrawdown,
    nasdaqDrawdown,
    fearGreedScore: fgScore,
    vixPrice,
    us10yYield,
  })

  // 3. Gather past advice logs for quantitative Closed-Loop Track Record verification
  const pastLogs = await prisma.aiAdviceLog.findMany({
    where: {
      userId,
      logType: 'advisor',
      prompt: { contains: '[AI Tactical Regime & Portfolio Advisor]' },
    },
    orderBy: { createdAt: 'desc' },
    take: 15,
    select: { response: true, createdAt: true },
  })

  const livePriceMap = new Map(
    holdingsResult.holdings.map((h) => [h.ticker.toUpperCase(), Number(h.currentPrice || 0)])
  )

  const outcomeMetrics = computeAdviceOutcomeMetrics(pastLogs, livePriceMap)
  const pastContextSummaries = formatOutcomeMetricsForPrompt(outcomeMetrics)

  const recentNewsLines =
    recentNews.length > 0
      ? recentNews
          .map((n) => `     * [${n.symbol || 'MACRO'}] ${n.headline} (${n.sentiment || 'neutral'})`)
          .join('\n')
      : '     * ไม่มีหัวข้อข่าวเฉพาะในฐานข้อมูล 7 วันล่าสุด'

  // 4. Construct high-fidelity system prompt & user prompt for Gemini
  const prompt = `
[AI Tactical Regime & Portfolio Advisor]
[tactical-evidence:v2]
คุณคือ "หัวหน้านักกลยุทธ์การลงทุนอาวุโส (Chief Tactical Investment Strategist)" หน้าที่ของคุณคือการรวบรวมและวิเคราะห์ข้อมูล "4 เสาหลักสภาวะตลาด (4 Pillars of Market Climate)" ผสานเข้ากับพอร์ตจริง, ปัจจัยพื้นฐาน Valuation, ปฏิทินงบ/ปันผล, ภาษี และกฎส่วนตัวของผู้ใช้ เพื่อสังเคราะห์เป็นแผนกลยุทธ์เฉพาะตัวที่แม่นยำ ปฏิบัติได้จริงในห้วงเวลานี้ (Institutional Regime Playbook)

=== ข้อมูลตลาดพร้อมเวลาสังเกต ===
${marketEvidence.map((item) => `- ${item.symbol}: ${item.provider} ณ ${item.observedAt}`).join('\n')}
1. ดัชนีอารมณ์และความกลัว (Sentiment & Volatility):
   - CNN Fear & Greed Index: ${sentiment ? `${fgScore}/100 (${fgLabel})${fgPrev1W >= 0 ? ` | สัปดาห์ก่อน ${fgPrev1W}` : ''}` : fgLabel}
   - VIX Index (ดัชนีความผันผวน S&P 500): ${vixPrice.toFixed(2)} pts (เกณฑ์ประเมิน: <20 สภาวะปกติ/เสถียรภาพสูง, 20-25 กังวลผันผวนยกระดับ, >30 ตื่นตระหนก Panic)

2. แนวโน้มราคาและโมเมนตัมตลาด (Market Trend & Breadth):
   - S&P 500: ${spxPrice.toLocaleString()} pts (${(market.spx?.changePercent ?? 0) >= 0 ? '+' : ''}${market.spx?.changePercent?.toFixed(2) ?? 0}%) | 52W High: ${spx52High.toLocaleString()} | % Drawdown จากจุดสูงสุด: ${spxDrawdown}%
   - NASDAQ: ${nasdaqPrice.toLocaleString()} pts (${(market.nasdaq?.changePercent ?? 0) >= 0 ? '+' : ''}${market.nasdaq?.changePercent?.toFixed(2) ?? 0}%) | 52W High: ${nasdaq52High.toLocaleString()} | % Drawdown จากจุดสูงสุด: ${nasdaqDrawdown}%
   ${quoteLine('SET Index', market.setIndex, ' จุด')}
   - ไม่มีชุดข้อมูล EMA ของดัชนีและ Market Breadth ในรอบนี้

3. ต้นทุนทางการเงินและนโยบาย (Macro & Liquidity):
   - US 10Y Bond Yield: ${us10yYield.toFixed(2)}% (เกณฑ์: <4.0% ผ่อนคลายเอื้อสินทรัพย์เสี่ยง, 4.0-4.4% ตึงตัวปานกลาง, >4.4% แรงกดดันสูง)
   - อธิบายผลของ Bond Yield ตามข้อมูลข้างต้น งดระบุแนวโน้ม Fed หรือเงินเฟ้อที่ไม่มีหลักฐาน

4. ปัจจัยเร่งและกระแสเงินทุน (Catalysts & Fund Flows):
   - ทองคำ ($${goldPrice.toLocaleString()}), ดัชนีดอลลาร์ DXY (${dxyPrice.toFixed(2)})
   ${quoteLine('น้ำมันดิบ', market.oil, ' USD')}
   - การขยับของราคาเพียงอย่างเดียวไม่ยืนยันกระแสเงินทุน
   - ข่าวล่าสุดในรอบ 7 วันจากคลังข่าวจริงของระบบ (ใช้เป็น Event Drivers หลัก):
${recentNewsLines}

💡 สูตรลัดสรุปผล (Market Climate Formula):
แนวโน้มดัชนี + ระดับความกลัว (Fear & Greed / VIX) + แรงกดดันดอกเบี้ย (10Y Yield) = ระดับความเสี่ยงตลาด (${deterministicClimate.riskScore}/5) และกลยุทธ์ที่ควรใช้ (${deterministicClimate.postureLabelTh})

=== ข้อมูลพอร์ตภายในจริง (INTERNAL PORTFOLIO DNA) ===
- มูลค่าพอร์ตลงทุนรวม: ${totalPortfolioValue.toLocaleString()} ${baseCurrency}
- มูลค่าสินทรัพย์หุ้น/คริปโต: ${holdingsResult.totalValueBase.toLocaleString()} ${baseCurrency} (คิดเป็น ${(100 - currentCashPercent).toFixed(1)}%)
- เงินสดสำรองพร้อมใช้ (Dry Powder): ${totalCash.toLocaleString()} ${baseCurrency} (คิดเป็น ${currentCashPercent}%)
- กำไร/ขาดทุนรวมที่ยังไม่รับรู้ (Unrealized P&L): ${holdingsResult.unrealizedPnLBase.toLocaleString()} ${baseCurrency} (${holdingsResult.unrealizedPnLPercent.toFixed(2)}%)
- รายการสินทรัพย์ที่ถือครองในพอร์ต พร้อมสัญญาณเทคนิคจริง (${holdingsResult.holdings.length} ตัว):
${holdingsResult.holdings
  .map((h, idx) => {
    const sig = technicalSignals[h.ticker.toUpperCase()]
    const hasChart = sig?.currentPrice > 0 && getObservationTime(sig.observationTimestamp, observedNow)
    const techNote = hasChart
      ? ` | RSI(14): ${sig.rsi14 ?? 'N/A'} | SMA50: ${sig.sma50 ?? 'N/A'} | SMA200: ${sig.sma200 ?? 'N/A'} | S1: ${sig.supportS1 ?? 'N/A'} | S2: ${sig.supportS2 ?? 'N/A'} | R1: ${sig.resistanceR1 ?? 'N/A'} | ย่อจาก 52W High: ${sig.pullbackFromHigh}%`
      : ''
    return `  ${idx + 1}. [${h.ticker}] ${h.assetName} (${h.market}) | สัดส่วน: ${h.allocationPercent.toFixed(1)}% | ราคากราฟ: ${hasChart ? `${sig.currentPrice} ${h.currency} ณ ${hasChart}` : 'ไม่มีข้อมูลยืนยัน'} | ต้นทุนเฉลี่ย: ${h.avgCost}${techNote}`
  })
  .join('\n')}

=== ปัจจัยพื้นฐาน & Valuation Guardrails (FUNDAMENTAL QUALITY & VALUE-TRAP CHECK) ===
${deepIntel?.fundamentalsPrompt || 'ยังไม่มีข้อมูลพื้นฐานรายตัว'}

=== ปฏิทินงบการเงิน (Earnings) & ปันผล (XD) ที่กำลังจะมาถึง ===
${deepIntel?.catalystsPrompt || 'ไม่มีกำหนดการงบ/ปันผลใกล้ถึง'}

=== เป้าหมายแผนลงทุน & ความจำกฎส่วนตัวของนักลงทุน (GOALS & USER MEMORY) ===
${deepIntel?.goalsAndMemoryPrompt || 'ยังไม่ได้ตั้งเป้าหมายเฉพาะ'}

=== บริบทภาษี FIFO & อายุการถือครอง (TAX LOT CONTEXT) ===
${deepIntel?.taxContextPrompt || 'ไม่มีข้อมูลภาษี'}

=== สถิติผลลัพธ์คำแนะนำในรอบที่ผ่านๆ มา (CLOSED-LOOP TRACK RECORD) ===
${pastContextSummaries}

=== กฎเหล็ก 6 มิติที่ต้องคำนึงถึงในการวิเคราะห์ (MANDATORY GUARDRAILS) ===
1. กำหนดขนาดไม้และวงเงินเสมอ (Position Sizing & Tranches): หากแนะนำให้สะสม (ACCUMULATE) ต้องระบุว่าใช้เงินสดกี่ % หรือกี่บาท/ดอลลาร์ และแบ่งเป็นกี่ไม้ชัดเจน (เช่น ไม้แรก 25% ที่ราคา..., ไม้สอง 35% ที่แนวรับ S1...) และห้ามขัดเพดาน Max Position ใน User Memory
2. มีจุดหนีไฟหรือจุดตัดขาดทุนเสมอ (Stop Loss / Invalidation Point): ต้องระบุราคาที่หากหลุด ต้องหยุดซื้อถัวหรือพิจารณาตัดขาดทุน
3. Value-Trap & Catalyst Guardrail: ห้ามแนะนำซื้อ (ACCUMULATE) หุ้นที่ติดธง VALUE_TRAP_RISK หรือมีวันประกาศงบ (Earnings) ภายใน ≤ 5 วัน โดยไม่ระบุคำเตือนความเสี่ยงด้านงบ/พื้นฐานอย่างชัดเจนใน rationale
4. ตรวจสอบความเสี่ยงเชิงธีมซ้ำซ้อน (Thematic Correlation Risk): วิเคราะห์ว่าถือหุ้นคนละตัวแต่อยู่ในธีมเดียวกันมากเกินไปไหม (เช่น Tech/AI เกิน 50-60%) หากพบให้ระบุใน thematicRiskAlert
5. คำนึงถึงภาษีเงินได้จากการขาย (Tax Sensitivity): หากแนะนำให้ขายทำกำไร (TRIM_PROFIT) ให้ระบุเตือนภาษีจริงตามตลาด (หุ้นไทย SET ยกเว้น / หุ้นนอก+คริปโตตาม ป.161/2566)
6. สรุปผลการบ้านคำแนะนำรอบก่อนหน้า (Track Record Review): ประเมินจากสถิติ Win Rate จริงข้างบนอย่างซื่อตรงว่าอะไรได้ผลและอะไรต้องปรับปรุง

กรุณาสังเคราะห์และตอบกลับมาเป็น JSON ตามรูปแบบนี้เท่านั้น ห้ามใส่ข้อความอื่นนอกเหนือจาก JSON:
{
  "marketRegime": {
    "status": "VOLATILE_CAUTION" | "EARLY_ACCUMULATION" | "BULL_EXPANSION" | "DEFENSIVE_ROTATION",
    "statusLabelTh": "ชื่อสภาวะตลาดภาษาไทย",
    "summaryTh": "สรุปสภาวะตลาดและบริบทห้วงเวลานี้ใน 2 ประโยคกระชับตรงประเด็น",
    "riskLevel": ${deterministicClimate.riskScore},
    "riskLevelLabel": "${deterministicClimate.riskLabel}",
    "fearGreedScore": ${fgScore},
    "fearGreedLabel": "${fgLabel}",
    "macroDrivers": ["ประเด็นหลักที่ 1", "ประเด็นหลักที่ 2", "ประเด็นหลักที่ 3"],
    "pillars": {
      "sentiment": {
        "summary": "บทวิเคราะห์อารมณ์ตลาดและความกลัว 1-2 ประโยค"
      },
      "momentum": {
        "spxEmaStatus": "สถานะเส้น EMA 50 / 125 / 200 วัน ของ S&P 500 เช่น พักฐานทดสอบ EMA 50",
        "nasdaqEmaStatus": "สถานะเส้น EMA ของ NASDAQ",
        "breadthStatus": "สถานะ Market Breadth เช่น หุ้นใหญ่ประคองดัชนี หรือลงทั้งกระดาน",
        "summary": "บทวิเคราะห์โมเมนตัมตลาดและ Drawdown 1 ประโยค"
      },
      "macroLiquidity": {
        "fedPolicyStance": "คาดการณ์นโยบาย Fed ในการประชุมครั้งถัดไป",
        "inflationExpectation": "แนวโน้มเงินเฟ้อ CPI/PCE และผลกระทบต่อต้นทุนดอกเบี้ย",
        "summary": "บทวิเคราะห์อัตราผลตอบแทนพันธบัตรและต้นทุนการเงิน 1 ประโยค"
      },
      "catalystsAndFlows": {
        "safeHavenFlow": "RISK_ON" | "DEFENSIVE_ROTATION" | "CASH_PRESERVATION",
        "safeHavenFlowLabel": "ทิศทางการไหลของเงินทุน เช่น กระจายเข้าสินทรัพย์ปลอดภัย (ทองคำ/ดอลลาร์)",
        "keyCatalysts": ["ข่าวสำคัญ 1 เช่น งบ Big Tech", "ข่าว 2 เช่น ดอกเบี้ย Fed", "ข่าว 3 เช่น น้ำมันและภูมิรัฐศาสตร์"],
        "summary": "บทวิเคราะห์กระแสเงินทุน 1 ประโยค"
      },
      "formula": {
        "formulaEquation": "สมการสรุป เช่น ดัชนีย่อตัว (SPX -3.6%) + อารมณ์กังวล (F&G 39) + Bond Yield สูง ➔ เสี่ยงระดับ 4/5 (ตั้งรับรอจังหวะ)",
        "greenlightTrigger": "จุดปลดล็อกเข้าซื้อไม้ใหญ่ (เงื่อนไขชัดเจน เช่น VIX < 20 หรือ Fear & Greed < 25 พร้อม S&P ยืนเหนือ EMA 200)",
        "redflagTrigger": "จุดเตือนภัยขั้นสุด-ห้ามถัว (เงื่อนไขชัดเจน เช่น 10Y Yield ทะลุ 4.60% หรือ VIX > 30)"
      }
    }
  },
  "portfolioResilience": {
    "score": ตัวเลข 0-100,
    "status": "STRONG" | "MODERATE" | "FRAGILE",
    "statusLabelTh": "พร้อมรับมือดีเยี่ยม / แข็งแกร่งปานกลาง / เปราะบางควรปรับพอร์ต",
    "strengths": ["จุดแข็งที่ 1 ของพอร์ตในตลาดห้วงนี้", "จุดแข็งที่ 2"],
    "vulnerabilities": ["จุดเปราะบางที่ 1", "จุดเปราะบางที่ 2"],
    "thematicRiskAlert": "ข้อความแจ้งเตือนความเสี่ยงการกระจุกตัว หรือ null ถ้าพอร์ตกระจายตัวดีแล้ว"
  },
  "tacticalActions": [
    {
      "id": "1",
      "ticker": "SYMBOL",
      "assetName": "Company Name",
      "market": "US" | "TH" | "CRYPTO",
      "action": "ACCUMULATE" | "HOLD_WATCH" | "TRIM_PROFIT" | "CASH_PRESERVE",
      "actionLabel": "สะสมไม้แรก (Dip Buy) / ถือจับตา / ทยอยล็อกกำไร",
      "badgeColor": "emerald" | "amber" | "rose" | "indigo",
      "currentPrice": ราคาปัจจุบัน,
      "currency": "$ หรือ ฿",
      "targetZone": "ช่วงราคาเป้าหมาย เช่น $155 - $160",
      "tranchePlan": "แผนแบ่งไม้และวงเงิน เช่น แบ่งเงินสด 25% ($800) เข้าไม้แรกที่ $155 และรอไม้สอง $1,000 ที่แนวรับ $133",
      "stopLossPoint": "จุดยอมแพ้ เช่น $128.00 (หลุดแนวรับสำคัญ)",
      "rationale": "เหตุผลเชิงกลยุทธ์ที่คมชัด 1-2 ประโยค",
      "taxImpactNote": "หมายเหตุภาษี (ถ้าเป็นขายให้เตือนภาษี ถ้าเป็นซื้อให้ระบุว่าไม่มีภาษี)"
    }
  ],
  "cashStrategy": {
    "recommendedCashPercent": สัดส่วนเงินสดที่ควรเตรียมไว้ในห้วงนี้ (เช่น 15-20),
    "currentCashPercent": ${currentCashPercent},
    "currentCashTotalBase": ${totalCash},
    "baseCurrency": "${baseCurrency}",
    "guidanceText": "คำแนะนำการจัดสรรเงินสดในห้วงนี้"
  },
  "trackRecordReview": [
    {
      "period": "คำแนะนำรอบล่าสุด",
      "recommendationSummary": "สรุปสั้นๆ ว่ารอบก่อนแนะนำอะไร",
      "outcomeAssessment": "ประเมินว่าผลลัพธ์เป็นอย่างไรตามสภาพตลาดจริง",
      "accuracyStatus": "ACCURATE" | "NEUTRAL" | "CAUTION"
    }
  ]
}
`

  const aiResult = await callGemini({
    userId,
    prompt,
    logType: 'advisor',
    systemInstruction:
      'วิเคราะห์กลยุทธ์โดยใช้ข้อมูลที่แนบ ตอบเป็น JSON ภาษาไทย งดเสนอราคาเป้าหมายและจุดซื้อขายเมื่อกราฟยืนยันไม่ได้ และรายงานความเสี่ยงตามสูตรจากระบบ',
    responseMimeType: 'application/json',
    validateJson: (value) => tacticalNarrativeSchema.safeParse(value).success,
    thinkingBudget: 1024,
    skipLog: true,
  })

  const parsed = tacticalNarrativeSchema.parse(parseModelJson(aiResult.text))
  const now = new Date()
  const holdingsMap = new Map(holdingsResult.holdings.map((h) => [`${h.market}:${h.ticker.toUpperCase().replace(/\.BK$/, '')}`, h]))
  const usedPositions = new Set<string>()
  const reconciledActions = parsed.tacticalActions.flatMap((item): TacticalActionItem[] => {
    const id = `${item.market}:${item.ticker.toUpperCase().replace(/\.BK$/, '')}`
    const matched = holdingsMap.get(id)
    if (!matched || matched.isStale || usedPositions.has(id)) return []
    const signal = technicalSignals[matched.ticker.toUpperCase()]
    if (!signal || !getObservationTime(signal.observationTimestamp, observedNow) || !(signal.currentPrice > 0)) return []
    usedPositions.add(id)
    return [{
      ...item,
      id,
      ticker: matched.ticker,
      assetName: matched.assetName,
      currentPrice: signal.currentPrice,
      currency: signal.currencySymbol || matched.currency,
      taxImpactNote: item.taxImpactNote ?? undefined,
    }]
  })

  const resolvedPillars = reconcileMarketPillars(parsed?.marketRegime?.pillars, {
    spxPrice,
    spxChangePercent: market.spx?.changePercent ?? 0,
    spxFiftyTwoHigh: spx52High,
    spxDrawdownPercent: spxDrawdown,
    nasdaqPrice,
    nasdaqChangePercent: market.nasdaq?.changePercent ?? 0,
    nasdaqFiftyTwoHigh: nasdaq52High,
    nasdaqDrawdownPercent: nasdaqDrawdown,
    vixPrice,
    us10yYield,
    fearGreedScore: fgScore,
    fearGreedLabelTh: fgLabel,
    fearGreed1WDiff: fgDiff,
    previous1WeekScore: fgPrev1W,
    dxyPrice,
    goldPrice,
    goldChangePercent: gold.changePercent,
    oilPrice,
    deterministicClimate,
  })

  const payload: TacticalAdvisorPayload = {
    asOfDate: getBangkokDateString(now),
    asOfDateThai: formatThaiDate(now),
    marketRegime: {
      status: parsed?.marketRegime?.status || 'VOLATILE_CAUTION',
      statusLabelTh: parsed?.marketRegime?.statusLabelTh || resolvedPillars.formula.postureLabelTh,
      summaryTh:
        parsed?.marketRegime?.summaryTh ||
        'ตลาดอยู่ในสภาวะปรับฐานและผันผวน ควรจัดสรรเงินสดและรอจังหวะสะสมตามแนวรับสำคัญ',
      riskLevel: resolvedPillars.formula.calculatedRiskScore,
      riskLevelLabel: resolvedPillars.formula.calculatedRiskLabel,
      fearGreedScore: fgScore,
      fearGreedLabel: fgLabel,
      macroDrivers: resolvedPillars.catalystsAndFlows.keyCatalysts,
      pillars: resolvedPillars,
    },
    portfolioResilience: parsed.portfolioResilience,
    tacticalActions: reconciledActions,
    cashStrategy: { ...parsed.cashStrategy, currentCashPercent, currentCashTotalBase: totalCash, baseCurrency },
    trackRecordReview: parsed.trackRecordReview || [],
    outcomeMetrics,
    modelUsed: aiResult.modelUsed,
    generatedAt: now.toISOString(),
    marketEvidence,
  }

  await prisma.aiAdviceLog.create({
    data: { userId, logType: 'advisor', prompt, response: JSON.stringify(payload), modelUsed: aiResult.modelUsed },
  })

  return payload
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id
  const { searchParams } = new URL(req.url)
  const forceRefresh = searchParams.get('refresh') === 'true'
  const requestedDate = searchParams.get('date') // e.g. "2026-11-14"

  try {
    const userSettings = await prisma.userSettings.findUnique({ where: { userId } })
    const baseCurrency = userSettings?.baseCurrency ?? 'THB'
    const todayBangkok = getBangkokDateString()

    // 1. Fetch past tactical advice logs to build timeline of available dates
    const pastLogs = await prisma.aiAdviceLog.findMany({
      where: {
        userId,
        logType: 'advisor',
        prompt: { contains: '[AI Tactical Regime & Portfolio Advisor]' },
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: { id: true, createdAt: true, response: true, modelUsed: true },
    })

    // Group logs by Bangkok calendar day (taking the newest log for each day)
    const dayMap = new Map<string, (typeof pastLogs)[0]>()
    for (const log of pastLogs) {
      const dayKey = getBangkokDateString(new Date(log.createdAt))
      if (!dayMap.has(dayKey)) {
        dayMap.set(dayKey, log)
      }
    }

    const availableDates = Array.from(dayMap.entries()).map(([dayKey, log]) => {
      const isToday = dayKey === todayBangkok
      return {
        dateKey: dayKey,
        labelTh: isToday
          ? `วันนี้ (${formatThaiDate(new Date(log.createdAt))})`
          : formatThaiDate(new Date(log.createdAt)),
        createdAt: log.createdAt.toISOString(),
        isToday,
      }
    })

    const computeCachedOutcomeMetrics = async () => {
      try {
        const holdingsRes = await calculateUserHoldings(userId, baseCurrency, false)
        const liveMap = new Map(
          holdingsRes.holdings.map((h) => [h.ticker.toUpperCase(), Number(h.currentPrice || 0)])
        )
        return computeAdviceOutcomeMetrics(pastLogs.slice(0, 15), liveMap)
      } catch {
        return undefined
      }
    }

    // 2. If a specific historical date is requested
    if (requestedDate && requestedDate !== todayBangkok) {
      const targetLog = dayMap.get(requestedDate)
      if (targetLog) {
        try {
          const parsed = parseAdviceResponse(targetLog.response)
          const normalized = normalizeStoredPayload(parsed, targetLog.createdAt, targetLog.modelUsed)
          const liveMetrics = await computeCachedOutcomeMetrics()
          if (liveMetrics && liveMetrics.totalTrackedCalls > 0) {
            normalized.outcomeMetrics = liveMetrics
          }
          return NextResponse.json({
            success: true,
            data: normalized,
            cached: true,
            isHistorical: true,
            selectedDate: requestedDate,
            availableDates,
            generatedAt: targetLog.createdAt.toISOString(),
            modelUsed: targetLog.modelUsed,
          })
        } catch (err) {
          console.error('[Failed to parse historical log]', err)
        }
      }
      return NextResponse.json(
        { error: `ไม่พบบันทึกการวิเคราะห์ของวันที่ ${requestedDate}` },
        { status: 404 }
      )
    }

    // 3. Today's snapshot: if not forcing refresh, check if today's snapshot already exists in DB
    const todayLog = dayMap.get(todayBangkok)
    if (!forceRefresh && todayLog) {
      try {
        const parsed = parseAdviceResponse(todayLog.response)
        const normalized = normalizeStoredPayload(parsed, todayLog.createdAt, todayLog.modelUsed)
        if (!normalized.marketEvidence) throw new Error('Legacy snapshot lacks evidence')
        const liveMetrics = await computeCachedOutcomeMetrics()
        if (liveMetrics && liveMetrics.totalTrackedCalls > 0) {
          normalized.outcomeMetrics = liveMetrics
        }
        return NextResponse.json({
          success: true,
          data: normalized,
          cached: true,
          isHistorical: false,
          selectedDate: todayBangkok,
          availableDates,
          generatedAt: todayLog.createdAt.toISOString(),
          modelUsed: todayLog.modelUsed,
        })
      } catch {
        // Fallback to regenerate
      }
    }

    // 4. Otherwise, compute fresh analysis for today
    const payload = await runTacticalAnalysis(userId, baseCurrency)

    // Reconstruct availableDates including today's new run if it wasn't there
    const updatedDates = availableDates.some((d) => d.dateKey === todayBangkok)
      ? availableDates
      : [
          {
            dateKey: todayBangkok,
            labelTh: `วันนี้ (${payload.asOfDateThai})`,
            createdAt: payload.generatedAt,
            isToday: true,
          },
          ...availableDates,
        ]

    return NextResponse.json({
      success: true,
      data: payload,
      cached: false,
      isHistorical: false,
      selectedDate: todayBangkok,
      availableDates: updatedDates,
      generatedAt: payload.generatedAt,
      modelUsed: payload.modelUsed,
    })
  } catch (error: any) {
    console.error('[tactical-advisor GET error]', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate tactical advice' },
      { status: error instanceof MarketEvidenceUnavailable ? 503 : 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id

  try {
    const userSettings = await prisma.userSettings.findUnique({ where: { userId } })
    const baseCurrency = userSettings?.baseCurrency ?? 'THB'

    const payload = await runTacticalAnalysis(userId, baseCurrency)

    return NextResponse.json({
      success: true,
      data: payload,
      cached: false,
      generatedAt: payload.generatedAt,
      modelUsed: payload.modelUsed,
    })
  } catch (error: any) {
    console.error('[tactical-advisor POST error]', error)
    return NextResponse.json(
      { error: error.message || 'Failed to execute tactical analysis' },
      { status: error instanceof MarketEvidenceUnavailable ? 503 : 500 }
    )
  }
}
