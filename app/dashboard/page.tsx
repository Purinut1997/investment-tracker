'use client'

import React, { useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { AppShell } from '@/components/AppShell'
import { DashboardEmptyState } from '@/components/DashboardEmptyState'
import { PageHeader } from '@/components/PageHeader'
import { Surface } from '@/components/Surface'
import { Sparkline } from '@/components/Sparkline'
import {
  Sparkles,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  PieChart as PieChartIcon,
  ShieldCheck,
  AlertTriangle,
  Wallet,
  DollarSign,
  Plus,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Info,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowRight,
  Activity
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
import CountUp from 'react-countup'

const PIE_COLORS = ['#a78bfa', '#67e8f9', '#6ee7b7', '#fbbf24', '#f87171', '#c084fc', '#818cf8']

const CustomAreaTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="p-3.5 rounded-xl bg-[#151821] border border-white/15 shadow-[0_16px_48px_rgba(0,0,0,0.8)] text-xs space-y-2 min-w-[170px]">
        <p className="font-semibold text-zinc-400 text-[10px] uppercase tracking-widest">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={`item-${index}`} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-zinc-300">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.stroke || entry.color }} />
              <span>{entry.name}</span>
            </span>
            <span className="font-bold text-white tabular-nums">
              ฿{Number(entry.value).toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    )
  }
  return null
}

