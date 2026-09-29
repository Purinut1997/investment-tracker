'use client'

import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  X,
  Minimize2,
  TrendingUp,
  TrendingDown,
  BarChart3,
  CandlestickChart as CandleIcon,
  LineChart as LineIcon,
  Compass,
  Activity,
  Layers,
  Sparkles,
} from 'lucide-react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  BarChart,
  Bar,
  ReferenceLine,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts'
import { StockLogo } from '@/components/StockLogo'
import { CandlestickChart, type TechnicalLevels, type CandlePoint } from '@/components/market-watch/CandlestickChart'
import { VolumeChartPanel } from '@/components/market-watch/VolumeChartPanel'

export type TimeRange = '1d' | '1w' | '1m' | '1y'

interface FullscreenChartModalProps {
  isOpen: boolean
  onClose: () => void
  symbol: string
  name?: string
  market?: string
  currencySymbol: string
  currentPrice: number
  range: TimeRange
  setRange: (r: TimeRange) => void
  chartType: 'area' | 'candle'
  setChartType: (t: 'area' | 'candle') => void
  showSR: boolean
  setShowSR: (show: boolean) => void
  showSMA: boolean
  setShowSMA: (show: boolean) => void
  showVolume: boolean
  setShowVolume: (show: boolean) => void
  chartPoints: CandlePoint[]
  technicalLevels?: TechnicalLevels | null
  isRangePositive: boolean
  rangeChangePercent: number
  minPrice: number
  maxPrice: number
  hasChartData: boolean
}

