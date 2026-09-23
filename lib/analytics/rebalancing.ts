/**
 * lib/analytics/rebalancing.ts
 * Mathematical engine for Portfolio Rebalancing:
 * - Smart Cash Flow Rebalancing (Inflow allocation without selling)
 * - Full Rebalancing (Trim overweighted & Fund underweighted)
 * - Institutional Tolerance Bands (±3%, ±5%)
 * - Dual-layer support: Specific Tickers & Broad Asset Classes
 */

import { HoldingItem } from './holdings'

export type RebalanceMode = 'CASH_FLOW' | 'FULL_REBALANCE'
export type RebalanceStatus = 'BALANCED' | 'DRIFT' | 'TRIGGERED'
export type RebalanceAction = 'BUY' | 'TRIM' | 'HOLD'

export interface RebalanceItemPlan {
  id: string
  key: string
  label: string
  type: 'TICKER' | 'CATEGORY' | 'CASH'
  ticker?: string
  currentValueBase: number
  currentWeight: number
  targetWeight: number
  driftPercent: number // currentWeight - targetWeight
  toleranceBand: number
  status: RebalanceStatus
  action: RebalanceAction
  recommendedAmountBase: number
  estimatedShares?: number
  currentPriceBase?: number
  postRebalanceValueBase: number
  postRebalanceWeight: number
  explanation: string
}

export interface RebalancePlanResult {
  mode: RebalanceMode
  totalCurrentPortfolioValue: number
  cashInflowAmount: number
  totalPostPortfolioValue: number
  tolerancePercent: number
  overallDriftScore: number // 0 (perfect balance) to 100 (extreme drift)
  hasTriggeredAlert: boolean
  items: RebalanceItemPlan[]
  summaryNotes: {
    totalBuyAmount: number
    totalTrimAmount: number
    unallocatedCash: number
    taxSavingsNote?: string
  }
}

export interface CalculateRebalanceOptions {
  holdings: HoldingItem[]
  totalCashBase: number
  targetAllocation: Record<string, number>
  cashInflowBase?: number
  mode?: RebalanceMode
  tolerancePercent?: number // default 3.0
  baseCurrency?: string
}

