'use client'

import React, { useState } from 'react'
import useSWR from 'swr'
import { AppShell } from '@/components/AppShell'
import {
  Newspaper,
  ExternalLink,
  Filter,
  Sparkles,
  TrendingUp,
  Clock,
  Loader2,
  Calendar,
  Layers,
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
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-2.5">
              <Newspaper className="w-7 h-7 text-[var(--cyan-400)]" />
              <span>ข่าวสารการลงทุน & Weekly Digest</span>
            </h1>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
              ฟีดข่าวสารล่าสุดของสินทรัพย์ที่คุณถือครอง และข่าวตลาดการเงินโลก
            </p>
          </div>

          <button
            onClick={() => revalidate()}
            className="btn btn-secondary text-xs sm:text-sm py-2 px-3.5 flex items-center gap-2 self-start sm:self-auto"
          >
            <RefreshCw className="w-4 h-4" />
            <span>รีเฟรชข่าว</span>
          </button>
        </div>

        {/* Tab Switcher & Filter Toolbar */}
        <div className="card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex border border-[var(--border)] rounded-xl p-1 bg-[var(--bg-elevated)]/40 self-start">
            <button
              onClick={() => {
                setCategory('portfolio')
                setSelectedTicker('')
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                category === 'portfolio'
                  ? 'bg-cyan-500/20 text-[var(--cyan-400)] border border-cyan-500/30 shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-white'
              }`}
            >
              ข่าวพอร์ตของฉัน ({userTickers.length} สินทรัพย์)
            </button>
            <button
              onClick={() => {
                setCategory('general')
                setSelectedTicker('')
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                category === 'general'
                  ? 'bg-cyan-500/20 text-[var(--cyan-400)] border border-cyan-500/30 shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-white'
              }`}
            >
              ข่าวตลาดทั่วไป (Market News)
            </button>
          </div>

          {/* Ticker Filter Dropdown (in portfolio tab) */}
          {category === 'portfolio' && userTickers.length > 0 && (
            <div className="flex items-center gap-2 text-xs">
              <Filter className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              <select
                className="select text-xs py-1.5"
                value={selectedTicker}
                onChange={(e) => setSelectedTicker(e.target.value)}
              >
                <option value="">ทุกสินทรัพย์ในพอร์ต</option>
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
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-[var(--text-muted)]">
            <Loader2 className="w-7 h-7 animate-spin text-[var(--cyan-400)]" />
            <span className="text-xs">กำลังโหลดข่าวสารล่าสุด...</span>
          </div>
        ) : error ? (
          <div className="card p-8 text-center text-xs text-red-400">
            เกิดข้อผิดพลาดในการโหลดข่าวสาร
          </div>
        ) : newsItems.length === 0 ? (
          <div className="card p-12 text-center flex flex-col items-center justify-center">
            <Newspaper className="w-10 h-10 text-[var(--text-muted)] mb-3" />
            <h3 className="font-bold text-white text-base">ไม่พบข่าวสารในขณะนี้</h3>
            <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-sm">
              ระบบกำลังเชื่อมต่อและดึงข้อมูลข่าวจากผู้ให้บริการรอบถัดไป
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  className="card p-5 hover:border-cyan-500/40 transition-all flex flex-col justify-between group space-y-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {item.symbol ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-[var(--cyan-400)] border border-cyan-500/30 uppercase">
                            {item.symbol}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-[var(--border)] uppercase">
                            Market
                          </span>
                        )}
                        <span className="text-xs font-semibold text-slate-300">
                          {item.sourceName}
                        </span>
                      </div>

                      {item.sentiment && (
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            item.sentiment === 'positive'
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : item.sentiment === 'negative'
                              ? 'bg-rose-500/15 text-rose-400'
                              : 'bg-slate-500/15 text-slate-300'
                          }`}
                        >
                          {item.sentiment.toUpperCase()}
                        </span>
                      )}
                    </div>

                    <h3 className="font-bold text-white text-sm sm:text-base leading-snug group-hover:text-[var(--cyan-400)] transition-colors">
                      {item.headline}
                    </h3>

                    {item.summary && (
                      <p className="text-xs text-[var(--text-secondary)] line-clamp-3 leading-relaxed">
                        {item.summary}
                      </p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-[var(--border)] flex items-center justify-between text-xs text-[var(--text-muted)]">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{published}</span>
                    </span>

                    <a
                      href={item.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[var(--cyan-400)] hover:underline inline-flex items-center gap-1 font-semibold"
                    >
                      <span>อ่านต้นฉบับ</span>
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
