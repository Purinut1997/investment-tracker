'use client'

import React, { useState } from 'react'
import useSWR from 'swr'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/PageHeader'
import { StockLogo } from '@/components/StockLogo'
import { StockDetailModal } from '@/components/market-watch/StockDetailModal'
import {
  Compass,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Loader2,
  Target,
  Wallet,
  TrendingUp,
  TrendingDown,
  Layers,
  ArrowRight,
  Send,
  MessageSquare,
  HelpCircle,
  Activity,
  History,
  Info,
  CheckCircle2,
  Calendar,
  Flame,
  ShieldAlert,
} from 'lucide-react'
import type { TacticalAdvisorPayload, TacticalActionItem } from '@/app/api/tactical-advisor/route'

export interface AvailableDateItem {
  dateKey: string
  labelTh: string
  createdAt: string
  isToday: boolean
}

export interface TacticalAdvisorApiResponse {
  success: boolean
  data: TacticalAdvisorPayload
  cached: boolean
  isHistorical?: boolean
  selectedDate?: string
  availableDates?: AvailableDateItem[]
  generatedAt: string
  modelUsed: string
}

export default function TacticalAdvisorPage() {
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [selectedActionFilter, setSelectedActionFilter] = useState<'ALL' | 'ACCUMULATE' | 'HOLD_WATCH' | 'TRIM_PROFIT'>('ALL')
  const [selectedStock, setSelectedStock] = useState<{ symbol: string; market: string } | null>(null)

  // Copilot Chat State
  const [chatQuestion, setChatQuestion] = useState('')
  const [isChatLoading, setIsChatLoading] = useState(false)
  const [chatAnswer, setChatAnswer] = useState<string | null>(null)

  // Fetch Tactical Advisor Data with SWR (with selected historical date if any)
  const endpointUrl = selectedDate ? `/api/tactical-advisor?date=${selectedDate}` : '/api/tactical-advisor'
  const { data: responseData, error, isLoading, mutate } = useSWR<TacticalAdvisorApiResponse>(endpointUrl, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  })

  const payload = responseData?.data

  // Handle Manual Refresh Analysis
  const handleRefresh = async () => {
    try {
      setIsRefreshing(true)
      setSelectedDate(null)
      const res = await fetch('/api/tactical-advisor?refresh=true', { method: 'GET' })
      if (res.ok) {
        const json = await res.json()
        mutate(json, false)
      }
    } catch (err) {
      console.error('Failed to refresh tactical advisor', err)
    } finally {
      setIsRefreshing(false)
    }
  }

  // Handle Copilot Chat Submission
  const handleAskQuestion = async (qText?: string) => {
    const questionToSend = qText || chatQuestion
    if (!questionToSend.trim()) return

    try {
      setIsChatLoading(true)
      setChatAnswer(null)
      const res = await fetch('/api/tactical-advisor/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: questionToSend,
          tacticalContext: payload,
        }),
      })

      if (res.ok) {
        const json = await res.json()
        setChatAnswer(json.answer)
      } else {
        setChatAnswer('เกิดข้อผิดพลาดในการประมวลผลคำตอบ กรุณาลองใหม่อีกครั้ง')
      }
    } catch {
      setChatAnswer('ไม่สามารถเชื่อมต่อกับ AI ได้ในขณะนี้')
    } finally {
      setIsChatLoading(false)
    }
  }

  // Filter actions
  const filteredActions = (payload?.tacticalActions || []).filter((item) => {
    if (selectedActionFilter === 'ALL') return true
    return item.action === selectedActionFilter
  })

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-white/[0.06]">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400">
                <Sparkles className="w-5 h-5" />
              </span>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                AI ชี้เป้าตามสภาวะตลาด (Tactical Advisor)
              </h1>
            </div>
            <p className="text-sm text-slate-300 mt-1.5 leading-relaxed">
              สังเคราะห์สภาวะตลาดโลกภายนอก (Macro/Sentiment) ผสานสุขภาพพอร์ตจริงภายในของคุณ เพื่อวางแผนปฏิบัติการเฉพาะตัวในห้วงเวลานี้
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">
            {responseData?.cached && (
              <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-1.5 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>{responseData.isHistorical ? 'บันทึกประวัติย้อนหลัง' : 'โหลดทันใจจากแคชเช้า (<50ms)'}</span>
              </span>
            )}
            {payload?.asOfDateThai && (
              <span className="text-xs font-mono text-slate-300 hidden sm:inline">
                ข้อมูล ณ: {payload.asOfDateThai}
              </span>
            )}
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing || isLoading}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-md hover:shadow-indigo-500/25 disabled:opacity-50"
              title="วิเคราะห์ตลาดสดใหม่ ณ วินาทีนี้"
            >
              {isRefreshing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>กำลังวิเคราะห์ตลาด...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  <span>วิเคราะห์สดใหม่</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* ── DAILY TIMELINE SNAPSHOT SELECTOR ── */}
        {responseData?.availableDates && responseData.availableDates.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] backdrop-blur-sm">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-200">
              <Calendar className="w-4 h-4 text-indigo-400" />
              <span>บันทึกการวิเคราะห์รายวัน:</span>
              <span className="text-xs font-normal text-slate-400 hidden md:inline">
                (สลับดูประวัติคำแนะนำย้อนหลังได้ทันที &lt;50ms)
              </span>
            </div>

            {/* Date Pill Selector */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              {responseData.availableDates.map((d) => {
                const isCurrentActive = selectedDate ? selectedDate === d.dateKey : d.isToday
                return (
                  <button
                    key={d.dateKey}
                    type="button"
                    onClick={() => {
                      if (d.isToday) {
                        setSelectedDate(null)
                      } else {
                        setSelectedDate(d.dateKey)
                      }
                    }}
                    className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
                      isCurrentActive
                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/25 ring-1 ring-white/20'
                        : 'bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white border border-white/[0.06]'
                    }`}
                  >
                    {d.isToday && <Sparkles className="w-3.5 h-3.5 text-amber-300" />}
                    <span>{d.labelTh}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ── HISTORICAL NOTICE BANNER (WHEN BROWSING PAST DATES) ── */}
        {responseData?.isHistorical && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-100 text-sm animate-fadeIn">
            <div className="flex items-center gap-2.5">
              <History className="w-5 h-5 text-amber-400 shrink-0" />
              <span>
                คุณกำลังเปิดดู <strong>บันทึกย้อนหลังของวันที่ {payload?.asOfDateThai}</strong> (Historical Snapshot)
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedDate(null)}
              className="px-3.5 py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-xs sm:text-sm font-bold cursor-pointer transition-colors shrink-0 self-start sm:self-auto flex items-center gap-1.5"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>กลับสู่การวิเคราะห์ล่าสุดวันนี้</span>
            </button>
          </div>
        )}

        {/* Loading / Error States */}
        {isLoading && !payload && (
          <div className="py-20 flex flex-col items-center justify-center text-center space-y-3">
            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
            <p className="text-sm font-semibold text-slate-200">
              AI กำลังประมวลผลข้อมูลสภาวะตลาดโลกและตรวจเช็คสุขภาพพอร์ตของคุณ...
            </p>
            <span className="text-xs text-slate-500">ใช้เวลาประมาณ 3-5 วินาที</span>
          </div>
        )}

        {error && !payload && (
          <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-center space-y-2">
            <AlertTriangle className="w-6 h-6 text-rose-400 mx-auto" />
            <p className="text-sm font-bold text-rose-200">ไม่สามารถโหลดข้อมูล Tactical Advisor ได้</p>
            <p className="text-xs text-slate-400">กรุณากดปุ่ม "วิเคราะห์สดใหม่" ด้านบนเพื่อลองใหม่อีกครั้ง</p>
          </div>
        )}

        {payload && (
          <div className="space-y-6">
            {/* ── TOP SECTION: 2 COLUMNS (MARKET CLIMATE & PORTFOLIO RESILIENCE) ── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Card 1: Market Climate (6 Cols) */}
              <div className="lg:col-span-6 p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-[#121622] to-[#151A29] border border-white/[0.08] shadow-md space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Compass className="w-5 h-5 text-amber-400" />
                    <h3 className="text-base font-bold text-white uppercase tracking-wider">
                      1. สภาวะตลาดห้วงเวลานี้ (Market Climate)
                    </h3>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs sm:text-sm font-bold bg-amber-500/15 border border-amber-500/30 text-amber-300">
                    {payload.marketRegime.statusLabelTh}
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] space-y-2.5">
                  <p className="text-sm sm:text-base text-slate-100 leading-relaxed font-sans font-medium">
                    {payload.marketRegime.summaryTh}
                  </p>
                  <div className="flex items-center justify-between text-xs sm:text-sm text-slate-300 pt-2 border-t border-white/[0.04]">
                    <span>ระดับความเสี่ยงของตลาด:</span>
                    <span className="font-bold text-amber-300 font-mono text-sm sm:text-base">
                      {payload.marketRegime.riskLevel}/5 ({payload.marketRegime.riskLevelLabel})
                    </span>
                  </div>
                </div>

                {/* Sentiment & Macro Drivers */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs sm:text-sm p-3 rounded-xl bg-[#0A0D14] border border-white/[0.04]">
                    <span className="text-slate-300 flex items-center gap-2 font-medium">
                      <Flame className="w-4 h-4 text-rose-400" />
                      ดัชนีอารมณ์ตลาด (CNN Fear & Greed):
                    </span>
                    <span className="font-mono font-bold text-white text-sm sm:text-base">
                      {payload.marketRegime.fearGreedScore}/100 ({payload.marketRegime.fearGreedLabel})
                    </span>
                  </div>

                  <div className="space-y-2 pt-1">
                    <span className="text-xs sm:text-sm font-bold text-slate-300 block">
                      ⚡ 3 ปัจจัยเร่งตลาดโลกที่ต้องจับตา:
                    </span>
                    {payload.marketRegime.macroDrivers.map((driver, idx) => (
                      <div
                        key={idx}
                        className="text-xs sm:text-sm text-slate-200 flex items-start gap-2.5 bg-[#0A0D14] p-3 rounded-xl border border-white/[0.04] leading-relaxed"
                      >
                        <span className="text-indigo-400 font-bold shrink-0 mt-0.5">•</span>
                        <span>{driver}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Card 2: Portfolio Resilience & Thematic Exposure (6 Cols) */}
              <div className="lg:col-span-6 p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-[#121622] to-[#151A29] border border-white/[0.08] shadow-md space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    <h3 className="text-base font-bold text-white uppercase tracking-wider">
                      2. ความพร้อมของพอร์ตคุณ (Resilience)
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm text-slate-300">คะแนนความพร้อม:</span>
                    <span className="px-3 py-1 rounded-xl text-xs sm:text-sm font-mono font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
                      {payload.portfolioResilience.score}/100
                    </span>
                  </div>
                </div>

                {/* Thematic Overlap Alert (if any) */}
                {payload.portfolioResilience.thematicRiskAlert && (
                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-2.5 text-xs sm:text-sm text-amber-200">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">
                      <strong>เตือนความเสี่ยงเชิงธีม:</strong> {payload.portfolioResilience.thematicRiskAlert}
                    </span>
                  </div>
                )}

                {/* Strengths & Vulnerabilities */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-xl bg-emerald-500/[0.04] border border-emerald-500/15 space-y-2">
                    <span className="text-xs sm:text-sm font-bold text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      จุดแข็งในการรับมือตลาด:
                    </span>
                    <ul className="space-y-1.5 text-xs sm:text-sm text-slate-200 leading-relaxed">
                      {payload.portfolioResilience.strengths.map((s, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-emerald-400 shrink-0">✓</span>
                          <span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-3.5 rounded-xl bg-rose-500/[0.04] border border-rose-500/15 space-y-2">
                    <span className="text-xs sm:text-sm font-bold text-rose-400 flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4" />
                      จุดเปราะบางที่ต้องระวัง:
                    </span>
                    <ul className="space-y-1.5 text-xs sm:text-sm text-slate-200 leading-relaxed">
                      {payload.portfolioResilience.vulnerabilities.map((v, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-rose-400 shrink-0">!</span>
                          <span>{v}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Cash Readiness Metric */}
                <div className="p-3.5 rounded-xl bg-[#0A0D14] border border-white/[0.04] flex items-center justify-between text-xs sm:text-sm">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-indigo-400" />
                    <span className="text-slate-300 font-medium">เงินสดพร้อมช้อนซื้อ (Dry Powder):</span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-white text-base sm:text-lg">
                      {payload.cashStrategy.currentCashPercent}%
                    </span>
                    <span className="text-slate-400 text-xs sm:text-sm ml-1.5 font-sans">
                      ({payload.cashStrategy.currentCashTotalBase.toLocaleString()} {payload.cashStrategy.baseCurrency})
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── MIDDLE SECTION: TACTICAL ACTION CARDS ── */}
            <div className="p-5 sm:p-6 rounded-2xl bg-[#0F131D] border border-white/[0.08] shadow-md space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Target className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-base sm:text-lg font-bold text-white tracking-wide">
                    3. แผนวางหมากรายตัวสำหรับพอร์ตคุณ (Tactical Actions)
                  </h3>
                </div>

                {/* Filter Chips */}
                <div className="flex items-center gap-2 flex-wrap">
                  {(
                    [
                      { id: 'ALL', label: 'ทั้งหมด' },
                      { id: 'ACCUMULATE', label: '🟢 สะสมเพิ่ม (Dip Buy)' },
                      { id: 'HOLD_WATCH', label: '🟡 ถือจับตางบ' },
                      { id: 'TRIM_PROFIT', label: '🔴 ทยอยล็อกกำไร' },
                    ] as const
                  ).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setSelectedActionFilter(f.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold border transition-all cursor-pointer ${
                        selectedActionFilter === f.id
                          ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                          : 'bg-white/[0.03] text-slate-300 border-white/[0.06] hover:text-white'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Cards Grid */}
              {filteredActions.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-400 bg-white/[0.01] rounded-xl border border-white/[0.04]">
                  ไม่มีรายการคำแนะนำในหมวดหมู่นี้สำหรับพอร์ตของคุณ
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {filteredActions.map((item) => {
                    const isAccumulate = item.action === 'ACCUMULATE'
                    const isTrim = item.action === 'TRIM_PROFIT'
                    const isHold = item.action === 'HOLD_WATCH'

                    const borderClass = isAccumulate
                      ? 'border-emerald-500/30 bg-gradient-to-br from-emerald-950/20 to-[#121622]'
                      : isTrim
                      ? 'border-rose-500/30 bg-gradient-to-br from-rose-950/20 to-[#121622]'
                      : 'border-amber-500/30 bg-gradient-to-br from-amber-950/20 to-[#121622]'

                    const badgeClass = isAccumulate
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : isTrim
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      : 'bg-amber-500/20 text-amber-300 border-amber-500/40'

                    return (
                      <div
                        key={item.id}
                        className={`p-5 rounded-2xl border ${borderClass} shadow-md space-y-3.5 flex flex-col justify-between`}
                      >
                        {/* Header: Logo, Ticker, Action Badge */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <StockLogo ticker={item.ticker} name={item.assetName} size={38} />
                              <div>
                                <span className="font-bold text-white text-base sm:text-lg block tracking-wide">
                                  {item.ticker}
                                </span>
                                <span className="text-xs sm:text-sm text-slate-300 block truncate max-w-[170px] font-medium">
                                  {item.assetName}
                                </span>
                              </div>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs sm:text-sm font-bold border shrink-0 ${badgeClass}`}>
                              {item.actionLabel}
                            </span>
                          </div>

                          {/* Price & Target Zone */}
                          <div className="p-3 rounded-xl bg-black/50 border border-white/[0.08] flex items-center justify-between text-xs sm:text-sm font-mono">
                            <div>
                              <span className="text-xs text-slate-400 block mb-0.5">ราคาปัจจุบัน</span>
                              <span className="text-white font-bold text-base sm:text-lg">
                                {item.currency}{item.currentPrice.toFixed(2)}
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="text-xs text-slate-400 block mb-0.5">กรอบเป้าหมาย</span>
                              <span className="text-indigo-300 font-bold text-base sm:text-lg">
                                {item.targetZone}
                              </span>
                            </div>
                          </div>

                          {/* 1. Tranche Plan & Budget (Mandatory Dimension 1) */}
                          <div className="bg-white/[0.03] p-3.5 rounded-xl border border-white/[0.06] space-y-1.5">
                            <span className="font-bold text-indigo-300 text-xs sm:text-sm flex items-center gap-1.5">
                              <Layers className="w-3.5 h-3.5" />
                              แผนแบ่งไม้ & วงเงิน:
                            </span>
                            <p className="text-xs sm:text-sm leading-relaxed text-slate-100 font-normal">
                              {item.tranchePlan}
                            </p>
                          </div>

                          {/* 2. Stop Loss Point (Mandatory Dimension 2) */}
                          {item.stopLossPoint && (
                            <div className="flex items-center justify-between text-xs sm:text-sm px-3.5 py-2.5 rounded-xl bg-rose-500/15 border border-rose-500/25 text-rose-300 font-mono">
                              <span className="font-medium">จุดหนีไฟ (Stop Loss):</span>
                              <strong className="text-rose-100 text-sm sm:text-base font-bold">{item.stopLossPoint}</strong>
                            </div>
                          )}

                          {/* Rationale */}
                          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-normal">
                              {item.rationale}
                            </p>
                          </div>

                          {/* 3. Tax Sensitivity Alert (Mandatory Dimension 4) */}
                          {item.taxImpactNote && (
                            <div className="text-xs sm:text-[13px] text-amber-200 flex items-start gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 leading-relaxed">
                              <Info className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                              <span>{item.taxImpactNote}</span>
                            </div>
                          )}
                        </div>

                        {/* Open Stock Detail Modal Button */}
                        <button
                          type="button"
                          onClick={() => setSelectedStock({ symbol: item.ticker, market: item.market })}
                          className="w-full py-2.5 px-4 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-xs sm:text-sm font-bold text-white flex items-center justify-center gap-2 transition-all cursor-pointer mt-2"
                        >
                          <span>ดูกราฟ & สถิติเชิงลึก</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* ── BOTTOM SECTION: CASH STRATEGY & TRACK RECORD ── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Cash Strategy (6 Cols) */}
              <div className="lg:col-span-6 p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-[#121622] to-[#151A29] border border-white/[0.08] shadow-md space-y-4">
                <div className="flex items-center gap-2.5">
                  <Wallet className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-base font-bold text-white uppercase tracking-wider">
                    4. กลยุทธ์บริหารเงินสด (Cash Deployment Strategy)
                  </h3>
                </div>

                <div className="p-4 rounded-xl bg-[#0A0D14] border border-white/[0.04] flex items-center justify-between">
                  <div>
                    <span className="text-slate-300 block text-xs sm:text-sm mb-0.5">สัดส่วนเงินสดที่ควรเตรียมในห้วงนี้:</span>
                    <span className="text-2xl sm:text-3xl font-bold font-mono text-emerald-400">
                      {payload.cashStrategy.recommendedCashPercent}%
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-300 block text-xs sm:text-sm mb-0.5">สัดส่วนเงินสดจริงในพอร์ต:</span>
                    <span className="text-2xl sm:text-3xl font-bold font-mono text-white">
                      {payload.cashStrategy.currentCashPercent}%
                    </span>
                  </div>
                </div>

                <p className="text-sm sm:text-base text-slate-100 leading-relaxed font-normal">
                  {payload.cashStrategy.guidanceText}
                </p>
              </div>

              {/* Track Record Review (6 Cols - Mandatory Dimension 5) */}
              <div className="lg:col-span-6 p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-[#121622] to-[#151A29] border border-white/[0.08] shadow-md space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <History className="w-5 h-5 text-indigo-400" />
                    <h3 className="text-base font-bold text-white uppercase tracking-wider">
                      5. การตรวจการบ้านคำแนะนำรอบก่อน (Track Record)
                    </h3>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">Accountability</span>
                </div>

                {payload.trackRecordReview.length === 0 ? (
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04] text-xs sm:text-sm text-slate-400 text-center">
                    เป็นการวิเคราะห์รอบแรก ระบบจะเริ่มบันทึกและตรวจการบ้านในรอบถัดไป
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {payload.trackRecordReview.map((rec, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl bg-[#0A0D14] border border-white/[0.04] space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-indigo-300 text-xs sm:text-sm">{rec.period}</span>
                          <span
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                              rec.accuracyStatus === 'ACCURATE'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-slate-700 text-slate-300'
                            }`}
                          >
                            {rec.accuracyStatus === 'ACCURATE' ? '✓ ตามคาด' : '• ติดตามต่อ'}
                          </span>
                        </div>
                        <p className="text-slate-200 text-xs sm:text-sm leading-relaxed">
                          <strong className="text-white">คำแนะนำเดิม:</strong> {rec.recommendationSummary}
                        </p>
                        <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
                          <strong className="text-white">ผลลัพธ์ตลาดจริง:</strong> {rec.outcomeAssessment}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── COPILOT CHAT BOX: ASK SPECIFIC QUESTIONS ── */}
            <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-[#121622] via-[#141A28] to-[#121622] border border-indigo-500/25 shadow-lg space-y-4">
              <div className="flex items-center gap-2.5">
                <MessageSquare className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white tracking-wide">
                  ถาม AI เจาะลึกเฉพาะกิจ (Tactical Copilot)
                </h3>
              </div>

              {/* 1-Click Quick Question Pills */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-slate-400 text-xs sm:text-sm font-medium">ตัวอย่างคำถามคลิกเดียว:</span>
                {[
                  'ถ้าตลาดร่วงอีก 5% พอร์ตฉันจะกระทบแค่ไหน?',
                  'เงินสดที่มีอยู่ตอนนี้ ควรแบ่งเข้าตัวไหนเป็นไม้แรก?',
                  'ตัวไหนในพอร์ตควรขายทำกำไรก่อนสิ้นปีเพื่อบริหารภาษี?',
                ].map((q, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setChatQuestion(q)
                      handleAskQuestion(q)
                    }}
                    className="px-3 py-1.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/25 text-indigo-300 text-xs sm:text-sm font-medium transition-all cursor-pointer"
                  >
                    {q}
                  </button>
                ))}
              </div>

              {/* Input Area */}
              <div className="flex items-center gap-2.5">
                <input
                  type="text"
                  value={chatQuestion}
                  onChange={(e) => setChatQuestion(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAskQuestion()}
                  placeholder="พิมพ์คำถามเจาะลึกเกี่ยวกับกลยุทธ์พอร์ตของคุณในห้วงนี้..."
                  className="flex-1 px-4 py-3 rounded-xl bg-black/50 border border-white/[0.1] text-sm sm:text-base text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => handleAskQuestion()}
                  disabled={isChatLoading || !chatQuestion.trim()}
                  className="px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold text-sm flex items-center gap-2 transition-all cursor-pointer shrink-0 shadow-md hover:shadow-indigo-500/25"
                >
                  {isChatLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>ถาม AI</span>
                    </>
                  )}
                </button>
              </div>

              {/* Chat Answer Box */}
              {chatAnswer && (
                <div className="p-5 rounded-2xl bg-black/60 border border-indigo-500/30 text-sm sm:text-base text-slate-100 leading-relaxed font-sans space-y-2.5 animate-fadeIn">
                  <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm">
                    <Sparkles className="w-4 h-4" />
                    <span>คำแนะนำเฉพาะตัวจาก Tactical Copilot:</span>
                  </div>
                  <div className="whitespace-pre-line text-slate-100 font-normal leading-relaxed">
                    {chatAnswer}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Stock Detail Modal for drilling down into charts & fundamentals */}
      {selectedStock && (
        <StockDetailModal
          isOpen={true}
          onClose={() => setSelectedStock(null)}
          symbol={selectedStock.symbol}
          market={selectedStock.market}
        />
      )}
    </AppShell>
  )
}
