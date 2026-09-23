'use client'

import React, { useState, useMemo } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/PageHeader'
import { StockLogo } from '@/components/StockLogo'
import { StockDetailModal } from '@/components/market-watch/StockDetailModal'
import {
  TrendingUp,
  TrendingDown,
  Coins,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Search,
  Filter,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Check,
  ExternalLink,
  Info,
  Calendar,
  Layers,
  Award,
  AlertTriangle,
  ArrowRight,
  DollarSign,
  Briefcase,
  History,
} from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import CountUp from 'react-countup'
import type {
  PortfolioPerformanceSummary,
  AssetPerformanceItem,
} from '@/lib/analytics/asset-performance'

type FilterStatus = 'ALL' | 'HOLDING' | 'PARTIALLY_SOLD' | 'CLOSED'
type FilterMarket = 'ALL' | 'US' | 'TH'
type SortField = 'NET_PROFIT_DESC' | 'NET_PROFIT_ASC' | 'REALIZED_DESC' | 'UNREALIZED_DESC' | 'INVESTED_DESC' | 'TICKER_ASC'

export default function AssetPerformancePage() {
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('ALL')
  const [filterMarket, setFilterMarket] = useState<FilterMarket>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState<SortField>('NET_PROFIT_DESC')
  const [expandedAssetId, setExpandedAssetId] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const [selectedStock, setSelectedStock] = useState<{
    symbol: string
    name?: string
    market?: string
  } | null>(null)

  const {
    data: summary,
    error,
    isLoading,
    mutate,
  } = useSWR<PortfolioPerformanceSummary>(
    '/api/portfolio/performance-summary',
    { refreshInterval: 60000 }
  )

  const handleRefresh = async () => {
    if (refreshing) return
    setRefreshing(true)
    try {
      await fetch('/api/portfolio/performance-summary?refresh=true')
      await mutate()
      setToastMessage('อัปเดตราคาตลาดและคำนวณผลตอบแทนล่าสุดเรียบร้อย')
      setTimeout(() => setToastMessage(null), 3500)
    } catch (err) {
      console.error(err)
    } finally {
      setRefreshing(false)
    }
  }

  const toggleExpand = (assetId: string) => {
    setExpandedAssetId((prev) => (prev === assetId ? null : assetId))
  }

  // Filter and sort items
  const filteredAssets = useMemo(() => {
    if (!summary?.assets) return []
    let list = [...summary.assets]

    // Status filter
    if (filterStatus !== 'ALL') {
      list = list.filter((item) => item.status === filterStatus)
    }

    // Market filter
    if (filterMarket !== 'ALL') {
      list = list.filter((item) => (item.market || 'TH') === filterMarket)
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      list = list.filter(
        (item) =>
          item.ticker.toLowerCase().includes(q) ||
          item.assetName.toLowerCase().includes(q)
      )
    }

    // Sort
    list.sort((a, b) => {
      switch (sortField) {
        case 'NET_PROFIT_DESC':
          return b.totalNetPnLBase - a.totalNetPnLBase
        case 'NET_PROFIT_ASC':
          return a.totalNetPnLBase - b.totalNetPnLBase
        case 'REALIZED_DESC':
          return b.realizedGainBase - a.realizedGainBase
        case 'UNREALIZED_DESC':
          return b.unrealizedPnLBase - a.unrealizedPnLBase
        case 'INVESTED_DESC':
          return b.totalInvestedCapitalBase - a.totalInvestedCapitalBase
        case 'TICKER_ASC':
          return a.ticker.localeCompare(b.ticker)
        default:
          return 0
      }
    })

    return list
  }, [summary, filterStatus, filterMarket, searchQuery, sortField])

  // Chart data: Top 10 by absolute or net P&L
  const chartData = useMemo(() => {
    if (!summary?.assets || summary.assets.length === 0) return []
    // Take up to 10 assets with most significant returns
    const sorted = [...summary.assets]
      .sort((a, b) => Math.abs(b.totalNetPnLBase) - Math.abs(a.totalNetPnLBase))
      .slice(0, 10)

    return sorted.map((item) => ({
      ticker: item.ticker,
      realized: Math.round(item.realizedGainBase),
      unrealized: Math.round(item.unrealizedPnLBase),
      totalNet: Math.round(item.totalNetPnLBase),
      isProfit: item.totalNetPnLBase >= 0,
    }))
  }, [summary])

  const totalNet = summary?.totalNetPnLBase ?? 0
  const isTotalNetProfit = totalNet >= 0
  const totalRealized = summary?.totalRealizedGainBase ?? 0
  const isRealizedProfit = totalRealized >= 0
  const totalUnrealized = summary?.totalUnrealizedPnLBase ?? 0
  const isUnrealizedProfit = totalUnrealized >= 0

  return (
    <AppShell>
      <div className="w-full max-w-7xl mx-auto space-y-6 animate-fade-in pb-16">
        {/* Header */}
        <PageHeader
          eyebrow="PORTFOLIO LIFETIME PERFORMANCE"
          title="สรุปผลตอบแทน & กำไร/ขาดทุนรายสินทรัพย์"
          description="ภาพรวมกำไรและขาดทุนตลอดชีพของหุ้นแต่ละตัว แยกส่วนที่ขายทำกำไรไปแล้ว (Realized) และส่วนที่ยังถือครองอยู่ (Unrealized) ด้วยระบบ FIFO พร้อมสถิติความแม่นยำ"
          action={
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleRefresh}
                disabled={refreshing || isLoading}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 transition-all flex items-center gap-2 disabled:opacity-50 shadow-sm"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 text-indigo-400 ${
                    refreshing ? 'animate-spin' : ''
                  }`}
                />
                <span>{refreshing ? 'กำลังคำนวณใหม่...' : 'รีเฟรชข้อมูลล่าสุด'}</span>
              </button>
            </div>
          }
        />

        {/* ── TOP KPI SUMMARY CARDS ─────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Net P&L */}
          <div className="glass-panel p-5 sm:p-6 rounded-3xl relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400">
                  กำไรสุทธิรวมตลอดชีพ
                </span>
                <p className="text-xs text-slate-400 mt-0.5">Total Net Return (THB)</p>
              </div>
              <span
                className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold ${
                  isTotalNetProfit
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                }`}
              >
                {isTotalNetProfit ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )}
              </span>
            </div>

            <div className="my-3">
              <p
                className={`text-2xl sm:text-3xl font-extrabold font-mono tracking-tight tabular-nums ${
                  isTotalNetProfit ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {isTotalNetProfit ? '+' : ''}฿
                <CountUp
                  end={Math.abs(totalNet)}
                  duration={1}
                  separator=","
                  decimals={2}
                />
              </p>
              <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-400">
                <span>ขายแล้ว + ยังถือ + ปันผล</span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
              <span>เงินปันผลสะสม</span>
              <span className="font-mono font-semibold text-emerald-400">
                +฿{(summary?.totalDividendsBase ?? 0).toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
          </div>

          {/* Card 2: Realized Gain (Sold) */}
          <div className="glass-panel p-5 sm:p-6 rounded-3xl relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400">
                  กำไรที่รับรู้แล้ว (ขายแล้ว)
                </span>
                <p className="text-xs text-slate-400 mt-0.5">Realized P&L (FIFO)</p>
              </div>
              <span
                className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold ${
                  isRealizedProfit
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                }`}
              >
                <Coins className="w-4 h-4" />
              </span>
            </div>

            <div className="my-3">
              <p
                className={`text-2xl sm:text-3xl font-extrabold font-mono tracking-tight tabular-nums ${
                  isRealizedProfit ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {isRealizedProfit ? '+' : ''}฿
                <CountUp
                  end={Math.abs(totalRealized)}
                  duration={1}
                  separator=","
                  decimals={2}
                />
              </p>
              <p className="text-xs text-slate-400 mt-1.5">
                ปิดสถานะแล้ว {summary?.closedPositionsCount ?? 0} สินทรัพย์
              </p>
            </div>

            <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
              <span>ปิดกำไรเข้ากระเป๋า</span>
              <span className="font-mono text-slate-300">
                {isRealizedProfit ? 'เงินสดรับสุทธิ' : 'ขาดทุนสะสม'}
              </span>
            </div>
          </div>

          {/* Card 3: Unrealized P&L (Active) */}
          <div className="glass-panel p-5 sm:p-6 rounded-3xl relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400">
                  กำไรทางบัญชี (ยังไม่ขาย)
                </span>
                <p className="text-xs text-slate-400 mt-0.5">Unrealized P&L</p>
              </div>
              <span
                className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold ${
                  isUnrealizedProfit
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                }`}
              >
                <Briefcase className="w-4 h-4" />
              </span>
            </div>

            <div className="my-3">
              <p
                className={`text-2xl sm:text-3xl font-extrabold font-mono tracking-tight tabular-nums ${
                  isUnrealizedProfit ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {isUnrealizedProfit ? '+' : ''}฿
                <CountUp
                  end={Math.abs(totalUnrealized)}
                  duration={1}
                  separator=","
                  decimals={2}
                />
              </p>
              <p className="text-xs text-slate-400 mt-1.5">
                กำลังถือครอง {summary?.activeHoldingsCount ?? 0} สินทรัพย์
              </p>
            </div>

            <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
              <span>มูลค่าพอร์ตปัจจุบัน</span>
              <span className="font-mono font-semibold text-white">
                ฿{(summary?.totalCurrentValueBase ?? 0).toLocaleString('en-US', {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}
              </span>
            </div>
          </div>

          {/* Card 4: Win Rate & Batting Average */}
          <div className="glass-panel p-5 sm:p-6 rounded-3xl relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400">
                  อัตราความแม่นยำ (Win Rate)
                </span>
                <p className="text-xs text-slate-400 mt-0.5">Asset Success Ratio</p>
              </div>
              <span className="w-8 h-8 rounded-xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 flex items-center justify-center font-bold">
                <Award className="w-4 h-4" />
              </span>
            </div>

            <div className="my-3">
              <div className="flex items-baseline gap-2">
                <p className="text-2xl sm:text-3xl font-extrabold font-mono text-white tracking-tight">
                  <CountUp
                    end={summary?.winRatePercent ?? 0}
                    duration={1}
                    decimals={1}
                  />
                  %
                </p>
                <span className="text-xs font-semibold text-emerald-400 font-mono">
                  {summary?.winnersCount ?? 0} ชนะ / {summary?.losersCount ?? 0} แพ้
                </span>
              </div>
              <div className="w-full bg-slate-800/80 h-1.5 rounded-full overflow-hidden mt-2.5">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 rounded-full transition-all duration-700"
                  style={{ width: `${summary?.winRatePercent ?? 0}%` }}
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
              <span>ทำกำไรสูงสุด</span>
              <span className="font-mono font-semibold text-emerald-400">
                {summary?.topWinner ? `${summary.topWinner.ticker} (+฿${Math.round(summary.topWinner.netPnLBase).toLocaleString()})` : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* ── VISUAL BAR CHART: COMPARISON ACROSS ASSETS ─────────────── */}
        {chartData.length > 0 && (
          <div className="glass-panel p-6 rounded-3xl relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  เปรียบเทียบกำไร/ขาดทุนสุทธิรายสินทรัพย์ (Top Impact Assets)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  แสดงผลตอบแทนสุทธิ (บาท) ของสินทรัพย์ที่มีอิทธิพลสูงสุดต่อพอร์ต
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs font-medium">
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 shadow-sm" />
                  กำไรสุทธิ (Net Gain)
                </span>
                <span className="flex items-center gap-1.5 text-rose-400">
                  <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 shadow-sm" />
                  ขาดทุนสุทธิ (Net Loss)
                </span>
              </div>
            </div>

            <div className="h-64 sm:h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.35} />
                  <XAxis
                    dataKey="ticker"
                    stroke="#94a3b8"
                    tick={{ fontSize: 12, fill: '#cbd5e1', fontWeight: 600 }}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickFormatter={(v) => `฿${Number(v).toLocaleString()}`}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null
                      const d = payload[0].payload
                      return (
                        <div className="p-3.5 rounded-2xl glass-panel border border-slate-700/80 shadow-2xl text-xs space-y-1.5 min-w-[180px]">
                          <p className="font-bold text-white text-sm">{d.ticker}</p>
                          <div className="flex items-center justify-between text-slate-300 pt-1 border-t border-slate-800">
                            <span>กำไรที่ขายแล้ว (Realized):</span>
                            <span className={`font-mono font-semibold ${d.realized >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {d.realized >= 0 ? '+' : ''}฿{d.realized.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-slate-300">
                            <span>กำไรทางบัญชี (Unrealized):</span>
                            <span className={`font-mono font-semibold ${d.unrealized >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {d.unrealized >= 0 ? '+' : ''}฿{d.unrealized.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-white font-bold pt-1.5 border-t border-slate-700/60">
                            <span>กำไรสุทธิรวม:</span>
                            <span className={`font-mono ${d.totalNet >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {d.totalNet >= 0 ? '+' : ''}฿{d.totalNet.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      )
                    }}
                  />
                  <Bar dataKey="totalNet" radius={[6, 6, 0, 0]}>
                    {chartData.map((entry, idx) => (
                      <Cell
                        key={`cell-${idx}`}
                        fill={entry.isProfit ? '#10b981' : '#f43f5e'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ── FILTER & CONTROL BAR ──────────────────────────────────── */}
        <div className="glass-panel p-4 rounded-2xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3.5">
          {/* Left: Search input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="ค้นหาชื่อหุ้นหรือ Ticker (เช่น NVDA, AAPL, DELTA)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900/80 border border-slate-700/60 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          {/* Right: Filters & Sorts */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Status Tabs */}
            <div className="flex items-center p-1 rounded-xl bg-slate-900/80 border border-slate-800 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setFilterStatus('ALL')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  filterStatus === 'ALL'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                ทั้งหมด ({summary?.assets.length ?? 0})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('HOLDING')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  filterStatus === 'HOLDING'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                กำลังถืออยู่
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('PARTIALLY_SOLD')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  filterStatus === 'PARTIALLY_SOLD'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                ขายบางส่วน
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('CLOSED')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  filterStatus === 'CLOSED'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                ปิดสถานะแล้ว
              </button>
            </div>

            {/* Market Filter */}
            <div className="flex items-center p-1 rounded-xl bg-slate-900/80 border border-slate-800 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setFilterMarket('ALL')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  filterMarket === 'ALL'
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                ทุกตลาด
              </button>
              <button
                type="button"
                onClick={() => setFilterMarket('US')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  filterMarket === 'US'
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                US
              </button>
              <button
                type="button"
                onClick={() => setFilterMarket('TH')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  filterMarket === 'TH'
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                TH
              </button>
            </div>

            {/* Sort Dropdown */}
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value as SortField)}
              className="px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-700/60 text-xs text-slate-300 font-semibold focus:outline-none focus:border-indigo-500"
            >
              <option value="NET_PROFIT_DESC">เรียงตาม: กำไรสุทธิรวมมากสุด</option>
              <option value="NET_PROFIT_ASC">เรียงตาม: ขาดทุนสุทธิมากสุด</option>
              <option value="REALIZED_DESC">เรียงตาม: กำไรที่ขายแล้วมากสุด</option>
              <option value="UNREALIZED_DESC">เรียงตาม: กำไรที่ยังถืออยู่มากสุด</option>
              <option value="INVESTED_DESC">เรียงตาม: เงินต้นทุนมากสุด</option>
              <option value="TICKER_ASC">เรียงตาม: ชื่อ Ticker (A-Z)</option>
            </select>
          </div>
        </div>

        {/* ── MASTER-DETAIL TABLE ───────────────────────────────────── */}
        <div className="glass-panel rounded-3xl overflow-hidden shadow-xl border border-slate-800/80">
          <div className="px-6 py-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/50">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white tracking-wide">
                ตารางสรุปผลตอบแทนรายสินทรัพย์ (All-Time Breakdown)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                คลิกที่แถวหรือปุ่มดรอปดาวน์เพื่อคลี่ดูประวัติล็อตคงเหลือ และประวัติการขายในอดีตแบบ FIFO
              </p>
            </div>
            <span className="text-xs font-mono text-slate-400 bg-slate-800 px-2.5 py-1 rounded-lg">
              พบ {filteredAssets.length} รายการ
            </span>
          </div>

          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center text-center">
              <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mb-3" />
              <p className="text-sm font-semibold text-white">กำลังคำนวณ FIFO และสรุปผลตอบแทน...</p>
              <p className="text-xs text-slate-400 mt-1">โปรดรอสักครู่ ระบบกำลังเทียบต้นทุนล็อตซื้อและราคาปิดล่าสุด</p>
            </div>
          ) : filteredAssets.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-center px-4">
              <AlertTriangle className="w-10 h-10 text-amber-400 mb-3" />
              <p className="text-base font-bold text-white">ไม่พบรายการสินทรัพย์ที่ตรงกับตัวกรอง</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                ลองปรับเปลี่ยนเงื่อนไขค้นหา หรือเพิ่มรายการธุรกรรมใหม่เข้าสู่พอร์ต
              </p>
              <button
                type="button"
                onClick={() => {
                  setFilterStatus('ALL')
                  setFilterMarket('ALL')
                  setSearchQuery('')
                }}
                className="mt-4 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors"
              >
                ล้างตัวกรองทั้งหมด
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="custom-table text-left w-full border-collapse">
                <thead>
                  <tr>
                    <th className="!text-xs !font-bold !text-slate-300">สินทรัพย์ & ตลาด</th>
                    <th className="!text-xs !font-bold !text-slate-300">สถานะ</th>
                    <th className="text-right !text-xs !font-bold !text-slate-300">
                      ส่วนที่ขายแล้ว (Realized)
                    </th>
                    <th className="text-right !text-xs !font-bold !text-slate-300">
                      ส่วนที่ยังถือ (Unrealized)
                    </th>
                    <th className="text-right hidden md:table-cell !text-xs !font-bold !text-slate-300">
                      เงินปันผล
                    </th>
                    <th className="text-right !text-xs !font-bold !text-slate-300">
                      กำไรสุทธิรวม (Total P&L)
                    </th>
                    <th className="text-center !text-xs !font-bold !text-slate-300 w-16">
                      เจาะลึก
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAssets.map((item) => {
                    const isExpanded = expandedAssetId === item.assetId
                    const isUsd = item.currency === 'USD' || item.market === 'US'
                    const sym = isUsd ? '$' : '฿'
                    const hasRealized = item.realizedTrades.length > 0
                    const isRealizedGain = item.realizedGain >= 0
                    const hasUnrealized = item.currentQuantity > 0.00001
                    const isUnrealizedGain = item.unrealizedPnL >= 0
                    const isNetProfit = item.totalNetPnLBase >= 0

                    return (
                      <React.Fragment key={item.assetId}>
                        <tr
                          onClick={() => toggleExpand(item.assetId)}
                          className={`cursor-pointer transition-all duration-150 border-b border-slate-800/40 hover:bg-indigo-950/20 ${
                            isExpanded ? 'bg-indigo-950/30' : ''
                          }`}
                        >
                          {/* Asset Name & Ticker */}
                          <td>
                            <div className="flex items-center gap-3">
                              <StockLogo
                                ticker={item.ticker}
                                name={item.assetName}
                                size={36}
                              />
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-extrabold text-sm sm:text-base text-white hover:text-indigo-300 transition-colors">
                                    {item.ticker}
                                  </span>
                                  <span
                                    className={`text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded border ${
                                      isUsd
                                        ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                                        : 'bg-slate-800/80 text-slate-300 border-slate-700/60'
                                    }`}
                                  >
                                    {item.market || (isUsd ? 'US' : 'TH')}
                                  </span>
                                </div>
                                <div className="text-xs text-slate-300 truncate max-w-[150px] sm:max-w-[200px] mt-0.5">
                                  {item.assetName}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Status Badge */}
                          <td>
                            {item.status === 'HOLDING' ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                กำลังถืออยู่
                              </span>
                            ) : item.status === 'PARTIALLY_SOLD' ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-300 bg-indigo-500/10 border border-indigo-500/30 px-2 py-0.5 rounded-full">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                                ขายบางส่วน
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 bg-slate-800/80 border border-slate-700/60 px-2 py-0.5 rounded-full">
                                ปิดสถานะแล้ว
                              </span>
                            )}
                          </td>

                          {/* Realized (Sold) */}
                          <td className="text-right font-mono">
                            {hasRealized ? (
                              <div>
                                <div
                                  className={`text-sm font-bold ${
                                    isRealizedGain
                                      ? 'text-emerald-400'
                                      : 'text-rose-400'
                                  }`}
                                >
                                  {isRealizedGain ? '+' : ''}
                                  {sym}
                                  {Number(item.realizedGain).toLocaleString(
                                    'en-US',
                                    { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-400 flex items-center justify-end gap-1 mt-0.5">
                                  <span>{item.realizedGainPercent >= 0 ? '+' : ''}{item.realizedGainPercent.toFixed(1)}%</span>
                                  <span className="text-slate-600">•</span>
                                  <span>{item.realizedTrades.length} ไม้</span>
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-500">—</span>
                            )}
                          </td>

                          {/* Unrealized (Currently Held) */}
                          <td className="text-right font-mono">
                            {hasUnrealized ? (
                              <div>
                                <div
                                  className={`text-sm font-bold ${
                                    isUnrealizedGain
                                      ? 'text-emerald-400'
                                      : 'text-rose-400'
                                  }`}
                                >
                                  {isUnrealizedGain ? '+' : ''}
                                  {sym}
                                  {Number(item.unrealizedPnL).toLocaleString(
                                    'en-US',
                                    { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-400 flex items-center justify-end gap-1 mt-0.5">
                                  <span>{item.unrealizedPnLPercent >= 0 ? '+' : ''}{item.unrealizedPnLPercent.toFixed(1)}%</span>
                                  <span className="text-slate-600">•</span>
                                  <span>{Number(item.currentQuantity).toLocaleString()} หุ้น</span>
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-500 font-sans">
                                (ขายหมดแล้ว)
                              </span>
                            )}
                          </td>

                          {/* Dividends */}
                          <td className="text-right font-mono hidden md:table-cell">
                            {item.totalDividends > 0 ? (
                              <div>
                                <span className="text-xs font-bold text-emerald-400">
                                  +{sym}
                                  {Number(item.totalDividends).toLocaleString(
                                    'en-US',
                                    { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                                  )}
                                </span>
                                <div className="text-[10px] text-slate-500">
                                  {item.dividendCount} ครั้ง
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-500">—</span>
                            )}
                          </td>

                          {/* Total Lifetime Net Return */}
                          <td className="text-right font-mono">
                            <div
                              className={`text-sm sm:text-base font-extrabold tracking-tight ${
                                isNetProfit
                                  ? 'text-emerald-400'
                                  : 'text-rose-400'
                              }`}
                            >
                              {isNetProfit ? '+' : ''}฿
                              {Number(item.totalNetPnLBase).toLocaleString(
                                'en-US',
                                { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                              )}
                            </div>
                            <div className="flex items-center justify-end gap-1.5 mt-0.5">
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                  isNetProfit
                                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                    : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                                }`}
                              >
                                {isNetProfit ? '+' : ''}
                                {item.overallReturnPercent.toFixed(1)}%
                              </span>
                              {isUsd && (
                                <span className="text-[11px] text-slate-500 hidden sm:inline">
                                  (${isNetProfit ? '+' : ''}
                                  {Number(item.totalNetPnL).toLocaleString(
                                    'en-US',
                                    { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                                  )})
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Detail Toggle Icon */}
                          <td className="text-center">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleExpand(item.assetId)
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                              title={isExpanded ? 'ย่อรายละเอียด' : 'ขยายดูประวัติล็อตและรายการขาย'}
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4 text-indigo-400" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </button>
                          </td>
                        </tr>

                        {/* ── EXPANDED ACCORDION DRAWER ──────────────── */}
                        {isExpanded && (
                          <tr className="bg-slate-900/70 border-b border-indigo-500/20">
                            <td colSpan={7} className="p-4 sm:p-6">
                              <div className="space-y-4">
                                {/* Action Bar inside Drawer */}
                                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                                      เจาะลึกข้อมูลสินทรัพย์: {item.ticker} ({item.assetName})
                                    </span>
                                    <span className="text-xs text-slate-400 font-mono">
                                      ต้นทุนรวมทั้งหมด: ฿{Number(item.totalInvestedCapitalBase).toLocaleString()}
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setSelectedStock({
                                        symbol: item.ticker,
                                        name: item.assetName,
                                        market: item.market,
                                      })
                                    }
                                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-300 hover:text-white bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 flex items-center gap-1.5 transition-colors"
                                  >
                                    <span>เปิดการ์ดหุ้น & กราฟเทคนิค</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </button>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                  {/* Left: Active Lots (Currently Held) */}
                                  <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80">
                                    <div className="flex items-center justify-between mb-3">
                                      <div className="flex items-center gap-2">
                                        <Briefcase className="w-4 h-4 text-indigo-400" />
                                        <h4 className="text-xs font-bold text-white">
                                          1. ล็อตที่ยังถือครองอยู่ (Active Lots)
                                        </h4>
                                      </div>
                                      <span className="text-[11px] font-mono font-semibold text-slate-400">
                                        เหลือ {Number(item.currentQuantity).toLocaleString()} หุ้น
                                      </span>
                                    </div>

                                    {item.activeLots.length === 0 ? (
                                      <div className="py-8 text-center text-xs text-slate-500">
                                        ขายปิดสถานะหมดแล้ว ไม่มีล็อตหุ้นคงเหลือในมือ
                                      </div>
                                    ) : (
                                      <div className="overflow-x-auto">
                                        <table className="w-full text-left text-xs font-mono">
                                          <thead>
                                            <tr className="text-slate-400 border-b border-slate-800 text-[11px]">
                                              <th className="pb-2">วันที่ซื้อ</th>
                                              <th className="pb-2 text-right">จำนวน</th>
                                              <th className="pb-2 text-right">ต้นทุน/หน่วย</th>
                                              <th className="pb-2 text-right">มูลค่าต้นทุน</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-slate-800/60">
                                            {item.activeLots.map((lot, idx) => (
                                              <tr key={idx} className="hover:bg-slate-900/40">
                                                <td className="py-2 text-slate-300">
                                                  {new Date(lot.buyDate).toLocaleDateString('th-TH', {
                                                    day: 'numeric',
                                                    month: 'short',
                                                    year: '2-digit',
                                                  })}
                                                </td>
                                                <td className="py-2 text-right text-white font-semibold">
                                                  {Number(lot.quantity).toLocaleString()}
                                                </td>
                                                <td className="py-2 text-right text-slate-300">
                                                  {sym}{Number(lot.pricePerUnit).toFixed(2)}
                                                </td>
                                                <td className="py-2 text-right text-slate-200">
                                                  {sym}{Number(lot.totalCost).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                        <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between text-xs font-sans text-slate-400">
                                          <span>ต้นทุนเฉลี่ย: <strong className="font-mono text-white">{sym}{Number(item.avgCost).toFixed(2)}</strong></span>
                                          <span>ราคาปัจจุบัน: <strong className="font-mono text-emerald-400">{sym}{Number(item.currentPrice).toFixed(2)}</strong></span>
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  {/* Right: Realized Trades (Sold History FIFO) */}
                                  <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80">
                                    <div className="flex items-center justify-between mb-3">
                                      <div className="flex items-center gap-2">
                                        <History className="w-4 h-4 text-emerald-400" />
                                        <h4 className="text-xs font-bold text-white">
                                          2. ประวัติการขายในอดีต (Realized FIFO Trades)
                                        </h4>
                                      </div>
                                      <span className="text-[11px] font-mono font-semibold text-slate-400">
                                        ขายไป {item.realizedTrades.length} ไม้ ({Number(item.soldQuantity).toLocaleString()} หุ้น)
                                      </span>
                                    </div>

                                    {item.realizedTrades.length === 0 ? (
                                      <div className="py-8 text-center text-xs text-slate-500">
                                        ยังไม่เคยมีการขายหุ้นตัวนี้ เป็นสถานะถือยาว (Buy & Hold)
                                      </div>
                                    ) : (
                                      <div className="overflow-x-auto">
                                        <table className="w-full text-left text-xs font-mono">
                                          <thead>
                                            <tr className="text-slate-400 border-b border-slate-800 text-[11px]">
                                              <th className="pb-2">วันที่ขาย</th>
                                              <th className="pb-2 text-right">จำนวน</th>
                                              <th className="pb-2 text-right">ราคาขาย</th>
                                              <th className="pb-2 text-right">ต้นทุน FIFO</th>
                                              <th className="pb-2 text-right">กำไรที่ได้</th>
                                              <th className="pb-2 text-right">ถือครอง</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-slate-800/60">
                                            {item.realizedTrades.map((trade, idx) => {
                                              const tradeProfit = trade.realizedGain >= 0
                                              return (
                                                <tr key={idx} className="hover:bg-slate-900/40">
                                                  <td className="py-2 text-slate-300">
                                                    {new Date(trade.sellDate).toLocaleDateString('th-TH', {
                                                      day: 'numeric',
                                                      month: 'short',
                                                      year: '2-digit',
                                                    })}
                                                  </td>
                                                  <td className="py-2 text-right text-white font-semibold">
                                                    {Number(trade.quantity).toLocaleString()}
                                                  </td>
                                                  <td className="py-2 text-right text-slate-300">
                                                    {sym}{Number(trade.sellPrice).toFixed(2)}
                                                  </td>
                                                  <td className="py-2 text-right text-slate-400">
                                                    {sym}{Number(trade.costBasis).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                  </td>
                                                  <td
                                                    className={`py-2 text-right font-bold ${
                                                      tradeProfit
                                                        ? 'text-emerald-400'
                                                        : 'text-rose-400'
                                                    }`}
                                                  >
                                                    {tradeProfit ? '+' : ''}{sym}
                                                    {Number(trade.realizedGain).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                  </td>
                                                  <td className="py-2 text-right text-slate-400">
                                                    {trade.holdingDays} วัน
                                                  </td>
                                                </tr>
                                              )
                                            })}
                                          </tbody>
                                        </table>
                                        <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between text-xs font-sans text-slate-400">
                                          <span>รวมเงินที่รับจากการขาย: <strong className="font-mono text-white">{sym}{Number(item.realizedProceeds).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></span>
                                          <span>กำไรขายสะสม: <strong className={`font-mono ${isRealizedGain ? 'text-emerald-400' : 'text-rose-400'}`}>{isRealizedGain ? '+' : ''}{sym}{Number(item.realizedGain).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></span>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── TOAST NOTIFICATION ────────────────────────────────────── */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 p-4 rounded-2xl bg-[#131722]/95 border border-indigo-500/40 shadow-2xl backdrop-blur-md flex items-center gap-3 animate-in fade-in slide-in-from-bottom-5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/30">
              <Check className="w-4 h-4" />
            </div>
            <p className="text-xs font-bold text-white">{toastMessage}</p>
          </div>
        )}

        {/* Stock Detail Modal */}
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
