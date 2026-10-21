'use client'

import React, { useState } from 'react'
import {
  Sparkles,
  RefreshCw,
  Loader2,
  Clock,
  CheckCircle2,
  Target,
  Compass,
  Copy,
  Check,
  TrendingUp,
  TrendingDown,
  CalendarClock,
  ShieldCheck,
  Wallet,
  Flame,
  Siren,
  History,
  Eye,
} from 'lucide-react'
import type { PortfolioDailyBrief } from '@/lib/news/news-analyzer'
import { buildDefaultMarketDecisionFramework } from '@/lib/news/news-analyzer'
import { MarketDecisionFrameworkCard } from './MarketDecisionFrameworkCard'

interface AiPortfolioBriefCardProps {
  brief: PortfolioDailyBrief | null
  onRefreshBrief?: () => Promise<void>
  isHistorical?: boolean
  selectedDate?: string
  onBackToToday?: () => void
}

type CleanBriefTab = 'overview' | 'catalysts' | 'deep_framework'

export function AiPortfolioBriefCard({
  brief,
  onRefreshBrief,
  isHistorical = false,
  onBackToToday,
}: AiPortfolioBriefCardProps) {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState<CleanBriefTab>('overview')
  const [copied, setCopied] = useState(false)

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
    ? 'ตลาดเปิดรับความเสี่ยง (Bullish)'
    : isBearish
    ? 'ระมัดระวังความผันผวน (Defensive)'
    : 'ตลาดเลือกเล่นรายกลุ่ม (Selective)'

  const sentimentColor = isBullish
    ? 'text-emerald-400'
    : isBearish
    ? 'text-rose-400'
    : 'text-amber-400'

  const sentimentBarBg = isBullish
    ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
    : isBearish
    ? 'bg-gradient-to-r from-rose-500 to-amber-500'
    : 'bg-gradient-to-r from-amber-500 via-indigo-500 to-blue-400'

  const formattedDate = new Date(brief.generatedAt || Date.now()).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  // Merge holdingsImpact and defensivePlaybook.holdingPlaybook into a single unified list per ticker
  const playbookMap = new Map(
    (brief.defensivePlaybook?.holdingPlaybook || []).map((hp) => [hp.symbol.toUpperCase(), hp])
  )
  const unifiedHoldings = (brief.holdingsImpact || []).map((hi) => {
    const sym = hi.symbol.toUpperCase()
    const pb = playbookMap.get(sym)
    return {
      symbol: sym,
      impact: hi.impact,
      headline: hi.headline,
      detail: hi.detail || pb?.rationale || '',
      actionLabel: pb?.stanceLabel || hi.actionSuggestion || 'ถือรอดูทิศทาง',
      stance: pb?.stance || 'HOLD',
      supportLevel: pb?.supportOrActionLevel || null,
    }
  })

  // Include any playbook items that weren't in holdingsImpact
  for (const hp of brief.defensivePlaybook?.holdingPlaybook || []) {
    const sym = hp.symbol.toUpperCase()
    if (!unifiedHoldings.some((u) => u.symbol === sym)) {
      unifiedHoldings.push({
        symbol: sym,
        impact: 'neutral',
        headline: hp.stanceLabel,
        detail: hp.rationale,
        actionLabel: hp.stanceLabel,
        stance: hp.stance,
        supportLevel: hp.supportOrActionLevel || null,
      })
    }
  }

  const copyBriefToClipboard = () => {
    const lines = [
      `📊 สรุปกลยุทธ์พอร์ตประจำวัน (${formattedDate})`,
      `ภาวะตลาด: ${brief.marketConsensus?.moodLabel || sentimentLabel} (${sentimentPercent}%)`,
      `💡 สรุปฟันธง: ${brief.summaryOneLiner || brief.strategicTakeaway}`,
      `\n🎯 แผนรายตัวในพอร์ต:`,
      ...unifiedHoldings.map(
        (h) =>
          `- ${h.symbol} [${h.actionLabel}]: ${h.headline}${
            h.supportLevel ? ` (${h.supportLevel})` : ''
          }`
      ),
      `\n✅ สิ่งที่พอร์ตควรทำวันนี้:`,
      ...(brief.actionPlan || []).map((a) => `- [${a.badgeText}] ${a.title}: ${a.detail}`),
    ]
    navigator.clipboard.writeText(lines.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-3xl bg-[#12151C] border border-white/[0.08] shadow-2xl shadow-black/30 overflow-hidden">
      {/* 1. COMPACT TOP BAR */}
      <div className="px-5 py-4 border-b border-white/[0.07] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#151923]">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold text-white">
                สรุปทิศทางตลาด & แผนพอร์ตวันนี้
              </h2>
              {isHistorical ? (
                <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                  <History className="w-3 h-3" />
                  <span>ย้อนหลัง: {formattedDate}</span>
                </span>
              ) : (
                <span className="text-xs text-slate-400 font-mono">
                  อัปเดต {formattedDate}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {isHistorical && onBackToToday && (
            <button
              onClick={onBackToToday}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>กลับสู่วันนี้</span>
            </button>
          )}

          <button
            onClick={copyBriefToClipboard}
            className="bg-[#181C25] hover:bg-[#202532] text-slate-300 hover:text-white border border-white/[0.08] px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-semibold">คัดลอกแล้ว</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span>คัดลอกโพย</span>
              </>
            )}
          </button>

          {!isHistorical && onRefreshBrief && (
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="bg-indigo-600/25 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/40 px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            >
              {isRefreshing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5 text-indigo-400" />
              )}
              <span>{isRefreshing ? 'กำลังวิเคราะห์ข่าวสด...' : 'วิเคราะห์ใหม่ด้วย AI'}</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. HERO VERDICT BANNER (อ่านจบใน 10 วินาที) */}
      <div className="p-5 sm:p-6 bg-gradient-to-r from-indigo-950/35 via-[#151924] to-[#12151C] border-b border-white/[0.06]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-3 flex-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                📌 สรุปฟันธงวันนี้
              </span>
              <span className={`text-xs sm:text-sm font-bold ${sentimentColor}`}>
                {brief.marketConsensus?.moodLabel || sentimentLabel}
              </span>
            </div>

            <p className="text-base sm:text-lg font-bold text-white leading-relaxed">
              {brief.summaryOneLiner || brief.strategicTakeaway}
            </p>

            {/* Quick Stance + Cash Pill Strip */}
            {brief.defensivePlaybook && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 pt-1 text-xs sm:text-sm">
                <div className="px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-200 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    <strong className="text-emerald-300">ท่าทีพอร์ต:</strong>{' '}
                    {brief.defensivePlaybook.overallStance}
                  </span>
                </div>
                {brief.defensivePlaybook.cashBufferAdvice && (
                  <div className="px-3 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/25 text-indigo-200 flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-indigo-400 shrink-0" />
                    <span>
                      <strong className="text-indigo-300">เงินสด:</strong>{' '}
                      {brief.defensivePlaybook.cashBufferAdvice}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right: Compact Sentiment Meter */}
          <div className="shrink-0 bg-[#181C25] border border-white/[0.08] p-4 rounded-2xl flex flex-col justify-center gap-2 min-w-[230px]">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium">น้ำหนักข่าวตลาดวันนี้</span>
              <span className={`font-mono font-bold text-sm ${sentimentColor}`}>
                {sentimentPercent}% เชิงบวก
              </span>
            </div>
            <div className="w-full bg-[#12151C] h-2 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${sentimentBarBg}`}
                style={{ width: `${Math.max(8, Math.min(100, sentimentPercent))}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs font-mono pt-0.5">
              <span className="text-emerald-400 font-semibold">บวก {brief.positiveCount}</span>
              <span className="text-slate-400">กลาง {brief.neutralCount}</span>
              <span className="text-rose-400 font-semibold">เสี่ยง {brief.negativeCount}</span>
            </div>
          </div>
        </div>

        {/* Compact Macro Shock Strip (if present) */}
        {brief.macroShockAlert && (
          <div className="mt-4 p-3.5 sm:p-4 rounded-2xl bg-rose-950/30 border border-rose-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <Siren className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="text-xs sm:text-sm leading-relaxed">
                <span className="font-bold text-rose-300 mr-1.5">ประเด็นมหภาคที่ต้องระวัง:</span>
                <span className="font-semibold text-white">{brief.macroShockAlert.title}</span>
                {brief.macroShockAlert.explanation && (
                  <span className="text-slate-300 ml-1.5">— {brief.macroShockAlert.explanation}</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. SIMPLE 3-TAB BAR (ไม่รก เลือกดูเฉพาะส่วนที่ต้องการ) */}
      <div className="px-5 pt-4 border-b border-white/[0.06] bg-[#141821] flex items-center gap-2 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-bold transition-all cursor-pointer border-b-2 flex items-center gap-2 shrink-0 ${
            activeTab === 'overview'
              ? 'border-indigo-500 text-white bg-indigo-500/10'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Target className="w-4 h-4 text-indigo-400" />
          <span>1. โพยหุ้นในพอร์ต & สิ่งที่ต้องทำวันนี้</span>
        </button>

        <button
          onClick={() => setActiveTab('catalysts')}
          className={`px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-bold transition-all cursor-pointer border-b-2 flex items-center gap-2 shrink-0 ${
            activeTab === 'catalysts'
              ? 'border-rose-500 text-white bg-rose-500/10'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <CalendarClock className="w-4 h-4 text-rose-400" />
          <span>2. ปฏิทินตัวเลขสำคัญ & แผนสำรอง (A/B)</span>
        </button>

        <button
          onClick={() => setActiveTab('deep_framework')}
          className={`px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-bold transition-all cursor-pointer border-b-2 flex items-center gap-2 shrink-0 ${
            activeTab === 'deep_framework'
              ? 'border-emerald-500 text-white bg-emerald-500/10'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Compass className="w-4 h-4 text-emerald-400" />
          <span>3. วินิจฉัยตลาด 3 ระดับ & หุ้นน่าจับตา</span>
        </button>
      </div>

      {/* 4. TAB CONTENT */}
      <div className="p-5 sm:p-6">
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-fade-in">
            {/* BLOCK A: UNIFIED HOLDINGS PLAYBOOK (รวมทุกอย่างของหุ้นในพอร์ตไว้ในที่เดียว ไม่ซ้ำซ้อน) */}
            {unifiedHoldings.length > 0 && (
              <div className="space-y-3.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                    <Target className="w-4 h-4 text-indigo-400" />
                    <span>หุ้นในพอร์ตของคุณต้องทำยังไงวันนี้? ({unifiedHoldings.length} ตัว)</span>
                  </h3>
                  <span className="text-xs text-slate-400">
                    รวมผลกระทบจากข่าวล่าสุด + แนวรับทางเทคนิค (S1)
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
                  {unifiedHoldings.map((item) => {
                    const isPositive = item.impact === 'positive' || item.stance === 'BUY_DIP'
                    const isNegative = item.impact === 'negative' || item.stance === 'TRIM'

                    const badgeStyle =
                      item.stance === 'BUY_DIP'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/35'
                        : item.stance === 'COLLECT_DIVIDEND'
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/35'
                        : item.stance === 'WAIT'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/35'
                        : isPositive
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                        : isNegative
                        ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                        : 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'

                    return (
                      <div
                        key={item.symbol}
                        className="p-4 rounded-2xl bg-[#181C25]/90 border border-white/[0.08] hover:border-indigo-500/35 transition-all flex flex-col justify-between gap-3"
                      >
                        <div className="space-y-2">
                          {/* Ticker + Action Badge */}
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-base font-black font-mono text-white px-2.5 py-0.5 rounded-lg bg-white/[0.07] border border-white/[0.1]">
                              {item.symbol}
                            </span>
                            <span
                              className={`text-xs font-bold px-2.5 py-1 rounded-lg border truncate max-w-[175px] ${badgeStyle}`}
                              title={item.actionLabel}
                            >
                              {item.actionLabel}
                            </span>
                          </div>

                          {/* Crisp Headline + Explanation */}
                          <h4 className="text-sm font-bold text-white leading-snug">
                            {item.headline}
                          </h4>
                          <p className="text-xs text-slate-300 leading-relaxed line-clamp-3">
                            {item.detail}
                          </p>
                        </div>

                        {/* Support / Action Price Strip */}
                        {item.supportLevel && (
                          <div className="pt-2.5 border-t border-white/[0.06] flex items-center justify-between gap-2 text-xs">
                            <span className="text-slate-400 shrink-0">จุดสังเกต:</span>
                            <span className="font-mono font-bold text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md truncate">
                              {item.supportLevel}
                            </span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* BLOCK B: 2-COLUMN SPLIT (ซ้าย: สรุปประเด็นตลาดวันนี้ | ขวา: แอ็กชันที่พอร์ตควรทำ) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-1">
              {/* Left Column: What Happened Today */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#181C25]/70 border border-white/[0.07] space-y-3.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                    <Flame className="w-4 h-4 text-amber-400" />
                    <span>สรุปประเด็นสำคัญในตลาดวันนี้</span>
                  </h3>
                  <span className="text-xs text-slate-400 font-mono">Key Highlights</span>
                </div>

                <div className="space-y-2.5">
                  {(brief.todayHighlights || []).slice(0, 4).map((hl) => {
                    const dot =
                      hl.sentiment === 'positive'
                        ? 'bg-emerald-400'
                        : hl.sentiment === 'negative'
                        ? 'bg-rose-400'
                        : 'bg-indigo-400'

                    return (
                      <div
                        key={hl.id}
                        className="p-3 rounded-xl bg-[#12151C]/80 border border-white/[0.05] space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
                            <span className="text-xs sm:text-sm font-bold text-white">
                              {hl.title}
                            </span>
                          </div>
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-white/[0.05] text-slate-300 shrink-0">
                            {hl.tag}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed pl-4">{hl.detail}</p>
                      </div>
                    )
                  })}
                </div>

                {/* Compact Market & Fed Consensus */}
                {brief.marketConsensus && (
                  <div className="p-3 rounded-xl bg-indigo-950/25 border border-indigo-500/20 text-xs space-y-1">
                    <div className="font-bold text-indigo-300">
                      🔭 มุมมองตลาด & ดอกเบี้ย FED:
                    </div>
                    <p className="text-slate-200 leading-relaxed">
                      {brief.marketConsensus.summary}{' '}
                      {brief.marketConsensus.fedExpectation && (
                        <span className="text-indigo-200">
                          ({brief.marketConsensus.fedExpectation})
                        </span>
                      )}
                    </p>
                  </div>
                )}
              </div>

              {/* Right Column: Action Checklist & Timeframe Plan */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#181C25]/70 border border-white/[0.07] space-y-4 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>พอร์ตของคุณควรทำอะไรต่อ? (Action Plan)</span>
                    </h3>
                  </div>

                  <div className="space-y-2.5">
                    {(brief.actionPlan || []).map((act) => (
                      <div
                        key={act.id}
                        className="p-3 rounded-xl bg-[#12151C]/80 border border-white/[0.05] flex items-start gap-3"
                      >
                        <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shrink-0 mt-0.5">
                          {act.badgeText}
                        </span>
                        <div className="space-y-0.5 text-xs sm:text-sm">
                          <div className="font-bold text-white">{act.title}</div>
                          <p className="text-xs text-slate-300 leading-relaxed">{act.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Compact Short / Medium / Long Term Strip */}
                {brief.timeframeStrategy && (
                  <div className="pt-3 border-t border-white/[0.07] grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                    <div className="p-2.5 rounded-xl bg-[#12151C] border border-white/[0.05]">
                      <div className="font-bold text-amber-400 mb-0.5">⚡ ระยะสั้น (1-7 วัน)</div>
                      <p className="text-slate-300 leading-snug line-clamp-2">
                        {brief.timeframeStrategy.shortTerm?.action}
                      </p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#12151C] border border-white/[0.05]">
                      <div className="font-bold text-indigo-400 mb-0.5">📅 ระยะกลาง (1-3 เดือน)</div>
                      <p className="text-slate-300 leading-snug line-clamp-2">
                        {brief.timeframeStrategy.mediumTerm?.action}
                      </p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#12151C] border border-white/[0.05]">
                      <div className="font-bold text-emerald-400 mb-0.5">🌱 ระยะยาว (6 เดือน+)</div>
                      <p className="text-slate-300 leading-snug line-clamp-2">
                        {brief.timeframeStrategy.longTerm?.action}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'catalysts' && (
          <div className="space-y-6 animate-fade-in">
            {/* Upcoming Catalysts */}
            {brief.upcomingCatalysts && brief.upcomingCatalysts.length > 0 ? (
              <div className="space-y-3.5">
                <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  <CalendarClock className="w-4 h-4 text-rose-400" />
                  <span>ตัวเลขเศรษฐกิจและเหตุการณ์สำคัญที่ตลาดรอดู</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {brief.upcomingCatalysts.map((event) => (
                    <div
                      key={event.id}
                      className="p-4 rounded-2xl bg-[#181C25] border border-white/[0.08] space-y-3 flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-rose-500/15 text-rose-300 border border-rose-500/30">
                            {event.importance === 'critical' ? '🔴 สำคัญมาก' : '🟠 สำคัญสูง'}
                          </span>
                          <span className="text-xs font-mono text-indigo-300 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{event.expectedTiming}</span>
                          </span>
                        </div>
                        <h4 className="font-bold text-white text-sm sm:text-base">
                          {event.eventNameTh}
                        </h4>
                        <p className="text-xs text-slate-300">
                          <strong className="text-slate-400">คาดการณ์:</strong> {event.forecastText}
                        </p>
                      </div>

                      <div className="pt-2.5 border-t border-white/[0.06] text-xs space-y-1">
                        <div className="font-bold text-indigo-300">🎯 การเตรียมตัวของพอร์ต:</div>
                        <p className="text-slate-200 leading-relaxed">
                          {event.portfolioPreparation}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-6 rounded-2xl bg-[#181C25] text-center text-xs text-slate-400">
                ไม่มีประกาศตัวเลขมหภาคระดับวิกฤตในระยะประชิด
              </div>
            )}

            {/* Scenario A & B */}
            {brief.defensivePlaybook &&
              (brief.defensivePlaybook.scenarioAPlan || brief.defensivePlaybook.scenarioBPlan) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {brief.defensivePlaybook.scenarioAPlan && (
                    <div className="p-4 rounded-2xl bg-rose-950/25 border border-rose-500/25 space-y-1.5">
                      <div className="flex items-center gap-2 text-xs font-bold text-rose-400">
                        <TrendingDown className="w-4 h-4" />
                        <span>แผนสำรอง A (หากตลาดย่อตัวต่อ): {brief.defensivePlaybook.scenarioAPlan.condition}</span>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                        {brief.defensivePlaybook.scenarioAPlan.action}
                      </p>
                    </div>
                  )}

                  {brief.defensivePlaybook.scenarioBPlan && (
                    <div className="p-4 rounded-2xl bg-emerald-950/25 border border-emerald-500/25 space-y-1.5">
                      <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                        <TrendingUp className="w-4 h-4" />
                        <span>แผนสำรอง B (หากตลาดรีบาวด์): {brief.defensivePlaybook.scenarioBPlan.condition}</span>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                        {brief.defensivePlaybook.scenarioBPlan.action}
                      </p>
                    </div>
                  )}
                </div>
              )}
          </div>
        )}

        {activeTab === 'deep_framework' && (
          <div className="space-y-6 animate-fade-in">
            <MarketDecisionFrameworkCard
              framework={
                brief.decisionFramework ||
                buildDefaultMarketDecisionFramework(
                  brief.overallSentiment,
                  brief.sentimentScore,
                  (brief.holdingsImpact || []).map((h) => h.symbol)
                )
              }
            />

            {brief.interestingStocks && brief.interestingStocks.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  <Eye className="w-4 h-4 text-emerald-400" />
                  <span>หุ้น & ETF น่าจับตาเพิ่มเติมในช่วงนี้</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                  {brief.interestingStocks.map((stock) => (
                    <div
                      key={stock.symbol}
                      className="p-4 rounded-2xl bg-[#181C25] border border-white/[0.08] space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-black text-white text-sm px-2.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          {stock.symbol}
                        </span>
                        <span className="text-xs text-slate-400 truncate max-w-[160px]">
                          {stock.theme}
                        </span>
                      </div>
                      <div className="text-xs font-bold text-slate-200">{stock.name}</div>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        {stock.whyInteresting}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
