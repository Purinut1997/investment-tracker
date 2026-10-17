'use client'

import React from 'react'
import {
  Calendar,
  Clock,
  Coins,
  TrendingDown,
  TrendingUp,
  Percent,
  ChevronRight,
  ShieldCheck,
  Wallet,
  Sparkles,
} from 'lucide-react'
import { AnalyzedDividendData } from '@/lib/dividends/dividend-analyzer'

interface StockDividendCardProps {
  data: AnalyzedDividendData
  userHolding?: {
    quantity: number
    avgCost: number
    currentValue: number
    estimatedNextPayout: number
    estimatedNextPayoutBase: number
    annualEstimatedIncome: number
    annualEstimatedIncomeBase: number
    yieldOnCostPercent: number
  } | null
  baseCurrency?: string
  onClick: () => void
}

export function StockDividendCard({
  data,
  userHolding,
  baseCurrency = 'THB',
  onClick,
}: StockDividendCardProps) {
  const {
    ticker,
    companyName,
    market,
    currency,
    currentPrice,
    latestDividend,
    frequency,
    upcomingDividend,
    history5Years,
    xdDropAnalysis,
  } = data

  const isThai = market === 'TH'
  const isUrgent = upcomingDividend.daysRemaining <= 7
  const isSoon = upcomingDividend.daysRemaining <= 30

  return (
    <div
      onClick={onClick}
      className="p-4 sm:p-5 rounded-2xl bg-[#12151C] hover:bg-[#151924] border border-white/[0.08] hover:border-indigo-500/40 transition-all cursor-pointer shadow-lg shadow-black/20 group select-none relative overflow-hidden"
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left Section: XD Box & Stock Info */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 flex-1 min-w-0">
          {/* 1. ช่องวันขึ้น XD และนับถอยหลัง (XD Date & Countdown Box) */}
          <div className="w-full sm:w-44 shrink-0 bg-[#0E121B] border border-white/[0.08] group-hover:border-indigo-500/30 rounded-xl p-3 flex sm:flex-col justify-between transition-colors shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-100">
                <Calendar className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span>{upcomingDividend.exDate}</span>
              </div>
              <span className="text-[10px] text-slate-400">รอบถัดไป</span>
            </div>

            <div className="sm:mt-1.5 flex items-baseline justify-between">
              <div className="flex items-center gap-1.5 font-mono text-sm font-extrabold text-white">
                <Clock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>วันขึ้น XD</span>
              </div>
              <span className="text-[10px] text-indigo-300 font-mono">
                {upcomingDividend.isEstimated ? 'ประมาณการ' : 'ยืนยันแล้ว'}
              </span>
            </div>

            <div className="sm:mt-1.5 flex items-center">
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                  isUrgent
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    : isSoon
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'bg-indigo-500/20 text-indigo-200 border border-indigo-500/30'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isUrgent ? 'bg-rose-400 animate-ping' : isSoon ? 'bg-amber-400' : 'bg-indigo-400'
                  }`}
                />
                <span>{upcomingDividend.countdownLabel}</span>
              </span>
            </div>
          </div>

          {/* 2. Stock Header & Pricing */}
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xl drop-shadow-sm">{isThai ? '🇹🇭' : '🇺🇸'}</span>
              <h3 className="text-base font-bold text-white tracking-tight group-hover:text-indigo-300 transition-colors">
                {ticker}
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#181C25] text-slate-400 border border-white/[0.06]">
                {market}
              </span>
              {currentPrice > 0 && (
                <span className="text-xs font-mono font-bold text-slate-300">
                  {currentPrice.toFixed(2)} {currency}
                </span>
              )}
            </div>

            <p className="text-xs text-slate-400 truncate max-w-[280px]">
              {companyName}
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <span className="text-[10px] text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20 font-semibold">
                {frequency.label}
              </span>
              <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-mono">
                CAGR 5 ปี: {history5Years.cagr5YearPercent >= 0 ? `+${history5Years.cagr5YearPercent}%` : `${history5Years.cagr5YearPercent}%`}
              </span>
            </div>
          </div>
        </div>

        {/* Center / Right Section: Dividend Data & XD Drop Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full lg:w-[480px] shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-white/[0.06]">
          {/* ครั้งล่าสุด ปันผลเท่าไหร่ */}
          <div className="p-2.5 rounded-xl bg-[#0E121B] border border-white/[0.04] space-y-1">
            <div className="text-[10px] text-slate-400 flex items-center justify-between">
              <span>ปันผลครั้งล่าสุด</span>
              <Coins className="w-3 h-3 text-emerald-400" />
            </div>
            <div className="text-sm font-bold text-emerald-400 font-mono">
              {latestDividend ? `${latestDividend.amount.toFixed(2)} ${currency}` : '-'}
            </div>
            <div className="text-[10px] text-slate-400">
              Yield: <span className="text-emerald-300 font-mono font-bold">{latestDividend?.yieldPercent.toFixed(2) || '0'}%</span>
            </div>
          </div>

          {/* สถิติหุ้นร่วงวันขึ้น XD */}
          <div className="p-2.5 rounded-xl bg-[#0E121B] border border-white/[0.04] space-y-1">
            <div className="text-[10px] text-slate-400 flex items-center justify-between">
              <span>ราคาเฉลี่ยวัน XD</span>
              <TrendingDown className="w-3 h-3 text-amber-400" />
            </div>
            <div className="text-sm font-bold text-amber-300 font-mono">
              {xdDropAnalysis.avgDropPercent}%
            </div>
            <div className="text-[10px] text-slate-400">
              ฟื้นตัว: <span className="text-white font-mono font-bold">{xdDropAnalysis.avgRecoveryDays} วัน</span>
            </div>
          </div>

          {/* ในพอร์ตของคุณ (User Position) */}
          <div className="col-span-2 sm:col-span-1 p-2.5 rounded-xl bg-indigo-950/20 border border-indigo-500/20 space-y-1">
            <div className="text-[10px] text-indigo-300 flex items-center justify-between">
              <span>เงินปันผลในพอร์ต</span>
              <Wallet className="w-3 h-3 text-indigo-400" />
            </div>
            {userHolding ? (
              <>
                <div className="text-sm font-bold text-indigo-200 font-mono truncate">
                  ≈ {userHolding.estimatedNextPayout.toLocaleString()} {currency}
                </div>
                <div className="text-[10px] text-slate-400">
                  ถือ {userHolding.quantity.toLocaleString()} หุ้น
                </div>
              </>
            ) : (
              <>
                <div className="text-xs font-semibold text-slate-400">ไม่ได้ถือในพอร์ต</div>
                <div className="text-[10px] text-indigo-300 flex items-center gap-1">
                  <span>กดดูรายละเอียด</span>
                  <ChevronRight className="w-3 h-3" />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Expand Action Arrow */}
        <div className="hidden lg:flex w-8 h-8 rounded-xl bg-[#181C25] border border-white/[0.08] text-slate-400 items-center justify-center shrink-0 group-hover:text-white group-hover:bg-indigo-600 transition-colors">
          <ChevronRight className="w-4 h-4" />
        </div>
      </div>
    </div>
  )
}
