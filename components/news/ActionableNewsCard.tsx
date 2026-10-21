'use client'

import React from 'react'
import { Clock, ExternalLink, Sparkles } from 'lucide-react'
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
  { label: string; text: string; bg: string; border: string; dot: string; actionHint: string }
> = {
  positive: {
    label: 'ข่าวบวก',
    text: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/25',
    dot: 'bg-emerald-400',
    actionHint: 'หนุนโมเมนตัมเชิงบวกต่อราคาและพื้นฐาน',
  },
  negative: {
    label: 'เฝ้าระวัง',
    text: 'text-rose-400',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/25',
    dot: 'bg-rose-400',
    actionHint: 'ระวังความผันผวนระยะสั้น เช็คแนวรับก่อนสะสม',
  },
  neutral: {
    label: 'เป็นกลาง',
    text: 'text-slate-300',
    bg: 'bg-white/[0.04]',
    border: 'border-white/[0.08]',
    dot: 'bg-slate-400',
    actionHint: 'ติดตามข้อมูลประกอบ ไม่กระทบแผนหลัก',
  },
}

function formatRelativeTime(isoDate: string): string {
  const pubMs = new Date(isoDate).getTime()
  if (Number.isNaN(pubMs)) return ''
  const diffMin = Math.floor((Date.now() - pubMs) / 60000)

  if (diffMin < 5) return 'เพิ่งประกาศเมื่อสักครู่'
  if (diffMin < 60) return `${diffMin} นาทีที่แล้ว`
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `${diffHours} ชม. ที่แล้ว`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays <= 7) return `${diffDays} วันที่แล้ว`

  return new Date(isoDate).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
  })
}

export function ActionableNewsCard({ item, onDeepDive }: ActionableNewsCardProps) {
  const publishedDate = new Date(item.publishedAt).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
  const relativeTime = formatRelativeTime(item.publishedAt)

  const sentiment = item.sentiment ?? 'neutral'
  const sentimentCfg = SENTIMENT_STYLE[sentiment]
  const synthesis = item.synthesis

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-[#12151C] border border-white/[0.07] hover:border-indigo-500/35 transition-all duration-200 flex flex-col justify-between group shadow-lg shadow-black/20">
      <div className="space-y-3">
        {/* Top Row: Ticker + Tag + Sentiment Pill */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {item.symbol ? (
              <span className="px-2.5 py-0.5 rounded-lg text-xs font-extrabold font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/35 uppercase tracking-wide shrink-0">
                {item.symbol}
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold font-mono bg-slate-800/80 text-slate-300 border border-slate-700 shrink-0">
                MARKET
              </span>
            )}

            {synthesis?.impactTag && (
              <span className="text-xs font-medium text-slate-400 truncate">
                {synthesis.impactTag}
              </span>
            )}
          </div>

          <div
            className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-semibold shrink-0 ${sentimentCfg.bg} ${sentimentCfg.border} ${sentimentCfg.text}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${sentimentCfg.dot}`} />
            <span>{sentimentCfg.label}</span>
          </div>
        </div>

        {/* Headline & Clean Summary */}
        <div className="space-y-1.5">
          <a
            href={item.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block font-bold text-white text-sm sm:text-base leading-snug group-hover:text-indigo-300 transition-colors line-clamp-2"
          >
            {item.headline}
          </a>

          {item.summary && (
            <p className="text-xs sm:text-sm text-slate-400 line-clamp-2 leading-relaxed">
              {item.summary}
            </p>
          )}
        </div>
      </div>

      {/* Compact 1-Line Impact Strip + Footer Actions */}
      <div className="mt-4 pt-3 border-t border-white/[0.06] space-y-2.5">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="text-slate-300 font-medium truncate">
            💡 {sentimentCfg.actionHint}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2 pt-0.5">
          <div className="flex items-center gap-1.5 text-slate-400 font-mono text-[11px] sm:text-xs min-w-0">
            <Clock className="w-3.5 h-3.5 text-indigo-400/80 shrink-0" />
            <span className="text-slate-200 font-semibold shrink-0">{relativeTime}</span>
            <span className="text-slate-600">•</span>
            <span className="truncate text-slate-400" title={publishedDate}>
              {item.sourceName}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => onDeepDive(item)}
              className="bg-indigo-500/15 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
            >
              <Sparkles className="w-3 h-3" />
              <span>AI เจาะลึก</span>
            </button>

            <a
              href={item.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/[0.05] transition-colors"
              title="อ่านข่าวต้นฉบับ"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
