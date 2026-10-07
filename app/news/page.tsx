'use client'

import React, { useState } from 'react'
import useSWR from 'swr'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/PageHeader'
import {
  Newspaper,
  Filter,
  Loader2,
  RefreshCw,
  AlertCircle,
  Search,
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

export default function NewsPage() {
  const [category, setCategory] = useState<NewsCategory>('portfolio')
  const [selectedTicker, setSelectedTicker] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [deepDiveItem, setDeepDiveItem] = useState<EnrichedNewsItem | null>(null)

  const queryParams = new URLSearchParams({
    category,
    ...(selectedTicker && { symbol: selectedTicker }),
  })

  const { data, isLoading, error, mutate: revalidate } = useSWR(
    `/api/news?${queryParams.toString()}`,
    { refreshInterval: 120000 }
  )

  const newsItems: EnrichedNewsItem[] = Array.isArray(data?.items) ? data.items : []
  const userHoldings: HoldingSummaryItem[] = Array.isArray(data?.userHoldingsSummary)
    ? data.userHoldingsSummary
    : []
  const dailyBrief = data?.dailyBrief ?? null

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
      const res = await fetch('/api/news/brief', { method: 'POST' })
      if (res.ok) {
        await revalidate()
      }
    } catch (err) {
      console.error('Failed to refresh brief', err)
    }
  }

  return (
    <AppShell>
      <div className="space-y-6 max-w-[1600px] mx-auto w-full animate-fade-in pb-12">
        {/* Header */}
        <PageHeader
          eyebrow="Market Intelligence"
          title="ศูนย์ข่าวสารและสรุปภาพรวมการลงทุน"
          description="สังเคราะห์ข่าวสารและผลกระทบต่อสินทรัพย์ในพอร์ตของคุณ พร้อมบทวิเคราะห์เพื่อการตัดสินใจจริง"
          action={
            <div className="flex items-center gap-2">
              <button
                onClick={() => revalidate()}
                className="bg-[#181C25] hover:bg-[#202532] text-slate-300 hover:text-white border border-white/[0.08] px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-sm"
              >
                <RefreshCw className="w-3.5 h-3.5 text-indigo-400" />
                <span>รีเฟรชข้อมูล</span>
              </button>
            </div>
          }
        />

        {/* AI Portfolio Daily Brief Card (Executive TL;DR) */}
        <AiPortfolioBriefCard
          brief={dailyBrief}
          onRefreshBrief={handleRefreshBrief}
        />

        {/* Holdings Sentiment Quick Bar */}
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

        {/* Tab Switcher & Search Bar */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-[#12151C] border border-white/[0.08] flex flex-col md:flex-row md:items-center justify-between gap-3.5 shadow-xl shadow-black/30">
          {/* Categories Tabs */}
          <div className="flex flex-wrap bg-[#181C25] p-1 rounded-xl border border-white/[0.08] gap-1">
            {CATEGORY_TABS.map((tab) => {
              const isActive = category === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setCategory(tab.id)
                    setSelectedTicker('')
                  }}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </div>

          {/* Search Box */}
          <div className="relative min-w-[220px]">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="ค้นหาตามชื่อหุ้นหรือหัวข้อข่าว..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#181C25] border border-white/[0.08] rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
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
              className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-semibold text-white"
            >
              ลองอีกครั้ง
            </button>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-16 rounded-2xl bg-[#12151C] border border-white/[0.08] text-center flex flex-col items-center justify-center min-h-[320px] shadow-xl shadow-black/30">
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
                className="mt-4 px-3.5 py-1.5 rounded-xl bg-slate-800 text-xs text-slate-300 hover:text-white"
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

        {/* Deep Dive Modal */}
        <NewsDeepDiveModal
          item={deepDiveItem}
          onClose={() => setDeepDiveItem(null)}
        />
      </div>
    </AppShell>
  )
}
