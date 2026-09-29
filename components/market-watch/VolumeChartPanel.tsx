'use client'

import React, { useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts'
import { BarChart3, TrendingUp, TrendingDown, Flame, Zap, Moon } from 'lucide-react'
import type { CandlePoint } from '@/components/market-watch/CandlestickChart'

interface VolumeChartPanelProps {
  data: CandlePoint[]
  height?: number
  showSummaryBar?: boolean
  className?: string
  isCompact?: boolean
}

export interface VolumeEnrichedPoint {
  time: string
  timestamp: number
  volume: number
  volumeMA: number
  price: number
  isUp: boolean
  ratioVsMA: number
  open?: number
  close?: number
  high?: number
  low?: number
}

// Format large numbers cleanly: 1,234,567 -> 1.23M, 45,678 -> 45.7K
export function formatVolumeNumber(num: number): string {
  if (!num || isNaN(num)) return '0'
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)}B`
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`
  return num.toLocaleString()
}

export function VolumeChartPanel({
  data,
  height = 135,
  showSummaryBar = true,
  className = '',
  isCompact = false,
}: VolumeChartPanelProps) {
  const [hoveredPoint, setHoveredPoint] = useState<VolumeEnrichedPoint | null>(null)

  // Enrich data with 20-period Volume MA, Buy/Sell determination, and Spike ratio
  const { enrichedPoints, totalBuyVolume, totalSellVolume, buyPct, sellPct, avgVolume } =
    useMemo(() => {
      if (!data || data.length === 0) {
        return {
          enrichedPoints: [] as VolumeEnrichedPoint[],
          totalBuyVolume: 0,
          totalSellVolume: 0,
          buyPct: 50,
          sellPct: 50,
          avgVolume: 0,
        }
      }

      const points: VolumeEnrichedPoint[] = []
      let buyVolSum = 0
      let sellVolSum = 0
      let totalVol = 0

      const MA_PERIOD = Math.min(20, Math.max(3, Math.floor(data.length / 2)))

      for (let i = 0; i < data.length; i++) {
        const p = data[i]
        const vol = Math.max(0, p.volume || 0)
        totalVol += vol

        // Determine Buy (Green) vs Sell (Red)
        // If OHLC available: close >= open
        // Else: compare price against previous point
        let isUp = true
        if (p.open !== undefined && p.close !== undefined && p.open > 0) {
          isUp = p.close >= p.open
        } else if (i > 0) {
          const prevPrice = data[i - 1].price ?? data[i - 1].close ?? 0
          const currPrice = p.price ?? p.close ?? 0
          isUp = currPrice >= prevPrice
        }

        if (isUp) {
          buyVolSum += vol
        } else {
          sellVolSum += vol
        }

        // Calculate rolling 20-period Moving Average of Volume
        const startIdx = Math.max(0, i - MA_PERIOD + 1)
        let sumWindow = 0
        const countWindow = i - startIdx + 1
        for (let j = startIdx; j <= i; j++) {
          sumWindow += Math.max(0, data[j].volume || 0)
        }
        const volumeMA = Math.round(sumWindow / countWindow)

        const ratioVsMA = volumeMA > 0 ? (vol - volumeMA) / volumeMA : 0

        points.push({
          time: p.time,
          timestamp: p.timestamp,
          volume: vol,
          volumeMA,
          price: p.price ?? p.close ?? 0,
          isUp,
          ratioVsMA,
          open: p.open,
          close: p.close,
          high: p.high,
          low: p.low,
        })
      }

      const allVol = buyVolSum + sellVolSum
      const bPct = allVol > 0 ? Math.round((buyVolSum / allVol) * 100) : 50
      const sPct = 100 - bPct
      const overallAvg = data.length > 0 ? Math.round(totalVol / data.length) : 0

      return {
        enrichedPoints: points,
        totalBuyVolume: buyVolSum,
        totalSellVolume: sellVolSum,
        buyPct: bPct,
        sellPct: sPct,
        avgVolume: overallAvg,
      }
    }, [data])

  // Displayed point: hovered candle or latest candle
  const activePoint = hoveredPoint || enrichedPoints[enrichedPoints.length - 1]

  const activeVol = activePoint?.volume ?? 0
  const activeMA = activePoint?.volumeMA ?? 0
  const activeRatio = activeMA > 0 ? activeVol / activeMA : 1
  const activeDiffPct = activeMA > 0 ? ((activeVol - activeMA) / activeMA) * 100 : 0
  const isSpike = activeRatio >= 1.5
  const isLow = activeRatio < 0.75

  if (!data || data.length === 0) {
    return null
  }

  return (
    <div
      className={`w-full flex flex-col rounded-2xl bg-[#090C14] border border-white/[0.08] shadow-inner overflow-hidden ${className}`}
    >
      {/* ── HEADER HUD: REAL-TIME VOLUME READING & BUY/SELL RATIO ── */}
      {showSummaryBar && (
        <div className="px-3.5 py-2.5 bg-[#0D111A] border-b border-white/[0.06] flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Left: Volume Values & Live Stats */}
          <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
            <div className="flex items-center gap-1.5 font-bold text-white">
              <BarChart3 className="w-4 h-4 text-indigo-400" />
              <span>Volume</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.06] text-slate-400 font-normal">
                MA 20
              </span>
            </div>

            {activePoint && (
              <div className="flex items-center gap-2 sm:gap-3 font-mono text-[11px]">
                {/* Active Time Tag */}
                <span className="text-slate-400 font-semibold px-2 py-0.5 rounded bg-white/[0.04]">
                  {activePoint.time}
                </span>

                {/* Volume Value with Color */}
                <div className="flex items-center gap-1">
                  <span className="text-slate-400 text-[10px]">Vol:</span>
                  <span
                    className={`font-bold ${
                      activePoint.isUp ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {formatVolumeNumber(activeVol)}
                  </span>
                  <span className="text-slate-500 text-[10px] hidden md:inline">
                    ({activeVol.toLocaleString()})
                  </span>
                </div>

                {/* Volume MA Value */}
                <div className="flex items-center gap-1 hidden sm:flex">
                  <span className="text-slate-400 text-[10px]">MA:</span>
                  <span className="font-bold text-amber-400">
                    {formatVolumeNumber(activeMA)}
                  </span>
                </div>

                {/* Volume Intensity / Spike Badge */}
                <div className="flex items-center">
                  {isSpike ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/35 animate-pulse">
                      <Flame className="w-3 h-3 text-amber-400" />
                      <span>Spike +{Math.round(activeDiffPct)}% (มีนัยสำคัญ)</span>
                    </span>
                  ) : isLow ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-400 border border-white/[0.06]">
                      <Moon className="w-3 h-3 text-slate-400" />
                      <span>เบาบาง ({Math.round(activeDiffPct)}%)</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/25">
                      <Zap className="w-3 h-3 text-indigo-400" />
                      <span>ปกติ (x{activeRatio.toFixed(1)})</span>
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right: Buy vs Sell Volume Dominance Bar */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-[11px] font-mono">
              <span className="text-emerald-400 font-bold flex items-center gap-0.5">
                <TrendingUp className="w-3 h-3" />
                ซื้อ {buyPct}%
              </span>

              {/* Two-tone Progress Bar */}
              <div className="w-20 sm:w-28 h-2 rounded-full bg-slate-800 overflow-hidden flex shadow-inner">
                <div
                  className="bg-emerald-500 h-full transition-all duration-300"
                  style={{ width: `${buyPct}%` }}
                  title={`แรงซื้อรวม: ${formatVolumeNumber(totalBuyVolume)} (${buyPct}%)`}
                />
                <div
                  className="bg-rose-500 h-full transition-all duration-300"
                  style={{ width: `${sellPct}%` }}
                  title={`แรงขายรวม: ${formatVolumeNumber(totalSellVolume)} (${sellPct}%)`}
                />
              </div>

              <span className="text-rose-400 font-bold flex items-center gap-0.5">
                ขาย {sellPct}%
                <TrendingDown className="w-3 h-3" />
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── CHART VIEWPORT: COLOR BARS + VOLUME MA 20 LINE ── */}
      <div className="w-full relative px-1 pt-1" style={{ height: `${height}px` }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={enrichedPoints}
            margin={{ top: 8, right: 35, left: 5, bottom: 2 }}
            onMouseMove={(state: any) => {
              if (state && state.activePayload && state.activePayload.length > 0) {
                setHoveredPoint(state.activePayload[0].payload as VolumeEnrichedPoint)
              }
            }}
            onMouseLeave={() => setHoveredPoint(null)}
          >
            <XAxis dataKey="time" hide />
            <YAxis
              stroke="#64748B"
              fontSize={9}
              tickLine={false}
              axisLine={false}
              orientation="right"
              tickFormatter={(v) => formatVolumeNumber(v)}
            />

            {/* Custom Tooltip */}
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length > 0) {
                  const p = payload[0].payload as VolumeEnrichedPoint
                  const isUp = p.isUp
                  const vol = p.volume
                  const ma = p.volumeMA
                  const diffPct = ma > 0 ? ((vol - ma) / ma) * 100 : 0
                  const isHigh = vol >= ma * 1.4

                  return (
                    <div className="p-3 rounded-xl bg-[#0D111A]/95 border border-white/[0.15] shadow-2xl text-xs font-mono space-y-1.5 backdrop-blur-xl pointer-events-none">
                      <div className="flex items-center justify-between gap-4 border-b border-white/[0.08] pb-1">
                        <span className="font-bold text-slate-300">{p.time}</span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            isUp
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          }`}
                        >
                          {isUp ? '🟢 ปิดบวก (แรงซื้อ)' : '🔴 ปิดลบ (แรงขาย)'}
                        </span>
                      </div>

                      <div className="space-y-1 pt-0.5 text-[11px]">
                        <div className="flex items-center justify-between gap-6">
                          <span className="text-slate-400">Volume:</span>
                          <span
                            className={`font-bold ${
                              isUp ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {vol.toLocaleString()} หุ้น
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-6">
                          <span className="text-slate-400">Vol MA (20):</span>
                          <span className="font-bold text-amber-400">
                            {ma.toLocaleString()} หุ้น
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-6 pt-1 border-t border-white/[0.06]">
                          <span className="text-slate-400">เทียบค่าเฉลี่ย:</span>
                          <span
                            className={`font-bold ${
                              diffPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {diffPct >= 0 ? `+${diffPct.toFixed(1)}%` : `${diffPct.toFixed(1)}%`}{' '}
                            {isHigh ? '🔥 Spike' : ''}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                }
                return null
              }}
            />

            {/* Colored Volume Bars */}
            <Bar
              dataKey="volume"
              radius={[2, 2, 0, 0]}
              isAnimationActive={false}
            >
              {enrichedPoints.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.isUp ? '#10B981' : '#F43F5E'}
                  fillOpacity={entry.volume >= entry.volumeMA * 1.5 ? 0.95 : 0.65}
                />
              ))}
            </Bar>

            {/* Volume Moving Average (MA 20) Line */}
            <Line
              type="monotone"
              dataKey="volumeMA"
              name="Vol MA(20)"
              stroke="#F59E0B"
              strokeWidth={1.8}
              dot={false}
              connectNulls={true}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* ── FOOTER HINT / LEGEND BAR ── */}
      {!isCompact && (
        <div className="px-3 py-1.5 bg-[#0A0D15] border-t border-white/[0.04] flex items-center justify-between text-[10px] text-slate-400 font-mono">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm bg-emerald-500" />
              <span>แท่งซื้อ (ราคาปิดบวก)</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm bg-rose-500" />
              <span>แท่งขาย (ราคาปิดลบ)</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-0.5 bg-amber-400 rounded-full" />
              <span>เส้นค่าเฉลี่ย 20 แท่ง (Vol MA 20)</span>
            </span>
          </div>

          <div className="hidden sm:block text-slate-400">
            💡 แท่งที่สูงทะลุเส้นสีส้ม = มีการซื้อขายหนาแน่นผิดปกติ (Spike)
          </div>
        </div>
      )}
    </div>
  )
}
