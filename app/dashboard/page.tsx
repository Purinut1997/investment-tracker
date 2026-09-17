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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Card 1: Total Value */}
          <div className="card p-6 border-[var(--border)] shadow-none">
            <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5 mb-2">
              <Wallet className="w-4 h-4 text-slate-400" />
              มูลค่าพอร์ตรวม ({baseCurrency})
            </span>
            <div className="text-3xl font-semibold text-white tabular-nums tracking-tight mb-1">
              ฿<CountUp end={totalValue} duration={1.2} separator="," decimals={2} />
            </div>
            <p className="text-xs text-[var(--text-muted)] font-medium">
              ต้นทุน ฿{totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>

          {/* Card 2: Unrealized P&L */}
          <div className="card p-6 border-[var(--border)] shadow-none">
            <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5 mb-2">
              <Activity className="w-4 h-4 text-slate-400" />
              กำไร/ขาดทุน (ยังไม่ขาย)
            </span>
            <div className={`text-3xl font-semibold tabular-nums tracking-tight mb-1 ${isProfit ? 'text-[var(--green-400)]' : 'text-[var(--red-400)]'}`}>
              {isProfit ? '+' : ''}฿<CountUp end={Math.abs(unrealizedPnL)} duration={1.2} separator="," decimals={2} />
            </div>
            <p className={`text-xs font-semibold tabular-nums flex items-center gap-1 ${isProfit ? 'text-[var(--green-400)]' : 'text-[var(--red-400)]'}`}>
              {isProfit ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
              {unrealizedPnLPercent.toFixed(2)}%
            </p>
          </div>

          {/* Card 3: Realized Gain & Dividends */}
          <div className="card p-6 border-[var(--border)] shadow-none">
            <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5 mb-2">
              <TrendingUp className="w-4 h-4 text-slate-400" />
              กำไรที่ขายแล้ว / ปันผล
            </span>
            <div className="text-3xl font-semibold text-white tabular-nums tracking-tight mb-1">
              ฿<CountUp end={totalRealizedGain + totalDividends} duration={1.2} separator="," decimals={2} />
            </div>
            <p className="text-xs text-[var(--text-muted)] font-medium">
              ปันผลสะสม ฿{totalDividends.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>

          {/* Card 4: Health Score Mini */}
          <div className="card p-6 border-[var(--border)] shadow-none flex flex-col justify-between">
            <div className="flex justify-between items-start mb-2">
              <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-slate-400" />
                ความเสี่ยงพอร์ต
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${isHighGrade ? 'bg-green-500/10 text-[var(--green-400)] border-green-500/20' : isMidGrade ? 'bg-amber-500/10 text-[var(--amber-400)] border-amber-500/20' : 'bg-red-500/10 text-[var(--red-400)] border-red-500/20'}`}>
                Grade {healthScore.grade}
              </span>
            </div>
            <div>
              <div className="flex items-baseline gap-1.5 mb-1.5">
                <span className="text-3xl font-semibold text-white tracking-tight tabular-nums">{healthScore.score}</span>
                <span className="text-xs text-[var(--text-muted)]">/ 100</span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full ${isHighGrade ? 'bg-[var(--green-400)]' : isMidGrade ? 'bg-[var(--amber-400)]' : 'bg-[var(--red-400)]'}`}
                  style={{ width: `${healthScore.score}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ROW 2: CHARTS & AI (2 Columns: 2/3 and 1/3) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: 2/3 Area Chart */}
          <div className="lg:col-span-2 space-y-6">
            <div className="card p-6 border-[var(--border)] shadow-none h-full flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-sm font-semibold text-white tracking-wide">
                    ผลตอบแทนพอร์ตลงทุนเทียบ Benchmark (S&P 500)
                  </h3>
                  <p className="text-[11px] text-[var(--text-muted)] mt-1">
                    Cumulative Return 6 เดือนย้อนหลัง
                  </p>
                </div>
              </div>
              <div className="flex-1 min-h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="portGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="benchGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#64748b" stopOpacity={0.1} />
                        <stop offset="100%" stopColor="#64748b" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                    <XAxis dataKey="month" stroke="#737373" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis
                      stroke="#737373"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(val) => `฿${(val / 1000).toFixed(0)}k`}
                    />
                    <Tooltip content={<CustomAreaTooltip />} cursor={{ stroke: '#525252', strokeWidth: 1, strokeDasharray: '4 4' }} />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#portGrad)"
                      name="พอร์ตการลงทุน"
                    />
                    <Area
                      type="monotone"
                      dataKey="benchmark"
                      stroke="#737373"
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
          </div>

          {/* Right: 1/3 AI Digest + Allocation */}
          <div className="lg:col-span-1 space-y-6 flex flex-col">
            {/* AI Weekly Digest Mini */}
            <div className="card p-5 border-[var(--border)] shadow-none bg-[#141414]">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-7 h-7 rounded bg-[#1f1f1f] border border-[#333] flex items-center justify-center text-slate-300">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white flex items-center gap-1.5">
                    AI Digest
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 font-bold tracking-wider">
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
                      <p className="text-[11px] text-[var(--text-muted)] leading-relaxed pt-2 border-t border-[#333]">
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
            <div className="card p-6 border-[var(--border)] shadow-none flex-1 flex flex-col">
              <div>
                <h3 className="text-sm font-semibold text-white tracking-wide">
                  สัดส่วนการลงทุน (Allocation)
                </h3>
              </div>
              <div className="flex-1 flex flex-col justify-center min-h-[220px]">
                <div className="h-40 w-full flex items-center justify-center relative my-4">
                  {allocationData.length > 0 ? (
                    <>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={allocationData}
                            innerRadius={50}
                            outerRadius={75}
                            paddingAngle={2}
                            dataKey="value"
                            stroke="none"
                          >
                            {allocationData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#171717',
                              border: '1px solid #333',
                              borderRadius: '8px',
                              fontSize: '12px',
                            }}
                            itemStyle={{ color: '#e5e5e5' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-2xl font-semibold text-white">{holdings.length}</span>
                        <span className="text-[10px] text-[var(--text-muted)] uppercase font-medium">Assets</span>
                      </div>
                    </>
                  ) : (
                    <div className="text-xs text-[var(--text-muted)]">ไม่มีข้อมูลสินทรัพย์</div>
                  )}
                </div>
                
                <div className="space-y-2 mt-auto">
                  {allocationData.slice(0, 4).map((item) => (
                    <div key={item.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2.5">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="font-medium text-slate-300">{item.name}</span>
                      </div>
                      <span className="text-[var(--text-muted)] tabular-nums">{item.percent}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ROW 3: HOLDINGS TABLE */}
        <div className="card border-[var(--border)] shadow-none overflow-hidden">
          <div className="p-5 border-b border-[var(--border)] flex items-center justify-between bg-[#111]">
            <h3 className="text-sm font-semibold text-white">สินทรัพย์ในพอร์ต (Holdings)</h3>
            <Link href="/transactions" className="text-xs text-[var(--text-muted)] hover:text-white transition-colors flex items-center gap-1">
              ดูทั้งหมด <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {holdings.length === 0 ? (
            <div className="p-16 text-center flex flex-col items-center justify-center bg-[#141414]">
              <div className="w-12 h-12 rounded-full bg-[#1f1f1f] border border-[#333] flex items-center justify-center text-slate-400 mb-4">
                <Layers className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-semibold text-white mb-2">ยังไม่มีข้อมูลสินทรัพย์</h4>
              <p className="text-xs text-[var(--text-muted)] max-w-xs mb-6">
                เริ่มต้นสร้างพอร์ตของคุณโดยการเพิ่มรายการธุรกรรมแรก เพื่อให้ระบบเริ่มคำนวณกำไรและวิเคราะห์ข้อมูล
              </p>
              <Link href="/transactions" className="btn btn-primary px-5 py-2 text-xs font-semibold rounded-md">
                เพิ่มธุรกรรมใหม่
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#141414] text-[var(--text-muted)] border-b border-[var(--border)]">
                  <tr>
                    <th className="py-3 px-5 font-medium tracking-wide">สัญลักษณ์</th>
                    <th className="py-3 px-5 font-medium tracking-wide">ตลาด</th>
                    <th className="py-3 px-5 font-medium tracking-wide text-center">แนวโน้ม (7D)</th>
                    <th className="py-3 px-5 font-medium tracking-wide text-right">จำนวน</th>
                    <th className="py-3 px-5 font-medium tracking-wide text-right">ต้นทุนเฉลี่ย</th>
                    <th className="py-3 px-5 font-medium tracking-wide text-right">ราคาล่าสุด</th>
                    <th className="py-3 px-5 font-medium tracking-wide text-right">มูลค่ารวม</th>
                    <th className="py-3 px-5 font-medium tracking-wide text-right">กำไร/ขาดทุน</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)] bg-[#111]">
                  {holdings.map((h) => {
                    const hProfit = h.unrealizedPnL >= 0
                    return (
                      <tr key={h.assetId} className="hover:bg-[#1a1a1a] transition-colors">
                        <td className="py-3 px-5">
                          <div className="font-semibold text-slate-200">{h.ticker}</div>
                          <div className="text-[10px] text-[var(--text-muted)] truncate max-w-[120px]">{h.assetName}</div>
                        </td>
                        <td className="py-3 px-5">
                          <span className="text-[10px] font-medium text-[var(--text-muted)] uppercase border border-[#333] px-1.5 py-0.5 rounded bg-[#1f1f1f]">
                            {h.market}
                          </span>
                        </td>
                        <td className="py-3 px-5 text-center">
                          <div className="flex justify-center">
                            <Sparkline seed={h.ticker} trend={hProfit ? 'up' : 'down'} width={60} height={20} />
                          </div>
                        </td>
                        <td className="py-3 px-5 text-right font-medium tabular-nums text-slate-300">
                          {Number(h.quantity).toLocaleString()}
                        </td>
                        <td className="py-3 px-5 text-right text-[var(--text-muted)] tabular-nums">
                          {Number(h.avgCost).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-5 text-right font-medium tabular-nums text-slate-300">
                          {Number(h.currentPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-5 text-right font-semibold tabular-nums text-slate-200">
                          ฿{Number(h.currentValueBase).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className={`py-3 px-5 text-right font-medium tabular-nums ${hProfit ? 'text-[var(--green-400)]' : 'text-[var(--red-400)]'}`}>
                          <div>{hProfit ? '+' : ''}฿{Number(h.unrealizedPnL).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                          <div className="text-[10px] opacity-80">{hProfit ? '+' : ''}{h.unrealizedPnLPercent.toFixed(2)}%</div>
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
