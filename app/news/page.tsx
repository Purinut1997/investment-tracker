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
  RefreshCw
} from 'lucide-react'

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

  const newsItems: any[] = data?.items ?? []
  const userTickers: string[] = data?.userTickers ?? []

  return (
    <AppShell>
      <div className="space-y-8 max-w-[1600px] mx-auto w-full">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">ข่าวสารการลงทุน</h1>
            <p className="text-sm text-zinc-500 mt-1">ฟีดข่าวล่าสุดของสินทรัพย์ในพอร์ตและตลาดการเงินโลก</p>
          </div>
          <button 
            onClick={() => revalidate()} 
            className="bg-[#050505] text-zinc-400 hover:text-white border border-white/10 hover:bg-white/5 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors w-fit"
          >
            <RefreshCw className="w-4 h-4" /> รีเฟรชข่าว
          </button>
        </div>

        {/* Tab Switcher & Filter Toolbar */}
        <div className="p-4 rounded-3xl bg-[#0a0a0a] border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex border border-white/10 rounded-xl p-1 bg-[#050505] self-start">
            <button
              onClick={() => {
                setCategory('portfolio')
                setSelectedTicker('')
              }}
              className={`px-4 py-2 rounded-lg text-[11px] font-bold tracking-widest uppercase transition-all ${
                category === 'portfolio'
                  ? 'bg-white text-black shadow-sm'
                  : 'text-zinc-500 hover:text-white'
              }`}
            >
              MY PORTFOLIO ({userTickers.length})
            </button>
            <button
              onClick={() => {
                setCategory('general')
                setSelectedTicker('')
              }}
              className={`px-4 py-2 rounded-lg text-[11px] font-bold tracking-widest uppercase transition-all ${
                category === 'general'
                  ? 'bg-white text-black shadow-sm'
                  : 'text-zinc-500 hover:text-white'
              }`}
            >
              MARKET NEWS
            </button>
          </div>

          {/* Ticker Filter Dropdown (in portfolio tab) */}
          {category === 'portfolio' && userTickers.length > 0 && (
            <div className="flex items-center gap-2 text-xs">
              <Filter className="w-3.5 h-3.5 text-zinc-500" />
              <select
                className="bg-[#050505] border border-white/10 text-xs text-white rounded-lg px-3 py-2 outline-none font-mono focus:border-zinc-500 uppercase tracking-widest"
                value={selectedTicker}
                onChange={(e) => setSelectedTicker(e.target.value)}
              >
                <option value="">ALL TICKERS</option>
                {userTickers.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* News Feed Grid */}
        {isLoading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-4 text-zinc-500">
            <Loader2 className="w-8 h-8 animate-spin" />
            <span className="text-[10px] font-mono tracking-widest uppercase">Fetching Latest News...</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-400 text-xs">
            เกิดข้อผิดพลาดในการโหลดข่าวสาร
          </div>
        ) : newsItems.length === 0 ? (
          <div className="p-16 rounded-3xl bg-[#0a0a0a] border border-white/5 text-center flex flex-col items-center justify-center min-h-[400px]">
            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center text-zinc-600 mb-6">
              <Newspaper className="w-8 h-8" />
            </div>
            <h3 className="font-bold text-white text-lg mb-2 uppercase tracking-widest">NO NEWS FOUND</h3>
            <p className="text-[10px] text-zinc-500 max-w-sm font-mono tracking-widest uppercase">
              CHECK BACK LATER FOR UPDATES ON YOUR PORTFOLIO
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

              return (
                <div
                  key={item.id}
                  className="p-6 rounded-3xl bg-[#0a0a0a] border border-white/5 hover:border-white/20 transition-all duration-300 flex flex-col justify-between group space-y-5 min-h-[240px]"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {item.symbol ? (
                          <span className="px-2 py-0.5 rounded-sm text-[9px] font-bold font-mono bg-white/10 text-white uppercase tracking-widest">
                            {item.symbol}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-sm text-[9px] font-bold font-mono bg-[#050505] border border-white/10 text-zinc-400 uppercase tracking-widest">
                            MARKET
                          </span>
                        )}
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest truncate max-w-[100px]">
                          {item.sourceName}
                        </span>
                      </div>

                      {item.sentiment && (
                        <span
                          className={`text-[9px] font-bold font-mono px-2 py-0.5 rounded-sm tracking-widest uppercase ${
                            item.sentiment === 'positive'
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : item.sentiment === 'negative'
                              ? 'bg-rose-500/10 text-rose-400'
                              : 'bg-white/5 text-zinc-400'
                          }`}
                        >
                          {item.sentiment}
                        </span>
                      )}
                    </div>

                    <h3 className="font-bold text-white text-sm sm:text-base leading-snug group-hover:text-zinc-300 transition-colors">
                      {item.headline}
                    </h3>

                    {item.summary && (
                      <p className="text-xs text-zinc-500 line-clamp-3 leading-relaxed">
                        {item.summary}
                      </p>
                    )}
                  </div>

                  <div className="pt-4 border-t border-white/5 flex items-center justify-between text-xs text-zinc-500">
                    <span className="flex items-center gap-1.5 text-[9px] font-mono tracking-widest uppercase">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{published}</span>
                    </span>

                    <a
                      href={item.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[9px] text-zinc-400 hover:text-white uppercase tracking-widest inline-flex items-center gap-1 font-bold transition-colors"
                    >
                      <span>READ</span>
                      <ExternalLink className="w-3 h-3" />
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
