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
} from 'lucide-react'
import { AnalyzedEarningsData } from '@/lib/earnings/earnings-analyzer'

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

  useEffect(() => {
    setMounted(true)
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

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
                <span className="font-mono text-xs font-bold text-slate-300">
                  {currency === 'THB' ? '฿' : '$'}
                  {currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                {priceChangePercent !== undefined && (
                  <span
                    className={`font-mono text-xs font-semibold ${
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
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-indigo-950/40 via-[#131722] to-[#0D1017] border border-indigo-500/30 shadow-lg relative overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 bg-indigo-500/20 px-2.5 py-0.5 rounded-full border border-indigo-500/30">
                    รอบถัดไป • {upcoming.fiscalQuarterLabel}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    {upcoming.isEstimated ? 'วันที่คาดการณ์' : 'คอนเฟิร์มวันทางการ'}
                  </span>
                </div>

                <div className="mt-2 flex items-baseline gap-2.5">
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
              </div>

              {/* User Holding Badge if owned */}
              {userHolding && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3">
                  <Wallet className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div className="text-xs">
                    <p className="font-bold text-white">
                      คุณถืออยู่ {userHolding.quantity} หุ้น
                    </p>
                    <p className="text-slate-300 text-[11px] font-mono">
                      มูลค่า ~{currency === 'THB' ? '฿' : '$'}
                      {userHolding.currentValue.toLocaleString()}
                      {userHolding.unrealizedPnLPercent !== undefined && (
                        <span
                          className={`ml-1.5 font-bold ${
                            userHolding.unrealizedPnLPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          ({userHolding.unrealizedPnLPercent >= 0 ? '+' : ''}
                          {userHolding.unrealizedPnLPercent.toFixed(1)}%)
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Upcoming Expectations Grid */}
            <div className="mt-4 pt-4 border-t border-white/[0.08] grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* EPS Expectation */}
              <div className="p-3 rounded-xl bg-[#0A0D14] border border-white/[0.06]">
                <span className="text-[10px] text-slate-400 font-semibold">ตลาดคาดหวัง EPS</span>
                <p className="text-base sm:text-lg font-black font-mono text-white mt-0.5">
                  {upcoming.consensusEps !== null ? `$${upcoming.consensusEps.toFixed(2)}` : '-'}
                </p>
                {upcoming.epsRange?.low != null && upcoming.epsRange?.high != null && (
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                    กรอบ: ${upcoming.epsRange.low} - ${upcoming.epsRange.high}
                  </p>
                )}
              </div>

              {/* EPS YoY Comparison */}
              <div className="p-3 rounded-xl bg-[#0A0D14] border border-white/[0.06]">
                <span className="text-[10px] text-slate-400 font-semibold">EPS เทียบปีก่อน (YoY)</span>
                <p
                  className={`text-base sm:text-lg font-black font-mono mt-0.5 flex items-center gap-1 ${
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
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                    ช่วงเดียวกันปีก่อน: ${upcoming.yearAgoEps}
                  </p>
                )}
              </div>

              {/* Revenue Expectation */}
              <div className="p-3 rounded-xl bg-[#0A0D14] border border-white/[0.06]">
                <span className="text-[10px] text-slate-400 font-semibold">ตลาดคาดหวังรายได้</span>
                <p className="text-base sm:text-lg font-black font-mono text-white mt-0.5">
                  {upcoming.consensusRevenueFormatted || '-'}
                </p>
                {upcoming.revenueRange?.lowFormatted && upcoming.revenueRange?.highFormatted && (
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
                    กรอบ: {upcoming.revenueRange.lowFormatted} - {upcoming.revenueRange.highFormatted}
                  </p>
                )}
              </div>

              {/* Revenue YoY Comparison */}
              <div className="p-3 rounded-xl bg-[#0A0D14] border border-white/[0.06]">
                <span className="text-[10px] text-slate-400 font-semibold">รายได้เทียบปีก่อน (YoY)</span>
                <p
                  className={`text-base sm:text-lg font-black font-mono mt-0.5 flex items-center gap-1 ${
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
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                    ช่วงเดียวกันปีก่อน: {upcoming.yearAgoRevenueFormatted}
                  </p>
                )}
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
                          <span className="font-mono text-sm font-black text-white bg-white/[0.06] px-2.5 py-1 rounded-md">
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
                            <span className="text-[11px] font-mono text-slate-400">
                              (ส่วนต่าง: {q.epsDifference > 0 ? '+' : ''}
                              {q.epsDifference})
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Visual Bar Comparison */}
                      <div className="mt-3 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400 w-16 shrink-0 font-medium">
                            ทำได้จริง:
                          </span>
                          <div className="flex-1 bg-white/[0.04] rounded-full h-2.5 overflow-hidden">
                            <div
                              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                              style={{ width: `${Math.max(5, actualPct)}%` }}
                            />
                          </div>
                          <span className="text-xs font-mono font-bold text-emerald-300 w-16 text-right">
                            {q.actualEps !== null ? `$${q.actualEps.toFixed(2)}` : '-'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400 w-16 shrink-0 font-medium">
                            ตลาดคาด:
                          </span>
                          <div className="flex-1 bg-white/[0.04] rounded-full h-2.5 overflow-hidden">
                            <div
                              className="bg-indigo-400 h-full rounded-full transition-all duration-500"
                              style={{ width: `${Math.max(5, estPct)}%` }}
                            />
                          </div>
                          <span className="text-xs font-mono font-bold text-indigo-300 w-16 text-right">
                            {q.estimateEps !== null ? `$${q.estimateEps.toFixed(2)}` : '-'}
                          </span>
                        </div>
                      </div>

                      {/* Financial Detail footer (Revenue & Net Income) */}
                      {(q.revenueFormatted || q.netIncomeFormatted) && (
                        <div className="mt-2.5 pt-2 border-t border-white/[0.04] flex items-center justify-between text-[11px] text-slate-400 font-mono">
                          {q.revenueFormatted && (
                            <span>รายได้: <strong className="text-slate-200">{q.revenueFormatted}</strong></span>
                          )}
                          {q.netIncomeFormatted && (
                            <span>กำไรสุทธิ: <strong className="text-slate-200">{q.netIncomeFormatted}</strong></span>
                          )}
                          {q.profitMarginPercent !== null && (
                            <span>Margin: <strong className="text-slate-200">{q.profitMarginPercent.toFixed(1)}%</strong></span>
                          )}
                        </div>
                      )}
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
                  <span className="text-xs font-mono text-slate-400">{upcoming.fiscalQuarterLabel}</span>
                </div>

                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-[#0A0D14] border border-white/[0.06]">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">กำไรต่อหุ้น (EPS)</span>
                      <span
                        className={`text-sm font-bold font-mono flex items-center gap-1 ${
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
                    <div className="mt-2 text-xs font-mono text-slate-300 flex items-center justify-between">
                      <span>คาดหวัง: ${upcoming.consensusEps?.toFixed(2) || '-'}</span>
                      <span className="text-slate-400">ปีก่อน: ${upcoming.yearAgoEps?.toFixed(2) || '-'}</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-[#0A0D14] border border-white/[0.06]">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">รายได้รวม (Revenue)</span>
                      <span
                        className={`text-sm font-bold font-mono flex items-center gap-1 ${
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
                    <div className="mt-2 text-xs font-mono text-slate-300 flex items-center justify-between">
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
                    className="p-3.5 rounded-xl bg-[#11151E] border border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-black text-white">{q.quarter}</span>
                        {q.prevQuarter && (
                          <span className="text-xs text-slate-400 font-mono">
                            (เทียบกับ {q.prevQuarter})
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 mt-1 flex items-center gap-3">
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
                            className={`font-mono text-xs font-bold ${
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
                            className={`font-mono text-xs font-bold ${
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
                ))}
              </div>
            </div>
          )}

          {/* Tab Content 3: Annual 4-Year Trend */}
          {activeTab === 'annual_trend' && (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-white/[0.08] text-slate-400 font-mono">
                      <th className="py-2.5 px-3">ปี (Year)</th>
                      <th className="py-2.5 px-3">รายได้รวม</th>
                      <th className="py-2.5 px-3">รายได้ YoY</th>
                      <th className="py-2.5 px-3">กำไรสุทธิ</th>
                      <th className="py-2.5 px-3">กำไร YoY</th>
                      <th className="py-2.5 px-3 text-right">Profit Margin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04] font-mono">
                    {yearlyFinancials.map((y) => (
                      <tr key={y.year} className="hover:bg-white/[0.02]">
                        <td className="py-3 px-3 font-bold text-white text-sm">
                          <div className="flex items-center gap-1.5">
                            <span>{y.yearLabel || y.year}</span>
                            {y.isEstimate && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-normal">
                                คาดการณ์
                              </span>
                            )}
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
                    ))}
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
