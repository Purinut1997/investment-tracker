/**
 * lib/analytics/risk-sentinel.ts
 * Quantitative calculation engine for Risk Sentinel & Opportunity Radar.
 */

import { HoldingItem } from './holdings'

export interface StressTestScenario {
  dropPercent: number // e.g. -10, -20, -30
  lossAmountBase: number
  portfolioImpactPercent: number
}

export interface ConcentrationRiskItem {
  ticker: string
  assetName: string
  market: string
  allocationPercent: number
  currentValueBase: number
  riskLevel: 'MODERATE' | 'HIGH' | 'CRITICAL'
  stressTests: StressTestScenario[]
  recommendation: string
}

export interface DrawdownRiskItem {
  ticker: string
  assetName: string
  market: string
  unrealizedPnLPercent: number
  unrealizedPnLBase: number
  currentValueBase: number
  severity: 'WARNING' | 'DANGER'
  thesisCheckNote: string
}

export interface LiquidityHealth {
  cashTotalBase: number
  portfolioTotalBase: number
  cashRatioPercent: number
  status: 'LOW' | 'OPTIMAL' | 'HIGH'
  statusLabel: string
  recommendation: string
}

export interface RiskSentinelReport {
  overallRiskLevel: 'LOW' | 'MODERATE' | 'ELEVATED' | 'CRITICAL'
  overallRiskScore: number // 0 - 100 (higher = riskier)
  concentrationRisks: ConcentrationRiskItem[]
  drawdownRisks: DrawdownRiskItem[]
  liquidity: LiquidityHealth
  assetClassBreakdown: Array<{
    category: string
    valueBase: number
    percent: number
    isOverweight: boolean
  }>
  keyWarnings: string[]
}

export interface OpportunityItem {
  id: string
  ticker: string
  assetName: string
  market: string
  assetType: string
  currentPrice: number
  currency: string
  opportunityType: 'DCA_DOWN' | 'PULLBACK' | 'REBALANCE_LAG' | 'WATCHLIST_DIP'
  opportunityScore: number // 1-100
  title: string
  description: string
  metricLabel: string
  metricValue: string
  suggestedAction: string
}

export interface OpportunityRadarReport {
  opportunities: OpportunityItem[]
  topPickSummary: string
  deployableCashBase: number
}

/**
 * 1. Analyze Portfolio Risks (Risk Sentinel)
 */