export function FullscreenChartModal({
  isOpen,
  onClose,
  symbol,
  name,
  market = 'US',
  currencySymbol = '$',
  currentPrice,
  range,
  setRange,
  chartType,
  setChartType,
  showSR,
  setShowSR,
  showSMA,
  setShowSMA,
  showVolume,
  setShowVolume,
  chartPoints,
  technicalLevels,
  isRangePositive,
  rangeChangePercent,
  minPrice,
  maxPrice,
  hasChartData,
}: FullscreenChartModalProps) {
  const [mounted, setMounted] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Keyboard shortcut: ESC to close fullscreen
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        e.stopImmediatePropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = originalOverflow
    }
  }, [isOpen, onClose])

  if (!isOpen || !mounted) return null

  const isUp = isRangePositive
  const highPrice = chartPoints.length > 0 ? Math.max(...chartPoints.map((p) => p.high || p.price || 0)) : currentPrice
  const lowPrice = chartPoints.length > 0 ? Math.min(...chartPoints.map((p) => p.low || p.price || Infinity)) : currentPrice

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="fullscreen-chart-title"
      className="fixed inset-0 z-[100000] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/90 backdrop-blur-2xl animate-fade-in select-none"
    >
      <div
        ref={containerRef}
        className="w-full max-w-[1720px] h-[95vh] flex flex-col rounded-3xl bg-[#0B0E17] border-2 border-white/[0.12] shadow-[0_20px_90px_rgba(0,0,0,0.9)] overflow-hidden"
      >
        {/* ── TOP CONTROL DECK / HEADER ── */}
        <div className="px-5 py-4 bg-[#101420] border-b border-white/[0.08] flex flex-col lg:flex-row lg:items-center justify-between gap-4 shrink-0">
          {/* Left: Asset Identity & Live Price */}
          <div className="flex items-center gap-3.5 flex-wrap">
            <StockLogo
              ticker={symbol}
              name={name}
              className="w-11 h-11 rounded-2xl shrink-0 shadow-md border border-white/10"
            />
            <div>
              <div className="flex items-center gap-2">
                <h2 id="fullscreen-chart-title" className="text-xl sm:text-2xl font-black text-white font-mono tracking-tight">
                  {symbol}
                </h2>
                <span className="text-xs px-2 py-0.5 rounded-md bg-white/[0.08] text-slate-300 font-bold">
                  {market === 'US' ? '🇺🇸' : market === 'TH' ? '🇹🇭' : '🪙'} {market}
                </span>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full font-extrabold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  PRO FULLSCREEN
                </span>
              </div>
              {name && (
                <span className="text-xs font-semibold text-slate-400 block truncate max-w-[280px]">
                  {name}
                </span>
              )}
            </div>

            {/* Price Pill */}
            <div className="flex items-center gap-2.5 pl-2 sm:pl-4 border-l border-white/[0.08]">
              <div className="text-2xl sm:text-3xl font-black font-mono text-white tracking-tight">
                {currencySymbol}
                {currentPrice.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
              <div
                className={`flex items-center text-xs font-mono font-black px-2.5 py-1 rounded-xl border ${
                  isUp
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                }`}
              >
                {isUp ? <TrendingUp className="w-3.5 h-3.5 mr-1" /> : <TrendingDown className="w-3.5 h-3.5 mr-1" />}
                {isUp ? '+' : ''}
                {rangeChangePercent.toFixed(2)}% ({range.toUpperCase()})
              </div>
            </div>

            {/* High/Low Stats in Header */}
            <div className="hidden xl:flex items-center gap-4 text-xs font-mono pl-4 border-l border-white/[0.08] text-slate-400">
              <div>
                <span className="text-[10px] text-slate-400 uppercase block font-bold">High ({range.toUpperCase()})</span>
                <span className="text-white font-bold">{currencySymbol}{highPrice.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase block font-bold">Low ({range.toUpperCase()})</span>
                <span className="text-white font-bold">{currencySymbol}{lowPrice.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Right Controls: Chart Type, Timeframe, Indicators, Close */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Chart Type Toggle */}
            <div className="flex items-center bg-[#07090F] p-1 rounded-2xl border border-white/[0.08]">
              <button
                type="button"
                onClick={() => setChartType('area')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  chartType === 'area'
                    ? 'bg-indigo-600 text-white shadow-md font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="สลับเป็นกราฟเส้น Area"
              >
                <LineIcon className="w-4 h-4" />
                <span>เส้น Area</span>
              </button>
              <button
                type="button"
                onClick={() => setChartType('candle')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  chartType === 'candle'
                    ? 'bg-indigo-600 text-white shadow-md font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="สลับเป็นกราฟแท่งเทียน Candlestick"
              >
                <CandleIcon className="w-4 h-4" />
                <span>แท่งเทียน</span>
              </button>
            </div>

            {/* Timeframe Chips */}
            <div className="flex items-center gap-1 bg-[#07090F] p-1 rounded-2xl border border-white/[0.08]">
              {(['1d', '1w', '1m', '1y'] as TimeRange[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setRange(t)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                    range === t
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
                  }`}
                >
                  {t.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Technical Indicator Buttons */}
            <div className="flex items-center gap-1.5">
              {/* S/R Toggle */}
              <button
                type="button"
                onClick={() => setShowSR(!showSR)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                  showSR
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-xs'
                    : 'bg-[#07090F] text-slate-500 border-white/[0.08] hover:text-slate-300'
                }`}
                title="แสดง/ซ่อน เส้นแนวรับ-แนวต้าน Pivot (S1, S2, R1, R2)"
              >
                <span className={`w-2 h-2 rounded-full ${showSR ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                <span>S/R แนวรับต้าน</span>
              </button>

              {/* SMA Toggle */}
              <button
                type="button"
                onClick={() => setShowSMA(!showSMA)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                  showSMA
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-xs'
                    : 'bg-[#07090F] text-slate-500 border-white/[0.08] hover:text-slate-300'
                }`}
                title="แสดง/ซ่อน เส้นค่าเฉลี่ย SMA 20 และ SMA 50"
              >
                <span className={`w-2 h-2 rounded-full ${showSMA ? 'bg-amber-400' : 'bg-slate-600'}`} />
                <span>SMA 20/50</span>
              </button>

              {/* Volume Toggle */}
              <button
                type="button"
                onClick={() => setShowVolume(!showVolume)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                  showVolume
                    ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-xs'
                    : 'bg-[#07090F] text-slate-500 border-white/[0.08] hover:text-slate-300'
                }`}
                title="แสดง/ซ่อน แถบปริมาณการซื้อขาย (Volume Histogram)"
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Volume</span>
              </button>
            </div>

            {/* Close / Minimize Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 sm:px-3 sm:py-2 rounded-2xl bg-white/[0.06] hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 border border-white/[0.08] hover:border-rose-500/40 transition-all flex items-center gap-1.5 font-bold text-xs cursor-pointer shadow-md"
              title="ย่อขนาดกลับสู่หน้าต่างปกติ (หรือกด ESC)"
            >
              <Minimize2 className="w-4 h-4" />
              <span className="hidden sm:inline">ย่อกลับ (ESC)</span>
            </button>
          </div>
        </div>

        {/* ── MAIN FULLSCREEN CHART VIEWPORT ── */}
        <div className="flex-1 w-full p-4 sm:p-6 bg-[#080B12] flex flex-col justify-center overflow-hidden relative">
          {!hasChartData ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-slate-400">
              <Compass className="w-12 h-12 text-slate-600 animate-spin" />
              <p className="text-sm font-semibold">ไม่มีข้อมูลราคาสำหรับช่วงเวลานี้</p>
            </div>
          ) : chartType === 'candle' ? (
            <div className="w-full h-full flex flex-col justify-between overflow-hidden">
              <div className="w-full flex-1 min-h-[360px] flex flex-col justify-center">
                <CandlestickChart
                  data={chartPoints}
                  currencySymbol={currencySymbol}
                  showSR={showSR}
                  showSMA={showSMA}
                  showVolume={showVolume}
                  technicalLevels={technicalLevels}
                  height={showVolume ? 420 : 540}
                />
              </div>
              {showVolume && (
                <div className="w-full pt-3 shrink-0">
                  <VolumeChartPanel data={chartPoints} height={115} showSummaryBar={true} />
                </div>
              )}
            </div>
          ) : (
            <div className="w-full h-full flex flex-col">
              {/* Area Chart with High Definition Canvas */}
              <div className="w-full flex-1 min-h-[460px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartPoints} margin={{ top: 15, right: 35, left: 10, bottom: 5 }}>
                    <defs>
                      <linearGradient id="fullscreenChartGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={isUp ? '#10B981' : '#F43F5E'} stopOpacity={0.4} />
                        <stop offset="95%" stopColor={isUp ? '#10B981' : '#F43F5E'} stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="time"
                      stroke="#64748B"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      minTickGap={35}
                    />
                    <YAxis
                      domain={[minPrice, maxPrice]}
                      stroke="#64748B"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      orientation="right"
                      tickFormatter={(val) => `${currencySymbol}${val}`}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const p = payload[0].payload
                          return (
                            <div className="p-4 rounded-2xl bg-[#0D111A]/95 border border-white/[0.15] shadow-2xl text-xs font-mono space-y-1.5 backdrop-blur-xl">
                              <span className="text-slate-400 block text-[11px] font-bold border-b border-white/[0.08] pb-1">
                                {p.time}
                              </span>
                              <div className="flex items-center justify-between gap-6">
                                <span className="text-slate-300">ราคาปิด:</span>
                                <span className="font-bold text-white text-sm">{currencySymbol}{Number(p.price).toFixed(2)}</span>
                              </div>
                              {p.sma20 && (
                                <div className="flex items-center justify-between gap-6 text-amber-400">
                                  <span>SMA 20:</span>
                                  <span className="font-bold">{currencySymbol}{Number(p.sma20).toFixed(2)}</span>
                                </div>
                              )}
                              {p.sma50 && (
                                <div className="flex items-center justify-between gap-6 text-cyan-400">
                                  <span>SMA 50:</span>
                                  <span className="font-bold">{currencySymbol}{Number(p.sma50).toFixed(2)}</span>
                                </div>
                              )}
                              {p.volume > 0 && (
                                <div className="flex items-center justify-between gap-6 text-purple-400 pt-0.5 border-t border-white/[0.06]">
                                  <span>Volume:</span>
                                  <span className="font-bold">{Number(p.volume).toLocaleString()}</span>
                                </div>
                              )}
                            </div>
                          )
                        }
                        return null
                      }}
                    />

                    {/* Support and Resistance Reference Lines */}
                    {showSR && technicalLevels && (
                      <>
                        <ReferenceLine
                          y={technicalLevels.r2}
                          stroke="#F43F5E"
                          strokeDasharray="4 4"
                          label={{ value: `R2: ${currencySymbol}${technicalLevels.r2}`, fill: '#F43F5E', fontSize: 10, position: 'insideTopRight' }}
                        />
                        <ReferenceLine
                          y={technicalLevels.r1}
                          stroke="#FB7185"
                          strokeDasharray="3 3"
                          label={{ value: `R1: ${currencySymbol}${technicalLevels.r1}`, fill: '#FB7185', fontSize: 10, position: 'insideTopRight' }}
                        />
                        <ReferenceLine
                          y={technicalLevels.pivot}
                          stroke="#94A3B8"
                          strokeDasharray="2 2"
                          label={{ value: `P: ${currencySymbol}${technicalLevels.pivot}`, fill: '#94A3B8', fontSize: 9.5, position: 'insideTopRight' }}
                        />
                        <ReferenceLine
                          y={technicalLevels.s1}
                          stroke="#34D399"
                          strokeDasharray="3 3"
                          label={{ value: `S1: ${currencySymbol}${technicalLevels.s1}`, fill: '#34D399', fontSize: 10, position: 'insideBottomRight' }}
                        />
                        <ReferenceLine
                          y={technicalLevels.s2}
                          stroke="#10B981"
                          strokeDasharray="4 4"
                          label={{ value: `S2: ${currencySymbol}${technicalLevels.s2}`, fill: '#10B981', fontSize: 10, position: 'insideBottomRight' }}
                        />
                      </>
                    )}

                    {/* Moving Average SMA Lines */}
                    {showSMA && (
                      <>
                        <Line
                          type="monotone"
                          dataKey="sma20"
                          name="SMA 20"
                          stroke="#F59E0B"
                          strokeWidth={2}
                          dot={false}
                          connectNulls={true}
                          isAnimationActive={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="sma50"
                          name="SMA 50"
                          stroke="#06B6D4"
                          strokeWidth={2}
                          dot={false}
                          connectNulls={true}
                          isAnimationActive={false}
                        />
                      </>
                    )}

                    {/* Area Curve */}
                    <Area
                      type="monotone"
                      dataKey="price"
                      stroke={isUp ? '#10B981' : '#F43F5E'}
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#fullscreenChartGradient)"
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Volume Intelligence Panel */}
              {showVolume && (
                <div className="w-full pt-3 shrink-0">
                  <VolumeChartPanel data={chartPoints} height={125} showSummaryBar={true} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── FOOTER REFERENCE STATS BAR ── */}
        <div className="px-5 py-3 bg-[#0F131F] border-t border-white/[0.08] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs shrink-0">
          {technicalLevels ? (
            <div className="flex items-center gap-3 sm:gap-6 font-mono text-slate-300 flex-wrap">
              <span className="text-slate-400 font-bold uppercase tracking-wider text-[11px]">จุดอ้างอิงเทคนิค:</span>
              <span className="text-rose-400 font-bold">R2: {currencySymbol}{technicalLevels.r2}</span>
              <span className="text-rose-300">R1: {currencySymbol}{technicalLevels.r1}</span>
              <span className="text-slate-400">Pivot: {currencySymbol}{technicalLevels.pivot}</span>
              <span className="text-emerald-300">S1: {currencySymbol}{technicalLevels.s1}</span>
              <span className="text-emerald-400 font-bold">S2: {currencySymbol}{technicalLevels.s2}</span>
            </div>
          ) : (
            <div className="text-slate-400 text-xs">กำลังคำนวณจุดแนวรับ-แนวต้านอัตโนมัติ</div>
          )}

          <div className="text-slate-400 text-[11px] flex items-center gap-2">
            <span>💡 หมุนล้อเมาส์เพื่อซูม • ลากเพื่อเลื่อนแกนเวลา • กด ESC เพื่อย่อกลับ</span>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
