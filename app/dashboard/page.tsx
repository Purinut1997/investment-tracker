'use client'

import React, { useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { AppShell } from '@/components/AppShell'
import { DashboardEmptyState } from '@/components/DashboardEmptyState'
import { Sparkline } from '@/components/Sparkline'
import {
  Sparkles,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  AlertTriangle,
  Plus,
  ArrowRight,
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

const PIE_COLORS = ['#ffffff', '#a1a1aa', '#52525b', '#27272a', '#18181b', '#09090b']

const CustomAreaTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="p-3 rounded-xl bg-black border border-white/10 shadow-2xl text-xs space-y-2 min-w-[150px]">
        <p className="font-medium text-zinc-500 uppercase tracking-widest text-[10px]">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={`item-${index}`} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-zinc-300">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: entry.stroke || entry.color }} />
              <span>{entry.name}</span>
            </span>
            <span className="font-mono font-medium text-white tabular-nums">
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
  const { data: summary, isLoading: sumLoading } = useSWR('/api/portfolio/summary', { refreshInterval: 60000 })
  const { data: holdingsData, isLoading: holdLoading } = useSWR('/api/portfolio/holdings', { refreshInterval: 60000 })
  const { data: accountsData, isLoading: accLoading } = useSWR('/api/accounts')
  const { data: plansData, isLoading: planLoading } = useSWR('/api/plans')

  const holdings: any[] = holdingsData?.holdings ?? []

  const totalValue = summary?.totalValue ?? 0
  const totalCost = summary?.totalCost ?? 0
  const unrealizedPnL = summary?.unrealizedPnL ?? 0
  const unrealizedPnLPercent = summary?.unrealizedPnLPercent ?? 0
  const totalRealizedGain = summary?.totalRealizedGain ?? 0
  const totalDividends = summary?.totalDividends ?? 0
  const healthScore = summary?.healthScore ?? { score: 75, grade: 'B', breakdown: {}, suggestions: [] }
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

  // Use monochrome colors for donut
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
      <div className="flex flex-col gap-6 sm:gap-8 w-full max-w-[1600px] mx-auto">
        
        {/* Header section (Minimalist) */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-2">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">ภาพรวมพอร์ต</h1>
            <p className="text-sm text-zinc-500 mt-1">ติดตามมูลค่าและสัดส่วนการลงทุนแบบเรียลไทม์</p>
          </div>
          <Link href="/transactions" className="bg-white text-black hover:bg-zinc-200 px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 w-fit transition-colors">
            <Plus className="w-4 h-4" /> บันทึกธุรกรรม
          </Link>
        </div>

        {summary?.unackAlert && (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start justify-between gap-3 text-amber-200 text-sm">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-400">สัดส่วนเบี่ยงเบนจากเป้าหมาย</p>
                <p className="text-xs text-amber-200/70 mt-0.5">
                  {summary.unackAlert.aiSummaryText || 'สัดส่วนบางสินทรัพย์เบี่ยงเบนเกินเกณฑ์ที่กำหนด'}
                </p>
              </div>
            </div>
            <Link href="/plans" className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-400 text-xs font-medium hover:bg-amber-500/30 transition-colors shrink-0">
              ตรวจสอบ
            </Link>
          </div>
        )}

        {/* ── BENTO GRID TOP ROW ───────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
          
          {/* Main Portfolio Value (Hero) */}
          <div className="xl:col-span-2 bg-[#0a0a0a] border border-white/5 p-6 sm:p-8 rounded-3xl flex flex-col justify-between min-h-[240px] relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            <div className="flex items-start justify-between">
              <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-zinc-500">มูลค่าพอร์ตรวม</p>
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/[0.03] border border-white/5 text-zinc-400 font-medium">
                Live Sync
              </span>
            </div>
            <div className="my-6">
              <p className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white tracking-tighter leading-none font-mono tabular-nums">
                ฿<CountUp end={totalValue} duration={1.2} separator="," decimals={2} />
              </p>
              <div className="flex items-center gap-4 mt-4">
                <p className="text-sm text-zinc-500 font-mono tabular-nums tracking-tight">ต้นทุน ฿{totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
            </div>
            <div className="flex items-center justify-between pt-4 border-t border-white/5">
              <button className="text-xs font-medium text-white flex items-center gap-1.5 hover:text-zinc-300 transition-colors">
                <Sparkles className="w-3.5 h-3.5" /> วิเคราะห์พอร์ตด้วย AI
              </button>
            </div>
          </div>

          {/* Unrealized P&L */}
          <div className="bg-[#0a0a0a] border border-white/5 p-6 rounded-3xl flex flex-col justify-between min-h-[240px] group relative overflow-hidden">
            <div className="flex items-start justify-between">
              <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-zinc-500">กำไร/ขาดทุน</p>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium border flex items-center gap-0.5 ${
                isProfit ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
              }`}>
                {isProfit ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {unrealizedPnLPercent.toFixed(2)}%
              </span>
            </div>
            <div className="my-6">
              <p className={`text-4xl font-bold tabular-nums tracking-tighter leading-none font-mono ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                {isProfit ? '+' : ''}฿<CountUp end={Math.abs(unrealizedPnL)} duration={1.2} separator="," decimals={2} />
              </p>
              <p className="text-sm text-zinc-500 mt-3">{isProfit ? 'กำไรยังไม่รับรู้' : 'ขาดทุนทางบัญชี'}</p>
            </div>
            <div className="pt-4 border-t border-white/5 flex items-center justify-between">
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest">แนวโน้ม</span>
              <Sparkline seed="portfolio-pnl" trend={isProfit ? 'up' : 'down'} width={76} height={20} />
            </div>
          </div>

          {/* Realized + Dividends */}
          <div className="bg-[#0a0a0a] border border-white/5 p-6 rounded-3xl flex flex-col justify-between min-h-[240px] group relative overflow-hidden">
            <div className="flex items-start justify-between">
              <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-zinc-500">กำไรขายแล้ว + ปันผล</p>
            </div>
            <div className="my-6">
              <p className="text-4xl font-bold text-white tabular-nums tracking-tighter leading-none font-mono">
                ฿<CountUp end={totalRealizedGain + totalDividends} duration={1.2} separator="," decimals={2} />
              </p>
              <p className="text-sm text-zinc-500 mt-3 tabular-nums">ปันผลสะสม ฿{totalDividends.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="pt-4 border-t border-white/5 flex items-center justify-between">
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest">กระแสเงินสด</span>
              <Sparkline seed="portfolio-dividend" trend="up" width={76} height={20} />
            </div>
          </div>

        </div>

        {/* ── BENTO GRID MIDDLE ROW ───────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          
          {/* Main Chart */}
          <div className="lg:col-span-2 bg-[#0a0a0a] border border-white/5 rounded-3xl p-6 sm:p-8 flex flex-col">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-8">
              <div>
                <h3 className="text-base font-bold text-white">ผลตอบแทนพอร์ตลงทุน (vs SPX)</h3>
                <p className="text-xs text-zinc-500 mt-1.5">Cumulative Return แสดงการเติบโตของมูลค่าพอร์ตย้อนหลัง</p>
              </div>
              <div className="flex items-center gap-1 bg-[#050505] p-1 rounded-lg border border-white/5">
                {['1D', '1W', '1M', '6M', '1Y', 'ALL'].map((tf) => (
                  <button key={tf} className={`text-[11px] px-3 py-1.5 rounded-md font-medium transition-all ${
                    tf === '6M'
                      ? 'bg-white text-black'
                      : 'text-zinc-500 hover:text-white hover:bg-white/5'
                  }`}>{tf}</button>
                ))}
              </div>
            </div>

            {totalValue > 0 ? (
              <div className="w-full flex-1 min-h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="portGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor="#ffffff" stopOpacity={0.15} />
                        <stop offset="100%" stopColor="#ffffff" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="benchGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor="#52525b" stopOpacity={0.1} />
                        <stop offset="100%" stopColor="#52525b" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="month" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                    <YAxis stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`} />
                    <Tooltip content={<CustomAreaTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.2)', strokeWidth: 1, strokeDasharray: '4 4' }} />
                    <Area type="monotone" dataKey="value" stroke="#ffffff" strokeWidth={2} fillOpacity={1} fill="url(#portGrad)" name="พอร์ตลงทุน" />
                    <Area type="monotone" dataKey="benchmark" stroke="#52525b" strokeWidth={1.5} strokeDasharray="4 4" fillOpacity={1} fill="url(#benchGrad)" name="SPX" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
                <p className="text-sm font-medium text-white">ยังไม่มีข้อมูล</p>
                <p className="text-xs text-zinc-500 mt-2">เพิ่มธุรกรรมและรอระบบคำนวณมูลค่าพอร์ต</p>
              </div>
            )}
          </div>

          {/* Right Column: Health & Allocation */}
          <div className="lg:col-span-1 flex flex-col gap-4 sm:gap-6">
            
            {/* Health Score */}
            <div className="bg-[#0a0a0a] border border-white/5 rounded-3xl p-6 flex flex-col gap-6">
              <div className="flex items-start justify-between">
                <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-zinc-500 flex items-center gap-2">
                  ความเสี่ยง
                </p>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md border ${
                  isHighGrade ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : isMidGrade ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                }`}>Grade {healthScore.grade}</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-white tabular-nums tracking-tighter">{healthScore.score}</span>
                <span className="text-sm text-zinc-500 font-mono">/100</span>
              </div>
              <div className="space-y-3">
                <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      isHighGrade ? 'bg-emerald-400' : isMidGrade ? 'bg-amber-400' : 'bg-rose-400'
                    }`}
                    style={{ width: `${healthScore.score}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500">สถานะพอร์ต</span>
                  <span className={`font-medium ${isHighGrade ? 'text-emerald-400' : isMidGrade ? 'text-amber-400' : 'text-rose-400'}`}>
                    {isHighGrade ? 'สมดุลดีมาก' : isMidGrade ? 'เกณฑ์ปกติ' : 'ควรปรับปรุง'}
                  </span>
                </div>
              </div>
            </div>

            {/* Allocation Donut */}
            <div className="bg-[#0a0a0a] border border-white/5 rounded-3xl p-6 flex-1 flex flex-col min-h-[250px]">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-zinc-500">สัดส่วนพอร์ต</p>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white/5 text-zinc-400">{holdings.length} Assets</span>
              </div>
              
              <div className="flex-1 flex flex-col justify-center relative">
                <div className="h-32 w-full flex items-center justify-center">
                  {allocationData.length > 0 ? (
                    <>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={allocationData} innerRadius={42} outerRadius={60} paddingAngle={2} dataKey="value" stroke="none">
                            {allocationData.map((entry, index) => (
                               <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ backgroundColor: '#000', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '11px', color: '#fff' }} itemStyle={{ color: '#fff' }} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-xl font-bold text-white tabular-nums font-mono">{holdings.length}</span>
                      </div>
                    </>
                  ) : (
                    <div className="text-xs text-zinc-600 font-medium">NO DATA</div>
                  )}
                </div>
              </div>
              
              <div className="space-y-2 mt-4">
                {allocationData.slice(0, 3).map((item) => (
                  <div key={item.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="font-medium text-zinc-300">{item.name}</span>
                    </div>
                    <span className="text-zinc-500 font-mono tabular-nums">{item.percent}%</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* ── BOTTOM ROW: HOLDINGS ───────────────────────────── */}
        <div className="bg-[#0a0a0a] border border-white/5 rounded-3xl overflow-hidden mt-2">
          <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between bg-[#050505]">
            <h3 className="text-sm font-bold text-white tracking-wide">สินทรัพย์ที่ถือครอง</h3>
            <Link href="/transactions" className="text-xs text-zinc-400 hover:text-white transition-colors flex items-center gap-1.5">
              ดูทั้งหมด <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {holdings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <h4 className="text-sm font-medium text-white mb-2">ไม่มีข้อมูลสินทรัพย์</h4>
              <p className="text-xs text-zinc-500 max-w-xs mb-6">เริ่มต้นสร้างพอร์ตโดยการเพิ่มรายการธุรกรรม</p>
              <Link href="/transactions" className="bg-white text-black hover:bg-zinc-200 px-5 py-2 rounded-lg text-xs font-medium transition-colors">
                เพิ่มธุรกรรม
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5 bg-[#050505]">
                    <th className="py-4 px-6 font-medium text-zinc-500 text-[10px] uppercase tracking-[0.1em] text-left">Asset</th>
                    <th className="py-4 px-6 font-medium text-zinc-500 text-[10px] uppercase tracking-[0.1em] text-left hidden sm:table-cell">Market</th>
                    <th className="py-4 px-6 font-medium text-zinc-500 text-[10px] uppercase tracking-[0.1em] text-center hidden md:table-cell">Trend</th>
                    <th className="py-4 px-6 font-medium text-zinc-500 text-[10px] uppercase tracking-[0.1em] text-right">Qty</th>
                    <th className="py-4 px-6 font-medium text-zinc-500 text-[10px] uppercase tracking-[0.1em] text-right hidden lg:table-cell">Avg Cost</th>
                    <th className="py-4 px-6 font-medium text-zinc-500 text-[10px] uppercase tracking-[0.1em] text-right">Price</th>
                    <th className="py-4 px-6 font-medium text-zinc-500 text-[10px] uppercase tracking-[0.1em] text-right">Total</th>
                    <th className="py-4 px-6 font-medium text-zinc-500 text-[10px] uppercase tracking-[0.1em] text-right hidden sm:table-cell">P&L</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {holdings.map((h) => {
                    const hProfit = h.unrealizedPnL >= 0
                    return (
                      <tr key={h.assetId} className="hover:bg-white/[0.02] transition-colors group">
                        <td className="py-4 px-6">
                          <div className="font-bold text-white group-hover:text-zinc-300 transition-colors">{h.ticker}</div>
                          <div className="text-[10px] text-zinc-500 truncate max-w-[120px]">{h.assetName}</div>
                        </td>
                        <td className="py-4 px-6 hidden sm:table-cell">
                          <span className="text-[9px] font-mono text-zinc-400 uppercase border border-white/10 px-1.5 py-0.5 rounded-md bg-white/5">{h.market}</span>
                        </td>
                        <td className="py-4 px-6 text-center hidden md:table-cell">
                          <div className="flex justify-center opacity-70 group-hover:opacity-100 transition-opacity">
                            <Sparkline seed={h.ticker} trend={hProfit ? 'up' : 'down'} width={48} height={16} />
                          </div>
                        </td>
                        <td className="py-4 px-6 text-right font-mono text-xs text-zinc-300">{Number(h.quantity).toLocaleString()}</td>
                        <td className="py-4 px-6 text-right font-mono text-xs text-zinc-500 hidden lg:table-cell">{Number(h.avgCost).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="py-4 px-6 text-right font-mono text-xs text-white">{Number(h.currentPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="py-4 px-6 text-right font-mono text-sm font-medium text-white">฿{Number(h.currentValueBase).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className={`py-4 px-6 text-right font-mono text-xs hidden sm:table-cell ${hProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                          <div className="font-medium">{hProfit ? '+' : ''}฿{Number(h.unrealizedPnL).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                          <div className="text-[10px] opacity-70 mt-0.5">{hProfit ? '+' : ''}{h.unrealizedPnLPercent.toFixed(2)}%</div>
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
