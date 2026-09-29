'use client'

import React from 'react'
import {
  Calendar,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Activity,
  Award,
  Sparkles,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  Clock,
  Briefcase,
  AlertCircle,
  Scissors,
} from 'lucide-react'
import { HistoricalStockStats } from '@/lib/market-data/historical-stats'

interface StockHistoricalStatsTabProps {
  symbol: string
  name: string
  currencySymbol: string
  currentPrice: number
  stats?: HistoricalStockStats | null
}

export function StockHistoricalStatsTab({
  symbol,
  name,
  currencySymbol,
  currentPrice,
  stats,
}: StockHistoricalStatsTabProps) {
  if (!stats) {
    return (
      <div className="py-16 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
        <Activity className="w-6 h-6 animate-pulse text-indigo-400" />
        <span>กำลังประมวลผลสถิติและประวัติปันผลย้อนหลัง...</span>
      </div>
    )
  }

  const { dividends, performance, splits, userDividends } = stats
  const hasDividends = dividends?.hasDividends

  const returnPeriods = [
    { label: '1 เดือน', val: performance?.return1M },
    { label: '3 เดือน', val: performance?.return3M },
    { label: '6 เดือน', val: performance?.return6M },
    { label: '1 ปี', val: performance?.return1Y },
    { label: '3 ปี', val: performance?.return3Y },
    { label: '5 ปี', val: performance?.return5Y },
  ]

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* ============================================================ */}
      {/* 1. TOP STATS OVERVIEW CARDS (4 GRIDS) */}
      {/* ============================================================ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* TTM Dividend */}
        <div className="p-3.5 rounded-2xl bg-[#141822] border border-white/[0.08] relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-[11px] mb-1">
            <span>ปันผลรอบ 1 ปี (TTM)</span>
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-base sm:text-lg font-bold text-emerald-400 font-mono">
            {hasDividends ? (
              <>
                {currencySymbol}
                {dividends.ttmDividends.toFixed(2)}
              </>
            ) : (
              '0.00'
            )}
          </div>
          <span className="text-[10px] text-slate-500 block mt-0.5">
            {hasDividends && dividends.ttmYield !== null
              ? `Yield แท้จริง ~${dividends.ttmYield}%`
              : 'ไม่มีเงินปันผล'}
          </span>
        </div>

        {/* Payout Frequency */}
        <div className="p-3.5 rounded-2xl bg-[#141822] border border-white/[0.08]">
          <div className="flex items-center justify-between text-slate-400 text-[11px] mb-1">
            <span>รอบความถี่การจ่าย</span>
            <Calendar className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="text-xs sm:text-sm font-bold text-white truncate mt-0.5">
            {dividends.frequencyLabel}
          </div>
          <span className="text-[10px] text-slate-500 block mt-0.5 truncate">
            {dividends.payoutMonths.length > 0
              ? `มักจ่าย: ${dividends.payoutMonths.slice(0, 3).join(', ')}`
              : 'ตามรอบบริษัท'}
          </span>
        </div>

        {/* Latest Payout */}
        <div className="p-3.5 rounded-2xl bg-[#141822] border border-white/[0.08]">
          <div className="flex items-center justify-between text-slate-400 text-[11px] mb-1">
            <span>ปันผลงวดล่าสุด</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-base sm:text-lg font-bold text-white font-mono">
            {dividends.latestPayout ? (
              <>
                {currencySymbol}
                {dividends.latestPayout.amount.toFixed(2)}
              </>
            ) : (
              '--'
            )}
          </div>
          <span className="text-[10px] text-slate-500 block mt-0.5 truncate">
            {dividends.latestPayout?.formattedDate
              ? `XD: ${dividends.latestPayout.formattedDate}`
              : 'ยังไม่มีประวัติ'}
          </span>
        </div>

        {/* Pullback from 52W High */}
        <div className="p-3.5 rounded-2xl bg-[#141822] border border-white/[0.08]">
          <div className="flex items-center justify-between text-slate-400 text-[11px] mb-1">
            <span>ย่อจากจุดสูงสุดปี</span>
            <Activity className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div
            className={`text-base sm:text-lg font-bold font-mono ${
              performance.pullbackFrom52wHigh !== null && performance.pullbackFrom52wHigh <= -15
                ? 'text-cyan-400'
                : performance.pullbackFrom52wHigh !== null && performance.pullbackFrom52wHigh <= -5
                ? 'text-amber-400'
                : 'text-emerald-400'
            }`}
          >
            {performance.pullbackFrom52wHigh !== null
              ? `${performance.pullbackFrom52wHigh.toFixed(1)}%`
              : '--'}
          </div>
          <span className="text-[10px] text-slate-500 block mt-0.5 truncate">
            {performance.fiftyTwoWeekHigh
              ? `High: ${currencySymbol}${performance.fiftyTwoWeekHigh}`
              : '52-Week Peak'}
          </span>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 2. USER PERSONAL DIVIDEND RECEIVED (IF OWNED IN PORTFOLIO) */}
      {/* ============================================================ */}
      {userDividends && userDividends.totalReceived > 0 && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/25 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Briefcase className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-white block">
                ปันผลที่คุณได้รับเข้าพอร์ตจาก {symbol}
              </span>
              <p className="text-[11px] text-emerald-300/80 mt-0.5">
                ได้รับแล้ว {userDividends.count} ครั้ง{' '}
                {userDividends.lastDate ? `• ล่าสุดเมื่อ ${userDividends.lastDate}` : ''}
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] text-slate-400">เงินปันผลสะสมสุทธิ</span>
            <p className="text-base sm:text-lg font-extrabold text-emerald-400 font-mono">
              +{currencySymbol}
              {userDividends.totalReceived.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 3. HISTORICAL RETURNS MATRIX (ผลตอบแทนย้อนหลังหลายช่วงเวลา) */}
      {/* ============================================================ */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#141822] border border-white/[0.08] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-indigo-400" />
            <h4 className="text-xs font-bold text-white">
              ผลตอบแทนราคาประวัติศาสตร์ (Trailing Return Matrix)
            </h4>
          </div>
          <span className="text-[10px] text-slate-400">คำนวณจากราคาปิดย้อนหลัง</span>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 pt-1">
          {returnPeriods.map((period) => {
            const isPos = (period.val ?? 0) >= 0
            const hasVal = period.val !== null && period.val !== undefined

            return (
              <div
                key={period.label}
                className="p-2.5 rounded-xl bg-[#0F1218] border border-white/[0.05] text-center"
              >
                <span className="text-[10px] text-slate-400 font-medium block">
                  {period.label}
                </span>
                <span
                  className={`text-xs sm:text-sm font-bold font-mono mt-0.5 inline-flex items-center justify-center gap-0.5 ${
                    !hasVal
                      ? 'text-slate-600'
                      : isPos
                      ? 'text-emerald-400'
                      : 'text-rose-400'
                  }`}
                >
                  {hasVal ? (
                    <>
                      {isPos ? '+' : ''}
                      {period.val?.toFixed(2)}%
                    </>
                  ) : (
                    'N/A'
                  )}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* ============================================================ */}
      {/* 4. ANNUAL DIVIDEND SUMMARY & YOY GROWTH */}
      {/* ============================================================ */}
      {hasDividends ? (
        <div className="p-4 sm:p-5 rounded-2xl bg-[#141822] border border-white/[0.08] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-400" />
              <h4 className="text-xs font-bold text-white">
                สรุปเงินปันผลรวมรายปี (Annual Payout & Dividend Growth)
              </h4>
            </div>
            <span className="text-[10px] text-slate-400">เปรียบเทียบการเติบโต YoY</span>
          </div>

          <div className="space-y-2 pt-1">
            {dividends.annualBreakdown.slice(0, 5).map((yrData) => {
              const currentYear = new Date().getFullYear()
              const isCurrentYear = yrData.year === currentYear
              const maxAnnual = Math.max(...dividends.annualBreakdown.map((x) => x.totalAmount)) || 1
              const barWidth = Math.min(100, Math.max(10, (yrData.totalAmount / maxAnnual) * 100))

              return (
                <div
                  key={yrData.year}
                  className="p-3 rounded-xl bg-[#0F1218] border border-white/[0.04] space-y-1.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-white text-xs">
                        {yrData.year} {isCurrentYear ? '(YTD)' : ''}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        ({yrData.count} ครั้ง)
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5">
                      {yrData.growthPercent !== null && (
                        <span
                          className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                            yrData.growthPercent >= 0
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                              : 'bg-rose-500/15 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {yrData.growthPercent >= 0 ? '+' : ''}
                          {yrData.growthPercent}%
                        </span>
                      )}
                      <span className="font-mono font-bold text-emerald-400 text-xs sm:text-sm">
                        {currencySymbol}
                        {yrData.totalAmount.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Visual Bar Indicator */}
                  <div className="h-1.5 w-full bg-slate-800/80 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 rounded-full transition-all duration-500"
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="p-5 rounded-2xl bg-[#141822] border border-white/[0.08] text-center space-y-2">
          <div className="w-10 h-10 rounded-2xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center mx-auto text-slate-400">
            <TrendingUp className="w-5 h-5 text-indigo-400" />
          </div>
          <h4 className="text-xs font-bold text-white">
            สินทรัพย์เน้นการเติบโต (Growth Asset / No Dividend)
          </h4>
          <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
            {symbol} ไม่มีประวัติการจ่ายเงินปันผล
            ผลตอบแทนหลักของสินทรัพย์นี้เกิดจากส่วนต่างของราคา (Capital Gain)
          </p>
        </div>
      )}

      {/* ============================================================ */}
      {/* 5. HISTORICAL PAYOUT EVENTS TABLE (รายการจ่ายเงินปันผลย้อนหลัง) */}
      {/* ============================================================ */}
      {hasDividends && dividends.history.length > 0 && (
        <div className="p-4 sm:p-5 rounded-2xl bg-[#141822] border border-white/[0.08] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-400" />
              <h4 className="text-xs font-bold text-white">
                บันทึกประวัติการจ่ายปันผลย้อนหลังรายครั้ง (Payout Log)
              </h4>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">
              ล่าสุด {dividends.history.length} รายการ
            </span>
          </div>

          <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
            {dividends.history.map((item, idx) => (
              <div
                key={`${item.date}-${idx}`}
                className="p-2.5 rounded-xl bg-[#0F1218] border border-white/[0.04] flex items-center justify-between text-xs hover:border-white/[0.08] transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 text-[10px] font-mono font-bold">
                    #{dividends.history.length - idx}
                  </div>
                  <div>
                    <span className="text-white font-medium block">
                      {item.formattedDate}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      วันขึ้นเครื่องหมาย (Ex-Date)
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="font-mono font-bold text-emerald-400 text-xs sm:text-sm">
                    +{currencySymbol}
                    {item.amount.toFixed(item.amount < 1 ? 4 : 2)}
                  </span>
                  <span className="text-[10px] text-slate-500 block">ต่อ 1 หุ้น</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 6. CORPORATE ACTIONS & STOCK SPLITS (IF ANY) */}
      {/* ============================================================ */}
      {splits && splits.length > 0 && (
        <div className="p-4 sm:p-5 rounded-2xl bg-[#141822] border border-purple-500/20 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Scissors className="w-4 h-4 text-purple-400" />
              <h4 className="text-xs font-bold text-white">
                ประวัติการแตกพาร์ / ปรับสัดส่วนหุ้น (Stock Splits)
              </h4>
            </div>
            <span className="text-[10px] text-purple-300 font-mono">
              {splits.length} ครั้งในอดีต
            </span>
          </div>

          <div className="space-y-1.5">
            {splits.map((split, i) => (
              <div
                key={`${split.date}-${i}`}
                className="p-2.5 rounded-xl bg-[#0F1218] border border-white/[0.04] flex items-center justify-between text-xs"
              >
                <div>
                  <span className="text-white font-medium block">
                    {split.formattedDate}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {split.description}
                  </span>
                </div>
                <div className="px-2.5 py-1 rounded-lg bg-purple-500/15 border border-purple-500/25 text-purple-300 font-mono font-bold text-xs">
                  สัดส่วน {split.ratio}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
