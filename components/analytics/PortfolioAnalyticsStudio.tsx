'use client'

import React, { useState, useMemo, useEffect } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import {
  Eye,
  EyeOff,
  HelpCircle,
  RefreshCw,
  Download,
  AlertTriangle,
  Wallet,
  ArrowLeftRight,
  ChevronDown,
  LineChart as LineChartIcon,
} from 'lucide-react'
import {
  BENCHMARK_OPTIONS,
  BenchmarkId,
  ChartMode,
  PortfolioAnalyticsPayload,
  ReturnMethod,
  ZoomRange,
  computeKeyStats,
  computeMonthlyReturnMatrix,
  computeWindowSeries,
  isZoomAvailable,
  resolveZoomIndices,
} from '@/lib/analytics/portfolio-analytics-math'
import { PortfolioBenchmarkChart } from './PortfolioBenchmarkChart'
import { KeyStatsPanel } from './KeyStatsPanel'
import { PnLBreakdownPanel } from './PnLBreakdownPanel'
import { GainsReturnsPanel } from './GainsReturnsPanel'

type AnalyticsTab = 'benchmark' | 'key_stats' | 'pnl' | 'gains'

const SUB_TABS: Array<{ id: AnalyticsTab; label: string }> = [
  { id: 'benchmark', label: 'Benchmark' },
  { id: 'key_stats', label: 'Key Stats' },
  { id: 'pnl', label: 'P&L Breakdown' },
  { id: 'gains', label: 'Gains & Returns' },
]

const CHART_MODES: Array<{ id: ChartMode; label: string }> = [
  { id: 'value', label: 'Value' },
  { id: 'return', label: 'Return' },
  { id: 'gain', label: 'Gain' },
  { id: 'cash', label: 'Cash' },
  { id: 'drawdown', label: '%Off High' },
]

const RETURN_METHODS: Array<{ id: ReturnMethod; label: string; desc: string }> = [
  { id: 'MWR', label: 'MWR', desc: 'Money-Weighted (Modified Dietz) คำนึงถึงจังหวะเงินเข้า-ออกจริง' },
  { id: 'TWR', label: 'TWR', desc: 'Time-Weighted วัดฝีมือพอร์ตเพียวๆ ตัดผลของการฝาก-ถอนเงิน' },
  { id: 'SR', label: 'SR', desc: 'Simple Return กำไรสุทธิเทียบเงินต้นรวมในช่วงเวลา' },
]

const ZOOM_PRESETS: Array<{ id: ZoomRange; label: string }> = [
  { id: '1m', label: '1m' },
  { id: '3m', label: '3m' },
  { id: '6m', label: '6m' },
  { id: 'ytd', label: 'Ytd' },
  { id: '1y', label: '1y' },
  { id: '3y', label: '3y' },
  { id: '5y', label: '5y' },
  { id: 'all', label: 'All' },
]

function formatHeroMoney(val: number, sym: string, hide?: boolean): string {
  if (hide) return `${sym} •••••••`
  const abs = Math.abs(val)
  const sign = val < 0 ? '-' : ''
  return `${sign}${sym}${abs.toLocaleString('en-US', {
    minimumFractionDigits: abs > 0 && abs < 1000 ? 2 : 0,
    maximumFractionDigits: abs > 0 && abs < 1000 ? 2 : 0,
  })}`
}

