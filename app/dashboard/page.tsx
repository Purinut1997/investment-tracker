'use client'

import React, { useState } from 'react'
import useSWR, { mutate } from 'swr'
import Link from 'next/link'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/PageHeader'
import { DashboardEmptyState } from '@/components/DashboardEmptyState'
import { Sparkline } from '@/components/Sparkline'
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
  Check
} from 'lucide-react'
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
  const [timeframe, setTimeframe] = useState('6M')
  const { data: summary, error: summaryError, isLoading: sumLoading } = useSWR('/api/portfolio/summary', { refreshInterval: 60000 })
  const { data: holdingsData, error: holdingsError, isLoading: holdLoading } = useSWR('/api/portfolio/holdings', { refreshInterval: 60000 })
  const { data: accountsData, error: accountsError, isLoading: accLoading } = useSWR('/api/accounts')
  const { data: plansData, error: plansError, isLoading: planLoading } = useSWR('/api/plans')
  const { data: cashData } = useSWR('/api/cash-wallet')

  const holdings: HoldingItem[] = Array.isArray(holdingsData?.holdings) ? holdingsData.holdings : []

  const totalCash = cashData?.totalCashBase ?? 0
  const totalValue = summary?.totalValue ?? 0
  const netWorth = totalValue + totalCash
  const totalCost = summary?.totalCost ?? 0
  const unrealizedPnL = summary?.unrealizedPnL ?? 0
  const unrealizedPnLPercent = summary?.unrealizedPnLPercent ?? 0
  const totalRealizedGain = summary?.totalRealizedGain ?? 0
  const totalDividends = summary?.totalDividends ?? 0
  const healthScore: HealthScoreResult | null =
    summary?.healthScore && typeof summary.healthScore.score === 'number'
      ? summary.healthScore
      : null
  const isProfit = unrealizedPnL >= 0

  const accounts = parseAccountsPayload(accountsData)
  const hasAccounts = accounts.length > 0
  const hasHoldings = holdings.length > 0 || totalCost > 0
  const hasPlans = (plansData?.presets?.length ?? 0) > 0
  const isLoading = sumLoading || holdLoading || accLoading || planLoading
  const hasError = summaryError || holdingsError || accountsError || plansError

  const [refreshingPrices, setRefreshingPrices] = useState(false)
  const [refreshToast, setRefreshToast] = useState<{ title: string; desc: string } | null>(null)

  async function handleRefreshPrices() {
    setRefreshingPrices(true)
    try {
      const res = await fetch('/api/portfolio/refresh-prices', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to refresh prices')

      await Promise.all([
        mutate('/api/portfolio/holdings'),
        mutate('/api/portfolio/summary'),
      ])

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

  if (isLoading) {
    return <DashboardLoadingState />
  }

  if (hasError || !summary || !accountsData || !holdingsData || !plansData) {
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

  // Multi-colored asset allocation
  const allocationData = holdings.map((h, i) => ({
    name: h.ticker,
    value: Math.round(h.currentValueBase),
    percent: h.allocationPercent.toFixed(1),
    color: PIE_COLORS[i % PIE_COLORS.length],
  }))

  // Performance snapshots are not persisted yet. Keep this empty rather than
  // fabricating a chart from today's portfolio value.
  const performanceData: { month: string; value: number; benchmark: number }[] = []

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
              <p className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white tracking-tight leading-none font-mono tabular-nums">
                ฿<CountUp end={netWorth} duration={1.2} separator="," decimals={2} />
              </p>
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
                  {unrealizedPnLPercent.toFixed(2)}% กำไรพอร์ต
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
                <p className="text-xs text-slate-400 mt-0.5">Cash Flow Realized</p>
              </div>
              <span className="w-8 h-8 rounded-xl bg-cyan-500/15 text-cyan-400 flex items-center justify-center">
                <Coins className="w-4 h-4" />
              </span>
            </div>

            <div className="my-4">
              <p className="text-3xl sm:text-4xl font-bold text-white tabular-nums tracking-tight leading-none font-mono">
                ฿<CountUp end={totalRealizedGain + totalDividends} duration={1.2} separator="," decimals={2} />
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-slate-400 tabular-nums">
                  เงินปันผลสะสม: ฿{totalDividends.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="pt-3.5 border-t border-slate-800/80 flex items-center justify-between">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">กระแสเงินสดรับ</span>
              <Sparkline seed="portfolio-dividend" trend="up" width={80} height={22} />
            </div>
          </div>

        </div>

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

            {/* Asset Allocation Donut */}
            <div className="glass-panel rounded-3xl p-6 flex-1 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400">สัดส่วนสินทรัพย์</span>
                  <p className="text-xs text-slate-400 mt-0.5">Asset Allocation</p>
                </div>
                <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-lg bg-slate-800 text-indigo-300">
                  {holdings.length} รายการ
                </span>
              </div>
              
              <div className="h-40 w-full flex items-center justify-center relative my-2">
                {allocationData.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={allocationData}
                          innerRadius={46}
                          outerRadius={68}
                          paddingAngle={3}
                          dataKey="value"
                          stroke="none"
                        >
                          {allocationData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'rgba(15, 23, 42, 0.95)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '12px',
                            fontSize: '12px',
                            color: '#fff',
                            boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
                          }}
                          itemStyle={{ color: '#fff' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-xs text-slate-400">สินทรัพย์</span>
                      <span className="text-lg font-bold text-white tabular-nums font-mono">{holdings.length}</span>
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-slate-500 font-medium">ไม่มีข้อมูลสินทรัพย์</div>
                )}
              </div>
              
              <div className="space-y-2 mt-2 pt-3 border-t border-slate-800/80">
                {allocationData.slice(0, 4).map((item) => (
                  <div key={item.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: item.color }} />
                      <span className="font-semibold text-slate-200">{item.name}</span>
                    </div>
                    <span className="font-mono text-slate-400 font-medium">{item.percent}%</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* ── BOTTOM ROW: HOLDINGS TABLE ─────────────────────── */}
        <div className="glass-panel rounded-3xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/40">
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">สินทรัพย์ที่ถือครองในพอร์ต (Holdings)</h3>
              <p className="text-xs text-slate-400 mt-0.5">แสดงรายการสินทรัพย์ ต้นทุน ราคาปิดตลาดล่าสุด และกำไรขาดทุนสะสม</p>
            </div>
            <div className="flex items-center gap-2.5">
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
                    <th>สินทรัพย์</th>
                    <th className="hidden sm:table-cell">ตลาด</th>
                    <th className="text-center hidden md:table-cell">แนวโน้ม</th>
                    <th className="text-right">จำนวน</th>
                    <th className="text-right hidden lg:table-cell">ต้นทุนเฉลี่ย</th>
                    <th className="text-right">ราคาปัจจุบัน</th>
                    <th className="text-right">มูลค่ารวม</th>
                    <th className="text-right hidden sm:table-cell">กำไร/ขาดทุน</th>
                  </tr>
                </thead>
                <tbody>
                  {holdings.map((h) => {
                    const isUsd = h.currency === 'USD' || h.market === 'US'
                    const sym = isUsd ? '$' : '฿'
                    const hProfit = (h.unrealizedPnLBase ?? h.unrealizedPnL) >= 0
                    return (
                      <tr key={h.assetId} className="transition-colors group">
                        <td>
                          <div className="font-bold text-white group-hover:text-indigo-300 transition-colors">{h.ticker}</div>
                          <div className="text-[11px] text-slate-400 truncate max-w-[140px]">{h.assetName}</div>
                        </td>
                        <td className="hidden sm:table-cell">
                          <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-md border ${isUsd ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30' : 'bg-slate-800/80 text-slate-300 border-slate-700/60'}`}>
                            {h.market || (isUsd ? 'US' : 'TH')}
                          </span>
                        </td>
                        <td className="text-center hidden md:table-cell">
                          <div className="flex justify-center">
                            <Sparkline seed={h.ticker} trend={hProfit ? 'up' : 'down'} width={56} height={18} />
                          </div>
                        </td>
                        <td className="text-right font-mono text-xs text-slate-200">
                          {Number(h.quantity).toLocaleString()}
                        </td>
                        <td className="text-right font-mono text-xs text-slate-300 hidden lg:table-cell">
                          {sym}{Number(h.avgCost).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="text-right font-mono text-xs text-white font-semibold">
                          {sym}{Number(h.currentPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="text-right font-mono text-sm font-bold text-white">
                          <div>฿{Number(h.currentValueBase).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                          {isUsd && (
                            <div className="text-[10px] text-indigo-400 font-normal mt-0.5">
                              ${Number(h.currentValue).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          )}
                        </td>
                        <td className={`text-right font-mono text-xs hidden sm:table-cell ${hProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                          <div className="font-bold">
                            {hProfit ? '+' : ''}{sym}{Number(h.unrealizedPnL).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <div className="text-[10px] opacity-80 mt-0.5 flex items-center justify-end gap-1">
                            <span>{hProfit ? '+' : ''}{h.unrealizedPnLPercent.toFixed(2)}%</span>
                            {isUsd && (
                              <span className="text-slate-400">
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

      </div>
    </AppShell>
  )
}
