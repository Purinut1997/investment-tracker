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
      <div className="py-20 text-center text-slate-400 text-sm flex flex-col items-center justify-center gap-3">
        <Activity className="w-7 h-7 animate-pulse text-indigo-400" />
        <span className="font-medium">กำลังประมวลผลสถิติและประวัติปันผลย้อนหลัง...</span>
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

  // Frequency title and badge fallback
  const freqTitle =
    dividends.frequencyTitle ||
    dividends.frequencyLabel.split('(')[0]?.trim() ||
    dividends.frequencyLabel

  const freqBadge =
    dividends.frequencyBadge ||
    dividends.frequencyLabel.match(/\((.*?)\)/)?.[1] ||
    ''

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* ============================================================ */}
      {/* 1. TOP STATS OVERVIEW CARDS (4 GRIDS) */}
      {/* ============================================================ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {/* TTM Dividend */}
        <div className="p-4 rounded-2xl bg-[#141822] border border-white/[0.08] flex flex-col justify-between min-h-[110px] hover:border-white/[0.15] transition-all">
          <div>
            <div className="flex items-center justify-between text-slate-300 text-xs font-semibold mb-1.5">
              <span>ปันผลรอบ 1 ปี (TTM)</span>
              <DollarSign className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-lg sm:text-xl font-bold text-emerald-400 font-mono tracking-tight">
              {hasDividends ? (
                <>
                  {currencySymbol}
                  {dividends.ttmDividends.toFixed(2)}
                </>
              ) : (
                '0.00'
              )}
            </div>
          </div>
          <div className="text-xs text-slate-400 mt-2 font-medium">
            {hasDividends && dividends.ttmYield !== null ? (
              <span>
                Yield แท้จริง <strong className="text-emerald-400 font-semibold">~{dividends.ttmYield}%</strong>
              </span>
            ) : (
              <span className="text-slate-500">ไม่มีเงินปันผล</span>
            )}
          </div>
        </div>

        {/* Payout Frequency (No Truncation / Clean Responsive Layout) */}
        <div className="p-4 rounded-2xl bg-[#141822] border border-white/[0.08] flex flex-col justify-between min-h-[110px] hover:border-white/[0.15] transition-all">
          <div>
            <div className="flex items-center justify-between text-slate-300 text-xs font-semibold mb-1.5">
              <span>รอบความถี่การจ่าย</span>
              <Calendar className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
              <span className="text-sm sm:text-base font-bold text-white leading-snug">
                {freqTitle}
              </span>
              {freqBadge && (
                <span className="px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 whitespace-nowrap">
                  {freqBadge}
                </span>
              )}
            </div>
          </div>
          <div className="text-xs text-slate-400 mt-2 font-medium leading-relaxed">
            {dividends.payoutMonths && dividends.payoutMonths.length > 0 ? (
              <span className="flex items-center gap-1 flex-wrap">
                <span className="text-slate-500">มักจ่าย:</span>
                <span className="text-slate-200 font-semibold">{dividends.payoutMonths.join(', ')}</span>
              </span>
            ) : hasDividends ? (
              'ตามรอบบริษัท'
            ) : (
              'ไม่มีนโยบายจ่ายปันผล'
            )}
          </div>
        </div>

        {/* Latest Payout */}
        <div className="p-4 rounded-2xl bg-[#141822] border border-white/[0.08] flex flex-col justify-between min-h-[110px] hover:border-white/[0.15] transition-all">
          <div>
            <div className="flex items-center justify-between text-slate-300 text-xs font-semibold mb-1.5">
              <span>ปันผลงวดล่าสุด</span>
              <CheckCircle2 className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-lg sm:text-xl font-bold text-white font-mono tracking-tight">
              {dividends.latestPayout ? (
                <>
                  {currencySymbol}
                  {dividends.latestPayout.amount.toFixed(2)}
                </>
              ) : (
                '--'
              )}
            </div>
          </div>
          <div className="text-xs text-slate-400 mt-2 font-medium leading-relaxed">
            {dividends.latestPayout?.formattedDate ? (
              <span>
                XD: <strong className="text-slate-200 font-semibold">{dividends.latestPayout.formattedDate}</strong>
              </span>
            ) : (
              <span className="text-slate-500">ยังไม่มีประวัติ</span>
            )}
          </div>
        </div>

        {/* Pullback from 52W High */}
        <div className="p-4 rounded-2xl bg-[#141822] border border-white/[0.08] flex flex-col justify-between min-h-[110px] hover:border-white/[0.15] transition-all">
          <div>
            <div className="flex items-center justify-between text-slate-300 text-xs font-semibold mb-1.5">
              <span>ย่อจากจุดสูงสุดปี</span>
              <Activity className="w-4 h-4 text-amber-400" />
            </div>
            <div
              className={`text-lg sm:text-xl font-bold font-mono tracking-tight ${
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
          </div>
          <div className="text-xs text-slate-400 mt-2 font-medium leading-relaxed">
            {performance.fiftyTwoWeekHigh ? (
              <span>
                จุดสูงสุด: <strong className="text-slate-200 font-semibold">{currencySymbol}{performance.fiftyTwoWeekHigh}</strong>
              </span>
            ) : (
              <span className="text-slate-500">52-Week Peak</span>
            )}
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 2. USER PERSONAL DIVIDEND RECEIVED (IF OWNED IN PORTFOLIO) */}
      {/* ============================================================ */}
      {userDividends && userDividends.totalReceived > 0 && (
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-emerald-500/5 to-transparent border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 shadow-sm">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/35 flex items-center justify-center text-emerald-400 shrink-0">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <span className="text-sm sm:text-base font-bold text-white block">
                ปันผลที่คุณได้รับเข้าพอร์ตจาก {symbol}
              </span>
              <p className="text-xs sm:text-sm text-emerald-300/90 mt-0.5 font-medium">
                ได้รับแล้ว {userDividends.count} ครั้ง{' '}
                {userDividends.lastDate ? `• ล่าสุดเมื่อ ${userDividends.lastDate}` : ''}
              </p>
            </div>
          </div>

          <div className="text-left sm:text-right pt-2.5 sm:pt-0 border-t sm:border-t-0 border-emerald-500/20">
            <span className="text-xs text-slate-400 font-medium block">เงินปันผลสะสมสุทธิ</span>
            <p className="text-xl sm:text-2xl font-black text-emerald-400 font-mono mt-0.5">
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
      <div className="p-4 sm:p-5 rounded-2xl bg-[#141822] border border-white/[0.08] space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-indigo-400" />
            <h4 className="text-sm sm:text-base font-bold text-white">
              ผลตอบแทนราคาประวัติศาสตร์ (Trailing Return Matrix)
            </h4>
          </div>
          <span className="text-xs text-slate-400 font-medium">คำนวณจากราคาปิดย้อนหลัง</span>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5 pt-1">
          {returnPeriods.map((period) => {
            const isPos = (period.val ?? 0) >= 0
            const hasVal = period.val !== null && period.val !== undefined

            return (
              <div
                key={period.label}
                className="p-3 rounded-xl bg-[#0F1218] border border-white/[0.06] text-center flex flex-col justify-between hover:border-white/[0.12] transition-colors"
              >
                <span className="text-xs text-slate-300 font-semibold block mb-1">
                  {period.label}
                </span>
                <span
                  className={`text-sm sm:text-base font-bold font-mono inline-flex items-center justify-center gap-0.5 ${
                    !hasVal
                      ? 'text-slate-500'
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
        <div className="p-4 sm:p-5 rounded-2xl bg-[#141822] border border-white/[0.08] space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-400" />
              <h4 className="text-sm sm:text-base font-bold text-white">
                สรุปเงินปันผลรวมรายปี (Annual Payout & Dividend Growth)
              </h4>
            </div>
            <span className="text-xs text-slate-400 font-medium">เปรียบเทียบการเติบโต YoY</span>
          </div>

          <div className="space-y-2.5 pt-1">
            {dividends.annualBreakdown.slice(0, 5).map((yrData) => {
              const currentYear = new Date().getFullYear()
              const isCurrentYear = yrData.year === currentYear
              const maxAnnual = Math.max(...dividends.annualBreakdown.map((x) => x.totalAmount)) || 1
              const barWidth = Math.min(100, Math.max(10, (yrData.totalAmount / maxAnnual) * 100))

              return (
                <div
                  key={yrData.year}
                  className="p-3.5 rounded-xl bg-[#0F1218] border border-white/[0.05] space-y-2 hover:border-white/[0.1] transition-all"
                >
                  <div className="flex items-center justify-between text-xs sm:text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-white text-sm sm:text-base">
                        {yrData.year} {isCurrentYear ? '(YTD)' : ''}
                      </span>
                      <span className="text-xs text-slate-400 font-medium">
                        ({yrData.count} ครั้ง)
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      {yrData.growthPercent !== null && (
                        <span
                          className={`text-xs font-mono font-bold px-2 py-0.5 rounded-md ${
                            yrData.growthPercent >= 0
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                              : 'bg-rose-500/15 text-rose-400 border border-rose-500/25'
                          }`}
                        >
                          {yrData.growthPercent >= 0 ? '+' : ''}
                          {yrData.growthPercent}%
                        </span>
                      )}
                      <span className="font-mono font-extrabold text-emerald-400 text-sm sm:text-base">
                        {currencySymbol}
                        {yrData.totalAmount.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Visual Bar Indicator */}
                  <div className="h-2 w-full bg-slate-800/80 rounded-full overflow-hidden">
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
        <div className="p-6 rounded-2xl bg-[#141822] border border-white/[0.08] text-center space-y-2.5">
          <div className="w-12 h-12 rounded-2xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center mx-auto text-slate-400">
            <TrendingUp className="w-6 h-6 text-indigo-400" />
          </div>
          <h4 className="text-sm font-bold text-white">
            สินทรัพย์เน้นการเติบโต (Growth Asset / No Dividend)
          </h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
            {symbol} ไม่มีประวัติการจ่ายเงินปันผล ผลตอบแทนหลักของสินทรัพย์นี้เกิดจากส่วนต่างของราคา (Capital Gain)
          </p>
        </div>
      )}

      {/* ============================================================ */}
      {/* 5. HISTORICAL PAYOUT EVENTS TABLE (รายการจ่ายเงินปันผลย้อนหลัง) */}
      {/* ============================================================ */}
      {hasDividends && dividends.history.length > 0 && (
        <div className="p-4 sm:p-5 rounded-2xl bg-[#141822] border border-white/[0.08] space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-400" />
              <h4 className="text-sm sm:text-base font-bold text-white">
                บันทึกประวัติการจ่ายเงินปันผลย้อนหลังรายครั้ง (Payout Log)
              </h4>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              ล่าสุด {dividends.history.length} รายการ
            </span>
          </div>

          <div className="max-h-64 overflow-y-auto space-y-2 pr-1.5 custom-scrollbar">
            {dividends.history.map((item, idx) => (
              <div
                key={`${item.date}-${idx}`}
                className="p-3 rounded-xl bg-[#0F1218] border border-white/[0.05] flex items-center justify-between hover:border-white/[0.12] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 text-xs font-mono font-bold">
                    #{dividends.history.length - idx}
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-white block">
                      {item.formattedDate}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">
                      วันขึ้นเครื่องหมาย (Ex-Date / XD)
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="font-mono font-extrabold text-emerald-400 text-sm sm:text-base">
                    +{currencySymbol}
                    {item.amount.toFixed(item.amount < 1 ? 4 : 2)}
                  </span>
                  <span className="text-xs text-slate-400 block font-medium">ต่อ 1 หุ้น</span>
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
        <div className="p-4 sm:p-5 rounded-2xl bg-[#141822] border border-purple-500/25 space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <div className="flex items-center gap-2">
              <Scissors className="w-4 h-4 text-purple-400" />
              <h4 className="text-sm sm:text-base font-bold text-white">
                ประวัติการแตกพาร์ / ปรับสัดส่วนหุ้น (Stock Splits)
              </h4>
            </div>
            <span className="text-xs text-purple-300 font-mono font-medium">
              {splits.length} ครั้งในอดีต
            </span>
          </div>

          <div className="space-y-2">
            {splits.map((split, i) => (
              <div
                key={`${split.date}-${i}`}
                className="p-3 rounded-xl bg-[#0F1218] border border-white/[0.05] flex items-center justify-between"
              >
                <div>
                  <span className="text-sm font-semibold text-white block">
                    {split.formattedDate}
                  </span>
                  <span className="text-xs text-slate-300 mt-0.5 block font-medium">
                    {split.description}
                  </span>
                </div>
                <div className="px-3 py-1 rounded-lg bg-purple-500/15 border border-purple-500/25 text-purple-300 font-mono font-bold text-xs sm:text-sm">
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
