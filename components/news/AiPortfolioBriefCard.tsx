'use client'

import React, { useState } from 'react'
import {
  Sparkles,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  RefreshCw,
  Loader2,
  Clock,
  CheckCircle2,
  Target,
  Compass,
  Eye,
  Zap,
  Copy,
  Check,
  Layers,
  ShieldAlert,
  ArrowUpRight,
  TrendingDown,
  DollarSign,
  Activity,
  Calendar,
  Flame,
} from 'lucide-react'
import type {
  PortfolioDailyBrief,
  TodayMarketHighlight,
  PortfolioAssetImpact,
  ActionPlanItem,
  InterestingStockOpportunity,
} from '@/lib/news/news-analyzer'

interface AiPortfolioBriefCardProps {
  brief: PortfolioDailyBrief | null
  onRefreshBrief?: () => Promise<void>
}

type BriefTab = 'all' | 'highlights' | 'consensus' | 'holdings' | 'strategy' | 'actions' | 'watchlist'
type ViewMode = 'executive' | 'speed'

export function AiPortfolioBriefCard({ brief, onRefreshBrief }: AiPortfolioBriefCardProps) {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState<BriefTab>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('executive')
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
    ? 'เชิงบวก (Bullish Momentum)'
    : isBearish
    ? 'ระมัดระวังความเสี่ยง (Bearish / Defensive)'
    : 'เป็นกลาง คัดเลือกลงทุนเฉพาะกลุ่ม (Selective / Neutral)'

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

  const copyBriefToClipboard = () => {
    const lines = [
      `📊 Investment Pro: สรุปภาพรวม & กลยุทธ์พอร์ตประจำวัน (${formattedDate})`,
      `บรรยากาศตลาด: ${brief.marketConsensus?.moodLabel || sentimentLabel} (${sentimentPercent}%)`,
      `\n💡 สรุปใจความสำคัญ:\n${brief.summaryOneLiner || brief.strategicTakeaway}`,
      `\n⚡ วันนี้เกิดอะไรขึ้น:`,
      ...(brief.todayHighlights || []).map((h) => `- [${h.tag}] ${h.title}: ${h.detail}`),
      `\n🎯 ผลกระทบต่อพอร์ตของฉัน:`,
      ...(brief.holdingsImpact || []).map((hi) => `- ${hi.symbol}: ${hi.headline} (${hi.actionSuggestion})`),
      `\n🛠️ พอร์ตควรทำอย่างไร:`,
      ...(brief.actionPlan || []).map((a) => `- [${a.badgeText}] ${a.title}: ${a.detail}`),
      `\n🌟 หุ้นน่าจับตา:`,
      ...(brief.interestingStocks || []).map((s) => `- ${s.symbol} (${s.name}): ${s.whyInteresting}`),
    ]

    navigator.clipboard.writeText(lines.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <div className="rounded-3xl bg-[#12151C] border border-white/[0.09] shadow-2xl shadow-black/40 relative overflow-hidden transition-all duration-300">
      {/* Ambient background glow */}
      <div className="absolute top-0 right-0 w-[500px] h-[300px] bg-gradient-to-bl from-indigo-600/10 via-purple-600/5 to-transparent blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[250px] bg-gradient-to-tr from-emerald-600/5 via-blue-600/5 to-transparent blur-3xl pointer-events-none" />

      {/* TOP HEADER BAR */}
      <div className="p-5 sm:p-6 pb-4 border-b border-white/[0.07] relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-inner">
              <Sparkles className="w-4 h-4" />
            </div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">
              สรุปข่าวกรอง & กลยุทธ์พอร์ตประจำวัน
            </h2>
            <span className="text-[11px] font-mono font-medium px-2.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
              <Clock className="w-3 h-3 text-indigo-400" />
              <span>อ่านจบใน {brief.readingTimeMinutes || 2} นาที</span>
            </span>
            <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
              • อัปเดต {formattedDate}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-3xl">
            สังเคราะห์เหตุการณ์สำคัญล่าสุด ผลกระทบเจาะจงรายตัวในพอร์ตของคุณ พร้อมแผนปฏิบัติการระยะสั้น-กลาง-ยาว
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 self-start lg:self-center shrink-0 flex-wrap">
          {/* Mode Switcher */}
          <div className="flex items-center bg-[#181C25] p-1 rounded-xl border border-white/[0.08] text-xs">
            <button
              onClick={() => setViewMode('executive')}
              className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'executive'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>โหมดผู้บริหาร</span>
            </button>
            <button
              onClick={() => setViewMode('speed')}
              className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'speed'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>สรุปด่วน 60 วิ</span>
            </button>
          </div>

          {/* Copy Brief Button */}
          <button
            onClick={copyBriefToClipboard}
            className="bg-[#181C25] hover:bg-[#202532] text-slate-300 hover:text-white border border-white/[0.08] px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
            title="คัดลอกบทสรุปทั้งหมด"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">คัดลอกแล้ว</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span>คัดลอกสรุป</span>
              </>
            )}
          </button>

          {/* Refresh AI Brief */}
          {onRefreshBrief && (
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
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
      </div>

      {/* EXECUTIVE 1-LINER HERO BANNER */}
      <div className="p-5 sm:p-6 bg-gradient-to-r from-indigo-950/40 via-[#161a26]/70 to-[#12151C] border-b border-white/[0.06] relative z-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-4xl">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Key Takeaway Today
              </span>
              <span className="text-xs text-slate-400 font-mono">
                บรรยากาศตลาด: <span className={`font-bold ${sentimentColor}`}>{brief.marketConsensus?.moodLabel || sentimentLabel}</span>
              </span>
            </div>
            <p className="text-sm sm:text-base font-semibold text-white leading-relaxed">
              &ldquo;{brief.summaryOneLiner || brief.strategicTakeaway}&rdquo;
            </p>
          </div>

          {/* Sentiment Gauge Pill */}
          <div className="shrink-0 bg-[#181C25]/90 border border-white/[0.08] p-3 rounded-2xl flex flex-col gap-2 min-w-[200px]">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium">คะแนนความเชื่อมั่น:</span>
              <span className={`font-mono font-bold ${sentimentColor}`}>
                {sentimentPercent}%
              </span>
            </div>
            <div className="w-full bg-[#12151C] h-1.5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${sentimentBarBg}`}
                style={{ width: `${Math.max(5, Math.min(100, sentimentPercent))}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-0.5">
              <span className="text-emerald-400">บวก {brief.positiveCount}</span>
              <span className="text-slate-400">กลาง {brief.neutralCount}</span>
              <span className="text-rose-400">เสี่ยง {brief.negativeCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* SPEED SCAN MODE (TL;DR 60-Second View) */}
      {viewMode === 'speed' ? (
        <div className="p-5 sm:p-6 space-y-6 relative z-10 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 1. What Happened Flash */}
            <div className="p-4 rounded-2xl bg-[#181C25]/80 border border-white/[0.07] space-y-3">
              <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider">
                <Flame className="w-4 h-4 text-amber-400" />
                <span>1. วันนี้เกิดอะไรขึ้น (Market Flash)</span>
              </div>
              <ul className="space-y-2 text-xs text-slate-300">
                {(brief.todayHighlights || []).slice(0, 3).map((item) => (
                  <li key={item.id} className="flex items-start gap-2">
                    <span className="text-indigo-400 font-bold shrink-0 mt-0.5">•</span>
                    <div>
                      <span className="font-semibold text-white">{item.title}:</span>{' '}
                      <span className="text-slate-300">{item.detail}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* 2. Market Consensus Flash */}
            <div className="p-4 rounded-2xl bg-[#181C25]/80 border border-white/[0.07] space-y-3">
              <div className="flex items-center gap-2 text-blue-400 text-xs font-bold uppercase tracking-wider">
                <Compass className="w-4 h-4 text-blue-400" />
                <span>2. คนคาดการณ์ตลาดว่ายังไง (Consensus)</span>
              </div>
              <div className="space-y-2 text-xs text-slate-300">
                <p>
                  <strong className="text-white">มุมมองหลัก:</strong> {brief.marketConsensus?.summary}
                </p>
                <p>
                  <strong className="text-white">ดอกเบี้ย FED:</strong> {brief.marketConsensus?.fedExpectation}
                </p>
                <p className="text-amber-300">
                  <strong className="text-amber-400">จุดระวัง:</strong> {brief.marketConsensus?.keyRisksToWatch}
                </p>
              </div>
            </div>

            {/* 3. My Portfolio Impact Flash */}
            <div className="p-4 rounded-2xl bg-[#181C25]/80 border border-white/[0.07] space-y-3">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                <Target className="w-4 h-4 text-emerald-400" />
                <span>3. ส่งผลต่อพอร์ตของฉันอย่างไร (Holdings Impact)</span>
              </div>
              <div className="space-y-2 text-xs">
                {(brief.holdingsImpact || []).slice(0, 4).map((hi) => (
                  <div key={hi.symbol} className="flex items-start justify-between gap-2 border-b border-white/[0.04] pb-1.5 last:border-none">
                    <div className="space-y-0.5">
                      <span className="font-mono font-bold text-white mr-2">{hi.symbol}</span>
                      <span className="text-slate-300">{hi.headline}</span>
                    </div>
                    <span className="shrink-0 text-[10px] font-medium px-2 py-0.5 rounded bg-white/[0.05] text-slate-300 border border-white/[0.08]">
                      {hi.actionSuggestion}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* 4. Action Plan Flash */}
            <div className="p-4 rounded-2xl bg-[#181C25]/80 border border-white/[0.07] space-y-3">
              <div className="flex items-center gap-2 text-purple-400 text-xs font-bold uppercase tracking-wider">
                <CheckCircle2 className="w-4 h-4 text-purple-400" />
                <span>4. พอร์ตของฉันควรทำยังไง (Action Checklist)</span>
              </div>
              <ul className="space-y-2 text-xs text-slate-300">
                {(brief.actionPlan || []).map((action) => (
                  <li key={action.id} className="flex items-start gap-2">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shrink-0">
                      {action.badgeText}
                    </span>
                    <div>
                      <strong className="text-white">{action.title}:</strong> {action.detail}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : (
        /* EXECUTIVE DETAILED BRIEF (All 6 Pillars with Section Navigation) */
        <div className="p-5 sm:p-6 space-y-8 relative z-10">
          {/* Quick Pillar Filter Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin text-xs">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-xl font-medium shrink-0 transition-all cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-white text-slate-900 font-bold shadow-md'
                  : 'bg-[#181C25] text-slate-400 hover:text-slate-200 border border-white/[0.06]'
              }`}
            >
              แสดงทั้งหมด
            </button>
            <button
              onClick={() => setActiveTab('highlights')}
              className={`px-3 py-1.5 rounded-xl font-medium shrink-0 transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'highlights'
                  ? 'bg-indigo-600 text-white font-bold shadow-md'
                  : 'bg-[#181C25] text-slate-400 hover:text-slate-200 border border-white/[0.06]'
              }`}
            >
              <span>⚡ วันนี้เกิดอะไรขึ้น</span>
            </button>
            <button
              onClick={() => setActiveTab('consensus')}
              className={`px-3 py-1.5 rounded-xl font-medium shrink-0 transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'consensus'
                  ? 'bg-indigo-600 text-white font-bold shadow-md'
                  : 'bg-[#181C25] text-slate-400 hover:text-slate-200 border border-white/[0.06]'
              }`}
            >
              <span>🔭 คนคาดการณ์ตลาดว่ายังไง</span>
            </button>
            <button
              onClick={() => setActiveTab('holdings')}
              className={`px-3 py-1.5 rounded-xl font-medium shrink-0 transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'holdings'
                  ? 'bg-indigo-600 text-white font-bold shadow-md'
                  : 'bg-[#181C25] text-slate-400 hover:text-slate-200 border border-white/[0.06]'
              }`}
            >
              <span>🎯 ส่งผลต่อพอร์ตของฉัน</span>
            </button>
            <button
              onClick={() => setActiveTab('strategy')}
              className={`px-3 py-1.5 rounded-xl font-medium shrink-0 transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'strategy'
                  ? 'bg-indigo-600 text-white font-bold shadow-md'
                  : 'bg-[#181C25] text-slate-400 hover:text-slate-200 border border-white/[0.06]'
              }`}
            >
              <span>⏱️ ระยะสั้น-กลาง-ยาว</span>
            </button>
            <button
              onClick={() => setActiveTab('actions')}
              className={`px-3 py-1.5 rounded-xl font-medium shrink-0 transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'actions'
                  ? 'bg-indigo-600 text-white font-bold shadow-md'
                  : 'bg-[#181C25] text-slate-400 hover:text-slate-200 border border-white/[0.06]'
              }`}
            >
              <span>🛠️ พอร์ตควรทำอย่างไร</span>
            </button>
            <button
              onClick={() => setActiveTab('watchlist')}
              className={`px-3 py-1.5 rounded-xl font-medium shrink-0 transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'watchlist'
                  ? 'bg-indigo-600 text-white font-bold shadow-md'
                  : 'bg-[#181C25] text-slate-400 hover:text-slate-200 border border-white/[0.06]'
              }`}
            >
              <span>🌟 หุ้นน่าจับตา</span>
            </button>
          </div>

          {/* PILLAR 1: วันนี้เกิดอะไรขึ้น / ช่วงนี้เกิดอะไรขึ้น */}
          {(activeTab === 'all' || activeTab === 'highlights') && (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                    <Flame className="w-3.5 h-3.5" />
                  </div>
                  <h3 className="text-sm font-bold text-white tracking-wide">
                    1. วันนี้เกิดอะไรขึ้น & ช่วงนี้เกิดอะไรขึ้น (Market Flash)
                  </h3>
                </div>
                <span className="text-[11px] text-slate-500 font-mono">
                  {(brief.todayHighlights || []).length} ประเด็นสำคัญ
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {(brief.todayHighlights || []).map((highlight) => {
                  const isPos = highlight.sentiment === 'positive'
                  const isNeg = highlight.sentiment === 'negative'
                  const statusBg = isPos
                    ? 'border-emerald-500/20 bg-emerald-950/10'
                    : isNeg
                    ? 'border-rose-500/20 bg-rose-950/10'
                    : 'border-white/[0.07] bg-[#181C25]/70'

                  const tagColor = isPos
                    ? 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30'
                    : isNeg
                    ? 'text-rose-400 bg-rose-500/15 border-rose-500/30'
                    : 'text-indigo-300 bg-indigo-500/15 border-indigo-500/30'

                  return (
                    <div
                      key={highlight.id}
                      className={`p-4 rounded-2xl border ${statusBg} flex flex-col justify-between space-y-3 transition-all hover:border-white/[0.15]`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${tagColor}`}>
                            {highlight.tag}
                          </span>
                          {highlight.relatedSymbol && (
                            <span className="text-[10px] font-mono font-bold text-slate-400">
                              {highlight.relatedSymbol}
                            </span>
                          )}
                        </div>
                        <h4 className="font-bold text-white text-xs sm:text-sm leading-snug">
                          {highlight.title}
                        </h4>
                        <p className="text-xs text-slate-300 leading-relaxed">
                          {highlight.detail}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isPos ? 'bg-emerald-400' : isNeg ? 'bg-rose-400' : 'bg-slate-400'
                          }`}
                        />
                        <span>{isPos ? 'ปัจจัยบวก' : isNeg ? 'ปัจจัยเสี่ยง' : 'เป็นกลาง'}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* PILLAR 2: คนคาดการณ์ตลาดว่ายังไง */}
          {(activeTab === 'all' || activeTab === 'consensus') && (
            <div className="space-y-3.5">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <Compass className="w-3.5 h-3.5" />
                </div>
                <h3 className="text-sm font-bold text-white tracking-wide">
                  2. คนคาดการณ์ตลาดว่ายังไง (Market Consensus & Outlook)
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                {/* 1. Main Market Sentiment */}
                <div className="p-4 rounded-2xl bg-[#181C25]/80 border border-blue-500/20 space-y-2">
                  <div className="flex items-center gap-2 text-blue-400 text-xs font-bold uppercase tracking-wider">
                    <Activity className="w-4 h-4" />
                    <span>มุมมองภาพรวมตลาด & นักวิเคราะห์</span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-medium">
                    {brief.marketConsensus?.summary}
                  </p>
                </div>

                {/* 2. Fed & Rate Expectations */}
                <div className="p-4 rounded-2xl bg-[#181C25]/80 border border-indigo-500/20 space-y-2">
                  <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider">
                    <DollarSign className="w-4 h-4" />
                    <span>ทิศทางดอกเบี้ย FED & เศรษฐกิจมหภาค</span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-medium">
                    {brief.marketConsensus?.fedExpectation}
                  </p>
                </div>

                {/* 3. Key Risks to Watch */}
                <div className="p-4 rounded-2xl bg-[#181C25]/80 border border-amber-500/20 space-y-2">
                  <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
                    <ShieldAlert className="w-4 h-4" />
                    <span>ปัจจัยเสี่ยงที่ตลาดเฝ้าระวัง</span>
                  </div>
                  <p className="text-xs sm:text-sm text-amber-200/90 leading-relaxed font-medium">
                    {brief.marketConsensus?.keyRisksToWatch}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* PILLAR 3: ส่งผลอย่างไรต่อพอร์ตของผม */}
          {(activeTab === 'all' || activeTab === 'holdings') && (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <Target className="w-3.5 h-3.5" />
                  </div>
                  <h3 className="text-sm font-bold text-white tracking-wide">
                    3. ส่งผลอย่างไรต่อพอร์ตของผม (Holding-by-Holding Impact)
                  </h3>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">
                  วิเคราะห์ตรงกับหุ้นที่คุณถือครอง
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {(brief.holdingsImpact || []).map((h) => {
                  const isPos = h.impact === 'positive'
                  const isNeg = h.impact === 'negative'
                  const statusBg = isPos
                    ? 'border-emerald-500/25 bg-emerald-950/10'
                    : isNeg
                    ? 'border-rose-500/25 bg-rose-950/10'
                    : 'border-white/[0.08] bg-[#181C25]/80'

                  const statusBadge = isPos ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                      หนุนเชิงบวก (Tailwind)
                    </span>
                  ) : isNeg ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/15 text-rose-300 border border-rose-500/30">
                      เฝ้าระวังความผันผวน
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                      ผลกระทบเป็นกลาง
                    </span>
                  )

                  return (
                    <div
                      key={h.symbol}
                      className={`p-4 rounded-2xl border ${statusBg} flex flex-col justify-between space-y-3 transition-all hover:border-white/[0.18]`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black font-mono text-white px-2.5 py-0.5 rounded-lg bg-white/[0.06] border border-white/[0.1]">
                              {h.symbol}
                            </span>
                            {h.allocationPercent && h.allocationPercent > 0 ? (
                              <span className="text-[11px] font-mono text-slate-400">
                                {h.allocationPercent}% ของพอร์ต
                              </span>
                            ) : null}
                          </div>
                          {statusBadge}
                        </div>

                        <div>
                          <h4 className="font-bold text-white text-xs sm:text-sm leading-snug">
                            {h.headline}
                          </h4>
                          <p className="text-xs text-slate-300 leading-relaxed mt-1">
                            {h.detail}
                          </p>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-xs">
                        <span className="text-slate-400 text-[11px]">แนวทางสำหรับตัวนี้:</span>
                        <span className="font-semibold text-indigo-300 text-[11px] bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                          {h.actionSuggestion}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* PILLAR 4: แนวทางระยะสั้น กลาง ยาว */}
          {(activeTab === 'all' || activeTab === 'strategy') && (
            <div className="space-y-3.5">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
                  <Clock className="w-3.5 h-3.5" />
                </div>
                <h3 className="text-sm font-bold text-white tracking-wide">
                  4. แนวทางระยะสั้น กลาง ยาว (Timeframe Strategy)
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                {/* Short-term */}
                <div className="p-4 rounded-2xl bg-[#181C25]/80 border border-amber-500/20 space-y-3 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
                      <Zap className="w-4 h-4" />
                      <span>{brief.timeframeStrategy?.shortTerm?.period || 'ระยะสั้น (1 - 7 วัน)'}</span>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-semibold">
                      {brief.timeframeStrategy?.shortTerm?.action}
                    </p>
                  </div>
                  <div className="pt-2 border-t border-white/[0.06] text-[11px] text-slate-400">
                    <strong className="text-amber-400/90">จุดโฟกัส:</strong> {brief.timeframeStrategy?.shortTerm?.focus}
                  </div>
                </div>

                {/* Medium-term */}
                <div className="p-4 rounded-2xl bg-[#181C25]/80 border border-indigo-500/20 space-y-3 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider">
                      <Activity className="w-4 h-4" />
                      <span>{brief.timeframeStrategy?.mediumTerm?.period || 'ระยะกลาง (1 - 3 เดือน)'}</span>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-semibold">
                      {brief.timeframeStrategy?.mediumTerm?.action}
                    </p>
                  </div>
                  <div className="pt-2 border-t border-white/[0.06] text-[11px] text-slate-400">
                    <strong className="text-indigo-400/90">จุดโฟกัส:</strong> {brief.timeframeStrategy?.mediumTerm?.focus}
                  </div>
                </div>

                {/* Long-term */}
                <div className="p-4 rounded-2xl bg-[#181C25]/80 border border-emerald-500/20 space-y-3 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                      <TrendingUp className="w-4 h-4" />
                      <span>{brief.timeframeStrategy?.longTerm?.period || 'ระยะยาว (6 - 12 เดือน+)'}</span>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-semibold">
                      {brief.timeframeStrategy?.longTerm?.action}
                    </p>
                  </div>
                  <div className="pt-2 border-t border-white/[0.06] text-[11px] text-slate-400">
                    <strong className="text-emerald-400/90">จุดโฟกัส:</strong> {brief.timeframeStrategy?.longTerm?.focus}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PILLAR 5: ของพอร์ตผมควรทำยังไง (Action Plan Checklist) */}
          {(activeTab === 'all' || activeTab === 'actions') && (
            <div className="space-y-3.5">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
                <h3 className="text-sm font-bold text-white tracking-wide">
                  5. ของพอร์ตผมควรทำยังไง (Actionable Portfolio Checklist)
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {(brief.actionPlan || []).map((action) => {
                  const isHigh = action.priority === 'high'
                  const isMed = action.priority === 'medium'
                  const priorityColor = isHigh
                    ? 'text-rose-400 bg-rose-500/15 border-rose-500/30'
                    : isMed
                    ? 'text-indigo-400 bg-indigo-500/15 border-indigo-500/30'
                    : 'text-slate-400 bg-white/[0.05] border-white/[0.08]'

                  return (
                    <div
                      key={action.id}
                      className="p-4 rounded-2xl bg-[#181C25]/85 border border-white/[0.08] hover:border-white/[0.16] transition-all flex items-start gap-3.5"
                    >
                      <div className="w-6 h-6 rounded-full bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shrink-0 mt-0.5">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                            {action.badgeText}
                          </span>
                          <span className={`text-[10px] font-mono px-2 py-0.2 rounded border ${priorityColor}`}>
                            {isHigh ? 'ความสำคัญสูง' : isMed ? 'คำแนะนำ' : 'เฝ้าระวัง'}
                          </span>
                        </div>
                        <h4 className="font-bold text-white text-xs sm:text-sm leading-snug">
                          {action.title}
                        </h4>
                        <p className="text-xs text-slate-300 leading-relaxed">
                          {action.detail}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* PILLAR 6: หุ้น/สินทรัพย์ที่น่าสนใจในช่วงนี้ พร้อมเหตุผล */}
          {(activeTab === 'all' || activeTab === 'watchlist') && (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <h3 className="text-sm font-bold text-white tracking-wide">
                    6. หุ้น/สินทรัพย์น่าจับตามองในช่วงนี้ พร้อมเหตุผล (Opportunities to Watch)
                  </h3>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">
                  คัดเลือกตามกระแสข่าวและปัจจัยขับเคลื่อน
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {(brief.interestingStocks || []).map((stock) => (
                  <div
                    key={stock.symbol}
                    className="p-4 rounded-2xl bg-[#181C25]/80 border border-amber-500/20 hover:border-amber-500/40 transition-all flex flex-col justify-between space-y-3 group"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-black font-mono text-white px-2.5 py-0.5 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30">
                          {stock.symbol}
                        </span>
                        <span className="text-[10px] font-medium text-slate-400 truncate max-w-[120px]">
                          {stock.name}
                        </span>
                      </div>

                      <div className="text-[11px] font-semibold text-indigo-400">
                        {stock.theme}
                      </div>

                      <p className="text-xs text-slate-200 leading-relaxed">
                        <strong className="text-white">ทำไมถึงน่าสนใจ:</strong> {stock.whyInteresting}
                      </p>
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-white/[0.06] text-[11px]">
                      <div className="text-emerald-300 leading-tight">
                        <strong>🚀 ตัวเร่ง (Catalyst):</strong> {stock.catalyst}
                      </div>
                      <div className="text-rose-300/90 leading-tight">
                        <strong>⚠️ ความเสี่ยง:</strong> {stock.riskNote}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* FOOTER BAR */}
      <div className="px-5 sm:px-6 py-3 bg-[#0d1017] border-t border-white/[0.06] flex items-center justify-between text-[11px] text-slate-500 font-mono">
        <div className="flex items-center gap-2">
          <span>Investment Pro Intelligence Engine</span>
          {brief.modelUsed && <span>• ใช้โมเดล: {brief.modelUsed}</span>}
        </div>
        <div>
          <span>คำแนะนำเพื่อการวางแผนกลยุทธ์ส่วนบุคคล</span>
        </div>
      </div>
    </div>
  )
}
