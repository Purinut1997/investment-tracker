'use client'

import React, { useState, useEffect } from 'react'
import useSWR, { mutate } from 'swr'
import Link from 'next/link'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/PageHeader'
import { DashboardEmptyState } from '@/components/DashboardEmptyState'
import { Sparkline } from '@/components/Sparkline'
import { StockLogo } from '@/components/StockLogo'
import {
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  ArrowRight,
  PieChart as PieIcon,
  Coins,
  Activity,
  RefreshCw,
  Check,
  ExternalLink,
  Radar,
  BarChart3,
  Calendar,
  TrendingUp,
  Layers,
} from 'lucide-react'
import { StockDetailModal } from '@/components/market-watch/StockDetailModal'
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts'
import { HealthScoreResult } from '@/lib/analytics/health-score'
import { HoldingItem } from '@/lib/analytics/holdings'
import { parseAccountsPayload } from '@/lib/accounts'
import CountUp from 'react-countup'

// Vibrant FinTech Palette for Portfolio Assets
const PIE_COLORS = [
  '#6366f1', // Indigo
  '#10b981', // Emerald
  '#06b6d4', // Cyan
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#8b5cf6', // Violet
  '#3b82f6', // Blue
  '#14b8a6', // Teal
  '#f97316', // Orange
  '#e11d48', // Rose
]

const CustomAreaTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="p-3.5 rounded-2xl glass-panel border border-slate-700/80 shadow-2xl text-xs space-y-2 min-w-[160px]">
        <p className="font-semibold text-slate-400 uppercase tracking-wider text-[10px]">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={`item-${index}`} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-slate-300">
              <span className="w-2 h-2 rounded-full shadow-sm" style={{ backgroundColor: entry.stroke || entry.color }} />
              <span className="font-medium">{entry.name}</span>
            </span>
            <span className="font-mono font-bold text-white tabular-nums">
              ฿{Number(entry.value).toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    )
  }
  return null
}

function DashboardLoadingState() {
  return (
    <AppShell>
      <div className="w-full max-w-5xl mx-auto min-h-[60vh] flex flex-col justify-center gap-6 animate-fade-in" aria-busy="true">
        <div className="h-8 w-64 rounded-lg bg-slate-800/80 animate-pulse" />
        <div className="h-4 w-96 max-w-full rounded bg-slate-800/60 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          {[1, 2, 3, 4].map((item) => <div key={item} className="h-36 rounded-2xl bg-slate-900/70 border border-slate-800 animate-pulse" />)}
        </div>
      </div>
    </AppShell>
  )
}

function DashboardErrorState() {
  return (
    <AppShell>
      <div className="w-full max-w-xl mx-auto min-h-[60vh] flex flex-col justify-center items-center text-center px-6">
        <AlertTriangle className="w-8 h-8 text-amber-400 mb-4" />
        <h1 className="text-xl font-semibold text-white">โหลดข้อมูลพอร์ตไม่สำเร็จ</h1>
        <p className="text-sm text-slate-400 mt-2 mb-6">ลองโหลดหน้านี้อีกครั้งเพื่อดึงข้อมูลล่าสุด</p>
        <button onClick={() => window.location.reload()} className="min-h-11 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold text-white">
          ลองอีกครั้ง
        </button>
      </div>
    </AppShell>
  )
}

