'use client'

import React, { useState, useEffect } from 'react'
import useSWR, { mutate } from 'swr'
import Link from 'next/link'
import { AppShell } from '@/components/AppShell'
import { DashboardEmptyState } from '@/components/DashboardEmptyState'
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
  TrendingUp,
  ShieldCheck,
  Wallet,
  Target,
  Zap,
  Plus,
  Sunrise,
} from 'lucide-react'
import { MorningBriefBanner } from '@/components/dashboard/MorningBriefBanner'
import { StockDetailModal } from '@/components/market-watch/StockDetailModal'
import { QuickAddModal } from '@/components/QuickAddModal'
import {
  extractStrategyBuckets,
  computeBucketsWithHoldings,
  STRATEGY_TYPE_META,
} from '@/lib/analytics/strategy-buckets'
import { TechnicalSignal } from '@/lib/market-data/technical-signals'
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
  CartesianGrid,
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

const BUCKET_BAR_COLORS: Record<string, string> = {
  LONG_TERM: '#6366f1',
  DIVIDEND: '#10b981',
  SHORT_TERM: '#f59e0b',
  CASH: '#06b6d4',
  CUSTOM: '#ec4899',
}

const CustomAreaTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="p-3.5 rounded-2xl bg-[#141822]/95 backdrop-blur-xl border border-white/[0.12] shadow-2xl text-xs space-y-2 min-w-[170px]">
        <p className="font-semibold text-slate-400 uppercase tracking-wider text-[10px]">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={`item-${index}`} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-slate-300">
              <span
                className="w-2 h-2 rounded-full shadow-sm"
                style={{ backgroundColor: entry.stroke || entry.color }}
              />
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
      <div
        className="w-full max-w-[1600px] mx-auto min-h-[60vh] flex flex-col justify-center gap-6 animate-fade-in"
        aria-busy="true"
      >
        <div className="h-8 w-64 rounded-lg bg-slate-800/80 animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-6 h-52 rounded-3xl bg-slate-900/70 border border-slate-800 animate-pulse" />
          <div className="lg:col-span-3 h-52 rounded-3xl bg-slate-900/70 border border-slate-800 animate-pulse" />
          <div className="lg:col-span-3 h-52 rounded-3xl bg-slate-900/70 border border-slate-800 animate-pulse" />
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
        <button
          onClick={() => window.location.reload()}
          className="min-h-11 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold text-white cursor-pointer"
        >
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
  const [quickTradeData, setQuickTradeData] = useState<{
    ticker: string
    action: 'BUY' | 'SELL'
    market?: 'US' | 'TH'
    price?: number
  } | null>(null)
  const [selectedBucketFilter, setSelectedBucketFilter] = useState<string>('ALL')
  const [activePieIndex, setActivePieIndex] = useState<number | null>(null)
  const [allocationView, setAllocationView] = useState<'assets' | 'classes'>('assets')

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

  const { data: radarData } = useSWR(summary ? '/api/radar' : null, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  })

  const holdings: HoldingItem[] = Array.isArray(summary?.holdings) ? summary.holdings : []
  const holdingTickersParam = holdings.map((h) => h.ticker.toUpperCase()).join(',')
  const { data: techSignalsData } = useSWR<{ signals: Record<string, TechnicalSignal> }>(
    holdingTickersParam
      ? `/api/market-data/technical-signals?tickers=${holdingTickersParam}`
      : null,
    { revalidateOnFocus: false, dedupingInterval: 120000 }
  )
  const techSignals = techSignalsData?.signals || {}

  const accounts = parseAccountsPayload(summary?.accounts)
  const totalCash = summary?.totalCash ?? 0
  const totalValue = summary?.totalValue ?? 0
  const netWorth = summary?.netWorth ?? totalValue + totalCash
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
  const upcomingCatalysts = Array.isArray(summary?.upcomingCatalysts)
    ? summary.upcomingCatalysts
    : []
  const marketPulse = summary?.marketPulse ?? null
  const assetClassAllocation = Array.isArray(summary?.assetClassAllocation)
    ? summary.assetClassAllocation
    : []

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

  // Extract target allocation & strategy buckets
  const activePreset =
    summary?.activePreset ||
    summary?.presets?.find((p: any) => p.isDefault) ||
    summary?.presets?.[0]
  const subTargets =
    activePreset?.targetAllocation?._subTargets || activePreset?.subTargets || {}
  const strategyBuckets = extractStrategyBuckets(activePreset?.targetAllocation, holdings)
  const { computedBuckets, tickerToBucketMap } = computeBucketsWithHoldings(
    strategyBuckets,
    holdings,
    totalCash,
    netWorth
  )

  // Compute actionable signals today
  const actionableSignalsToday = holdings
    .map((h) => {
      const sym = h.ticker.toUpperCase()
      const sig = techSignals[sym]
      const bucket = tickerToBucketMap[sym]
      const pnl = Number(h.unrealizedPnLPercent || 0)
      const isShortTerm = bucket?.strategyType === 'SHORT_TERM'
      const tp = bucket?.takeProfitPercent ?? 15
      const sl = bucket?.stopLossPercent ?? 8

      if (isShortTerm && pnl >= tp) {
        return {
          ticker: sym,
          holding: h,
          bucket,
          sig,
          type: 'TAKE_PROFIT' as const,
          badge: `🎯 ถึงเป้าทำกำไร (+${pnl.toFixed(1)}%)`,
          reason: `อยู่ในตะกร้า "${bucket.name}" กำไรทะลุเป้า +${tp}% ${
            sig?.resistanceR1
              ? `(แนวต้าน R1: ${h.currency === 'USD' ? '$' : '฿'}${sig.resistanceR1.toFixed(2)})`
              : ''
          }`,
          recommendedAction: 'SELL' as const,
          priority: 100,
        }
      }
      if (isShortTerm && pnl <= -sl) {
        return {
          ticker: sym,
          holding: h,
          bucket,
          sig,
          type: 'STOP_LOSS' as const,
          badge: `🛡️ เตือนจุด Stop Loss (${pnl.toFixed(1)}%)`,
          reason: `ขาดทุนแตะเกณฑ์ -${sl}% ในตะกร้าเก็งสั้น ควรเช็กแนวรับ S1 ก่อนตัดสินใจ`,
          recommendedAction: 'SELL' as const,
          priority: 95,
        }
      }
      if (sig?.signalType === 'STRONG_DIP_BUY' || sig?.isNearSupport || sig?.isOversold) {
        return {
          ticker: sym,
          holding: h,
          bucket,
          sig,
          type: 'DIP_BUY' as const,
          badge: sig.badgeText || '🔥 ทดสอบแนวรับสำคัญ',
          reason: `ราคาปัจจุบัน ${h.currency === 'USD' ? '$' : '฿'}${Number(
            h.currentPrice
          ).toFixed(2)} ${
            sig.supportS1
              ? `ใกล้แนวรับ S1 (${h.currency === 'USD' ? '$' : '฿'}${sig.supportS1.toFixed(2)})`
              : ''
          } ${sig.rsi14 ? `• RSI ${sig.rsi14.toFixed(1)}` : ''}`,
          recommendedAction: 'BUY' as const,
          priority: 90,
        }
      }
      if (sig?.isOverbought) {
        return {
          ticker: sym,
          holding: h,
          bucket,
          sig,
          type: 'OVERBOUGHT' as const,
          badge: `⚠️ RSI Overbought (${sig.rsi14?.toFixed(0)})`,
          reason: `ราคาปรับขึ้นร้อนแรงระยะสั้น แนะนำชะลอซื้อไล่ราคา หรือแบ่งล็อกกำไร`,
          recommendedAction: 'SELL' as const,
          priority: 75,
        }
      }
      return null
    })
    .filter(Boolean)
    .sort((a, b) => (b?.priority || 0) - (a?.priority || 0))
    .slice(0, 4)

  const filteredHoldings =
    selectedBucketFilter === 'ALL'
      ? holdings
      : holdings.filter(
          (h) => tickerToBucketMap[h.ticker.toUpperCase()]?.id === selectedBucketFilter
        )

  // Find best performer in portfolio for quick insight
  const topGainerHolding =
    holdings.length > 0
      ? [...holdings].sort(
          (a, b) => Number(b.unrealizedPnLPercent || 0) - Number(a.unrealizedPnLPercent || 0)
        )[0]
      : null

  const investedRatioPercent =
    netWorth > 0 ? Math.min(100, Math.max(0, (totalValue / netWorth) * 100)) : 0
  const cashRatioPercent =
    netWorth > 0 ? Math.min(100, Math.max(0, (totalCash / netWorth) * 100)) : 0

  const totalCashFlowRealized = totalRealizedGain + totalDividends
  const dividendShareOfCashFlow =
    totalCashFlowRealized > 0
      ? Math.min(100, Math.max(0, (totalDividends / totalCashFlowRealized) * 100))
      : 50

  const targetMap: Record<string, number> = {}
  if (activePreset?.targetAllocation) {
    for (const [key, val] of Object.entries(activePreset.targetAllocation)) {
      if (key !== '_subTargets' && key !== '_buckets' && typeof val === 'number') {
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

  const allocationData = holdings.map((h, i) => {
    const tickerUpper = h.ticker.toUpperCase()
    const targetPercent = targetMap[tickerUpper] ?? null
    const actualPercent = Number(h.allocationPercent.toFixed(1))
    const deviation =
      targetPercent !== null ? Number((actualPercent - targetPercent).toFixed(1)) : null

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

  const allPerformanceData: { month: string; value: number; benchmark: number }[] =
    Array.isArray(summary?.performanceData) ? summary.performanceData : []

  const monthLimits: Record<string, number> = {
    '1D': 2,
    '1W': 2,
    '1M': 3,
    '6M': 6,
    '1Y': 12,
    ALL: Infinity,
  }
  const limit = monthLimits[timeframe] ?? Infinity
  const performanceData =
    limit === Infinity ? allPerformanceData : allPerformanceData.slice(-limit)

  const isHighGrade = (healthScore?.score ?? 0) >= 80
  const isMidGrade = (healthScore?.score ?? 0) >= 60

  return (
    <AppShell>
      <div className="flex flex-col gap-5 sm:gap-6 w-full max-w-[1600px] mx-auto animate-fade-in pb-12">
        {/* ── HEADER BAR WITH LIVE STATUS & QUICK ACTIONS ───────────── */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-1">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Wealth Command Center
              </span>
              {healthScore && (
                <span
                  className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                    isHighGrade
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                      : isMidGrade
                      ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                      : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                  }`}
                >
                  สุขภาพพอร์ต: เกรด {healthScore.grade} ({healthScore.score}/100)
                </span>
              )}
              {radarData?.riskReport && (
                <Link
                  href="/radar"
                  className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 border border-white/[0.08] transition-colors flex items-center gap-1.5"
                >
                  <Radar className="w-3 h-3 text-indigo-400" />
                  <span>
                    ความเสี่ยงพอร์ต:{' '}
                    <strong className="text-white">{radarData.riskReport.overallRiskLevel}</strong>
                  </span>
                </Link>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              ภาพรวมพอร์ต & สัญญาณลงทุนวันนี้
            </h1>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleRefreshPrices}
              disabled={refreshingPrices}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-200 hover:text-white bg-[#151923] hover:bg-[#1C2230] border border-white/[0.1] transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-sm"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-emerald-400 ${refreshingPrices ? 'animate-spin' : ''}`}
              />
              <span>{refreshingPrices ? 'กำลังดึงราคาล่าสุด...' : 'รีเฟรชราคาหุ้น'}</span>
            </button>

            <Link
              href="/daily-plan"
              className="px-3.5 py-2 rounded-xl text-xs font-semibold text-amber-200 hover:text-white bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 transition-all flex items-center gap-1.5 shadow-sm"
            >
              <Sunrise className="w-3.5 h-3.5 text-amber-400" />
              <span>สรุปเช้า AI & แผนรายวัน</span>
            </Link>

            <Link
              href="/radar"
              className="px-3.5 py-2 rounded-xl text-xs font-semibold text-indigo-200 hover:text-white bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 transition-all flex items-center gap-1.5 shadow-sm"
            >
              <Radar className="w-3.5 h-3.5 text-indigo-400" />
              <span>เรดาร์ความเสี่ยง AI</span>
            </Link>

            <Link
              href="/plans"
              className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 transition-all flex items-center gap-1.5 shadow-lg shadow-indigo-600/25"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>จัดตะกร้าพอร์ต & ถาม AI</span>
            </Link>
          </div>
        </div>

        {/* Deviation Alert (if any) */}
        {summary?.unackAlert && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3 text-amber-200 text-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <p className="font-semibold text-amber-300 text-xs sm:text-sm">
                  สัดส่วนสินทรัพย์เบี่ยงเบนจากเป้าหมาย
                </p>
                <p className="text-xs text-amber-200/80 mt-0.5">
                  {summary.unackAlert.aiSummaryText ||
                    'สัดส่วนบางสินทรัพย์เบี่ยงเบนเกินเกณฑ์ที่กำหนดในแผนการลงทุน'}
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

        {/* ── DAILY MORNING AI BRIEFING QUICK ACCESS BANNER ─────────── */}
        <MorningBriefBanner />

        {/* ── 1. HERO WEALTH KPI ROW (12-COLUMN BENTO GRID) ───────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
          {/* Card 1: Total Net Worth Hero (6 Columns) */}
          <div className="lg:col-span-6 rounded-3xl bg-gradient-to-br from-[#161B28] via-[#121620] to-[#0F131C] border border-white/[0.09] p-6 sm:p-7 relative overflow-hidden shadow-2xl shadow-black/40 flex flex-col justify-between">
            <div className="absolute -top-20 -right-20 w-72 h-72 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 flex items-start justify-between gap-3">
              <div>
                <span className="text-xs font-bold tracking-wider uppercase text-indigo-400 flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5" />
                  มูลค่าพอร์ตการลงทุนสุทธิ (Total Net Worth)
                </span>
                <p className="text-xs text-slate-400 mt-0.5">
                  รวมมูลค่าหุ้นตามราคาตลาดล่าสุด + เงินสดสำรองในพอร์ต
                </p>
              </div>
              <span className="text-xs px-3 py-1 rounded-full bg-white/[0.06] border border-white/[0.1] text-slate-200 font-mono font-semibold">
                THB (฿)
              </span>
            </div>

            <div className="relative z-10 my-5">
              <div className="flex items-baseline gap-3.5 flex-wrap">
                <p className="text-4xl sm:text-5xl font-black text-white tracking-tight leading-none font-mono tabular-nums">
                  ฿<CountUp end={netWorth} duration={1.1} separator="," decimals={2} />
                </p>

                {/* Today's Change Pill */}
                <div
                  className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold font-mono border ${
                    isTodayProfit
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                      : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                  }`}
                >
                  {isTodayProfit ? (
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  ) : (
                    <ArrowDownRight className="w-3.5 h-3.5" />
                  )}
                  <span>
                    วันนี้ {isTodayProfit ? '+' : ''}฿
                    {Math.abs(todayPnL).toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{' '}
                    ({isTodayProfit ? '+' : ''}
                    {todayPnLPercent.toFixed(2)}%)
                  </span>
                </div>
              </div>

              {/* Invested vs Cash Visual Split Bar */}
              <div className="mt-5 space-y-2">
                <div className="w-full h-2.5 rounded-full bg-[#0B0E14] overflow-hidden flex p-0.5 border border-white/[0.06]">
                  <div
                    className="h-full rounded-l-full bg-gradient-to-r from-indigo-500 to-violet-400 transition-all duration-500"
                    style={{ width: `${investedRatioPercent}%` }}
                    title={`สินทรัพย์ลงทุน: ${investedRatioPercent.toFixed(1)}%`}
                  />
                  <div
                    className="h-full rounded-r-full bg-emerald-400/85 transition-all duration-500"
                    style={{ width: `${cashRatioPercent}%` }}
                    title={`เงินสดสำรอง: ${cashRatioPercent.toFixed(1)}%`}
                  />
                </div>

                <div className="flex items-center justify-between text-xs font-mono flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" />
                    <span className="text-slate-300">
                      สินทรัพย์ลงทุน ({ holdings.length } ตัว):{' '}
                      <strong className="text-white">
                        ฿{totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </strong>{' '}
                      <span className="text-indigo-300">({investedRatioPercent.toFixed(1)}%)</span>
                    </span>
                  </div>

                  <Link
                    href="/accounts"
                    className="flex items-center gap-2 hover:underline text-emerald-300"
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />
                    <span>
                      เงินสดสำรอง:{' '}
                      <strong className="text-emerald-300">
                        ฿{totalCash.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </strong>{' '}
                      ({cashRatioPercent.toFixed(1)}%)
                    </span>
                  </Link>
                </div>
              </div>
            </div>

            <div className="relative z-10 pt-3.5 border-t border-white/[0.07] flex items-center justify-between gap-2 flex-wrap text-xs">
              <Link
                href="/forecast"
                className="font-semibold text-indigo-300 hover:text-white flex items-center gap-1.5 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span>จำลองพยากรณ์อนาคตพอร์ตด้วย AI</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
              <Link
                href="/plans"
                className="text-slate-400 hover:text-slate-200 font-medium flex items-center gap-1 transition-colors"
              >
                <span>จัดพอร์ต &amp; ปรับสมดุล</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>

          {/* Card 2: Unrealized P&L & Cost Comparison (3 Columns) */}
          <div className="lg:col-span-3 rounded-3xl bg-[#121620] border border-white/[0.08] p-6 flex flex-col justify-between shadow-xl shadow-black/30 relative overflow-hidden">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-xs font-bold tracking-wider uppercase text-slate-300">
                  กำไร/ขาดทุนสะสม (ถือครอง)
                </span>
                <p className="text-[11px] text-slate-400 mt-0.5">Unrealized P&amp;L</p>
              </div>
              <span
                className={`text-xs px-2.5 py-1 rounded-xl font-bold font-mono border flex items-center gap-1 ${
                  isProfit
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                }`}
              >
                {isProfit ? (
                  <ArrowUpRight className="w-3.5 h-3.5" />
                ) : (
                  <ArrowDownRight className="w-3.5 h-3.5" />
                )}
                {isProfit ? '+' : ''}
                {unrealizedPnLPercent.toFixed(2)}%
              </span>
            </div>

            <div className="my-4 space-y-3">
              <p
                className={`text-3xl sm:text-4xl font-black tabular-nums tracking-tight leading-none font-mono ${
                  isProfit ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {isProfit ? '+' : '-'}฿
                <CountUp end={Math.abs(unrealizedPnL)} duration={1.1} separator="," decimals={2} />
              </p>

              {/* Cost Basis vs Current Market Value Mini Card */}
              <div className="p-3 rounded-2xl bg-[#171C28] border border-white/[0.06] space-y-1.5 text-xs font-mono">
                <div className="flex items-center justify-between text-slate-400">
                  <span>ต้นทุนรวม:</span>
                  <span className="text-slate-200 font-semibold">
                    ฿{Math.round(totalCost).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>มูลค่าปัจจุบัน:</span>
                  <span className="text-white font-bold">
                    ฿{Math.round(totalValue).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-white/[0.07] flex items-center justify-between text-xs">
              <span className="text-slate-400">ดาวเด่นในพอร์ต:</span>
              {topGainerHolding ? (
                <button
                  type="button"
                  onClick={() =>
                    setSelectedStock({
                      symbol: topGainerHolding.ticker,
                      name: topGainerHolding.assetName,
                      market: topGainerHolding.market,
                    })
                  }
                  className="font-mono font-bold text-emerald-400 hover:underline cursor-pointer flex items-center gap-1"
                >
                  <span>{topGainerHolding.ticker}</span>
                  <span>
                    ({topGainerHolding.unrealizedPnLPercent >= 0 ? '+' : ''}
                    {topGainerHolding.unrealizedPnLPercent.toFixed(1)}%)
                  </span>
                </button>
              ) : (
                <span className="text-slate-500">—</span>
              )}
            </div>
          </div>

          {/* Card 3: Realized Gains + Dividends Cash Flow (3 Columns) */}
          <div className="lg:col-span-3 rounded-3xl bg-[#121620] border border-white/[0.08] p-6 flex flex-col justify-between shadow-xl shadow-black/30 relative overflow-hidden">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-xs font-bold tracking-wider uppercase text-slate-300">
                  กำไรขายแล้ว + ปันผลรับ
                </span>
                <p className="text-[11px] text-slate-400 mt-0.5">Realized Cash Flow (THB)</p>
              </div>
              <span className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shrink-0">
                <Coins className="w-4 h-4" />
              </span>
            </div>

            <div className="my-4 space-y-3">
              <p className="text-3xl sm:text-4xl font-black text-white tabular-nums tracking-tight leading-none font-mono">
                ฿
                <CountUp
                  end={totalCashFlowRealized}
                  duration={1.1}
                  separator=","
                  decimals={2}
                />
              </p>

              {/* Breakdown Box: Dividends vs Realized Sales */}
              <div className="p-3 rounded-2xl bg-[#171C28] border border-white/[0.06] space-y-1.5 text-xs font-mono">
                <div className="flex items-center justify-between">
                  <span className="text-emerald-400 font-sans font-medium">💰 ปันผลสะสมสุทธิ:</span>
                  <span className="text-white font-semibold">
                    ฿{totalDividends.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-cyan-400 font-sans font-medium">📈 กำไรขายล็อกแล้ว:</span>
                  <span className="text-slate-200 font-semibold">
                    {totalRealizedGainUSD > 0
                      ? `$${totalRealizedGainUSD.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
                      : `฿${Math.round(totalRealizedGain).toLocaleString()}`}
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-[#0D1017] overflow-hidden flex pt-0.5">
                  <div
                    className="h-full bg-emerald-400"
                    style={{ width: `${dividendShareOfCashFlow}%` }}
                  />
                  <div
                    className="h-full bg-cyan-400"
                    style={{ width: `${100 - dividendShareOfCashFlow}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-white/[0.07] flex items-center justify-between text-xs">
              <Link
                href="/performance"
                className="text-indigo-300 hover:text-white font-semibold flex items-center gap-1 transition-colors"
              >
                <span>ดูกำไรรายตัว</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
              <Link
                href="/dividends"
                className="text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 transition-colors"
              >
                <span>ปฏิทินปันผล XD</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>

        {/* ── 2. 30-SECOND COMMAND CENTER: DIME! BUCKETS & TODAY'S SIGNALS ───── */}
        <div className="rounded-3xl bg-gradient-to-b from-[#141824] to-[#11141D] border border-white/[0.09] p-5 sm:p-6 space-y-5 shadow-2xl shadow-black/30">
          {/* Header + Live News Ticker */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-4 border-b border-white/[0.07]">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1.5">
                  <Zap className="w-3 h-3 text-amber-400" />
                  30-Second Strategy Hub
                </span>

                {marketPulse && (
                  <Link
                    href="/news"
                    className="inline-flex items-center gap-2 px-3 py-0.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.07] text-xs text-slate-200 hover:text-indigo-300 transition-all"
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                    <strong className="text-indigo-400 shrink-0">ข่าวล่าสุด:</strong>
                    <span className="truncate max-w-[240px] sm:max-w-[460px]">
                      {marketPulse.symbol ? `[${marketPulse.symbol}] ` : ''}
                      {marketPulse.headline}
                    </span>
                    <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                  </Link>
                )}
              </div>

              <h2 className="text-base sm:text-lg font-bold text-white">
                ตะกร้ากลยุทธ์พอร์ต (Dime! Style) &amp; สัญญาณต้องทำวันนี้
              </h2>
            </div>

            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {selectedBucketFilter !== 'ALL' && (
                <button
                  type="button"
                  onClick={() => setSelectedBucketFilter('ALL')}
                  className="px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-xs font-semibold text-slate-200 cursor-pointer"
                >
                  ล้างตัวกรองตะกร้า
                </button>
              )}
              <Link
                href="/plans"
                className="px-4 py-2 rounded-xl bg-indigo-600/25 hover:bg-indigo-600 text-indigo-200 hover:text-white border border-indigo-500/40 text-xs font-semibold flex items-center gap-1.5 transition-all"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>ถาม AI รายตะกร้า &amp; ปรับสัดส่วน</span>
              </Link>
            </div>
          </div>

          {/* Visual Stacked Bar Across All Strategy Buckets */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>โครงสร้างพอร์ตจริงตามตะกร้ากลยุทธ์ (คลิกที่การ์ดเพื่อกรองตารางหุ้นด้านล่าง)</span>
              <span className="font-mono text-slate-300">รวม 100% ของพอร์ตสุทธิ</span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-[#0B0E14] overflow-hidden flex p-0.5 border border-white/[0.06] gap-0.5">
              {computedBuckets.map((b) => {
                const barColor = BUCKET_BAR_COLORS[b.strategyType] || '#6366f1'
                if (b.actualPercent <= 0) return null
                return (
                  <div
                    key={b.id}
                    className="h-full first:rounded-l-full last:rounded-r-full transition-all duration-500"
                    style={{
                      width: `${Math.max(2, b.actualPercent)}%`,
                      backgroundColor: barColor,
                    }}
                    title={`${b.name}: จริง ${b.actualPercent}% (เป้า ${b.targetPercent}%)`}
                  />
                )
              })}
            </div>
          </div>

          {/* 4 Strategy Bucket Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
            {computedBuckets.map((b) => {
              const meta = STRATEGY_TYPE_META[b.strategyType] || STRATEGY_TYPE_META.CUSTOM
              const isSelected = selectedBucketFilter === b.id
              const barColor = BUCKET_BAR_COLORS[b.strategyType] || '#6366f1'
              const progressRatio =
                b.targetPercent > 0
                  ? Math.min(100, Math.round((b.actualPercent / b.targetPercent) * 100))
                  : 100

              return (
                <div
                  key={b.id}
                  onClick={() =>
                    b.strategyType !== 'CASH' &&
                    setSelectedBucketFilter(isSelected ? 'ALL' : b.id)
                  }
                  className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                    b.strategyType !== 'CASH' ? 'cursor-pointer' : ''
                  } ${
                    isSelected
                      ? 'bg-indigo-600/15 border-indigo-500 shadow-lg shadow-indigo-600/10 scale-[1.01]'
                      : 'bg-[#171C28]/90 hover:bg-[#1C2230] border-white/[0.07] hover:border-white/[0.15]'
                  }`}
                >
                  <div className="space-y-2.5">
                    {/* Bucket Title + Badge */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs sm:text-sm font-bold text-white truncate">
                        {b.emoji} {b.name}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${meta.badgeClass}`}
                      >
                        {meta.shortLabel}
                      </span>
                    </div>

                    {/* Value & Target Comparison */}
                    <div className="flex items-baseline justify-between font-mono">
                      <span className="text-lg font-extrabold text-white">
                        ฿{Math.round(b.actualValueBase).toLocaleString()}
                      </span>
                      <span className="text-xs text-slate-300">
                        จริง <strong className="text-white">{b.actualPercent}%</strong>{' '}
                        <span className="text-slate-500">/ เป้า {b.targetPercent}%</span>
                      </span>
                    </div>

                    {/* Mini Progress Bar */}
                    <div className="w-full h-1.5 rounded-full bg-[#0D1017] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${progressRatio}%`,
                          backgroundColor: barColor,
                        }}
                      />
                    </div>
                  </div>

                  {/* Bottom: Ticker Chips & Bucket Return */}
                  {b.strategyType !== 'CASH' ? (
                    <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1 flex-wrap min-w-0">
                        {b.holdings.length > 0 ? (
                          b.holdings.slice(0, 4).map((h) => (
                            <span
                              key={h.ticker}
                              className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-white/[0.06] text-slate-200 border border-white/[0.06]"
                            >
                              {h.ticker}
                            </span>
                          ))
                        ) : (
                          <span className="text-[11px] text-slate-500">ยังไม่มีหุ้น</span>
                        )}
                      </div>

                      <span
                        className={`text-xs font-mono font-bold shrink-0 ${
                          b.unrealizedPnLBase >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {b.unrealizedPnLBase >= 0 ? '+' : ''}
                        {b.unrealizedPnLPercent.toFixed(1)}%
                      </span>
                    </div>
                  ) : (
                    <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-slate-400">
                      <span>พร้อมช้อนเมื่อตลาดย่อ</span>
                      <Link href="/accounts" className="text-cyan-400 hover:underline font-semibold">
                        จัดการเงินสด →
                      </Link>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Actionable Signals Strip */}
          {actionableSignalsToday.length > 0 ? (
            <div className="pt-1 space-y-2.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  <span>
                    สัญญาณต้องจับตาวันนี้จากพอร์ตของคุณ ({actionableSignalsToday.length} รายการ)
                  </span>
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  วิเคราะห์สดจากแนวรับ S1 / แนวต้าน R1 / RSI(14) และเป้ากำไรรายตะกร้า
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {actionableSignalsToday.map((item: any) => (
                  <div
                    key={item.ticker}
                    className="p-3.5 rounded-2xl bg-[#171C28] border border-white/[0.08] hover:border-indigo-500/40 transition-all flex items-center justify-between gap-3"
                  >
                    <div
                      onClick={() =>
                        setSelectedStock({
                          symbol: item.ticker,
                          name: item.holding.assetName,
                          market: item.holding.market,
                        })
                      }
                      className="flex items-center gap-3 min-w-0 cursor-pointer"
                    >
                      <StockLogo ticker={item.ticker} name={item.holding.assetName} size={36} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-extrabold text-sm text-white hover:text-indigo-300">
                            {item.ticker}
                          </span>
                          <span
                            className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${
                              item.type === 'DIP_BUY'
                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                : item.type === 'TAKE_PROFIT'
                                ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                            }`}
                          >
                            {item.badge}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 mt-1 truncate">{item.reason}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setQuickTradeData({
                          ticker: item.ticker,
                          action: item.recommendedAction,
                          market: (item.holding.market as 'US' | 'TH') || 'US',
                          price: Number(item.holding.currentPrice) || undefined,
                        })
                      }
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 cursor-pointer transition-all ${
                        item.recommendedAction === 'BUY'
                          ? 'bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 border border-emerald-500/35'
                          : 'bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/35'
                      }`}
                    >
                      {item.recommendedAction === 'BUY' ? '+ ซื้อสะสม' : 'แบ่งขาย'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl bg-[#161A24] border border-white/[0.06] flex items-center justify-between text-xs text-slate-300">
              <span className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  วันนี้ยังไม่มีหุ้นในพอร์ตที่หลุดแนวรับสำคัญหรือเข้าโซน Overbought/Oversold — ถือรอรอบตามแผนได้สบายใจ
                </span>
              </span>
              {upcomingCatalysts.length > 0 && (
                <Link
                  href="/dividends"
                  className="text-amber-300 hover:underline font-semibold shrink-0 ml-2"
                >
                  📅 มีกำหนดการปันผล/งบ {upcomingCatalysts.length} รายการ →
                </Link>
              )}
            </div>
          )}
        </div>

        {/* ── 3. MIDDLE ROW: PERFORMANCE CHART & ASSET ALLOCATION ───────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left: Portfolio Growth Chart (7 Columns) */}
          <div className="lg:col-span-7 rounded-3xl bg-[#121620] border border-white/[0.08] p-6 flex flex-col justify-between shadow-xl shadow-black/25">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-bold text-white">
                    ผลการเติบโตของพอร์ตลงทุน
                  </h2>
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 font-semibold">
                    vs S&amp;P 500
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  เปรียบเทียบแนวโน้มการเติบโตของพอร์ตคุณกับดัชนีตลาดสหรัฐฯ
                </p>
              </div>

              <div className="flex items-center gap-1 bg-[#171C28] p-1 rounded-xl border border-white/[0.07] self-start sm:self-auto">
                {['1D', '1W', '1M', '6M', '1Y', 'ALL'].map((tf) => (
                  <button
                    key={tf}
                    onClick={() => setTimeframe(tf)}
                    className={`text-xs px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                      tf === timeframe
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>

            {performanceData.length > 1 ? (
              <div className="w-full flex-1 min-h-[310px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={performanceData}
                    margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="portGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity={0.45} />
                        <stop offset="90%" stopColor="#6366f1" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="benchGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#64748b" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="#64748b" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(255,255,255,0.05)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="month"
                      stroke="#64748b"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      dy={8}
                    />
                    <YAxis
                      stroke="#64748b"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      content={<CustomAreaTooltip />}
                      cursor={{
                        stroke: 'rgba(99, 102, 241, 0.4)',
                        strokeWidth: 1.5,
                        strokeDasharray: '4 4',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#6366f1"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#portGrad)"
                      name="พอร์ตของคุณ"
                    />
                    <Area
                      type="monotone"
                      dataKey="benchmark"
                      stroke="#64748b"
                      strokeWidth={1.5}
                      strokeDasharray="4 4"
                      fillOpacity={1}
                      fill="url(#benchGrad)"
                      name="S&P 500"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-16">
                <Activity className="w-8 h-8 text-slate-600 mb-2" />
                <p className="text-sm font-semibold text-white">กำลังสร้างประวัติผลตอบแทน</p>
                <p className="text-xs text-slate-500 mt-1">
                  ระบบจะแสดงแนวโน้มเมื่อมีข้อมูลมูลค่าพอร์ตตามช่วงเวลา
                </p>
              </div>
            )}
          </div>

          {/* Right: Cash Flow Stream & Upcoming Catalysts (5 Columns) */}
          <div className="lg:col-span-5 rounded-3xl bg-[#121620] border border-white/[0.08] p-6 flex flex-col justify-between shadow-xl shadow-black/25">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base sm:text-lg font-bold text-white">กระแสเงินสด &amp; กำหนดการสำคัญ</h2>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    Cash Flow &amp; Catalysts
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  ติดตามเงินปันผลรับ, กำไรขายล็อก และรอบปันผล XD สำคัญ
                </p>
              </div>

              <Link
                href="/dividends"
                className="px-2.5 py-1 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-semibold text-slate-300 hover:text-white transition-all flex items-center gap-1 shrink-0"
              >
                <span>ปฏิทิน XD</span>
                <ArrowRight className="w-3 h-3 text-slate-400" />
              </Link>
            </div>

            {/* Middle: 2 Cash Flow Metric Cards + Upcoming Catalyst Chips */}
            <div className="space-y-3 my-auto py-2">
              <div className="grid grid-cols-2 gap-3">
                {/* Dividends Card */}
                <div className="p-3.5 rounded-2xl bg-[#161B28] border border-white/[0.06] space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 font-sans">
                    <Coins className="w-3.5 h-3.5 text-emerald-400" />
                    <span>ปันผลรับสะสม</span>
                  </div>
                  <div className="text-lg sm:text-xl font-black text-white font-mono">
                    ฿{Number(totalDividends).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-[10px] text-emerald-400 font-medium">
                    {totalDividendsUSD > 0 ? `~$${totalDividendsUSD.toFixed(2)} USD` : 'กระแสเงินสดสุทธิ'}
                  </div>
                </div>

                {/* Realized Sales Card */}
                <div className="p-3.5 rounded-2xl bg-[#161B28] border border-white/[0.06] space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 font-sans">
                    <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
                    <span>กำไรขายล็อกแล้ว</span>
                  </div>
                  <div className="text-lg sm:text-xl font-black text-white font-mono">
                    {totalRealizedGainUSD > 0
                      ? `$${totalRealizedGainUSD.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
                      : `฿${Math.round(totalRealizedGain).toLocaleString()}`}
                  </div>
                  <div className="text-[10px] text-cyan-400 font-medium">
                    Realized Gains ปิดรอบ
                  </div>
                </div>
              </div>

              {/* Upcoming Catalysts Section */}
              <div className="p-3.5 rounded-2xl bg-[#141824] border border-white/[0.06] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                    รอบสำคัญของหุ้นในพอร์ต (Catalysts)
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">30 วันข้างหน้า</span>
                </div>

                {upcomingCatalysts.length > 0 ? (
                  <div className="space-y-1.5">
                    {upcomingCatalysts.map((cat: any, i: number) => (
                      <div
                        key={i}
                        className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white/[0.02] border border-white/[0.04] text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 font-mono font-bold text-[10px] border border-emerald-500/25 shrink-0">
                            {cat.badge || 'ปันผล'}
                          </span>
                          <span className="text-white font-medium truncate font-sans text-xs">
                            {cat.title}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 shrink-0 font-mono">
                          {cat.subtitle ? cat.subtitle.slice(0, 16) : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-2.5 text-center text-xs text-slate-400">
                    ไม่มีรอบ XD หรือรายงานงบด่วนในสัปดาห์นี้ พอร์ตดำเนินตามกลยุทธ์ปกติ
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs">
              <Link
                href="/performance"
                className="text-indigo-300 hover:text-white font-medium flex items-center gap-1 transition-colors"
              >
                <span>ดูผลงานรายตัว (Performance)</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
              <Link
                href="/transactions"
                className="text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors"
              >
                <span>ประวัติธุรกรรม</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>

        {/* ── 4. BOTTOM ROW: MODERN HOLDINGS TABLE ─────────────────────────── */}
        <div className="rounded-3xl bg-[#121620] border border-white/[0.08] overflow-hidden shadow-2xl shadow-black/30">
          <div className="px-6 py-5 border-b border-white/[0.07] flex flex-col gap-3.5 bg-[#151A26]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h3 className="text-base sm:text-lg font-bold text-white">
                    สินทรัพย์ที่ถือครองในพอร์ต ({filteredHoldings.length} รายการ)
                  </h3>
                  <span className="text-xs font-medium text-indigo-300 bg-indigo-500/15 border border-indigo-500/30 px-2.5 py-0.5 rounded-full">
                    คลิกชื่อหุ้นเพื่อดูข้อมูลพื้นฐาน 4 Pillars &amp; กราฟเทคนิค
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href="/performance"
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold text-indigo-200 hover:text-white bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 transition-all flex items-center gap-1.5"
                >
                  <BarChart3 className="w-3.5 h-3.5 text-indigo-400" />
                  <span>กำไรรายตัว (รวมขายแล้ว)</span>
                </Link>
                <Link
                  href="/dividends"
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold text-emerald-300 hover:text-white bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 transition-all flex items-center gap-1.5"
                >
                  <Coins className="w-3.5 h-3.5 text-emerald-400" />
                  <span>ปฏิทินปันผล XD</span>
                </Link>
              </div>
            </div>

            {/* Strategy Bucket Filter Pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setSelectedBucketFilter('ALL')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  selectedBucketFilter === 'ALL'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-[#181E2C] text-slate-300 hover:text-white border border-white/[0.06]'
                }`}
              >
                ทั้งหมด ({holdings.length})
              </button>
              {computedBuckets
                .filter((b) => b.strategyType !== 'CASH')
                .map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setSelectedBucketFilter(b.id)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      selectedBucketFilter === b.id
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-[#181E2C] text-slate-300 hover:text-white border border-white/[0.06]'
                    }`}
                  >
                    {b.emoji} {b.name} ({b.holdings.length})
                  </button>
                ))}
            </div>
          </div>

          {filteredHoldings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-sm font-semibold text-white mb-1">
                ไม่มีสินทรัพย์ในตะกร้าที่เลือก
              </p>
              <p className="text-xs text-slate-400 max-w-xs mb-4">
                คุณสามารถย้ายหุ้นเข้าตะกร้ากลยุทธ์ได้ที่หน้าจัดพอร์ต
              </p>
              <Link
                href="/plans"
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors"
              >
                ไปที่หน้าจัดตะกร้าพอร์ต
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="custom-table text-left">
                <thead>
                  <tr>
                    <th className="!text-xs !font-bold !text-slate-300">สินทรัพย์</th>
                    <th className="hidden sm:table-cell !text-xs !font-bold !text-slate-300">
                      ตะกร้ากลยุทธ์
                    </th>
                    <th className="hidden md:table-cell !text-xs !font-bold !text-slate-300">
                      สัญญาณเทคนิค &amp; แนวรับ S1
                    </th>
                    <th className="text-right !text-xs !font-bold !text-slate-300">จำนวน</th>
                    <th className="text-right hidden lg:table-cell !text-xs !font-bold !text-slate-300">
                      ต้นทุนเฉลี่ย
                    </th>
                    <th className="text-right !text-xs !font-bold !text-slate-300">ราคาตลาด</th>
                    <th className="text-right !text-xs !font-bold !text-slate-300">
                      มูลค่า &amp; สัดส่วน
                    </th>
                    <th className="text-right hidden sm:table-cell !text-xs !font-bold !text-slate-300">
                      กำไร/ขาดทุน
                    </th>
                    <th className="text-right !text-xs !font-bold !text-slate-300">จัดการด่วน</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHoldings.map((h) => {
                    const isUsd = h.currency === 'USD' || h.market === 'US'
                    const sym = isUsd ? '$' : '฿'
                    const hProfit = (h.unrealizedPnLBase ?? h.unrealizedPnL) >= 0
                    const bucket = tickerToBucketMap[h.ticker.toUpperCase()]
                    const bucketMeta = bucket
                      ? STRATEGY_TYPE_META[bucket.strategyType] || STRATEGY_TYPE_META.CUSTOM
                      : null
                    const sig = techSignals[h.ticker.toUpperCase()]

                    return (
                      <tr
                        key={h.assetId}
                        onClick={() =>
                          setSelectedStock({
                            symbol: h.ticker,
                            name: h.assetName,
                            market: h.market || (isUsd ? 'US' : 'TH'),
                          })
                        }
                        className="transition-all duration-150 group cursor-pointer hover:bg-indigo-950/25 border-b border-slate-800/50"
                      >
                        <td>
                          <div className="flex items-center gap-3">
                            <StockLogo ticker={h.ticker} name={h.assetName} size={38} />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-sm sm:text-base text-white group-hover:text-indigo-300 transition-colors">
                                  {h.ticker}
                                </span>
                                <span className="hidden group-hover:inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-300 bg-indigo-500/20 border border-indigo-500/30 px-1.5 py-0.5 rounded">
                                  พื้นฐาน <ExternalLink className="w-2.5 h-2.5" />
                                </span>
                              </div>
                              <div className="text-xs text-slate-400 truncate max-w-[150px] sm:max-w-[190px] mt-0.5">
                                {h.assetName}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="hidden sm:table-cell">
                          {bucket && bucketMeta ? (
                            <span
                              className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg border ${bucketMeta.badgeClass}`}
                            >
                              <span>{bucket.emoji}</span>
                              <span>{bucketMeta.shortLabel}</span>
                            </span>
                          ) : (
                            <span className="text-xs font-mono text-slate-400">
                              {h.market || (isUsd ? 'US' : 'TH')}
                            </span>
                          )}
                        </td>

                        <td className="hidden md:table-cell">
                          {sig ? (
                            <div className="space-y-0.5">
                              <span
                                className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-md border ${
                                  sig.signalType === 'STRONG_DIP_BUY' || sig.isNearSupport
                                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                    : sig.isOverbought
                                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                    : 'bg-slate-800/80 text-slate-300 border-slate-700/60'
                                }`}
                              >
                                {sig.badgeText}
                              </span>
                              <div className="text-[11px] font-mono text-slate-400">
                                {sig.supportS1 ? `รับ S1: ${sym}${sig.supportS1.toFixed(2)}` : ''}
                                {sig.rsi14 ? ` • RSI ${sig.rsi14.toFixed(1)}` : ''}
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-500 font-mono">กำลังคำนวณ...</span>
                          )}
                        </td>

                        <td className="text-right font-mono text-sm font-semibold text-slate-200">
                          {Number(h.quantity).toLocaleString('en-US', {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 4,
                          })}
                        </td>

                        <td className="text-right font-mono text-sm font-semibold text-slate-300 hidden lg:table-cell">
                          {sym}
                          {Number(h.avgCost).toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>

                        <td className="text-right font-mono">
                          <div className="text-sm sm:text-base text-white font-bold">
                            {sym}
                            {Number(h.currentPrice).toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </div>
                        </td>

                        <td className="text-right font-mono">
                          <div className="text-sm sm:text-base font-extrabold text-white">
                            ฿
                            {Number(h.currentValueBase).toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </div>
                          <div className="flex items-center justify-end gap-1.5 mt-0.5 text-xs">
                            {isUsd && (
                              <span className="text-indigo-300 font-semibold">
                                $
                                {Number(h.currentValue).toLocaleString('en-US', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </span>
                            )}
                            <span className="text-slate-400">
                              ({h.allocationPercent.toFixed(1)}%)
                            </span>
                          </div>
                        </td>

                        <td className="text-right font-mono hidden sm:table-cell">
                          <div
                            className={`text-sm sm:text-base font-extrabold tracking-tight ${
                              hProfit ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {hProfit ? '+' : ''}
                            {sym}
                            {Number(h.unrealizedPnL).toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </div>
                          <div className="mt-1 flex items-center justify-end gap-1.5">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold border ${
                                hProfit
                                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                  : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                              }`}
                            >
                              {hProfit ? '+' : ''}
                              {h.unrealizedPnLPercent.toFixed(2)}%
                            </span>
                          </div>
                        </td>

                        <td
                          className="text-right"
                          onClick={(e) => {
                            e.stopPropagation()
                          }}
                        >
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                setQuickTradeData({
                                  ticker: h.ticker,
                                  action: 'BUY',
                                  market: (h.market as 'US' | 'TH') || (isUsd ? 'US' : 'TH'),
                                  price: Number(h.currentPrice) || undefined,
                                })
                              }
                              className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 border border-emerald-500/30 text-xs font-bold transition-all cursor-pointer"
                              title={`บันทึกซื้อ ${h.ticker} เพิ่ม`}
                            >
                              +ซื้อ
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setQuickTradeData({
                                  ticker: h.ticker,
                                  action: 'SELL',
                                  market: (h.market as 'US' | 'TH') || (isUsd ? 'US' : 'TH'),
                                  price: Number(h.currentPrice) || undefined,
                                })
                              }
                              className="px-2.5 py-1 rounded-lg bg-white/[0.05] hover:bg-rose-500/25 text-slate-300 hover:text-rose-200 border border-white/[0.08] text-xs font-semibold transition-all cursor-pointer"
                              title={`บันทึกขาย ${h.ticker}`}
                            >
                              ขาย
                            </button>
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

        {quickTradeData && (
          <QuickAddModal
            initialTab="manual"
            initialData={quickTradeData}
            onClose={() => setQuickTradeData(null)}
            onSuccess={() => {
              setQuickTradeData(null)
              mutate('/api/portfolio/summary')
            }}
          />
        )}
      </div>
    </AppShell>
  )
}
