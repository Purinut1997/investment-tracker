'use client'

import React, { useState, useMemo } from 'react'
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { StockLogo } from '@/components/StockLogo'
import { ArrowRight, Layers, Sparkles, PieChart as PieIcon } from 'lucide-react'
import Link from 'next/link'

interface AllocationItem {
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

export function AssetAllocationVisualizer({
  items,
  assetClasses = [],
  totalValue,
  onSelectStock,
}: AssetAllocationVisualizerProps) {
  const [viewMode, setViewMode] = useState<'assets' | 'classes'>('assets')
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  // Robust computation of Asset Classes
  const classDataList = useMemo(() => {
    // 1. If backend summary provided valid asset classes with positive values
    if (Array.isArray(assetClasses) && assetClasses.length > 0) {
      const valid = assetClasses
        .filter((ac) => Number(ac?.value || 0) > 0)
        .map((ac, idx) => {
          const rawKey = String(ac.key || ac.classKey || 'OTHER').toUpperCase()
          const label = ac.name || ac.label || rawKey
          return {
            name: label,
            fullName: label,
            value: Math.round(Number(ac.value) || 0),
            percent: Number(ac.percent) || 0,
            color: ac.color || CLASS_COLORS[rawKey] || MODERN_PALETTE[idx % MODERN_PALETTE.length],
          }
        })
      if (valid.length > 0) return valid
    }

    // 2. Fallback: Aggregate by Market / Asset Type directly from items
    const marketMap: Record<string, { name: string; value: number; color: string }> = {
      US: { name: '🇺🇸 หุ้นสหรัฐฯ (US Stocks & ETFs)', value: 0, color: '#3b82f6' },
      TH: { name: '🇹🇭 หุ้นไทย (Thai Stocks)', value: 0, color: '#10b981' },
      CRYPTO: { name: '🪙 สินทรัพย์ดิจิทัล (Crypto)', value: 0, color: '#f59e0b' },
      GOLD: { name: '🏆 ทองคำและสินค้าโภคภัณฑ์', value: 0, color: '#eab308' },
      CASH: { name: '💵 เงินสดสำรองสภาพคล่อง', value: 0, color: '#06b6d4' },
    }

    for (const it of items) {
      const isCash = it.assetType === 'CASH' || it.name.toUpperCase() === 'CASH'
      const m = isCash ? 'CASH' : (it.market || 'US').toUpperCase()

      if (marketMap[m]) {
        marketMap[m].value += it.value
      } else {
        if (!marketMap['OTHER']) {
          marketMap['OTHER'] = { name: '🌐 สินทรัพย์อื่น ๆ', value: 0, color: '#8b5cf6' }
        }
        marketMap['OTHER'].value += it.value
      }
    }

    return Object.entries(marketMap)
      .filter(([_, v]) => v.value > 0)
      .map(([_, v]) => ({
        name: v.name,
        fullName: v.name,
        value: v.value,
        percent: totalValue > 0 ? Number(((v.value / totalValue) * 100).toFixed(1)) : 0,
        color: v.color,
      }))
  }, [items, assetClasses, totalValue])

  // Enhanced Chart Data with curated radiant colors
  const chartData = useMemo(() => {
    if (viewMode === 'classes') {
      return classDataList
    }
    return items.map((it, idx) => ({
      name: it.name,
      fullName: it.fullName,
      value: it.value,
      percent: it.percent,
      color: it.color || MODERN_PALETTE[idx % MODERN_PALETTE.length],
      origStock: it,
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
          <div className="w-[114px] h-[114px] rounded-full bg-gradient-to-b from-[#181D2A]/95 via-[#121622]/98 to-[#0C0F17] border border-white/[0.12] shadow-2xl shadow-black/90 flex flex-col items-center justify-center text-center p-2.5 backdrop-blur-xl transition-all duration-300 ring-1 ring-white/5">
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

      {/* ── RANKED VISUAL PROPORTION PROGRESS LIST (SLEEK GLASS TOKENS) ── */}
      <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1 scrollbar-thin">
        {chartData.map((item, idx) => {
          const isHovered = activeIndex === idx
          const origStock = (item as any).origStock as AllocationItem | undefined

          return (
            <div
              key={item.name}
              onMouseEnter={() => setActiveIndex(idx)}
              onMouseLeave={() => setActiveIndex(null)}
              onClick={() => {
                if (origStock && onSelectStock) {
                  onSelectStock({
                    symbol: origStock.name,
                    name: origStock.fullName,
                    market: origStock.market,
                  })
                }
              }}
              className={`p-2.5 rounded-2xl transition-all duration-200 border ${
                origStock ? 'cursor-pointer' : ''
              } ${
                isHovered
                  ? 'bg-white/[0.08] border-indigo-500/50 shadow-lg shadow-black/40 translate-x-1'
                  : 'bg-white/[0.02] hover:bg-white/[0.05] border-white/[0.05]'
              }`}
            >
              <div className="flex items-center justify-between text-xs mb-1.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm transition-transform duration-200"
                    style={{
                      backgroundColor: item.color,
                      transform: isHovered ? 'scale(1.25)' : 'scale(1)',
                    }}
                  />
                  <span className="font-extrabold text-white truncate font-mono text-xs">
                    {item.name}
                  </span>
                  {item.fullName && item.fullName !== item.name && (
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
                </div>
              </div>

              {/* Glowing Visual Proportion Bar */}
              <div className="w-full h-1.5 bg-[#090C12] rounded-full overflow-hidden border border-white/[0.04]">
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out"
                  style={{
                    width: `${Math.min(100, item.percent)}%`,
                    backgroundColor: item.color,
                    boxShadow: isHovered ? `0 0 8px ${item.color}90` : 'none',
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
