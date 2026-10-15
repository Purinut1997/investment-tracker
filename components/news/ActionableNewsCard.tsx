'use client'

import React from 'react'
import { Clock, ExternalLink, Sparkles, AlertCircle } from 'lucide-react'
import type { NewsSentiment } from '@prisma/client'

export interface EnrichedNewsItem {
  id: string
  symbol: string | null
  headline: string
  summary: string | null
  sourceName: string
  sourceUrl: string
  publishedAt: string
  sentiment: NewsSentiment | null
  category: 'portfolio' | 'earnings' | 'macro' | 'general'
  synthesis?: {
    thaiHeadline: string
    takeaways: [string, string, string]
    impactTag: string
    impactLevel: 'high' | 'medium' | 'low'
  }
}

interface ActionableNewsCardProps {
  item: EnrichedNewsItem
  onDeepDive: (item: EnrichedNewsItem) => void
}

const SENTIMENT_STYLE: Record<
  NewsSentiment,
  { label: string; text: string; bg: string; border: string; indicator: string }
> = {
  positive: {
    label: 'กระทบเชิงบวก',
    text: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    indicator: 'bg-emerald-400',
  },
  negative: {
    label: 'ปัจจัยเสี่ยง / เฝ้าระวัง',
    text: 'text-rose-400',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/30',
    indicator: 'bg-rose-400',
  },
  neutral: {
    label: 'ข้อมูลทั่วไป / เป็นกลาง',
    text: 'text-slate-400',
    bg: 'bg-slate-800/60',
    border: 'border-slate-700/80',
    indicator: 'bg-slate-400',
  },
}

export function ActionableNewsCard({ item, onDeepDive }: ActionableNewsCardProps) {
  const publishedDate = new Date(item.publishedAt).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  const sentiment = item.sentiment ?? 'neutral'
  const sentimentCfg = SENTIMENT_STYLE[sentiment]
  const synthesis = item.synthesis

  return (
    <div className="p-5 sm:p-6 rounded-2xl bg-[#12151C] border border-white/[0.08] hover:border-white/[0.16] transition-all duration-200 flex flex-col justify-between group shadow-xl shadow-black/30 min-h-[300px]">
      <div className="space-y-3.5">
        {/* Top Badges Row */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            {item.symbol ? (
              <span className="px-3 py-1 rounded-lg text-xs sm:text-sm font-black font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 uppercase tracking-wide">
                {item.symbol}
              </span>
            ) : (
              <span className="px-3 py-1 rounded-lg text-xs sm:text-sm font-bold font-mono bg-slate-800 text-slate-300 uppercase border border-slate-700">
                ตลาดรวม
              </span>
            )}

            {synthesis?.impactTag && (
              <span className="text-xs font-semibold text-slate-300 px-2.5 py-1 rounded-md bg-white/[0.05] border border-white/[0.08]">
                {synthesis.impactTag}
              </span>
            )}
          </div>

          {/* Sentiment Badge */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs sm:text-sm font-semibold ${sentimentCfg.bg} ${sentimentCfg.border} ${sentimentCfg.text}`}
          >
            <span className={`w-2 h-2 rounded-full ${sentimentCfg.indicator}`} />
            <span>{sentimentCfg.label}</span>
          </div>
        </div>

        {/* Headlines: Thai & English */}
        <div>
          <h3 className="font-bold text-white text-base sm:text-lg leading-snug group-hover:text-indigo-300 transition-colors">
            {item.headline}
          </h3>
          {item.summary && (
            <p className="text-sm text-slate-300 mt-2 line-clamp-3 leading-relaxed">
              {item.summary}
            </p>
          )}
        </div>

        {/* AI Key Takeaways Box (สรุป 3 บรรทัด) */}
        {synthesis?.takeaways && (
          <div className="p-4 rounded-xl bg-[#181C25]/85 border border-white/[0.08] space-y-2.5 mt-2">
            <div className="flex items-center gap-2 text-indigo-300 text-xs sm:text-sm font-bold">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>สรุปใจความสำคัญเพื่อการตัดสินใจ:</span>
            </div>
            <ul className="space-y-2 text-xs sm:text-sm text-slate-200 leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="text-indigo-400 font-bold shrink-0 mt-0.5">•</span>
                <span>{synthesis.takeaways[0]}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold shrink-0 mt-0.5">•</span>
                <span>{synthesis.takeaways[1]}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400 font-bold shrink-0 mt-0.5">•</span>
                <span>{synthesis.takeaways[2]}</span>
              </li>
            </ul>
          </div>
        )}
      </div>

      {/* Bottom Footer Actions */}
      <div className="mt-4 pt-3.5 border-t border-white/[0.06] flex items-center justify-between text-xs sm:text-sm gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-slate-400 font-mono text-xs">
          <Clock className="w-3.5 h-3.5" />
          <span>{publishedDate}</span>
          <span>•</span>
          <span className="truncate max-w-[120px]">{item.sourceName}</span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => onDeepDive(item)}
            className="bg-indigo-600/25 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/40 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>วิเคราะห์เชิงลึก</span>
          </button>

          <a
            href={item.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-300 hover:text-white px-2.5 py-1.5 rounded-xl hover:bg-white/[0.05] transition-colors flex items-center gap-1 text-xs sm:text-sm"
          >
            <span>ต้นฉบับ</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  )
}
