'use client'

import React, { useState, useMemo } from 'react'
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { StockLogo } from '@/components/StockLogo'
import {
  ArrowRight,
  Layers,
  Sparkles,
  ChevronDown,
  ArrowUpRight,
  Wallet,
  Eye,
} from 'lucide-react'
import Link from 'next/link'

export interface AllocationItem {
  name: string
  fullName: string
  assetType: string
  market: string
  value: number
  percent: number
  targetPercent: number | null
  deviation: number | null
  color: string
}

export interface ClassCategoryItem {
  key: string
  name: string
  fullName: string
  value: number
  percent: number
  color: string
  holdings: AllocationItem[]
}

interface AssetAllocationVisualizerProps {
  items: AllocationItem[]
  assetClasses?: Array<{
    key?: string
    classKey?: string
    name?: string
    label?: string
    percent: number
    value: number
    color?: string
  }>
  totalValue: number
  onSelectStock?: (stock: { symbol: string; name?: string; market?: string }) => void
}

const MODERN_PALETTE = [
  '#6366f1', // Electric Indigo
  '#10b981', // Emerald Mint
  '#06b6d4', // Cyan Sky
  '#f59e0b', // Radiant Amber
  '#ec4899', // Vivid Rose
  '#8b5cf6', // Deep Violet
  '#3b82f6', // Oceanic Blue
  '#14b8a6', // Teal
  '#f97316', // Flame Orange
  '#a855f7', // Purple Neon
]

const CLASS_COLORS: Record<string, string> = {
  US: '#3b82f6',     // Oceanic Blue
  TH: '#10b981',     // Emerald Mint
  CRYPTO: '#f59e0b', // Radiant Amber
  GOLD: '#eab308',   // Yellow Gold
  CASH: '#06b6d4',   // Cyan Cash
  STOCK: '#6366f1',  // Electric Indigo
  FUND: '#10b981',   // Emerald
  BOND: '#06b6d4',   // Cyan
  OTHER: '#8b5cf6',  // Violet
}

/**
 * Filter and sort holdings belonging to a specific asset category
 */
function getCategoryHoldings(catKey: string, allItems: AllocationItem[]): AllocationItem[] {
  const normKey = (catKey || '').toLowerCase()

  let matches: AllocationItem[] = []

  if (normKey === 'cash') {
    matches = allItems.filter(
      (it) => it.assetType?.toLowerCase() === 'cash' || it.name.toUpperCase() === 'CASH'
    )
  } else if (normKey === 'fund' || normKey === 'etf') {
    matches = allItems.filter((it) => {
      const t = (it.assetType || '').toLowerCase()
      return t === 'fund' || t === 'etf'
    })
  } else if (normKey === 'crypto') {
    matches = allItems.filter(
      (it) => it.assetType?.toLowerCase() === 'crypto' || it.market?.toUpperCase() === 'CRYPTO'
    )
  } else if (normKey === 'bond') {
    matches = allItems.filter((it) => (it.assetType || '').toLowerCase() === 'bond')
  } else if (normKey === 'gold') {
    matches = allItems.filter((it) => (it.assetType || '').toLowerCase() === 'gold')
  } else if (normKey === 'stock') {
    matches = allItems.filter((it) => {
      const isCash = it.assetType?.toLowerCase() === 'cash' || it.name.toUpperCase() === 'CASH'
      if (isCash) return false
      const t = (it.assetType || '').toLowerCase()
      if (['fund', 'etf', 'crypto', 'bond', 'gold'].includes(t)) return false
      if (it.market?.toUpperCase() === 'CRYPTO') return false
      return true
    })
  } else {
    // Fallback: match by market or explicit assetType
    const byMarket = allItems.filter((it) => it.market?.toUpperCase() === catKey.toUpperCase())
    if (byMarket.length > 0) {
      matches = byMarket
    } else {
      matches = allItems.filter((it) => it.assetType?.toUpperCase() === catKey.toUpperCase())
    }
  }

  // Sort descending by value
  return [...matches].sort((a, b) => b.value - a.value)
}

