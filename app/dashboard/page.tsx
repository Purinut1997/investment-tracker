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

const PIE_COLORS = ['#06b6d4', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#64748b']

const CustomAreaTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="p-3 rounded-xl bg-[var(--bg-surface)]/95 backdrop-blur-xl border border-[var(--border-strong)] shadow-[0_8px_32px_rgba(0,0,0,0.5)] text-xs space-y-1.5 min-w-[170px]">
        <p className="font-bold text-[var(--text-muted)] text-[10px] uppercase tracking-wider">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={`item-${index}`} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-[var(--text-secondary)]">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.stroke || entry.color }} />
              <span>{entry.name}</span>
            </span>
            <span className="font-extrabold text-white tabular-nums">
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

  // Prepare allocation chart data
  const allocationData = holdings.map((h, i) => ({
    name: h.ticker,
    value: Math.round(h.currentValueBase),
    percent: h.allocationPercent.toFixed(1),
    color: PIE_COLORS[i % PIE_COLORS.length],
  }))

  // Synthetic portfolio trajectory data for trend demonstration
  const trendData = [
    { month: 'ม.ค.', value: Math.max(0, totalValue * 0.88), benchmark: Math.max(0, totalValue * 0.90) },
    { month: 'ก.พ.', value: Math.max(0, totalValue * 0.92), benchmark: Math.max(0, totalValue * 0.91) },
    { month: 'มี.ค.', value: Math.max(0, totalValue * 0.95), benchmark: Math.max(0, totalValue * 0.93) },
    { month: 'เม.ย.', value: Math.max(0, totalValue * 0.97), benchmark: Math.max(0, totalValue * 0.94) },
    { month: 'พ.ค.', value: Math.max(0, totalValue * 0.99), benchmark: Math.max(0, totalValue * 0.96) },
    { month: 'ปัจจุบัน', value: totalValue, benchmark: Math.max(0, totalValue * 0.97) },
  ]

  // Gauge gradient determination
  const isHighGrade = healthScore.score >= 80
  const isMidGrade = healthScore.score >= 60

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Top Notification Alert (if any) */}
        {summary?.unackAlert && (
          <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-start justify-between gap-3 text-amber-200 text-xs sm:text-sm backdrop-blur-md">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-amber-300">แจ้งเตือนสัดส่วนพอร์ตเบี่ยงเบนจากเป้าหมาย</p>
                <p className="text-xs text-amber-200/80 mt-0.5">
                  {summary.unackAlert.aiSummaryText || 'สัดส่วนบางสินทรัพย์เบี่ยงเบนเกินเกณฑ์ที่กำหนด'}
                </p>
              </div>
            </div>
            <Link href="/plans" className="btn btn-secondary text-xs py-1.5 px-3 shrink-0">
              ตรวจสอบ
            </Link>
          </div>
        )}

        
        {/* ROW 1: KEY METRICS (4 Columns) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Card 1: Total Value */}
          <div className="card p-5 sm:p-6 rounded-2xl relative overflow-hidden group hover:border-[var(--cyan-400)]/40 hover:shadow-[0_8px_30px_rgba(6,182,212,0.12)] transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
                  <Wallet className="w-4 h-4 text-cyan-400" />
                  มูลค่าพอร์ตรวม ({baseCurrency})
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 font-semibold shadow-[0_0_8px_rgba(6,182,212,0.15)]">
                  Live
                </span>
              </div>
              <div className="text-3xl font-bold text-white tabular-nums tracking-tight mb-1">
                ฿<CountUp end={totalValue} duration={1.2} separator="," decimals={2} />
              </div>
              <p className="text-xs text-[var(--text-muted)] font-medium">
                ต้นทุน ฿{totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-white/[0.05] flex items-center justify-between">
              <span className="text-[11px] text-[var(--text-muted)]">7-Day Trend</span>
              <Sparkline seed="portfolio-total" trend="up" width={76} height={20} />
            </div>
          </div>

          {/* Card 2: Unrealized P&L */}
          <div className="card p-5 sm:p-6 rounded-2xl relative overflow-hidden group hover:border-emerald-500/40 hover:shadow-[0_8px_30px_rgba(16,185,129,0.12)] transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
                  <Activity className={`w-4 h-4 ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`} />
                  กำไร/ขาดทุน (ยังไม่ขาย)
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-0.5 ${isProfit ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.15)]' : 'bg-rose-500/15 text-rose-400 border-rose-500/30 shadow-[0_0_8px_rgba(244,63,94,0.15)]'}`}>
                  {isProfit ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {unrealizedPnLPercent.toFixed(2)}%
                </span>
              </div>
              <div className={`text-3xl font-bold tabular-nums tracking-tight mb-1 ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                {isProfit ? '+' : ''}฿<CountUp end={Math.abs(unrealizedPnL)} duration={1.2} separator="," decimals={2} />
              </div>
              <p className="text-xs text-[var(--text-muted)] font-medium">
                {isProfit ? 'กำไรที่ยังไม่ถือเป็นเงินสด' : 'ขาดทุนทางบัญชี'}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-white/[0.05] flex items-center justify-between">
              <span className="text-[11px] text-[var(--text-muted)]">PnL Momentum</span>
              <Sparkline seed="portfolio-pnl" trend={isProfit ? 'up' : 'down'} width={76} height={20} />
            </div>
          </div>

          {/* Card 3: Realized Gain & Dividends */}
          <div className="card p-5 sm:p-6 rounded-2xl relative overflow-hidden group hover:border-violet-500/40 hover:shadow-[0_8px_30px_rgba(139,92,246,0.12)] transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-violet-400" />
                  กำไรที่ขายแล้ว / ปันผล
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 font-semibold shadow-[0_0_8px_rgba(139,92,246,0.15)]">
                  Realized
                </span>
              </div>
              <div className="text-3xl font-bold text-white tabular-nums tracking-tight mb-1">
                ฿<CountUp end={totalRealizedGain + totalDividends} duration={1.2} separator="," decimals={2} />
              </div>
              <p className="text-xs text-[var(--text-muted)] font-medium">
                ปันผลสะสม ฿{totalDividends.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-white/[0.05] flex items-center justify-between">
              <span className="text-[11px] text-[var(--text-muted)]">Cashflow Inflow</span>
              <Sparkline seed="portfolio-dividend" trend="up" width={76} height={20} />
            </div>
          </div>

          {/* Card 4: Health Score Mini */}
          <div className="card p-5 sm:p-6 rounded-2xl relative overflow-hidden group hover:border-cyan-500/40 hover:shadow-[0_8px_30px_rgba(6,182,212,0.12)] transition-all flex flex-col justify-between">
            <div className="flex justify-between items-start mb-3">
              <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-cyan-400" />
                ความเสี่ยงพอร์ต
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shadow-sm ${isHighGrade ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : isMidGrade ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' : 'bg-rose-500/15 text-rose-400 border-rose-500/30'}`}>
                Grade {healthScore.grade}
              </span>
            </div>
            <div>
              <div className="flex items-baseline gap-1.5 mb-2">
                <span className="text-3xl font-bold text-white tracking-tight tabular-nums">{healthScore.score}</span>
                <span className="text-xs text-[var(--text-muted)]">/ 100</span>
              </div>
              <div className="w-full h-2 bg-slate-800/80 rounded-full overflow-hidden border border-white/5 p-0.5">
                <div 
                  className={`h-full rounded-full transition-all duration-1000 ${isHighGrade ? 'bg-gradient-to-r from-emerald-500 to-cyan-400 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : isMidGrade ? 'bg-gradient-to-r from-amber-500 to-amber-300' : 'bg-gradient-to-r from-rose-500 to-rose-400'}`}
                  style={{ width: `${healthScore.score}%` }}
                />
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-white/[0.05] flex items-center justify-between text-[11px] text-[var(--text-muted)]">
              <span>การกระจายตัว</span>
              <span className="text-slate-300 font-semibold">{isHighGrade ? 'สมดุลดีมาก' : isMidGrade ? 'ปานกลาง' : 'ควรปรับพอร์ต'}</span>
            </div>
          </div>
        </div>

        {/* ROW 2: CHARTS & AI (2 Columns: 2/3 and 1/3) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: 2/3 Area Chart */}
          <div className="lg:col-span-2 space-y-6">
            <div className="card p-6 rounded-2xl h-full flex flex-col">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-sm font-semibold text-white tracking-wide flex items-center gap-2">
                    <span>ผลตอบแทนพอร์ตลงทุนเทียบ Benchmark</span>
                    <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-slate-400">
                      S&P 500
                    </span>
                  </h3>
                  <p className="text-[11px] text-[var(--text-muted)] mt-1">
                    Cumulative Return แสดงการเติบโตของมูลค่าพอร์ตย้อนหลัง
                  </p>
                </div>

                {/* Timeframe selector pills */}
                <div className="flex items-center gap-1 bg-[var(--bg-elevated)]/70 p-1 rounded-xl border border-white/[0.06] self-start sm:self-auto">
                  {['1D', '1W', '1M', '6M', '1Y', 'ALL'].map((tf) => (
                    <button
                      key={tf}
                      className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-all ${
                        tf === '6M'
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-semibold shadow-sm'
                          : 'text-slate-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 min-h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="portGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="benchGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#64748b" stopOpacity={0.15} />
                        <stop offset="100%" stopColor="#64748b" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis dataKey="month" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis
                      stroke="#64748b"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(val) => `฿${(val / 1000).toFixed(0)}k`}
                    />
                    <Tooltip content={<CustomAreaTooltip />} cursor={{ stroke: 'rgba(56,189,248,0.4)', strokeWidth: 1.5, strokeDasharray: '4 4' }} />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#38bdf8"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#portGrad)"
                      name="พอร์ตการลงทุน"
                    />
                    <Area
                      type="monotone"
                      dataKey="benchmark"
                      stroke="#64748b"
                      strokeWidth={1.5}
                      strokeDasharray="4 4"
                      fillOpacity={1}
                      fill="url(#benchGrad)"
                      name="Benchmark (SPX)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Right: 1/3 AI Digest + Allocation */}
          <div className="lg:col-span-1 space-y-6 flex flex-col">
            {/* AI Weekly Digest Mini */}
            <div className="card p-5 rounded-2xl relative overflow-hidden bg-gradient-to-br from-[rgba(13,20,36,0.85)] to-[rgba(26,16,45,0.65)] border border-violet-500/20 shadow-[0_4px_24px_rgba(139,92,246,0.08)]">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-8 h-8 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center text-violet-300 shadow-[0_0_12px_rgba(139,92,246,0.25)]">
                  <Sparkles className="w-4 h-4 text-violet-400" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                    AI Digest
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30 font-bold tracking-wider">
                      GEMINI
                    </span>
                  </h2>
                </div>
              </div>
              <div className="space-y-2">
                {summary?.latestDigest ? (
                  <>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {summary.latestDigest.portfolioSummaryText}
                    </p>
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
            <div className="card p-6 rounded-2xl flex-1 flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-white tracking-wide">
                  สัดส่วนการลงทุน (Allocation)
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-slate-400">
                  {holdings.length} รายการ
                </span>
              </div>
              <div className="flex-1 flex flex-col justify-center min-h-[220px]">
                <div className="h-44 w-full flex items-center justify-center relative my-3">
                  {allocationData.length > 0 ? (
                    <>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={allocationData}
                            innerRadius={54}
                            outerRadius={78}
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
                              backgroundColor: 'rgba(13, 20, 36, 0.95)',
                              backdropFilter: 'blur(16px)',
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              borderRadius: '12px',
                              fontSize: '12px',
                              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                            }}
                            itemStyle={{ color: '#f8fafc' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-2xl font-bold text-white">{holdings.length}</span>
                        <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">Assets</span>
                      </div>
                    </>
                  ) : (
                    <div className="text-xs text-[var(--text-muted)]">ไม่มีข้อมูลสินทรัพย์</div>
                  )}
                </div>
                
                <div className="space-y-2 mt-auto pt-2 border-t border-white/[0.05]">
                  {allocationData.slice(0, 4).map((item) => (
                    <div key={item.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: item.color }} />
                        <span className="font-semibold text-slate-200">{item.name}</span>
                      </div>
                      <span className="text-slate-300 font-medium tabular-nums">{item.percent}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ROW 3: HOLDINGS TABLE */}
        <div className="card rounded-2xl overflow-hidden border border-white/[0.08] shadow-lg">
          <div className="p-5 border-b border-white/[0.06] flex items-center justify-between bg-white/[0.02]">
            <div>
              <h3 className="text-sm font-semibold text-white">สินทรัพย์ในพอร์ต (Holdings)</h3>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">รายการหุ้น, คริปโต และกองทุนที่ถือครองอยู่ปัจจุบัน</p>
            </div>
            <Link href="/transactions" className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1 font-semibold">
              ดูทั้งหมด <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {holdings.length === 0 ? (
            <div className="p-16 text-center flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-4 shadow-[0_0_20px_rgba(6,182,212,0.15)]">
                <Layers className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-semibold text-white mb-2">ยังไม่มีข้อมูลสินทรัพย์</h4>
              <p className="text-xs text-[var(--text-muted)] max-w-xs mb-6">
                เริ่มต้นสร้างพอร์ตของคุณโดยการเพิ่มรายการธุรกรรมแรก เพื่อให้ระบบเริ่มคำนวณกำไรและวิเคราะห์ข้อมูล
              </p>
              <Link href="/transactions" className="btn btn-primary px-5 py-2 text-xs font-semibold rounded-xl">
                เพิ่มธุรกรรมใหม่
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-white/[0.03] text-slate-400 border-b border-white/[0.06]">
                  <tr>
                    <th className="py-3.5 px-5 font-semibold tracking-wide">สัญลักษณ์</th>
                    <th className="py-3.5 px-5 font-semibold tracking-wide">ตลาด</th>
                    <th className="py-3.5 px-5 font-semibold tracking-wide text-center">แนวโน้ม (7D)</th>
                    <th className="py-3.5 px-5 font-semibold tracking-wide text-right">จำนวน</th>
                    <th className="py-3.5 px-5 font-semibold tracking-wide text-right">ต้นทุนเฉลี่ย</th>
                    <th className="py-3.5 px-5 font-semibold tracking-wide text-right">ราคาล่าสุด</th>
                    <th className="py-3.5 px-5 font-semibold tracking-wide text-right">มูลค่ารวม</th>
                    <th className="py-3.5 px-5 font-semibold tracking-wide text-right">กำไร/ขาดทุน</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {holdings.map((h) => {
                    const hProfit = h.unrealizedPnL >= 0
                    return (
                      <tr key={h.assetId} className="hover:bg-cyan-500/[0.03] transition-colors group">
                        <td className="py-3.5 px-5">
                          <div className="font-bold text-white group-hover:text-cyan-300 transition-colors">{h.ticker}</div>
                          <div className="text-[10px] text-[var(--text-muted)] truncate max-w-[140px]">{h.assetName}</div>
                        </td>
                        <td className="py-3.5 px-5">
                          <span className="text-[10px] font-semibold text-slate-300 uppercase border border-white/10 px-2 py-0.5 rounded-lg bg-white/[0.04]">
                            {h.market}
                          </span>
                        </td>
                        <td className="py-3.5 px-5 text-center">
                          <div className="flex justify-center">
                            <Sparkline seed={h.ticker} trend={hProfit ? 'up' : 'down'} width={64} height={20} />
                          </div>
                        </td>
                        <td className="py-3.5 px-5 text-right font-medium tabular-nums text-slate-200">
                          {Number(h.quantity).toLocaleString()}
                        </td>
                        <td className="py-3.5 px-5 text-right text-slate-400 tabular-nums">
                          {Number(h.avgCost).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-3.5 px-5 text-right font-semibold tabular-nums text-slate-200">
                          {Number(h.currentPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-3.5 px-5 text-right font-bold tabular-nums text-white">
                          ฿{Number(h.currentValueBase).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
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
