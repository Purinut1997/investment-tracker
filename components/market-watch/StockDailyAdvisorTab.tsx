'use client'

import { AdvisorStockImpact } from '@/components/advisor/AdvisorPlanPanel'

import React, { useState, useMemo, useEffect } from 'react'
import useSWR from 'swr'
import {
  Sparkles,
  Loader2,
  RefreshCw,
  ShieldAlert,
  History,
  Activity,
  Compass,
  Target,
  Calculator,
  CheckSquare,
  Square,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react'
import {
  DailyStockAdvisorResponse,
  DailyVerdict,
  RiskDimensionKey,
  RiskLevel,
  simulateDcaPosition,
} from '@/lib/analytics/stock-daily-advisor'

interface StockDailyAdvisorTabProps {
  symbol: string
  market: string
  name?: string
}

function getRiskToneClasses(level: RiskLevel): {
  text: string
  bg: string
  border: string
  bar: string
} {
  if (level === 'high') {
    return {
      text: 'text-[#F05D73]',
      bg: 'bg-[#F05D73]/12',
      border: 'border-[#F05D73]/30',
      bar: 'bg-[#F05D73]',
    }
  }
  if (level === 'elevated') {
    return {
      text: 'text-[#F2B84B]',
      bg: 'bg-[#F2B84B]/12',
      border: 'border-[#F2B84B]/30',
      bar: 'bg-[#F2B84B]',
    }
  }
  if (level === 'moderate') {
    return {
      text: 'text-slate-200',
      bg: 'bg-white/[0.06]',
      border: 'border-white/[0.12]',
      bar: 'bg-[#6D5EF7]',
    }
  }
  return {
    text: 'text-[#20C997]',
    bg: 'bg-[#20C997]/12',
    border: 'border-[#20C997]/30',
    bar: 'bg-[#20C997]',
  }
}

function getVerdictBadgeStyle(verdict: DailyVerdict): string {
  switch (verdict) {
    case 'ACCUMULATE':
      return 'bg-[#20C997]/15 text-[#20C997] border-[#20C997]/35'
    case 'WAIT_AT_SUPPORT':
      return 'bg-[#F2B84B]/15 text-[#F2B84B] border-[#F2B84B]/35'
    case 'TRIM_PROFIT':
      return 'bg-[#6D5EF7]/20 text-indigo-200 border-[#6D5EF7]/40'
    case 'CAUTION':
      return 'bg-[#F05D73]/15 text-[#F05D73] border-[#F05D73]/35'
    default:
      return 'bg-white/[0.08] text-[#F4F6F8] border-white/[0.15]'
  }
}

function formatSignedPct(val: number | null | undefined): string {
  if (val === null || val === undefined || !Number.isFinite(val)) return '—'
  return `${val >= 0 ? '+' : ''}${val.toFixed(2)}%`
}

function formatPrice(val: number | null | undefined, sym: string): string {
  if (val === null || val === undefined || !Number.isFinite(val)) return '—'
  return `${sym}${val.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: val < 1 ? 4 : 2,
  })}`
}

export function StockDailyAdvisorTab({ symbol, market }: StockDailyAdvisorTabProps) {
  const swrKey = `/api/market-watch/daily-risk-advisor?symbol=${encodeURIComponent(
    symbol
  )}&market=${encodeURIComponent(market)}`

  const { data, error, isLoading, mutate } = useSWR<DailyStockAdvisorResponse>(swrKey, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  })

  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({})

  // Interactive DCA Simulator states
  const isThb = data?.contextSnapshot.currency === 'THB' || market === 'TH'
  const [budgetAmount, setBudgetAmount] = useState<number>(isThb ? 5000 : 200)
  const [entryMode, setEntryMode] = useState<'current' | 's1' | 's2' | 'custom'>('current')
  const [customEntryPrice, setCustomEntryPrice] = useState<string>('')

  useEffect(() => {
    setBudgetAmount(isThb ? 5000 : 200)
    setEntryMode('current')
    setCustomEntryPrice('')
    setCheckedItems({})
    setGenError(null)
  }, [symbol, isThb])

  const handleGenerateAi = async (forceRefresh: boolean) => {
    if (generating) return
    setGenerating(true)
    setGenError(null)
    try {
      const res = await fetch('/api/market-watch/daily-risk-advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, market, forceRefresh }),
      })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json?.error || 'ไม่สามารถวิเคราะห์ความเสี่ยงรายวันด้วย AI ได้')
      }
      await mutate(json, false)
    } catch (err: any) {
      setGenError(err?.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ Gemini AI')
    } finally {
      setGenerating(false)
    }
  }

  const effectiveEntryPrice = useMemo(() => {
    if (!data) return 0
    const zones = data.quant.priceZones
    if (entryMode === 's1' && zones.support1) return zones.support1
    if (entryMode === 's2' && zones.support2) return zones.support2
    if (entryMode === 'custom') {
      const parsed = Number(customEntryPrice)
      if (Number.isFinite(parsed) && parsed > 0) return parsed
    }
    return zones.currentPrice
  }, [data, entryMode, customEntryPrice])

  const positionLimit = data?.contextSnapshot.positionLimit
  const dcaSim = useMemo(() => {
    if (!data) return null
    const pos = data.contextSnapshot.position
    return simulateDcaPosition({
      currentShares: pos?.shares ?? 0,
      currentAvgCost: pos?.avgCost ?? 0,
      currentPrice: data.contextSnapshot.currentPrice,
      addedAmount: budgetAmount,
      entryPrice: effectiveEntryPrice,
      totalPortfolioValueNative: positionLimit?.totalPortfolioValueNative ?? pos?.totalPortfolioValueNative ?? null,
      maxSinglePositionPct: positionLimit?.percent ?? pos?.maxSinglePositionPct ?? 20,
    })
  }, [data, budgetAmount, effectiveEntryPrice, positionLimit])

  const defaultChecklist = useMemo(() => {
    if (!data) return []
    const snap = data.contextSnapshot
    const zones = data.quant.priceZones
    const currSym = snap.currency === 'THB' ? '฿' : '$'
    const list: string[] = [
      `ทบทวนเหตุผลพื้นฐานของ ${data.symbol} ว่ายังสอดคล้องกับแผนลงทุนเดิมหรือไม่`,
    ]
    if (zones.support1) {
      list.push(
        `พิจารณาแบ่งไม้เข้าซื้ออย่างมีวินัย แทนการใส่เต็มจำนวน (แนวรับ S1: ${formatPrice(
          zones.support1,
          currSym
        )})`
      )
    }
    if (snap.forward.nextXdDate && snap.forward.nextXdDays !== null) {
      list.push(
        `หากต้องการรับปันผลรอบถัดไป มีเวลาสะสมถึงประมาณ ${snap.forward.nextXdDate} (อีก ~${snap.forward.nextXdDays} วัน)`
      )
    }
    if (snap.position) {
      list.push(
        `คุมน้ำหนักพอร์ตไม่ให้เกินเพดาน ${snap.position.maxSinglePositionPct}% (ปัจจุบัน ${
          snap.position.portfolioWeightPct?.toFixed(1) ?? '—'
        }%)`
      )
    }
    return list
  }, [data])

  if (isLoading && !data) {
    return (
      <div className="py-16 flex flex-col items-center justify-center gap-3 text-xs text-[#9AA4B2]">
        <Loader2 className="w-6 h-6 animate-spin text-[#6D5EF7]" />
        <span>กำลังรวบรวมข้อมูลเก่า-สด-คาดการณ์ และคำนวณคะแนนความเสี่ยงรายวัน...</span>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="p-6 rounded-2xl bg-[#12151C] border border-[#F05D73]/30 text-center space-y-3">
        <AlertTriangle className="w-7 h-7 text-[#F05D73] mx-auto" />
        <p className="text-sm font-semibold text-[#F4F6F8]">โหลดข้อมูลวิเคราะห์ความเสี่ยงไม่สำเร็จ</p>
        <p className="text-xs text-[#9AA4B2]">กรุณาลองโหลดใหม่อีกครั้ง</p>
        <button
          type="button"
          onClick={() => mutate()}
          className="px-4 py-2 rounded-xl bg-[#6D5EF7] text-xs font-semibold text-white cursor-pointer"
        >
          ลองอีกครั้ง
        </button>
      </div>
    )
  }

  const snap = data.contextSnapshot
  const quant = data.quant
  const ai = data.aiReport
  const currSym = snap.currency === 'THB' ? '฿' : '$'
  const overallTone = getRiskToneClasses(quant.overallLevel)
  const activeVerdict = ai?.verdict ?? quant.defaultVerdict
  const activeVerdictLabel = ai?.verdictLabelTh ?? quant.defaultVerdictLabelTh
  const checklist = ai?.dailyChecklist && ai.dailyChecklist.length > 0 ? ai.dailyChecklist : defaultChecklist
  const quickAmounts = isThb ? [3000, 5000, 10000, 30000] : [100, 250, 500, 1000]

  const aiRiskMap: Record<RiskDimensionKey, string | undefined> = {
    technical: ai?.riskAnalysis.technical,
    fundamental: ai?.riskAnalysis.fundamental,
    portfolio: ai?.riskAnalysis.portfolio,
    sentiment: ai?.riskAnalysis.sentiment,
  }

  return (
    <div className="space-y-5 text-slate-200 animate-fade-in">
      <AdvisorStockImpact symbol={symbol} market={market} />
      {/* 1. DAILY VERDICT BANNER */}
      <section className="rounded-2xl bg-[#12151C] border border-white/[0.08] p-4 sm:p-5 space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="space-y-2 min-w-0">
            <div className="flex items-center gap-2 flex-wrap text-[11px]">
              <span className="px-2 py-0.5 rounded-md bg-[#181C25] border border-white/[0.08] font-mono text-[#9AA4B2]">
                ประจำวันที่ {data.reportDate}
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-md border font-bold ${getVerdictBadgeStyle(
                  activeVerdict
                )}`}
              >
                {activeVerdictLabel}
              </span>
              <span
                className={`px-2 py-0.5 rounded-md border font-mono font-bold ${overallTone.bg} ${overallTone.text} ${overallTone.border}`}
              >
                Risk {quant.overallScore}/100 ({quant.overallLabelTh})
              </span>
              {ai && data.modelUsed && (
                <span className="px-2 py-0.5 rounded-md bg-[#6D5EF7]/15 text-indigo-200 border border-[#6D5EF7]/30 font-mono">
                  AI: {data.modelUsed}
                </span>
              )}
            </div>

            <p className="text-xs sm:text-[13px] text-[#F4F6F8] leading-relaxed">
              {ai?.executiveSummary ||
                `ระบบคำนวณความเสี่ยงรวมของ ${data.symbol} วันนี้อยู่ที่ ${quant.overallScore}/100 (${quant.overallLabelTh}) จากข้อมูลเทคนิคอล พื้นฐาน พอร์ตของคุณ และข่าวล่าสุด กดปุ่ม "ให้ AI วิเคราะห์รายวัน" เพื่อรับคำแนะนำและแผนปฏิบัติการเฉพาะพอร์ตวันนี้`}
            </p>

            {ai && !data.isTodayReport && (
              <p className="text-[11px] text-[#F2B84B]">
                กำลังแสดงผลวิเคราะห์ AI จากวันก่อนหน้า — กด "วิเคราะห์สดใหม่" เพื่ออัปเดตตามราคาและข่าววันนี้
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => handleGenerateAi(Boolean(ai))}
            disabled={generating}
            className="shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#6D5EF7] hover:bg-[#5B4CE6] text-xs font-semibold text-white transition-colors disabled:opacity-50 cursor-pointer"
          >
            {generating ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>กำลังวิเคราะห์...</span>
              </>
            ) : ai ? (
              <>
                <RefreshCw className="w-3.5 h-3.5" />
                <span>วิเคราะห์สดใหม่</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>ให้ AI วิเคราะห์รายวัน</span>
              </>
            )}
          </button>
        </div>

        {genError && (
          <div className="p-3 rounded-xl bg-[#F05D73]/10 border border-[#F05D73]/30 text-xs text-[#F05D73]">
            {genError}
          </div>
        )}
      </section>

      {/* 2. 4-DIMENSION QUANTITATIVE RISK SCORECARD */}
      <section className="space-y-2.5">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-[#F2B84B]" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#F4F6F8]">
            มาตรวัดความเสี่ยง 4 มิติ (Quant Risk Scorecard)
          </h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {quant.dimensions.map((dim) => {
            const tone = getRiskToneClasses(dim.level)
            const aiNote = aiRiskMap[dim.key]
            return (
              <div
                key={dim.key}
                className="rounded-2xl bg-[#12151C] border border-white/[0.08] p-4 space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[#F4F6F8]">{dim.label}</span>
                  <span
                    className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-md border ${tone.bg} ${tone.text} ${tone.border}`}
                  >
                    {dim.score}/100 • {dim.levelLabelTh}
                  </span>
                </div>

                <div className="w-full h-1.5 rounded-full bg-[#090B10] overflow-hidden">
                  <div
                    className={`h-full rounded-full ${tone.bar}`}
                    style={{ width: `${dim.score}%` }}
                  />
                </div>

                <ul className="space-y-1 text-[11px] text-[#9AA4B2]">
                  {dim.drivers.map((drv, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="mt-1.5 w-1 h-1 rounded-full bg-slate-500 shrink-0" />
                      <span>{drv}</span>
                    </li>
                  ))}
                </ul>

                {aiNote && (
                  <p className="pt-2 border-t border-white/[0.06] text-xs text-slate-200 leading-relaxed">
                    {aiNote}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* 3. 3-HORIZON DATA CONTEXT: HISTORICAL -> LIVE -> FORWARD */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Historical */}
        <div className="rounded-2xl bg-[#12151C] border border-white/[0.08] p-4 space-y-2.5">
          <div className="flex items-center gap-2 pb-2 border-b border-white/[0.06]">
            <History className="w-4 h-4 text-[#9AA4B2]" />
            <h5 className="text-xs font-bold text-[#F4F6F8]">ข้อมูลเก่า (Historical)</h5>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono tabular-nums">
            <div className="p-2 rounded-lg bg-[#181C25]">
              <span className="text-[#9AA4B2] block font-sans">ผลตอบแทน 1M / 3M</span>
              <span className="font-bold text-[#F4F6F8]">
                {formatSignedPct(snap.historicalReturns.return1M)} /{' '}
                {formatSignedPct(snap.historicalReturns.return3M)}
              </span>
            </div>
            <div className="p-2 rounded-lg bg-[#181C25]">
              <span className="text-[#9AA4B2] block font-sans">ผลตอบแทน 6M / 1Y</span>
              <span className="font-bold text-[#F4F6F8]">
                {formatSignedPct(snap.historicalReturns.return6M)} /{' '}
                {formatSignedPct(snap.historicalReturns.return1Y)}
              </span>
            </div>
            <div className="p-2 rounded-lg bg-[#181C25]">
              <span className="text-[#9AA4B2] block font-sans">ย่อจาก 52w High</span>
              <span
                className={`font-bold ${
                  (snap.pullbackFrom52wHigh ?? 0) < -15 ? 'text-[#F05D73]' : 'text-[#F4F6F8]'
                }`}
              >
                {formatSignedPct(snap.pullbackFrom52wHigh)}
              </span>
            </div>
            <div className="p-2 rounded-lg bg-[#181C25]">
              <span className="text-[#9AA4B2] block font-sans">ผันผวน 30 วัน/ปี</span>
              <span className="font-bold text-[#F4F6F8]">
                {snap.technical.vol30dPct !== null ? `${snap.technical.vol30dPct.toFixed(1)}%` : '—'}
              </span>
            </div>
          </div>
          {ai?.historicalContext && (
            <p className="text-xs text-slate-300 leading-relaxed pt-1">{ai.historicalContext}</p>
          )}
        </div>

        {/* Live Today */}
        <div className="rounded-2xl bg-[#12151C] border border-white/[0.08] p-4 space-y-2.5">
          <div className="flex items-center gap-2 pb-2 border-b border-white/[0.06]">
            <Activity className="w-4 h-4 text-[#20C997]" />
            <h5 className="text-xs font-bold text-[#F4F6F8]">ข้อมูลสดวันนี้ (Live Today)</h5>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono tabular-nums">
            <div className="p-2 rounded-lg bg-[#181C25]">
              <span className="text-[#9AA4B2] block font-sans">RSI(14) / EMA200</span>
              <span className="font-bold text-[#F4F6F8]">
                {snap.technical.rsi ?? '—'} /{' '}
                {snap.technical.trendVsEma200 === 'bullish'
                  ? 'ขาขึ้น'
                  : snap.technical.trendVsEma200 === 'bearish'
                  ? 'ต่ำกว่าเส้น'
                  : '—'}
              </span>
            </div>
            <div className="p-2 rounded-lg bg-[#181C25]">
              <span className="text-[#9AA4B2] block font-sans">VIX / Fear&amp;Greed</span>
              <span className="font-bold text-[#F4F6F8]">
                {snap.macro.vixPrice?.toFixed(1) ?? '—'} / {snap.macro.fearGreedScore ?? '—'}
              </span>
            </div>
          </div>
          {snap.news.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#9AA4B2]">
                ข่าวล่าสุดในระบบ
              </span>
              {snap.news.slice(0, 3).map((n, idx) => (
                <a
                  key={idx}
                  href={n.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start justify-between gap-2 p-2 rounded-lg bg-[#181C25] hover:bg-[#1E2430] text-[11px] transition-colors"
                >
                  <span className="line-clamp-2 text-slate-300">{n.headline}</span>
                  <ExternalLink className="w-3 h-3 text-[#9AA4B2] shrink-0 mt-0.5" />
                </a>
              ))}
            </div>
          )}
          {ai?.liveMarketContext && (
            <p className="text-xs text-slate-300 leading-relaxed pt-1">{ai.liveMarketContext}</p>
          )}
        </div>

        {/* Forward Outlook */}
        <div className="rounded-2xl bg-[#12151C] border border-white/[0.08] p-4 space-y-2.5">
          <div className="flex items-center gap-2 pb-2 border-b border-white/[0.06]">
            <Compass className="w-4 h-4 text-[#6D5EF7]" />
            <h5 className="text-xs font-bold text-[#F4F6F8]">ข้อมูลคาดการณ์ (Forward)</h5>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono tabular-nums">
            <div className="p-2 rounded-lg bg-[#181C25]">
              <span className="text-[#9AA4B2] block font-sans">เป้านักวิเคราะห์ Mean</span>
              <span className="font-bold text-[#F4F6F8]">
                {formatPrice(snap.forward.targetMean, currSym)}{' '}
                {snap.forward.upsidePercent !== null && (
                  <span
                    className={
                      snap.forward.upsidePercent >= 0 ? 'text-[#20C997]' : 'text-[#F05D73]'
                    }
                  >
                    ({formatSignedPct(snap.forward.upsidePercent)})
                  </span>
                )}
              </span>
            </div>
            <div className="p-2 rounded-lg bg-[#181C25]">
              <span className="text-[#9AA4B2] block font-sans">Trailing / Fwd P/E</span>
              <span className="font-bold text-[#F4F6F8]">
                {snap.forward.trailingPe ? `${snap.forward.trailingPe}x` : '—'} /{' '}
                {snap.forward.forwardPe ? `${snap.forward.forwardPe}x` : '—'}
              </span>
            </div>
            <div className="p-2 rounded-lg bg-[#181C25]">
              <span className="text-[#9AA4B2] block font-sans">กำหนดการงบ</span>
              <span className="font-bold text-[#F4F6F8] font-sans">
                {snap.forward.earningsLabel || 'ไม่มีกำหนดการ'}
              </span>
            </div>
            <div className="p-2 rounded-lg bg-[#181C25]">
              <span className="text-[#9AA4B2] block font-sans">คาดการณ์ XD ถัดไป</span>
              <span className="font-bold text-[#F4F6F8] font-sans">
                {snap.forward.nextXdDate
                  ? `${snap.forward.nextXdDate} (~${snap.forward.nextXdDays} วัน)`
                  : 'ไม่มีปันผล'}
              </span>
            </div>
          </div>
          {ai?.forwardOutlook && (
            <p className="text-xs text-slate-300 leading-relaxed pt-1">{ai.forwardOutlook}</p>
          )}
        </div>
      </section>

      {/* AI 3 SCENARIOS (if generated) */}
      {ai && (
        <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-2xl bg-[#12151C] border border-[#20C997]/25 p-4 space-y-1.5">
            <span className="text-[11px] font-bold text-[#20C997] uppercase">Bull Case</span>
            <p className="text-xs text-slate-300 leading-relaxed">{ai.scenarios.bull}</p>
          </div>
          <div className="rounded-2xl bg-[#12151C] border border-white/[0.1] p-4 space-y-1.5">
            <span className="text-[11px] font-bold text-[#F4F6F8] uppercase">Base Case</span>
            <p className="text-xs text-slate-300 leading-relaxed">{ai.scenarios.base}</p>
          </div>
          <div className="rounded-2xl bg-[#12151C] border border-[#F05D73]/25 p-4 space-y-1.5">
            <span className="text-[11px] font-bold text-[#F05D73] uppercase">Bear Case</span>
            <p className="text-xs text-slate-300 leading-relaxed">{ai.scenarios.bear}</p>
          </div>
        </section>
      )}

      {/* 4. ACTIONABLE PRICE ZONES & AI EXECUTION PLAN */}
      <section className="rounded-2xl bg-[#12151C] border border-white/[0.08] p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-[#6D5EF7]" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#F4F6F8]">
              โซนราคาปฏิบัติการวันนี้ (อิงแนวรับ-แนวต้านจริง)
            </h4>
          </div>
          {quant.priceZones.avgCost && quant.priceZones.breakevenGainPct !== null && (
            <span className="text-xs font-mono text-[#9AA4B2]">
              ต้นทุนพอร์ต:{' '}
              <strong className="text-[#F4F6F8]">
                {formatPrice(quant.priceZones.avgCost, currSym)}
              </strong>{' '}
              (
              {quant.priceZones.breakevenGainPct > 0
                ? `ต้องขึ้น +${quant.priceZones.breakevenGainPct.toFixed(1)}% เพื่อเท่าทุน`
                : `สูงกว่าทุน ${Math.abs(quant.priceZones.breakevenGainPct).toFixed(1)}%`}
              )
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono tabular-nums">
          <div className="rounded-xl bg-[#181C25] border border-[#20C997]/25 p-3">
            <span className="text-[10px] font-sans text-[#20C997] font-semibold block">
              แนวรับ S2 (ไม้ช้อนลึก)
            </span>
            <p className="text-base font-bold text-[#F4F6F8] mt-1">
              {formatPrice(quant.priceZones.support2, currSym)}
            </p>
            <span className="text-[11px] text-[#9AA4B2]">
              {formatSignedPct(quant.priceZones.distToS2Pct)} จากปัจจุบัน
            </span>
          </div>

          <div className="rounded-xl bg-[#181C25] border border-[#20C997]/35 p-3">
            <span className="text-[10px] font-sans text-[#20C997] font-semibold block">
              แนวรับ S1 (จุดรอรับหลัก)
            </span>
            <p className="text-base font-bold text-[#F4F6F8] mt-1">
              {formatPrice(quant.priceZones.support1, currSym)}
            </p>
            <span className="text-[11px] text-[#9AA4B2]">
              {formatSignedPct(quant.priceZones.distToS1Pct)} จากปัจจุบัน
            </span>
          </div>

          <div className="rounded-xl bg-[#181C25] border border-white/[0.14] p-3">
            <span className="text-[10px] font-sans text-[#9AA4B2] font-semibold block">
              ราคาล่าสุด (Current)
            </span>
            <p className="text-base font-bold text-[#F4F6F8] mt-1">
              {formatPrice(quant.priceZones.currentPrice, currSym)}
            </p>
            <span className="text-[11px] text-[#9AA4B2]">
              EMA200: {formatPrice(quant.priceZones.ema200, currSym)}
            </span>
          </div>

          <div className="rounded-xl bg-[#181C25] border border-[#F05D73]/25 p-3">
            <span className="text-[10px] font-sans text-[#F05D73] font-semibold block">
              แนวต้าน R1 / R2
            </span>
            <p className="text-base font-bold text-[#F4F6F8] mt-1">
              {formatPrice(quant.priceZones.resistance1, currSym)}
            </p>
            <span className="text-[11px] text-[#9AA4B2]">
              R2: {formatPrice(quant.priceZones.resistance2, currSym)} (
              {formatSignedPct(quant.priceZones.distToR1Pct)})
            </span>
          </div>
        </div>

        {ai && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            <div className="p-3 rounded-xl bg-[#181C25] border border-white/[0.06] space-y-1">
              <span className="text-[11px] font-bold text-[#20C997]">แผนเข้าซื้อ / ถัวเฉลี่ย</span>
              <p className="text-xs text-slate-300 leading-relaxed">{ai.actionPlan.entryPlan}</p>
            </div>
            <div className="p-3 rounded-xl bg-[#181C25] border border-white/[0.06] space-y-1">
              <span className="text-[11px] font-bold text-[#F2B84B]">แผนแบ่งขาย / ทำกำไร</span>
              <p className="text-xs text-slate-300 leading-relaxed">
                {ai.actionPlan.exitOrTrimPlan}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-[#181C25] border border-white/[0.06] space-y-1">
              <span className="text-[11px] font-bold text-[#6D5EF7]">การคุมความเสี่ยงพอร์ต</span>
              <p className="text-xs text-slate-300 leading-relaxed">
                {ai.actionPlan.riskControlPlan}
              </p>
            </div>
          </div>
        )}
      </section>

      {/* 5. INTERACTIVE DCA & POSITION SIMULATOR */}
      <section className="rounded-2xl bg-[#12151C] border border-white/[0.08] p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Calculator className="w-4 h-4 text-[#20C997]" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#F4F6F8]">
              จำลองการซื้อเพิ่ม / ถัวเฉลี่ยเฉพาะพอร์ตคุณ (DCA Simulator)
            </h4>
          </div>
          {snap.position ? (
            <span className="text-xs font-mono text-[#9AA4B2]">
              ถืออยู่ {snap.position.shares} หุ้น • ทุน {formatPrice(snap.position.avgCost, currSym)}
            </span>
          ) : (
            <span className="text-xs text-[#9AA4B2]">จำลองการเปิดสถานะไม้แรก</span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs text-[#9AA4B2] block">
              งบที่จะลงทุนเพิ่ม ({currSym})
            </label>
            <div className="flex flex-wrap items-center gap-1.5">
              {quickAmounts.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setBudgetAmount(amt)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold cursor-pointer ${
                    budgetAmount === amt
                      ? 'bg-[#6D5EF7] text-white'
                      : 'bg-[#181C25] text-[#9AA4B2] hover:text-white border border-white/[0.08]'
                  }`}
                >
                  +{currSym}
                  {amt.toLocaleString()}
                </button>
              ))}
              <input
                type="number"
                min={0}
                value={budgetAmount}
                onChange={(e) => setBudgetAmount(Math.max(0, Number(e.target.value) || 0))}
                aria-label="งบลงทุนเพิ่ม"
                className="w-24 px-2.5 py-1 rounded-lg bg-[#090B10] border border-white/[0.12] text-xs font-mono text-[#F4F6F8] focus:outline-none focus:border-[#6D5EF7]"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-[#9AA4B2] block">ราคาเข้าซื้อที่จำลอง</label>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setEntryMode('current')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                  entryMode === 'current'
                    ? 'bg-[#6D5EF7] text-white'
                    : 'bg-[#181C25] text-[#9AA4B2] hover:text-white border border-white/[0.08]'
                }`}
              >
                ปัจจุบัน ({formatPrice(quant.priceZones.currentPrice, currSym)})
              </button>
              {quant.priceZones.support1 && (
                <button
                  type="button"
                  onClick={() => setEntryMode('s1')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                    entryMode === 's1'
                      ? 'bg-[#6D5EF7] text-white'
                      : 'bg-[#181C25] text-[#9AA4B2] hover:text-white border border-white/[0.08]'
                  }`}
                >
                  S1 ({formatPrice(quant.priceZones.support1, currSym)})
                </button>
              )}
              {quant.priceZones.support2 && (
                <button
                  type="button"
                  onClick={() => setEntryMode('s2')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                    entryMode === 's2'
                      ? 'bg-[#6D5EF7] text-white'
                      : 'bg-[#181C25] text-[#9AA4B2] hover:text-white border border-white/[0.08]'
                  }`}
                >
                  S2 ({formatPrice(quant.priceZones.support2, currSym)})
                </button>
              )}
              <button
                type="button"
                onClick={() => setEntryMode('custom')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                  entryMode === 'custom'
                    ? 'bg-[#6D5EF7] text-white'
                    : 'bg-[#181C25] text-[#9AA4B2] hover:text-white border border-white/[0.08]'
                }`}
              >
                กำหนดเอง
              </button>
              {entryMode === 'custom' && (
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder={String(quant.priceZones.currentPrice)}
                  value={customEntryPrice}
                  onChange={(e) => setCustomEntryPrice(e.target.value)}
                  className="w-24 px-2.5 py-1 rounded-lg bg-[#090B10] border border-white/[0.12] text-xs font-mono text-[#F4F6F8] focus:outline-none focus:border-[#6D5EF7]"
                />
              )}
            </div>
          </div>
        </div>

        {dcaSim && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono tabular-nums">
            <div className="p-3 rounded-xl bg-[#181C25] border border-white/[0.06]">
              <span className="text-[10px] font-sans text-[#9AA4B2] block">ได้หุ้นเพิ่ม / รวม</span>
              <p className="text-sm font-bold text-[#F4F6F8] mt-0.5">
                +{dcaSim.addedShares.toFixed(4)}
              </p>
              <span className="text-[11px] text-[#9AA4B2]">
                รวม {dcaSim.newTotalShares.toFixed(4)} หุ้น
              </span>
            </div>

            <div className="p-3 rounded-xl bg-[#181C25] border border-white/[0.06]">
              <span className="text-[10px] font-sans text-[#9AA4B2] block">ต้นทุนเฉลี่ยใหม่</span>
              <p className="text-sm font-bold text-[#F4F6F8] mt-0.5">
                {formatPrice(dcaSim.newAvgCost, currSym)}
              </p>
              <span
                className={`text-[11px] ${
                  dcaSim.avgCostReductionPct < 0 ? 'text-[#20C997]' : 'text-[#9AA4B2]'
                }`}
              >
                {dcaSim.avgCostReductionPct !== 0
                  ? `${dcaSim.avgCostReductionPct.toFixed(2)}% จากทุนเดิม`
                  : 'ทุนเริ่มต้นใหม่'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-[#181C25] border border-white/[0.06]">
              <span className="text-[10px] font-sans text-[#9AA4B2] block">
                ระยะกลับไปเท่าทุน
              </span>
              <p className="text-sm font-bold text-[#20C997] mt-0.5">
                {dcaSim.newBreakevenPct !== null ? formatSignedPct(dcaSim.newBreakevenPct) : '—'}
              </p>
              <span className="text-[11px] text-[#9AA4B2]">
                เดิม {dcaSim.currentBreakevenPct !== null ? formatSignedPct(dcaSim.currentBreakevenPct) : '—'}
              </span>
            </div>

            <div
              className={`p-3 rounded-xl bg-[#181C25] border ${
                dcaSim.exceedsRiskCap ? 'border-[#F05D73]/40' : 'border-white/[0.06]'
              }`}
            >
              <span className="text-[10px] font-sans text-[#9AA4B2] block">
                น้ำหนักใหม่ · {positionLimit?.basis === 'totalPortfolio' ? 'พอร์ตรวมเงินสด' : 'สินทรัพย์ลงทุน'}
              </span>
              <p
                className={`text-sm font-bold mt-0.5 ${
                  dcaSim.exceedsRiskCap ? 'text-[#F05D73]' : 'text-[#F4F6F8]'
                }`}
              >
                {dcaSim.newPortfolioWeightPct !== null
                  ? `${dcaSim.newPortfolioWeightPct.toFixed(1)}%`
                  : '—'}
              </p>
              <span className="text-[11px] font-sans text-[#9AA4B2]">
                {dcaSim.exceedsRiskCap
                  ? `เกินเพดาน ${positionLimit?.percent ?? snap.position?.maxSinglePositionPct ?? 20}%!`
                  : `เพดาน ≤ ${positionLimit?.percent ?? snap.position?.maxSinglePositionPct ?? 20}%`}
              </span>
            </div>
          </div>
        )}
      </section>

      {/* 6. DAILY ACTION CHECKLIST */}
      {checklist.length > 0 && (
        <section className="rounded-2xl bg-[#12151C] border border-white/[0.08] p-4 sm:p-5 space-y-2.5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#F4F6F8]">
            เช็กลิสต์ก่อนตัดสินใจวันนี้ (Daily Action Checklist)
          </h4>
          <div className="space-y-2">
            {checklist.map((item, idx) => {
              const checked = Boolean(checkedItems[idx])
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() =>
                    setCheckedItems((prev) => ({ ...prev, [idx]: !prev[idx] }))
                  }
                  className={`w-full flex items-start gap-2.5 p-2.5 rounded-xl border text-left text-xs transition-colors cursor-pointer ${
                    checked
                      ? 'bg-[#20C997]/10 border-[#20C997]/25 text-slate-400 line-through'
                      : 'bg-[#181C25] border-white/[0.06] text-slate-200 hover:border-white/[0.14]'
                  }`}
                >
                  {checked ? (
                    <CheckSquare className="w-4 h-4 text-[#20C997] shrink-0 mt-0.5" />
                  ) : (
                    <Square className="w-4 h-4 text-[#9AA4B2] shrink-0 mt-0.5" />
                  )}
                  <span>{item}</span>
                </button>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