export function analyzePortfolioRisks(
  holdings: HoldingItem[],
  cashTotalBase: number,
  baseCurrency: string
): RiskSentinelReport {
  const investedTotal = holdings.reduce((sum, h) => sum + h.currentValueBase, 0)
  const grandTotal = investedTotal + cashTotalBase
  const keyWarnings: string[] = []

  // ── A. Concentration Risk & Stress Testing ─────────────────
  const concentrationRisks: ConcentrationRiskItem[] = []
  for (const h of holdings) {
    if (h.allocationPercent >= 20) {
      let riskLevel: 'MODERATE' | 'HIGH' | 'CRITICAL' = 'MODERATE'
      let recommendation = `สัดส่วน ${h.allocationPercent.toFixed(1)}% สูงปานกลาง ควรจำกัดไม่ให้เกิน 25%`

      if (h.allocationPercent >= 40) {
        riskLevel = 'CRITICAL'
        recommendation = `สัดส่วนสูงถึง ${h.allocationPercent.toFixed(1)}% (เข้าข่ายเสี่ยงวิกฤต) แนะนำล็อกกำไรและกระจายความเสี่ยงด่วน`
        keyWarnings.push(`⚠️ ${h.ticker} ครองสัดส่วนสูงเกิน ${h.allocationPercent.toFixed(1)}% ของพอร์ต เสี่ยงได้รับผลกระทบหนักหากปรับฐาน`)
      } else if (h.allocationPercent >= 28) {
        riskLevel = 'HIGH'
        recommendation = `สัดส่วน ${h.allocationPercent.toFixed(1)}% ค่อนข้างสูง ควรชะลอการซื้อเพิ่มและเติมสินทรัพย์กลุ่มอื่น`
        keyWarnings.push(`ระวัง ${h.ticker} ครองสัดส่วน ${h.allocationPercent.toFixed(1)}% ของพอร์ตโฟลิโอ`)
      }

      const stressTests: StressTestScenario[] = [-10, -20, -30].map((drop) => {
        const lossAmountBase = h.currentValueBase * (Math.abs(drop) / 100)
        const portfolioImpactPercent = grandTotal > 0 ? (lossAmountBase / grandTotal) * 100 : 0
        return {
          dropPercent: drop,
          lossAmountBase,
          portfolioImpactPercent,
        }
      })

      concentrationRisks.push({
        ticker: h.ticker,
        assetName: h.assetName,
        market: h.market,
        allocationPercent: h.allocationPercent,
        currentValueBase: h.currentValueBase,
        riskLevel,
        stressTests,
        recommendation,
      })
    }
  }

  // ── B. Deep Drawdown / Heavy Loss Detector ─────────────────
  const drawdownRisks: DrawdownRiskItem[] = []
  for (const h of holdings) {
    if (h.unrealizedPnLPercent <= -12) {
      const isDanger = h.unrealizedPnLPercent <= -25
      const severity: 'WARNING' | 'DANGER' = isDanger ? 'DANGER' : 'WARNING'
      const thesisCheckNote = isDanger
        ? 'ราคาปรับลดลงมากกว่า 25% ควรทบทวนว่าพื้นฐานของสินทรัพย์เปลี่ยนไปหรือไม่ หรือตั้งจุดตัดขาดทุน (Stop Loss)'
        : 'ราคาติดลบปานกลาง หากเป็นสินทรัพย์แกนหลักที่พื้นฐานไม่เปลี่ยน อาจเป็นจังหวะสะสมต้นทุนเฉลี่ย'

      drawdownRisks.push({
        ticker: h.ticker,
        assetName: h.assetName,
        market: h.market,
        unrealizedPnLPercent: h.unrealizedPnLPercent,
        unrealizedPnLBase: h.unrealizedPnLBase,
        currentValueBase: h.currentValueBase,
        severity,
        thesisCheckNote,
      })

      if (isDanger) {
        keyWarnings.push(`🔴 ${h.ticker} ติดลบสูงถึง ${h.unrealizedPnLPercent.toFixed(1)}% ควรประเมินพื้นฐานเพื่อจำกัดการขาดทุน`)
      }
    }
  }

  // ── C. Liquidity / Cash Buffer Health ───────────────────────
  const cashRatioPercent = grandTotal > 0 ? (cashTotalBase / grandTotal) * 100 : 0
  let liquidityStatus: 'LOW' | 'OPTIMAL' | 'HIGH' = 'OPTIMAL'
  let statusLabel = 'สภาพคล่องพร้อมใช้ระดับเหมาะสม'
  let liquidityRecommendation = 'สัดส่วนเงินสด 10-25% เหมาะสำหรับเตรียมช้อนซื้อเมื่อตลาดมีจังหวะย่อตัว'

  if (cashRatioPercent < 5) {
    liquidityStatus = 'LOW'
    statusLabel = 'กระสุนเงินสดสำรองอยู่ในระดับต่ำมาก'
    liquidityRecommendation = 'เงินสดพร้อมใช้ต่ำกว่า 5% แนะนำทยอยเติมเงินสดสำรอง (Dry Powder) เพื่อไม่ให้เสียโอกาสเมื่อตลาดเกิดวิกฤต'
    keyWarnings.push('💧 เงินสดสำรองพร้อมใช้ต่ำกว่า 5% ขาดความยืดหยุ่นในการช้อนซื้อของถูก')
  } else if (cashRatioPercent > 35) {
    liquidityStatus = 'HIGH'
    statusLabel = 'ถือเงินสดสูงเกินไป (Cash Drag)'
    liquidityRecommendation = 'เงินสดสูงกว่า 35% อาจทำให้ผลตอบแทนแพ้เงินเฟ้อ แนะนำทยอยจัดสรรเข้าสินทรัพย์ตามแผนการลงทุน'
  }

  const liquidity: LiquidityHealth = {
    cashTotalBase,
    portfolioTotalBase: grandTotal,
    cashRatioPercent,
    status: liquidityStatus,
    statusLabel,
    recommendation: liquidityRecommendation,
  }

  // ── D. Asset Class & Market Skew ───────────────────────────
  const categoryMap: Record<string, number> = {}
  for (const h of holdings) {
    const cat = h.assetType ? h.assetType.toUpperCase() : 'STOCK'
    categoryMap[cat] = (categoryMap[cat] || 0) + h.currentValueBase
  }
  if (cashTotalBase > 0) {
    categoryMap['CASH'] = (categoryMap['CASH'] || 0) + cashTotalBase
  }

  const assetClassBreakdown = Object.entries(categoryMap).map(([category, valueBase]) => {
    const percent = grandTotal > 0 ? (valueBase / grandTotal) * 100 : 0
    const isOverweight = category === 'CRYPTO' ? percent > 35 : percent > 65
    return {
      category,
      valueBase,
      percent,
      isOverweight,
    }
  })

  // ── E. Overall Risk Score Calculation (0-100) ───────────────
  let riskScore = 20 // baseline
  const maxAlloc = holdings.length > 0 ? Math.max(...holdings.map((h) => h.allocationPercent)) : 0
  if (maxAlloc > 50) riskScore += 35
  else if (maxAlloc > 35) riskScore += 25
  else if (maxAlloc > 25) riskScore += 15

  if (concentrationRisks.some((c) => c.riskLevel === 'CRITICAL')) riskScore += 20
  if (drawdownRisks.some((d) => d.severity === 'DANGER')) riskScore += 15
  if (liquidityStatus === 'LOW') riskScore += 15

  riskScore = Math.min(100, Math.max(10, riskScore))

  let overallRiskLevel: 'LOW' | 'MODERATE' | 'ELEVATED' | 'CRITICAL' = 'LOW'
  if (riskScore >= 75) overallRiskLevel = 'CRITICAL'
  else if (riskScore >= 55) overallRiskLevel = 'ELEVATED'
  else if (riskScore >= 35) overallRiskLevel = 'MODERATE'
  else overallRiskLevel = 'LOW'

  return {
    overallRiskLevel,
    overallRiskScore: riskScore,
    concentrationRisks,
    drawdownRisks,
    liquidity,
    assetClassBreakdown,
    keyWarnings,
  }
}

