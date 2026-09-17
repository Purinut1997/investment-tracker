/**
 * lib/analytics/health-score.ts
 * Computes portfolio Health Score (0-100) based on Diversification, Target Alignment, and Concentration Risk.
 */

import { HoldingItem } from './holdings'

export interface HealthScoreResult {
  score: number
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  breakdown: {
    diversification: number // 0 - 40
    targetAlignment: number // 0 - 40
    concentrationRisk: number // 0 - 20
  }
  suggestions: string[]
}

export function calculatePortfolioHealthScore(
  holdings: HoldingItem[],
  targetAllocation?: Record<string, number>
): HealthScoreResult {
  if (!holdings || holdings.length === 0) {
    return {
      score: 50,
      grade: 'C',
      breakdown: {
        diversification: 20,
        targetAlignment: 20,
        concentrationRisk: 10,
      },
      suggestions: ['ยังไม่มีสินทรัพย์ในพอร์ต เพิ่มรายการซื้อเพื่อเริ่มวิเคราะห์สุขภาพพอร์ต'],
    }
  }

  const suggestions: string[] = []

  // ─── 1. Diversification Score (Weight: 40%) ───────────────
  // Using normalized Herfindahl-Hirschman Index (HHI)
  // HHI = sum((s_i)^2) where s_i is allocation percentage (0 to 1)
  let hhi = 0
  for (const h of holdings) {
    const share = h.allocationPercent / 100
    hhi += share * share
  }

  // 1/HHI gives effective number of equal-weight assets
  // If HHI <= 0.15 (well diversified) -> max points 40
  // If HHI >= 0.50 (highly concentrated) -> low points
  let diversificationScore = Math.max(5, Math.min(40, (1 - Math.min(hhi, 1)) * 40))

  if (holdings.length < 3) {
    suggestions.push('พอร์ตมีสินทรัพย์น้อยกว่า 3 ตัว แนะนำกระจายการลงทุนเพิ่มเติม')
  } else if (hhi > 0.3) {
    suggestions.push('สัดส่วนการลงทุนกระจุกตัว แนะนำเกลี่ยน้ำหนักให้สมดุลมากขึ้น')
  }

  // ─── 2. Concentration Risk (Weight: 20%) ──────────────────
  // Check if any single holding dominates > 25% or > 40%
  const maxHolding = holdings[0] // sorted descending by value
  let concentrationScore = 20

  if (maxHolding) {
    if (maxHolding.allocationPercent > 50) {
      concentrationScore = 5
      suggestions.push(
        `สินทรัพย์ ${maxHolding.ticker} มีสัดส่วนสูงถึง ${maxHolding.allocationPercent.toFixed(1)}% ของพอร์ต มีความเสี่ยงกระจุกตัวสูง`
      )
    } else if (maxHolding.allocationPercent > 30) {
      concentrationScore = 12
      suggestions.push(
        `สินทรัพย์ ${maxHolding.ticker} ครองสัดส่วน ${maxHolding.allocationPercent.toFixed(1)}% ควรควบคุมไม่ให้เกิน 25-30%`
      )
    }
  }

  // ─── 3. Target Alignment (Weight: 40%) ────────────────────
  // If targetAllocation provided (e.g. { US: 50, TH: 20, CRYPTO: 20, GOLD: 10 })
  let alignmentScore = 35 // default good score if no custom preset set

  if (targetAllocation && Object.keys(targetAllocation).length > 0) {
    // Group actual allocation by assetType or market
    const actualGrouped: Record<string, number> = {}
    for (const h of holdings) {
      const key = h.market || h.assetType || 'OTHER'
      actualGrouped[key] = (actualGrouped[key] || 0) + h.allocationPercent
    }

    let deviationSum = 0
    for (const [targetKey, targetPct] of Object.entries(targetAllocation)) {
      const actualPct = actualGrouped[targetKey] || 0
      deviationSum += Math.abs(actualPct - targetPct)
    }

    // Maximum possible total deviation is 200%
    alignmentScore = Math.max(5, Math.min(40, (1 - deviationSum / 100) * 40))
    if (deviationSum > 30) {
      suggestions.push('สัดส่วนสินทรัพย์เบี่ยงเบนจากเป้าหมายที่ตั้งไว้ พิจารณาทำ Rebalance')
    }
  }

  const totalScore = Math.round(diversificationScore + concentrationScore + alignmentScore)

  let grade: 'A' | 'B' | 'C' | 'D' | 'F' = 'C'
  if (totalScore >= 85) grade = 'A'
  else if (totalScore >= 70) grade = 'B'
  else if (totalScore >= 55) grade = 'C'
  else if (totalScore >= 40) grade = 'D'
  else grade = 'F'

  if (suggestions.length === 0) {
    suggestions.push('พอร์ตมีสุขภาพดีมาก มีการกระจายความเสี่ยงและสัดส่วนที่เหมาะสม')
  }

  return {
    score: totalScore,
    grade,
    breakdown: {
      diversification: Math.round(diversificationScore),
      targetAlignment: Math.round(alignmentScore),
      concentrationRisk: Math.round(concentrationScore),
    },
    suggestions,
  }
}
