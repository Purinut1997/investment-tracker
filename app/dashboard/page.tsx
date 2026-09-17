'use client'

import React, { useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { AppShell } from '@/components/AppShell'
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
      <div className="p-3.5 rounded-2xl bg-[#0d0a2e]/90 backdrop-blur-2xl border border-white/10 shadow-[0_16px_48px_rgba(0,0,0,0.6)] text-xs space-y-2 min-w-[170px]">
        <p className="font-semibold text-[var(--text-muted)] text-[10px] uppercase tracking-widest">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={`item-${index}`} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-[var(--text-secondary)]">
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

  const glassStyle = {
    background: 'rgba(255,255,255,0.05)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.09)',
    boxShadow: '0 4px 32px -4px rgba(0,0,0,0.55)',
  } as React.CSSProperties

  return (
    <AppShell>
      <div className="space-y-8">

        {/* Alert */}
        {summary?.unackAlert && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-start justify-between gap-3 text-amber-200 text-xs sm:text-sm backdrop-blur-xl">
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

        {/* ── ROW 1: KEY METRICS ──────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

          {/* Card 1: Total Value */}
          <div className="rounded-3xl p-6 relative overflow-hidden flex flex-col justify-between gap-5 transition-all duration-300 hover:-translate-y-1" style={glassStyle}>
            <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full bg-violet-500/20 blur-2xl pointer-events-none" />
            <div>
              <p className="text-[10px] font-semibold tracking-widest uppercase text-[var(--text-muted)] mb-4">มูลค่าพอร์ตรวม</p>
              <p className="text-4xl font-black text-white tabular-nums leading-none">
                ฿<CountUp end={totalValue} duration={1.2} separator="," decimals={2} />
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-2">ต้นทุน ฿{totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[var(--text-muted)]">7-Day Trend</span>
              <Sparkline seed="portfolio-total" trend="up" width={76} height={22} />
            </div>
            <span className="absolute top-4 right-4 text-[10px] px-2 py-0.5 rounded-full bg-violet-500/15 text-[var(--violet)] border border-violet-500/25 font-semibold">Live</span>
          </div>

          {/* Card 2: Unrealized P&L */}
          <div className="rounded-3xl p-6 relative overflow-hidden flex flex-col justify-between gap-5 transition-all duration-300 hover:-translate-y-1" style={glassStyle}>
            <div className={`absolute -top-8 -right-8 w-28 h-28 rounded-full blur-2xl pointer-events-none ${isProfit ? 'bg-emerald-500/20' : 'bg-rose-500/20'}`} />
            <div>
              <p className="text-[10px] font-semibold tracking-widest uppercase text-[var(--text-muted)] mb-4">กำไร/ขาดทุน (ยังไม่ขาย)</p>
              <p className={`text-4xl font-black tabular-nums leading-none ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                {isProfit ? '+' : ''}฿<CountUp end={Math.abs(unrealizedPnL)} duration={1.2} separator="," decimals={2} />
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-2">{isProfit ? 'กำไรยังไม่รับรู้' : 'ขาดทุนทางบัญชี'}</p>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[var(--text-muted)]">PnL Momentum</span>
              <Sparkline seed="portfolio-pnl" trend={isProfit ? 'up' : 'down'} width={76} height={22} />
            </div>
            <span className={`absolute top-4 right-4 text-[10px] px-2 py-0.5 rounded-full font-bold border flex items-center gap-0.5 w-fit ${
              isProfit ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25' : 'bg-rose-500/15 text-rose-400 border-rose-500/25'
            }`}>
              {isProfit ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {unrealizedPnLPercent.toFixed(2)}%
            </span>
          </div>

          {/* Card 3: Realized + Dividends */}
          <div className="rounded-3xl p-6 relative overflow-hidden flex flex-col justify-between gap-5 transition-all duration-300 hover:-translate-y-1" style={glassStyle}>
            <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full bg-cyan-500/15 blur-2xl pointer-events-none" />
            <div>
              <p className="text-[10px] font-semibold tracking-widest uppercase text-[var(--text-muted)] mb-4">กำไรขายแล้ว + ปันผล</p>
              <p className="text-4xl font-black text-white tabular-nums leading-none">
                ฿<CountUp end={totalRealizedGain + totalDividends} duration={1.2} separator="," decimals={2} />
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-2">ปันผลสะสม ฿{totalDividends.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[var(--text-muted)]">Cashflow Inflow</span>
              <Sparkline seed="portfolio-dividend" trend="up" width={76} height={22} />
            </div>
            <span className="absolute top-4 right-4 text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/15 text-[var(--cyan-400)] border border-cyan-500/25 font-semibold">Realized</span>
          </div>

          {/* Card 4: Health Score */}
          <div className="rounded-3xl p-6 relative overflow-hidden flex flex-col justify-between gap-4 transition-all duration-300 hover:-translate-y-1" style={glassStyle}>
            <div className={`absolute -top-8 -right-8 w-28 h-28 rounded-full blur-2xl pointer-events-none ${
              isHighGrade ? 'bg-emerald-500/20' : isMidGrade ? 'bg-amber-500/20' : 'bg-rose-500/20'
            }`} />
            <div>
              <p className="text-[10px] font-semibold tracking-widest uppercase text-[var(--text-muted)] mb-4">ความเสี่ยงพอร์ต</p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-4xl font-black text-white tabular-nums leading-none">{healthScore.score}</span>
                <span className="text-sm text-[var(--text-muted)] font-medium">/ 100</span>
              </div>
            </div>
            <div className="space-y-2">
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
                <span className="text-[var(--text-muted)]">การกระจายตัว</span>
                <span className={`font-semibold ${isHighGrade ? 'text-emerald-400' : isMidGrade ? 'text-amber-400' : 'text-rose-400'}`}>
                  {isHighGrade ? 'ดีมาก' : isMidGrade ? 'ปานกลาง' : 'ควรปรับ'}
                </span>
              </div>
            </div>
            <span className={`absolute top-4 right-4 text-[10px] px-2 py-0.5 rounded-full font-bold border ${
              isHighGrade ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25'
              : isMidGrade ? 'bg-amber-500/15 text-amber-400 border-amber-500/25'
              : 'bg-rose-500/15 text-rose-400 border-rose-500/25'
            }`}>Grade {healthScore.grade}</span>
          </div>
        </div>

        {/* ── ROW 2: CHARTS & AI ───────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left: Area Chart (2/3) */}
          <div className="lg:col-span-2">
            <div className="rounded-3xl p-6 h-full flex flex-col" style={glassStyle}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-sm font-semibold text-white tracking-wide flex items-center gap-2">
                    <span>ผลตอบแทนพอร์ตลงทุนเทียบ Benchmark</span>
                    <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[var(--text-muted)]">S&P 500</span>
                  </h3>
                  <p className="text-[11px] text-[var(--text-muted)] mt-1">Cumulative Return แสดงการเติบโตของมูลค่าพอร์ตย้อนหลัง</p>
                </div>
                <div className="flex items-center gap-1 bg-white/[0.04] p-1 rounded-xl border border-white/[0.06] self-start sm:self-auto">
                  {['1D', '1W', '1M', '6M', '1Y', 'ALL'].map((tf) => (
                    <button key={tf} className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-all ${
                      tf === '6M'
                        ? 'bg-violet-500/20 text-[var(--violet)] border border-violet-500/30 font-semibold'
                        : 'text-[var(--text-muted)] hover:text-white hover:bg-white/5'
                    }`}>{tf}</button>
                  ))}
                </div>
              </div>
              <div className="flex-1 min-h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="portGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor="#a78bfa" stopOpacity={0.4} />
                        <stop offset="60%"  stopColor="#67e8f9" stopOpacity={0.12} />
                        <stop offset="100%" stopColor="#a78bfa" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="benchGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor="#6b7280" stopOpacity={0.12} />
                        <stop offset="100%" stopColor="#6b7280" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 6" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="month" stroke="#4b5563" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#4b5563" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => `฿${(val / 1000).toFixed(0)}k`} />
                    <Tooltip content={<CustomAreaTooltip />} cursor={{ stroke: 'rgba(167,139,250,0.4)', strokeWidth: 1.5, strokeDasharray: '4 4' }} />
                    <Area type="monotoneX" dataKey="value" stroke="#a78bfa" strokeWidth={2.5} fillOpacity={1} fill="url(#portGrad)" name="พอร์ตการลงทุน" />
                    <Area type="monotoneX" dataKey="benchmark" stroke="#4b5563" strokeWidth={1.5} strokeDasharray="4 4" fillOpacity={1} fill="url(#benchGrad)" name="Benchmark (SPX)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Right: AI Digest + Allocation (1/3) */}
          <div className="lg:col-span-1 space-y-5 flex flex-col">

            {/* AI Weekly Digest */}
            <div className="rounded-3xl p-5 relative overflow-hidden flex-shrink-0" style={{
              ...glassStyle,
              background: 'rgba(139,92,246,0.07)',
              border: '1px solid rgba(167,139,250,0.2)',
            }}>
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-8 h-8 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center shadow-[0_0_12px_rgba(139,92,246,0.25)]">
                  <Sparkles className="w-4 h-4 text-violet-400" />
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
                    <p className="text-xs text-[var(--text-primary)] leading-relaxed">{summary.latestDigest.portfolioSummaryText}</p>
                    {summary.latestDigest.newsSummaryText && (
                      <p className="text-[11px] text-[var(--text-muted)] leading-relaxed pt-2 border-t border-white/[0.08]">
                        {summary.latestDigest.newsSummaryText}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                    ระบบ AI จะวิเคราะห์พอร์ตและสรุปข่าวสารให้อัตโนมัติทุกวันจันทร์
                  </p>
                )}
              </div>
            </div>

            {/* Allocation Donut */}
            <div className="rounded-3xl p-6 flex-1 flex flex-col" style={glassStyle}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-white tracking-wide">สัดส่วนการลงทุน</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[var(--text-muted)]">{holdings.length} รายการ</span>
              </div>
              <div className="flex-1 flex flex-col justify-center min-h-[220px]">
                <div className="h-44 w-full flex items-center justify-center relative my-3">
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
                              backgroundColor: 'rgba(13,10,46,0.95)',
                              backdropFilter: 'blur(20px)',
                              border: '1px solid rgba(255,255,255,0.1)',
                              borderRadius: '12px',
                              fontSize: '12px',
                              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                            }}
                            itemStyle={{ color: '#f8fafc' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-2xl font-black text-white">{holdings.length}</span>
                        <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">Assets</span>
                      </div>
                    </>
                  ) : (
                    <div className="text-xs text-[var(--text-muted)]">ไม่มีข้อมูลสินทรัพย์</div>
                  )}
                </div>
                <div className="space-y-2 mt-auto pt-3 border-t border-white/[0.06]">
                  {allocationData.slice(0, 4).map((item) => (
                    <div key={item.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="font-semibold text-[var(--text-primary)]">{item.name}</span>
                      </div>
                      <span className="text-[var(--text-secondary)] font-medium tabular-nums">{item.percent}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── ROW 3: HOLDINGS TABLE ────────────────────────────────── */}
        <div className="rounded-3xl overflow-hidden" style={glassStyle}>
          <div className="px-6 py-4 border-b border-white/[0.07] flex items-center justify-between bg-white/[0.02]">
            <div>
              <h3 className="text-sm font-semibold text-white">สินทรัพย์ในพอร์ต (Holdings)</h3>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">รายการหุ้น, คริปโต และกองทุนที่ถือครองอยู่</p>
            </div>
            <Link href="/transactions" className="text-xs text-[var(--violet)] hover:text-[var(--cyan-400)] transition-colors flex items-center gap-1 font-semibold">
              ดูทั้งหมด <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {holdings.length === 0 ? (
            <div className="p-16 text-center flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 mb-4">
                <Layers className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-semibold text-white mb-2">ยังไม่มีข้อมูลสินทรัพย์</h4>
              <p className="text-xs text-[var(--text-muted)] max-w-xs mb-6">
                เริ่มต้นสร้างพอร์ตโดยการเพิ่มรายการธุรกรรมแรก เพื่อให้ระบบเริ่มคำนวณกำไรและวิเคราะห์ข้อมูล
              </p>
              <Link href="/transactions" className="btn btn-primary px-5 py-2 text-xs font-semibold rounded-xl">
                เพิ่มธุรกรรมใหม่
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                    <th className="py-3.5 px-5 font-semibold tracking-wider text-[var(--text-muted)] text-[10px] uppercase">สัญลักษณ์</th>
                    <th className="py-3.5 px-5 font-semibold tracking-wider text-[var(--text-muted)] text-[10px] uppercase">ตลาด</th>
                    <th className="py-3.5 px-5 font-semibold tracking-wider text-[var(--text-muted)] text-[10px] uppercase text-center">แนวโน้ม</th>
                    <th className="py-3.5 px-5 font-semibold tracking-wider text-[var(--text-muted)] text-[10px] uppercase text-right">จำนวน</th>
                    <th className="py-3.5 px-5 font-semibold tracking-wider text-[var(--text-muted)] text-[10px] uppercase text-right">ต้นทุนเฉลี่ย</th>
                    <th className="py-3.5 px-5 font-semibold tracking-wider text-[var(--text-muted)] text-[10px] uppercase text-right">ราคาล่าสุด</th>
                    <th className="py-3.5 px-5 font-semibold tracking-wider text-[var(--text-muted)] text-[10px] uppercase text-right">มูลค่ารวม</th>
                    <th className="py-3.5 px-5 font-semibold tracking-wider text-[var(--text-muted)] text-[10px] uppercase text-right">กำไร/ขาดทุน</th>
                  </tr>
                </thead>
                <tbody>
                  {holdings.map((h) => {
                    const hProfit = h.unrealizedPnL >= 0
                    return (
                      <tr key={h.assetId} className="border-b border-white/[0.04] hover:bg-white/[0.025] transition-colors group">
                        <td className="py-3.5 px-5">
                          <div className="font-bold text-white group-hover:text-[var(--violet)] transition-colors">{h.ticker}</div>
                          <div className="text-[10px] text-[var(--text-muted)] truncate max-w-[140px]">{h.assetName}</div>
                        </td>
                        <td className="py-3.5 px-5">
                          <span className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase border border-white/10 px-2 py-0.5 rounded-lg bg-white/[0.04]">{h.market}</span>
                        </td>
                        <td className="py-3.5 px-5 text-center">
                          <div className="flex justify-center">
                            <Sparkline seed={h.ticker} trend={hProfit ? 'up' : 'down'} width={64} height={20} />
                          </div>
                        </td>
                        <td className="py-3.5 px-5 text-right font-medium tabular-nums text-[var(--text-primary)]">{Number(h.quantity).toLocaleString()}</td>
                        <td className="py-3.5 px-5 text-right tabular-nums text-[var(--text-muted)]">{Number(h.avgCost).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="py-3.5 px-5 text-right font-semibold tabular-nums text-[var(--text-primary)]">{Number(h.currentPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="py-3.5 px-5 text-right font-bold tabular-nums text-white">฿{Number(h.currentValueBase).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className={`py-3.5 px-5 text-right font-bold tabular-nums ${hProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
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
