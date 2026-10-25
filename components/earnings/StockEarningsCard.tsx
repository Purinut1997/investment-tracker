'use client'

import React from 'react'
import {
  Calendar,
  Clock,
  TrendingUp,
  TrendingDown,
  BarChart3,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sparkles,
  ChevronRight,
  Wallet,
} from 'lucide-react'
import { AnalyzedEarningsData } from '@/lib/earnings/earnings-analyzer'

interface StockEarningsCardProps {
  data: AnalyzedEarningsData
  userHolding?: {
    quantity: number
    avgCost: number
    currentValue: number
    unrealizedPnLPercent: number
    currency?: string
  } | null
  baseCurrency?: string
  onClick: () => void
}

export function StockEarningsCard({
  data,
  userHolding,
  baseCurrency = 'THB',
  onClick,
}: StockEarningsCardProps) {
  const {
    ticker,
    companyName,
    market,
    currency,
    currentPrice,
    priceChangePercent,
    upcoming,
    stats,
  } = data

  const isThai = market === 'TH'
  const isUrgent = upcoming.daysRemaining >= 0 && upcoming.daysRemaining <= 7
  const isSoon = upcoming.daysRemaining > 7 && upcoming.daysRemaining <= 14
  const isToday = upcoming.daysRemaining === 0

  const priceColor =
    priceChangePercent && priceChangePercent > 0
      ? 'text-emerald-400'
      : priceChangePercent && priceChangePercent < 0
      ? 'text-rose-400'
      : 'text-slate-300'

  return (
    <div
      onClick={onClick}
      className="p-4 sm:p-5 rounded-2xl bg-[#12151C] hover:bg-[#151924] border border-white/[0.08] hover:border-indigo-500/40 transition-all cursor-pointer shadow-lg shadow-black/20 group select-none relative overflow-hidden"
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left Section: Date Box & Stock Info */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 flex-1 min-w-0">
          {/* 1. กล่องวันแจ้งผลประกอบการ & นับถอยหลัง (Earnings Date Box) */}
          <div className="w-full sm:w-48 shrink-0 bg-[#0E121B] border border-white/[0.08] group-hover:border-indigo-500/30 rounded-xl p-3 flex sm:flex-col justify-between transition-colors shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-100">
                <Calendar className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span>{upcoming.earningsDateThai || 'ยังไม่กำหนด'}</span>
              </div>
              <span className="text-[10px] text-slate-400">{upcoming.fiscalQuarterLabel}</span>
            </div>

            <div className="sm:mt-2 flex items-baseline justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>วันแจ้งงบ</span>
              </div>
              <span className="text-xs text-indigo-300 font-medium">
                {upcoming.isEstimated ? 'ประมาณการ' : 'คอนเฟิร์มแล้ว'}
              </span>
            </div>

            <div className="sm:mt-2 flex items-center">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold ${
                  isToday
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse'
                    : isUrgent
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : isSoon
                    ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-500/30'
                    : 'bg-slate-800 text-slate-300 border border-white/[0.08]'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isToday
                      ? 'bg-rose-400 animate-ping'
                      : isUrgent
                      ? 'bg-amber-400 animate-ping'
                      : isSoon
                      ? 'bg-indigo-400'
                      : 'bg-slate-400'
                  }`}
                />
                <span>{upcoming.countdownLabel}</span>
              </span>
            </div>
          </div>

          {/* 2. Stock Meta Information */}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base sm:text-lg font-black text-white group-hover:text-indigo-300 transition-colors tracking-tight">
                {ticker}
              </span>
              <span
                className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded border ${
                  isThai
                    ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                    : 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                }`}
              >
                {isThai ? '🇹🇭 SET' : '🇺🇸 US'}
              </span>

              {userHolding && (
                <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  <Wallet className="w-3 h-3" />
                  <span>ในพอร์ต: {userHolding.quantity} หุ้น</span>
                  {userHolding.unrealizedPnLPercent !== undefined && (
                    <span
                      className={`text-xs tabular-nums font-semibold ${
                        userHolding.unrealizedPnLPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      ({userHolding.unrealizedPnLPercent >= 0 ? '+' : ''}
                      {userHolding.unrealizedPnLPercent.toFixed(1)}%)
                    </span>
                  )}
                </span>
              )}
            </div>

            <p className="text-xs text-slate-400 truncate max-w-[280px] sm:max-w-[340px] mt-0.5">
              {companyName}
            </p>

            <div className="flex items-center gap-2 mt-1.5 text-xs">
              <span className="tabular-nums font-bold text-slate-100 text-sm">
                {currency === 'THB' ? '฿' : '$'}
                {currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              {priceChangePercent !== undefined && (
                <span className={`tabular-nums text-xs font-semibold flex items-center ${priceColor}`}>
                  {priceChangePercent >= 0 ? '+' : ''}
                  {priceChangePercent.toFixed(2)}%
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right Section: Consensus Expectations vs Last Year & Track Record */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-4 shrink-0 border-t lg:border-t-0 border-white/[0.06] pt-3 lg:pt-0">
          {/* A. Market Consensus EPS */}
          <div className="bg-[#0C0F15] border border-white/[0.05] rounded-xl p-2.5 flex flex-col justify-center">
            <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
              <span>ตลาดคาดหวัง EPS</span>
            </span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-sm font-bold tabular-nums text-white">
                {upcoming.consensusEps !== null ? `$${upcoming.consensusEps.toFixed(2)}` : '-'}
              </span>
            </div>
            {upcoming.epsExpectedYoyGrowthPercent != null && (
              <span
                className={`text-xs tabular-nums font-semibold mt-0.5 flex items-center gap-0.5 ${
                  upcoming.epsExpectedYoyGrowthPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {upcoming.epsExpectedYoyGrowthPercent >= 0 ? (
                  <TrendingUp className="w-3 h-3 shrink-0" />
                ) : (
                  <TrendingDown className="w-3 h-3 shrink-0" />
                )}
                <span>
                  {upcoming.epsExpectedYoyGrowthPercent >= 0 ? '+' : ''}
                  {upcoming.epsExpectedYoyGrowthPercent}% YoY
                </span>
              </span>
            )}
          </div>

          {/* B. Market Consensus Revenue */}
          <div className="bg-[#0C0F15] border border-white/[0.05] rounded-xl p-2.5 flex flex-col justify-center">
            <span className="text-xs text-slate-400 font-medium">ตลาดคาดหวังรายได้</span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-sm font-bold tabular-nums text-white">
                {upcoming.consensusRevenueFormatted || '-'}
              </span>
            </div>
            {upcoming.revenueExpectedYoyGrowthPercent != null && (
              <span
                className={`text-xs tabular-nums font-semibold mt-0.5 flex items-center gap-0.5 ${
                  upcoming.revenueExpectedYoyGrowthPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {upcoming.revenueExpectedYoyGrowthPercent >= 0 ? (
                  <TrendingUp className="w-3 h-3 shrink-0" />
                ) : (
                  <TrendingDown className="w-3 h-3 shrink-0" />
                )}
                <span>
                  {upcoming.revenueExpectedYoyGrowthPercent >= 0 ? '+' : ''}
                  {upcoming.revenueExpectedYoyGrowthPercent}% YoY
                </span>
              </span>
            )}
          </div>

          {/* C. Historical Beat Track Record */}
          <div className="col-span-2 sm:col-span-1 bg-[#0C0F15] border border-white/[0.05] rounded-xl p-2.5 flex sm:flex-col justify-between sm:justify-center items-center sm:items-start">
            <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
              <BarChart3 className="w-3 h-3 text-indigo-400" />
              <span>ชนะคาดการณ์ย้อนหลัง</span>
            </span>
            <div className="mt-0.5 sm:mt-1 flex items-center gap-1.5">
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded ${
                  stats.beatRatePercent >= 75
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : stats.beatRatePercent >= 50
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                }`}
              >
                {stats.beatRatePercent}% Beat
              </span>
              <span className="text-xs text-slate-400 tabular-nums hidden sm:inline">
                ({stats.beatsCount}/{stats.totalQuartersAnalyzed} รอบ)
              </span>
            </div>
            {stats.latestSurprisePercent !== null && (
              <span className="text-xs text-slate-400 tabular-nums mt-0.5 hidden sm:inline">
                รอบล่าสุด: {stats.latestSurprisePercent > 0 ? '+' : ''}
                {stats.latestSurprisePercent}%
              </span>
            )}
          </div>
        </div>

        {/* Far Right Arrow */}
        <div className="hidden lg:flex items-center pl-2 text-slate-600 group-hover:text-indigo-400 transition-colors">
          <ChevronRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>
    </div>
  )
}