function formatDeltaAmount(val: number, sym: string, hide?: boolean): string {
  if (hide) return `${sym}•••••`
  const sign = val > 0 ? '+' : val < 0 ? '-' : '+'
  return `${sign}${sym}${Math.abs(val).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function formatDeltaPercent(pct: number): string {
  const sign = pct > 0 ? '+' : pct < 0 ? '-' : '+'
  return `${sign}${Math.abs(pct).toFixed(2)}%`
}

function getDeltaToneClass(val: number, zeroIsNeutral = false): string {
  if (zeroIsNeutral && Math.abs(val) < 0.005) return 'text-[#9AA4B2]'
  return val >= 0 ? 'text-[#20C997]' : 'text-[#F05D73]'
}

function AnalyticsLoadingSkeleton() {
  return (
    <div className="w-full max-w-[1440px] mx-auto space-y-5 animate-fade-in" aria-busy="true">
      <div className="rounded-2xl bg-[#12151C] border border-white/[0.08] p-6 space-y-5">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 space-y-3">
            <div className="h-4 w-32 rounded bg-white/[0.06] animate-pulse" />
            <div className="h-10 w-56 rounded bg-white/[0.08] animate-pulse" />
            <div className="h-4 w-48 rounded bg-white/[0.05] animate-pulse" />
            <div className="h-4 w-44 rounded bg-white/[0.05] animate-pulse" />
            <div className="h-4 w-52 rounded bg-white/[0.05] animate-pulse" />
          </div>
          <div className="lg:col-span-7 space-y-4">
            <div className="h-8 w-80 ml-auto rounded bg-white/[0.06] animate-pulse" />
            <div className="grid grid-cols-2 gap-4">
              <div className="h-28 rounded-xl bg-white/[0.04] animate-pulse" />
              <div className="h-28 rounded-xl bg-white/[0.04] animate-pulse" />
            </div>
          </div>
        </div>
        <div className="h-[340px] rounded-xl bg-[#0B0E15] border border-white/[0.06] animate-pulse" />
      </div>
    </div>
  )
}

export function PortfolioAnalyticsStudio() {
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('benchmark')
  const [benchmarkId, setBenchmarkId] = useState<BenchmarkId>('SP500')
  const [chartMode, setChartMode] = useState<ChartMode>('return')
  const [returnMethod, setReturnMethod] = useState<ReturnMethod>('MWR')
  const [zoom, setZoom] = useState<ZoomRange>('all')
  const [customRange, setCustomRange] = useState<{ startIdx: number; endIdx: number } | null>(null)
  const [hideAmounts, setHideAmounts] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const [showPortfolioLine, setShowPortfolioLine] = useState(true)
  const [showBenchmarkLine, setShowBenchmarkLine] = useState(true)
  const [showCashLine, setShowCashLine] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const swrKey = `/api/portfolio/analytics?benchmark=${benchmarkId}`
  const { data, error, isLoading, mutate } = useSWR<PortfolioAnalyticsPayload>(swrKey, {
    revalidateOnFocus: false,
    dedupingInterval: 15000,
    keepPreviousData: true,
  })

  // Close guide popover on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowGuide(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const series = useMemo(() => data?.series || [], [data])

  const { startIdx, endIdx } = useMemo(() => {
    if (series.length === 0) return { startIdx: 0, endIdx: 0 }
    if (customRange) {
      const maxI = series.length - 1
      const s = Math.max(0, Math.min(customRange.startIdx, maxI))
      const e = Math.max(s, Math.min(customRange.endIdx, maxI))
      return { startIdx: s, endIdx: e }
    }
    return resolveZoomIndices(series, zoom)
  }, [series, customRange, zoom])

  const { points: windowPoints, summary: windowSummary } = useMemo(
    () => computeWindowSeries(series, startIdx, endIdx, returnMethod),
    [series, startIdx, endIdx, returnMethod]
  )

  const keyStats = useMemo(
    () =>
      computeKeyStats(
        series,
        startIdx,
        endIdx,
        data?.fullHistoryXirrPercent,
        data?.baseCurrency || 'THB'
      ),
    [series, startIdx, endIdx, data?.fullHistoryXirrPercent, data?.baseCurrency]
  )

  const fullMatrix = useMemo(() => computeMonthlyReturnMatrix(series), [series])

  const handleSelectZoom = (preset: ZoomRange) => {
    setCustomRange(null)
    setZoom(preset)
  }

  const handleBrushChange = (nextStart: number, nextEnd: number) => {
    setCustomRange({ startIdx: nextStart, endIdx: nextEnd })
  }

  const handleForceRefresh = async () => {
    if (refreshing) return
    setRefreshing(true)
    try {
      const res = await fetch(`/api/portfolio/analytics?benchmark=${benchmarkId}&refresh=true`)
      if (res.ok) {
        const fresh = await res.json()
        await mutate(fresh, false)
      } else {
        await mutate()
      }
    } finally {
      setRefreshing(false)
    }
  }

  const handleExportCsv = () => {
    if (!series.length) return
    const header = [
      'Date',
      'PortfolioValue',
      'BenchmarkValue',
      'CashDeposits',
      'NetCashFlow',
      'DividendFlow',
      'TotalGain',
      'WindowReturnPct',
      'BenchmarkReturnPct',
      'TwrIndex',
      'DailyReturnPct',
      'UsdThbRate',
    ].join(',')

    const rows = windowPoints.map((pt, i) => {
      const raw = series[startIdx + i]
      return [
        pt.date,
        pt.portfolioValue.toFixed(2),
        pt.benchmarkValue.toFixed(2),
        pt.cashDeposits.toFixed(2),
        pt.netCashFlow.toFixed(2),
        (raw?.dividendFlow ?? 0).toFixed(2),
        pt.portfolioGain.toFixed(2),
        pt.portfolioReturnPct.toFixed(2),
        pt.benchmarkReturnPct.toFixed(2),
        (raw?.twrIndex ?? 1).toFixed(6),
        pt.dailyReturnPct.toFixed(4),
        pt.usdThbRate.toFixed(4),
      ].join(',')
    })

    const csv = '\uFEFF' + [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `investment-analytics-${benchmarkId}-${windowSummary.endDate || 'export'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (isLoading && !data) {
    return <AnalyticsLoadingSkeleton />
  }

  if (error && !data) {
    return (
      <div className="w-full max-w-xl mx-auto py-16 text-center space-y-4">
        <AlertTriangle className="w-8 h-8 text-[#F2B84B] mx-auto" />
        <h2 className="text-lg font-bold text-[#F4F6F8]">โหลดข้อมูลกราฟสถิติพอร์ตไม่สำเร็จ</h2>
        <p className="text-xs text-[#9AA4B2]">
          ระบบไม่สามารถดึงข้อมูลราคาประวัติศาสตร์ได้ในขณะนี้ ลองโหลดใหม่อีกครั้ง
        </p>
        <button
          type="button"
          onClick={() => mutate()}
          className="px-4 py-2 rounded-xl bg-[#6D5EF7] hover:bg-[#5B4CE6] text-xs font-semibold text-white cursor-pointer"
        >
          ลองอีกครั้ง
        </button>
      </div>
    )
  }

  if (!data || !data.hasData) {
    return (
      <div className="w-full max-w-2xl mx-auto rounded-2xl bg-[#12151C] border border-white/[0.08] p-8 text-center space-y-5">
        <div className="w-12 h-12 rounded-2xl bg-[#6D5EF7]/15 text-[#6D5EF7] flex items-center justify-center mx-auto">
          <LineChartIcon className="w-6 h-6" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-xl font-bold text-[#F4F6F8]">
            ยังไม่มีประวัติธุรกรรมสำหรับสร้างกราฟ Benchmark
          </h2>
          <p className="text-sm text-[#9AA4B2] max-w-md mx-auto">
            เมื่อคุณสร้างบัญชีและบันทึกรายการซื้อ-ขายแรก ระบบจะสร้างกราฟเปรียบเทียบกับ S&amp;P 500,
            MWR/TWR, Drawdown และตารางสถิติรายเดือนให้อัตโนมัติ
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
          <Link
            href="/accounts"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#181C25] hover:bg-[#202633] border border-white/[0.1] text-xs font-semibold text-[#F4F6F8]"
          >
            <Wallet className="w-4 h-4 text-[#6D5EF7]" />
            <span>ตรวจสอบบัญชีลงทุน</span>
          </Link>
          <Link
            href="/transactions"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#6D5EF7] hover:bg-[#5D4EE8] text-xs font-semibold text-white"
          >
            <ArrowLeftRight className="w-4 h-4" />
            <span>เพิ่มธุรกรรมแรก / Import CSV</span>
          </Link>
        </div>
      </div>
    )
  }

  const baseSym = data.baseCurrency.toUpperCase() === 'USD' ? '$' : '฿'
  const benchMeta = data.benchmark
  const periodLabel = customRange ? 'CUSTOM' : zoom.toUpperCase()
  const formattedLastUpdated = data.lastUpdated
    ? data.lastUpdated.replace('T', ' ').replace('Z', ' GMT')
    : ''

  return (
    <div className="w-full max-w-[1440px] mx-auto space-y-5 animate-fade-in pb-10">
      {/* ── MAIN ANALYTICS COCKPIT CARD ────────────────────────────────── */}
      <div className="rounded-2xl bg-[#12151C] border border-white/[0.08] p-4 sm:p-6 space-y-5">
        {/* TOP HEADER GRID: Hero Portfolio Left + Tabs & Twin Counterfactuals Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left 5 Cols: My Portfolio & Exact 3 Delta Lines */}
          <div className="lg:col-span-5 space-y-2.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[#9AA4B2]">
                My Portfolio (พอร์ตของฉัน)
              </span>
              <button
                type="button"
                onClick={() => setHideAmounts((v) => !v)}
                className="p-1 rounded-lg text-[#9AA4B2] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
                title={hideAmounts ? 'แสดงตัวเลขเงิน' : 'ซ่อนตัวเลขเงิน (โหมดความเป็นส่วนตัว)'}
                aria-label="สลับการซ่อนตัวเลข"
              >
                {hideAmounts ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>

            <div className="flex items-baseline gap-3 flex-wrap">
              <h1 className="text-3xl sm:text-4xl font-extrabold text-[#F4F6F8] font-mono tabular-nums tracking-tight leading-none">
                {formatHeroMoney(data.deltas.portfolio.value, baseSym, hideAmounts)}
              </h1>
              {data.totalCashReserve > 0 && (
                <span className="text-[11px] font-mono text-[#9AA4B2]">
                  + เงินสด {formatHeroMoney(data.totalCashReserve, baseSym, hideAmounts)}
                </span>
              )}
            </div>

            {/* 3 Delta Lines matching screenshot */}
            <div className="space-y-1 pt-0.5 text-xs font-mono tabular-nums">
              {/* Line 1: TODAY */}
              <div className="flex items-center gap-2">
                <span className={`font-semibold ${getDeltaToneClass(data.deltas.portfolio.today.amount)}`}>
                  {formatDeltaAmount(data.deltas.portfolio.today.amount, baseSym, hideAmounts)} (
                  {formatDeltaPercent(data.deltas.portfolio.today.percent)})
                </span>
                <span className="text-[10px] font-sans font-semibold tracking-wider text-[#9AA4B2] uppercase">
                  TODAY
                </span>
              </div>

              {/* Line 2: YESTERDAY */}
              <div className="flex items-center gap-2">
                <span
                  className={`font-semibold ${getDeltaToneClass(data.deltas.portfolio.yesterday.amount)}`}
                >
                  {formatDeltaAmount(data.deltas.portfolio.yesterday.amount, baseSym, hideAmounts)} (
                  {formatDeltaPercent(data.deltas.portfolio.yesterday.percent)})
                </span>
                <span className="text-[10px] font-sans font-semibold tracking-wider text-[#9AA4B2] uppercase">
                  YESTERDAY
                </span>
              </div>

              {/* Line 3: Period / ALL selector synced with Zoom */}
              <div className="flex items-center gap-2">
                <span
                  className={`font-semibold ${getDeltaToneClass(windowSummary.portfolio.amount)}`}
                >
                  {formatDeltaAmount(windowSummary.portfolio.amount, baseSym, hideAmounts)} (
                  {formatDeltaPercent(windowSummary.portfolio.percent)})
                </span>
                <div className="relative inline-flex items-center">
                  <select
                    value={customRange ? 'CUSTOM' : zoom}
                    onChange={(e) => {
                      const val = e.target.value
                      if (val !== 'CUSTOM') handleSelectZoom(val as ZoomRange)
                    }}
                    aria-label="เลือกช่วงเวลาสรุปผลตอบแทน"
                    className="appearance-none bg-[#181C25] hover:bg-[#202633] border border-white/[0.12] rounded-md pl-2 pr-5 py-0.5 text-[10px] font-sans font-semibold text-[#F4F6F8] uppercase cursor-pointer focus:outline-none focus:border-[#6D5EF7]"
                  >
                    {customRange && <option value="CUSTOM">CUSTOM</option>}
                    {ZOOM_PRESETS.map((z) => (
                      <option
                        key={z.id}
                        value={z.id}
                        disabled={!isZoomAvailable(series, z.id)}
                      >
                        {z.id.toUpperCase()}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3 h-3 text-[#9AA4B2] pointer-events-none absolute right-1" />
                </div>
              </div>
            </div>

            <p className="text-[11px] text-[#64748B] font-mono pt-1">
              Last Updated: {formattedLastUpdated} • {data.dataSource}
            </p>
          </div>

          {/* Right 7 Cols: 4 Sub-Tabs + Counterfactual Comparisons */}
          <div className="lg:col-span-7 flex flex-col justify-between space-y-5">
            {/* 4 Sub-Tabs Navigation */}
            <div className="flex items-center justify-start lg:justify-end gap-5 sm:gap-7 border-b border-white/[0.08] overflow-x-auto no-scrollbar">
              {SUB_TABS.map((tab) => {
                const isActive = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`pb-2.5 text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors border-b-2 -mb-[1px] cursor-pointer ${
                      isActive
                        ? 'text-[#F4F6F8] border-[#6D5EF7]'
                        : 'text-[#9AA4B2] border-transparent hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                )
              })}
            </div>

            {/* Twin Counterfactual KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 lg:pl-6">
              {/* Counterfactual 1: What if investing in [Benchmark] */}
              <div className="space-y-1.5 sm:border-r sm:border-white/[0.07] sm:pr-4">
                <div className="flex items-center gap-1.5 flex-wrap text-xs text-[#9AA4B2]">
                  <span>What if investing in</span>
                  <div className="relative inline-flex items-center">
                    <select
                      value={benchmarkId}
                      onChange={(e) => setBenchmarkId(e.target.value as BenchmarkId)}
                      aria-label="เลือกดัชนีอ้างอิง"
                      className="appearance-none bg-[#181C25] hover:bg-[#202633] border border-white/[0.12] rounded-md pl-2 pr-5 py-0.5 text-[11px] font-semibold text-[#F4F6F8] cursor-pointer focus:outline-none focus:border-[#6D5EF7]"
                    >
                      {BENCHMARK_OPTIONS.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-3 h-3 text-[#9AA4B2] pointer-events-none absolute right-1" />
                  </div>
                  <span
                    title={`จำลองว่าหากนำเงินฝาก-ถอนชุดเดียวกันทั้งหมดไปลงทุนใน ${benchMeta.label} แทน มูลค่าพอร์ตจะเป็นเท่าใด (Public Market Equivalent)`}
                    className="text-[#64748B] hover:text-white cursor-help"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                  </span>
                </div>

                <p className="text-2xl font-bold text-[#F4F6F8] font-mono tabular-nums">
                  {formatHeroMoney(data.deltas.benchmark.value, baseSym, hideAmounts)}
                </p>

                <div className="space-y-0.5 text-[11px] font-mono tabular-nums">
                  <div className="flex items-center gap-1.5">
                    <span className={getDeltaToneClass(data.deltas.benchmark.today.amount)}>
                      {formatDeltaAmount(data.deltas.benchmark.today.amount, baseSym, hideAmounts)} (
                      {formatDeltaPercent(data.deltas.benchmark.today.percent)})
                    </span>
                    <span className="text-[10px] font-sans text-[#64748B]">TODAY</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={getDeltaToneClass(data.deltas.benchmark.yesterday.amount)}>
                      {formatDeltaAmount(
                        data.deltas.benchmark.yesterday.amount,
                        baseSym,
                        hideAmounts
                      )}{' '}
                      ({formatDeltaPercent(data.deltas.benchmark.yesterday.percent)})
                    </span>
                    <span className="text-[10px] font-sans text-[#64748B]">YESTERDAY</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={getDeltaToneClass(windowSummary.benchmark.amount)}>
                      {formatDeltaAmount(windowSummary.benchmark.amount, baseSym, hideAmounts)} (
                      {formatDeltaPercent(windowSummary.benchmark.percent)})
                    </span>
                    <span className="text-[10px] font-sans text-[#64748B]">{periodLabel}</span>
                  </div>
                </div>
              </div>

              {/* Counterfactual 2: What if not investing */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs text-[#9AA4B2]">
                  <span>What if not investing</span>
                  <span
                    title="เงินต้นสุทธิที่เติมเข้า-ถอนออกจากพอร์ตทั้งหมด หากเก็บไว้เป็นเงินสดเฉยๆ (0% ผลตอบแทน)"
                    className="text-[#64748B] hover:text-white cursor-help"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                  </span>
                </div>

                <p className="text-2xl font-bold text-[#F4F6F8] font-mono tabular-nums">
                  {formatHeroMoney(data.deltas.notInvesting.value, baseSym, hideAmounts)}
                </p>

                <div className="space-y-0.5 text-[11px] font-mono tabular-nums">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[#9AA4B2]">
                      {formatDeltaAmount(0, baseSym, hideAmounts)} (+0.00%)
                    </span>
                    <span className="text-[10px] font-sans text-[#64748B]">TODAY</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[#9AA4B2]">
                      {formatDeltaAmount(0, baseSym, hideAmounts)} (+0.00%)
                    </span>
                    <span className="text-[10px] font-sans text-[#64748B]">YESTERDAY</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[#9AA4B2]">
                      {formatDeltaAmount(0, baseSym, hideAmounts)} (+0.00%)
                    </span>
                    <span className="text-[10px] font-sans text-[#64748B]">{periodLabel}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── SHARED ZOOM & UTILITY BAR (when Benchmark or Key Stats active) ─── */}
        {(activeTab === 'benchmark' || activeTab === 'key_stats') && (
          <div className="pt-3 border-t border-white/[0.08] space-y-3">
            {/* Toolbar Row: Mode Switcher + Return Method + Actions */}
            {activeTab === 'benchmark' && (
              <div className="flex flex-wrap items-center justify-between gap-3 relative">
                {/* Left: Value | Return | Gain | Cash | %Off High + Help */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="inline-flex items-center p-1 rounded-xl bg-[#090B10] border border-white/[0.08]">
                    {CHART_MODES.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setChartMode(m.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                          chartMode === m.id
                            ? 'bg-[#181C25] text-[#F4F6F8] border border-white/[0.12]'
                            : 'text-[#9AA4B2] hover:text-white border border-transparent'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowGuide((v) => !v)}
                    className="w-8 h-8 rounded-xl bg-[#181C25] border border-white/[0.08] text-[#9AA4B2] hover:text-white flex items-center justify-center cursor-pointer"
                    title="คำอธิบายโหมดกราฟและ MWR / TWR / SR"
                    aria-label="คำอธิบายตัวชี้วัด"
                  >
                    <HelpCircle className="w-4 h-4" />
                  </button>
                </div>

                {/* Right: MWR | TWR | SR + Refresh + Export CSV */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="inline-flex items-center p-1 rounded-xl bg-[#090B10] border border-white/[0.08]">
                    {RETURN_METHODS.map((rm) => (
                      <button
                        key={rm.id}
                        type="button"
                        onClick={() => {
                          setReturnMethod(rm.id)
                          if (chartMode !== 'return') setChartMode('return')
                        }}
                        title={rm.desc}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                          returnMethod === rm.id
                            ? 'bg-[#181C25] text-[#F4F6F8] border border-white/[0.12]'
                            : 'text-[#9AA4B2] hover:text-white border border-transparent'
                        }`}
                      >
                        {rm.label}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={handleForceRefresh}
                    disabled={refreshing}
                    title="อัปเดตราคาตลาดล่าสุด"
                    className="h-9 px-3 rounded-xl bg-[#181C25] hover:bg-[#202633] border border-white/[0.08] text-xs font-semibold text-[#F4F6F8] flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline">อัปเดต</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExportCsv}
                    title="ดาวน์โหลดข้อมูลรายวันเป็น CSV"
                    className="h-9 px-3 rounded-xl bg-[#181C25] hover:bg-[#202633] border border-white/[0.08] text-xs font-semibold text-[#F4F6F8] flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">CSV</span>
                  </button>
                </div>

                {/* Thai Legend & Formula Popover */}
                {showGuide && (
                  <div className="absolute left-0 top-12 z-30 w-full max-w-lg rounded-2xl bg-[#181C25] border border-white/[0.14] p-4 shadow-2xl text-xs space-y-2.5">
                    <div className="flex items-center justify-between border-b border-white/[0.08] pb-2">
                      <span className="font-bold text-[#F4F6F8]">
                        คู่มือตัวชี้วัดและโหมดกราฟ
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowGuide(false)}
                        className="text-[#9AA4B2] hover:text-white text-[11px] cursor-pointer"
                      >
                        ปิด
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[#9AA4B2]">
                      <p>
                        <strong className="text-[#F4F6F8]">Value:</strong> มูลค่าตลาดจริงของพอร์ตเทียบ Benchmark และเงินต้น
                      </p>
                      <p>
                        <strong className="text-[#F4F6F8]">Return:</strong> ผลตอบแทนสะสม (%) เทียบกับดัชนีอ้างอิง
                      </p>
                      <p>
                        <strong className="text-[#F4F6F8]">Gain:</strong> กำไร/ขาดทุนสุทธิเป็นบาทในช่วงเวลาที่เลือก
                      </p>
                      <p>
                        <strong className="text-[#F4F6F8]">Cash:</strong> กระแสเงินฝากสะสมและแท่งเงินเข้า-ออกรายวัน
                      </p>
                      <p>
                        <strong className="text-[#F4F6F8]">%Off High:</strong> ระยะห่างจากจุดสูงสุดเดิม (Drawdown)
                      </p>
                      <p>
                        <strong className="text-[#F4F6F8]">MWR / TWR / SR:</strong> MWR วัดผลตอบแทนตามเงินจริง; TWR วัดฝีมือไม่สนฝากถอน; SR เทียบเงินต้นรวม
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Zoom Row & Date Range */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs text-[#9AA4B2] mr-1">Zoom</span>
                {ZOOM_PRESETS.map((z) => {
                  const available = isZoomAvailable(series, z.id)
                  const isSelected = !customRange && zoom === z.id
                  return (
                    <button
                      key={z.id}
                      type="button"
                      disabled={!available}
                      onClick={() => handleSelectZoom(z.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                        !available
                          ? 'text-[#64748B]/45 cursor-not-allowed'
                          : isSelected
                          ? 'bg-[#181C25] text-[#F4F6F8] border border-white/[0.14] cursor-pointer'
                          : 'text-[#9AA4B2] hover:text-white cursor-pointer'
                      }`}
                    >
                      {z.label}
                    </button>
                  )
                })}
                {customRange && (
                  <button
                    type="button"
                    onClick={() => handleSelectZoom('all')}
                    className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-[#6D5EF7]/15 text-[#F4F6F8] border border-[#6D5EF7]/40 cursor-pointer"
                  >
                    รีเซ็ตช่วง
                  </button>
                )}
              </div>

              <div className="text-xs font-mono tabular-nums text-[#9AA4B2] bg-[#090B10] border border-white/[0.08] px-3 py-1 rounded-lg">
                {windowSummary.startDate} → {windowSummary.endDate}
              </div>
            </div>

            {/* Interactive Series Legend (Benchmark tab) */}
            {activeTab === 'benchmark' && (
              <div className="flex items-center gap-5 flex-wrap text-xs">
                <button
                  type="button"
                  onClick={() => setShowPortfolioLine((v) => !v)}
                  className={`flex items-center gap-2 transition-opacity cursor-pointer ${
                    showPortfolioLine ? 'opacity-100 text-[#F4F6F8]' : 'opacity-40 text-[#9AA4B2]'
                  }`}
                >
                  <span className="w-3.5 h-0.5 bg-white rounded-full inline-block" />
                  <span>Portfolio</span>
                </button>

                {chartMode !== 'cash' && (
                  <button
                    type="button"
                    onClick={() => setShowBenchmarkLine((v) => !v)}
                    className={`flex items-center gap-2 transition-opacity cursor-pointer ${
                      showBenchmarkLine ? 'opacity-100 text-[#9AA4B2]' : 'opacity-40 text-[#64748B]'
                    }`}
                  >
                    <span className="w-3.5 h-0.5 bg-[#848E9F] rounded-full inline-block" />
                    <span>{benchMeta.shortLabel}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setShowCashLine((v) => !v)}
                  className={`flex items-center gap-2 transition-opacity cursor-pointer ${
                    showCashLine ? 'opacity-100 text-[#9AA4B2]' : 'opacity-40 text-[#64748B]'
                  }`}
                >
                  <span className="w-3 h-2.5 bg-slate-500/40 border border-slate-500/60 rounded-xs inline-block" />
                  <span>Cash Deposits</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── TAB CONTENT VIEWPORT ─────────────────────────────────────── */}
        {activeTab === 'benchmark' && (
          <div className="space-y-4">
            <PortfolioBenchmarkChart
              series={series}
              windowPoints={windowPoints}
              startIdx={startIdx}
              endIdx={endIdx}
              onRangeChange={handleBrushChange}
              chartMode={chartMode}
              returnMethod={returnMethod}
              benchmarkLabel={benchMeta.shortLabel}
              baseCurrency={data.baseCurrency}
              hideAmounts={hideAmounts}
              showPortfolio={showPortfolioLine}
              showBenchmark={showBenchmarkLine}
              showCashDeposits={showCashLine}
              showNavigator={true}
              height={330}
            />

            {/* Live Period Snapshot Strip */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
              <div className="rounded-xl bg-[#181C25] border border-white/[0.06] px-4 py-3">
                <span className="text-[11px] text-[#9AA4B2] block">
                  ผลตอบแทนพอร์ต ({returnMethod})
                </span>
                <p
                  className={`text-base sm:text-lg font-bold font-mono tabular-nums mt-0.5 ${getDeltaToneClass(
                    windowSummary.portfolio.percent
                  )}`}
                >
                  {formatDeltaPercent(windowSummary.portfolio.percent)}
                </p>
              </div>

              <div className="rounded-xl bg-[#181C25] border border-white/[0.06] px-4 py-3">
                <span className="text-[11px] text-[#9AA4B2] block">
                  {benchMeta.label} ({returnMethod})
                </span>
                <p
                  className={`text-base sm:text-lg font-bold font-mono tabular-nums mt-0.5 ${getDeltaToneClass(
                    windowSummary.benchmark.percent
                  )}`}
                >
                  {formatDeltaPercent(windowSummary.benchmark.percent)}
                </p>
              </div>

              <div className="rounded-xl bg-[#181C25] border border-white/[0.06] px-4 py-3">
                <span className="text-[11px] text-[#9AA4B2] block">
                  ส่วนต่างเทียบตลาด (Alpha)
                </span>
                <p
                  className={`text-base sm:text-lg font-bold font-mono tabular-nums mt-0.5 ${getDeltaToneClass(
                    windowSummary.alphaPct
                  )}`}
                >
                  {formatDeltaPercent(windowSummary.alphaPct)}
                </p>
              </div>

              <div className="rounded-xl bg-[#181C25] border border-white/[0.06] px-4 py-3">
                <span className="text-[11px] text-[#9AA4B2] block">
                  Max Drawdown (ช่วงที่เลือก)
                </span>
                <p
                  className={`text-base sm:text-lg font-bold font-mono tabular-nums mt-0.5 ${
                    keyStats.maxDrawdownPercent < 0 ? 'text-[#F05D73]' : 'text-[#F4F6F8]'
                  }`}
                >
                  {keyStats.maxDrawdownPercent.toFixed(2)}%
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'key_stats' && (
          <KeyStatsPanel
            stats={keyStats}
            benchmarkLabel={benchMeta.shortLabel}
            baseCurrency={data.baseCurrency}
            hideAmounts={hideAmounts}
            startDate={windowSummary.startDate}
            endDate={windowSummary.endDate}
          />
        )}

        {activeTab === 'pnl' && (
          <PnLBreakdownPanel
            pnlBreakdown={data.pnlBreakdown}
            matrix={fullMatrix}
            series={series}
            baseCurrency={data.baseCurrency}
            hideAmounts={hideAmounts}
          />
        )}

        {activeTab === 'gains' && (
          <GainsReturnsPanel
            matrix={fullMatrix}
            benchmarkLabel={benchMeta.shortLabel}
            baseCurrency={data.baseCurrency}
            hideAmounts={hideAmounts}
          />
        )}
      </div>
    </div>
  )
}
