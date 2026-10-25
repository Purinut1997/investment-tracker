'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/PageHeader'
import {
  Coins,
  Calendar,
  Clock,
  TrendingDown,
  TrendingUp,
  Search,
  Percent,
  Wallet,
  Sparkles,
  BarChart3,
  CalendarDays,
  ShieldCheck,
  RefreshCw,
  ExternalLink,
  ArrowRight,
  Info,
  HelpCircle,
} from 'lucide-react'
import { StockDividendCard } from '@/components/dividends/StockDividendCard'
import { StockDividendDetailModal } from '@/components/dividends/StockDividendDetailModal'
import { AnalyzedDividendData } from '@/lib/dividends/dividend-analyzer'
import { PortfolioDividendItem } from '@/app/api/dividends/route'

const fetcher = (url: string) => fetch(url).then((res) => res.json())

// Featured dividend benchmark tickers for quick exploration
const FEATURED_IDEAS = [
  { ticker: 'SCB', market: 'TH' as const, name: 'SCB X PCL', tag: 'ปันผลสูง ~7.5%' },
  { ticker: 'PTT', market: 'TH' as const, name: 'PTT PCL', tag: 'พลังงาน ยิลด์ ~6.2%' },
  { ticker: 'SCHD', market: 'US' as const, name: 'Schwab US Dividend ETF', tag: 'ETF ปันผลยอดนิยม' },
  { ticker: 'VOO', market: 'US' as const, name: 'Vanguard S&P 500 ETF', tag: 'S&P 500 ปันผลรายไตรมาส' },
  { ticker: 'O', market: 'US' as const, name: 'Realty Income Corp', tag: 'ปันผลทุกเดือน (Monthly)' },
]

