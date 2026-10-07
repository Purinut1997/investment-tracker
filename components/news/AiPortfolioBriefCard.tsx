'use client'

import React, { useState } from 'react'
import { Sparkles, TrendingUp, AlertTriangle, Lightbulb, RefreshCw, Loader2 } from 'lucide-react'
import type { PortfolioDailyBrief } from '@/lib/news/news-analyzer'

interface AiPortfolioBriefCardProps {
  brief: PortfolioDailyBrief | null
  onRefreshBrief?: () => Promise<void>
}

export function AiPortfolioBriefCard({ brief, onRefreshBrief }: AiPortfolioBriefCardProps) {
  const [isRefreshing, setIsRefreshing] = useState(false)

  if (!brief) return null

  const handleRefresh = async () => {
    if (!onRefreshBrief || isRefreshing) return
    setIsRefreshing(true)
    try {
      await onRefreshBrief()
    } finally {
      setIsRefreshing(false)
    }
  }

  const sentimentPercent = brief.sentimentScore ?? 50
  const isBullish = brief.overallSentiment === 'bullish'
  const isBearish = brief.overallSentiment === 'bearish'

  const sentimentLabel = isBullish
    ? 'เชิงบวก (Bullish)'
    : isBearish
    ? 'เฝ้าระวังความเสี่ยง (Bearish / Defensive)'
    : 'เป็นกลาง (Neutral)'

  const sentimentColor = isBullish
    ? 'text-emerald-400'
    : isBearish
    ? 'text-rose-400'
    : 'text-amber-400'

  const sentimentBarBg = isBullish
    ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
    : isBearish
    ? 'bg-gradient-to-r from-rose-500 to-amber-500'
    : 'bg-gradient-to-r from-indigo-500 to-blue-400'

  return (
    <div className="rounded-2xl bg-[#12151C] border border-white/[0.08] p-5 sm:p-6 shadow-xl shadow-black/30 relative overflow-hidden transition-all">
      {/* Top Bar / Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-white tracking-wide">
                AI Portfolio Daily Brief
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                สรุปย่อ 60 วินาที
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              สังเคราะห์ประเด็นข่าวล่าสุดที่มีผลกระทบต่อสินทรัพย์ที่คุณถือครอง
            </p>
          </div>
        </div>

        {onRefreshBrief && (
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="self-start sm:self-center bg-[#181C25] hover:bg-[#202532] text-slate-300 hover:text-white border border-white/[0.08] px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
          >
            {isRefreshing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5 text-indigo-400" />
            )}
            <span>{isRefreshing ? 'กำลังวิเคราะห์ AI...' : 'อัปเดตบทสรุป AI'}</span>
          </button>
        )}
      </div>

      {/* Sentiment Meter Strip */}
      <div className="mt-4 pt-1 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 font-medium">บรรยากาศข่าวพอร์ตวันนี้:</span>
          <span className={`text-xs font-bold font-mono ${sentimentColor}`}>
            {sentimentPercent}% {sentimentLabel}
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span className="text-slate-400">ข่าวบวก</span>
            <span className="font-bold text-emerald-400">{brief.positiveCount}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-400"></span>
            <span className="text-slate-400">ปัจจัยเสี่ยง</span>
            <span className="font-bold text-rose-400">{brief.negativeCount}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-slate-500"></span>
            <span className="text-slate-400">เป็นกลาง</span>
            <span className="font-bold text-slate-300">{brief.neutralCount}</span>
          </div>
        </div>
      </div>

      {/* Sentiment Progress Bar */}
      <div className="w-full bg-[#181C25] h-1.5 rounded-full mt-2 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${sentimentBarBg}`}
          style={{ width: `${Math.max(5, Math.min(100, sentimentPercent))}%` }}
        />
      </div>

      {/* 3 Actionable Insight Columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mt-5">
        {/* 1. Tailwinds */}
        <div className="p-4 rounded-xl bg-[#181C25]/80 border border-emerald-500/20 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2 text-emerald-400">
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">ปัจจัยหนุนพอร์ต (Tailwinds)</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {brief.tailwinds}
            </p>
          </div>
        </div>

        {/* 2. Headwinds */}
        <div className="p-4 rounded-xl bg-[#181C25]/80 border border-rose-500/20 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2 text-rose-400">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">ปัจจัยเฝ้าระวัง (Headwinds)</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {brief.headwinds}
            </p>
          </div>
        </div>

        {/* 3. Strategic Action */}
        <div className="p-4 rounded-xl bg-[#181C25]/80 border border-indigo-500/20 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2 text-indigo-400">
              <Lightbulb className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">กลยุทธ์แนะนำวันนี้ (Actionable)</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {brief.strategicTakeaway}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