/**
 * 2. Scan Portfolio Opportunities (Opportunity Radar)
 */
export function scanPortfolioOpportunities(
  holdings: HoldingItem[],
  watchlists: Array<{ symbol: string; displayName: string; itemType: string }>,
  cashTotalBase: number,
  targetAllocation?: Record<string, number>,
  baseCurrency = 'THB'
): OpportunityRadarReport {
  const opportunities: OpportunityItem[] = []

  // ── 1. DCA-Down Candidates (Assets trading below average cost) ──
  for (const h of holdings) {
    if (h.unrealizedPnLPercent < -3 && h.unrealizedPnLPercent > -35) {
      const discount = Math.abs(h.unrealizedPnLPercent)
      const score = Math.min(95, Math.round(50 + discount * 1.5))
      opportunities.push({
        id: `dca_${h.assetId}`,
        ticker: h.ticker,
        assetName: h.assetName,
        market: h.market,
        assetType: h.assetType,
        currentPrice: h.currentPrice,
        currency: h.currency,
        opportunityType: 'DCA_DOWN',
        opportunityScore: score,
        title: `โอกาสลดต้นทุนเฉลี่ย (DCA-Down) ใน ${h.ticker}`,
        description: `ราคาปัจจุบัน ${h.currentPrice.toLocaleString()} ${h.currency} ต่ำกว่าต้นทุนเฉลี่ยของคุณ (${h.avgCost.toLocaleString()} ${h.currency}) อยู่ ${discount.toFixed(1)}% เป็นจังหวะดีในการสะสมเพื่อดึงต้นทุนลง`,
        metricLabel: 'ส่วนลดจากทุนเฉลี่ย',
        metricValue: `-${discount.toFixed(1)}%`,
        suggestedAction: `ทยอยสะสม ${h.ticker} เพิ่มเพื่อเฉลี่ยต้นทุนพอร์ต`,
      })
    }
  }

  // ── 2. Rebalance Lag Opportunity (Target allocation gap) ────
  if (targetAllocation && Object.keys(targetAllocation).length > 0) {
    const actualGrouped: Record<string, number> = {}
    for (const h of holdings) {
      const key = h.market || h.assetType || 'OTHER'
      actualGrouped[key] = (actualGrouped[key] || 0) + h.allocationPercent
    }

    for (const [key, targetPct] of Object.entries(targetAllocation)) {
      const currentPct = actualGrouped[key] || 0
      const gap = targetPct - currentPct
      if (gap >= 5) {
        const candidate = holdings.find((h) => h.market === key || h.assetType === key)
        const candidateTicker = candidate?.ticker ?? key
        const candidateName = candidate?.assetName ?? `กลุ่มสินทรัพย์ ${key}`

        opportunities.push({
          id: `rebal_${key}`,
          ticker: candidateTicker,
          assetName: candidateName,
          market: candidate?.market ?? key,
          assetType: candidate?.assetType ?? 'stock',
          currentPrice: candidate?.currentPrice ?? 0,
          currency: candidate?.currency ?? baseCurrency,
          opportunityType: 'REBALANCE_LAG',
          opportunityScore: Math.min(98, Math.round(60 + gap * 2)),
          title: `สัดส่วนกลุ่ม ${key} ต่ำกว่าเป้าหมาย ${gap.toFixed(1)}%`,
          description: `พอร์ตของคุณมีสัดส่วนกลุ่ม ${key} เพียง ${currentPct.toFixed(1)}% จากเป้าหมาย ${targetPct}% ควรจัดสรรเงินใหม่เติมส่วนนี้เพื่อรักษาวินัยการกระจายความเสี่ยง`,
          metricLabel: 'สัดส่วนที่ยังขาด',
          metricValue: `+${gap.toFixed(1)}%`,
          suggestedAction: `จัดสรรเงินลงทุนรอบถัดไปเน้นกลุ่ม ${key}`,
        })
      }
    }
  }

  // ── 3. Watchlist High-Conviction Dip ────────────────────────
  for (const w of watchlists.slice(0, 4)) {
    const isAlreadyHeld = holdings.some((h) => h.ticker.toUpperCase() === w.symbol.toUpperCase())
    if (!isAlreadyHeld) {
      opportunities.push({
        id: `watch_${w.symbol}`,
        ticker: w.symbol,
        assetName: w.displayName,
        market: w.itemType === 'crypto' ? 'CRYPTO' : 'US',
        assetType: w.itemType,
        currentPrice: 0,
        currency: 'USD',
        opportunityType: 'WATCHLIST_DIP',
        opportunityScore: 75,
        title: `สินทรัพย์ใน Watchlist: ${w.symbol}`,
        description: `คุณกำลังจับตาสินทรัพย์นี้อยู่ (${w.displayName}) สภาพคล่องเงินสดในพอร์ตมี ${cashTotalBase.toLocaleString()} ${baseCurrency} พร้อมให้คุณเริ่มเปิด Position แรก`,
        metricLabel: 'สถานะใน Watchlist',
        metricValue: 'พร้อมจัดสรร',
        suggestedAction: `วิเคราะห์จังหวะเข้าซื้อก้อนแรก (Initial Entry)`,
      })
    }
  }

  // Sort opportunities by opportunityScore descending
  opportunities.sort((a, b) => b.opportunityScore - a.opportunityScore)

  let topPickSummary = 'พอร์ตของคุณมีสัดส่วนสมดุลดี แนะนำรักษาวินัยการลงทุนตามแผนแม่บท'
  if (opportunities.length > 0) {
    const top = opportunities[0]
    topPickSummary = `โอกาสเด่นที่สุดในขณะนี้คือ ${top.title} เพื่อเพิ่มประสิทธิภาพผลตอบแทนของพอร์ต`
  }

  return {
    opportunities,
    topPickSummary,
    deployableCashBase: cashTotalBase,
  }
}