export default function DividendsPage() {
  const { data, error, isLoading, mutate } = useSWR('/api/dividends', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  })

  const [searchQuery, setSearchQuery] = useState('')
  const [filterTab, setFilterTab] = useState<'all' | 'soon' | 'high_yield' | 'th' | 'us'>('all')
  const [selectedStock, setSelectedStock] = useState<{
    data: AnalyzedDividendData
    userHolding?: any
  } | null>(null)

  // Standalone search state for stocks not in portfolio
  const [isSearchingExternal, setIsSearchingExternal] = useState(false)
  const [externalResult, setExternalResult] = useState<{
    data: AnalyzedDividendData
    userHolding?: any
  } | null>(null)
  const [searchMarket, setSearchMarket] = useState<'TH' | 'US'>('US')
  const [searchError, setSearchError] = useState<string | null>(null)

  const summary = data?.summary
  const items: PortfolioDividendItem[] = data?.items || []

  // Filter items based on active tab and search
  const filteredHoldings = useMemo(() => {
    return items.filter((item) => {
      const { holding, dividendData } = item

      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchTicker = holding.ticker.toLowerCase().includes(q)
        const matchName = holding.assetName.toLowerCase().includes(q)
        if (!matchTicker && !matchName) return false
      }

      // 2. Tab Filter
      if (filterTab === 'soon') {
        if (dividendData.upcomingDividend.daysRemaining > 30) return false
      } else if (filterTab === 'high_yield') {
        const yieldVal = item.userMetrics.dividendYieldPercent || dividendData.latestDividend?.yieldPercent || 0
        if (yieldVal < 4.0) return false
      } else if (filterTab === 'th') {
        if (holding.market !== 'TH') return false
      } else if (filterTab === 'us') {
        if (holding.market !== 'US') return false
      }

      return true
    })
  }, [items, searchQuery, filterTab])

  // Handle external stock search
  const handleSearchExternal = async (tickerToSearch: string, marketChoice: 'TH' | 'US' = 'US') => {
    if (!tickerToSearch.trim()) return
    setIsSearchingExternal(true)
    setSearchError(null)

    try {
      const res = await fetch(`/api/dividends?search=${encodeURIComponent(tickerToSearch.trim())}&market=${marketChoice}`)
      if (!res.ok) {
        throw new Error('ไม่พบข้อมูลปันผลของหุ้นนี้')
      }
      const json = await res.json()
      setExternalResult(json)
      setSelectedStock(json)
    } catch (err: any) {
      setSearchError(err.message || 'ไม่สามารถค้นหาข้อมูลได้')
    } finally {
      setIsSearchingExternal(false)
    }
  }

  return (
    <AppShell>
      <div className="space-y-6 max-w-[1600px] mx-auto w-full animate-fade-in pb-16">
        {/* Page Header */}
        <PageHeader
          eyebrow="Dividend Intelligence & Ex-Dividend Analytics"
          title="ปฏิทินปันผล & สถิติหุ้นวันขึ้น XD (Dividend Tracker)"
          description="ติดตามกำหนดการขึ้นเครื่องหมาย XD ของหุ้นในพอร์ต นับถอยหลังรอบจ่ายถัดไป ตรวจสอบสถิติปันผลย้อนหลัง 5 ปี และวิเคราะห์ราคาหุ้นร่วง/ฟื้นตัวหลัง XD"
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/performance"
                className="bg-[#181C25] hover:bg-[#202532] text-slate-300 hover:text-white border border-white/[0.08] px-3.5 py-2 rounded-xl font-semibold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-sm active:scale-98"
              >
                <BarChart3 className="w-3.5 h-3.5 text-indigo-400" />
                <span>ผลตอบแทนรายตัว</span>
              </Link>

              <Link
                href="/earnings"
                className="bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-200 hover:text-white border border-indigo-500/40 px-3.5 py-2 rounded-xl font-semibold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-sm active:scale-98"
              >
                <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                <span>ปฏิทินผลประกอบการ & งบย้อนหลัง</span>
              </Link>

              <Link
                href="/economic-calendar"
                className="bg-[#181C25] hover:bg-[#202532] text-slate-300 hover:text-white border border-white/[0.08] px-3.5 py-2 rounded-xl font-semibold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-sm active:scale-98"
              >
                <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                <span>ปฏิทินเศรษฐกิจโลก</span>
              </Link>
            </div>
          }
        />

        {/* Top KPI Metrics Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Card 1: Annual Projected Dividend Income */}
          <div className="p-4 rounded-2xl bg-[#12151C] border border-white/[0.08] relative overflow-hidden shadow-lg shadow-black/20">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold">เงินปันผลคาดการณ์ทั้งปี</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Coins className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-extrabold text-white font-mono tracking-tight">
              {summary ? `฿${summary.totalPortfolioAnnualIncomeBase.toLocaleString()}` : '฿0.00'}
            </div>
            <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
              <span>Dividend Yield:</span>
              <strong className="text-emerald-400 font-mono">
                {summary ? `${summary.weightedYieldPercent}%` : '0%'}
              </strong>
              <span className="text-slate-600">•</span>
              <span>YoC:</span>
              <strong className="text-indigo-300 font-mono">
                {summary ? `${summary.weightedYieldOnCostPercent}%` : '0%'}
              </strong>
            </div>
          </div>

          {/* Card 2: Next Expected Payout */}
          <div className="p-4 rounded-2xl bg-[#12151C] border border-white/[0.08] relative overflow-hidden shadow-lg shadow-black/20">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold">รอบปันผลถัดไป (ใน 60 วัน)</span>
              <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
                <Calendar className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-extrabold text-indigo-300 font-mono tracking-tight">
              {summary ? `฿${summary.totalNextExpectedPayoutBase.toLocaleString()}` : '฿0.00'}
            </div>
            <div className="mt-1 text-[11px] text-slate-400 truncate">
              {items.length > 0 ? (
                <>
                  ตัวถัดไป: <strong className="text-white">{items[0].holding.ticker}</strong> (อีก {items[0].dividendData.upcomingDividend.daysRemaining} วัน)
                </>
              ) : (
                'ไม่มีรอบปันผลเร็วๆ นี้'
              )}
            </div>
          </div>

          {/* Card 3: Upcoming XD Count */}
          <div className="p-4 rounded-2xl bg-[#12151C] border border-white/[0.08] relative overflow-hidden shadow-lg shadow-black/20">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold">หุ้นขึ้น XD ใน 30 วัน</span>
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-extrabold text-amber-300 font-mono tracking-tight">
              {items.filter((i) => i.dividendData.upcomingDividend.daysRemaining <= 30).length} ตัว
            </div>
            <div className="mt-1 text-[11px] text-slate-400">
              จากหุ้นทั้งหมด {items.length} ตัวในพอร์ต
            </div>
          </div>

          {/* Card 4: Average XD Recovery Days */}
          <div className="p-4 rounded-2xl bg-[#12151C] border border-white/[0.08] relative overflow-hidden shadow-lg shadow-black/20">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold">สถิติฟื้นตัวหลัง XD เฉลี่ย</span>
              <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center">
                <TrendingDown className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-extrabold text-sky-300 font-mono tracking-tight">
              {summary ? `${summary.portfolioAvgRecoveryDays} วัน` : '-'}
            </div>
            <div className="mt-1 text-[11px] text-slate-400">
              ราคาเปิดร่วงเฉลี่ย: <strong className="text-amber-400 font-mono">{summary ? `${summary.portfolioAvgDropPercent}%` : '-'}</strong>
            </div>
          </div>
        </div>

        {/* Search, Filter Toolbar & Explorer */}
        <div className="p-3.5 rounded-2xl bg-[#12151C] border border-white/[0.08] space-y-3 shadow-lg shadow-black/20">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[280px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchQuery.trim()) {
                    handleSearchExternal(searchQuery, searchMarket)
                  }
                }}
                placeholder="ค้นหาหุ้นในพอร์ต หรือพิมพ์ Ticker ใดๆ เช่น SCB, PTT, SCHD, VOO, O, AAPL..."
                className="w-full bg-[#181C25] border border-white/[0.08] rounded-xl pl-9 pr-24 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-indigo-500/50 transition-all"
              />

              {/* Quick Search Action Button inside search input */}
              <button
                type="button"
                onClick={() => handleSearchExternal(searchQuery, searchMarket)}
                disabled={!searchQuery.trim() || isSearchingExternal}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold text-[11px] transition-all cursor-pointer shadow-xs flex items-center gap-1"
              >
                {isSearchingExternal ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : (
                  <>
                    <span>ค้นหา</span>
                    <ArrowRight className="w-3 h-3" />
                  </>
                )}
              </button>
            </div>

            {/* Market selector for external search */}
            <div className="flex items-center bg-[#181C25] border border-white/[0.08] rounded-xl p-1 text-xs">
              <button
                type="button"
                onClick={() => setSearchMarket('TH')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                  searchMarket === 'TH' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>🇹🇭 หุ้นไทย (SET)</span>
              </button>
              <button
                type="button"
                onClick={() => setSearchMarket('US')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                  searchMarket === 'US' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>🇺🇸 สหรัฐฯ (US)</span>
              </button>
            </div>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => mutate()}
              className="p-2 rounded-xl bg-[#181C25] hover:bg-[#202532] text-slate-400 hover:text-white border border-white/[0.08] transition-colors cursor-pointer"
              title="รีเฟรชข้อมูล"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 scrollbar-none pt-1 border-t border-white/[0.04]">
            <div className="flex items-center gap-1.5">
              {[
                { id: 'all', label: '🌟 ทั้งหมดในพอร์ต' },
                { id: 'soon', label: '⚡ ขึ้น XD ใน 30 วัน' },
                { id: 'high_yield', label: '💰 ปันผลสูง (> 4%)' },
                { id: 'th', label: '🇹🇭 หุ้นไทย' },
                { id: 'us', label: '🇺🇸 หุ้นสหรัฐฯ' },
              ].map((tab) => {
                const isActive = filterTab === tab.id
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setFilterTab(tab.id as any)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all cursor-pointer border ${
                      isActive
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                        : 'bg-[#181C25] text-slate-400 hover:text-white hover:bg-white/[0.04] border-white/[0.06]'
                    }`}
                  >
                    {tab.label}
                  </button>
                )
              })}
            </div>

            <div className="text-xs text-slate-400 shrink-0 pl-2">
              พบ <strong className="text-white">{filteredHoldings.length}</strong> ตัว
            </div>
          </div>
        </div>

        {/* Featured Dividend Ideas Quick Chips (Click to view analysis immediately) */}
        <div className="p-3.5 rounded-2xl bg-[#0F131D] border border-white/[0.06] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-indigo-300 font-semibold shrink-0">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span>ค้นหาด่วนตัวอย่างหุ้นปันผลเด่น:</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {FEATURED_IDEAS.map((idea) => (
              <button
                key={idea.ticker}
                type="button"
                onClick={() => {
                  setSearchQuery(idea.ticker)
                  setSearchMarket(idea.market)
                  handleSearchExternal(idea.ticker, idea.market)
                }}
                className="px-2.5 py-1 rounded-xl bg-[#161B28] hover:bg-indigo-600/30 text-slate-300 hover:text-white border border-white/[0.08] text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <span>{idea.market === 'TH' ? '🇹🇭' : '🇺🇸'}</span>
                <strong>{idea.ticker}</strong>
                <span className="text-[10px] text-slate-400">• {idea.tag}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Search Error Alert */}
        {searchError && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center justify-between">
            <span>{searchError}</span>
            <button
              type="button"
              onClick={() => setSearchError(null)}
              className="text-rose-400 hover:text-white"
            >
              ปิด
            </button>
          </div>
        )}

        {/* Main List of Holdings */}
        <div className="space-y-3">
          {isLoading ? (
            <div className="p-16 text-center rounded-2xl bg-[#12151C] border border-white/[0.08] space-y-3">
              <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mx-auto" />
              <div className="text-sm font-bold text-slate-300">กำลังวิเคราะห์ข้อมูลปันผลและสถิติ XD...</div>
              <p className="text-xs text-slate-500">
                ประมวลผลข้อมูลปันผลย้อนหลัง 5 ปี ความถี่การจ่าย และอัตราการฟื้นตัวของราคาหุ้น
              </p>
            </div>
          ) : filteredHoldings.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-[#12151C] border border-white/[0.08] space-y-3">
              <Coins className="w-10 h-10 text-slate-600 mx-auto" />
              <h3 className="text-sm font-bold text-slate-300">
                {items.length === 0
                  ? 'ยังไม่มีหุ้นปันผลในพอร์ตของคุณ'
                  : 'ไม่พบหุ้นที่ตรงกับตัวกรองที่เลือก'}
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                {items.length === 0
                  ? 'เมื่อคุณเพิ่มรายการซื้อหุ้นหรือ ETF เข้ามาในพอร์ต ระบบจะนำมาวิเคราะห์ปฏิทินปันผล วันขึ้น XD และสถิติให้โดยอัตโนมัติ'
                  : 'ลองเปลี่ยนคำค้นหาหรือปรับตัวกรองเพื่อดูหุ้นปันผลทั้งหมด'}
              </p>
              {items.length === 0 && (
                <div className="pt-2 flex items-center justify-center gap-3">
                  <Link
                    href="/transactions"
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors cursor-pointer shadow-sm"
                  >
                    บันทึกธุรกรรมซื้อหุ้น
                  </Link>
                </div>
              )}
            </div>
          ) : (
            filteredHoldings.map((item) => (
              <StockDividendCard
                key={item.holding.assetId}
                data={item.dividendData}
                userHolding={item.userMetrics ? { ...item.userMetrics, quantity: item.holding.quantity, avgCost: item.holding.avgCost, currentValue: item.holding.currentValue } : null}
                baseCurrency={summary?.baseCurrency || 'THB'}
                onClick={() =>
                  setSelectedStock({
                    data: item.dividendData,
                    userHolding: item.userMetrics ? { ...item.userMetrics, quantity: item.holding.quantity, avgCost: item.holding.avgCost, currentValue: item.holding.currentValue } : null,
                  })
                }
              />
            ))
          )}
        </div>

        {/* Stock Detail Modal */}
        {selectedStock && (
          <StockDividendDetailModal
            data={selectedStock.data}
            userHolding={selectedStock.userHolding}
            baseCurrency={summary?.baseCurrency || 'THB'}
            onClose={() => setSelectedStock(null)}
          />
        )}
      </div>
    </AppShell>
  )
}
