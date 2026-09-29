'use client'

import React, { useState } from 'react'
import {
  Calendar,
  DollarSign,
  TrendingUp,
  Activity,
  Award,
  Sparkles,
  Layers,
  CheckCircle2,
  Clock,
  Briefcase,
  AlertCircle,
  Scissors,
  ShieldCheck,
  Calculator,
  Timer,
  Info,
  Coins,
  ShieldAlert,
  ChevronRight,
  TrendingDown,
} from 'lucide-react'
import {
  HistoricalStockStats,
  UserPositionStats,
  EstimatedNextPayout,
  DividendSafety,
} from '@/lib/market-data/historical-stats'

interface StockHistoricalStatsTabProps {
  symbol: string
  name: string
  currencySymbol: string
  currentPrice: number
  stats?: HistoricalStockStats | null
  userPosition?: {
    shares: number
    avgCost: number
    totalCost?: number
    currentValue?: number
    unrealizedGain?: number
    unrealizedGainPercent?: number
  } | null
  payoutRatio?: number | null
}

export function StockHistoricalStatsTab({
  symbol,
  name,
  currencySymbol,
  currentPrice,
  stats,
  userPosition,
  payoutRatio,
}: StockHistoricalStatsTabProps) {
  // Interactive Simulator State
  const defaultSim =
    userPosition && userPosition.shares > 0 ? Math.round(userPosition.shares) : 100
  const [simShares, setSimShares] = useState<number>(defaultSim)

  if (!stats) {
    return (
      <div className="py-20 text-center text-slate-400 text-sm flex flex-col items-center justify-center gap-3">
        <Activity className="w-7 h-7 animate-pulse text-indigo-400" />
        <span className="font-medium">กำลังประมวลผลสถิติและประวัติปันผลย้อนหลัง...</span>
      </div>
    )
  }

  const {
    dividends,
    performance,
    splits,
    safety,
    estimatedNextPayout,
    userDividends,
    userPositionStats: serverUserStats,
  } = stats

  const hasDividends = dividends?.hasDividends
  const ttmDividends = dividends?.ttmDividends ?? 0
  const ttmYield = dividends?.ttmYield ?? null

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

  const periodDiv =
    dividends.frequency === 'Monthly'
      ? 12
      : dividends.frequency === 'Quarterly'
      ? 4
      : dividends.frequency === 'Semi-Annual'
      ? 2
      : 1

  // Resolve user position stats (either from server payload or calculated client-side from props)
  const resolvedUserPosition: UserPositionStats | null = (() => {
    if (serverUserStats) return serverUserStats
    if (userPosition && userPosition.shares > 0.0001) {
      const shares = userPosition.shares
      const avgCost = userPosition.avgCost
      const totalCost = userPosition.totalCost || shares * avgCost
      const currentValue = userPosition.currentValue || shares * currentPrice
      const unrealizedGain = userPosition.unrealizedGain || currentValue - totalCost
      const unrealizedGainPercent =
        userPosition.unrealizedGainPercent ||
        (totalCost > 0 ? (unrealizedGain / totalCost) * 100 : 0)

      const yieldOnCost =
        avgCost > 0 && ttmDividends > 0
          ? Number(((ttmDividends / avgCost) * 100).toFixed(2))
          : 0

      const marketYieldVal = ttmYield ?? 0
      const yocDifference = Number((yieldOnCost - marketYieldVal).toFixed(2))

      const annualEstimatedIncome = Number((shares * ttmDividends).toFixed(2))
      const monthlyEstimatedIncome = Number((annualEstimatedIncome / 12).toFixed(2))
      const perPeriodEstimatedIncome = Number((annualEstimatedIncome / periodDiv).toFixed(2))

      const totalReceived = userDividends?.totalReceived || 0
      const receivedCount = userDividends?.count || 0
      const lastReceivedDate = userDividends?.lastDate || null
      const paybackPercent =
        totalCost > 0 ? Number(((totalReceived / totalCost) * 100).toFixed(2)) : 0

      return {
        shares,
        avgCost,
        totalCost: Number(totalCost.toFixed(2)),
        currentValue: Number(currentValue.toFixed(2)),
        unrealizedGain: Number(unrealizedGain.toFixed(2)),
        unrealizedGainPercent: Number(unrealizedGainPercent.toFixed(2)),
        yieldOnCost,
        yocDifference,
        annualEstimatedIncome,
        monthlyEstimatedIncome,
        perPeriodEstimatedIncome,
        totalReceived,
        receivedCount,
        lastReceivedDate,
        paybackPercent,
      }
    }
    return null
  })()

  // Simulator calculation
  const simInvestAmount = simShares * currentPrice
  const simAnnualIncome = simShares * ttmDividends
  const simMonthlyIncome = simAnnualIncome / 12
  const simPeriodIncome = simAnnualIncome / periodDiv

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
                Yield แท้จริง{' '}
                <strong className="text-emerald-400 font-semibold">
                  ~{dividends.ttmYield}%
                </strong>
              </span>
            ) : (
              <span className="text-slate-500">ไม่มีเงินปันผล</span>
            )}
          </div>
        </div>

        {/* Payout Frequency (Fixed & Highly Accurate) */}
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
                <span className="text-slate-200 font-semibold">
                  {dividends.payoutMonths.join(', ')}
                </span>
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
                XD:{' '}
                <strong className="text-slate-200 font-semibold">
                  {dividends.latestPayout.formattedDate}
                </strong>
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
                performance.pullbackFrom52wHigh !== null &&
                performance.pullbackFrom52wHigh <= -15
                  ? 'text-cyan-400'
                  : performance.pullbackFrom52wHigh !== null &&
                    performance.pullbackFrom52wHigh <= -5
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
                จุดสูงสุด:{' '}
                <strong className="text-slate-200 font-semibold">
                  {currencySymbol}
                  {performance.fiftyTwoWeekHigh}
                </strong>
              </span>
            ) : (
              <span className="text-slate-500">52-Week Peak</span>
            )}
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 2. NEXT ESTIMATED XD COUNTDOWN BANNER (นับถอยหลังรอบถัดไป) */}
      {/* ============================================================ */}
      {hasDividends && estimatedNextPayout && (
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-indigo-950/40 via-[#141822] to-cyan-950/30 border border-cyan-500/25 relative overflow-hidden shadow-lg">
          <div className="absolute top-0 right-0 w-60 h-28 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 relative z-10">
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0 mt-0.5 sm:mt-0">
                <Timer className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                    ประมาณการวันขึ้นเครื่องหมายรอบถัดไป (Estimated Next XD)
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    {estimatedNextPayout.countdownText}
                  </span>
                </div>
                <div className="mt-1 flex items-baseline gap-2 flex-wrap">
                  <h4 className="text-base sm:text-lg font-bold text-white">
                    {estimatedNextPayout.estimatedMonthYear}
                  </h4>
                  <span className="text-xs text-slate-300 font-medium">
                    (คาดการณ์ประมาณวันที่ {estimatedNextPayout.estimatedDate})
                  </span>
                  <span className="text-xs text-emerald-400 font-mono font-semibold">
                    ~{currencySymbol}
                    {estimatedNextPayout.estimatedAmount.toFixed(2)}/หุ้น
                  </span>
                </div>
              </div>
            </div>

            <div className="text-left sm:text-right pt-2 sm:pt-0 border-t sm:border-t-0 border-white/[0.08]">
              <span className="text-[11px] text-slate-400 block font-medium">
                💡 ข้อแนะนำสำหรับนักลงทุน
              </span>
              <p className="text-xs text-slate-300 font-medium mt-0.5">
                ซื้อสะสมก่อนวัน XD เพื่อรับสิทธิ์เงินปันผลงวดนี้
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 3. USER POSITION & YIELD ON COST (YOC) HUB (ถ้ามีหุ้นในพอร์ต) */}
      {/* ============================================================ */}
      {resolvedUserPosition ? (
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-[#141822] to-indigo-500/10 border border-emerald-500/30 space-y-4 shadow-md">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-500/20 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/35 flex items-center justify-center text-emerald-400 shrink-0">
                <Briefcase className="w-5 h-5" />
              </div>
              <div>
                <span className="text-sm sm:text-base font-bold text-white block">
                  สถานะการถือครอง & กระแสเงินสดของคุณใน {symbol}
                </span>
                <p className="text-xs text-slate-300 mt-0.5 font-medium">
                  ถืออยู่{' '}
                  <strong className="text-white font-mono">
                    {resolvedUserPosition.shares.toLocaleString()} หุ้น
                  </strong>{' '}
                  • ต้นทุนเฉลี่ย{' '}
                  <strong className="text-white font-mono">
                    {currencySymbol}
                    {resolvedUserPosition.avgCost.toFixed(2)}
                  </strong>{' '}
                  • มูลค่าปัจจุบัน{' '}
                  <strong className="text-white font-mono">
                    {currencySymbol}
                    {resolvedUserPosition.currentValue.toLocaleString()}
                  </strong>
                </p>
              </div>
            </div>

            {resolvedUserPosition.unrealizedGainPercent !== 0 && (
              <span
                className={`self-start sm:self-auto text-xs font-mono font-bold px-2.5 py-1 rounded-lg border ${
                  resolvedUserPosition.unrealizedGain >= 0
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                }`}
              >
                Capital Gain:{' '}
                {resolvedUserPosition.unrealizedGain >= 0 ? '+' : ''}
                {resolvedUserPosition.unrealizedGainPercent.toFixed(1)}% (
                {currencySymbol}
                {resolvedUserPosition.unrealizedGain.toLocaleString()})
              </span>
            )}
          </div>

          {/* 3 Personal Performance Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* 1. Yield on Cost */}
            <div className="p-3.5 rounded-xl bg-[#0F1218]/90 border border-emerald-500/25 space-y-1">
              <span className="text-xs font-semibold text-slate-400 block">
                Yield on Cost (YoC) ของคุณ
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">
                  {resolvedUserPosition.yieldOnCost.toFixed(2)}%
                </span>
                {ttmYield !== null && resolvedUserPosition.yocDifference > 0 && (
                  <span className="text-[11px] font-bold text-emerald-300 bg-emerald-500/20 px-1.5 py-0.5 rounded">
                    +{resolvedUserPosition.yocDifference.toFixed(2)}% vs ตลาด
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                {resolvedUserPosition.yocDifference >= 0
                  ? `สูงกว่า Market Yield ปัจจุบัน (${ttmYield}%) เพราะต้นทุนคุณต่ำกว่า`
                  : `Yield อิงจากราคาต้นทุนซื้อเฉลี่ยของคุณ`}
              </p>
            </div>

            {/* 2. Estimated Annual Dividend Income */}
            <div className="p-3.5 rounded-xl bg-[#0F1218]/90 border border-emerald-500/25 space-y-1">
              <span className="text-xs font-semibold text-slate-400 block">
                ปันผลคาดการณ์ที่จะได้รับ
              </span>
              <div className="text-xl sm:text-2xl font-black text-white font-mono">
                +{currencySymbol}
                {resolvedUserPosition.annualEstimatedIncome.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{' '}
                <span className="text-xs font-normal text-slate-400">/ ปี</span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                ~{currencySymbol}
                {resolvedUserPosition.perPeriodEstimatedIncome.toFixed(2)} ต่องวด (~
                {currencySymbol}
                {resolvedUserPosition.monthlyEstimatedIncome.toFixed(2)} / เดือน)
              </p>
            </div>

            {/* 3. Realized Dividends & Payback */}
            <div className="p-3.5 rounded-xl bg-[#0F1218]/90 border border-emerald-500/25 space-y-1">
              <span className="text-xs font-semibold text-slate-400 block">
                เงินปันผลสะสมที่ได้รับเข้าพอร์ตแล้ว
              </span>
              <div className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">
                +{currencySymbol}
                {resolvedUserPosition.totalReceived.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
              <p className="text-[11px] text-emerald-300/90 font-medium">
                ได้รับแล้ว {resolvedUserPosition.receivedCount} ครั้ง{' '}
                {resolvedUserPosition.paybackPercent > 0
                  ? `(คืนทุนสะสม ${resolvedUserPosition.paybackPercent.toFixed(1)}%)`
                  : ''}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {/* ============================================================ */}
      {/* 4. DIVIDEND SAFETY & SUSTAINABILITY (เช็กความปลอดภัย) */}
      {/* ============================================================ */}
      {hasDividends && safety && (
        <div className="p-4 sm:p-5 rounded-2xl bg-[#141822] border border-white/[0.08] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <h4 className="text-sm sm:text-base font-bold text-white">
                สุขภาพและความยั่งยืนของเงินปันผล (Dividend Safety & Health)
              </h4>
            </div>
            <span className="text-xs text-slate-400 font-medium">
              คัดกรองความมั่นคง ป้องกัน Dividend Trap
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* 1. Payout Ratio */}
            <div className="p-3.5 rounded-xl bg-[#0F1218] border border-white/[0.06] space-y-2 hover:border-white/[0.12] transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-300 font-semibold">
                  อัตราจ่ายเทียบกำไร (Payout Ratio)
                </span>
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${
                    safety.payoutRatioStatus === 'healthy'
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                      : safety.payoutRatioStatus === 'moderate'
                      ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                      : safety.payoutRatioStatus === 'high_risk'
                      ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                      : 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                  }`}
                >
                  {safety.payoutRatioLabel}
                </span>
              </div>

              <div className="text-xl sm:text-2xl font-bold font-mono text-white">
                {safety.payoutRatio !== null ? `${safety.payoutRatio}%` : 'ดัชนี ETF'}
              </div>

              <p className="text-xs text-slate-400 leading-relaxed font-normal">
                {safety.payoutRatioDescription}
              </p>
            </div>

            {/* 2. Growth Streak */}
            <div className="p-3.5 rounded-xl bg-[#0F1218] border border-white/[0.06] space-y-2 hover:border-white/[0.12] transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-300 font-semibold">
                  สถิติเพิ่มปันผลต่อเนื่อง
                </span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  {safety.streakBadge}
                </span>
              </div>

              <div className="text-xl sm:text-2xl font-bold font-mono text-white">
                {safety.growthStreakYears > 0
                  ? `${safety.growthStreakYears} ปีติดต่อกัน`
                  : 'สม่ำเสมอในอดีต'}
              </div>

              <p className="text-xs text-slate-400 leading-relaxed font-normal">
                {safety.streakDescription}
              </p>
            </div>

            {/* 3. Dividend CAGR (Growth Rate) */}
            <div className="p-3.5 rounded-xl bg-[#0F1218] border border-white/[0.06] space-y-2 hover:border-white/[0.12] transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-300 font-semibold">
                  อัตราเติบโตทบต้น (CAGR)
                </span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                  {safety.cagr5Y !== null ? '5 ปีย้อนหลัง' : '3 ปีย้อนหลัง'}
                </span>
              </div>

              <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-400">
                {safety.cagr5Y !== null
                  ? `+${safety.cagr5Y}% / ปี`
                  : safety.cagr3Y !== null
                  ? `+${safety.cagr3Y}% / ปี`
                  : 'จ่ายสม่ำเสมอ'}
              </div>

              <p className="text-xs text-slate-400 leading-relaxed font-normal">
                เงินปันผลมีอัตราเพิ่มขึ้นทบต้น ช่วยสร้างผลตอบแทนชนะเงินเฟ้อระยะยาว
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 5. INTERACTIVE DIVIDEND & CASH FLOW SIMULATOR */}
      {/* ============================================================ */}
      {hasDividends && currentPrice > 0 && ttmDividends > 0 && (
        <div className="p-4 sm:p-5 rounded-2xl bg-[#141822] border border-white/[0.08] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <div className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-indigo-400" />
              <h4 className="text-sm sm:text-base font-bold text-white">
                จำลองผลตอบแทนกระแสเงินสด (Passive Income Simulator)
              </h4>
            </div>
            <span className="text-xs text-slate-400 font-medium">
              คำนวณเงินปันผลที่คุณจะได้รับจากการซื้อสะสม
            </span>
          </div>

          <div className="p-4 rounded-xl bg-[#0F1218] border border-white/[0.06] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-300">
                ระบุจำนวนหุ้นที่ต้องการถือครอง:
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {[50, 100, 200, 500, 1000].map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setSimShares(preset)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                      simShares === preset
                        ? 'bg-indigo-600 text-white shadow'
                        : 'bg-white/[0.05] text-slate-300 hover:bg-white/[0.1]'
                    }`}
                  >
                    {preset} หุ้น
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="range"
                min="10"
                max="2000"
                step="10"
                value={simShares}
                onChange={(e) => setSimShares(Number(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
              <div className="w-24 shrink-0 flex items-center bg-[#141822] border border-white/[0.1] rounded-lg px-2 py-1">
                <input
                  type="number"
                  min="1"
                  max="100000"
                  value={simShares}
                  onChange={(e) => setSimShares(Math.max(1, Number(e.target.value)))}
                  className="w-full bg-transparent text-sm font-mono font-bold text-white text-right focus:outline-none"
                />
                <span className="text-xs text-slate-400 ml-1">หุ้น</span>
              </div>
            </div>

            {/* Results Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-white/[0.06]">
              <div className="p-2.5 rounded-lg bg-[#141822]/80 border border-white/[0.04]">
                <span className="text-[11px] text-slate-400 block font-medium">
                  มูลค่าเงินลงทุนที่ใช้
                </span>
                <span className="text-sm sm:text-base font-bold text-white font-mono">
                  {currencySymbol}
                  {simInvestAmount.toLocaleString('en-US', {
                    maximumFractionDigits: 0,
                  })}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-[#141822]/80 border border-white/[0.04]">
                <span className="text-[11px] text-slate-400 block font-medium">
                  ปันผลคาดการณ์ต่อปี
                </span>
                <span className="text-sm sm:text-base font-bold text-emerald-400 font-mono">
                  +{currencySymbol}
                  {simAnnualIncome.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-[#141822]/80 border border-white/[0.04]">
                <span className="text-[11px] text-slate-400 block font-medium">
                  เฉลี่ยต่อเดือน
                </span>
                <span className="text-sm sm:text-base font-bold text-cyan-300 font-mono">
                  +{currencySymbol}
                  {simMonthlyIncome.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-[#141822]/80 border border-white/[0.04]">
                <span className="text-[11px] text-slate-400 block font-medium">
                  เฉลี่ยต่องวด ({freqTitle})
                </span>
                <span className="text-sm sm:text-base font-bold text-indigo-300 font-mono">
                  +{currencySymbol}
                  {simPeriodIncome.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 6. HISTORICAL RETURNS MATRIX (ผลตอบแทนย้อนหลังหลายช่วงเวลา) */}
      {/* ============================================================ */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#141822] border border-white/[0.08] space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-indigo-400" />
            <h4 className="text-sm sm:text-base font-bold text-white">
              ผลตอบแทนราคาประวัติศาสตร์ (Trailing Return Matrix)
            </h4>
          </div>
          <span className="text-xs text-slate-400 font-medium">
            คำนวณจากราคาปิดย้อนหลัง (Price Return)
          </span>
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
      {/* 7. ANNUAL DIVIDEND SUMMARY & YOY GROWTH */}
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
            <span className="text-xs text-slate-400 font-medium">
              เปรียบเทียบการเติบโต YoY
            </span>
          </div>

          <div className="space-y-2.5 pt-1">
            {dividends.annualBreakdown.slice(0, 5).map((yrData) => {
              const currentYear = new Date().getFullYear()
              const isCurrentYear = yrData.year === currentYear
              const maxAnnual =
                Math.max(...dividends.annualBreakdown.map((x) => x.totalAmount)) || 1
              const barWidth = Math.min(
                100,
                Math.max(10, (yrData.totalAmount / maxAnnual) * 100)
              )

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
                      {isCurrentYear ? (
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-cyan-500/15 text-cyan-300 border border-cyan-500/25">
                          รอบปีนี้ ({yrData.count}/{periodDiv} งวด)
                        </span>
                      ) : yrData.growthPercent !== null ? (
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
                      ) : null}

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
      {/* 8. HISTORICAL PAYOUT EVENTS TABLE (รายการจ่ายเงินปันผลย้อนหลัง) */}
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
                  <span className="text-xs text-slate-400 block font-medium">
                    ต่อ 1 หุ้น
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 9. CORPORATE ACTIONS & STOCK SPLITS (IF ANY) */}
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
