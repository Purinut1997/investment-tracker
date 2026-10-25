'use client'

import React, { useState } from 'react'
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from 'recharts'
import { StockLogo } from '@/components/StockLogo'
import { ArrowRight, Layers, PieChart as PieIcon } from 'lucide-react'
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
  assetClasses?: Array<{ classKey: string; label: string; percent: number; value: number; color?: string }>
  totalValue: number
  onSelectStock?: (stock: { symbol: string; name?: string; market?: string }) => void
}

const CLASS_COLORS: Record<string, string> = {
  US: '#3b82f6',     // Blue
  TH: '#10b981',     // Emerald
  CRYPTO: '#f59e0b', // Amber
  GOLD: '#eab308',   // Yellow
  CASH: '#06b6d4',   // Cyan
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

  const activeItem = activeIndex !== null ? items[activeIndex] : null

  // Prepare chart data based on active view mode
  const chartData = viewMode === 'assets'
    ? items.map((it) => ({
        name: it.name,
        fullName: it.fullName,
        value: it.value,
        percent: it.percent,
        color: it.color,
      }))
    : assetClasses.map((ac) => ({
        name: ac.label || ac.classKey,
        fullName: ac.label || ac.classKey,
        value: ac.value,
        percent: ac.percent,
        color: CLASS_COLORS[ac.classKey.toUpperCase()] || '#6366f1',
      }))

  return (
    <div className="space-y-4">
      {/* Top Controls: View Toggle */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-slate-300">มุมมอง:</span>
          <div className="flex bg-[#161B28] p-0.5 rounded-xl border border-white/[0.08] text-xs">
            <button
              type="button"
              onClick={() => {
                setViewMode('assets')
                setActiveIndex(null)
              }}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                viewMode === 'assets'
                  ? 'bg-indigo-600 text-white shadow-sm'
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
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                viewMode === 'classes'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              หมวดสินทรัพย์
            </button>
          </div>
        </div>

        <Link
          href="/plans"
          className="text-xs text-indigo-300 hover:text-white font-semibold flex items-center gap-1 transition-colors"
        >
          <span>ปรับสัดส่วนเป้าหมาย</span>
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {/* Donut Chart with Interactive Center Hole */}
      <div className="relative h-44 w-full flex items-center justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={52}
              outerRadius={76}
              paddingAngle={2}
              dataKey="value"
              onMouseEnter={(_, index) => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
              cursor="pointer"
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.color}
                  stroke={activeIndex === index ? '#ffffff' : 'transparent'}
                  strokeWidth={activeIndex === index ? 2 : 0}
                  className="transition-all duration-200 outline-none"
                  style={{
                    filter: activeIndex === index ? 'brightness(1.2)' : 'none',
                    transform: activeIndex === index ? 'scale(1.04)' : 'scale(1)',
                    transformOrigin: 'center center',
                  }}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        {/* Center Hole Readout */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-2">
          {activeItem ? (
            <div className="animate-in fade-in duration-150">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                {activeItem.name}
              </span>
              <span className="text-xl font-black text-white font-mono leading-none block my-0.5">
                {activeItem.percent}%
              </span>
              <span className="text-[10px] text-slate-400 font-mono block">
                ฿{activeItem.value.toLocaleString()}
              </span>
            </div>
          ) : (
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                พอร์ตทั้งหมด
              </span>
              <span className="text-xl font-black text-white font-mono leading-none block my-0.5">
                100%
              </span>
              <span className="text-[10px] text-indigo-300 font-mono block">
                ฿{Math.round(totalValue).toLocaleString()}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Ranked Visual Proportion Progress List */}
      <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1 scrollbar-thin">
        {chartData.map((item, idx) => {
          const isHovered = activeIndex === idx
          const origStock = viewMode === 'assets' ? items[idx] : null

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
              className={`p-2 rounded-xl transition-all border ${
                origStock ? 'cursor-pointer' : ''
              } ${
                isHovered
                  ? 'bg-white/[0.08] border-indigo-500/50 shadow-md scale-[1.01]'
                  : 'bg-white/[0.02] hover:bg-white/[0.05] border-white/[0.04]'
              }`}
            >
              <div className="flex items-center justify-between text-xs mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="font-extrabold text-white truncate font-mono text-xs">
                    {item.name}
                  </span>
                  {item.fullName && item.fullName !== item.name && (
                    <span className="text-[10px] text-slate-400 truncate hidden sm:inline max-w-[120px]">
                      {item.fullName}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0 font-mono">
                  <span className="text-slate-300 text-xs">
                    ฿{item.value.toLocaleString()}
                  </span>
                  <span
                    className="text-xs font-extrabold px-1.5 py-0.2 rounded"
                    style={{
                      backgroundColor: `${item.color}25`,
                      color: item.color,
                    }}
                  >
                    {item.percent}%
                  </span>
                </div>
              </div>

              {/* Visual Proportion Bar */}
              <div className="w-full h-1.5 bg-[#090C12] rounded-full overflow-hidden border border-white/[0.04]">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(100, item.percent)}%`,
                    backgroundColor: item.color,
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