export function AssetAllocationVisualizer({
  items,
  assetClasses = [],
  totalValue,
  onSelectStock,
}: AssetAllocationVisualizerProps) {
  const [viewMode, setViewMode] = useState<'assets' | 'classes'>('assets')
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

  const toggleCategory = (key: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  // Robust computation of Asset Classes with child holdings
  const classDataList: ClassCategoryItem[] = useMemo(() => {
    // 1. If backend summary provided valid asset classes with positive values
    if (Array.isArray(assetClasses) && assetClasses.length > 0) {
      const valid = assetClasses
        .filter((ac) => Number(ac?.value || 0) > 0)
        .map((ac, idx) => {
          const rawKey = String(ac.key || ac.classKey || 'OTHER')
          const label = ac.name || ac.label || rawKey
          const categoryHoldings = getCategoryHoldings(rawKey, items)

          return {
            key: rawKey,
            name: label,
            fullName: label,
            value: Math.round(Number(ac.value) || 0),
            percent: Number(ac.percent) || 0,
            color:
              ac.color ||
              CLASS_COLORS[rawKey.toUpperCase()] ||
              MODERN_PALETTE[idx % MODERN_PALETTE.length],
            holdings: categoryHoldings,
          }
        })
      if (valid.length > 0) return valid
    }

    // 2. Fallback: Aggregate by Market / Asset Type directly from items
    const marketMap: Record<
      string,
      { key: string; name: string; value: number; color: string; holdings: AllocationItem[] }
    > = {
      US: { key: 'US', name: '🇺🇸 หุ้นสหรัฐฯ (US Stocks & ETFs)', value: 0, color: '#3b82f6', holdings: [] },
      TH: { key: 'TH', name: '🇹🇭 หุ้นไทย (Thai Stocks)', value: 0, color: '#10b981', holdings: [] },
      CRYPTO: { key: 'CRYPTO', name: '🪙 สินทรัพย์ดิจิทัล (Crypto)', value: 0, color: '#f59e0b', holdings: [] },
      GOLD: { key: 'GOLD', name: '🏆 ทองคำและสินค้าโภคภัณฑ์', value: 0, color: '#eab308', holdings: [] },
      CASH: { key: 'CASH', name: '💵 เงินสดสำรองสภาพคล่อง', value: 0, color: '#06b6d4', holdings: [] },
    }

    for (const it of items) {
      const isCash = it.assetType === 'CASH' || it.name.toUpperCase() === 'CASH'
      const m = isCash ? 'CASH' : (it.market || 'US').toUpperCase()

      if (marketMap[m]) {
        marketMap[m].value += it.value
        marketMap[m].holdings.push(it)
      } else {
        if (!marketMap['OTHER']) {
          marketMap['OTHER'] = {
            key: 'OTHER',
            name: '🌐 สินทรัพย์อื่น ๆ',
            value: 0,
            color: '#8b5cf6',
            holdings: [],
          }
        }
        marketMap['OTHER'].value += it.value
        marketMap['OTHER'].holdings.push(it)
      }
    }

    return Object.values(marketMap)
      .filter((v) => v.value > 0)
      .map((v) => ({
        key: v.key,
        name: v.name,
        fullName: v.name,
        value: v.value,
        percent: totalValue > 0 ? Number(((v.value / totalValue) * 100).toFixed(1)) : 0,
        color: v.color,
        holdings: v.holdings.sort((a, b) => b.value - a.value),
      }))
  }, [items, assetClasses, totalValue])

  // Enhanced Chart Data with curated radiant colors
  const chartData = useMemo(() => {
    if (viewMode === 'classes') {
      return classDataList
    }
    return items.map((it, idx) => ({
      key: it.name,
      name: it.name,
      fullName: it.fullName,
      value: it.value,
      percent: it.percent,
      color: it.color || MODERN_PALETTE[idx % MODERN_PALETTE.length],
      origStock: it,
      holdings: [it],
    }))
  }, [viewMode, items, classDataList])

  const activeItem =
    activeIndex !== null && activeIndex < chartData.length ? chartData[activeIndex] : null

  return (
    <div className="space-y-4">
      {/* Top Header Controls: Pill Mode Switcher */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-slate-400">มุมมอง:</span>
          <div className="flex bg-[#0D1017] p-1 rounded-xl border border-white/[0.08] text-xs shadow-inner">
            <button
              type="button"
              onClick={() => {
                setViewMode('assets')
                setActiveIndex(null)
              }}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                viewMode === 'assets'
                  ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              รายหุ้น ({items.length})
            </button>
            <button
              type="button"
              onClick={() => {
                setViewMode('classes')
                setActiveIndex(null)
              }}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                viewMode === 'classes'
                  ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              หมวดสินทรัพย์ ({classDataList.length})
            </button>
          </div>
        </div>

        <Link
          href="/plans"
          className="text-xs text-indigo-300 hover:text-white font-semibold flex items-center gap-1 transition-colors group"
        >
          <span>ปรับสัดส่วนเป้าหมาย</span>
          <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>

      {/* ── ULTRA-MODERN GLOWING DONUT CHART WITH GLASS CAPSULE ── */}
      <div className="relative h-48 sm:h-52 w-full flex items-center justify-center">
        {/* Soft Ambient Halo behind the donut */}
        <div
          className="absolute w-44 h-44 rounded-full blur-3xl pointer-events-none transition-all duration-500 ease-out -z-0"
          style={{
            backgroundColor: activeItem ? `${activeItem.color}35` : 'rgba(99, 102, 241, 0.18)',
          }}
        />

        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={62}
              outerRadius={88}
              paddingAngle={4}
              cornerRadius={5}
              dataKey="value"
              onMouseEnter={(_, index) => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
              onClick={(entry) => {
                if (viewMode === 'classes') {
                  const targetName = entry?.name
                  if (targetName) toggleCategory(targetName)
                } else if ((entry as any)?.origStock && onSelectStock) {
                  const s = (entry as any).origStock as AllocationItem
                  onSelectStock({
                    symbol: s.name,
                    name: s.fullName,
                    market: s.market,
                  })
                }
              }}
              cursor="pointer"
              stroke="#0D1017"
              strokeWidth={1.5}
            >
              {chartData.map((entry, index) => {
                const isHovered = activeIndex === index
                return (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color}
                    className="transition-all duration-200 outline-none"
                    style={{
                      filter: isHovered
                        ? `drop-shadow(0 0 10px ${entry.color}99) brightness(1.2)`
                        : 'none',
                      transform: isHovered ? 'scale(1.04)' : 'scale(1)',
                      transformOrigin: 'center center',
                    }}
                  />
                )
              })}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        {/* Center Frosted Glass Capsule (Interactive readout) */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[118px] h-[118px] rounded-full bg-gradient-to-b from-[#181D2A]/95 via-[#121622]/98 to-[#0C0F17] border border-white/[0.12] shadow-2xl shadow-black/90 flex flex-col items-center justify-center text-center p-2.5 backdrop-blur-xl transition-all duration-300 ring-1 ring-white/5">
            {activeItem ? (
              <div className="animate-in fade-in zoom-in-95 duration-150 flex flex-col items-center max-w-full">
                <span
                  className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border mb-0.5 truncate max-w-[95px]"
                  style={{
                    backgroundColor: `${activeItem.color}20`,
                    borderColor: `${activeItem.color}40`,
                    color: activeItem.color,
                  }}
                >
                  {activeItem.name}
                </span>
                <span className="text-2xl font-black text-white font-mono leading-none tracking-tight my-0.5">
                  {activeItem.percent}%
                </span>
                <span className="text-[10px] font-bold text-slate-300 font-mono tabular-nums">
                  ฿{activeItem.value.toLocaleString()}
                </span>
                <span className="text-[9px] text-indigo-300/80 font-sans mt-0.5">
                  {viewMode === 'classes' ? 'แตะเพื่อดูหุ้น' : 'แตะดูรายละเอียด'}
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <span className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-widest text-slate-400 bg-white/[0.04] px-2 py-0.5 rounded-full border border-white/[0.06] mb-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  พอร์ตทั้งหมด
                </span>
                <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white via-slate-100 to-slate-400 font-mono leading-none tracking-tight my-0.5">
                  100%
                </span>
                <span className="text-[10px] font-bold text-indigo-300 font-mono tabular-nums">
                  ฿{Math.round(totalValue).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── RANKED VISUAL PROPORTION PROGRESS LIST (EXPANDABLE GLASS TOKENS) ── */}
      <div className="space-y-2 max-h-80 overflow-y-auto pr-1 scrollbar-thin">
        {chartData.map((item, idx) => {
          const isHovered = activeIndex === idx
          const isExpanded = expandedCategories.has(item.name)
          const origStock = (item as any).origStock as AllocationItem | undefined
          const categoryHoldings = (item as any).holdings as AllocationItem[] | undefined
          const hasHoldings = Array.isArray(categoryHoldings) && categoryHoldings.length > 0

          return (
            <div
              key={item.name}
              onMouseEnter={() => setActiveIndex(idx)}
              onMouseLeave={() => setActiveIndex(null)}
              onClick={() => {
                if (viewMode === 'classes') {
                  toggleCategory(item.name)
                } else if (origStock && onSelectStock) {
                  onSelectStock({
                    symbol: origStock.name,
                    name: origStock.fullName,
                    market: origStock.market,
                  })
                }
              }}
              className={`p-2.5 rounded-2xl transition-all duration-200 border cursor-pointer ${
                isHovered
                  ? 'bg-white/[0.08] border-indigo-500/50 shadow-lg shadow-black/40'
                  : isExpanded
                  ? 'bg-white/[0.05] border-indigo-500/40 shadow-md'
                  : 'bg-white/[0.02] hover:bg-white/[0.05] border-white/[0.05]'
              }`}
            >
              {/* Category/Stock Top Bar */}
              <div className="flex items-center justify-between text-xs mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm transition-transform duration-200"
                    style={{
                      backgroundColor: item.color,
                      transform: isHovered || isExpanded ? 'scale(1.25)' : 'scale(1)',
                    }}
                  />
                  <span className="font-extrabold text-white truncate font-mono text-xs">
                    {item.name}
                  </span>
                  {viewMode === 'classes' && hasHoldings && (
                    <span className="text-[10px] font-semibold text-slate-400 bg-white/[0.06] px-1.5 py-0.2 rounded-full font-mono shrink-0">
                      {categoryHoldings.length} รายการ
                    </span>
                  )}
                  {viewMode === 'assets' && item.fullName && item.fullName !== item.name && (
                    <span className="text-[10px] text-slate-400 truncate hidden sm:inline max-w-[130px]">
                      {item.fullName}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0 font-mono">
                  <span className="text-slate-300 text-xs tabular-nums">
                    ฿{item.value.toLocaleString()}
                  </span>
                  <span
                    className="text-xs font-extrabold px-1.5 py-0.2 rounded-md border"
                    style={{
                      backgroundColor: `${item.color}20`,
                      borderColor: `${item.color}40`,
                      color: item.color,
                    }}
                  >
                    {item.percent}%
                  </span>

                  {viewMode === 'classes' ? (
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                        isExpanded ? 'rotate-180 text-indigo-400' : ''
                      }`}
                    />
                  ) : (
                    <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-300 transition-colors" />
                  )}
                </div>
              </div>

              {/* Glowing Visual Proportion Bar */}
              <div className="w-full h-1.5 bg-[#090C12] rounded-full overflow-hidden border border-white/[0.04]">
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out"
                  style={{
                    width: `${Math.min(100, item.percent)}%`,
                    backgroundColor: item.color,
                    boxShadow: isHovered || isExpanded ? `0 0 8px ${item.color}90` : 'none',
                  }}
                />
              </div>

              {/* ── EXPANDABLE SUB-HOLDINGS ACCORDION (FOR ASSET CLASSES) ── */}
              {viewMode === 'classes' && isExpanded && (
                <div className="mt-2.5 pt-2.5 border-t border-white/[0.08] space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 mb-1 font-sans">
                    <span className="flex items-center gap-1.5 font-medium text-slate-300">
                      <Layers className="w-3.5 h-3.5 text-indigo-400" />
                      <span>
                        หุ้นและสินทรัพย์ในหมวดนี้ ({hasHoldings ? categoryHoldings.length : 0} รายการ)
                      </span>
                    </span>
                    <span className="text-[10px] text-indigo-300 flex items-center gap-0.5">
                      <span>แตะที่หุ้นเพื่อดูชาร์ต</span>
                      <ArrowUpRight className="w-3 h-3" />
                    </span>
                  </div>

                  {/* Cash Category Dedicated Card */}
                  {item.key?.toLowerCase() === 'cash' || item.name.includes('เงินสด') ? (
                    <div
                      onClick={(e) => {
                        e.stopPropagation()
                        window.location.href = '/accounts'
                      }}
                      className="flex items-center justify-between p-2 rounded-xl bg-cyan-500/[0.07] hover:bg-cyan-500/[0.14] border border-cyan-500/25 transition-all cursor-pointer group/cash"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-300 text-xs shrink-0 font-bold">
                          <Wallet className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white group-hover/cash:text-cyan-300 transition-colors">
                            เงินสดสำรองสภาพคล่องในบัญชีทั้งหมด (Cash)
                          </p>
                          <p className="text-[10px] text-slate-400 truncate">
                            พร้อมใช้งานสำหรับการ DCA และจัดสรรเข้าพอร์ต
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0 flex items-center gap-2">
                        <div className="text-xs font-bold text-white font-mono tabular-nums">
                          ฿{item.value.toLocaleString()}
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-cyan-400 group-hover/cash:translate-x-0.5 transition-transform" />
                      </div>
                    </div>
                  ) : hasHoldings ? (
                    <div className="space-y-1 max-h-52 overflow-y-auto pr-0.5 scrollbar-thin">
                      {categoryHoldings.map((h) => {
                        const holdingPctOfCat = item.value > 0 ? (h.value / item.value) * 100 : 0

                        return (
                          <div
                            key={h.name}
                            onClick={(e) => {
                              e.stopPropagation()
                              if (h.name === 'CASH') {
                                window.location.href = '/accounts'
                              } else if (onSelectStock) {
                                onSelectStock({
                                  symbol: h.name,
                                  name: h.fullName,
                                  market: h.market,
                                })
                              }
                            }}
                            className="flex items-center justify-between p-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.04] hover:border-indigo-500/40 transition-all cursor-pointer group/stock"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <StockLogo
                                ticker={h.name}
                                size={28}
                                className="rounded-lg shadow-sm shrink-0"
                              />
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-bold text-white group-hover/stock:text-indigo-300 transition-colors font-mono">
                                    {h.name}
                                  </span>
                                  {h.market && (
                                    <span className="text-[9px] font-semibold text-slate-400 px-1 py-0.2 bg-white/[0.05] rounded border border-white/[0.05]">
                                      {h.market}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-slate-400 truncate max-w-[130px] sm:max-w-[170px]">
                                  {h.fullName || h.name}
                                </p>
                              </div>
                            </div>

                            <div className="text-right font-mono shrink-0 flex items-center gap-2">
                              <div>
                                <div className="text-xs font-bold text-white tabular-nums">
                                  ฿{h.value.toLocaleString()}
                                </div>
                                <div className="text-[10px] text-slate-400 font-sans">
                                  <span className="text-indigo-300 font-mono font-medium">
                                    {holdingPctOfCat.toFixed(1)}%
                                  </span>
                                  <span className="text-slate-500"> ของหมวด</span>
                                </div>
                              </div>
                              <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover/stock:text-indigo-300 group-hover/stock:translate-x-0.5 group-hover/stock:-translate-y-0.5 transition-all" />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-3 text-xs text-slate-400 bg-white/[0.02] rounded-xl border border-white/[0.04]">
                      ไม่มีข้อมูลหุ้นย่อยในหมวดนี้
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
