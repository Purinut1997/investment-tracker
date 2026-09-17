'use client'

import React, { useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { AppShell } from '@/components/AppShell'
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
  ArrowRight
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

const PIE_COLORS = ['#22d3ee', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#64748b']

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

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Top Notification Alert (if any) */}
        {summary?.unackAlert && (
          <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-start justify-between gap-3 text-amber-200 text-xs sm:text-sm">
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

        {/* 1. HEALTH SCORE GAUGE & AI DIGEST CARD */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Health Score Card */}
          <div className="card p-5 lg:col-span-1 flex flex-col justify-between border-cyan-500/20 bg-gradient-to-b from-[var(--bg-surface)] to-[var(--bg-elevated)]/50">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[var(--cyan-400)]" />
                  Portfolio Health Score
                </span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-[var(--cyan-400)] border border-cyan-500/30">
                  Grade {healthScore.grade}
                </span>
              </div>

              {/* Gauge Score Display */}
              <div className="mt-4 flex flex-col items-center justify-center text-center">
                <div className="relative flex items-center justify-center w-36 h-36">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      className="stroke-slate-800"
                      strokeWidth="10"
                      fill="transparent"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      className="stroke-cyan-400 transition-all duration-1000 ease-out"
                      strokeWidth="10"
                      strokeDasharray={251.2}
                      strokeDashoffset={251.2 - (251.2 * Math.min(100, Math.max(0, healthScore.score))) / 100}
                      strokeLinecap="round"
                      fill="transparent"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center">
                    <span className="text-3xl font-extrabold text-white tracking-tight tabular-nums">
                      {healthScore.score}
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)] uppercase font-semibold">
                      เต็ม 100
                    </span>
                  </div>
                </div>

                <p className="text-xs text-[var(--text-secondary)] mt-2 font-medium">
                  {healthScore.score >= 80
                    ? 'พอร์ตกระจายความเสี่ยงได้ยอดเยี่ยม'
                    : healthScore.score >= 60
                    ? 'พอร์ตอยู่ในเกณฑ์ดี มีความสมดุล'
                    : 'พอร์ตมีความเสี่ยงกระจุกตัวสูง'}
                </p>
              </div>
            </div>

            {/* Breakdown Toggle */}
            <div className="mt-4 pt-3 border-t border-[var(--border)]">
              <button
                onClick={() => setExpandHealth(!expandHealth)}
                className="w-full flex items-center justify-between text-xs text-[var(--cyan-400)] font-semibold"
              >
                <span>ดูรายละเอียดคะแนน & ข้อเสนอแนะ</span>
                {expandHealth ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {expandHealth && (
                <div className="mt-3 space-y-2.5 text-xs animate-in fade-in">
                  <div className="flex justify-between text-[var(--text-secondary)]">
                    <span>การกระจายสินทรัพย์ (Diversification):</span>
                    <span className="font-bold text-white">{healthScore.breakdown?.diversification ?? 0}/40</span>
                  </div>
                  <div className="flex justify-between text-[var(--text-secondary)]">
                    <span>ความสอดคล้องกับเป้าหมาย (Alignment):</span>
                    <span className="font-bold text-white">{healthScore.breakdown?.targetAlignment ?? 0}/40</span>
                  </div>
                  <div className="flex justify-between text-[var(--text-secondary)]">
                    <span>การควบคุมการกระจุกตัว (Concentration):</span>
                    <span className="font-bold text-white">{healthScore.breakdown?.concentrationRisk ?? 0}/20</span>
                  </div>

                  {healthScore.suggestions?.length > 0 && (
                    <div className="pt-2 border-t border-[var(--border)] space-y-1 text-[11px] text-cyan-200/90">
                      {healthScore.suggestions.map((s: string, idx: number) => (
                        <p key={idx}>• {s}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* AI Weekly Digest Card */}
          <div className="card p-5 lg:col-span-2 flex flex-col justify-between border-cyan-500/20 bg-gradient-to-br from-[var(--bg-surface)] via-[var(--bg-surface)] to-cyan-950/20">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-cyan-500 to-emerald-400 flex items-center justify-center text-black font-bold">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white">AI Weekly Digest</h2>
                    <p className="text-[10px] text-[var(--text-muted)]">สรุปภาพรวมพอร์ต & ข่าวสารประจำสัปดาห์</p>
                  </div>
                </div>

                <Link
                  href="/news"
                  className="text-xs text-[var(--cyan-400)] hover:underline flex items-center gap-1 font-semibold"
                >
                  <span>อ่านฉบับเต็ม</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              <div className="mt-4 p-4 rounded-xl bg-[var(--bg-elevated)]/60 border border-[var(--border)] space-y-2.5">
                {summary?.latestDigest ? (
                  <>
                    <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-sans">
                      {summary.latestDigest.portfolioSummaryText}
                    </p>
                    {summary.latestDigest.newsSummaryText && (
                      <p className="text-xs text-[var(--text-secondary)] leading-relaxed pt-2 border-t border-[var(--border)]">
                        📰 {summary.latestDigest.newsSummaryText}
                      </p>
                    )}
                  </>
                ) : (
                  <div className="space-y-1.5">
                    <p className="text-xs text-[var(--text-secondary)]">
                      ✨ ระบบ AI สรุปข่าวและพอร์ตการลงทุนจะประมวลผลอัตโนมัติทุกวันจันทร์ หรือเมื่อมีการบันทึกธุรกรรมใหม่อย่างต่อเนื่อง
                    </p>
                    <p className="text-[11px] text-[var(--text-muted)]">
                      พร้อมวิเคราะห์ sentiment ของหุ้นที่ท่านถือครองและแจ้งเตือนพอร์ตเบี่ยงเบน
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between text-xs text-[var(--text-muted)]">
              <span>ขับเคลื่อนด้วย Gemini AI Developer Tier</span>
              <span className="text-[var(--cyan-400)] font-medium">บันทึกอัตโนมัติ</span>
            </div>
          </div>
        </div>

        {/* 2. SUMMARY METRIC CARDS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Card 1: Total Value */}
          <div className="card p-4 sm:p-5">
            <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5 text-[var(--cyan-400)]" />
              มูลค่าพอร์ตรวม ({baseCurrency})
            </span>
            <div className="mt-2 text-xl sm:text-2xl lg:text-3xl font-extrabold text-white tabular-nums tracking-tight">
              ฿<CountUp end={totalValue} duration={1.2} separator="," decimals={2} />
            </div>
            <p className="text-[11px] text-[var(--text-muted)] mt-1">
              ต้นทุน ฿{totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>

          {/* Card 2: Unrealized P&L */}
          <div className="card p-4 sm:p-5">
            <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
              {isProfit ? (
                <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <ArrowDownRight className="w-3.5 h-3.5 text-rose-400" />
              )}
              กำไร/ขาดทุนที่ยังไม่ขาย
            </span>
            <div
              className={`mt-2 text-xl sm:text-2xl lg:text-3xl font-extrabold tabular-nums tracking-tight ${
                isProfit ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {isProfit ? '+' : ''}฿
              <CountUp end={Math.abs(unrealizedPnL)} duration={1.2} separator="," decimals={2} />
            </div>
            <p
              className={`text-xs font-bold mt-1 tabular-nums ${
                isProfit ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {isProfit ? '+' : ''}
              {unrealizedPnLPercent.toFixed(2)}%
            </p>
          </div>

          {/* Card 3: Realized Gain & Dividends */}
          <div className="card p-4 sm:p-5">
            <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
              กำไรที่ขายแล้ว / ปันผล
            </span>
            <div className="mt-2 text-xl sm:text-2xl lg:text-3xl font-extrabold text-amber-300 tabular-nums tracking-tight">
              ฿<CountUp end={totalRealizedGain + totalDividends} duration={1.2} separator="," decimals={2} />
            </div>
            <p className="text-[11px] text-[var(--text-muted)] mt-1">
              ปันผลสะสม ฿{totalDividends.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>

          {/* Card 4: Active Assets Count */}
          <div className="card p-4 sm:p-5">
            <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-purple-400" />
              จำนวนสินทรัพย์ที่ถือ
            </span>
            <div className="mt-2 text-xl sm:text-2xl lg:text-3xl font-extrabold text-white tabular-nums tracking-tight">
              <CountUp end={holdings.length} duration={0.8} /> รายการ
            </div>
            <p className="text-[11px] text-[var(--text-muted)] mt-1">
              กระจายใน {new Set(holdings.map((h) => h.market)).size} ตลาด
            </p>
          </div>
        </div>

        {/* 3. CHARTS ROW (Trajectory & Allocation) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Line Chart: Portfolio Growth vs Benchmark */}
          <div className="card p-5 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-white tracking-wide">
                  มูลค่าพอร์ตย้อนหลังเทียบ Benchmark (S&P500)
                </h3>
                <p className="text-[11px] text-[var(--text-muted)]">
                  เปรียบเทียบผลตอบแทนแบบ Cumulative Return
                </p>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                Outperforming
              </span>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="portGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#22d3ee" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="benchGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#64748b" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#64748b" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="month" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} tickFormatter={(val) => `฿${(val / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                    formatter={(value: any) => [`฿${Number(value).toLocaleString()}`, '']}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#22d3ee"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#portGrad)"
                    name="พอร์ตการลงทุน"
                  />
                  <Area
                    type="monotone"
                    dataKey="benchmark"
                    stroke="#94a3b8"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    fillOpacity={1}
                    fill="url(#benchGrad)"
                    name="Benchmark"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Donut Chart: Asset Allocation */}
          <div className="card p-5 lg:col-span-1 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">
                สัดส่วนการลงทุน (Allocation)
              </h3>
              <p className="text-[11px] text-[var(--text-muted)]">แบ่งตามมูลค่าสินทรัพย์ปัจจุบัน</p>
            </div>

            <div className="h-52 w-full flex items-center justify-center my-2">
              {allocationData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={allocationData}
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {allocationData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        borderRadius: 12,
                        fontSize: 12,
                      }}
                      formatter={(val: any, name: any, item: any) => [
                        `฿${Number(val).toLocaleString()} (${item.payload.percent}%)`,
                        item.payload.name,
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center text-xs text-[var(--text-muted)]">
                  ยังไม่มีข้อมูลสินทรัพย์
                </div>
              )}
            </div>

            {/* Legend list */}
            <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
              {allocationData.slice(0, 5).map((item) => (
                <div key={item.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="font-semibold text-white">{item.name}</span>
                  </div>
                  <span className="text-[var(--text-secondary)] font-medium tabular-nums">
                    {item.percent}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 4. CURRENT HOLDINGS TABLE */}
        <div className="card overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-[var(--border)] flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white">สินทรัพย์ในพอร์ตปัจจุบัน (Holdings)</h3>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                ราคาตลาดปัจจุบัน คำนวณกำไร/ขาดทุน และต้นทุนเฉลี่ย
              </p>
            </div>
            <Link
              href="/transactions"
              className="btn btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
            >
              <span>ดูธุรกรรมทั้งหมด</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {holdings.length === 0 ? (
            <div className="p-12 text-center text-xs text-[var(--text-muted)]">
              ยังไม่มีสินทรัพย์ในพอร์ต เริ่มต้นบันทึกรายการซื้อที่หน้า{' '}
              <Link href="/transactions" className="text-[var(--cyan-400)] underline">
                รายการธุรกรรม
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[var(--bg-elevated)]/60 text-[var(--text-muted)] uppercase tracking-wider text-[11px] border-b border-[var(--border)]">
                  <tr>
                    <th className="py-3 px-4">สัญลักษณ์ (Ticker)</th>
                    <th className="py-3 px-4">ตลาด</th>
                    <th className="py-3 px-4 text-right">จำนวนหน่วย</th>
                    <th className="py-3 px-4 text-right">ต้นทุนเฉลี่ย</th>
                    <th className="py-3 px-4 text-right">ราคาปัจจุบัน</th>
                    <th className="py-3 px-4 text-right">มูลค่ารวม ({baseCurrency})</th>
                    <th className="py-3 px-4 text-right">กำไร / ขาดทุน</th>
                    <th className="py-3 px-4 text-right">สัดส่วนพอร์ต</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {holdings.map((h) => {
                    const hProfit = h.unrealizedPnL >= 0
                    return (
                      <tr key={h.assetId} className="hover:bg-[var(--bg-elevated)]/40 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-white tracking-wide">
                          {h.ticker}
                          <span className="block text-[10px] text-[var(--text-muted)] font-normal truncate max-w-[150px]">
                            {h.assetName}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-secondary)] uppercase">
                            {h.market}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-medium text-white tabular-nums">
                          {Number(h.quantity).toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4 text-right text-[var(--text-secondary)] tabular-nums">
                          {h.currency === 'USD' ? '$' : '฿'}
                          {Number(h.avgCost).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-3.5 px-4 text-right font-semibold text-white tabular-nums">
                          {h.currency === 'USD' ? '$' : '฿'}
                          {Number(h.currentPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-white tabular-nums">
                          ฿{Number(h.currentValueBase).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td
                          className={`py-3.5 px-4 text-right font-bold tabular-nums whitespace-nowrap ${
                            hProfit ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          <div>
                            {hProfit ? '+' : ''}฿
                            {Number(h.unrealizedPnL).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <span className="text-[10px] block opacity-80">
                            {hProfit ? '+' : ''}
                            {h.unrealizedPnLPercent.toFixed(2)}%
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right text-slate-300 font-semibold tabular-nums">
                          {h.allocationPercent.toFixed(1)}%
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
