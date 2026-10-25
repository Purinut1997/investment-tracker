'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  X,
  Calendar,
  Clock,
  TrendingDown,
  TrendingUp,
  Percent,
  Coins,
  ShieldCheck,
  Sparkles,
  Info,
  CalendarDays,
  ExternalLink,
  Wallet,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react'
import { AnalyzedDividendData } from '@/lib/dividends/dividend-analyzer'
import { DividendHistoryChart } from './DividendHistoryChart'

interface StockDividendDetailModalProps {
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
  onClose: () => void
}

export function StockDividendDetailModal({
  data,
  userHolding,
  baseCurrency = 'THB',
  onClose,
}: StockDividendDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'xd_stats' | 'history'>('overview')
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

  if (!mounted) return null

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
    payouts,
  } = data

  const isThai = market === 'TH'

  const modalContent = (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md overflow-hidden"
    >
      <div
        className="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-[#12151F] border border-white/10 rounded-2xl sm:rounded-3xl shadow-2xl shadow-black/80 overflow-hidden text-slate-200 animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header */}
        <div className="px-5 py-4 border-b border-white/[0.08] bg-[#161B28] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center font-bold text-lg shrink-0">
              {isThai ? '🇹🇭' : '🇺🇸'}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">{ticker}</h2>
                <span className="text-xs px-2 py-0.5 rounded-md bg-[#0F131D] text-indigo-300 font-mono font-semibold border border-white/[0.06]">
                  {market}
                </span>
                <span className="text-xs font-mono font-bold text-emerald-400">
                  {currentPrice > 0 ? `${currentPrice.toFixed(2)} ${currency}` : ''}
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate">{companyName}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/[0.05] hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-5 pt-3 pb-0 bg-[#161B28]/50 border-b border-white/[0.06] flex items-center gap-2 overflow-x-auto scrollbar-none shrink-0">
          {[
            { id: 'overview', label: 'ภาพรวม & วันขึ้น XD' },
            { id: 'xd_stats', label: '💥 สถิติหุ้นร่วงในวัน XD & การฟื้นตัว' },
            { id: 'history', label: '📊 ย้อนหลัง 5 ปี & รอบการจ่าย' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3.5 py-2 rounded-t-xl text-xs font-bold transition-all border-b-2 cursor-pointer ${
                activeTab === tab.id
                  ? 'border-indigo-500 text-white bg-indigo-500/10'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Highlight Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* 1. Upcoming XD Countdown Box */}
                <div className="p-4 rounded-2xl bg-[#151926] border border-indigo-500/30 space-y-2 relative overflow-hidden shadow-lg shadow-indigo-950/20">
                  <div className="flex items-center justify-between text-xs font-bold text-indigo-300">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-indigo-400" />
                      <span>วันขึ้น XD รอบถัดไป</span>
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30">
                      {upcomingDividend.countdownLabel}
                    </span>
                  </div>
                  <div className="text-xl font-extrabold text-white font-mono tracking-tight">
                    {upcomingDividend.exDate}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {upcomingDividend.fullThaiDate}
                  </p>
                  <div className="text-[10px] text-indigo-300/80 flex items-center gap-1 pt-1 border-t border-white/[0.06]">
                    <span>คาดการณ์ปันผล:</span>
                    <strong className="text-white font-mono">
                      {upcomingDividend.estimatedAmount > 0
                        ? `${upcomingDividend.estimatedAmount.toFixed(2)} ${currency} / หุ้น`
                        : 'รอประกาศ'}
                    </strong>
                  </div>
                </div>

                {/* 2. Latest Dividend Box */}
                <div className="p-4 rounded-2xl bg-[#151926] border border-white/[0.08] space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                    <span className="flex items-center gap-1.5 text-emerald-400">
                      <Coins className="w-4 h-4 text-emerald-400" />
                      <span>ครั้งล่าสุด ปันผลเท่าไหร่</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {latestDividend?.date || '-'}
                    </span>
                  </div>
                  <div className="text-xl font-extrabold text-emerald-400 font-mono tracking-tight">
                    {latestDividend ? `${latestDividend.amount.toFixed(2)} ${currency}` : '-'}
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Dividend Yield ต่องวด:</span>
                    <span className="font-mono font-bold text-emerald-300">
                      {latestDividend ? `${latestDividend.yieldPercent.toFixed(2)}%` : '-'}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 pt-1 border-t border-white/[0.06]">
                    ความถี่: <span className="text-white font-semibold">{frequency.label}</span>
                  </div>
                </div>

                {/* 3. XD Drop & Recovery Quick Insight */}
                <div className="p-4 rounded-2xl bg-[#151926] border border-white/[0.08] space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-amber-400">
                    <span className="flex items-center gap-1.5">
                      <TrendingDown className="w-4 h-4 text-amber-400" />
                      <span>สถิติราคาในวันขึ้น XD</span>
                    </span>
                    <span className="text-[10px] text-slate-400">ย้อนหลัง 5 ปี</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-extrabold text-amber-300 font-mono">
                      {xdDropAnalysis.avgDropPercent}%
                    </span>
                    <span className="text-[11px] text-slate-400">ราคาเปิดร่วงเฉลี่ย</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>ระยะเวลาฟื้นตัวเฉลี่ย:</span>
                    <span className="font-mono font-bold text-white">
                      {xdDropAnalysis.avgRecoveryDays} วัน
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-white/[0.06]">
                    <span>โอกาสฟื้นตัวสำเร็จ:</span>
                    <span className="font-bold text-emerald-400">
                      {xdDropAnalysis.recoveryRatePercent}%
                    </span>
                  </div>
                </div>
              </div>

              {/* User Holding Position Banner (If owned in portfolio) */}
              {userHolding && (
                <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/30 to-[#121624] border border-emerald-500/30 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                      <Wallet className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-2">
                        <span>หุ้นในพอร์ตของคุณ:</span>
                        <span className="text-emerald-300 font-mono">
                          {userHolding.quantity.toLocaleString()} หุ้น
                        </span>
                        <span className="text-slate-400 text-[11px]">
                          (ต้นทุนเฉลี่ย {userHolding.avgCost.toFixed(2)} {currency})
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Yield on Cost: <strong className="text-emerald-400 font-mono">{userHolding.yieldOnCostPercent}%</strong> • มูลค่าพอร์ต: {userHolding.currentValue.toLocaleString()} {currency}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase">เงินปันผลรอบถัดไปที่จะได้รับ</div>
                      <div className="text-base font-extrabold text-emerald-400 font-mono">
                        ≈ {userHolding.estimatedNextPayout.toLocaleString()} {currency}
                      </div>
                    </div>
                    <div className="h-7 w-px bg-white/10 hidden sm:block" />
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase">คาดการณ์รวมทั้งปี</div>
                      <div className="text-base font-extrabold text-indigo-300 font-mono">
                        ≈ {userHolding.annualEstimatedIncome.toLocaleString()} {currency}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 5-Year Visual Chart Summary */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#151926] border border-white/[0.08] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white">สถิติปันผลย้อนหลัง 5 ปี (5-Year Historical Payouts)</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      ยอดเงินปันผลรวมต่อหุ้นในแต่ละปี ({currency}) และอัตราการเติบโตต่อเนื่อง
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20 font-mono">
                      CAGR 5 ปี: {history5Years.cagr5YearPercent >= 0 ? `+${history5Years.cagr5YearPercent}%` : `${history5Years.cagr5YearPercent}%`}
                    </span>
                  </div>
                </div>

                <DividendHistoryChart years={history5Years.years} currency={currency} height={180} />
              </div>
            </div>
          )}

          {/* TAB 2: XD PRICE DROP & RECOVERY ANALYSIS */}
          {activeTab === 'xd_stats' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Strategic Tip Box */}
              <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-500/30 flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-amber-300">ข้อสรุปพฤติกรรมราคาหุ้นวันขึ้นเครื่องหมาย XD (AI Playbook):</h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {xdDropAnalysis.strategyTip}
                  </p>
                </div>
              </div>

              {/* 4 Stats Metric Counters */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-[#151926] border border-white/[0.06] text-center">
                  <div className="text-[11px] text-slate-400">ราคาเปิดร่วงเฉลี่ย (XD Open)</div>
                  <div className="text-lg font-bold text-amber-300 font-mono mt-1">
                    {xdDropAnalysis.avgDropPercent}%
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">ในเช้าวันขึ้นเครื่องหมาย XD</div>
                </div>

                <div className="p-3.5 rounded-xl bg-[#151926] border border-white/[0.06] text-center">
                  <div className="text-[11px] text-slate-400">สัดส่วนร่วงต่อปันผล</div>
                  <div className="text-lg font-bold text-indigo-300 font-mono mt-1">
                    {xdDropAnalysis.dropToDividendRatio}%
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">ของเงินปันผลที่จ่ายจริง</div>
                </div>

                <div className="p-3.5 rounded-xl bg-[#151926] border border-white/[0.06] text-center">
                  <div className="text-[11px] text-slate-400">ระยะเวลาฟื้นตัวเฉลี่ย</div>
                  <div className="text-lg font-bold text-emerald-400 font-mono mt-1">
                    {xdDropAnalysis.avgRecoveryDays} วัน
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">กลับสู่ราคาก่อนขึ้น XD</div>
                </div>

                <div className="p-3.5 rounded-xl bg-[#151926] border border-white/[0.06] text-center">
                  <div className="text-[11px] text-slate-400">อัตราฟื้นตัวสำเร็จ</div>
                  <div className="text-lg font-bold text-emerald-300 font-mono mt-1">
                    {xdDropAnalysis.recoveryRatePercent}%
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">ภายในกรอบเวลา 30-45 วัน</div>
                </div>
              </div>

              {/* Historical XD Drop Track Record Table */}
              <div className="p-4 rounded-2xl bg-[#151926] border border-white/[0.08] space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white">
                    บันทึกสถิติราคาหุ้นร่วงจริงในแต่ละรอบย้อนหลัง ({payouts.length} รอบ)
                  </h4>
                  <span className="text-[10px] text-slate-400">ราคาเปิด vs ราคาปิดก่อน XD</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-white/[0.08] text-slate-400 text-[11px]">
                        <th className="pb-2">วันขึ้น XD</th>
                        <th className="pb-2 text-right">เงินปันผล</th>
                        <th className="pb-2 text-right">ราคาก่อน XD</th>
                        <th className="pb-2 text-right">ราคาเปิดวัน XD</th>
                        <th className="pb-2 text-right">% ร่วงวัน XD</th>
                        <th className="pb-2 text-right">เวลาฟื้นตัว</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      {payouts.slice(0, 10).map((p) => (
                        <tr key={p.date} className="hover:bg-white/[0.02]">
                          <td className="py-2.5 text-slate-300">{p.date}</td>
                          <td className="py-2.5 text-right font-bold text-emerald-400">
                            {p.amount.toFixed(2)} {currency}
                          </td>
                          <td className="py-2.5 text-right text-slate-300">
                            {p.prevClose ? p.prevClose.toFixed(2) : '-'}
                          </td>
                          <td className="py-2.5 text-right text-slate-300">
                            {p.xdOpen ? p.xdOpen.toFixed(2) : '-'}
                          </td>
                          <td className="py-2.5 text-right font-bold">
                            {p.dropPercent !== undefined ? (
                              <span className={p.dropPercent < 0 ? 'text-rose-400' : 'text-emerald-400'}>
                                {p.dropPercent.toFixed(2)}%
                              </span>
                            ) : (
                              '-'
                            )}
                          </td>
                          <td className="py-2.5 text-right">
                            {p.recoveryDays !== null && p.recoveryDays !== undefined ? (
                              <span className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 text-[10px] font-bold">
                                {p.recoveryDays} วัน
                              </span>
                            ) : (
                              <span className="text-slate-500 text-[10px]">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: 5-YEAR HISTORY & PAYOUT BREAKDOWN */}
          {activeTab === 'history' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Frequency Breakdown Card */}
              <div className="p-4 rounded-2xl bg-[#151926] border border-white/[0.08] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-indigo-400" />
                    <span className="text-xs font-bold text-white">รอบการจ่ายเงินปันผลปกติใน 1 ปี</span>
                  </div>
                  <span className="text-xs font-bold text-indigo-300 bg-indigo-500/15 px-2.5 py-0.5 rounded-lg border border-indigo-500/30">
                    {frequency.label}
                  </span>
                </div>

                {frequency.typicalPayouts.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                    {frequency.typicalPayouts.map((round) => (
                      <div
                        key={round.roundName}
                        className="p-3 rounded-xl bg-[#0F131D] border border-white/[0.04] text-center space-y-1"
                      >
                        <div className="text-[10px] text-slate-400 font-bold">{round.roundName}</div>
                        <div className="text-base font-extrabold text-emerald-400 font-mono">
                          {round.amount.toFixed(2)} {currency}
                        </div>
                        <div className="text-[10px] text-indigo-300">
                          ช่วงเดือน: {round.typicalMonth}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 5-Year History Table by Year */}
              <div className="p-4 rounded-2xl bg-[#151926] border border-white/[0.08] space-y-3">
                <h4 className="text-xs font-bold text-white">ยอดปันผลรวมรายปี ย้อนหลัง 5 ปี (Yearly Breakdown)</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-white/[0.08] text-slate-400 text-[11px]">
                        <th className="pb-2">ปี (Year)</th>
                        <th className="pb-2 text-right">จำนวนครั้งที่จ่าย</th>
                        <th className="pb-2 text-right">ปันผลรวมทั้งปี</th>
                        <th className="pb-2 text-right">การเติบโต (YoY Growth)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      {history5Years.years.map((y) => (
                        <tr key={y.year} className="hover:bg-white/[0.02]">
                          <td className="py-2.5 font-bold text-white">{y.year}</td>
                          <td className="py-2.5 text-right text-slate-300">{y.payoutCount} ครั้ง</td>
                          <td className="py-2.5 text-right font-bold text-emerald-400">
                            {y.totalAmount.toFixed(2)} {currency}
                          </td>
                          <td className="py-2.5 text-right font-bold">
                            {y.growthRatePercent !== undefined ? (
                              <span className={y.growthRatePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                                {y.growthRatePercent >= 0 ? `+${y.growthRatePercent}%` : `${y.growthRatePercent}%`}
                              </span>
                            ) : (
                              <span className="text-slate-500">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 border-t border-white/[0.08] bg-[#161B28] flex items-center justify-between text-xs shrink-0">
          <span className="text-slate-400 text-[11px] flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-slate-500" />
            <span>สถิติคำนวณจากราคาจริงในตลาดตามรอบปฏิทินย้อนหลัง 5 ปี</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold transition-colors cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
