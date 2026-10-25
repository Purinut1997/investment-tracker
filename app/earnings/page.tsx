'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/PageHeader'
import {
  Calendar,
  Clock,
  TrendingUp,
  TrendingDown,
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
  Layers,
  Coins,
  LayoutGrid,
} from 'lucide-react'
import { StockEarningsCard } from '@/components/earnings/StockEarningsCard'
import { StockEarningsDetailModal } from '@/components/earnings/StockEarningsDetailModal'
import { AnalyzedEarningsData } from '@/lib/earnings/earnings-analyzer'
import { PortfolioEarningsItem, MarketEarningsItem } from '@/app/api/earnings/route'

const fetcher = (url: string) => fetch(url).then((res) => res.json())

// Featured ideas for 1-click discovery
const FEATURED_IDEAS = [
  { ticker: 'NVDA', market: 'US' as const, name: 'NVIDIA Corp', tag: 'AI Leader • โตแรง YoY' },
  { ticker: 'AAPL', market: 'US' as const, name: 'Apple Inc', tag: 'Mega Tech • ประกาศต้น พ.ย.' },
  { ticker: 'MSFT', market: 'US' as const, name: 'Microsoft Corp', tag: 'Cloud & AI' },
  { ticker: 'TSLA', market: 'US' as const, name: 'Tesla Inc', tag: 'EV & Robotaxi' },
  { ticker: 'PTT', market: 'TH' as const, name: 'PTT PCL', tag: 'พลังงานไทย' },
  { ticker: 'SCB', market: 'TH' as const, name: 'SCB X PCL', tag: 'กลุ่มธนาคารไทย' },
  { ticker: 'DELTA', market: 'TH' as const, name: 'Delta Electronics', tag: 'ชิ้นส่วนอิเล็กทรอนิกส์' },
]

