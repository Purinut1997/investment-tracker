'use client'

import React, { useState, useMemo } from 'react'
import {
  ChevronDown,
  ChevronUp,
  Target,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Coins,
  DollarSign,
  AlertTriangle,
  PauseCircle,
  CheckCircle2,
  SlidersHorizontal,
  Save,
  Copy,
  Check,
  Zap,
  Info,
  Layers,
  ArrowRight,
} from 'lucide-react'
import { StockLogo } from '@/components/StockLogo'
import type { HoldingItem } from '@/lib/analytics/holdings'

interface SubAllocationDrillDownProps {
  categoryKey: string
  categoryLabel: string
  categoryEmoji: string
  holdings: HoldingItem[]
  categoryTotalValue: number
  portfolioTotalValue: number
  baseCurrency: string
  targetCategoryPct: number
  actualCategoryPct: number
  defaultDcaBudget?: number
  savedSubTargets?: Record<string, number>
  onSaveSubTargets?: (subTargets: Record<string, number>) => Promise<void> | void
  onOpenQuickAddWithItems?: (items: Array<{ ticker: string; amount: number; shares: number }>) => void
}

export interface SubAssetItem {
  ticker: string
  name: string
  market: string
  shares: number
  currentPrice: number
  currentValueBase: number
  actualWeightInGroup: number
  actualWeightInPortfolio: number
  targetWeightInGroup: number
  driftInGroup: number // actual - target
  unrealizedPnLPercent: number
  signal: {
    type: 'DIP_BUY' | 'ACCUMULATE' | 'PAUSE' | 'BALANCED'
    badgeText: string
    badgeClass: string
    description: string
  }
}

