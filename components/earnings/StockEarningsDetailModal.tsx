'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  X,
  Calendar,
  Clock,
  TrendingUp,
  TrendingDown,
  BarChart3,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sparkles,
  Percent,
  Wallet,
  ShieldCheck,
  ArrowRight,
  Info,
  DollarSign,
  Layers,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Download,
  BookmarkCheck,
  ShieldAlert,
  Zap,
} from 'lucide-react'
import {
  AnalyzedEarningsData,
  UpcomingEarningsEvent,
} from '@/lib/earnings/earnings-analyzer'

function getGoogleCalendarUrl(
  ticker: string,
  companyName: string,
  upcoming: UpcomingEarningsEvent,
  holdingQuantity?: number
) {
  if (!upcoming.earningsDate) return '#'
  const title = `🔔 รายงานงบ ${ticker} (${upcoming.fiscalQuarterLabel}) - ${companyName}`
  const cleanDate = upcoming.earningsDate.replace(/-/g, '')
  const dates = `${cleanDate}/${cleanDate}`

  let details = `กำหนดการรายงานผลประกอบการ ${upcoming.fiscalQuarterLabel} ของ ${companyName} (${ticker})\n\n`
  details += `⏰ ช่วงเวลาประกาศ: ${upcoming.releaseTimingLabel} (${upcoming.releaseTimeThai})\n`
  if (upcoming.earningsCallTimeThai) {
    details += `📞 แถลงผลงาน: ${upcoming.earningsCallTimeThai}\n`
  }
  details += `📊 ตลาดคาดหวัง EPS: $${upcoming.consensusEps?.toFixed(2) || '-'}\n`
  details += `💰 ตลาดคาดหวังรายได้: ${upcoming.consensusRevenueFormatted || '-'}\n`
  if (holdingQuantity) {
    details += `💼 คุณถือหุ้นนี้อยู่: ${holdingQuantity} หุ้น\n`
  }
  details += `\nติดตามบทวิเคราะห์ฉบับเต็มได้ที่ Investment Pro Dashboard`

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
    title
  )}&dates=${dates}&details=${encodeURIComponent(details)}&location=${encodeURIComponent(
    upcoming.releaseTimingLabel
  )}`
}

function downloadIcsCalendar(
  ticker: string,
  companyName: string,
  upcoming: UpcomingEarningsEvent,
  holdingQuantity?: number
) {
  if (!upcoming.earningsDate) return
  const title = `🔔 รายงานงบ ${ticker} (${upcoming.fiscalQuarterLabel}) - ${companyName}`
  const dateStr = upcoming.earningsDate.replace(/-/g, '')

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Investment Pro//Earnings Calendar//TH',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `SUMMARY:${title}`,
    `DESCRIPTION:กำหนดรายงานผลประกอบการ ${upcoming.fiscalQuarterLabel} ของ ${companyName}\\nเวลา: ${upcoming.releaseTimingLabel} (${upcoming.releaseTimeThai})\\nคาดการณ์ EPS: $${upcoming.consensusEps || '-'}\\nรายได้คาดหวัง: ${upcoming.consensusRevenueFormatted || '-'}`,
    `DTSTART;VALUE=DATE:${dateStr}`,
    `DTEND;VALUE=DATE:${dateStr}`,
    `STATUS:CONFIRMED`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })
  const link = document.createElement('a')
  link.href = window.URL.createObjectURL(blob)
  link.setAttribute('download', `Earnings_${ticker}_${upcoming.fiscalQuarterLabel}.ics`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

interface StockEarningsDetailModalProps {
  data: AnalyzedEarningsData | null
  userHolding?: {
    quantity: number
    avgCost: number
    currentValue: number
    unrealizedPnLPercent: number
    currency?: string
  } | null
  baseCurrency?: string
  onClose: () => void
}

export function StockEarningsDetailModal({
  data,
  userHolding,
  baseCurrency = 'THB',
  onClose,
}: StockEarningsDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'actual_vs_estimate' | 'yoy_growth' | 'annual_trend'>('actual_vs_estimate')
  const [mounted, setMounted] = useState(false)
  const [expandedQuarter, setExpandedQuarter] = useState<string | null>(null)
  const [expandedYear, setExpandedYear] = useState<number | null>(null)
  const [tradePlan, setTradePlan] = useState<string>('')
  const [planSavedNotice, setPlanSavedNotice] = useState(false)

  useEffect(() => {
    setMounted(true)
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    if (data?.ticker) {
      const saved = localStorage.getItem(`investment_tracker_trade_plan_${data.ticker}`)
      if (saved) setTradePlan(saved)
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose, data?.ticker])

  const handleSaveTradePlan = (val: string) => {
    setTradePlan(val)
    if (data?.ticker) {
      localStorage.setItem(`investment_tracker_trade_plan_${data.ticker}`, val)
      setPlanSavedNotice(true)
      setTimeout(() => setPlanSavedNotice(false), 2000)
    }
  }

  const handleAppendPreset = (preset: string) => {
    const updated = tradePlan.trim() ? `${tradePlan}\n• ${preset}` : `• ${preset}`
    handleSaveTradePlan(updated)
  }

  if (!data || !mounted) return null

  const {
    ticker,
    companyName,
    market,
    currency,
    currentPrice,
    priceChangePercent,
    upcoming,
    historicalQuarters,
    yearlyFinancials,
    stats,
  } = data

  const isThai = market === 'TH'
  const isUrgent = upcoming.daysRemaining >= 0 && upcoming.daysRemaining <= 7

  // Find max EPS value for bar chart proportional scaling
  const maxEpsVal = Math.max(
    ...historicalQuarters.map((q) =>
      Math.max(Math.abs(q.actualEps || 0), Math.abs(q.estimateEps || 0))
    ),
    0.1
  )

  const modalContent = (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md overflow-hidden"
    >
      <div
        className="relative w-full max-w-4xl bg-[#0F131C] border border-white/[0.12] rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-6 border-b border-white/[0.08] flex items-start justify-between gap-4 bg-gradient-to-r from-indigo-950/30 via-slate-900/40 to-transparent">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center shrink-0 shadow-inner">
              <BarChart3 className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">{ticker}</h2>
                <span
                  className={`text-[11px] font-extrabold px-2 py-0.5 rounded border ${
                    isThai
                      ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                      : 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                  }`}
                >
                  {isThai ? '🇹🇭 SET' : '🇺🇸 US'}
                </span>
                <span className="tabular-nums text-xs font-bold text-slate-200">
                  {currency === 'THB' ? '฿' : '$'}
                  {currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                {priceChangePercent !== undefined && (
                  <span
                    className={`tabular-nums text-xs font-semibold ${
                      priceChangePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    ({priceChangePercent >= 0 ? '+' : ''}
                    {priceChangePercent.toFixed(2)}%)
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-400 truncate max-w-[360px] sm:max-w-md mt-0.5">
                {companyName} • ปฏิทินวันแจ้งงบ & วิเคราะห์ผลประกอบการ
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 scrollbar-thin">
          {/* 1. Hero Card: Upcoming Earnings Report */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-indigo-950/40 via-[#131722] to-[#0D1017] border border-indigo-500/30 shadow-lg relative overflow-hidden space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-300 bg-indigo-500/20 px-2.5 py-0.5 rounded-full border border-indigo-500/30">
                    รอบถัดไป • {upcoming.fiscalQuarterLabel}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">
                    {upcoming.isEstimated ? 'วันที่คาดการณ์' : 'คอนเฟิร์มวันทางการ'}
                  </span>
                  {upcoming.releaseTimingLabel && upcoming.releaseTiming !== 'TBD' && (
                    <span className="text-xs font-bold text-amber-300 bg-amber-500/15 px-2.5 py-0.5 rounded-full border border-amber-500/30 flex items-center gap-1">
                      <span>{upcoming.releaseTiming === 'AMC' ? '🌙' : '☀️'}</span>
                      <span>{upcoming.releaseTimingLabel}</span>
                    </span>
                  )}
                </div>

                <div className="mt-2 flex items-baseline gap-2.5 flex-wrap">
                  <Calendar className="w-5 h-5 text-indigo-400 shrink-0 self-center" />
                  <span className="text-lg sm:text-2xl font-black text-white">
                    {upcoming.earningsDateThai || 'ยังไม่กำหนดวันแน่ชัด'}
                  </span>
                  <span
                    className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                      isUrgent
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
                        : 'bg-indigo-500/20 text-indigo-200 border border-indigo-500/30'
                    }`}
                  >
                    {upcoming.countdownLabel}
                  </span>
                </div>

                {/* Release Timing Detail and Thai Local Time */}
                {upcoming.releaseTimeThai && (
                  <div className="mt-2 text-xs text-slate-300 flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-indigo-300 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      <span>เวลาไทย: {upcoming.releaseTimeThai}</span>
                    </span>
                    {upcoming.earningsCallTimeThai && (
                      <span className="text-slate-400 font-medium">
                        • {upcoming.earningsCallTimeThai}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Actions & Calendar Buttons */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <a
                  href={getGoogleCalendarUrl(ticker, companyName, upcoming, userHolding?.quantity)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/40 flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-indigo-300" />
                  <span>บันทึกลง Google Calendar</span>
                </a>

                <button
                  onClick={() => downloadIcsCalendar(ticker, companyName, upcoming, userHolding?.quantity)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white/[0.06] hover:bg-white/[0.1] text-slate-200 border border-white/[0.1] flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
                  title="ดาวน์โหลดไฟล์ .ics สำหรับ Apple Calendar / Outlook"
                >
                  <Download className="w-3.5 h-3.5 text-slate-300" />
                  <span>Apple .ICS</span>
                </button>
              </div>
            </div>

            {/* Release Timing Volatility Advice Notice */}
            {upcoming.releaseAdviceThai && (
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200/90 flex items-start gap-2">
                <Zap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>{upcoming.releaseAdviceThai}</span>
              </div>
            )}

            {/* Upcoming Expectations Grid */}
            <div className="pt-2 border-t border-white/[0.08] grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* EPS Expectation */}
              <div className="p-3 rounded-xl bg-[#0A0D14] border border-white/[0.06]">
                <span className="text-xs text-slate-400 font-semibold">ตลาดคาดหวัง EPS</span>
                <p className="text-base sm:text-lg font-bold tabular-nums text-white mt-0.5">
                  {upcoming.consensusEps !== null ? `$${upcoming.consensusEps.toFixed(2)}` : '-'}
                </p>
                {upcoming.epsRange?.low != null && upcoming.epsRange?.high != null && (
                  <p className="text-xs text-slate-400 tabular-nums mt-0.5">
                    กรอบ: ${upcoming.epsRange.low} - ${upcoming.epsRange.high}
                  </p>
                )}
              </div>

              {/* EPS YoY Comparison */}
              <div className="p-3 rounded-xl bg-[#0A0D14] border border-white/[0.06]">
                <span className="text-xs text-slate-400 font-semibold">EPS เทียบปีก่อน (YoY)</span>
                <p
                  className={`text-base sm:text-lg font-bold tabular-nums mt-0.5 flex items-center gap-1 ${
                    upcoming.epsExpectedYoyGrowthPercent != null && upcoming.epsExpectedYoyGrowthPercent >= 0
                      ? 'text-emerald-400'
                      : 'text-rose-400'
                  }`}
                >
                  {upcoming.epsExpectedYoyGrowthPercent != null ? (
                    <>
                      {upcoming.epsExpectedYoyGrowthPercent >= 0 ? (
                        <TrendingUp className="w-4 h-4" />
                      ) : (
                        <TrendingDown className="w-4 h-4" />
                      )}
                      <span>
                        {upcoming.epsExpectedYoyGrowthPercent >= 0 ? '+' : ''}
                        {upcoming.epsExpectedYoyGrowthPercent}%
                      </span>
                    </>
                  ) : (
                    <span className="text-slate-400 font-normal">-</span>
                  )}
                </p>
                {upcoming.yearAgoEps !== null && (
                  <p className="text-xs text-slate-400 tabular-nums mt-0.5">
                    ช่วงเดียวกันปีก่อน: ${upcoming.yearAgoEps}
                  </p>
                )}
              </div>

              {/* Revenue Expectation */}
              <div className="p-3 rounded-xl bg-[#0A0D14] border border-white/[0.06]">
                <span className="text-xs text-slate-400 font-semibold">ตลาดคาดหวังรายได้</span>
                <p className="text-base sm:text-lg font-bold tabular-nums text-white mt-0.5">
                  {upcoming.consensusRevenueFormatted || '-'}
                </p>
                {upcoming.revenueRange?.lowFormatted && upcoming.revenueRange?.highFormatted && (
                  <p className="text-xs text-slate-400 tabular-nums mt-0.5 truncate">
                    กรอบ: {upcoming.revenueRange.lowFormatted} - {upcoming.revenueRange.highFormatted}
                  </p>
                )}
              </div>

              {/* Revenue YoY Comparison */}
              <div className="p-3 rounded-xl bg-[#0A0D14] border border-white/[0.06]">
                <span className="text-xs text-slate-400 font-semibold">รายได้เทียบปีก่อน (YoY)</span>
                <p
                  className={`text-base sm:text-lg font-bold tabular-nums mt-0.5 flex items-center gap-1 ${
                    upcoming.revenueExpectedYoyGrowthPercent != null &&
                    upcoming.revenueExpectedYoyGrowthPercent >= 0
                      ? 'text-emerald-400'
                      : 'text-rose-400'
                  }`}
                >
                  {upcoming.revenueExpectedYoyGrowthPercent != null ? (
                    <>
                      {upcoming.revenueExpectedYoyGrowthPercent >= 0 ? (
                        <TrendingUp className="w-4 h-4" />
                      ) : (
                        <TrendingDown className="w-4 h-4" />
                      )}
                      <span>
                        {upcoming.revenueExpectedYoyGrowthPercent >= 0 ? '+' : ''}
                        {upcoming.revenueExpectedYoyGrowthPercent}%
                      </span>
                    </>
                  ) : (
                    <span className="text-slate-400 font-normal">-</span>
                  )}
                </p>
                {upcoming.yearAgoRevenueFormatted && (
                  <p className="text-xs text-slate-400 tabular-nums mt-0.5">
                    ช่วงเดียวกันปีก่อน: {upcoming.yearAgoRevenueFormatted}
                  </p>
                )}
              </div>
            </div>

            {/* Wall Street Intel: Analyst Estimate Revisions & Post-Earnings Move Statistics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {/* Box 1: Analyst Estimate Revisions */}
              <div className="p-3 rounded-xl bg-[#0A0D14] border border-white/[0.06] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <span>🎯</span>
                    <span>การปรับเป้าของนักวิเคราะห์ (Revisions)</span>
                  </span>
                  {upcoming.revisions && (
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                        upcoming.revisions.sentiment === 'bullish'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : upcoming.revisions.sentiment === 'bearish'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : 'bg-white/[0.06] text-slate-300 border border-white/[0.1]'
                      }`}
                    >
                      {upcoming.revisions.sentiment === 'bullish'
                        ? 'มุมมองเชิงบวก 🟢'
                        : upcoming.revisions.sentiment === 'bearish'
                        ? 'มุมมองระมัดระวัง 🔴'
                        : 'มุมมองทรงตัว ⚪'}
                    </span>
                  )}
                </div>

                {upcoming.revisions ? (
                  <>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                        <span className="text-[10px] text-slate-400 block">รอบ 30 วันที่ผ่านมา</span>
                        <span className="text-xs font-bold tabular-nums mt-0.5 block">
                          <strong className="text-emerald-400">+{upcoming.revisions.upLast30days}</strong> ปรับขึ้น /{' '}
                          <strong className="text-rose-400">-{upcoming.revisions.downLast30days}</strong> ปรับลง
                        </span>
                      </div>
                      <div className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                        <span className="text-[10px] text-slate-400 block">รอบ 7 วันล่าสุด</span>
                        <span className="text-xs font-bold tabular-nums mt-0.5 block">
                          <strong className="text-emerald-400">+{upcoming.revisions.upLast7days}</strong> ปรับขึ้น /{' '}
                          <strong className="text-rose-400">-{upcoming.revisions.downLast7days}</strong> ปรับลง
                        </span>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-tight">
                      {upcoming.revisions.summaryThai}
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-slate-400">
                    ไม่มีการเปลี่ยนแปลงเป้าหมายกำไรอย่างมีนัยสำคัญจากนักวิเคราะห์ในรอบ 30 วัน
                  </p>
                )}
              </div>

              {/* Box 2: Post-Earnings Historical Move Statistics */}
              <div className="p-3 rounded-xl bg-[#0A0D14] border border-white/[0.06] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <span>⚡</span>
                    <span>สถิติราคาหุ้นแกว่งหลังงบออก (Post-Earnings Move)</span>
                  </span>
                  <span className="text-xs font-bold tabular-nums text-indigo-300 bg-indigo-500/20 px-2 py-0.5 rounded border border-indigo-500/30">
                    เฉลี่ย ±{stats.avgPostEarningsMovePercent}%
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <span className="text-[10px] text-emerald-300 block">รอบที่ชนะคาด (Beat)</span>
                    <span className="text-xs font-bold tabular-nums text-emerald-400 mt-0.5 block">
                      ขึ้นเฉลี่ย {stats.avgBeatPriceMovePercent > 0 ? '+' : ''}
                      {stats.avgBeatPriceMovePercent}%
                    </span>
                  </div>

                  <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20">
                    <span className="text-[10px] text-rose-300 block">รอบที่แพ้คาด (Miss)</span>
                    <span className="text-xs font-bold tabular-nums text-rose-400 mt-0.5 block">
                      ร่วงเฉลี่ย {stats.avgMissPriceMovePercent}%
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 leading-tight">
                  {stats.postEarningsInsight}
                </p>
              </div>
            </div>

            {/* Portfolio Exposure & Dollar Risk Calculation */}
            {userHolding && userHolding.currentValue > 0 && (
              <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/10 via-[#141824] to-[#0E121B] border border-amber-500/30 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    <DollarSign className="w-4 h-4 text-amber-400" />
                    <span>คำนวณผลกระทบต่อพอร์ตเป็นตัวเงินจริง (Portfolio Exposure & Risk Impact)</span>
                  </span>
                  <span className="text-xs text-slate-300 tabular-nums">
                    พอร์ตของคุณถืออยู่: <strong>{userHolding.quantity} หุ้น</strong> (~${userHolding.currentValue.toLocaleString()} / ฿{(userHolding.currentValue * 35).toLocaleString()})
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-black/40 border border-white/[0.04]">
                    <span className="text-[11px] text-slate-400">แกว่งตัวเฉลี่ยในอดีต (±{stats.avgPostEarningsMovePercent}%)</span>
                    <p className="text-sm font-bold text-white tabular-nums mt-0.5">
                      ±${(userHolding.currentValue * (stats.avgPostEarningsMovePercent / 100)).toFixed(1)}
                      <span className="text-xs text-slate-400 font-normal ml-1">
                        (~±฿{((userHolding.currentValue * (stats.avgPostEarningsMovePercent / 100)) * 35).toLocaleString(undefined, { maximumFractionDigits: 0 })})
                      </span>
                    </p>
                  </div>

                  <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <span className="text-[11px] text-emerald-300">กรณีผลงานชนะคาด (+{stats.avgBeatPriceMovePercent}%)</span>
                    <p className="text-sm font-bold text-emerald-400 tabular-nums mt-0.5">
                      +${(userHolding.currentValue * (stats.avgBeatPriceMovePercent / 100)).toFixed(1)}
                      <span className="text-xs text-emerald-200/70 font-normal ml-1">
                        (+฿{((userHolding.currentValue * (stats.avgBeatPriceMovePercent / 100)) * 35).toLocaleString(undefined, { maximumFractionDigits: 0 })})
                      </span>
                    </p>
                  </div>

                  <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20">
                    <span className="text-[11px] text-rose-300">กรณีผลงานต่ำกว่าคาด ({stats.avgMissPriceMovePercent}%)</span>
                    <p className="text-sm font-bold text-rose-400 tabular-nums mt-0.5">
                      -${(userHolding.currentValue * (Math.abs(stats.avgMissPriceMovePercent) / 100)).toFixed(1)}
                      <span className="text-xs text-rose-200/70 font-normal ml-1">
                        (-฿{((userHolding.currentValue * (Math.abs(stats.avgMissPriceMovePercent) / 100)) * 35).toLocaleString(undefined, { maximumFractionDigits: 0 })})
                      </span>
                    </p>
                  </div>
                </div>

                <p className="text-[11px] text-slate-300">
                  💡 <strong>คำแนะนำการบริหารความเสี่ยง:</strong> หุ้นมักเคลื่อนไหวรวดเร็วในตลาดนอกเวลา (After-Hours / Pre-Market) หากมูลค่าที่อาจแกว่งตัวนี้มีผลกระทบต่อจิตวิทยาการลงทุน ควรพิจารณาตั้งจุดตัดขาดทุน (Stop-Loss) หรือแบ่งขายล็อกกำไรบางส่วนก่อนวันงบออก
                </p>
              </div>
            )}

            {/* Personal Trade Plan Note & Strategy */}
            <div className="p-3.5 rounded-xl bg-[#0B0E14] border border-white/[0.08] space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <BookmarkCheck className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-bold text-indigo-200">
                    บันทึกแผนเทรด & กลยุทธ์ส่วนตัว (My Plan & Strategy Note)
                  </span>
                </div>
                {planSavedNotice && (
                  <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> บันทึกแล้วอัตโนมัติ
                  </span>
                )}
              </div>

              <textarea
                value={tradePlan}
                onChange={(e) => handleSaveTradePlan(e.target.value)}
                placeholder="พิมพ์บันทึกแผนเทรดของคุณ เช่น 'ตั้งใจถือยาว ถ้ารายได้โตเกิน 20% จะไม่ขาย แต่ถ้า Cloud หลุดเป้าจะรอดูท่าทีก่อน'..."
                rows={2}
                className="w-full text-xs text-slate-100 bg-[#121622] border border-white/[0.08] rounded-xl p-3 focus:outline-none focus:border-indigo-500 placeholder:text-slate-500 resize-none"
              />

              <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                <span className="text-slate-400 font-medium">เพิ่มแผนด่วน:</span>
                {[
                  'ถือข้ามงบ (Hold through earnings)',
                  'ลดพอร์ต 50% ล็อกกำไรก่อนงบ',
                  'ตั้งจุด Stop-loss รับมือ Gap ราคา',
                  'เตรียมเงินสดรอซื้อเพิ่มถ้างบย่อ',
                ].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handleAppendPreset(preset)}
                    className="px-2 py-0.5 rounded-md bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-slate-300 hover:text-white transition-colors cursor-pointer"
                  >
                    + {preset}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 2. Interactive Navigation Tabs */}
          <div className="flex items-center gap-2 border-b border-white/[0.08] pb-1 overflow-x-auto scrollbar-none">
            <button
              onClick={() => setActiveTab('actual_vs_estimate')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer shrink-0 border ${
                activeTab === 'actual_vs_estimate'
                  ? 'bg-indigo-600/20 text-indigo-200 border-indigo-500/50 shadow-md shadow-indigo-500/10'
                  : 'bg-transparent text-slate-400 hover:text-white border-transparent'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>ผลงานจริง เทียบ ตลาดคาดหวัง (Beat/Miss)</span>
            </button>

            <button
              onClick={() => setActiveTab('yoy_growth')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer shrink-0 border ${
                activeTab === 'yoy_growth'
                  ? 'bg-indigo-600/20 text-indigo-200 border-indigo-500/50 shadow-md shadow-indigo-500/10'
                  : 'bg-transparent text-slate-400 hover:text-white border-transparent'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              <span>เปรียบเทียบการเติบโตรายไตรมาส (QoQ / YoY)</span>
            </button>

            <button
              onClick={() => setActiveTab('annual_trend')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer shrink-0 border ${
                activeTab === 'annual_trend'
                  ? 'bg-indigo-600/20 text-indigo-200 border-indigo-500/50 shadow-md shadow-indigo-500/10'
                  : 'bg-transparent text-slate-400 hover:text-white border-transparent'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>แนวโน้มรายปี (5 ปี งบจริง & คาดการณ์)</span>
            </button>
          </div>

          {/* Tab Content 1: Actual vs Consensus */}
          {activeTab === 'actual_vs_estimate' && (
            <div className="space-y-4">
              {/* Summary Stats Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-[#121620] border border-white/[0.06]">
                  <span className="text-[10px] text-slate-400">อัตราการชนะคาด (Beat Rate)</span>
                  <p className="text-lg font-black text-emerald-400 mt-0.5">
                    {stats.beatRatePercent}%
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {stats.beatsCount} จาก {stats.totalQuartersAnalyzed} ไตรมาส
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-[#121620] border border-white/[0.06]">
                  <span className="text-[10px] text-slate-400">เซอร์ไพรส์เฉลี่ย (Avg Surprise)</span>
                  <p
                    className={`text-lg font-black mt-0.5 ${
                      stats.averageSurprisePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {stats.averageSurprisePercent > 0 ? '+' : ''}
                    {stats.averageSurprisePercent}%
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">เทียบผลประเมินเฉลี่ย</p>
                </div>

                <div className="p-3 rounded-xl bg-[#121620] border border-white/[0.06]">
                  <span className="text-[10px] text-slate-400">รอบล่าสุด (Latest Quarter)</span>
                  <p
                    className={`text-lg font-black mt-0.5 ${
                      stats.latestSurprisePercent && stats.latestSurprisePercent >= 0
                        ? 'text-emerald-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {stats.latestSurprisePercent !== null
                      ? `${stats.latestSurprisePercent > 0 ? '+' : ''}${stats.latestSurprisePercent}%`
                      : '-'}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5 font-bold">
                    {stats.latestBeatStatus === 'BEAT'
                      ? '🟢 ชนะคาด (Beat)'
                      : stats.latestBeatStatus === 'MISS'
                      ? '🔴 ต่ำกว่าคาด (Miss)'
                      : '🟡 ตามคาด (In-Line)'}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-[#121620] border border-white/[0.06]">
                  <span className="text-[10px] text-slate-400">ชนะคาดติดต่อกัน (Streak)</span>
                  <p className="text-lg font-black text-indigo-400 mt-0.5">
                    {stats.consecutiveBeats} ไตรมาส
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">โมเมนตัมปัจจุบัน</p>
                </div>
              </div>

              {/* Visual Comparison Chart / Cards */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                  <span className="font-bold">รายละเอียดแต่ละไตรมาสย้อนหลัง</span>
                  <div className="flex items-center gap-3 text-[11px]">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                      <span>ทำได้จริง (Actual)</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 inline-block" />
                      <span>ตลาดคาดหวัง (Estimate)</span>
                    </span>
                  </div>
                </div>

                {historicalQuarters.map((q, idx) => {
                  const isBeat = q.beatStatus === 'BEAT'
                  const isMiss = q.beatStatus === 'MISS'
                  const actualPct = maxEpsVal > 0 ? Math.min(100, (Math.abs(q.actualEps || 0) / maxEpsVal) * 100) : 50
                  const estPct = maxEpsVal > 0 ? Math.min(100, (Math.abs(q.estimateEps || 0) / maxEpsVal) * 100) : 50

                  return (
                    <div
                      key={q.quarter}
                      className="p-3.5 sm:p-4 rounded-xl bg-[#11151E] border border-white/[0.06] hover:border-white/[0.12] transition-colors"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2.5">
                          <span className="text-sm font-bold tracking-tight text-white bg-white/[0.06] px-2.5 py-1 rounded-md">
                            {q.quarter}
                          </span>
                          <span className="text-xs text-slate-400">
                            ประกาศวันที่ {q.reportedDateThai || q.reportedDate}
                          </span>
                        </div>

                        {/* Status Badge */}
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs font-bold px-2.5 py-0.5 rounded-md flex items-center gap-1 ${
                              isBeat
                                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                : isMiss
                                ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                                : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                            }`}
                          >
                            {isBeat ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            ) : isMiss ? (
                              <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                            ) : (
                              <Info className="w-3.5 h-3.5 text-amber-400" />
                            )}
                            <span>
                              {isBeat
                                ? `ชนะคาด +${q.surprisePercent}%`
                                : isMiss
                                ? `ต่ำกว่าคาด ${q.surprisePercent}%`
                                : 'ตรงตามคาด'}
                            </span>
                          </span>

                          {q.epsDifference !== null && (
                            <span className="text-xs tabular-nums text-slate-400">
                              (ส่วนต่าง: {q.epsDifference > 0 ? '+' : ''}
                              {q.epsDifference})
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Visual Bar Comparison */}
                      <div className="mt-3 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400 w-20 shrink-0 font-medium">
                            ทำได้จริง:
                          </span>
                          <div className="flex-1 bg-white/[0.04] rounded-full h-2.5 overflow-hidden">
                            <div
                              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                              style={{ width: `${Math.max(5, actualPct)}%` }}
                            />
                          </div>
                          <span className="text-xs tabular-nums font-bold text-emerald-300 w-16 text-right">
                            {q.actualEps !== null ? `$${q.actualEps.toFixed(2)}` : '-'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400 w-20 shrink-0 font-medium">
                            ตลาดคาด:
                          </span>
                          <div className="flex-1 bg-white/[0.04] rounded-full h-2.5 overflow-hidden">
                            <div
                              className="bg-indigo-400 h-full rounded-full transition-all duration-500"
                              style={{ width: `${Math.max(5, estPct)}%` }}
                            />
                          </div>
                          <span className="text-xs tabular-nums font-bold text-indigo-300 w-16 text-right">
                            {q.estimateEps !== null ? `$${q.estimateEps.toFixed(2)}` : '-'}
                          </span>
                        </div>
                      </div>

                      {/* Financial Detail footer (Revenue & Net Income) */}
                      {(q.revenueFormatted || q.netIncomeFormatted) && (
                        <div className="mt-2.5 pt-2 border-t border-white/[0.04] flex items-center justify-between text-xs text-slate-300 tabular-nums">
                          {q.revenueFormatted && (
                            <span>รายได้: <strong className="text-slate-100">{q.revenueFormatted}</strong></span>
                          )}
                          {q.netIncomeFormatted && (
                            <span>กำไรสุทธิ: <strong className="text-slate-100">{q.netIncomeFormatted}</strong></span>
                          )}
                          {q.profitMarginPercent !== null && (
                            <span>Margin: <strong className="text-slate-100">{q.profitMarginPercent.toFixed(1)}%</strong></span>
                          )}
                        </div>
                      )}

                      {/* Interactive Drill-down Key Drivers Toggle */}
                      <div className="mt-3 pt-2.5 border-t border-white/[0.06]">
                        <button
                          type="button"
                          onClick={() => setExpandedQuarter(expandedQuarter === q.quarter ? null : q.quarter)}
                          className="flex items-center justify-between w-full text-xs font-bold text-indigo-300 hover:text-indigo-200 transition-colors py-1 cursor-pointer"
                        >
                          <span className="flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                            <span>
                              {expandedQuarter === q.quarter
                                ? 'ซ่อนบทวิเคราะห์เจาะลึก'
                                : 'ดูเบื้องหลังงบ & ปัจจัยกำไร-ขาดทุน (Key Drivers)'}
                            </span>
                          </span>
                          <span className="flex items-center gap-1 text-[11px] text-slate-400 font-normal">
                            <span>{expandedQuarter === q.quarter ? 'ย่อรายละเอียด' : 'กำไรมาจากอะไร?'}</span>
                            {expandedQuarter === q.quarter ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </span>
                        </button>

                        {/* Expanded Content Drawer */}
                        {expandedQuarter === q.quarter && q.drivers && (
                          <div className="mt-2.5 p-3.5 rounded-xl bg-[#090C12] border border-indigo-500/30 space-y-3 animate-in fade-in duration-150">
                            {/* 1. สรุปสั้นๆ ได้ใจความ */}
                            <div className="space-y-1">
                              <span className="text-[11px] font-bold text-indigo-300 flex items-center gap-1">
                                💡 สรุปสาเหตุผลประกอบการ ({q.quarter}):
                              </span>
                              <p className="text-xs text-slate-200 leading-relaxed bg-white/[0.02] p-2.5 rounded-lg border border-white/[0.04]">
                                {q.drivers.summary}
                              </p>
                            </div>

                            {/* 2. ปัจจัยหนุนกำไร */}
                            {q.drivers.primaryProfitDrivers?.length > 0 && (
                              <div className="space-y-1">
                                <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                                  🟢 ปัจจัยหลักที่หนุนกำไร (Key Profit Drivers):
                                </span>
                                <ul className="space-y-1 text-xs text-slate-300 pl-1">
                                  {q.drivers.primaryProfitDrivers.map((item, i) => (
                                    <li key={i} className="flex items-start gap-1.5">
                                      <span className="text-emerald-400 text-xs mt-0.5">•</span>
                                      <span>{item}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* 3. ปัจจัยกดดัน / ต้นทุนที่สูงขึ้น */}
                            {q.drivers.headwindsAndCosts?.length > 0 && (
                              <div className="space-y-1">
                                <span className="text-[11px] font-bold text-rose-400 flex items-center gap-1">
                                  🔴 ปัจจัยกดดันและต้นทุน (Headwinds & Costs):
                                </span>
                                <ul className="space-y-1 text-xs text-slate-300 pl-1">
                                  {q.drivers.headwindsAndCosts.map((item, i) => (
                                    <li key={i} className="flex items-start gap-1.5">
                                      <span className="text-rose-400 text-xs mt-0.5">•</span>
                                      <span>{item}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* 4. สถิติราคาหุ้นตอบรับวันรุ่งขึ้น */}
                            {q.drivers.postEarningsMoveNote && (
                              <div className="pt-2 border-t border-white/[0.04] text-[11px] flex items-center justify-between text-slate-300">
                                <span className="text-slate-400">⚡ การตอบรับของราคาหุ้นในตลาด:</span>
                                <span
                                  className={`font-bold tabular-nums ${
                                    q.postEarningsPriceMovePercent && q.postEarningsPriceMovePercent >= 0
                                      ? 'text-emerald-400'
                                      : 'text-rose-400'
                                  }`}
                                >
                                  {q.drivers.postEarningsMoveNote}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Tab Content 2: YoY & QoQ Growth Analysis */}
          {activeTab === 'yoy_growth' && (
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-200 flex items-start gap-2">
                <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <span>
                  การเปรียบเทียบการเติบโตของผลประกอบการ: แสดงการเติบโตแบบไตรมาสต่อไตรมาส (QoQ)
                  และอัตราการเติบโตที่ตลาดคาดหวังในรอบถัดไปเทียบกับช่วงเดียวกันของปีก่อนหน้า (YoY)
                </span>
              </div>

              {/* Next Quarter Expected YoY Card */}
              <div className="p-4 rounded-xl bg-[#11151E] border border-indigo-500/30">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                    เป้าหมายรอบถัดไป เทียบช่วงเดียวกันปีก่อนหน้า (Expected YoY)
                  </span>
                  <span className="text-xs tabular-nums font-semibold text-slate-400">{upcoming.fiscalQuarterLabel}</span>
                </div>

                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-[#0A0D14] border border-white/[0.06]">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">กำไรต่อหุ้น (EPS)</span>
                      <span
                        className={`text-sm font-bold tabular-nums flex items-center gap-1 ${
                          upcoming.epsExpectedYoyGrowthPercent != null &&
                          upcoming.epsExpectedYoyGrowthPercent >= 0
                            ? 'text-emerald-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {upcoming.epsExpectedYoyGrowthPercent != null ? (
                          <>
                            {upcoming.epsExpectedYoyGrowthPercent >= 0 ? '+' : ''}
                            {upcoming.epsExpectedYoyGrowthPercent}% YoY
                          </>
                        ) : (
                          '-'
                        )}
                      </span>
                    </div>
                    <div className="mt-2 text-xs tabular-nums text-slate-300 flex items-center justify-between">
                      <span>คาดหวัง: ${upcoming.consensusEps?.toFixed(2) || '-'}</span>
                      <span className="text-slate-400">ปีก่อน: ${upcoming.yearAgoEps?.toFixed(2) || '-'}</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-[#0A0D14] border border-white/[0.06]">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">รายได้รวม (Revenue)</span>
                      <span
                        className={`text-sm font-bold tabular-nums flex items-center gap-1 ${
                          upcoming.revenueExpectedYoyGrowthPercent != null &&
                          upcoming.revenueExpectedYoyGrowthPercent >= 0
                            ? 'text-emerald-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {upcoming.revenueExpectedYoyGrowthPercent != null ? (
                          <>
                            {upcoming.revenueExpectedYoyGrowthPercent >= 0 ? '+' : ''}
                            {upcoming.revenueExpectedYoyGrowthPercent}% YoY
                          </>
                        ) : (
                          '-'
                        )}
                      </span>
                    </div>
                    <div className="mt-2 text-xs tabular-nums text-slate-300 flex items-center justify-between">
                      <span>คาดหวัง: {upcoming.consensusRevenueFormatted || '-'}</span>
                      <span className="text-slate-400">ปีก่อน: {upcoming.yearAgoRevenueFormatted || '-'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Historical Sequential Growth Cards */}
              <div className="space-y-3">
                <span className="text-xs font-bold text-slate-300 px-1">
                  การเติบโตแบบไตรมาสต่อไตรมาส (Sequential QoQ Performance)
                </span>

                {historicalQuarters.map((q) => (
                  <div
                    key={q.quarter}
                    className="p-3.5 rounded-xl bg-[#11151E] border border-white/[0.06] flex flex-col gap-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="tabular-nums text-sm font-bold text-white">{q.quarter}</span>
                          {q.prevQuarter && (
                            <span className="text-xs text-slate-400 tabular-nums">
                              (เทียบกับ {q.prevQuarter})
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 mt-1 flex items-center gap-3 tabular-nums">
                          <span>EPS: ${q.actualEps?.toFixed(2) || '-'}</span>
                          <span>รายได้: {q.revenueFormatted || '-'}</span>
                          <span>กำไรสุทธิ: {q.netIncomeFormatted || '-'}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 self-end sm:self-center">
                        {q.epsQoqGrowthPercent != null && (
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 block">EPS QoQ</span>
                            <span
                              className={`tabular-nums text-xs font-bold ${
                                q.epsQoqGrowthPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {q.epsQoqGrowthPercent >= 0 ? '+' : ''}
                              {q.epsQoqGrowthPercent}%
                            </span>
                          </div>
                        )}

                        {q.revenueQoqGrowthPercent != null && (
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 block">รายได้ QoQ</span>
                            <span
                              className={`tabular-nums text-xs font-bold ${
                                q.revenueQoqGrowthPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {q.revenueQoqGrowthPercent >= 0 ? '+' : ''}
                              {q.revenueQoqGrowthPercent}%
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Drill-down Key Drivers Toggle in QoQ Tab */}
                    {q.drivers && (
                      <div className="pt-2 border-t border-white/[0.04]">
                        <button
                          type="button"
                          onClick={() => setExpandedQuarter(expandedQuarter === `qoq_${q.quarter}` ? null : `qoq_${q.quarter}`)}
                          className="flex items-center justify-between w-full text-xs font-bold text-indigo-300 hover:text-indigo-200 transition-colors py-0.5 cursor-pointer"
                        >
                          <span className="flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                            <span>
                              {expandedQuarter === `qoq_${q.quarter}`
                                ? 'ซ่อนเบื้องหลังงบ'
                                : 'กำไรมาจากอะไร? เจาะลึกปัจจัยผลงาน'}
                            </span>
                          </span>
                          {expandedQuarter === `qoq_${q.quarter}` ? (
                            <ChevronUp className="w-4 h-4 text-slate-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          )}
                        </button>

                        {expandedQuarter === `qoq_${q.quarter}` && (
                          <div className="mt-2 p-3 rounded-xl bg-[#090C12] border border-indigo-500/25 space-y-2 text-xs">
                            <p className="text-slate-200 leading-relaxed bg-white/[0.02] p-2 rounded-lg">
                              {q.drivers.summary}
                            </p>
                            {q.drivers.primaryProfitDrivers?.length > 0 && (
                              <div className="space-y-0.5">
                                <span className="font-bold text-emerald-400">🟢 ปัจจัยหนุนกำไร:</span>
                                <ul className="text-slate-300 pl-2 space-y-0.5">
                                  {q.drivers.primaryProfitDrivers.map((item, i) => (
                                    <li key={i}>• {item}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {q.drivers.headwindsAndCosts?.length > 0 && (
                              <div className="space-y-0.5">
                                <span className="font-bold text-rose-400">🔴 ปัจจัยกดดัน/ต้นทุน:</span>
                                <ul className="text-slate-300 pl-2 space-y-0.5">
                                  {q.drivers.headwindsAndCosts.map((item, i) => (
                                    <li key={i}>• {item}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab Content 3: Annual 5-Year Trend with Drill-down */}
          {activeTab === 'annual_trend' && (
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-200 flex items-start gap-2">
                <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <span>
                  แนวโน้มผลประกอบการ 5 ปีย้อนหลัง: คลิกที่แต่ละแถวปีเพื่อดูเบื้องหลังงบว่ากำไรมาจากอะไร หรือขาดทุน/ชะลอตัวเพราะอะไร
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-white/[0.08] text-slate-400 font-medium">
                      <th className="py-2.5 px-3">ปี (Year)</th>
                      <th className="py-2.5 px-3">รายได้รวม</th>
                      <th className="py-2.5 px-3">รายได้ YoY</th>
                      <th className="py-2.5 px-3">กำไรสุทธิ</th>
                      <th className="py-2.5 px-3">กำไร YoY</th>
                      <th className="py-2.5 px-3 text-right">Profit Margin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04] tabular-nums">
                    {yearlyFinancials.map((y) => {
                      const isExpanded = expandedYear === y.year
                      return (
                        <React.Fragment key={y.year}>
                          <tr
                            onClick={() => setExpandedYear(isExpanded ? null : y.year)}
                            className="hover:bg-white/[0.04] cursor-pointer transition-colors"
                          >
                            <td className="py-3 px-3 font-bold text-white text-sm">
                              <div className="flex items-center gap-1.5">
                                <span>{y.yearLabel || y.year}</span>
                                {y.isEstimate && (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-normal">
                                    คาดการณ์
                                  </span>
                                )}
                                <span className="text-[10px] text-indigo-400 opacity-70 ml-1">
                                  {isExpanded ? '▲ ย่อ' : '▼ ดูเจาะลึก'}
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-3 text-slate-200">{y.revenueFormatted}</td>
                            <td className="py-3 px-3">
                              {y.revenueYoyGrowthPercent != null ? (
                                <span
                                  className={`font-bold ${
                                    y.revenueYoyGrowthPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
                                  }`}
                                >
                                  {y.revenueYoyGrowthPercent >= 0 ? '+' : ''}
                                  {y.revenueYoyGrowthPercent}%
                                </span>
                              ) : (
                                <span className="text-slate-500">-</span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-slate-200">{y.netIncomeFormatted}</td>
                            <td className="py-3 px-3">
                              {y.netIncomeYoyGrowthPercent != null ? (
                                <span
                                  className={`font-bold ${
                                    y.netIncomeYoyGrowthPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
                                  }`}
                                >
                                  {y.netIncomeYoyGrowthPercent >= 0 ? '+' : ''}
                                  {y.netIncomeYoyGrowthPercent}%
                                </span>
                              ) : (
                                <span className="text-slate-500">-</span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-right text-indigo-300 font-bold">
                              {y.profitMarginPercent !== null ? `${y.profitMarginPercent}%` : '-'}
                            </td>
                          </tr>

                          {/* Expanded Row for Annual Business Drivers */}
                          {isExpanded && y.drivers && (
                            <tr className="bg-indigo-950/20 border-b border-indigo-500/20">
                              <td colSpan={6} className="p-3.5">
                                <div className="p-3.5 rounded-xl bg-[#090C12] border border-indigo-500/30 space-y-2.5">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                                      <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                                      <span>
                                        เจาะลึกผลการดำเนินงานปี {y.yearLabel || y.year} ({companyName})
                                      </span>
                                    </span>
                                    <span className="text-[10px] text-slate-400">
                                      คลิกที่แถวอีกครั้งเพื่อย่อ
                                    </span>
                                  </div>

                                  <p className="text-xs text-slate-200 leading-relaxed bg-white/[0.02] p-2.5 rounded-lg border border-white/[0.04]">
                                    {y.drivers.summary}
                                  </p>

                                  {y.drivers.primaryProfitDrivers?.length > 0 && (
                                    <div className="space-y-1">
                                      <span className="text-[11px] font-bold text-emerald-400">
                                        🟢 ปัจจัยขับเคลื่อนรายได้และกำไร:
                                      </span>
                                      <ul className="space-y-0.5 text-xs text-slate-300 pl-1">
                                        {y.drivers.primaryProfitDrivers.map((item, i) => (
                                          <li key={i} className="flex items-start gap-1.5">
                                            <span className="text-emerald-400">•</span>
                                            <span>{item}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}

                                  {y.drivers.headwindsAndCosts?.length > 0 && (
                                    <div className="space-y-1">
                                      <span className="text-[11px] font-bold text-rose-400">
                                        🔴 ปัจจัยกดดันหรือความท้าทาย:
                                      </span>
                                      <ul className="space-y-0.5 text-xs text-slate-300 pl-1">
                                        {y.drivers.headwindsAndCosts.map((item, i) => (
                                          <li key={i} className="flex items-start gap-1.5">
                                            <span className="text-rose-400">•</span>
                                            <span>{item}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 3. AI Insights Commentary */}
          <div className="p-4 rounded-2xl bg-indigo-950/20 border border-indigo-500/20 flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-bold text-indigo-200">บทวิเคราะห์ AI Earnings Sentinel</p>
              <p className="text-slate-300 leading-relaxed">{stats.aiTakeaway}</p>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-white/[0.08] flex items-center justify-end bg-[#0A0D14] shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-white/[0.06] hover:bg-white/[0.1] text-white transition-colors cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