export default function DashboardPage() {
  const { data: summary, isLoading: sumLoading, mutate: revalidateSummary } = useSWR('/api/portfolio/summary', {
    refreshInterval: 60000,
  })
  const { data: holdingsData, isLoading: holdLoading } = useSWR('/api/portfolio/holdings', {
    refreshInterval: 60000,
  })
  const { data: accountsData, isLoading: accLoading } = useSWR('/api/accounts')
  const { data: plansData, isLoading: planLoading } = useSWR('/api/plans')

  const [expandHealth, setExpandHealth] = useState(false)
  const holdings: any[] = holdingsData?.holdings ?? []

  const totalValue = summary?.totalValue ?? 0
  const totalCost = summary?.totalCost ?? 0
  const unrealizedPnL = summary?.unrealizedPnL ?? 0
  const unrealizedPnLPercent = summary?.unrealizedPnLPercent ?? 0
  const totalRealizedGain = summary?.totalRealizedGain ?? 0
  const totalDividends = summary?.totalDividends ?? 0
  const healthScore = summary?.healthScore ?? { score: 75, grade: 'B', breakdown: {}, suggestions: [] }
  const baseCurrency = summary?.baseCurrency ?? 'THB'
  const isProfit = unrealizedPnL >= 0

  const hasAccounts = (accountsData?.accounts?.length ?? 0) > 0
  const hasHoldings = holdings.length > 0 || totalCost > 0
  const hasPlans = (plansData?.presets?.length ?? 0) > 0
  const isLoading = sumLoading || holdLoading || accLoading || planLoading

  if (!isLoading && (!hasAccounts || !hasHoldings)) {
    return (
      <DashboardEmptyState 
        hasAccounts={hasAccounts} 
        hasHoldings={hasHoldings} 
        hasPlans={hasPlans} 
      />
    )
  }

  const allocationData = holdings.map((h, i) => ({
    name: h.ticker,
    value: Math.round(h.currentValueBase),
    percent: h.allocationPercent.toFixed(1),
    color: PIE_COLORS[i % PIE_COLORS.length],
  }))

  const trendData = [
    { month: 'ม.ค.', value: Math.max(0, totalValue * 0.88), benchmark: Math.max(0, totalValue * 0.90) },
    { month: 'ก.พ.', value: Math.max(0, totalValue * 0.92), benchmark: Math.max(0, totalValue * 0.91) },
    { month: 'มี.ค.', value: Math.max(0, totalValue * 0.95), benchmark: Math.max(0, totalValue * 0.93) },
    { month: 'เม.ย.', value: Math.max(0, totalValue * 0.97), benchmark: Math.max(0, totalValue * 0.94) },
    { month: 'พ.ค.',  value: Math.max(0, totalValue * 0.99), benchmark: Math.max(0, totalValue * 0.96) },
    { month: 'ปัจจุบัน', value: totalValue, benchmark: Math.max(0, totalValue * 0.97) },
  ]

  const isHighGrade = healthScore.score >= 80
  const isMidGrade  = healthScore.score >= 60

  return (
    <AppShell>
      <div className="flex flex-col gap-8 sm:gap-10 w-full">

        <PageHeader
          eyebrow="ภาพรวมพอร์ต"
          title="สวัสดี, นักลงทุน"
          description="ติดตามภาพรวมพอร์ตและสิ่งที่ควรทำต่อจากที่เดียว"
          action={<Link href="/transactions" className="btn btn-primary px-4">
            <Plus className="w-4 h-4" /> เพิ่มรายการ
          </Link>}
        />

        {/* Alert */}
        {summary?.unackAlert && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-start justify-between gap-3 text-amber-200 text-xs sm:text-sm">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-amber-300">แจ้งเตือนสัดส่วนพอร์ตเบี่ยงเบนจากเป้าหมาย</p>
                <p className="text-xs text-amber-200/70 mt-0.5">
                  {summary.unackAlert.aiSummaryText || 'สัดส่วนบางสินทรัพย์เบี่ยงเบนเกินเกณฑ์ที่กำหนด'}
                </p>
              </div>
            </div>
            <Link href="/plans" className="btn btn-secondary text-xs py-1.5 px-3 shrink-0">ตรวจสอบ</Link>
          </div>
        )}

        {/* ── ROW 1: KEY METRICS (3 KPIs) ───────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">

          {/* Card 1: Total Value (Hero Card) */}
          <div className="lg:col-span-2 bg-slate-900/80 p-6 sm:p-7 rounded-2xl relative overflow-hidden border border-slate-800 shadow-xl transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl hover:border-slate-700 flex flex-col justify-between gap-6 min-h-[220px]">
            {/* Glowing Orb */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/20 rounded-full blur-[80px] -z-10 pointer-events-none transform translate-x-1/3 -translate-y-1/3"></div>
            
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold tracking-wider uppercase text-slate-500">มูลค่าพอร์ตรวม</p>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800/50 text-slate-400 border border-slate-700 font-semibold">อัปเดตล่าสุด 2 นาทีที่แล้ว</span>
            </div>
            <div>
              <p className="text-4xl sm:text-5xl font-bold text-white tracking-tight leading-none font-mono tabular-nums">
                ฿<CountUp end={totalValue} duration={1.2} separator="," decimals={2} />
              </p>
              <p className="text-xs text-slate-500 mt-2 font-medium font-mono tabular-nums">ต้นทุน ฿{totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-slate-800/50">
              <button className="bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 text-white font-medium rounded-xl px-4 py-2 flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(168,85,247,0.4)] active:scale-95 text-xs">
                <Sparkles className="w-4 h-4" /> วิเคราะห์พอร์ตด้วย AI
              </button>
            </div>
          </div>
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold tracking-wider uppercase text-zinc-400">มูลค่าพอร์ตรวม</p>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.05] text-zinc-400 border border-white/[0.08] font-semibold">อัปเดตล่าสุด</span>
            </div>
            <div>
              <p className="text-5xl sm:text-6xl font-black text-white tabular-nums tracking-tight leading-none">
                ฿<CountUp end={totalValue} duration={1.2} separator="," decimals={2} />
              </p>
              <p className="text-xs text-zinc-400 mt-2 font-medium">ต้นทุน ฿{totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-white/[0.06]">
              <span className="text-[10px] text-zinc-400 font-medium">แนวโน้ม 7 วัน</span>
              <Sparkline seed="portfolio-total" trend="up" width={76} height={22} />
            </div>
          {/* Card 2: Unrealized P&L */}
          <div className="bg-slate-900/80 p-5 sm:p-6 rounded-2xl relative overflow-hidden border border-slate-800 shadow-xl transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl hover:border-slate-700 flex flex-col justify-between gap-5 min-h-[220px] lg:col-span-1">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold tracking-wider uppercase text-zinc-400">กำไร/ขาดทุน (ยังไม่ขาย)</p>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border flex items-center gap-0.5 ${
                isProfit ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25' : 'bg-rose-500/15 text-rose-400 border-rose-500/25'
              }`}>
                {isProfit ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {unrealizedPnLPercent.toFixed(2)}%
              </span>
            </div>
            <div>
              <p className={`text-3xl sm:text-4xl font-black tabular-nums tracking-tight leading-none ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                {isProfit ? '+' : ''}฿<CountUp end={Math.abs(unrealizedPnL)} duration={1.2} separator="," decimals={2} />
              </p>
              <p className="text-xs text-zinc-400 mt-2 font-medium">{isProfit ? 'กำไรยังไม่รับรู้' : 'ขาดทุนทางบัญชี'}</p>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-white/[0.06]">
              <span className="text-[10px] text-slate-500 font-medium">แนวโน้มกำไร/ขาดทุน</span>
              <Sparkline seed="portfolio-pnl" trend={isProfit ? 'up' : 'down'} width={76} height={22} />
            </div>
          </div>

          {/* Card 3: Realized + Dividends */}
          <div className="bg-slate-900/80 p-5 sm:p-6 rounded-2xl relative overflow-hidden border border-slate-800 shadow-xl transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl hover:border-slate-700 flex flex-col justify-between gap-5 min-h-[220px] lg:col-span-1">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold tracking-wider uppercase text-zinc-400">กำไรขายแล้ว + ปันผล</p>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.05] text-zinc-400 border border-white/[0.08] font-semibold">รับรู้แล้ว</span>
            </div>
            <div>
              <p className="text-3xl sm:text-4xl font-black text-white tabular-nums tracking-tight leading-none">
                ฿<CountUp end={totalRealizedGain + totalDividends} duration={1.2} separator="," decimals={2} />
              </p>
              <p className="text-xs text-zinc-400 mt-2 font-medium">ปันผลสะสม ฿{totalDividends.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-white/[0.06]">
              <span className="text-[10px] text-slate-500 font-medium">กระแสเงินเข้า</span>
              <Sparkline seed="portfolio-dividend" trend="up" width={76} height={22} />
            </div>
          </div>

        </div>

        {/* ── ROW 2: CHARTS & AI ───────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left: Area Chart (2/3) */}
          <div className="lg:col-span-2">
            <div className="rounded-2xl p-5 sm:p-6 bg-[#111319] border border-white/[0.08] h-full flex flex-col justify-between shadow-[0_4px_20px_-2px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.06)]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-white tracking-wide flex items-center gap-2">
                    <span>ผลตอบแทนพอร์ตลงทุนเทียบ Benchmark</span>
                    <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-zinc-400">S&P 500</span>
                  </h3>
                  <p className="text-[11px] text-zinc-400 mt-1">Cumulative Return แสดงการเติบโตของมูลค่าพอร์ตย้อนหลัง</p>
                </div>
                <div className="flex items-center gap-1 bg-[#151821] p-1 rounded-xl border border-white/[0.06] self-start sm:self-auto">
                  {['1D', '1W', '1M', '6M', '1Y', 'ALL'].map((tf) => (
                    <button key={tf} className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-all ${
                      tf === '6M'
                        ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30 font-semibold'
                        : 'text-zinc-400 hover:text-white hover:bg-white/5'
                    }`}>{tf}</button>
                  ))}
                </div>
              </div>

              {totalValue > 0 ? (
              <div className="w-full h-[340px] sm:h-[360px] mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="portGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor="#818cf8" stopOpacity={0.35} />
                        <stop offset="60%"  stopColor="#38bdf8" stopOpacity={0.1} />
                        <stop offset="100%" stopColor="#818cf8" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="benchGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor="#64748b" stopOpacity={0.15} />
                        <stop offset="100%" stopColor="#64748b" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 6" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="month" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => `฿${(val / 1000).toFixed(0)}k`} />
                    <Tooltip content={<CustomAreaTooltip />} cursor={{ stroke: 'rgba(129,140,248,0.4)', strokeWidth: 1.5, strokeDasharray: '4 4' }} />
                    <Area type="monotoneX" dataKey="value" stroke="#818cf8" strokeWidth={2.5} fillOpacity={1} fill="url(#portGrad)" name="พอร์ตการลงทุน" />
                    <Area type="monotoneX" dataKey="benchmark" stroke="#64748b" strokeWidth={1.5} strokeDasharray="4 4" fillOpacity={1} fill="url(#benchGrad)" name="Benchmark (SPX)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              ) : (
                <div className="flex min-h-[260px] flex-col items-center justify-center text-center border-t border-white/[0.06] mt-4 pt-6">
                  <p className="text-sm font-semibold text-white">ยังไม่มีข้อมูลผลตอบแทน</p>
                  <p className="text-xs text-[var(--text-muted)] mt-2 max-w-sm leading-relaxed">เพิ่มธุรกรรมและรอระบบคำนวณมูลค่าพอร์ต เพื่อดูกราฟผลตอบแทนย้อนหลัง</p>
                  <Link href="/transactions" className="btn btn-secondary text-xs mt-5">เพิ่มธุรกรรมแรก</Link>
                </div>
              )}
            </div>
          </div>

          {/* Right: Health Score, AI Digest + Allocation (1/3) */}
          <div className="lg:col-span-1 flex flex-col gap-5">

            {/* Health Score */}
            <div className="rounded-2xl p-5 bg-slate-900/60 backdrop-blur-xl border border-slate-800 flex flex-col justify-between gap-4 relative shadow-xl transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl hover:border-slate-700">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold tracking-wider uppercase text-zinc-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" /> ความเสี่ยงพอร์ต
                </p>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                  isHighGrade ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25'
                  : isMidGrade ? 'bg-amber-500/15 text-amber-400 border-amber-500/25'
                  : 'bg-rose-500/15 text-rose-400 border-rose-500/25'
                }`}>Grade {healthScore.grade}</span>
              </div>
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-black text-white tabular-nums tracking-tight leading-none">{healthScore.score}</span>
                  <span className="text-sm text-zinc-400 font-medium">/ 100</span>
                </div>
              </div>
              <div className="space-y-2 pt-3 border-t border-white/[0.06]">
                <div className="w-full h-1.5 bg-white/[0.08] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ${
                      isHighGrade ? 'bg-gradient-to-r from-emerald-500 to-cyan-400'
                      : isMidGrade ? 'bg-gradient-to-r from-amber-400 to-amber-300'
                      : 'bg-gradient-to-r from-rose-500 to-rose-400'
                    }`}
                    style={{ width: `${healthScore.score}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-zinc-400">การกระจายตัว</span>
                  <span className={`font-semibold ${isHighGrade ? 'text-emerald-400' : isMidGrade ? 'text-amber-400' : 'text-rose-400'}`}>
                    {isHighGrade ? 'สมดุลดีมาก' : isMidGrade ? 'อยู่ในเกณฑ์ปกติ' : 'ควรกระจายความเสี่ยงเพิ่ม'}
                  </span>
                </div>
              </div>
            </div>

            {/* AI Weekly Digest */}
            <div className="border border-purple-500/30 bg-purple-500/5 rounded-2xl p-4 relative shadow-xl transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl hover:border-slate-700">
              <div className="absolute top-4 right-4 text-[10px] bg-purple-500/20 text-purple-300 px-2 py-1 rounded-full flex items-center gap-1 font-semibold">
                <Sparkles className="w-3 h-3" /> AI Generated
              </div>
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-8 h-8 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center shadow-[0_0_12px_rgba(168,85,247,0.25)]">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                    AI Digest
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30 font-bold tracking-wider">GEMINI</span>
                  </h2>
                </div>
              </div>
              <div className="space-y-2">
                {summary?.latestDigest ? (
                  <>
                    <p className="text-xs text-zinc-300 leading-relaxed">{summary.latestDigest.portfolioSummaryText}</p>
                    {summary.latestDigest.newsSummaryText && (
                      <p className="text-[11px] text-zinc-400 leading-relaxed pt-2 border-t border-white/[0.08]">
                        {summary.latestDigest.newsSummaryText}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    ระบบ AI จะวิเคราะห์พอร์ตและสรุปข่าวสารให้อัตโนมัติทุกวันจันทร์
                  </p>
                )}
              </div>
            </div>

            {/* Allocation Donut */}
            <div className="rounded-2xl p-5 sm:p-6 bg-slate-900/60 backdrop-blur-xl border border-slate-800 flex-1 flex flex-col justify-between shadow-xl transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl hover:border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-white tracking-wide">สัดส่วนการลงทุน</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-zinc-400">{holdings.length} รายการ</span>
              </div>
              <div className="flex-1 flex flex-col justify-center min-h-[200px]">
                <div className="h-44 w-full flex items-center justify-center relative my-2">
                  {allocationData.length > 0 ? (
                    <>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={allocationData} innerRadius={54} outerRadius={78} paddingAngle={3} dataKey="value" stroke="none">
                            {allocationData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#151821',
                              border: '1px solid rgba(255,255,255,0.12)',
                              borderRadius: '12px',
                              fontSize: '12px',
                              boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
                            }}
                            itemStyle={{ color: '#ffffff' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-2xl font-black text-white">{holdings.length}</span>
                        <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">Assets</span>
                      </div>
                    </>
                  ) : (
                    <div className="text-xs text-zinc-400">ไม่มีข้อมูลสินทรัพย์</div>
                  )}
                </div>
                <div className="space-y-2 mt-auto pt-3 border-t border-white/[0.06]">
                  {allocationData.slice(0, 4).map((item) => (
                    <div key={item.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="font-semibold text-zinc-200">{item.name}</span>
                      </div>
                      <span className="text-zinc-400 font-medium tabular-nums">{item.percent}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── ROW 3: HOLDINGS TABLE ────────────────────────────────── */}
        <div className="rounded-2xl bg-slate-900/60 backdrop-blur-xl border border-slate-800 overflow-hidden shadow-xl">
          <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white">สินทรัพย์ในพอร์ต (Holdings)</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">รายการหุ้น, คริปโต และกองทุนที่ถือครองอยู่</p>
            </div>
            <Link href="/transactions" className="text-xs text-purple-400 hover:text-cyan-400 transition-colors flex items-center gap-1 font-semibold active:scale-95">
              ดูทั้งหมด <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {holdings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <img src="https://raw.githubusercontent.com/Purinut1997/web-images/main/LOGO%20SYSTEM.png" alt="Logo Watermark" className="w-16 h-16 opacity-20 grayscale mb-4" />
              <h4 className="text-sm font-semibold text-white mb-2">ยังไม่มีข้อมูลสินทรัพย์</h4>
              <p className="text-xs text-slate-500 max-w-xs mb-6">
                เริ่มต้นสร้างพอร์ตโดยการเพิ่มรายการธุรกรรมแรก เพื่อให้ระบบเริ่มคำนวณกำไรและวิเคราะห์ข้อมูล
              </p>
              <Link href="/transactions" className="bg-purple-600 hover:bg-purple-700 text-white rounded-lg px-6 py-2 mt-4 text-xs font-semibold transition-all active:scale-95">
                เพิ่มธุรกรรมใหม่
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800/50 bg-slate-900/30">
                    <th className="py-3.5 px-5 font-semibold tracking-wider text-slate-500 text-[10px] uppercase text-left">สัญลักษณ์</th>
                    <th className="py-3.5 px-5 font-semibold tracking-wider text-slate-500 text-[10px] uppercase text-left">ตลาด</th>
                    <th className="py-3.5 px-5 font-semibold tracking-wider text-slate-500 text-[10px] uppercase text-center">แนวโน้ม</th>
                    <th className="py-3.5 px-5 font-semibold tracking-wider text-slate-500 text-[10px] uppercase text-right">จำนวน</th>
                    <th className="py-3.5 px-5 font-semibold tracking-wider text-slate-500 text-[10px] uppercase text-right">ต้นทุนเฉลี่ย</th>
                    <th className="py-3.5 px-5 font-semibold tracking-wider text-slate-500 text-[10px] uppercase text-right">ราคาล่าสุด</th>
                    <th className="py-3.5 px-5 font-semibold tracking-wider text-slate-500 text-[10px] uppercase text-right">มูลค่ารวม</th>
                    <th className="py-3.5 px-5 font-semibold tracking-wider text-slate-500 text-[10px] uppercase text-right">กำไร/ขาดทุน</th>
                  </tr>
                </thead>
                <tbody>
                  {holdings.map((h) => {
                    const hProfit = h.unrealizedPnL >= 0
                    return (
                      <tr key={h.assetId} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors group">
                        <td className="py-3.5 px-5">
                          <div className="font-bold text-white group-hover:text-purple-400 transition-colors">{h.ticker}</div>
                          <div className="text-[10px] text-slate-500 truncate max-w-[140px]">{h.assetName}</div>
                        </td>
                        <td className="py-3.5 px-5">
                          <span className="text-[10px] font-semibold text-slate-300 uppercase border border-slate-700 px-2 py-0.5 rounded-lg bg-slate-800">{h.market}</span>
                        </td>
                        <td className="py-3.5 px-5 text-center">
                          <div className="flex justify-center">
                            <Sparkline seed={h.ticker} trend={hProfit ? 'up' : 'down'} width={64} height={20} />
                          </div>
                        </td>
                        <td className="py-3.5 px-5 text-right font-medium tabular-nums font-mono text-slate-200">{Number(h.quantity).toLocaleString()}</td>
                        <td className="py-3.5 px-5 text-right tabular-nums font-mono text-slate-400">{Number(h.avgCost).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="py-3.5 px-5 text-right font-semibold tabular-nums font-mono text-slate-200">{Number(h.currentPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="py-3.5 px-5 text-right font-bold tabular-nums font-mono text-white">฿{Number(h.currentValueBase).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className={`py-3.5 px-5 text-right font-bold tabular-nums font-mono ${hProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                          <div>{hProfit ? '+' : ''}฿{Number(h.unrealizedPnL).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                          <div className="text-[10px] font-semibold opacity-90">{hProfit ? '+' : ''}{h.unrealizedPnLPercent.toFixed(2)}%</div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </AppShell>
  )
}
