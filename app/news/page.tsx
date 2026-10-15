'use client'

import React, { useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/PageHeader'
import {
  Newspaper,
  Loader2,
  RefreshCw,
  AlertCircle,
  Search,
  Calendar,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  History,
  Sparkles,
} from 'lucide-react'
import { AiPortfolioBriefCard } from '@/components/news/AiPortfolioBriefCard'
import { HoldingsSentimentBar, HoldingSummaryItem } from '@/components/news/HoldingsSentimentBar'
import { ActionableNewsCard, EnrichedNewsItem } from '@/components/news/ActionableNewsCard'
import { NewsDeepDiveModal } from '@/components/news/NewsDeepDiveModal'
import type { NewsCategory } from '@/lib/news/news-analyzer'

const CATEGORY_TABS: Array<{ id: NewsCategory; label: string; icon: string }> = [
  { id: 'portfolio', label: 'กระทบพอร์ตโดยตรง', icon: '🎯' },
  { id: 'earnings', label: 'งบการเงิน & รายได้', icon: '📢' },
  { id: 'macro', label: 'มหภาค & ดอกเบี้ย FED', icon: '🏛️' },
  { id: 'general', label: 'ตลาดการเงินโลก', icon: '🌐' },
]

function getTodayBangkokDateString(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return formatter.format(new Date())
}

function formatThaiDate(dateStr: string): string {
  try {
    const [year, month, day] = dateStr.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    return date.toLocaleDateString('th-TH', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

function shiftDate(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const d = new Date(year, month - 1, day)
  d.setDate(d.getDate() + days)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export default function NewsPage() {
  const [category, setCategory] = useState<NewsCategory>('portfolio')
  const [selectedTicker, setSelectedTicker] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [deepDiveItem, setDeepDiveItem] = useState<EnrichedNewsItem | null>(null)
  const [showRawNews, setShowRawNews] = useState(true)

  const todayStr = React.useMemo(() => getTodayBangkokDateString(), [])
  const [selectedDate, setSelectedDate] = useState<string>(todayStr)
  const isToday = selectedDate === todayStr

  const queryParams = new URLSearchParams({
    category,
    ...(selectedTicker && { symbol: selectedTicker }),
    ...(selectedDate && { date: selectedDate }),
  })

  const { data, isLoading, error, mutate: revalidate } = useSWR(
    `/api/news?${queryParams.toString()}`,
    { refreshInterval: isToday ? 120000 : 0 }
  )

  const newsItems: EnrichedNewsItem[] = Array.isArray(data?.items) ? data.items : []
  const userHoldings: HoldingSummaryItem[] = Array.isArray(data?.userHoldingsSummary)
    ? data.userHoldingsSummary
    : []
  const dailyBrief = data?.dailyBrief ?? null
  const historyDates = Array.isArray(data?.historyDates) ? data.historyDates : []

  // Local filter for search query
  const filteredItems = newsItems.filter((item) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      item.headline.toLowerCase().includes(q) ||
      (item.summary && item.summary.toLowerCase().includes(q)) ||
      (item.symbol && item.symbol.toLowerCase().includes(q)) ||
      (item.synthesis?.impactTag && item.synthesis.impactTag.toLowerCase().includes(q))
    )
  })

  const handleRefreshBrief = async () => {
    try {
      const res = await fetch('/api/news/brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate }),
      })
      if (res.ok) {
        await revalidate()
      }
    } catch (err) {
      console.error('Failed to refresh brief', err)
    }
  }

  return (
    <AppShell>
      <div className="space-y-6 max-w-[1600px] mx-auto w-full animate-fade-in pb-16">
        {/* Header */}
        <PageHeader
          eyebrow="Market Intelligence"
          title="สรุปข่าวสาร & กลยุทธ์พอร์ตประจำวัน"
          description="สรุปเหตุการณ์สำคัญรอบวัน มุมมองตลาด ผลกระทบต่อพอร์ตของคุณ แนวทางระยะสั้น-กลาง-ยาว และหุ้นน่าจับตาในที่เดียว"
          action={
            <div className="flex items-center gap-2">
              <Link
                href="/economic-calendar"
                className="bg-[#181C25] hover:bg-[#202532] text-slate-200 hover:text-white border border-white/[0.08] px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-sm active:scale-98"
              >
                <Calendar className="w-4 h-4 text-indigo-400" />
                <span>ปฏิทินเศรษฐกิจ</span>
              </Link>
              <button
                onClick={() => revalidate()}
                className="bg-[#181C25] hover:bg-[#202532] text-slate-200 hover:text-white border border-white/[0.08] px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-sm"
              >
                <RefreshCw className="w-4 h-4 text-indigo-400" />
                <span>รีเฟรชข้อมูล</span>
              </button>
            </div>
          }
        />

        {/* Daily History Date Navigator Bar */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-[#12151C] border border-white/[0.08] shadow-lg shadow-black/20 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Date Navigation & Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center bg-[#181C25] p-1 rounded-xl border border-white/[0.08]">
              <button
                onClick={() => setSelectedDate(shiftDate(selectedDate, -1))}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
                title="วันก่อนหน้า"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <button
                onClick={() => setSelectedDate(todayStr)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  isToday
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-white/[0.06]'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isToday ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                <span>วันนี้</span>
              </button>

              <button
                onClick={() => setSelectedDate(shiftDate(selectedDate, 1))}
                disabled={isToday}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
                title="วันถัดไป"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Date Picker Input */}
            <div className="flex items-center gap-2 bg-[#181C25] px-3 py-1.5 rounded-xl border border-white/[0.08]">
              <Calendar className="w-4 h-4 text-indigo-400 shrink-0" />
              <input
                type="date"
                value={selectedDate}
                max={todayStr}
                onChange={(e) => {
                  if (e.target.value) setSelectedDate(e.target.value)
                }}
                className="bg-transparent text-xs sm:text-sm text-slate-200 focus:outline-none cursor-pointer scheme-dark"
              />
              <span className="text-xs text-slate-400 font-mono hidden sm:inline">
                ({formatThaiDate(selectedDate)})
              </span>
            </div>
          </div>

          {/* History Archive Chips / Quick Access */}
          {historyDates.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              <span className="text-xs text-slate-400 font-medium shrink-0 flex items-center gap-1 mr-1">
                <History className="w-3.5 h-3.5 text-indigo-400" />
                <span className="hidden lg:inline">ประวัติที่บันทึก:</span>
              </span>
              {historyDates.slice(0, 5).map((item: any) => {
                const isSelected = item.briefDate === selectedDate
                const isBull = item.overallSentiment === 'bullish'
                const isBear = item.overallSentiment === 'bearish'
                const dotColor = isBull ? 'bg-emerald-400' : isBear ? 'bg-rose-400' : 'bg-amber-400'

                return (
                  <button
                    key={item.briefDate}
                    onClick={() => setSelectedDate(item.briefDate)}
                    className={`px-2.5 py-1 rounded-xl text-xs font-mono font-medium shrink-0 flex items-center gap-1.5 transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-indigo-600/30 text-indigo-200 border-indigo-500/50 shadow-sm'
                        : 'bg-[#181C25] hover:bg-[#202532] text-slate-300 border-white/[0.06]'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                    <span>{item.briefDate === todayStr ? 'วันนี้' : formatThaiDate(item.briefDate)}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* AI Portfolio Daily Brief (Executive Digest: 6 Core Pillars) or Empty State */}
        {dailyBrief ? (
          <AiPortfolioBriefCard
            brief={dailyBrief}
            onRefreshBrief={handleRefreshBrief}
            isHistorical={!isToday}
            selectedDate={selectedDate}
            onBackToToday={() => setSelectedDate(todayStr)}
          />
        ) : (
          <div className="rounded-3xl bg-[#12151C] border border-white/[0.08] p-8 text-center space-y-4 shadow-xl shadow-black/20">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <History className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base sm:text-lg font-bold text-white">
                ไม่พบบันทึกประวัติของวันที่ {formatThaiDate(selectedDate)}
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
                ไม่มีบันทึกสรุปข่าวกรองและกลยุทธ์พอร์ตที่บันทึกไว้ในวันดังกล่าว คุณสามารถเลือกวันที่บันทึกไว้ด้านบน หรือกลับสู่บทสรุปปัจจุบัน
              </p>
            </div>
            <div className="pt-2 flex justify-center">
              <button
                onClick={() => setSelectedDate(todayStr)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-indigo-600/30"
              >
                <Sparkles className="w-4 h-4 text-indigo-200" />
                <span>กลับสู่บทสรุปวันนี้</span>
              </button>
            </div>
          </div>
        )}

        {/* Underlying News Feed Section (Collapsible & Filterable) */}
        <div className="space-y-4 pt-2">
          {/* Section Divider & Toggle Header */}
          <div className="p-4 sm:p-5 rounded-2xl bg-[#12151C] border border-white/[0.08] flex flex-col md:flex-row md:items-center justify-between gap-3.5 shadow-lg shadow-black/20">
            <div className="flex items-center justify-between w-full md:w-auto gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <Newspaper className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <h3 className="text-base sm:text-lg font-bold text-white tracking-wide">
                      คลังข่าวต้นฉบับ & บทวิเคราะห์รายตัว
                    </h3>
                    <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-white/[0.06] text-slate-300 border border-white/[0.08]">
                      {filteredItems.length} ข่าว
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-300 mt-1">
                    สำหรับเจาะลึกข่าวต้นทางภาษาอังกฤษ พร้อมบทวิเคราะห์ AI 3 บรรทัดและแบบจำลองสถานการณ์
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowRawNews(!showRawNews)}
                className="p-2 rounded-xl bg-[#181C25] text-slate-300 hover:text-white border border-white/[0.08] transition-colors md:hidden"
              >
                {showRawNews ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex items-center gap-2.5 self-end md:self-auto w-full md:w-auto justify-end">
              {/* Search Box */}
              <div className="relative flex-1 md:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="ค้นหาตามชื่อหุ้นหรือหัวข้อ..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#181C25] border border-white/[0.08] rounded-xl pl-9 pr-3 py-2 text-xs sm:text-sm text-white placeholder-slate-400 outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              <button
                onClick={() => setShowRawNews(!showRawNews)}
                className="hidden md:flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#181C25] hover:bg-[#202532] text-slate-300 hover:text-white border border-white/[0.08] text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
              >
                <span>{showRawNews ? 'ซ่อนฟีดข่าว' : 'แสดงฟีดข่าว'}</span>
                {showRawNews ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4 text-indigo-400" />}
              </button>
            </div>
          </div>

          {showRawNews && (
            <div className="space-y-4 animate-fade-in">
              {/* Holdings Sentiment Quick Filter Pills */}
              {userHoldings.length > 0 && (
                <HoldingsSentimentBar
                  holdings={userHoldings}
                  selectedTicker={selectedTicker}
                  onSelectTicker={(ticker) => {
                    setSelectedTicker(ticker)
                    if (ticker) {
                      setCategory('portfolio')
                    }
                  }}
                />
              )}

              {/* Categories Tabs */}
              <div className="flex flex-wrap bg-[#12151C] p-1.5 rounded-2xl border border-white/[0.08] gap-1.5 shadow-lg shadow-black/20">
                {CATEGORY_TABS.map((tab) => {
                  const isActive = category === tab.id
                  return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setCategory(tab.id)
                        setSelectedTicker('')
                      }}
                      className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center gap-2 ${
                        isActive
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-slate-300 hover:text-white hover:bg-white/[0.04]'
                      }`}
                    >
                      <span>{tab.icon}</span>
                      <span>{tab.label}</span>
                    </button>
                  )
                })}
              </div>

              {/* News Feed Grid */}
              {isLoading ? (
                <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-500">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                  <span className="text-xs font-medium">กำลังโหลดและวิเคราะห์ข่าวสารล่าสุด...</span>
                </div>
              ) : error ? (
                <div className="p-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-center flex flex-col items-center justify-center">
                  <AlertCircle className="w-8 h-8 text-rose-400 mb-3" />
                  <p className="text-xs text-rose-300 mb-4">ไม่สามารถโหลดฟีดข่าวสารได้ในขณะนี้</p>
                  <button
                    onClick={() => revalidate()}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-semibold text-white cursor-pointer"
                  >
                    ลองอีกครั้ง
                  </button>
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="p-16 rounded-2xl bg-[#12151C] border border-white/[0.08] text-center flex flex-col items-center justify-center min-h-[300px] shadow-xl shadow-black/30">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-4">
                    <Newspaper className="w-7 h-7" />
                  </div>
                  <h3 className="font-bold text-white text-base mb-1">
                    {searchQuery ? 'ไม่พบข่าวที่ตรงกับคำค้นหา' : 'ยังไม่มีข่าวในหมวดนี้'}
                  </h3>
                  <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
                    {searchQuery
                      ? 'ลองค้นหาด้วยคำอื่น หรือกดล้างคำค้นหา'
                      : 'ระบบจะอัปเดตฟีดข่าวสารอัตโนมัติเมื่อมีข่าวใหม่ที่เกี่ยวข้องกับสินทรัพย์ของคุณ'}
                  </p>
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="mt-4 px-3.5 py-1.5 rounded-xl bg-slate-800 text-xs text-slate-300 hover:text-white cursor-pointer"
                    >
                      ล้างคำค้นหา
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredItems.map((item) => (
                    <ActionableNewsCard
                      key={item.id}
                      item={item}
                      onDeepDive={(selected) => setDeepDiveItem(selected)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Deep Dive Modal */}
        <NewsDeepDiveModal
          item={deepDiveItem}
          onClose={() => setDeepDiveItem(null)}
        />
      </div>
    </AppShell>
  )
}