export default function EarningsCalendarPage() {
  const { data, error, isLoading, mutate } = useSWR('/api/earnings', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  })

  const [searchQuery, setSearchQuery] = useState('')
  const [filterTab, setFilterTab] = useState<'portfolio' | 'urgent' | 'us' | 'th' | 'all'>('portfolio')
  const [selectedStock, setSelectedStock] = useState<{
    data: AnalyzedEarningsData
    userHolding?: any
  } | null>(null)

  // Standalone search state
  const [isSearchingExternal, setIsSearchingExternal] = useState(false)
  const [externalResult, setExternalResult] = useState<{
    data: AnalyzedEarningsData
    userHolding?: any
  } | null>(null)
  const [searchMarket, setSearchMarket] = useState<'TH' | 'US'>('US')
  const [searchError, setSearchError] = useState<string | null>(null)

  const summary = data?.summary
  const portfolioItems: PortfolioEarningsItem[] = data?.portfolioItems || []
  const marketItems: MarketEarningsItem[] = data?.marketItems || []

  // Combine items according to active tab & search
  const displayedItems = useMemo(() => {
    let baseList: Array<{
      earningsData: AnalyzedEarningsData
      userHolding?: any
    }> = []

    if (filterTab === 'portfolio') {
      baseList = portfolioItems.map((p) => ({
        earningsData: p.earningsData,
        userHolding: p.holding,
      }))
    } else if (filterTab === 'urgent') {
      // All items with report <= 14 days
      const all = [
        ...portfolioItems.map((p) => ({ earningsData: p.earningsData, userHolding: p.holding })),
        ...marketItems.map((m) => ({ earningsData: m.earningsData, userHolding: null })),
      ]
      baseList = all.filter(
        (item) =>
          item.earningsData.upcoming.daysRemaining >= 0 &&
          item.earningsData.upcoming.daysRemaining <= 14
      )
    } else if (filterTab === 'us') {
      const all = [
        ...portfolioItems.map((p) => ({ earningsData: p.earningsData, userHolding: p.holding })),
        ...marketItems.map((m) => ({ earningsData: m.earningsData, userHolding: null })),
      ]
      baseList = all.filter((item) => item.earningsData.market === 'US')
    } else if (filterTab === 'th') {
      const all = [
        ...portfolioItems.map((p) => ({ earningsData: p.earningsData, userHolding: p.holding })),
        ...marketItems.map((m) => ({ earningsData: m.earningsData, userHolding: null })),
      ]
      baseList = all.filter((item) => item.earningsData.market === 'TH')
    } else {
      // 'all'
      baseList = [
        ...portfolioItems.map((p) => ({ earningsData: p.earningsData, userHolding: p.holding })),
        ...marketItems.map((m) => ({ earningsData: m.earningsData, userHolding: null })),
      ]
    }

    // Apply text search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      baseList = baseList.filter(
        (item) =>
          item.earningsData.ticker.toLowerCase().includes(q) ||
          item.earningsData.companyName.toLowerCase().includes(q)
      )
    }

    return baseList
  }, [filterTab, portfolioItems, marketItems, searchQuery])

  // Handle external stock search
  const handleSearchExternal = async (tickerToSearch: string, marketChoice: 'TH' | 'US' = 'US') => {
    if (!tickerToSearch.trim()) return
    setIsSearchingExternal(true)
    setSearchError(null)

    try {
      const res = await fetch(
        `/api/earnings?search=${encodeURIComponent(tickerToSearch.trim())}&market=${marketChoice}`
      )
      if (!res.ok) {
        throw new Error(`ไม่พบข้อมูลผลประกอบการของ ${tickerToSearch.toUpperCase()}`)
      }
      const json = await res.json()
      setExternalResult({
        data: json.data,
        userHolding: json.userHolding,
      })
      setSelectedStock({
        data: json.data,
        userHolding: json.userHolding,
      })
    } catch (err: any) {
      setSearchError(err.message || 'เกิดข้อผิดพลาดในการดึงข้อมูล')
    } finally {
      setIsSearchingExternal(false)
    }
  }

  return (
    <AppShell>
      <div className="space-y-6 max-w-[1600px] mx-auto w-full animate-fade-in pb-16">
        {/* Page Header */}
        <PageHeader
          eyebrow="Corporate Earnings Intelligence & Calendar"
          title="ปฏิทินวันแจ้งผลประกอบการ & สรุปผลงานย้อนหลัง"
          description="ติดตามวันประกาศงบการเงินรายไตรมาส เปรียบเทียบตัวเลขที่ตลาดคาดหวังกับผลงานที่ทำได้จริง (Consensus vs Actual) พร้อมวิเคราะห์การเติบโตเทียบกับช่วงเดียวกันของปีก่อนหน้า (YoY)"
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/economic-calendar"
                className="bg-[#181C25] hover:bg-[#202532] text-slate-300 hover:text-white border border-white/[0.08] px-3.5 py-2 rounded-xl font-semibold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-sm active:scale-98"
              >
                <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                <span>ปฏิทินเศรษฐกิจโลก</span>
              </Link>

              <Link
                href="/dividends"
                className="bg-[#181C25] hover:bg-[#202532] text-slate-300 hover:text-white border border-white/[0.08] px-3.5 py-2 rounded-xl font-semibold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-sm active:scale-98"
              >
                <Coins className="w-3.5 h-3.5 text-amber-400" />
                <span>ปฏิทินปันผล & สถิติ XD</span>
              </Link>

              <Link
                href="/market-watch"
                className="bg-[#181C25] hover:bg-[#202532] text-slate-300 hover:text-white border border-white/[0.08] px-3.5 py-2 rounded-xl font-semibold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-sm active:scale-98"
              >
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                <span>กระดานจับตาตลาด</span>
              </Link>

              <button
                type="button"
                onClick={() => mutate()}
                disabled={isLoading}
                className="bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-200 border border-indigo-500/40 px-3.5 py-2 rounded-xl font-semibold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-sm active:scale-98 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                <span>รีเฟรชข้อมูล</span>
              </button>
            </div>
          }
        />

        {/* Hero KPI Summary Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: หุ้นในพอร์ตที่กำลังจะรายงานงบใน 30 วัน */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-[#121622] to-[#0D1017] border border-white/[0.08] relative overflow-hidden shadow-md">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
              <span className="flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-indigo-400" />
                <span>หุ้นในพอร์ตแจ้งงบใน 30 วัน</span>
              </span>
              <span className="text-[10px] text-indigo-300 bg-indigo-500/15 px-2 py-0.5 rounded-full border border-indigo-500/30 font-bold">
                Portfolio
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-white font-mono">
                {summary?.upcoming30DaysCount ?? 0}
              </span>
              <span className="text-xs text-slate-400 font-medium">บริษัท</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-400 truncate">
              จากหุ้นทั้งหมด {summary?.portfolioTotalHoldings ?? 0} ตัวในพอร์ต
            </p>
          </div>

          {/* Card 2: ใกล้มาก! ภายใน 7 วันนี้ */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-[#141824] to-[#0D1017] border border-white/[0.08] relative overflow-hidden shadow-md">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>แจ้งงบสัปดาห์นี้ (7 วัน)</span>
              </span>
              <span className="text-[10px] text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded-full border border-amber-500/30 font-bold">
                Urgent
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-amber-300 font-mono">
                {summary?.upcoming7DaysCount ?? 0}
              </span>
              <span className="text-xs text-slate-400 font-medium">บริษัท</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              ควรจับตาความผันผวนของราคาเป็นพิเศษ
            </p>
          </div>

          {/* Card 3: คิวถัดไปในพอร์ตที่ใกล้ที่สุด */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-[#141824] to-[#0D1017] border border-white/[0.08] relative overflow-hidden shadow-md">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
              <span className="flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5 text-emerald-400" />
                <span>คิวถัดไปในพอร์ต</span>
              </span>
              <span className="text-[10px] text-emerald-300 bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/30 font-bold">
                Next Up
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-xl sm:text-2xl font-black text-white font-mono">
                {summary?.closestHolding?.ticker || 'ไม่มีคิวเร็วๆ นี้'}
              </span>
              {summary?.closestHolding && (
                <span className="text-xs font-bold text-indigo-300 font-mono">
                  (อีก {summary.closestHolding.daysRemaining} วัน)
                </span>
              )}
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              {summary?.closestHolding?.dateThai
                ? `กำหนดประกาศ: ${summary.closestHolding.dateThai}`
                : 'รอประกาศวันอย่างเป็นทางการ'}
            </p>
          </div>

          {/* Card 4: AI Sentinel Coverage */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-[#141824] to-[#0D1017] border border-white/[0.08] relative overflow-hidden shadow-md">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span>AI Coverage & YoY Intel</span>
              </span>
              <span className="text-[10px] text-indigo-300 bg-indigo-500/15 px-2 py-0.5 rounded-full border border-indigo-500/30 font-bold">
                Live
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-indigo-300 font-mono">
                {portfolioItems.length + marketItems.length}
              </span>
              <span className="text-xs text-slate-400 font-medium">หุ้นที่ครอบคลุม</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              วิเคราะห์ตัวเลขคาดการณ์ & เทียบปีก่อนหน้าครบ
            </p>
          </div>
        </div>

        {/* Search & Quick Discovery Bar */}
        <div className="p-4 sm:p-5 rounded-2xl bg-[#12151C] border border-white/[0.08] space-y-3 shadow-md">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Search Input Box */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchQuery.trim()) {
                    handleSearchExternal(searchQuery, searchMarket)
                  }
                }}
                placeholder="พิมพ์ชื่อย่อหุ้น เช่น NVDA, TSLA, AAPL, PTT, SCB, DELTA..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#0C0F15] border border-white/[0.08] text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            {/* Market Selection Pill (US or Thai) for search */}
            <div className="flex items-center gap-1.5 bg-[#0C0F15] p-1 rounded-xl border border-white/[0.08] shrink-0">
              <button
                type="button"
                onClick={() => setSearchMarket('US')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  searchMarket === 'US'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                🇺🇸 US Stocks
              </button>
              <button
                type="button"
                onClick={() => setSearchMarket('TH')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  searchMarket === 'TH'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                🇹🇭 หุ้นไทย (SET)
              </button>
            </div>

            {/* Action Search Button */}
            <button
              type="button"
              onClick={() => handleSearchExternal(searchQuery, searchMarket)}
              disabled={isSearchingExternal || !searchQuery.trim()}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md active:scale-98 disabled:opacity-50 shrink-0"
            >
              {isSearchingExternal ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Search className="w-3.5 h-3.5" />
              )}
              <span>ค้นหาละเอียด</span>
            </button>
          </div>

          {/* Quick Idea Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pt-1 scrollbar-none">
            <span className="text-[11px] font-bold text-slate-400 shrink-0">สำรวจด่วน:</span>
            {FEATURED_IDEAS.map((idea) => (
              <button
                key={idea.ticker}
                type="button"
                onClick={() => handleSearchExternal(idea.ticker, idea.market)}
                className="px-2.5 py-1 rounded-lg bg-[#181C25] hover:bg-indigo-600/20 text-slate-300 hover:text-indigo-200 border border-white/[0.06] hover:border-indigo-500/40 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
              >
                <span className="font-bold">{idea.ticker}</span>
                <span className="text-[10px] text-slate-400">{idea.tag}</span>
              </button>
            ))}
          </div>

          {searchError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-center gap-2">
              <Info className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{searchError}</span>
            </div>
          )}
        </div>

        {/* View Mode & Filter Tabs */}
        <div className="flex items-center justify-between gap-3 flex-wrap border-b border-white/[0.08] pb-3">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
            <button
              type="button"
              onClick={() => setFilterTab('portfolio')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shrink-0 border ${
                filterTab === 'portfolio'
                  ? 'bg-indigo-600/20 text-indigo-200 border-indigo-500/50 shadow-md shadow-indigo-500/10'
                  : 'bg-[#12151C] text-slate-400 hover:text-white border-white/[0.06]'
              }`}
            >
              <Wallet className="w-3.5 h-3.5" />
              <span>หุ้นในพอร์ตของฉัน ({portfolioItems.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setFilterTab('urgent')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shrink-0 border ${
                filterTab === 'urgent'
                  ? 'bg-amber-500/20 text-amber-200 border-amber-500/50 shadow-md shadow-amber-500/10'
                  : 'bg-[#12151C] text-slate-400 hover:text-white border-white/[0.06]'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>เร็วๆ นี้ (ภายใน 14 วัน)</span>
            </button>

            <button
              type="button"
              onClick={() => setFilterTab('us')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shrink-0 border ${
                filterTab === 'us'
                  ? 'bg-blue-600/20 text-blue-200 border-blue-500/50 shadow-md shadow-blue-500/10'
                  : 'bg-[#12151C] text-slate-400 hover:text-white border-white/[0.06]'
              }`}
            >
              <span>🇺🇸 ตลาดสหรัฐฯ (US)</span>
            </button>

            <button
              type="button"
              onClick={() => setFilterTab('th')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shrink-0 border ${
                filterTab === 'th'
                  ? 'bg-emerald-600/20 text-emerald-200 border-emerald-500/50 shadow-md shadow-emerald-500/10'
                  : 'bg-[#12151C] text-slate-400 hover:text-white border-white/[0.06]'
              }`}
            >
              <span>🇹🇭 หุ้นไทย (SET)</span>
            </button>

            <button
              type="button"
              onClick={() => setFilterTab('all')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shrink-0 border ${
                filterTab === 'all'
                  ? 'bg-indigo-600/20 text-indigo-200 border-indigo-500/50 shadow-md shadow-indigo-500/10'
                  : 'bg-[#12151C] text-slate-400 hover:text-white border-white/[0.06]'
              }`}
            >
              <span>ทั้งหมด ({portfolioItems.length + marketItems.length})</span>
            </button>
          </div>

          <span className="text-xs text-slate-400 font-mono">
            แสดง {displayedItems.length} หุ้น • คลิกที่การ์ดเพื่อดูชาร์ต & งบย้อนหลัง
          </span>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-28 rounded-2xl bg-[#12151C] border border-white/[0.06] animate-pulse"
              />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && displayedItems.length === 0 && (
          <div className="p-12 text-center rounded-3xl bg-[#12151C] border border-white/[0.08] space-y-3">
            <Calendar className="w-12 h-12 text-slate-500 mx-auto" />
            <h3 className="text-base font-bold text-white">ไม่พบรายการผลประกอบการที่ตรงกับเงื่อนไข</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              ลองเปลี่ยนคำค้นหา หรือคลิกที่แท็บ &quot;ทั้งหมด&quot; เพื่อดูหุ้นยอดนิยมที่ระบบกำลังติดตามอยู่
            </p>
            <button
              type="button"
              onClick={() => {
                setFilterTab('all')
                setSearchQuery('')
              }}
              className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold text-xs cursor-pointer inline-flex items-center gap-2"
            >
              <span>ดูหุ้นยอดนิยมทั้งหมด</span>
            </button>
          </div>
        )}

        {/* Cards List */}
        {!isLoading && displayedItems.length > 0 && (
          <div className="space-y-3">
            {displayedItems.map((item) => (
              <StockEarningsCard
                key={`${item.earningsData.ticker}_${item.earningsData.market}`}
                data={item.earningsData}
                userHolding={item.userHolding}
                onClick={() => setSelectedStock({ data: item.earningsData, userHolding: item.userHolding })}
              />
            ))}
          </div>
        )}

        {/* Stock Detail Modal */}
        {selectedStock && (
          <StockEarningsDetailModal
            data={selectedStock.data}
            userHolding={selectedStock.userHolding}
            onClose={() => setSelectedStock(null)}
          />
        )}
      </div>
    </AppShell>
  )
}
