'use client'

import React from 'react'

export interface HoldingSummaryItem {
  symbol: string
  assetName: string
  allocationPercent: number
  positiveCount: number
  negativeCount: number
  neutralCount: number
  totalNewsCount: number
}

interface HoldingsSentimentBarProps {
  holdings: HoldingSummaryItem[]
  selectedTicker: string
  onSelectTicker: (ticker: string) => void
}

export function HoldingsSentimentBar({
  holdings,
  selectedTicker,
  onSelectTicker,
}: HoldingsSentimentBarProps) {
  if (!holdings || holdings.length === 0) return null

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between text-xs sm:text-sm text-slate-300">
        <span className="font-semibold">สินทรัพย์ในพอร์ตของคุณ (คลิกเพื่อกรองข่าวเฉพาะตัว):</span>
        <span className="text-xs font-mono text-slate-400">{holdings.length} รายการ</span>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-thin">
        {/* All button */}
        <button
          onClick={() => onSelectTicker('')}
          className={`shrink-0 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold font-mono transition-all cursor-pointer border ${
            selectedTicker === ''
              ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
              : 'bg-[#181C25] text-slate-300 border-white/[0.08] hover:text-white hover:border-white/[0.16]'
          }`}
        >
          ทั้งหมด
        </button>

        {/* Ticker pills */}
        {holdings.map((h) => {
          const isSelected = selectedTicker === h.symbol
          const hasPositive = h.positiveCount > 0
          const hasNegative = h.negativeCount > 0

          let sentimentColor = 'bg-slate-800 text-slate-300 border-slate-700'
          if (hasNegative && !hasPositive) {
            sentimentColor = 'bg-rose-500/15 text-rose-300 border-rose-500/30'
          } else if (hasPositive) {
            sentimentColor = 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
          }

          return (
            <button
              key={h.symbol}
              onClick={() => onSelectTicker(isSelected ? '' : h.symbol)}
              className={`shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer border ${
                isSelected
                  ? 'bg-indigo-600/30 text-white border-indigo-500 shadow-sm'
                  : 'bg-[#181C25] text-slate-200 border-white/[0.08] hover:border-white/[0.16] hover:bg-[#1e2330]'
              }`}
            >
              <span className="font-mono font-bold text-xs sm:text-sm">{h.symbol}</span>

              {h.allocationPercent > 0 && (
                <span className="text-xs text-slate-400 font-mono">
                  {h.allocationPercent}%
                </span>
              )}

              {h.totalNewsCount > 0 ? (
                <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${sentimentColor}`}>
                  {h.positiveCount > 0 ? `+${h.positiveCount}` : h.totalNewsCount}
                </span>
              ) : (
                <span className="text-xs font-mono text-slate-500">0</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