export default function DashboardPage() {
  const [timeframe, setTimeframe] = useState('1M')
  const [selectedStock, setSelectedStock] = useState<{
    symbol: string
    name?: string
    market?: string
  } | null>(null)
  const [activePieIndex, setActivePieIndex] = useState<number | null>(null)
  // Stale-While-Revalidate Instant Paint (0ms LCP on repeat visits)
  const [cachedSummary, setCachedSummary] = useState<any>(() => {
    if (typeof window !== 'undefined') {
      try {
        const item = sessionStorage.getItem('port_summary_cache_v1')
        return item ? JSON.parse(item) : null
      } catch {
        return null
      }
    }
    return null
  })

  // Single Unified Fast SWR call for all core Dashboard data
  const { data: summaryRaw, error: summaryError, isLoading: sumLoading } = useSWR<any>(
    '/api/portfolio/summary',
    {
      refreshInterval: 60000,
      revalidateOnFocus: false,
      dedupingInterval: 15000,
      fallbackData: cachedSummary || undefined,
    }
  )

  const summary = summaryRaw || cachedSummary

  useEffect(() => {
    if (summaryRaw && typeof window !== 'undefined') {
      try {
        sessionStorage.setItem('port_summary_cache_v1', JSON.stringify(summaryRaw))
      } catch {}
    }
  }, [summaryRaw])

  // Non-blocking secondary widget: only fetch AI Radar AFTER summary has loaded
  const { data: radarData } = useSWR(
    summary ? '/api/radar' : null,
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  )

  const holdings: HoldingItem[] = Array.isArray(summary?.holdings) ? summary.holdings : []

  const accounts = parseAccountsPayload(summary?.accounts)
  const totalCash = summary?.totalCash ?? 0
  const totalValue = summary?.totalValue ?? 0
  const netWorth = summary?.netWorth ?? (totalValue + totalCash)
  const totalCost = summary?.totalCost ?? 0
  const unrealizedPnL = summary?.unrealizedPnL ?? 0
  const unrealizedPnLPercent = summary?.unrealizedPnLPercent ?? 0
  const totalRealizedGain = summary?.totalRealizedGain ?? 0
  const totalRealizedGainUSD = summary?.totalRealizedGainUSD ?? 0
  const totalDividends = summary?.totalDividends ?? 0
  const totalDividendsUSD = summary?.totalDividendsUSD ?? 0
  const healthScore: HealthScoreResult | null =
    summary?.healthScore && typeof summary.healthScore.score === 'number'
      ? summary.healthScore
      : null
  const isProfit = unrealizedPnL >= 0
  const todayPnL = summary?.todayPnL ?? 0
  const todayPnLPercent = summary?.todayPnLPercent ?? 0
  const isTodayProfit = todayPnL >= 0
  const upcomingCatalysts = Array.isArray(summary?.upcomingCatalysts) ? summary.upcomingCatalysts : []
  const marketPulse = summary?.marketPulse ?? null
  const assetClassAllocation = Array.isArray(summary?.assetClassAllocation) ? summary.assetClassAllocation : []
  const [allocationView, setAllocationView] = useState<'assets' | 'classes'>('assets')

  const hasAccounts = accounts.length > 0 || (summary?.accounts?.length ?? 0) > 0
  const hasHoldings = holdings.length > 0 || totalCost > 0
  const hasPlans = (summary?.presets?.length ?? 0) > 0
  const isInitialLoading = !summary && sumLoading
  const hasFatalError = Boolean(summaryError && !summary)

  const [refreshingPrices, setRefreshingPrices] = useState(false)
  const [refreshToast, setRefreshToast] = useState<{ title: string; desc: string } | null>(null)

  async function handleRefreshPrices() {
    setRefreshingPrices(true)
    try {
      const res = await fetch('/api/portfolio/refresh-prices', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to refresh prices')

      await mutate('/api/portfolio/summary')

      setRefreshToast({
        title: 'อัปเดตราคาล่าสุดเรียบร้อย!',
        desc: `ดึงราคาปิดตลาดล่าสุดของ ${data.updatedCount ?? 0} สินทรัพย์เรียบร้อยแล้ว`,
      })
      setTimeout(() => setRefreshToast(null), 4000)
    } catch (err: any) {
      alert(err.message || 'ไม่สามารถดึงราคาได้')
    } finally {
      setRefreshingPrices(false)
    }
  }

  if (isInitialLoading) {
    return <DashboardLoadingState />
  }

  if (hasFatalError) {
    return <DashboardErrorState />
  }

  if (!hasAccounts || !hasHoldings) {
    return (
      <DashboardEmptyState 
        hasAccounts={hasAccounts} 
        hasHoldings={hasHoldings} 
        hasPlans={hasPlans} 
      />
    )
  }

  // Extract target allocation per ticker from active preset if available
  const activePreset = summary?.activePreset || summary?.presets?.find((p: any) => p.isDefault) || summary?.presets?.[0]
  const subTargets = activePreset?.targetAllocation?._subTargets || activePreset?.subTargets || {}

  const targetMap: Record<string, number> = {}
  if (activePreset?.targetAllocation) {
    for (const [key, val] of Object.entries(activePreset.targetAllocation)) {
      if (key !== '_subTargets' && typeof val === 'number') {
        targetMap[key.toUpperCase()] = val
      }
    }
    for (const catKey of Object.keys(subTargets)) {
      const subs = subTargets[catKey]
      if (subs && typeof subs === 'object') {
        for (const [tKey, val] of Object.entries(subs)) {
          if (typeof val === 'number') {
            targetMap[tKey.toUpperCase()] = val
          }
        }
      }
    }
  }

  // Multi-colored asset allocation with target & deviation
  const allocationData = holdings.map((h, i) => {
    const tickerUpper = h.ticker.toUpperCase()
    const targetPercent = targetMap[tickerUpper] ?? null
    const actualPercent = Number(h.allocationPercent.toFixed(1))
    const deviation = targetPercent !== null ? Number((actualPercent - targetPercent).toFixed(1)) : null

    return {
      name: h.ticker,
      fullName: h.assetName || h.ticker,
      assetType: h.assetType || 'STOCK',
      market: h.market || 'US',
      value: Math.round(h.currentValueBase),
      percent: actualPercent,
      targetPercent,
      deviation,
      color: PIE_COLORS[i % PIE_COLORS.length],
    }
  })

  // Real performance milestones calculated from transactions vs S&P 500 benchmark
  const allPerformanceData: { month: string; value: number; benchmark: number }[] = Array.isArray(summary?.performanceData)
    ? summary.performanceData
    : []

  // Slice data according to selected timeframe
  // performanceData is monthly (1 point per month), so map timeframe -> month count
  const monthLimits: Record<string, number> = {
    '1D': 2,   // show latest 2 months (no daily data available)
    '1W': 2,   // show latest 2 months
    '1M': 3,   // show latest 3 months
    '6M': 6,   // show latest 6 months
    '1Y': 12,  // show latest 12 months
    'ALL': Infinity,
  }
  const limit = monthLimits[timeframe] ?? Infinity
  const performanceData = limit === Infinity
    ? allPerformanceData
    : allPerformanceData.slice(-limit)

  const isHighGrade = (healthScore?.score ?? 0) >= 80
  const isMidGrade  = (healthScore?.score ?? 0) >= 60

  return (
    <AppShell>
      <div className="flex flex-col gap-6 sm:gap-8 w-full max-w-[1600px] mx-auto animate-fade-in">
        
        {/* Top Header */}
        <PageHeader
          eyebrow="Portfolio Overview"
          title="ภาพรวมพอร์ตการลงทุน"
          description="มูลค่าสินทรัพย์ ผลตอบแทนรวม และรายการที่ต้องตรวจสอบจากธุรกรรมของคุณ"
          action={
            <div className="flex items-center gap-2">
              <Link
                href="/radar"
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-indigo-300 hover:text-white bg-indigo-600/15 hover:bg-indigo-600/25 border border-indigo-500/30 transition-all flex items-center gap-1.5 shadow-sm"
              >
                <Radar className="w-3.5 h-3.5 text-indigo-400" />
                <span>เรดาร์ความเสี่ยง AI</span>
              </Link>
              <button
                type="button"
                onClick={handleRefreshPrices}
                disabled={refreshingPrices}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-[#181C25] hover:bg-[#202532] border border-white/[0.1] transition-all flex items-center gap-1.5 disabled:opacity-50 shadow-sm"
                title="ดึงราคาปิดตลาดล่าสุดจาก Yahoo Finance และคำนวณกำไร/ขาดทุนใหม่"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${refreshingPrices ? 'animate-spin' : ''}`} />
                <span>{refreshingPrices ? 'กำลังดึงราคาล่าสุด...' : 'รีเฟรชราคาหุ้น'}</span>
              </button>
              <Link
                href="/plans"
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-[#181C25] hover:bg-[#202532] border border-white/[0.1] transition-all flex items-center gap-1.5"
              >
                <PieIcon className="w-3.5 h-3.5 text-indigo-400" />
                <span>แผนปรับพอร์ต</span>
              </Link>
            </div>
          }
        />

        {/* Deviation Alert (if any) */}
        {summary?.unackAlert && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start justify-between gap-3 text-amber-200 text-sm shadow-lg shadow-amber-500/5">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 shrink-0 mt-0.5">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <p className="font-semibold text-amber-300">สัดส่วนสินทรัพย์เบี่ยงเบนจากเป้าหมาย</p>
                <p className="text-xs text-amber-200/80 mt-0.5 leading-relaxed">
                  {summary.unackAlert.aiSummaryText || 'สัดส่วนบางสินทรัพย์เบี่ยงเบนเกินเกณฑ์ที่กำหนดในแผนการลงทุน'}
                </p>
              </div>
            </div>
            <Link
              href="/plans"
              className="px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 text-xs font-semibold hover:bg-amber-500/30 transition-colors shrink-0"
            >
              ตรวจสอบแผน
            </Link>
          </div>
        )}

        {/* ── TOP KPI CARDS ─────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
          {/* Main Portfolio Value (Hero) */}
          <div className="xl:col-span-2 glass-panel p-6 sm:p-7 rounded-2xl flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-bold tracking-wider uppercase text-indigo-400">มูลค่าพอร์ตการลงทุนรวม</span>
                <p className="text-xs text-slate-400 mt-0.5">Total Portfolio Net Worth</p>
              </div>
              <span className="text-[11px] px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700/80 text-slate-300 font-mono">
                THB (฿)
              </span>
            </div>

            <div className="my-5">
              <div className="flex items-baseline gap-3 flex-wrap">
                <p className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white tracking-tight leading-none font-mono tabular-nums">
                  ฿<CountUp end={netWorth} duration={1.2} separator="," decimals={2} />
                </p>

                {/* Today's Return Badge */}
                <div
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs sm:text-sm font-bold font-mono border ${
                    isTodayProfit
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                  }`}
                  title="ผลตอบแทนประจำวันคำนวณจากราคาปิดล่าสุดของสินทรัพย์ในพอร์ต"
                >
                  {isTodayProfit ? (
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  ) : (
                    <ArrowDownRight className="w-3.5 h-3.5" />
                  )}
                  <span>
                    วันนี้: {isTodayProfit ? '+' : ''}฿
                    {Math.abs(todayPnL).toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                  <span className="opacity-90">
                    ({isTodayProfit ? '+' : ''}
                    {todayPnLPercent.toFixed(2)}%)
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 mt-3">
                <span className="text-xs text-slate-400 font-mono tabular-nums">
                  สินทรัพย์: ฿{totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-slate-600">•</span>
                <Link
                  href="/accounts"
                  className="text-xs text-emerald-400 hover:text-emerald-300 font-mono tabular-nums flex items-center gap-1 transition-colors"
                >
                  <span>เงินสด: ฿{totalCash.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </Link>
                <span className="text-slate-600">•</span>
                <span className={`text-xs font-semibold flex items-center gap-0.5 ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {isProfit ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                  {unrealizedPnLPercent.toFixed(2)}% กำไรสะสม
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-800/80">
              <Link
                href="/forecast"
                className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" /> จำลองพยากรณ์พอร์ตด้วย AI <ArrowRight className="w-3 h-3" />
              </Link>
              <span className="text-[11px] text-slate-500 font-mono">{holdings.length} สินทรัพย์</span>
            </div>
          </div>

          {/* Unrealized P&L */}
          <div className="glass-panel p-6 rounded-2xl flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400">กำไร/ขาดทุน ทางบัญชี</span>
                <p className="text-xs text-slate-400 mt-0.5">Unrealized P&L</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-lg font-bold border flex items-center gap-1 ${
                isProfit
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                  : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
              }`}>
                {isProfit ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                {unrealizedPnLPercent.toFixed(2)}%
              </span>
            </div>

            <div className="my-4">
              <p className={`text-3xl sm:text-4xl font-bold tabular-nums tracking-tight leading-none font-mono ${
                isProfit ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                {isProfit ? '+' : ''}฿<CountUp end={Math.abs(unrealizedPnL)} duration={1.2} separator="," decimals={2} />
              </p>
              <p className="text-xs text-slate-400 mt-2">
                {isProfit ? 'มูลค่าตลาดสูงกว่าต้นทุน' : 'มูลค่าตลาดต่ำกว่าต้นทุน'}
              </p>
            </div>

            <div className="pt-3.5 border-t border-slate-800/80 flex items-center justify-between">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">เทรนด์สัปดาห์นี้</span>
              <Sparkline seed="portfolio-pnl" trend={isProfit ? 'up' : 'down'} width={80} height={22} />
            </div>
          </div>

          {/* Realized Gain & Dividends */}
          <div className="glass-panel p-6 rounded-2xl flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400">กำไรขายแล้ว + ปันผล</span>
                <p className="text-xs text-slate-400 mt-0.5">Cash Flow Realized (THB)</p>
              </div>
              <span className="w-8 h-8 rounded-xl bg-cyan-500/15 text-cyan-400 flex items-center justify-center">
                <Coins className="w-4 h-4" />
              </span>
            </div>

            <div className="my-4">
              <p className="text-3xl sm:text-4xl font-bold text-white tabular-nums tracking-tight leading-none font-mono">
                ฿<CountUp end={totalRealizedGain + totalDividends} duration={1.2} separator="," decimals={2} />
              </p>
              <div className="flex flex-col gap-1 mt-2">
                <span className="text-xs text-slate-400 tabular-nums">
                  เงินปันผลสะสม: ฿{totalDividends.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  {totalDividendsUSD > 0 && (
                    <span className="text-slate-500 ml-1">(${totalDividendsUSD.toFixed(2)} USD)</span>
                  )}
                </span>
                {totalRealizedGainUSD > 0 && (
                  <span className="text-xs text-slate-500 tabular-nums">
                    ยอดขายสะสม: ${totalRealizedGainUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
                  </span>
                )}
              </div>
            </div>

            <div className="pt-3.5 border-t border-slate-800/80 flex items-center justify-between">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">กระแสเงินสดรับ</span>
              <Sparkline seed="portfolio-dividend" trend="up" width={80} height={22} />
            </div>
          </div>

        </div>

        {/* ── TODAY'S MARKET INTELLIGENCE PULSE ────────────────── */}
        {marketPulse && (
          <div className="p-3.5 sm:px-5 sm:py-3 rounded-2xl bg-[#12151C] border border-white/[0.08] flex items-center justify-between gap-3 text-xs shadow-md hover:border-white/[0.15] transition-all">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span className="font-bold text-indigo-400 shrink-0">Market Pulse:</span>
              <span className="text-slate-300 truncate">
                {marketPulse.symbol ? <strong className="text-white font-mono mr-1">[{marketPulse.symbol}]</strong> : null}
                {marketPulse.headline}
              </span>
            </div>
            <Link
              href="/news"
              className="text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 shrink-0 text-xs transition-colors hover:underline"
            >
              <span>อ่านข่าวพอร์ต</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        )}

        {/* ── UPCOMING CATALYSTS STRIP (ปฏิทินปันผล & รายงานงบ 30 วัน) ──── */}
        {upcomingCatalysts.length > 0 && (
          <div className="p-4 rounded-2xl bg-[#12151C] border border-white/[0.08] flex flex-col md:flex-row md:items-center justify-between gap-3.5 shadow-lg">
            <div className="flex items-center gap-2.5 shrink-0">
              <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-white tracking-wide">
                  กำหนดการสำคัญที่กำลังจะมาถึง (Upcoming Catalysts)
                </span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  ปฏิทินขึ้นเครื่องหมาย XD เงินปันผล และรายงานผลประกอบการของหุ้นในพอร์ต
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {upcomingCatalysts.map((cat: any, idx: number) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#181C25] border border-white/[0.08] text-xs"
                >
                  <span className="font-bold font-mono text-indigo-300">{cat.symbol}</span>
                  <span className="text-slate-300">{cat.title.split('—')[1]?.trim() || cat.title}</span>
                  <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {cat.badge}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── AI RADAR & RISK SENTINEL QUICK WIDGET ─────────── */}
        {radarData?.riskReport && (
          <div className="rounded-3xl glass-panel p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl relative overflow-hidden border-indigo-500/20">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
            <div className="flex items-center gap-3.5 relative z-10">
              <div className="w-11 h-11 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0">
                <Radar className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white tracking-wide">
                    เรดาร์ความเสี่ยง & โอกาสลงทุน (AI Sentinel & Alpha Radar)
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    AI PRO
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1.5 text-xs text-slate-400">
                  <span className="flex items-center gap-1.5">
                    ระดับความเสี่ยง:
                    <strong className={`font-semibold px-2 py-0.5 rounded-md ${
                      radarData.riskReport.overallRiskLevel === 'CRITICAL' ? 'text-rose-400 bg-rose-500/10' :
                      radarData.riskReport.overallRiskLevel === 'ELEVATED' ? 'text-orange-400 bg-orange-500/10' :
                      radarData.riskReport.overallRiskLevel === 'MODERATE' ? 'text-amber-400 bg-amber-500/10' :
                      'text-emerald-400 bg-emerald-500/10'
                    }`}>
                      {radarData.riskReport.overallRiskLevel} ({radarData.riskReport.overallRiskScore}/100)
                    </strong>
                  </span>
                  <span className="text-slate-600">•</span>
                  <span>กระสุนเงินสด: <strong className="text-emerald-400 font-mono">฿{Number(radarData.totalCash || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong> ({radarData.riskReport.liquidity?.cashRatioPercent?.toFixed(1)}%)</span>
                  <span className="text-slate-600">•</span>
                  <span>โอกาสตรวจพบ: <strong className="text-white font-mono">{radarData.opportunityReport?.opportunities?.length ?? 0} รายการ</strong></span>
                </div>
              </div>
            </div>

            <Link
              href="/radar"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/25 transition-all active:scale-95 shrink-0 relative z-10"
            >
              <span>เปิดเรดาร์วิเคราะห์เต็มรูปแบบ</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}

        {/* ── MIDDLE ROW: RETURN CHART & ALLOCATION ─────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Chart (65%) */}
          <div className="lg:col-span-2 glass-panel rounded-3xl p-6 sm:p-7 flex flex-col">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-bold text-white">ผลการเติบโตของพอร์ตลงทุน</h2>
                  <span className="text-[11px] px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 font-medium">
                    vs SPX Benchmark
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  กราฟแสดงแนวโน้มมูลค่ารวมเปรียบเทียบกับดัชนีมาตรฐานตลาด
                </p>
              </div>

              {/* Timeframe Buttons */}
              <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800 self-start sm:self-auto">
                {['1D', '1W', '1M', '6M', '1Y', 'ALL'].map((tf) => (
                  <button
                    key={tf}
                    onClick={() => setTimeframe(tf)}
                    className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all ${
                      tf === timeframe
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>

            {performanceData.length > 1 ? (
              <div className="w-full flex-1 min-h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={performanceData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                    <defs>
                      <linearGradient id="portGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor="#6366f1" stopOpacity={0.4} />
                        <stop offset="90%"  stopColor="#6366f1" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="benchGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor="#64748b" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="#64748b" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="month" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} dy={8} />
                    <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`} />
                    <Tooltip content={<CustomAreaTooltip />} cursor={{ stroke: 'rgba(99, 102, 241, 0.4)', strokeWidth: 1.5, strokeDasharray: '4 4' }} />
                    <Area type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2.5} fillOpacity={1} fill="url(#portGrad)" name="พอร์ตของคุณ" />
                    <Area type="monotone" dataKey="benchmark" stroke="#64748b" strokeWidth={1.5} strokeDasharray="4 4" fillOpacity={1} fill="url(#benchGrad)" name="S&P 500" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-16">
                <Activity className="w-8 h-8 text-slate-600 mb-2" />
                <p className="text-sm font-semibold text-white">กำลังสร้างประวัติผลตอบแทน</p>
                <p className="text-xs text-slate-500 mt-1">ระบบจะแสดงแนวโน้มเมื่อมีข้อมูลมูลค่าพอร์ตตามช่วงเวลา</p>
              </div>
            )}
          </div>

          {/* Right Column: Health Score & Asset Allocation (35%) */}
          <div className="lg:col-span-1 flex flex-col gap-6">
            
            {/* Portfolio Health Score */}
            <div className="glass-panel rounded-3xl p-6 flex flex-col gap-4">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400">ดัชนีสุขภาพพอร์ต</span>
                  <p className="text-xs text-slate-400 mt-0.5">ระดับการกระจายความเสี่ยงของพอร์ต</p>
                </div>
                {healthScore ? (
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-xl border ${
                    isHighGrade
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      : isMidGrade
                      ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                      : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                  }`}>
                    ระดับ {healthScore.grade}
                  </span>
                ) : (
                  <span className="text-xs font-bold px-2.5 py-1 rounded-xl border bg-slate-800/80 text-slate-400 border-slate-700/80">
                    ยังไม่มีคะแนน
                  </span>
                )}
              </div>

              {healthScore ? (
                <>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold text-white tabular-nums tracking-tight font-mono">
                      {healthScore.score}
                    </span>
                    <span className="text-sm text-slate-500 font-mono">/ 100</span>
                  </div>

                  <div className="space-y-2">
                    <div className="w-full h-2 bg-slate-800/80 rounded-full overflow-hidden p-0.5">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isHighGrade ? 'bg-emerald-500' : isMidGrade ? 'bg-indigo-500' : 'bg-rose-500'
                        }`}
                        style={{ width: `${healthScore.score}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">ระดับการกระจายความเสี่ยง</span>
                      <span className={`font-semibold ${isHighGrade ? 'text-emerald-400' : isMidGrade ? 'text-indigo-400' : 'text-rose-400'}`}>
                        {isHighGrade ? 'สมดุลยอดเยี่ยม' : isMidGrade ? 'กระจายตัวดี' : 'กระจุกตัวสูง'}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="py-4">
                  <p className="text-2xl font-bold text-slate-500 font-mono">— / 100</p>
                  <p className="text-xs text-slate-400 mt-3 leading-relaxed">
                    โหลดข้อมูลพอร์ตสำเร็จ แต่ยังไม่มีคะแนนสุขภาพให้แสดง ระบบจะคำนวณเมื่อมีข้อมูลสินทรัพย์ครบ
                  </p>
                </div>
              )}
            </div>

            {/* Asset Allocation Donut - Hybrid FinTech Glow & Rebalance Sentinel */}
            <div className="glass-panel rounded-3xl p-6 flex flex-col justify-between relative overflow-hidden">
              {/* Header with Title, Badge, and View Mode Toggle */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400">สัดส่วนสินทรัพย์</span>
                    {activePreset && allocationView === 'assets' && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                        Target vs Actual
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">Asset Allocation</p>
                </div>
                
                <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                  {/* View Mode Segmented Control */}
                  <div className="flex bg-[#181C25] p-0.5 rounded-xl border border-white/[0.08] text-[10px]">
                    <button
                      type="button"
                      onClick={() => { setAllocationView('assets'); setActivePieIndex(null); }}
                      className={`px-2 py-0.5 rounded-lg font-semibold transition-all cursor-pointer ${
                        allocationView === 'assets'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      สินทรัพย์
                    </button>
                    <button
                      type="button"
                      onClick={() => { setAllocationView('classes'); setActivePieIndex(null); }}
                      className={`px-2 py-0.5 rounded-lg font-semibold transition-all cursor-pointer ${
                        allocationView === 'classes'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      หมวดหมู่
                    </button>
                  </div>

                  <Link
                    href="/plans"
                    className="text-[11px] font-medium text-indigo-300 hover:text-white transition-all flex items-center gap-1 bg-indigo-600/15 hover:bg-indigo-600/25 px-2.5 py-1 rounded-xl border border-indigo-500/30 shadow-sm"
                    title="ไปที่หน้าแผนการลงทุนเพื่อปรับสัดส่วนเป้าหมาย หรือจำลองการ Rebalance"
                  >
                    <span>ปรับแผน</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>

              {/* Glowing Dynamic Donut Chart */}
              <div className="h-44 w-full flex items-center justify-center relative my-2">
                {(allocationView === 'classes' ? assetClassAllocation : allocationData).length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={allocationView === 'classes' ? assetClassAllocation : allocationData}
                          innerRadius={50}
                          outerRadius={70}
                          paddingAngle={3}
                          cornerRadius={4}
                          dataKey="value"
                          stroke="none"
                          onMouseEnter={(_, index) => setActivePieIndex(index)}
                          onMouseLeave={() => setActivePieIndex(null)}
                        >
                          {(allocationView === 'classes' ? assetClassAllocation : allocationData).map((entry: any, index: number) => {
                            const isSelected = activePieIndex === index
                            return (
                              <Cell
                                key={`cell-${index}`}
                                fill={entry.color}
                                stroke={isSelected ? '#ffffff' : 'rgba(15, 23, 42, 0.8)'}
                                strokeWidth={isSelected ? 2.5 : 1}
                                style={{
                                  outline: 'none',
                                  cursor: 'pointer',
                                  transition: 'all 200ms ease',
                                  opacity: activePieIndex === null || isSelected ? 1 : 0.35,
                                  filter: isSelected ? `drop-shadow(0 0 8px ${entry.color})` : 'none',
                                }}
                              />
                            )
                          })}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>

                    {/* Dynamic Center Display */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4 transition-all duration-300">
                      {activePieIndex !== null && (allocationView === 'classes' ? assetClassAllocation : allocationData)[activePieIndex] ? (
                        <div className="animate-fade-in flex flex-col items-center">
                          <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400 max-w-[130px] truncate">
                            {(allocationView === 'classes' ? assetClassAllocation : allocationData)[activePieIndex].name}
                          </span>
                          <span className="text-2xl font-bold font-mono text-white tracking-tight leading-none mt-0.5">
                            {(allocationView === 'classes' ? assetClassAllocation : allocationData)[activePieIndex].percent}%
                          </span>
                          <span className="text-[11px] font-mono font-semibold text-indigo-300 mt-1">
                            ฿{(allocationView === 'classes' ? assetClassAllocation : allocationData)[activePieIndex].value.toLocaleString()}
                          </span>
                          {allocationView === 'assets' && (allocationData[activePieIndex] as any)?.deviation !== null && (
                            <span className={`text-[10px] font-semibold font-mono mt-0.5 px-1.5 py-0.2 rounded-md ${
                              (allocationData[activePieIndex] as any).deviation > 1.5
                                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                                : (allocationData[activePieIndex] as any).deviation < -1.5
                                ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                                : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                            }`}>
                              {(allocationData[activePieIndex] as any).deviation > 0
                                ? `+${(allocationData[activePieIndex] as any).deviation}%`
                                : `${(allocationData[activePieIndex] as any).deviation}%`} เป้า
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center">
                          <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
                            {allocationView === 'classes' ? 'มูลค่าพอร์ตรวม' : 'มูลค่าสินทรัพย์'}
                          </span>
                          <span className="text-xl font-bold text-white tabular-nums font-mono leading-tight mt-0.5">
                            ฿{Math.round(allocationView === 'classes' ? netWorth : totalValue).toLocaleString()}
                          </span>
                          <span className="text-[11px] text-indigo-300 font-medium font-mono mt-0.5">
                            {(allocationView === 'classes' ? assetClassAllocation : allocationData).length} {allocationView === 'classes' ? 'หมวดหมู่' : 'รายการ'}
                          </span>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-slate-500 font-medium">ไม่มีข้อมูลสินทรัพย์</div>
                )}
              </div>

              {/* Asset List & Rebalance Indicators */}
              <div className="mt-2 pt-3 border-t border-slate-800/80">
                <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2 px-1">
                  <span>{allocationView === 'classes' ? 'หมวดหมู่สินทรัพย์' : 'สินทรัพย์ / ประเภท'}</span>
                  <span>สัดส่วน & มูลค่า</span>
                </div>

                {allocationView === 'classes' ? (
                  <div className="space-y-1.5 max-h-[260px] overflow-y-auto pr-1">
                    {assetClassAllocation.map((item: any, i: number) => {
                      const isActive = activePieIndex === i
                      return (
                        <div
                          key={item.name}
                          onMouseEnter={() => setActivePieIndex(i)}
                          onMouseLeave={() => setActivePieIndex(null)}
                          className={`p-2.5 rounded-xl transition-all border ${
                            isActive
                              ? 'bg-slate-800/90 border-slate-700 shadow-lg scale-[1.01]'
                              : 'bg-slate-900/40 hover:bg-slate-800/50 border-white/[0.04]'
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs mb-1.5">
                            <div className="flex items-center gap-2">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: item.color }}
                              />
                              <span className="font-bold text-slate-100">{item.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-semibold text-slate-300">
                                ฿{item.value.toLocaleString()}
                              </span>
                              <span
                                className="font-mono text-xs font-bold px-1.5 py-0.5 rounded"
                                style={{ backgroundColor: `${item.color}22`, color: item.color }}
                              >
                                {item.percent}%
                              </span>
                            </div>
                          </div>
                          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-300"
                              style={{ width: `${Math.min(item.percent, 100)}%`, backgroundColor: item.color }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-[260px] overflow-y-auto pr-1">
                    {allocationData.map((item, i) => {
                      const isActive = activePieIndex === i
                      return (
                        <div
                          key={item.name}
                          onMouseEnter={() => setActivePieIndex(i)}
                          onMouseLeave={() => setActivePieIndex(null)}
                          onClick={() => setSelectedStock({ symbol: item.name, name: item.fullName, market: item.market })}
                          className={`p-2 rounded-xl transition-all cursor-pointer border ${
                            isActive
                              ? 'bg-slate-800/90 border-slate-700 shadow-lg scale-[1.01]'
                              : 'bg-slate-900/40 hover:bg-slate-800/50 border-white/[0.04] hover:border-slate-700/60'
                          }`}
                          title="คลิกเพื่อดูรายละเอียดและกราฟเทคนิค"
                        >
                          <div className="flex items-center justify-between text-xs mb-1.5">
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0 transition-all"
                                style={{
                                  backgroundColor: item.color,
                                  boxShadow: isActive ? `0 0 10px ${item.color}` : 'none',
                                }}
                              />
                              <span className="font-bold text-slate-100 truncate">{item.name}</span>
                              <span className="text-[9px] px-1.5 py-0.5 rounded font-mono font-semibold bg-slate-800 text-slate-400 border border-slate-700/50">
                                {item.assetType}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span className="font-mono text-xs font-semibold text-slate-300">
                                ฿{item.value.toLocaleString()}
                              </span>
                              <span
                                className="font-mono text-xs font-bold px-1.5 py-0.5 rounded"
                                style={{
                                  backgroundColor: `${item.color}22`,
                                  color: item.color,
                                }}
                              >
                                {item.percent}%
                              </span>
                            </div>
                          </div>

                          {/* Progress Bar with Target Indicator */}
                          <div className="relative w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-300"
                              style={{
                                width: `${Math.min(item.percent, 100)}%`,
                                backgroundColor: item.color,
                              }}
                            />
                            {item.targetPercent !== null && (
                              <div
                                className="absolute top-0 bottom-0 w-1 bg-white rounded-full shadow-sm z-10"
                                style={{ left: `calc(${Math.min(item.targetPercent, 100)}% - 2px)` }}
                                title={`เป้าหมาย: ${item.targetPercent}%`}
                              />
                            )}
                          </div>

                          {/* Target vs Actual Deviation Footer */}
                          {item.targetPercent !== null && (
                            <div className="flex items-center justify-between text-[10px] mt-1 font-mono">
                              <span className="text-slate-400">เป้า {item.targetPercent}%</span>
                              <span
                                className={`font-semibold ${
                                  item.deviation! > 1.5
                                    ? 'text-amber-400'
                                    : item.deviation! < -1.5
                                    ? 'text-rose-400'
                                    : 'text-emerald-400'
                                }`}
                              >
                                {item.deviation! > 1.5
                                  ? `+${item.deviation}% เกินเป้า`
                                  : item.deviation! < -1.5
                                  ? `${item.deviation}% ต่ำกว่าเป้า`
                                  : 'สมดุลตามแผน'}
                              </span>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* ── BOTTOM ROW: HOLDINGS TABLE ─────────────────────── */}
        <div className="glass-panel rounded-3xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 bg-slate-900/40">
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3 className="text-sm sm:text-base font-bold text-white tracking-wide">สินทรัพย์ที่ถือครองในพอร์ต (Holdings)</h3>
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-300 bg-indigo-500/15 border border-indigo-500/30 px-2 py-0.5 rounded-full">
                  💡 คลิกที่รายการเพื่อดูการ์ดหุ้น & กราฟเทคนิค
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">แสดงรายการสินทรัพย์ ต้นทุน ราคาปิดตลาดล่าสุด และกำไรขาดทุนสะสม</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
              <Link
                href="/performance"
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-indigo-300 hover:text-white bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 transition-all flex items-center gap-1.5 shadow-sm"
                title="ดูผลตอบแทนตลอดชีพ แยกส่วนที่ขายแล้วและยังถืออยู่"
              >
                <BarChart3 className="w-3.5 h-3.5 text-indigo-400" />
                <span>สรุปกำไรรายตัว (P&L)</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
              <button
                type="button"
                onClick={handleRefreshPrices}
                disabled={refreshingPrices}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 transition-all flex items-center gap-1.5 disabled:opacity-50"
                title="ดึงราคาปิดตลาดล่าสุดจาก Yahoo Finance"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${refreshingPrices ? 'animate-spin' : ''}`} />
                <span>{refreshingPrices ? 'กำลังดึงราคา...' : 'รีเฟรชราคาล่าสุด'}</span>
              </button>
              <Link
                href="/transactions"
                className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1.5"
              >
                ประวัติทั้งหมด <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {holdings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-sm font-semibold text-white mb-1">ยังไม่มีสินทรัพย์ในพอร์ต</p>
              <p className="text-xs text-slate-400 max-w-xs mb-4">เริ่มต้นสร้างพอร์ตโดยการเพิ่มรายการซื้อขายแรกของคุณ</p>
              <Link
                href="/transactions"
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors"
              >
                เพิ่มธุรกรรม
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="custom-table text-left">
                <thead>
                  <tr>
                    <th className="!text-xs !font-bold !text-slate-300">สินทรัพย์</th>
                    <th className="hidden sm:table-cell !text-xs !font-bold !text-slate-300">ตลาด</th>
                    <th className="text-center hidden md:table-cell !text-xs !font-bold !text-slate-300">แนวโน้ม</th>
                    <th className="text-right !text-xs !font-bold !text-slate-300">จำนวน</th>
                    <th className="text-right hidden lg:table-cell !text-xs !font-bold !text-slate-300">ต้นทุนเฉลี่ย</th>
                    <th className="text-right !text-xs !font-bold !text-slate-300">ราคาปัจจุบัน</th>
                    <th className="text-right !text-xs !font-bold !text-slate-300">มูลค่ารวม</th>
                    <th className="text-right hidden sm:table-cell !text-xs !font-bold !text-slate-300">กำไร/ขาดทุน</th>
                  </tr>
                </thead>
                <tbody>
                  {holdings.map((h) => {
                    const isUsd = h.currency === 'USD' || h.market === 'US'
                    const sym = isUsd ? '$' : '฿'
                    const hProfit = (h.unrealizedPnLBase ?? h.unrealizedPnL) >= 0
                    return (
                      <tr 
                        key={h.assetId} 
                        onClick={() => setSelectedStock({
                          symbol: h.ticker,
                          name: h.assetName,
                          market: h.market || (isUsd ? 'US' : 'TH')
                        })}
                        className="transition-all duration-150 group cursor-pointer hover:bg-indigo-950/25 border-b border-slate-800/40"
                        title={`คลิกเพื่อดูการ์ดหุ้นและกราฟเทคนิค ${h.ticker}`}
                      >
                        <td>
                          <div className="flex items-center gap-3">
                            <StockLogo ticker={h.ticker} name={h.assetName} size={38} />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-sm sm:text-base text-white group-hover:text-indigo-300 transition-colors tracking-tight">
                                  {h.ticker}
                                </span>
                                <span className="hidden group-hover:inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-300 bg-indigo-500/20 border border-indigo-500/30 px-1.5 py-0.5 rounded transition-all">
                                  การ์ดหุ้น <ExternalLink className="w-2.5 h-2.5" />
                                </span>
                              </div>
                              <div className="text-xs text-slate-300 truncate max-w-[150px] sm:max-w-[200px] mt-0.5 font-medium">
                                {h.assetName}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="hidden sm:table-cell">
                          <span className={`text-xs font-mono font-bold uppercase px-2.5 py-1 rounded-md border ${
                            isUsd ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30' : 'bg-slate-800/80 text-slate-300 border-slate-700/60'
                          }`}>
                            {h.market || (isUsd ? 'US' : 'TH')}
                          </span>
                        </td>
                        <td className="text-center hidden md:table-cell">
                          <div className="flex justify-center">
                            <Sparkline seed={h.ticker} trend={hProfit ? 'up' : 'down'} width={60} height={20} />
                          </div>
                        </td>
                        <td className="text-right font-mono text-sm font-semibold text-slate-100" title={String(h.quantity)}>
                          {Number(h.quantity).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 4 })}
                        </td>
                        <td className="text-right font-mono text-sm font-semibold text-slate-200 hidden lg:table-cell" title={`${sym}${Number(h.avgCost).toFixed(4)}`}>
                          {sym}{Number(h.avgCost).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                        </td>
                        <td className="text-right font-mono">
                          <div className="text-sm sm:text-base text-white font-bold">
                            {sym}{Number(h.currentPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          {(h as any).todayChangePercent !== undefined && (
                            <div className={`text-[11px] font-semibold flex items-center justify-end gap-0.5 mt-0.5 ${
                              (h as any).todayChangePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}>
                              {(h as any).todayChangePercent >= 0 ? '+' : ''}
                              {(h as any).todayChangePercent.toFixed(2)}% วันนี้
                            </div>
                          )}
                        </td>
                        <td className="text-right font-mono">
                          <div className="text-sm sm:text-base font-extrabold text-white">
                            ฿{Number(h.currentValueBase).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          {isUsd && (
                            <div className="text-xs text-indigo-400 font-semibold mt-0.5">
                              ${Number(h.currentValue).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          )}
                        </td>
                        <td className="text-right font-mono hidden sm:table-cell">
                          {/* Main Profit/Loss Amount - prominent font and bright green/red */}
                          <div className={`text-sm sm:text-base font-extrabold tracking-tight ${
                            hProfit ? 'text-emerald-400 !text-emerald-400' : 'text-rose-400 !text-rose-400'
                          }`}>
                            {hProfit ? '+' : ''}{sym}{Number(h.unrealizedPnL).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          {/* Percentage badge and converted THB amount */}
                          <div className="mt-1 flex items-center justify-end gap-1.5 flex-wrap">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold border ${
                              hProfit
                                ? 'bg-emerald-500/15 text-emerald-300 !text-emerald-300 border-emerald-500/30'
                                : 'bg-rose-500/15 text-rose-300 !text-rose-300 border-rose-500/30'
                            }`}>
                              {hProfit ? '+' : ''}{h.unrealizedPnLPercent.toFixed(2)}%
                            </span>
                            {isUsd && (
                              <span className={`text-xs font-semibold ${
                                hProfit ? 'text-emerald-400/90 !text-emerald-400/90' : 'text-rose-400/90 !text-rose-400/90'
                              }`}>
                                (≈ {hProfit ? '+' : ''}฿{Number(h.unrealizedPnLBase).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Floating Toast for Refresh Notification */}
        {refreshToast && (
          <div className="fixed bottom-6 right-6 z-50 p-4 rounded-2xl bg-[#131722]/95 border border-emerald-500/40 shadow-2xl backdrop-blur-md flex items-center gap-3 animate-in fade-in slide-in-from-bottom-5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
              <Check className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-white">{refreshToast.title}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">{refreshToast.desc}</p>
            </div>
          </div>
        )}

        {/* Interactive Stock Detail & Technical Insights Modal */}
        <StockDetailModal
          isOpen={Boolean(selectedStock)}
          onClose={() => setSelectedStock(null)}
          symbol={selectedStock?.symbol ?? null}
          initialName={selectedStock?.name}
          market={selectedStock?.market}
        />

      </div>
    </AppShell>
  )
}