export function calculatePortfolioRebalance({
  holdings,
  totalCashBase,
  targetAllocation,
  cashInflowBase = 0,
  mode = 'CASH_FLOW',
  tolerancePercent = 3.0,
}: CalculateRebalanceOptions): RebalancePlanResult {
  const investedValue = holdings.reduce((sum, h) => sum + h.currentValueBase, 0)
  const totalCurrentValue = Math.max(1, investedValue + totalCashBase)
  const effectiveInflow = Math.max(0, cashInflowBase)
  const totalPostValue = totalCurrentValue + (mode === 'CASH_FLOW' ? effectiveInflow : 0)

  // 1. Group existing holdings by Ticker and by Market/Category
  const holdingsByTicker = new Map<string, HoldingItem>()
  const holdingsByCategory = new Map<string, number>()

  for (const h of holdings) {
    const cleanTicker = h.ticker.toUpperCase()
    holdingsByTicker.set(cleanTicker, h)

    const catKey = (h.market || h.assetType || 'OTHER').toUpperCase()
    holdingsByCategory.set(catKey, (holdingsByCategory.get(catKey) || 0) + h.currentValueBase)
  }

  // 2. Identify all targets
  const targetKeys = Object.keys(targetAllocation)
  const items: RebalanceItemPlan[] = []

  let totalAbsoluteDrift = 0

  for (const key of targetKeys) {
    const upperKey = key.toUpperCase()
    const targetPct = Number(targetAllocation[key]) || 0
    let itemType: 'TICKER' | 'CATEGORY' | 'CASH' = 'TICKER'
    let label = key
    let curVal = 0
    let curPrice = 0
    let ticker: string | undefined = undefined

    if (upperKey === 'CASH' || upperKey === 'CASH_RESERVE' || upperKey === 'THB' || upperKey === 'USD') {
      itemType = 'CASH'
      label = 'กระสุนเงินสดสำรอง (Cash)'
      curVal = totalCashBase
    } else if (holdingsByTicker.has(upperKey)) {
      itemType = 'TICKER'
      const h = holdingsByTicker.get(upperKey)!
      label = h.assetName ? `${h.ticker} (${h.assetName})` : h.ticker
      ticker = h.ticker
      curVal = h.currentValueBase
      curPrice = h.quantity > 0 ? h.currentValueBase / h.quantity : h.currentPrice
    } else if (holdingsByCategory.has(upperKey)) {
      itemType = 'CATEGORY'
      label = `กลุ่มสินทรัพย์ ${upperKey}`
      curVal = holdingsByCategory.get(upperKey) || 0
    } else {
      // Asset is in target plan but user doesn't hold it yet (0 value)
      itemType = 'TICKER'
      label = upperKey
      ticker = upperKey
      curVal = 0
    }

    const curWeight = (curVal / totalCurrentValue) * 100
    const drift = curWeight - targetPct
    totalAbsoluteDrift += Math.abs(drift)

    // Tolerance Band Status
    let status: RebalanceStatus = 'BALANCED'
    if (Math.abs(drift) > tolerancePercent * 1.7) {
      status = 'TRIGGERED'
    } else if (Math.abs(drift) > tolerancePercent) {
      status = 'DRIFT'
    }

    items.push({
      id: `rebal_${upperKey}`,
      key: upperKey,
      label,
      type: itemType,
      ticker,
      currentValueBase: curVal,
      currentWeight: curWeight,
      targetWeight: targetPct,
      driftPercent: drift,
      toleranceBand: tolerancePercent,
      status,
      action: 'HOLD',
      recommendedAmountBase: 0,
      currentPriceBase: curPrice > 0 ? curPrice : undefined,
      postRebalanceValueBase: curVal,
      postRebalanceWeight: curWeight,
      explanation: '',
    })
  }

  // 3. Rebalance Calculations
  let totalBuyAmount = 0
  let totalTrimAmount = 0

  if (mode === 'FULL_REBALANCE') {
    // Mode A: Full Rebalance (Trim overweight to fund underweight)
    for (const item of items) {
      const idealTargetValue = (item.targetWeight / 100) * totalCurrentValue
      const diffAmount = idealTargetValue - item.currentValueBase

      if (diffAmount > 50) {
        // Buy
        item.action = 'BUY'
        item.recommendedAmountBase = Math.round(diffAmount)
        item.postRebalanceValueBase = item.currentValueBase + item.recommendedAmountBase
        item.postRebalanceWeight = (item.postRebalanceValueBase / totalCurrentValue) * 100
        if (item.currentPriceBase && item.currentPriceBase > 0) {
          item.estimatedShares = Number((item.recommendedAmountBase / item.currentPriceBase).toFixed(2))
        }
        item.explanation = `สัดส่วนปัจจุบันขาดอีก ${Math.abs(item.driftPercent).toFixed(1)}% แนะนำซื้อเพิ่ม`
        totalBuyAmount += item.recommendedAmountBase
      } else if (diffAmount < -50) {
        // Trim
        item.action = 'TRIM'
        item.recommendedAmountBase = Math.round(Math.abs(diffAmount))
        item.postRebalanceValueBase = Math.max(0, item.currentValueBase - item.recommendedAmountBase)
        item.postRebalanceWeight = (item.postRebalanceValueBase / totalCurrentValue) * 100
        if (item.currentPriceBase && item.currentPriceBase > 0) {
          item.estimatedShares = Number((item.recommendedAmountBase / item.currentPriceBase).toFixed(2))
        }
        item.explanation = `สัดส่วนปัจจุบันเกินเป้าหมาย ${item.driftPercent.toFixed(1)}% แนะนำลดน้ำหนักทำกำไร`
        totalTrimAmount += item.recommendedAmountBase
      } else {
        item.action = 'HOLD'
        item.recommendedAmountBase = 0
        item.postRebalanceValueBase = item.currentValueBase
        item.postRebalanceWeight = item.currentWeight
        item.explanation = 'สัดส่วนอยู่ในเกณฑ์เป้าหมายสมดุล'
      }
    }
  } else {
    // Mode B: Smart Cash Flow Rebalance (DCA Inflow without selling!)
    // Target ideal values in the expanded portfolio
    const deficits: { item: RebalanceItemPlan; deficit: number }[] = []
    let sumDeficits = 0

    for (const item of items) {
      const targetValNew = (item.targetWeight / 100) * totalPostValue
      const deficit = Math.max(0, targetValNew - item.currentValueBase)
      if (deficit > 10) {
        deficits.push({ item, deficit })
        sumDeficits += deficit
      }
    }

    if (effectiveInflow <= 0) {
      // No inflow provided; show current state and what WOULD be needed
      for (const item of items) {
        if (item.driftPercent < -tolerancePercent) {
          item.action = 'BUY'
          item.explanation = `สัดส่วนขาดเป้าหมาย ${Math.abs(item.driftPercent).toFixed(1)}% (ระบุเงินเติมเพื่อดูการจัดสรร)`
        } else if (item.driftPercent > tolerancePercent) {
          item.action = 'HOLD'
          item.explanation = `สัดส่วนเกินเป้าหมาย ${item.driftPercent.toFixed(1)}% (ชะลอการเติมเงินในกลุ่มนี้)`
        } else {
          item.action = 'HOLD'
          item.explanation = 'สัดส่วนสมดุลในกรอบ'
        }
      }
    } else if (sumDeficits > 0 && effectiveInflow <= sumDeficits) {
      // Inflow is less than or equal to total deficit: allocate proportionally to deficits
      for (const { item, deficit } of deficits) {
        const allocated = Math.round(effectiveInflow * (deficit / sumDeficits))
        item.action = allocated > 0 ? 'BUY' : 'HOLD'
        item.recommendedAmountBase = allocated
        item.postRebalanceValueBase = item.currentValueBase + allocated
        item.postRebalanceWeight = (item.postRebalanceValueBase / totalPostValue) * 100
        if (item.currentPriceBase && item.currentPriceBase > 0) {
          item.estimatedShares = Number((allocated / item.currentPriceBase).toFixed(2))
        }
        item.explanation = `จัดสรรเงินเติม ฿${allocated.toLocaleString()} เพื่อดึงสัดส่วนจาก ${item.currentWeight.toFixed(1)}% เข้าใกล้เป้า ${item.targetWeight}%`
        totalBuyAmount += allocated
      }

      // For non-deficit items, action is HOLD
      for (const item of items) {
        if (!deficits.some((d) => d.item.id === item.id)) {
          item.action = 'HOLD'
          item.recommendedAmountBase = 0
          item.postRebalanceValueBase = item.currentValueBase
          item.postRebalanceWeight = (item.currentValueBase / totalPostValue) * 100
          item.explanation = 'งดเติมเงินในงวดนี้เพื่อรอให้ตัวอื่นขยับทันเป้าหมาย'
        }
      }
    } else {
      // Inflow exceeds deficits: fund 100% of deficits, remaining cash distributed by target weights
      let remaining = effectiveInflow - sumDeficits

      for (const item of items) {
        const dObj = deficits.find((d) => d.item.id === item.id)
        const baseDeficit = dObj ? dObj.deficit : 0
        const extra = Math.round(remaining * (item.targetWeight / 100))
        const totalAlloc = Math.round(baseDeficit + extra)

        if (totalAlloc > 0) {
          item.action = 'BUY'
          item.recommendedAmountBase = totalAlloc
          item.postRebalanceValueBase = item.currentValueBase + totalAlloc
          item.postRebalanceWeight = (item.postRebalanceValueBase / totalPostValue) * 100
          if (item.currentPriceBase && item.currentPriceBase > 0) {
            item.estimatedShares = Number((totalAlloc / item.currentPriceBase).toFixed(2))
          }
          item.explanation = `จัดสรรเติมเต็มสัดส่วนเป้าหมายและส่วนเกินตามน้ำหนักแผน`
          totalBuyAmount += totalAlloc
        } else {
          item.action = 'HOLD'
          item.postRebalanceWeight = (item.currentValueBase / totalPostValue) * 100
        }
      }
    }
  }

  // Sort: Triggered & Buy first, then Drift, then Balanced
  items.sort((a, b) => {
    if (a.action === 'BUY' && b.action !== 'BUY') return -1
    if (b.action === 'BUY' && a.action !== 'BUY') return 1
    return Math.abs(b.driftPercent) - Math.abs(a.driftPercent)
  })

  const overallDriftScore = Math.min(100, Math.round(totalAbsoluteDrift * 2.5))
  const hasTriggeredAlert = items.some((i) => i.status === 'TRIGGERED')

  return {
    mode,
    totalCurrentPortfolioValue: totalCurrentValue,
    cashInflowAmount: effectiveInflow,
    totalPostPortfolioValue: totalPostValue,
    tolerancePercent,
    overallDriftScore,
    hasTriggeredAlert,
    items,
    summaryNotes: {
      totalBuyAmount,
      totalTrimAmount,
      unallocatedCash: Math.max(0, effectiveInflow - totalBuyAmount),
      taxSavingsNote:
        mode === 'CASH_FLOW'
          ? 'การปรับสมดุลด้วยเงินเติมใหม่ช่วยป้องกันการเสียภาษี Capital Gains และค่าคอมมิชชันจากการขายหุ้น'
          : undefined,
    },
  }
}
