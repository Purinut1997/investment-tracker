'use client'

import React, { useState } from 'react'
import useSWR from 'swr'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/PageHeader'
import {
  Newspaper,
  ExternalLink,
  Filter,
  Clock,
  Loader2,
  RefreshCw,
  AlertCircle,
} from 'lucide-react'
import type { NewsSentiment } from '@prisma/client'

interface NewsFeedItem {
  id: string
  symbol: string | null
  headline: string
  summary: string | null
  sourceName: string
  sourceUrl: string
  publishedAt: string
  sentiment: NewsSentiment | null
}

const SENTIMENT_LABEL: Record<NewsSentiment, { label: string; color: string; bg: string }> = {
  positive: { label: 'เชิงบวก', color: 'text-emerald-400', bg: 'bg-emerald-500/15 border-emerald-500/30' },
  negative: { label: 'เชิงลบ', color: 'text-rose-400', bg: 'bg-rose-500/15 border-rose-500/30' },
  neutral:  { label: 'เป็นกลาง', color: 'text-slate-400', bg: 'bg-slate-800 border-slate-700' },
}

export default function NewsPage() {
  const [category, setCategory] = useState<'portfolio' | 'general'>('portfolio')
  const [selectedTicker, setSelectedTicker] = useState('')

  const queryParams = new URLSearchParams({
    category,
    ...(selectedTicker && { symbol: selectedTicker }),
  })

  const { data, isLoading, error, mutate: revalidate } = useSWR(`/api/news?${queryParams.toString()}`, {
    refreshInterval: 120000,
  })

  const newsItems: NewsFeedItem[] = Array.isArray(data?.items) ? data.items : []
  const userTickers: string[] = data?.userTickers ?? []

  return (
    <AppShell>
      <div className="space-y-6 max-w-[1600px] mx-auto w-full animate-fade-in">
        {/* Header */}
        <PageHeader
          eyebrow="Market Intelligence"
          title="ศูนย์ข่าวสารเศรษฐกิจและการลงทุน"
          description="ฟีดข่าวสารล่าสุดเจาะลึกเฉพาะสินทรัพย์ในพอร์ตของคุณและภาพรวมตลาดการเงินโลก"
          action={
            <button 
              onClick={() => revalidate()} 
              className="bg-[#181C25] hover:bg-[#202532] text-slate-300 hover:text-white border border-white/[0.1] px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-sm"
            >
              <RefreshCw className="w-3.5 h-3.5 text-indigo-400" />
              <span>รีเฟรชข่าวสาร</span>
            </button>
          }
        />

        {/* Tab Switcher & Filter Toolbar */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-[#12151C] border border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 shadow-xl shadow-black/30">
          <div className="flex bg-[#181C25] p-1 rounded-xl border border-white/[0.08] self-start">
            <button
              onClick={() => {
                setCategory('portfolio')
                setSelectedTicker('')
              }}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                category === 'portfolio'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              พอร์ตของฉัน ({userTickers.length})
            </button>
            <button
              onClick={() => {
                setCategory('general')
                setSelectedTicker('')
              }}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                category === 'general'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              ข่าวตลาดทั่วไป
            </button>
          </div>

          {/* Ticker Filter Dropdown */}
          {category === 'portfolio' && userTickers.length > 0 && (
            <div className="flex items-center gap-2 text-xs">
              <Filter className="w-3.5 h-3.5 text-indigo-400" />
              <select
                className="bg-[#181C25] border border-white/[0.1] text-xs text-white rounded-xl px-3 py-1.5 outline-none font-mono focus:border-indigo-500 transition-all"
                value={selectedTicker}
                onChange={(e) => setSelectedTicker(e.target.value)}
              >
                <option value="" className="bg-[#12151C]">ทุกสินทรัพย์ในพอร์ต</option>
                {userTickers.map((t) => (
                  <option key={t} value={t} className="bg-[#12151C]">
                    {t}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* News Feed Grid */}
        {isLoading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            <span className="text-xs font-medium">กำลังโหลดข่าวสารล่าสุด...</span>
          </div>
        ) : error ? (
          <div className="p-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-center flex flex-col items-center justify-center">
            <AlertCircle className="w-8 h-8 text-rose-400 mb-3" />
            <p className="text-xs text-rose-300 mb-4">ไม่สามารถโหลดฟีดข่าวสารได้ในขณะนี้</p>
            <button onClick={() => revalidate()} className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-semibold text-white">ลองอีกครั้ง</button>
          </div>
        ) : newsItems.length === 0 ? (
          <div className="p-16 rounded-2xl bg-[#12151C] border border-white/[0.08] text-center flex flex-col items-center justify-center min-h-[360px] shadow-xl shadow-black/30">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-4">
              <Newspaper className="w-7 h-7" />
            </div>
            <h3 className="font-bold text-white text-base mb-1">ยังไม่มีข่าวในหมวดนี้</h3>
            <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
              ระบบจะอัปเดตฟีดข่าวสารอัตโนมัติเมื่อมีข่าวใหม่ที่เกี่ยวข้องกับสินทรัพย์ของคุณ
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {newsItems.map((item) => {
              const published = new Date(item.publishedAt).toLocaleDateString('th-TH', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })

              const sentimentCfg = item.sentiment ? SENTIMENT_LABEL[item.sentiment] : null

              return (
                <div
                  key={item.id}
                  className="p-5 sm:p-6 rounded-2xl bg-[#12151C] border border-white/[0.08] hover:border-white/[0.16] hover:bg-[#151922] transition-all duration-200 flex flex-col justify-between group shadow-xl shadow-black/30 min-h-[220px]"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {item.symbol ? (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold font-mono bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 uppercase">
                            {item.symbol}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold font-mono bg-slate-800 text-slate-400 uppercase border border-slate-700">
                            ตลาดรวม
                          </span>
                        )}
                        <span className="text-xs font-semibold text-slate-400 truncate max-w-[120px]">
                          {item.sourceName}
                        </span>
                      </div>

                      {sentimentCfg && (
                        <span
                          className={`text-[10px] font-semibold font-mono px-2 py-0.5 rounded-md border ${sentimentCfg.bg} ${sentimentCfg.color}`}
                        >
                          {sentimentCfg.label}
                        </span>
                      )}
                    </div>

                    <h3 className="font-bold text-white text-sm sm:text-base leading-snug group-hover:text-indigo-300 transition-colors line-clamp-2">
                      {item.headline}
                    </h3>

                    {item.summary && (
                      <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">
                        {item.summary}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 pt-3.5 border-t border-white/[0.06] flex items-center justify-between text-xs">
                    <span className="text-[11px] text-slate-500 flex items-center gap-1.5 font-mono">
                      <Clock className="w-3.5 h-3.5" />
                      {published}
                    </span>

                    <a
                      href={item.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 text-xs transition-colors"
                    >
                      <span>อ่านข่าวเต็ม</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </AppShell>
  )
}
