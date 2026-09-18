'use client'

import React, { useState, useEffect, useMemo } from 'react'
import useSWR from 'swr'
import {
  X,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Loader2,
  DollarSign,
  Activity,
  Award,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
  Briefcase,
  Layers,
  BarChart3,
  Percent,
} from 'lucide-react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts'

interface StockDetailModalProps {
  isOpen: boolean
  onClose: () => void
  symbol: string | null
  initialName?: string
  market?: string
}

type TimeRange = '1d' | '1w' | '1m' | '1y'

export function StockDetailModal({
  isOpen,
  onClose,
  symbol,
  initialName,
  market = 'US',
}: StockDetailModalProps) {
  const [range, setRange] = useState<TimeRange>('1m')
  const [isAiLoading, setIsAiLoading] = useState(false)
  const [aiInsight, setAiInsight] = useState<string | null>(null)
  const [aiModelUsed, setAiModelUsed] = useState<string | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)

  // Reset state when modal opens or symbol changes
  useEffect(() => {
    if (isOpen) {
      setRange('1m')
      setAiInsight(null)
      setAiModelUsed(null)
      setAiError(null)
      setIsAiLoading(false)
    }
  }, [isOpen, symbol])

  // ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Fetch Stock Detail Data with SWR
  const { data, isLoading, error } = useSWR(
    isOpen && symbol
      ? `/api/market-watch/stock-detail?symbol=${encodeURIComponent(
          symbol
        )}&market=${encodeURIComponent(market)}&range=${range}`
      : null,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
    }
  )

  // Price points for Recharts
  const chartPoints = data?.chartPoints ?? []
  const hasChartData = chartPoints.length > 1

  // Determine trend of selected range (first point vs last point)
  const isRangePositive = useMemo(() => {
    if (chartPoints.length < 2) return (data?.changePercent ?? 0) >= 0
    const first = chartPoints[0].price
    const last = chartPoints[chartPoints.length - 1].price
    return last >= first
  }, [chartPoints, data?.changePercent])

  // Calculate range % change
  const rangeChangePercent = useMemo(() => {
    if (chartPoints.length < 2) return data?.changePercent ?? 0
    const first = chartPoints[0].price
    const last = chartPoints[chartPoints.length - 1].price
    return first > 0 ? ((last - first) / first) * 100 : 0
  }, [chartPoints, data?.changePercent])

  // Min and Max prices for chart domain
  const { minPrice, maxPrice } = useMemo(() => {
    if (chartPoints.length === 0) return { minPrice: 0, maxPrice: 100 }
    let min = chartPoints[0].price
    let max = chartPoints[0].price
    for (const p of chartPoints) {
      if (p.price < min) min = p.price
      if (p.price > max) max = p.price
    }
    const padding = (max - min) * 0.08 || min * 0.02
    return {
      minPrice: Math.max(0, Number((min - padding).toFixed(2))),
      maxPrice: Number((max + padding).toFixed(2)),
    }
  }, [chartPoints])

  // 52-Week Range Percentage calculation
  const fiftyTwoWeekPct = useMemo(() => {
    const cur = data?.currentPrice
    const low = data?.fiftyTwoWeekLow
    const high = data?.fiftyTwoWeekHigh
    if (!cur || !low || !high || high <= low) return null
    const pct = ((cur - low) / (high - low)) * 100
    return Math.min(100, Math.max(0, pct))
  }, [data])

  // Handle Gemini AI Analysis
  const handleGenerateAiInsight = async () => {
    if (!data) return
    setIsAiLoading(true)
    setAiError(null)

    try {
      const res = await fetch('/api/market-watch/ai-insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: data.symbol,
          name: data.name || initialName,
          currentPrice: data.currentPrice,
          currency: data.currency,
          changePercent: data.changePercent,
          pe: data.pe,
          dividendYield: data.dividendYield,
          fiftyTwoWeekHigh: data.fiftyTwoWeekHigh,
          fiftyTwoWeekLow: data.fiftyTwoWeekLow,
          analystTarget: data.analystTarget,
        }),
      })

      const resData = await res.json()
      if (!res.ok) {
        throw new Error(resData.error || 'ไม่สามารถวิเคราะห์ด้วย AI ได้')
      }

      setAiInsight(resData.insight)
      setAiModelUsed(resData.modelUsed)
    } catch (err: any) {
      setAiError(err?.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ AI')
    } finally {
      setIsAiLoading(false)
    }
  }

  if (!isOpen || !symbol) return null

  const currencySymbol = data?.currency === 'THB' ? '฿' : '$'
  const isPositive = (data?.changePercent ?? 0) >= 0

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 animate-fade-in">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog (Slide-up on mobile, center card on desktop) */}
      <div className="relative w-full max-w-2xl bg-[#0F1218] border border-white/[0.12] rounded-t-3xl sm:rounded-3xl shadow-2xl shadow-black/90 z-10 flex flex-col max-h-[92vh] sm:max-h-[88vh] overflow-hidden">
        {/* Glow Accent */}
        <div
          className={`absolute top-0 right-1/4 -translate-y-1/2 w-80 h-36 rounded-full blur-3xl pointer-events-none ${
            isRangePositive ? 'bg-emerald-500/10' : 'bg-rose-500/10'
          }`}
        />

        {/* ============================================================ */}
        {/* MODAL HEADER */}
        {/* ============================================================ */}
        <div className="p-5 sm:p-6 border-b border-white/[0.08] flex items-start justify-between gap-4 bg-[#12151C]/90 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl sm:text-2xl font-extrabold text-white font-mono tracking-tight">
                {symbol}
              </span>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-bold">
                {market === 'TH' ? 'TH' : symbol === 'BTC' || symbol === 'ETH' ? 'CRYPTO' : symbol === 'GOLD' ? 'GOLD' : 'US'}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 truncate max-w-[280px] sm:max-w-md">
              {data?.name || initialName || symbol}
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <div className="text-xl sm:text-2xl font-bold text-white font-mono tabular-nums">
                {data?.currentPrice !== undefined ? (
                  <>
                    {currencySymbol}
                    {Number(data.currentPrice).toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: data.currentPrice < 1 ? 4 : 2,
                    })}
                  </>
                ) : (
                  <span className="text-slate-500 text-sm">--</span>
                )}
              </div>
              <span
                className={`inline-flex items-center gap-0.5 text-xs font-mono font-bold mt-0.5 ${
                  isPositive ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {isPositive ? (
                  <ArrowUpRight className="w-3.5 h-3.5" />
                ) : (
                  <ArrowDownRight className="w-3.5 h-3.5" />
                )}
                {isPositive ? '+' : ''}
                {Number(data?.changePercent ?? 0).toFixed(2)}% วันนี้
              </span>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ============================================================ */}
        {/* MODAL BODY (SCROLLABLE) */}
        {/* ============================================================ */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {isLoading && !data ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-500 text-xs">
              <Loader2 className="w-7 h-7 animate-spin text-indigo-400" />
              <span>กำลังดึงข้อมูลกราฟและสถิติการเงิน...</span>
            </div>
          ) : error ? (
            <div className="py-12 p-6 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-center text-rose-300 text-xs">
              ไม่สามารถดึงข้อมูลรายละเอียดของ {symbol} ได้ในขณะนี้
            </div>
          ) : (
            <>
              {/* 1. CHART & TIMEFRAME SELECTOR */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#141822] border border-white/[0.08] shadow-inner space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <BarChart3 className="w-4 h-4 text-indigo-400" />
                    <span className="text-xs font-semibold text-slate-300">
                      แนวโน้มราคาช่วง {range.toUpperCase()}
                    </span>
                    <span
                      className={`text-[11px] font-mono font-bold ml-1 ${
                        isRangePositive ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      ({isRangePositive ? '+' : ''}
                      {rangeChangePercent.toFixed(2)}%)
                    </span>
                  </div>

                  {/* Timeframe Chips */}
                  <div className="flex items-center gap-1 bg-[#0F1218] p-1 rounded-xl border border-white/[0.06]">
                    {(['1d', '1w', '1m', '1y'] as TimeRange[]).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setRange(t)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                          range === t
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
                        }`}
                      >
                        {t.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Area Chart Container */}
                <div className="w-full h-48 sm:h-56 pt-2">
                  {hasChartData ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartPoints}>
                        <defs>
                          <linearGradient
                            id="chartGradient"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor={isRangePositive ? '#10B981' : '#F43F5E'}
                              stopOpacity={0.4}
                            />
                            <stop
                              offset="95%"
                              stopColor={isRangePositive ? '#10B981' : '#F43F5E'}
                              stopOpacity={0.0}
                            />
                          </linearGradient>
                        </defs>
                        <XAxis
                          dataKey="time"
                          stroke="#64748B"
                          fontSize={10}
                          tickLine={false}
                          axisLine={false}
                          minTickGap={25}
                        />
                        <YAxis
                          domain={[minPrice, maxPrice]}
                          stroke="#64748B"
                          fontSize={10}
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
                                <div className="p-2.5 rounded-xl bg-[#12151C] border border-white/[0.12] shadow-xl text-xs font-mono">
                                  <span className="text-slate-400 block text-[10px]">
                                    {p.time}
                                  </span>
                                  <span className="text-sm font-bold text-white mt-0.5 block">
                                    {currencySymbol}
                                    {Number(p.price).toLocaleString('en-US', {
                                      minimumFractionDigits: 2,
                                    })}
                                  </span>
                                </div>
                              )
                            }
                            return null
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="price"
                          stroke={isRangePositive ? '#10B981' : '#F43F5E'}
                          strokeWidth={2}
                          fillOpacity={1}
                          fill="url(#chartGradient)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-500 text-xs">
                      กำลังรวบรวมข้อมูลราคาสำหรับกราฟช่วงเวลานี้...
                    </div>
                  )}
                </div>
              </div>

              {/* 2. 52-WEEK RANGE SLIDER BAR */}
              {data?.fiftyTwoWeekLow && data?.fiftyTwoWeekHigh ? (
                <div className="p-4 rounded-2xl bg-[#141822] border border-white/[0.08] space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-amber-400" />
                      กรอบราคา 52 สัปดาห์ (52-Week Range)
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {fiftyTwoWeekPct !== null
                        ? fiftyTwoWeekPct > 80
                          ? '🔥 ใกล้จุดสูงสุดของปี'
                          : fiftyTwoWeekPct < 20
                          ? '💎 ใกล้จุดต่ำสุดของปี'
                          : 'ระดับกลางของปี'
                        : ''}
                    </span>
                  </div>

                  {/* Progress Bar with Indicator Pin */}
                  <div className="relative pt-2 pb-1">
                    <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden flex">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 via-amber-400 to-rose-500 rounded-full"
                        style={{ width: '100%' }}
                      />
                    </div>
                    {fiftyTwoWeekPct !== null && (
                      <div
                        className="absolute top-0 -translate-x-1/2 flex flex-col items-center"
                        style={{ left: `${fiftyTwoWeekPct}%` }}
                      >
                        <div className="w-3.5 h-3.5 rounded-full bg-white border-2 border-indigo-600 shadow-md" />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                    <span>
                      ต่ำสุด: {currencySymbol}
                      {data.fiftyTwoWeekLow.toFixed(2)}
                    </span>
                    <span className="text-white font-semibold">
                      ปัจจุบัน: {currencySymbol}
                      {data.currentPrice.toFixed(2)}
                    </span>
                    <span>
                      สูงสุด: {currencySymbol}
                      {data.fiftyTwoWeekHigh.toFixed(2)}
                    </span>
                  </div>
                </div>
              ) : null}

              {/* 3. KEY METRICS & VALUATION */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* P/E */}
                <div className="p-3.5 rounded-xl bg-[#141822] border border-white/[0.06]">
                  <span className="text-[10px] text-slate-400 block font-medium">
                    อัตราส่วน P/E
                  </span>
                  <span className="text-base sm:text-lg font-bold text-white font-mono mt-0.5 block">
                    {data?.pe ? `${data.pe}x` : 'N/A'}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {data?.pe
                      ? data.pe < 20
                        ? 'ราคาไม่แพง'
                        : 'สะท้อนการเติบโต'
                      : 'สินทรัพย์ไม่มี P/E'}
                  </span>
                </div>

                {/* Dividend Yield */}
                <div className="p-3.5 rounded-xl bg-[#141822] border border-white/[0.06]">
                  <span className="text-[10px] text-slate-400 block font-medium">
                    เงินปันผล (Dividend)
                  </span>
                  <span className="text-base sm:text-lg font-bold text-emerald-400 font-mono mt-0.5 block">
                    {data?.dividendYield !== null && data?.dividendYield !== undefined
                      ? `${data.dividendYield}%`
                      : '0.00%'}
                  </span>
                  <span className="text-[10px] text-slate-500">อัตราผลตอบแทนต่อปี</span>
                </div>

                {/* Market Cap */}
                <div className="p-3.5 rounded-xl bg-[#141822] border border-white/[0.06]">
                  <span className="text-[10px] text-slate-400 block font-medium">
                    มูลค่าตลาด (Cap)
                  </span>
                  <span className="text-base sm:text-lg font-bold text-white font-mono mt-0.5 block truncate">
                    {data?.marketCap
                      ? data.marketCap >= 1000000
                        ? `${(data.marketCap / 1000000).toFixed(2)}T`
                        : data.marketCap >= 1000
                        ? `${(data.marketCap / 1000).toFixed(1)}B`
                        : `${data.marketCap}M`
                      : 'N/A'}
                  </span>
                  <span className="text-[10px] text-slate-500">Market Cap</span>
                </div>

                {/* Day Range */}
                <div className="p-3.5 rounded-xl bg-[#141822] border border-white/[0.06]">
                  <span className="text-[10px] text-slate-400 block font-medium">
                    กรอบราคาวันนี้
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-white font-mono mt-1 block truncate">
                    {data?.dayLow && data?.dayHigh
                      ? `${currencySymbol}${data.dayLow.toFixed(1)} - ${currencySymbol}${data.dayHigh.toFixed(1)}`
                      : 'N/A'}
                  </span>
                  <span className="text-[10px] text-slate-500">Day Low - High</span>
                </div>
              </div>

              {/* 4. ANALYST CONSENSUS & TARGET PRICE */}
              {data?.analystTarget && (
                <div className="p-4 rounded-2xl bg-gradient-to-r from-[#141822] to-[#171C28] border border-indigo-500/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Award className="w-4 h-4 text-indigo-400" />
                      <span className="text-xs font-bold text-white">
                        มุมมองนักวิเคราะห์ (Wall St. Consensus)
                      </span>
                    </div>

                    {data.analystTarget.recommendation && (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                        {data.analystTarget.recommendation}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-white/[0.04]">
                    <div>
                      <span className="text-[10px] text-slate-400 font-medium">
                        ราคาเป้าหมายเฉลี่ย (Mean Target)
                      </span>
                      <p className="text-lg font-bold text-white font-mono">
                        {currencySymbol}
                        {data.analystTarget.targetMean?.toFixed(2)}
                      </p>
                    </div>

                    <div className="text-left sm:text-right">
                      <span className="text-[10px] text-slate-400 font-medium">
                        โอกาสสร้างผลตอบแทน (Potential Upside)
                      </span>
                      <p
                        className={`text-lg font-bold font-mono ${
                          (data.analystTarget.upsidePercent ?? 0) >= 0
                            ? 'text-emerald-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {(data.analystTarget.upsidePercent ?? 0) >= 0 ? '+' : ''}
                        {data.analystTarget.upsidePercent}%
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* 5. USER'S HOLDINGS IN PORTFOLIO (IF OWNED) */}
              {data?.userPosition && (
                <div className="p-4 rounded-2xl bg-emerald-500/[0.06] border border-emerald-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                      <Briefcase className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        คุณถือสินทรัพย์นี้ในพอร์ตโฟลิโอ
                      </span>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        จำนวน {data.userPosition.shares} หน่วย • ต้นทุนเฉลี่ย{' '}
                        {currencySymbol}
                        {data.userPosition.avgCost}
                      </p>
                    </div>
                  </div>

                  <div className="text-left sm:text-right">
                    <span className="text-[10px] text-slate-400">กำไร/ขาดทุนสะสม</span>
                    <p
                      className={`text-sm font-bold font-mono ${
                        data.userPosition.unrealizedGain >= 0
                          ? 'text-emerald-400'
                          : 'text-rose-400'
                      }`}
                    >
                      {data.userPosition.unrealizedGain >= 0 ? '+' : ''}
                      {currencySymbol}
                      {data.userPosition.unrealizedGain.toLocaleString()} (
                      {data.userPosition.unrealizedGainPercent}%)
                    </p>
                  </div>
                </div>
              )}

              {/* 6. GEMINI AI STOCK INSIGHTS */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-[#12151C] to-[#191D28] border border-amber-500/25 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white tracking-wide flex items-center gap-2">
                        <span>วิเคราะห์หุ้นเชิงลึกด้วย AI (Gemini Insights)</span>
                        {aiModelUsed && (
                          <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-normal">
                            {aiModelUsed}
                          </span>
                        )}
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        สังเคราะห์จุดแข็ง ความเสี่ยง และคำแนะนำการลงทุนเป็นภาษาไทย
                      </p>
                    </div>
                  </div>

                  {!aiInsight && (
                    <button
                      type="button"
                      onClick={handleGenerateAiInsight}
                      disabled={isAiLoading}
                      className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-amber-500/20 active:scale-95 shrink-0"
                    >
                      {isAiLoading ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>กำลังประมวลผล...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>วิเคราะห์ทันที</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* AI Loading State */}
                {isAiLoading && (
                  <div className="py-6 px-4 rounded-xl bg-white/[0.02] border border-white/[0.06] flex flex-col items-center justify-center text-center space-y-2">
                    <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
                    <p className="text-xs text-slate-300 font-medium">
                      Gemini กำลังวิเคราะห์งบการเงิน ตัวเลข P/E และความเสี่ยงของ {symbol}...
                    </p>
                    <span className="text-[10px] text-slate-500">
                      ใช้เวลาประมาณ 3-5 วินาที
                    </span>
                  </div>
                )}

                {/* AI Error */}
                {aiError && (
                  <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-center justify-between">
                    <span>{aiError}</span>
                    <button
                      onClick={handleGenerateAiInsight}
                      className="text-amber-400 hover:underline font-semibold ml-2"
                    >
                      ลองใหม่
                    </button>
                  </div>
                )}

                {/* AI Result View */}
                {aiInsight && (
                  <div className="space-y-3">
                    <div className="p-4 rounded-xl bg-[#0F1218] border border-white/[0.06] text-xs text-slate-200 leading-relaxed space-y-2 prose prose-invert max-w-none">
                      {aiInsight.split('\n\n').map((paragraph, idx) => (
                        <p key={idx} className="whitespace-pre-line">
                          {paragraph}
                        </p>
                      ))}
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                      <span>*ข้อมูลการวิเคราะห์ใช้เพื่อประกอบการตัดสินใจเบื้องต้นเท่านั้น</span>
                      <button
                        type="button"
                        onClick={handleGenerateAiInsight}
                        disabled={isAiLoading}
                        className="text-amber-400 hover:underline flex items-center gap-1 font-medium"
                      >
                        <Sparkles className="w-2.5 h-2.5" />
                        วิเคราะห์ซ้ำ
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
