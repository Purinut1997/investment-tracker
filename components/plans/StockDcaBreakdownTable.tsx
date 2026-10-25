'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { StockLogo } from '@/components/StockLogo'
import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Zap,
  ShieldCheck,
  TrendingUp,
  DollarSign,
  Plus,
  Coins,
  CheckSquare,
  Square,
  SlidersHorizontal,
  RefreshCw,
  Copy,
  Check,
  Percent,
  Calculator,
} from 'lucide-react'
import { StockDcaAllocationItem, StockDcaBreakdownResult } from '@/lib/analytics/rebalancing'

interface StockDcaBreakdownTableProps {
  planResult: StockDcaBreakdownResult
  onQuickBuy: (ticker: string, amount: number, market?: string) => void
  baseCurrency?: string
}

type DistributionStrategy = 'auto' | 'equal' | 'custom'

export function StockDcaBreakdownTable({
  planResult,
  onQuickBuy,
  baseCurrency = 'THB',
}: StockDcaBreakdownTableProps) {
  const { totalInflow, items: initialItems } = planResult

  // 1. Selected Tickers state: default to all items that are underweight or have initial allocation
  const [selectedTickers, setSelectedTickers] = useState<Set<string>>(() => {
    const defaultSelected = new Set<string>()
    for (const item of initialItems) {
      if (item.status === 'UNDERWEIGHT' || item.allocatedAmountBase > 0) {
        defaultSelected.add(item.ticker.toUpperCase())
      }
    }
    // If none are underweight, default to all items
    if (defaultSelected.size === 0) {
      for (const item of initialItems) {
        defaultSelected.add(item.ticker.toUpperCase())
      }
    }
    return defaultSelected
  })

  // 2. Distribution Strategy: 'auto' (weighted by deficit/target), 'equal', or 'custom'
  const [strategy, setStrategy] = useState<DistributionStrategy>('auto')

  // 3. Custom amounts state for 'custom' mode
  const [customAmounts, setCustomAmounts] = useState<Record<string, number>>({})

  // 4. Copied toast state
  const [copied, setCopied] = useState(false)

  // Toggle single ticker
  const handleToggleTicker = (ticker: string) => {
    setSelectedTickers((prev) => {
      const next = new Set(prev)
      const upper = ticker.toUpperCase()
      if (next.has(upper)) {
        next.delete(upper)
      } else {
        next.add(upper)
      }
      return next
    })
  }

  // Preset selection buttons
  const handleSelectUnderweightOnly = () => {
    const set = new Set<string>()
    for (const it of initialItems) {
      if (it.status === 'UNDERWEIGHT') {
        set.add(it.ticker.toUpperCase())
      }
    }
    setSelectedTickers(set)
    setStrategy('auto')
  }

  const handleSelectAll = () => {
    const set = new Set<string>()
    for (const it of initialItems) {
      set.add(it.ticker.toUpperCase())
    }
    setSelectedTickers(set)
  }

  const handleClearSelection = () => {
    setSelectedTickers(new Set())
  }

  // 5. Dynamic Recalculation based on user's selected tickers and strategy
  const computedResult = useMemo(() => {
    const selectedList = initialItems.filter((it) =>
      selectedTickers.has(it.ticker.toUpperCase())
    )

    if (selectedList.length === 0 || totalInflow <= 0) {
      return {
        totalInflow,
        totalAllocated: 0,
        unallocatedCash: totalInflow,
        allocatedCount: 0,
        items: initialItems.map((it) => ({
          ...it,
          allocatedAmountBase: 0,
          estimatedShares: 0,
          postValueBase: it.currentValueBase,
          postWeight: it.currentWeight,
          isSelected: selectedTickers.has(it.ticker.toUpperCase()),
        })),
      }
    }

    const totalPostValue =
      initialItems.reduce((sum, h) => sum + h.currentValueBase, 0) + totalInflow

    const allocatedMap: Record<string, number> = {}

    if (strategy === 'equal') {
      // Equal split: divide totalInflow equally among selected
      const perTicker = Math.floor(totalInflow / selectedList.length)
      let remainder = totalInflow - perTicker * selectedList.length

      selectedList.forEach((it, idx) => {
        const extra = idx < remainder ? 1 : 0
        allocatedMap[it.ticker.toUpperCase()] = perTicker + extra
      })
    } else if (strategy === 'custom') {
      // Custom mode: use custom amounts entered by user
      selectedList.forEach((it) => {
        const amt = customAmounts[it.ticker.toUpperCase()] ?? 0
        allocatedMap[it.ticker.toUpperCase()] = Math.max(0, amt)
      })
    } else {
      // 'auto': Calculate deficits among selected items
      const selectedDeficits: { ticker: string; deficit: number; targetWeight: number }[] = []
      let sumDeficits = 0
      let sumTargetWeights = 0

      for (const it of selectedList) {
        const idealPostVal = (it.targetWeight / 100) * totalPostValue
        const deficit = Math.max(0, idealPostVal - it.currentValueBase)
        selectedDeficits.push({
          ticker: it.ticker.toUpperCase(),
          deficit,
          targetWeight: it.targetWeight,
        })
        sumDeficits += deficit
        sumTargetWeights += Math.max(1, it.targetWeight)
      }

      if (sumDeficits > 0 && totalInflow <= sumDeficits) {
        // Allocate proportional to deficits
        for (const sd of selectedDeficits) {
          const alloc = Math.round(totalInflow * (sd.deficit / sumDeficits))
          allocatedMap[sd.ticker] = alloc
        }
      } else if (sumDeficits > 0 && totalInflow > sumDeficits) {
        // Fund 100% of deficits, remaining cash spread by target weight
        const remaining = totalInflow - sumDeficits
        for (const sd of selectedDeficits) {
          const extra = Math.round(remaining * (sd.targetWeight / sumTargetWeights))
          allocatedMap[sd.ticker] = Math.round(sd.deficit + extra)
        }
      } else {
        // All selected are balanced: allocate proportional to target weight
        for (const sd of selectedDeficits) {
          const alloc = Math.round(totalInflow * (sd.targetWeight / sumTargetWeights))
          allocatedMap[sd.ticker] = alloc
        }
      }
    }

    let totalAllocated = 0
    const finalItems = initialItems.map((it) => {
      const isSelected = selectedTickers.has(it.ticker.toUpperCase())
      const alloc = isSelected ? allocatedMap[it.ticker.toUpperCase()] || 0 : 0
      totalAllocated += alloc

      const postVal = it.currentValueBase + alloc
      const postWeight =
        totalPostValue > 0 ? Number(((postVal / totalPostValue) * 100).toFixed(1)) : 0
      const estimatedShares =
        it.currentPriceBase > 0 && alloc > 0
          ? Number((alloc / it.currentPriceBase).toFixed(2))
          : 0

      return {
        ...it,
        allocatedAmountBase: alloc,
        estimatedShares,
        postValueBase: postVal,
        postWeight,
        isSelected,
      }
    })

    // Sort: Selected first, then by allocated amount desc, then underweight
    finalItems.sort((a, b) => {
      if (a.isSelected && !b.isSelected) return -1
      if (!a.isSelected && b.isSelected) return 1
      if (a.allocatedAmountBase > 0 && b.allocatedAmountBase === 0) return -1
      if (b.allocatedAmountBase > 0 && a.allocatedAmountBase === 0) return 1
      return b.allocatedAmountBase - a.allocatedAmountBase
    })

    return {
      totalInflow,
      totalAllocated,
      unallocatedCash: Math.max(0, totalInflow - totalAllocated),
      allocatedCount: Object.values(allocatedMap).filter((a) => a > 0).length,
      items: finalItems,
    }
  }, [initialItems, selectedTickers, strategy, customAmounts, totalInflow])

  // Sync custom amounts default when entering custom mode
  useEffect(() => {
    if (strategy === 'custom' && Object.keys(customAmounts).length === 0) {
      const defaults: Record<string, number> = {}
      for (const it of computedResult.items) {
        if (it.isSelected) {
          defaults[it.ticker.toUpperCase()] = it.allocatedAmountBase
        }
      }
      setCustomAmounts(defaults)
    }
  }, [strategy])

  // Copy plan for selected stocks
  const handleCopyCustomPlan = () => {
    const funded = computedResult.items.filter((i) => i.allocatedAmountBase > 0)
    const lines = [
      `📋 แผนจัดสรรเงินเติม DCA รายหุ้น (กำหนดเอง)`,
      `งบเงินเติมรวม: ฿${computedResult.totalInflow.toLocaleString()}`,
      `จัดสรรซื้อแล้ว: ฿${computedResult.totalAllocated.toLocaleString()} (${funded.length} สินทรัพย์)`,
      computedResult.unallocatedCash > 0
        ? `เงินสดคงเหลือพักไว้: ฿${computedResult.unallocatedCash.toLocaleString()}`
        : '',
      `---------------------------------`,
      ...funded.map(
        (i, idx) =>
          `${idx + 1}. ${i.ticker} (${i.assetName}): ฿${i.allocatedAmountBase.toLocaleString()}${
            i.estimatedShares > 0 ? ` (~ ${i.estimatedShares} หุ้น)` : ''
          } | สัดส่วนใหม่: ${i.postWeight}%`
      ),
      `---------------------------------`,
      `*คำนวณอัตโนมัติโดย ClassCare 360 Investment Tracker`,
    ].filter(Boolean)
    navigator.clipboard.writeText(lines.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-4">
      {/* ── KPI HIGHLIGHTS & SUMMARY BANNER ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-2xl bg-[#0F131C] border border-white/[0.08] flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              งบเติม DCA งวดนี้
            </span>
            <p className="text-xl font-black text-white font-mono mt-0.5">
              ฿{computedResult.totalInflow.toLocaleString()}
            </p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold">
            <Zap className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-[#0F131C] border border-emerald-500/20 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">
              จัดสรรซื้อหุ้นแล้ว ({computedResult.allocatedCount} ตัวที่เลือก)
            </span>
            <p className="text-xl font-black text-emerald-400 font-mono mt-0.5">
              ฿{computedResult.totalAllocated.toLocaleString()}
            </p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold">
            <Coins className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-[#0F131C] border border-white/[0.08] flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              เงินสดคงเหลือพักไว้
            </span>
            <p className="text-xl font-black text-cyan-300 font-mono mt-0.5">
              ฿{computedResult.unallocatedCash.toLocaleString()}
            </p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold">
            <ShieldCheck className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* ── CUSTOM SELECTION & ALLOCATION STRATEGY TOOLBAR ── */}
      <div className="p-4 rounded-2xl bg-[#0D1017] border border-white/[0.08] flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 shadow-md">
        {/* Left: Ticker selection presets */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5 mr-1">
            <CheckSquare className="w-4 h-4 text-emerald-400" />
            <span>เลือกหุ้นที่จะซื้อเดือนนี้:</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-bold">
              {selectedTickers.size} / {initialItems.length} ตัว
            </span>
          </span>

          <button
            type="button"
            onClick={handleSelectUnderweightOnly}
            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 transition-all cursor-pointer"
          >
            ⭐ เฉพาะตัวขาดเป้า
          </button>

          <button
            type="button"
            onClick={handleSelectAll}
            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 transition-all cursor-pointer"
          >
            เลือกทั้งหมด
          </button>

          <button
            type="button"
            onClick={handleClearSelection}
            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white/[0.05] hover:bg-white/[0.1] text-slate-400 hover:text-rose-300 transition-all cursor-pointer"
          >
            ล้างการเลือก
          </button>
        </div>

        {/* Right: Allocation Strategy Mode + Copy Button */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-slate-400 hidden sm:inline">วิธีแบ่งเงิน:</span>
          <div className="flex bg-black/40 p-0.5 rounded-xl border border-white/[0.08] text-xs">
            <button
              type="button"
              onClick={() => setStrategy('auto')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                strategy === 'auto'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="ระบบคำนวณกระจายเงินตามสัดส่วนที่ขาดเป้าหมาย เพื่อดึงพอร์ตเข้าสู่สมดุล"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>เกลี่ยตามเป้าหมาย (Auto)</span>
            </button>

            <button
              type="button"
              onClick={() => setStrategy('equal')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                strategy === 'equal'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="แบ่งเงินเท่าๆ กันทุกตัวที่เลือก"
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>หารเท่ากัน (Equal)</span>
            </button>

            <button
              type="button"
              onClick={() => setStrategy('custom')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                strategy === 'custom'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="พิมพ์ระบุจำนวนเงินที่ต้องการซื้อของแต่ละตัวด้วยตนเอง"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>ระบุเงินเอง (Custom)</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleCopyCustomPlan}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-300 text-xs font-semibold transition-all cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'คัดลอกแล้ว!' : 'คัดลอกคำสั่ง'}</span>
          </button>
        </div>
      </div>

      {/* ── RESPONSIVE TABLE WITH INTERACTIVE CHECKBOXES ── */}
      <div className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-[#0C0F14] shadow-2xl">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="border-b-2 border-white/[0.08] text-slate-300 font-bold uppercase text-xs tracking-wider bg-white/[0.03]">
              <th className="py-3.5 px-3 text-center w-12">เลือก</th>
              <th className="py-3.5 px-3 min-w-[190px]">หุ้น / สินทรัพย์</th>
              <th className="py-3.5 px-3 min-w-[130px]">สังกัดตะกร้า</th>
              <th className="py-3.5 px-3 text-right min-w-[100px]">สัดส่วนเดิม</th>
              <th className="py-3.5 px-3 text-right min-w-[90px]">เป้าหมาย</th>
              <th className="py-3.5 px-3 text-center min-w-[120px]">สถานะ</th>
              <th className="py-3.5 px-4 text-right min-w-[180px] bg-emerald-950/20 border-x border-emerald-500/20 text-emerald-300">
                ⭐ เงิน DCA ที่จัดสรร (฿)
              </th>
              <th className="py-3.5 px-3 text-right min-w-[120px]">จำนวนหุ้นที่ได้</th>
              <th className="py-3.5 px-3 text-right min-w-[100px]">สัดส่วนใหม่</th>
              <th className="py-3.5 px-4 text-center min-w-[120px]">ดำเนินการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.05] font-mono text-xs">
            {computedResult.items.map((item) => {
              const isSelected = item.isSelected
              const isFunded = item.allocatedAmountBase > 0
              const isUsd = item.currency === 'USD'

              return (
                <tr
                  key={item.id}
                  className={`transition-colors ${
                    isSelected && isFunded
                      ? 'bg-emerald-500/[0.05] hover:bg-emerald-500/[0.08]'
                      : isSelected
                      ? 'bg-white/[0.02] hover:bg-white/[0.04]'
                      : 'opacity-40 hover:opacity-60 bg-transparent'
                  }`}
                >
                  {/* Checkbox column */}
                  <td className="py-3 px-3 text-center">
                    <button
                      type="button"
                      onClick={() => handleToggleTicker(item.ticker)}
                      className="cursor-pointer text-slate-400 hover:text-white transition-colors"
                      title={isSelected ? 'คลิกเพื่อยกเลิกการซื้อตัวนี้ในงวดนี้' : 'คลิกเพื่อเลือกซื้อตัวนี้ในงวดนี้'}
                    >
                      {isSelected ? (
                        <CheckSquare className="w-5 h-5 text-emerald-400" />
                      ) : (
                        <Square className="w-5 h-5 text-slate-600" />
                      )}
                    </button>
                  </td>

                  {/* Ticker & Logo */}
                  <td className="py-3 px-3 font-sans">
                    <div className="flex items-center gap-2.5">
                      <StockLogo ticker={item.ticker} name={item.assetName} size={32} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-extrabold text-white text-sm font-mono">
                            {item.ticker}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/[0.06] text-slate-400 font-mono">
                            {item.market}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 truncate max-w-[130px]">
                          {item.assetName}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Strategy Bucket */}
                  <td className="py-3 px-3 font-sans">
                    {item.bucketName ? (
                      <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-lg bg-white/[0.04] text-slate-300 border border-white/[0.06]">
                        <span>{item.bucketEmoji}</span>
                        <span className="truncate max-w-[100px]">{item.bucketName}</span>
                      </span>
                    ) : (
                      <span className="text-slate-500 text-[11px]">—</span>
                    )}
                  </td>

                  {/* Current Weight */}
                  <td className="py-3 px-3 text-right text-slate-300 font-bold">
                    <div>{item.currentWeight.toFixed(1)}%</div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      ฿{Math.round(item.currentValueBase).toLocaleString()}
                    </div>
                  </td>

                  {/* Target Weight */}
                  <td className="py-3 px-3 text-right font-black text-white">
                    {item.targetWeight.toFixed(1)}%
                  </td>

                  {/* Status Badge */}
                  <td className="py-3 px-3 text-center font-sans">
                    {item.status === 'UNDERWEIGHT' ? (
                      <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        <ArrowDownRight className="w-3 h-3" /> ขาดเป้า ({item.driftPercent}%)
                      </span>
                    ) : item.status === 'OVERWEIGHT' ? (
                      <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-bold bg-amber-500/15 text-amber-300 border border-amber-500/25">
                        <ArrowUpRight className="w-3 h-3" /> เกินเป้า (+{item.driftPercent}%)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/25">
                        <CheckCircle2 className="w-3 h-3" /> สมดุล
                      </span>
                    )}
                  </td>

                  {/* Allocated Amount (Highlighted / Editable in Custom Mode) */}
                  <td className="py-3 px-4 text-right bg-emerald-950/10 border-x border-emerald-500/15">
                    {isSelected ? (
                      strategy === 'custom' ? (
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-xs text-slate-400 font-mono">฿</span>
                          <input
                            type="number"
                            min="0"
                            step="500"
                            value={customAmounts[item.ticker.toUpperCase()] ?? item.allocatedAmountBase}
                            onChange={(e) => {
                              const val = Math.max(0, parseFloat(e.target.value) || 0)
                              setCustomAmounts((prev) => ({
                                ...prev,
                                [item.ticker.toUpperCase()]: val,
                              }))
                            }}
                            className="w-24 bg-black/60 border border-emerald-500/40 rounded-lg px-2 py-1 text-right font-black text-emerald-300 font-mono text-sm focus:outline-none focus:border-emerald-400"
                          />
                        </div>
                      ) : item.allocatedAmountBase > 0 ? (
                        <div>
                          <span className="font-black text-emerald-400 text-base">
                            ฿{item.allocatedAmountBase.toLocaleString()}
                          </span>
                          {isUsd && (
                            <div className="text-[10px] text-emerald-300/80 font-mono">
                              ~${(item.allocatedAmountBase / (item.currentPriceBase / item.currentPrice || 33.5)).toFixed(2)}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 font-sans text-xs">ชะลอเติมงวดนี้</span>
                      )
                    ) : (
                      <span className="text-slate-500 font-sans text-xs">ไม่ได้เลือก</span>
                    )}
                  </td>

                  {/* Estimated Shares (Clear UX formatting without hyphen confusion) */}
                  <td className="py-3 px-3 text-right">
                    {isSelected && item.estimatedShares > 0 ? (
                      <div className="flex items-baseline justify-end gap-1">
                        <span className="text-slate-400 text-xs">~</span>
                        <span className="text-white font-bold text-sm">
                          {item.estimatedShares.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                        <span className="text-[10px] text-slate-400 font-sans">หุ้น</span>
                      </div>
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </td>

                  {/* Post Weight */}
                  <td className="py-3 px-3 text-right font-black text-indigo-300">
                    {item.postWeight.toFixed(1)}%
                  </td>

                  {/* Quick Action Button */}
                  <td className="py-3 px-4 text-center font-sans">
                    {isSelected && item.allocatedAmountBase > 0 ? (
                      <button
                        type="button"
                        onClick={() => onQuickBuy(item.ticker, item.allocatedAmountBase, item.market)}
                        className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs transition-all cursor-pointer shadow-md shadow-emerald-900/30 active:scale-95 flex items-center justify-center gap-1 mx-auto"
                      >
                        <Plus className="w-3 h-3" />
                        <span>ซื้อ {item.ticker}</span>
                      </button>
                    ) : (
                      <span className="text-slate-500 text-xs">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0" />
        <span>
          💡 <strong>การเลือกกำหนดเอง:</strong> คุณสามารถติ๊กเลือกเฉพาะหุ้นที่ต้องการซื้อในเดือนนี้ได้ตามใจชอบ โดยระบบจะนำงบเงินเติมมาเฉลี่ยและคำนวณจำนวนเงินที่เหมาะสมให้เฉพาะหุ้นที่คุณเลือกโดยอัตโนมัติ
        </span>
      </div>
    </div>
  )
}