export function SubAllocationDrillDown({
  categoryKey,
  categoryLabel,
  categoryEmoji,
  holdings,
  categoryTotalValue,
  portfolioTotalValue,
  baseCurrency,
  targetCategoryPct,
  actualCategoryPct,
  defaultDcaBudget = 5000,
  savedSubTargets = {},
  onSaveSubTargets,
  onOpenQuickAddWithItems,
}: SubAllocationDrillDownProps) {
  // Monthly DCA budget input state
  const [dcaBudget, setDcaBudget] = useState<number>(defaultDcaBudget)
  const [isEditingTargets, setIsEditingTargets] = useState<boolean>(false)
  const [customTargets, setCustomTargets] = useState<Record<string, number>>(savedSubTargets)
  const [isSaving, setIsSaving] = useState(false)
  const [copiedPlan, setCopiedPlan] = useState(false)

  // Filter holdings for this specific category
  const categoryHoldings = useMemo(() => {
    const key = categoryKey.toUpperCase()
    return holdings.filter((h) => {
      const hMarket = (h.market || '').toUpperCase()
      const hType = (h.assetType || '').toUpperCase()

      if (key === 'US') {
        return hMarket === 'US' || (!hMarket && hType !== 'CRYPTO' && hType !== 'GOLD')
      }
      if (key === 'TH') {
        return hMarket === 'TH' || h.ticker.endsWith('.BK')
      }
      if (key === 'CRYPTO') {
        return hType === 'CRYPTO' || h.ticker.includes('BTC') || h.ticker.includes('ETH')
      }
      if (key === 'GOLD') {
        return hType === 'GOLD' || h.ticker.includes('GOLD') || h.ticker.includes('XAU')
      }
      return hMarket === key || hType === key
    })
  }, [categoryKey, holdings])

  // Determine sub-targets (if none saved, propose equal weights or proportional)
  const effectiveSubTargets = useMemo(() => {
    const targets: Record<string, number> = { ...savedSubTargets, ...customTargets }
    if (Object.keys(targets).length > 0) return targets

    // Default sample for US if matches typical tickers
    if (categoryKey.toUpperCase() === 'US') {
      const usTickers = categoryHoldings.map((h) => h.ticker.toUpperCase())
      if (usTickers.includes('VOO') || usTickers.includes('QQQM') || usTickers.includes('SCHD')) {
        return { VOO: 30, QQQM: 30, SCHD: 30, GOOGL: 10 }
      }
    }

    // Default equal weight
    if (categoryHoldings.length > 0) {
      const equalPct = Math.round(100 / categoryHoldings.length)
      const def: Record<string, number> = {}
      categoryHoldings.forEach((h, idx) => {
        def[h.ticker.toUpperCase()] = idx === 0 ? 100 - equalPct * (categoryHoldings.length - 1) : equalPct
      })
      return def
    }

    return {}
  }, [categoryKey, categoryHoldings, savedSubTargets, customTargets])

  // Build sub-asset items with technical and rebalancing signals
  const subItems: SubAssetItem[] = useMemo(() => {
    const safeGroupTotal = Math.max(1, categoryTotalValue)
    const safePortTotal = Math.max(1, portfolioTotalValue)

    return categoryHoldings.map((h) => {
      const tKey = h.ticker.toUpperCase()
      const targetWeight = effectiveSubTargets[tKey] ?? 0
      const actualWeightInGroup = (h.currentValueBase / safeGroupTotal) * 100
      const actualWeightInPortfolio = (h.currentValueBase / safePortTotal) * 100
      const drift = actualWeightInGroup - targetWeight

      // Signal detection logic (Technical & Rebalance Timing)
      let signal: SubAssetItem['signal']

      if (drift <= -4) {
        // Significantly underweight
        if (h.unrealizedPnLPercent < -3 || h.unrealizedPnLPercent < 5) {
          signal = {
            type: 'DIP_BUY',
            badgeText: '🔥 ชนแนวรับ / น่าช้อนพิเศษ (Top Buy)',
            badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
            description: `สัดส่วนยังขาดอีก ${Math.abs(drift).toFixed(1)}% ราคาอยู่ในโซนได้เปรียบ แนะนำเร่งสะสม`,
          }
        } else {
          signal = {
            type: 'ACCUMULATE',
            badgeText: '🟢 ขาดเป้าหมาย / ทยอยสะสม (Accumulate)',
            badgeClass: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
            description: `สัดส่วนต่ำกว่าเป้า ${Math.abs(drift).toFixed(1)}% ควรแบ่งเงินเติมในงวดนี้`,
          }
        }
      } else if (drift >= 5) {
        // Significantly overweight
        signal = {
          type: 'PAUSE',
          badgeText: '⏸️ โตเกินเป้า / งดซื้อชั่วคราว (Pause & Hold)',
          badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
          description: `สัดส่วนเกินเป้าไป +${drift.toFixed(1)}% ควรงดซื้อเพื่อไม่ให้พอร์ตกระจุกตัว`,
        }
      } else {
        // Well balanced within ±4%
        signal = {
          type: 'BALANCED',
          badgeText: '✨ สมดุลดี / สะสมตามแผนปกติ (Balanced)',
          badgeClass: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/20',
          description: `สัดส่วนใกล้เคียงเป้าหมาย (${targetWeight}%) สะสมตามน้ำหนักปกติได้`,
        }
      }

      return {
        ticker: h.ticker,
        name: h.assetName || h.ticker,
        market: h.market || categoryKey,
        shares: h.quantity,
        currentPrice: h.currentPrice,
        currentValueBase: h.currentValueBase,
        actualWeightInGroup,
        actualWeightInPortfolio,
        targetWeightInGroup: targetWeight,
        driftInGroup: drift,
        unrealizedPnLPercent: h.unrealizedPnLPercent,
        signal,
      }
    })
  }, [categoryHoldings, categoryTotalValue, portfolioTotalValue, effectiveSubTargets, categoryKey])

  // Smart Tactical Monthly DCA Recommendation Engine
  const tacticalPlan = useMemo(() => {
    if (subItems.length === 0 || dcaBudget <= 0) return []

    // 1. Identify underweighted candidates
    const underweighted = subItems.filter((item) => item.driftInGroup < 0)

    // If no one is underweight, distribute based on target weights
    if (underweighted.length === 0) {
      return subItems.map((item) => {
        const shareOfBudget = (item.targetWeightInGroup / 100) * dcaBudget
        const estShares = item.currentPrice > 0 ? (shareOfBudget / item.currentPrice) : 0
        return {
          ticker: item.ticker,
          name: item.name,
          amount: Math.round(shareOfBudget),
          estShares: Number(estShares.toFixed(3)),
          action: 'ACCUMULATE',
          reason: `พอร์ตสมดุลดี แบ่งเงินตามสัดส่วนเป้าหมาย ${item.targetWeightInGroup}%`,
          statusClass: 'text-indigo-400',
        }
      })
    }

    // 2. Weight underweight candidates with priority bonus for DIP_BUY
    let totalScore = 0
    const scored = underweighted.map((item) => {
      const deficit = Math.abs(item.driftInGroup)
      const bonusMultiplier = item.signal.type === 'DIP_BUY' ? 1.7 : 1.0
      const score = deficit * bonusMultiplier
      totalScore += score
      return { item, score }
    })

    // 3. Assign budget proportionally
    const allocations = new Map<string, { amount: number; estShares: number; reason: string; action: string }>()

    let distributed = 0
    scored.forEach(({ item, score }, idx) => {
      const rawAmt = (score / totalScore) * dcaBudget
      // Round to nearest 50 or 100 for clean numbers
      const roundedAmt = idx === scored.length - 1 ? dcaBudget - distributed : Math.round(rawAmt / 50) * 50
      distributed += roundedAmt

      const estShares = item.currentPrice > 0 ? (roundedAmt / item.currentPrice) : 0
      const reason =
        item.signal.type === 'DIP_BUY'
          ? `สัดส่วนยังขาดอีก ${Math.abs(item.driftInGroup).toFixed(1)}% + ชนแนวรับสำคัญ/ราคาลงมาลึก จัดเป็นจุดช้อนซื้อที่ได้เปรียบสูงสุด`
          : `สัดส่วนยังขาดอีก ${Math.abs(item.driftInGroup).toFixed(1)}% แบ่งเงินเติมเพื่อดึงพอร์ตเข้าสู่เป้าหมาย ${item.targetWeightInGroup}%`

      allocations.set(item.ticker, {
        amount: roundedAmt,
        estShares: Number(estShares.toFixed(3)),
        action: item.signal.type === 'DIP_BUY' ? '🔥 ช้อนซื้อพิเศษ' : '🟢 ทยอยสะสม',
        reason,
      })
    })

    // Return full list including paused ones
    return subItems.map((item) => {
      const alloc = allocations.get(item.ticker)
      if (alloc) {
        return {
          ticker: item.ticker,
          name: item.name,
          amount: alloc.amount,
          estShares: alloc.estShares,
          action: alloc.action,
          reason: alloc.reason,
          statusClass: alloc.amount > 0 ? 'text-emerald-400' : 'text-slate-400',
        }
      }
      return {
        ticker: item.ticker,
        name: item.name,
        amount: 0,
        estShares: 0,
        action: '⏸️ งดซื้อชั่วคราว',
        reason: `สัดส่วนปัจจุบัน (${item.actualWeightInGroup.toFixed(1)}%) เกินหรือแตะเป้าหมายแล้ว ชะลอการซื้อเพื่อให้ตัวอื่นไล่ตามทัน`,
        statusClass: 'text-amber-400',
      }
    })
  }, [subItems, dcaBudget])

  // Save sub-target percentages
  async function handleSaveTargets() {
    setIsSaving(true)
    try {
      if (onSaveSubTargets) {
        await onSaveSubTargets(customTargets)
      }
      setIsEditingTargets(false)
    } finally {
      setIsSaving(false)
    }
  }

  // Copy plan text to clipboard
  function handleCopyPlan() {
    const text = tacticalPlan
      .map(
        (p) =>
          `• ${p.ticker}: ${p.amount > 0 ? `ซื้อ ฿${p.amount.toLocaleString()} (~${p.estShares} หุ้น)` : 'งดซื้อชั่วคราว (฿0)'} (${p.reason})`
      )
      .join('\n')

    const fullMessage = `📋 แผนการจัดสรรเงินเดือนหน้ากลุ่ม ${categoryKey} (งบ ฿${dcaBudget.toLocaleString()}):\n${text}`
    navigator.clipboard.writeText(fullMessage)
    setCopiedPlan(true)
    setTimeout(() => setCopiedPlan(false), 2000)
  }

  // Calculate total custom targets
  const totalCustomPct = useMemo(() => {
    return Object.values(effectiveSubTargets).reduce((sum, v) => sum + (Number(v) || 0), 0)
  }, [effectiveSubTargets])

  return (
    <div className="pt-4 border-t border-white/[0.08] space-y-5 animate-fade-in">
      {/* ── Sub-allocation Overview & Action Bar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/[0.02] p-3.5 rounded-xl border border-white/[0.06]">
        <div>
          <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            สัดส่วนหุ้นย่อยภายในกลุ่ม {categoryEmoji} {categoryKey} ({categoryHoldings.length} รายการ)
          </h4>
          <p className="text-[11px] text-slate-400 mt-0.5">
            เปรียบเทียบสัดส่วนจริงกับเป้าหมายย่อย พร้อมระบบตรวจจับแนวรับและจุดช้อนซื้อ
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setIsEditingTargets(!isEditingTargets)}
            className="text-xs px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-300 flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <SlidersHorizontal className="w-3 h-3 text-indigo-400" />
            <span>{isEditingTargets ? 'ปิดการตั้งค่า' : '⚙️ ปรับ % เป้าหมายย่อย'}</span>
          </button>
        </div>
      </div>

      {/* ── Inline Target Setting Panel (when expanded) ── */}
      {isEditingTargets && (
        <div className="p-4 rounded-xl bg-indigo-950/20 border border-indigo-500/30 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-300">
              กำหนดสัดส่วนเป้าหมายย่อย (รวมควรได้ 100%)
            </span>
            <span
              className={`text-xs font-mono font-bold ${
                Math.abs(totalCustomPct - 100) < 0.1 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              รวม: {totalCustomPct}% / 100%
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
            {categoryHoldings.map((h) => {
              const t = h.ticker.toUpperCase()
              const val = customTargets[t] ?? effectiveSubTargets[t] ?? 0
              return (
                <div key={t} className="p-2 rounded-lg bg-black/40 border border-white/[0.06] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">{t}</span>
                    <span className="text-[10px] text-slate-400">เป้าหมาย %</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={val}
                      onChange={(e) =>
                        setCustomTargets({
                          ...customTargets,
                          [t]: Number(e.target.value) || 0,
                        })
                      }
                      className="w-full bg-slate-900 border border-white/[0.1] rounded px-2 py-1 text-xs text-white font-mono focus:border-indigo-400 focus:outline-hidden"
                    />
                    <span className="text-xs text-slate-500">%</span>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={handleSaveTargets}
              disabled={isSaving}
              className="text-xs px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'กำลังบันทึก...' : 'บันทึกสัดส่วนย่อย'}</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Sub-Holdings Table ── */}
      <div className="overflow-x-auto rounded-xl border border-white/[0.06] bg-black/25">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-white/[0.08] bg-white/[0.02] text-slate-400 font-mono text-[11px]">
              <th className="py-2.5 px-3">สินทรัพย์</th>
              <th className="py-2.5 px-3 text-right">มูลค่าปัจจุบัน</th>
              <th className="py-2.5 px-3 text-center">สัดส่วนในกลุ่ม (จริง vs เป้า)</th>
              <th className="py-2.5 px-3 text-right">ส่วนต่าง</th>
              <th className="py-2.5 px-3 text-center">สัญญาณ & จังหวะราคา</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {subItems.map((item) => {
              const isOver = item.driftInGroup > 0
              const isUnder = item.driftInGroup < 0

              return (
                <tr key={item.ticker} className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2.5">
                      <StockLogo
                        ticker={item.ticker}
                        name={item.name}
                        size={28}
                      />
                      <div>
                        <span className="font-bold text-white block">{item.ticker}</span>
                        <span className="text-[10px] text-slate-400 truncate max-w-[120px] block">
                          {item.name}
                        </span>
                      </div>
                    </div>
                  </td>

                  <td className="py-3 px-3 text-right font-mono">
                    <span className="text-white font-semibold block">
                      ฿{item.currentValueBase.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                    <span
                      className={`text-[10px] ${
                        item.unrealizedPnLPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {item.unrealizedPnLPercent >= 0 ? '+' : ''}
                      {item.unrealizedPnLPercent.toFixed(1)}% P&L
                    </span>
                  </td>

                  <td className="py-3 px-3">
                    <div className="space-y-1 max-w-[140px] mx-auto">
                      <div className="flex items-center justify-between text-[10px] font-mono">
                        <span className="text-slate-400">{item.actualWeightInGroup.toFixed(1)}%</span>
                        <span className="text-indigo-300 font-semibold">{item.targetWeightInGroup}%</span>
                      </div>
                      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden flex">
                        <div
                          className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, item.actualWeightInGroup)}%` }}
                        />
                      </div>
                    </div>
                  </td>

                  <td className="py-3 px-3 text-right font-mono">
                    <span
                      className={`font-bold text-xs ${
                        Math.abs(item.driftInGroup) <= 3
                          ? 'text-slate-400'
                          : isOver
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      {isOver ? '+' : ''}
                      {item.driftInGroup.toFixed(1)}%
                    </span>
                  </td>

                  <td className="py-3 px-3 text-center">
                    <span
                      className={`inline-flex items-center text-[10px] font-semibold px-2.5 py-1 rounded-full border ${item.signal.badgeClass}`}
                    >
                      {item.signal.badgeText}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ── Smart Monthly Tactical DCA Allocation Recommendation Box ── */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-indigo-950/30 via-[#121622] to-cyan-950/20 border border-indigo-500/25 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                คำแนะนำจัดสรรเงินเดือนหน้า (Smart Tactical DCA)
              </h4>
              <p className="text-[11px] text-slate-400">
                วิเคราะห์ร่วมระหว่างสัดส่วนที่ยังขาดในพอร์ต + สัญญาณแนวรับ เพื่อกระจายเงินให้คุ้มค่าที่สุด
              </p>
            </div>
          </div>

          {/* Monthly Budget Controller */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-sans">งบเติมเงิน:</span>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-indigo-400 font-bold">
                ฿
              </span>
              <input
                type="number"
                step="500"
                min="0"
                value={dcaBudget}
                onChange={(e) => setDcaBudget(Math.max(0, Number(e.target.value) || 0))}
                className="w-28 pl-6 pr-2 py-1 bg-black/50 border border-white/[0.12] rounded-lg text-xs font-mono font-bold text-white focus:border-indigo-400 focus:outline-hidden"
              />
            </div>
            <div className="hidden sm:flex items-center gap-1">
              {[3000, 5000, 10000].map((quick) => (
                <button
                  key={quick}
                  type="button"
                  onClick={() => setDcaBudget(quick)}
                  className={`text-[10px] px-2 py-1 rounded-md border font-mono transition-all cursor-pointer ${
                    dcaBudget === quick
                      ? 'bg-indigo-600 text-white border-indigo-500'
                      : 'bg-white/[0.04] text-slate-400 border-white/[0.08] hover:text-white'
                  }`}
                >
                  {quick.toLocaleString()}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Action Recommendations Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {tacticalPlan.map((plan) => {
            const isZero = plan.amount === 0
            return (
              <div
                key={plan.ticker}
                className={`p-3.5 rounded-xl border transition-all ${
                  isZero
                    ? 'bg-white/[0.01] border-white/[0.05] opacity-75'
                    : 'bg-indigo-500/[0.07] border-indigo-500/25 shadow-md shadow-indigo-950/20'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white font-mono">{plan.ticker}</span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                        isZero
                          ? 'bg-amber-500/15 text-amber-300 border border-amber-500/20'
                          : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20'
                      }`}
                    >
                      {plan.action}
                    </span>
                  </div>

                  <span className={`text-sm font-mono font-bold ${plan.statusClass}`}>
                    {isZero ? '฿0' : `฿${plan.amount.toLocaleString()}`}
                  </span>
                </div>

                <p className="text-[11px] text-slate-300 leading-relaxed font-sans mb-1.5">
                  {plan.reason}
                </p>

                {!isZero && plan.estShares > 0 && (
                  <div className="text-[10px] font-mono text-indigo-300 flex items-center gap-1.5 pt-1 border-t border-white/[0.06]">
                    <span>🎯 ซื้อได้ประมาณ:</span>
                    <strong className="text-white">{plan.estShares} หุ้น</strong>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
          <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            คำนวณจากสัดส่วนเป้าหมายและจุดช้อนราคา ช่วยให้กระจายเงินได้ประสิทธิภาพสูงสุด
          </p>

          <button
            type="button"
            onClick={handleCopyPlan}
            className="text-xs px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-slate-300 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            {copiedPlan ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-semibold">คัดลอกแผนแล้ว</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span>คัดลอกแผนซื้อ</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
