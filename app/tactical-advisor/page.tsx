'use client'

import { AdvisorPlanPanel } from '@/components/advisor/AdvisorPlanPanel'

import React, { useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { AppShell } from '@/components/AppShell'
import { FormattedCopilotMessage } from '@/components/FormattedCopilotMessage'
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
  Zap,
  BarChart3,
  Scale,
  DollarSign,
  Bot,
} from 'lucide-react'
import type { TacticalAdvisorPayload, TacticalActionItem } from '@/lib/ai/tactical-analysis'
import type { GroundingSource } from '@/lib/ai/gemini-client'

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

function formatNumber(val: number | null | undefined, decimals = 2, fallback = '0.00'): string {
  if (val === null || val === undefined || isNaN(Number(val))) return fallback
  return Number(val).toFixed(decimals)
}

function formatInt(val: number | null | undefined, fallback = '0'): string {
  if (val === null || val === undefined || isNaN(Number(val))) return fallback
  return Math.round(Number(val)).toLocaleString()
}

function formatLocale(val: number | null | undefined, decimals = 2, fallback = '0.00'): string {
  if (val === null || val === undefined || isNaN(Number(val))) return fallback
  return Number(val).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

export default function TacticalAdvisorPage() {
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState<string | null>(null)
  const [selectedActionFilter, setSelectedActionFilter] = useState<'ALL' | 'ACCUMULATE' | 'HOLD_WATCH' | 'TRIM_PROFIT'>('ALL')
  const [selectedStock, setSelectedStock] = useState<{ symbol: string; market: string } | null>(null)

  // Copilot Chat State
  const [chatQuestion, setChatQuestion] = useState('')
  const [isChatLoading, setIsChatLoading] = useState(false)
  const [chatAnswer, setChatAnswer] = useState<string | null>(null)
  const [chatSources, setChatSources] = useState<GroundingSource[]>([])

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
      setRefreshError(null)
      setSelectedDate(null)
      const res = await fetch('/api/tactical-advisor?refresh=true', { method: 'GET' })
      const json = await res.json()
      if (res.ok) {
        mutate(json, false)
      } else setRefreshError(json.error || 'วิเคราะห์ตลาดไม่สำเร็จ')
    } catch (err) {
      console.error('Failed to refresh tactical advisor', err)
      setRefreshError('เชื่อมต่อเพื่อวิเคราะห์ตลาดไม่สำเร็จ')
    } finally {
      setIsRefreshing(false)
    }
  }

  // Handle Copilot Chat Submission
  const handleAskQuestion = async (qText?: string) => {
    const questionToSend = qText || chatQuestion
    if (!questionToSend.trim() || isChatLoading) return

    try {
      setIsChatLoading(true)
      setChatAnswer(null)
      setChatSources([])
      const res = await fetch('/api/tactical-advisor/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: questionToSend,
        }),
      })

      if (res.ok) {
        const json = await res.json()
        setChatAnswer(json.answer)
        setChatSources(json.groundingSources || [])
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
        <AdvisorPlanPanel />
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

        {(refreshError || (error && !payload)) && (
          <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-center space-y-2">
            <AlertTriangle className="w-6 h-6 text-rose-400 mx-auto" />
            <p className="text-sm font-bold text-rose-200">{refreshError || error?.message || 'ไม่สามารถโหลดข้อมูล Tactical Advisor ได้'}</p>
            <Link href="/ai-advisor" className="text-sm text-indigo-300 underline">เปิด Wealth Copilot</Link>
          </div>
        )}

        {payload && !payload.marketEvidence && (
          <p className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm text-amber-200">
            รายงานย้อนหลังฉบับนี้ไม่มีหลักฐานเวลาราคา จึงไม่แสดงตัวเลขตลาดและแผนจากรายงานฉบับนี้
          </p>
        )}
        {payload?.marketEvidence && (
          <div className="space-y-6">
            {/* ── TOP SECTION: CARD 1 MARKET CLIMATE ENGINE (4 PILLARS & FORMULA) ── */}
            {(() => {
              const pillars = payload.marketRegime?.pillars || {
                sentiment: {
                  fearGreedScore: payload.marketRegime.fearGreedScore ?? 39,
                  fearGreedRating: 'fear',
                  fearGreedLabelTh: payload.marketRegime.fearGreedLabel ?? 'ตลาดกังวล (Fear)',
                  fearGreed1WDiff: -3,
                  previous1WeekScore: 42,
                  vixValue: 19.3,
                  vixStatus: 'NORMAL' as const,
                  vixStatusLabel: '<20 สภาวะปกติ / เสถียรภาพสูง',
                  summary: 'อารมณ์ตลาดอยู่ในแดนกังวลสะท้อนความผันผวนระยะสั้น',
                },
                momentum: {
                  spxPrice: 7561.67,
                  spxChangePercent: -0.42,
                  spxFiftyTwoHigh: 7844.52,
                  spxDrawdownPercent: -3.61,
                  spxEmaStatus: 'พักฐานทดสอบแนวรับ EMA 50 วัน / ยังยืนเหนือ EMA 200 วัน',
                  nasdaqPrice: 25136.27,
                  nasdaqChangePercent: -0.84,
                  nasdaqFiftyTwoHigh: 27722.75,
                  nasdaqDrawdownPercent: -9.33,
                  nasdaqEmaStatus: 'หุ้นกลุ่มเทคโนโลยีย่อตัวลงทดสอบแนวรับสำคัญหลังทำ All-Time High',
                  breadthStatus: 'หุ้นใหญ่ประคองดัชนี ขณะที่หุ้นกลาง-เล็กเผชิญแรงขายปรับฐาน (Mega-cap Divergence)',
                  summary: 'ดัชนีหลักย่อตัวจากจุดสูงสุด (% Drawdown) อยู่ในโซนปรับฐานปกติ ยังไม่เสียโครงสร้างใหญ่',
                },
                macroLiquidity: {
                  us10yYield: 4.42,
                  yieldPressureLevel: 'HIGH' as const,
                  yieldPressureLabel: '>4.40% แรงกดดันสูง (High Pressure)',
                  fedPolicyStance: 'คาดการณ์ Fed คงอัตราดอกเบี้ยระดับสูง ชะลอการปรับลดดอกเบี้ยนโยบาย',
                  inflationExpectation: 'ตัวเลขเงินเฟ้อ CPI/PCE ทรงตัวหนืด กดดันต้นทุนทางการเงินในระยะยาว',
                  summary: 'Bond Yield สหรัฐฯ ทรงตัวสูง เป็นอุปสรรคต่อ Valuation และทวีความผันผวนต่อหุ้น Growth',
                },
                catalystsAndFlows: {
                  safeHavenFlow: 'DEFENSIVE_ROTATION' as const,
                  safeHavenFlowLabel: 'กระจายเข้าสินทรัพย์ปลอดภัย (Safe-Haven Rotation)',
                  goldPrice: 3886.3,
                  goldChangePercent: 0.45,
                  dxyPrice: 103.41,
                  oilPrice: 88.56,
                  keyCatalysts: payload.marketRegime.macroDrivers || [],
                  summary: 'มีแรงซื้อเข้าหาสินทรัพย์ปลอดภัย เช่น ทองคำและดอลลาร์สหรัฐฯ เพื่อลดความเสี่ยง',
                },
                formula: {
                  calculatedRiskScore: payload.marketRegime.riskLevel ?? 4,
                  calculatedRiskLabel: payload.marketRegime.riskLevelLabel ?? 'ความเสี่ยงระดับสูง',
                  posture: ((payload.marketRegime.riskLevel ?? 4) <= 2
                    ? 'BULL_AGGRESSIVE'
                    : (payload.marketRegime.riskLevel ?? 4) >= 5
                    ? 'CASH_PRESERVATION'
                    : 'DEFENSIVE_TACTICAL') as any,
                  postureLabelTh:
                    (payload.marketRegime.riskLevel ?? 4) <= 2
                      ? '🚀 บุกสะสมเชิงรุก (Aggressive Accumulation)'
                      : (payload.marketRegime.riskLevel ?? 4) >= 5
                      ? '🔴 ถือเงินสดหลบภัย (Capital Preservation)'
                      : '🛡️ ตั้งรับรอจังหวะ (Defensive Tactical)',
                  postureSubtitleTh: 'แบ่งไม้ทยอยสะสมเฉพาะหุ้นพื้นฐานแกร่งที่ลงมาแนวรับสำคัญ ไม่ไล่ราคา',
                  formulaEquation:
                    'ดัชนีย่อตัว (SPX Drawdown -3.6%) + อารมณ์กังวล (Fear 39) + Bond Yield สูง ➔ เสี่ยงระดับ 4/5 (ตั้งรับรอจังหวะ)',
                  greenlightTrigger:
                    'VIX ลดต่ำกว่า 20 หรือ Fear & Greed ดิ่งแตะโซน Extreme Fear (<25) ร่วมกับ S&P 500 ยืนเหนือแนวรับ EMA 200 วัน',
                  redflagTrigger:
                    'US 10Y Yield ดีดทะลุ 4.60% หรือ VIX พุ่งทะลุ 30 จุด (ต้องหยุดช้อนซื้อและถือเงินสดอย่างเข้มงวด)',
                },
              }

              const posture = pillars.formula?.posture || 'DEFENSIVE_TACTICAL'
              const postureStyle =
                posture === 'BULL_AGGRESSIVE'
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-emerald-500/10'
                  : posture === 'CASH_PRESERVATION'
                  ? 'bg-rose-500/15 border-rose-500/40 text-rose-300 shadow-rose-500/10'
                  : 'bg-amber-500/15 border-amber-500/40 text-amber-300 shadow-amber-500/10'

              const riskScore = pillars.formula?.calculatedRiskScore || payload.marketRegime.riskLevel || 4
              const riskLabel = pillars.formula?.calculatedRiskLabel || payload.marketRegime.riskLevelLabel || 'ความเสี่ยงระดับสูง'

              return (
                <div className="p-5 sm:p-7 rounded-3xl bg-gradient-to-br from-[#121624] via-[#101420] to-[#0A0D15] border border-white/[0.09] shadow-2xl space-y-6 relative overflow-hidden">
                  {/* Subtle Background Glows */}
                  <div className="absolute -top-24 -right-24 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
                  <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

                  {/* Header Row: Title & Posture Badge */}
                  <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-white/[0.06]">
                    <div className="space-y-1.5 max-w-2xl">
                      <div className="flex items-center gap-2">
                        <span className="p-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400">
                          <Compass className="w-5 h-5" />
                        </span>
                        <h2 className="text-lg sm:text-xl font-bold text-white tracking-wide flex items-center gap-2">
                          <span>1. สภาวะตลาดห้วงเวลานี้ (MARKET CLIMATE)</span>
                          <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-semibold hidden sm:inline">
                            4 เสาหลักประมวลผล
                          </span>
                        </h2>
                      </div>
                      <p className="text-sm sm:text-base text-slate-200 leading-relaxed font-medium">
                        {payload.marketRegime.summaryTh}
                      </p>
                    </div>

                    {/* Posture & Risk Level Meter */}
                    <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end gap-3 shrink-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 font-medium">กลยุทธ์ภาพรวม:</span>
                        <div className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold border shadow-lg flex items-center gap-2 ${postureStyle}`}>
                          <span>{pillars.formula.postureLabelTh}</span>
                        </div>
                      </div>

                      {/* 5-Level Visual Risk Bar */}
                      <div className="flex items-center gap-2 text-xs text-slate-300">
                        <span>ระดับความเสี่ยง:</span>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((lvl) => {
                            const isFilled = lvl <= riskScore
                            let colorClass = 'bg-white/[0.08]'
                            if (isFilled) {
                              if (lvl <= 2) colorClass = 'bg-emerald-500'
                              else if (lvl === 3) colorClass = 'bg-amber-400'
                              else if (lvl === 4) colorClass = 'bg-orange-500'
                              else colorClass = 'bg-rose-500'
                            }
                            return (
                              <div
                                key={lvl}
                                className={`h-2.5 w-4 sm:w-5 rounded-sm transition-all ${colorClass}`}
                                title={`ระดับความเสี่ยง ${lvl}/5`}
                              />
                            )
                          })}
                        </div>
                        <span className="font-mono font-bold text-amber-300 text-xs sm:text-sm">
                          {riskScore}/5 ({riskLabel})
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Formula Breakdown Banner */}
                  <div className="p-3.5 sm:p-4 rounded-2xl bg-indigo-950/20 border border-indigo-500/20 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs sm:text-sm">
                    <div className="flex items-start sm:items-center gap-2 text-indigo-200">
                      <Zap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
                      <span>
                        <strong className="text-white">💡 สูตรลัดสรุปผล (Market Climate Formula):</strong>{' '}
                        <span className="text-slate-200 font-mono text-xs sm:text-[13px]">{pillars.formula.formulaEquation}</span>
                      </span>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-white/[0.05] text-slate-300 shrink-0 self-start md:self-auto border border-white/[0.06]">
                      {pillars.formula.postureSubtitleTh}
                    </span>
                  </div>

                  {/* ── THE 4 PILLARS GRID ── */}
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5">
                    {/* เสาที่ 1: Sentiment & Volatility */}
                    <div className="p-4 sm:p-5 rounded-2xl bg-[#0B0E17]/80 border border-white/[0.06] flex flex-col justify-between space-y-4 hover:border-white/[0.12] transition-colors">
                      <div className="space-y-3.5">
                        {/* Clean Stacked Header */}
                        <div className="flex items-center gap-2.5 pb-2 border-b border-white/[0.04]">
                          <div className="p-1.5 rounded-lg bg-rose-500/15 text-rose-400 shrink-0">
                            <Flame className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="text-xs sm:text-sm font-bold text-rose-300">
                              เสาที่ 1: อารมณ์ & ความกลัว
                            </h4>
                            <span className="text-[11px] text-slate-400 font-mono block">
                              Sentiment & Volatility
                            </span>
                          </div>
                        </div>

                        {/* CNN Fear & Greed */}
                        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] space-y-2">
                          <div className="flex items-center justify-between text-xs text-slate-300">
                            <span>CNN Fear & Greed:</span>
                            <span className="font-mono font-bold text-base sm:text-lg text-white">
                              {pillars.sentiment.fearGreedScore >= 0 ? `${pillars.sentiment.fearGreedScore}/100` : '—'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2 text-[11px] flex-wrap">
                            <span className="px-2 py-0.5 rounded-md bg-white/[0.06] text-slate-200 font-medium">
                              {pillars.sentiment.fearGreedLabelTh}
                            </span>
                            <span
                              className={`font-semibold whitespace-nowrap ${
                                pillars.sentiment.fearGreed1WDiff < 0
                                  ? 'text-rose-400'
                                  : pillars.sentiment.fearGreed1WDiff > 0
                                  ? 'text-emerald-400'
                                  : 'text-slate-400'
                              }`}
                            >
                              {pillars.sentiment.previous1WeekScore < 0 ? 'ไม่มีข้อมูลย้อนหลัง' : pillars.sentiment.fearGreed1WDiff < 0
                                ? `⭣ ลดลง ${Math.abs(pillars.sentiment.fearGreed1WDiff)} pts vs วีคก่อน`
                                : pillars.sentiment.fearGreed1WDiff > 0
                                ? `⭡ เพิ่มขึ้น ${pillars.sentiment.fearGreed1WDiff} pts vs วีคก่อน`
                                : 'เท่ากับสัปดาห์ก่อน'}
                            </span>
                          </div>
                        </div>

                        {/* VIX Volatility Index */}
                        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] space-y-2">
                          <div className="flex items-center justify-between text-xs text-slate-300">
                            <span>VIX Index (ความผันผวน):</span>
                            <span className="font-mono font-bold text-base sm:text-lg text-white">
                              {formatNumber(pillars.sentiment?.vixValue)} pts
                            </span>
                          </div>
                          <div className="space-y-1.5 pt-1 border-t border-white/[0.04]">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span
                                className={`px-2 py-0.5 rounded-md font-medium text-xs border ${
                                  pillars.sentiment.vixStatus === 'NORMAL'
                                    ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                                    : pillars.sentiment.vixStatus === 'ELEVATED'
                                    ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                                    : 'bg-rose-500/10 text-rose-300 border-rose-500/20'
                                }`}
                              >
                                {pillars.sentiment.vixStatusLabel}
                              </span>
                              <span className="text-slate-400 text-[10px] font-mono">
                                เกณฑ์: &lt;20 ปกติ | &gt;30 Panic
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <p className="text-xs text-slate-300 leading-relaxed font-normal pt-2 border-t border-white/[0.04]">
                        {pillars.sentiment.summary}
                      </p>
                    </div>

                    {/* เสาที่ 2: Market Trend & Breadth */}
                    <div className="p-4 sm:p-5 rounded-2xl bg-[#0B0E17]/80 border border-white/[0.06] flex flex-col justify-between space-y-4 hover:border-white/[0.12] transition-colors">
                      <div className="space-y-3.5">
                        {/* Clean Stacked Header */}
                        <div className="flex items-center gap-2.5 pb-2 border-b border-white/[0.04]">
                          <div className="p-1.5 rounded-lg bg-sky-500/15 text-sky-400 shrink-0">
                            <BarChart3 className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="text-xs sm:text-sm font-bold text-sky-300">
                              เสาที่ 2: โมเมนตัม & แนวโน้ม
                            </h4>
                            <span className="text-[11px] text-slate-400 font-mono block">
                              Trend & Breadth
                            </span>
                          </div>
                        </div>

                        {/* S&P 500 */}
                        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] space-y-1.5">
                          <div className="flex items-center justify-between text-xs gap-2">
                            <span className="text-slate-300 shrink-0">S&P 500:</span>
                            <div className="flex items-center gap-1.5 whitespace-nowrap">
                              <span className="font-mono font-bold text-white text-xs sm:text-sm">
                                {formatLocale(pillars.momentum?.spxPrice, 2, '0.00')} pts
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[11px] font-mono font-semibold whitespace-nowrap ${
                                  (pillars.momentum?.spxChangePercent ?? 0) >= 0
                                    ? 'bg-emerald-500/15 text-emerald-300'
                                    : 'bg-rose-500/15 text-rose-300'
                                }`}
                              >
                                {(pillars.momentum?.spxChangePercent ?? 0) >= 0 ? '+' : ''}
                                {formatNumber(pillars.momentum?.spxChangePercent)}%
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-[11px] pt-1 border-t border-white/[0.04]">
                            <span className="text-slate-400">Drawdown จากจุดสูงสุด:</span>
                            <span className="font-mono font-bold text-rose-300">
                              {formatNumber(pillars.momentum?.spxDrawdownPercent)}%
                            </span>
                          </div>
                        </div>

                        {/* NASDAQ */}
                        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] space-y-1.5">
                          <div className="flex items-center justify-between text-xs gap-2">
                            <span className="text-slate-300 shrink-0">NASDAQ (Tech):</span>
                            <div className="flex items-center gap-1.5 whitespace-nowrap">
                              <span className="font-mono font-bold text-white text-xs sm:text-sm">
                                {formatLocale(pillars.momentum?.nasdaqPrice, 2, '0.00')} pts
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[11px] font-mono font-semibold whitespace-nowrap ${
                                  (pillars.momentum?.nasdaqChangePercent ?? 0) >= 0
                                    ? 'bg-emerald-500/15 text-emerald-300'
                                    : 'bg-rose-500/15 text-rose-300'
                                }`}
                              >
                                {(pillars.momentum?.nasdaqChangePercent ?? 0) >= 0 ? '+' : ''}
                                {formatNumber(pillars.momentum?.nasdaqChangePercent)}%
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-[11px] pt-1 border-t border-white/[0.04]">
                            <span className="text-slate-400">Drawdown จากจุดสูงสุด:</span>
                            <span className="font-mono font-bold text-rose-300">
                              {formatNumber(pillars.momentum?.nasdaqDrawdownPercent)}%
                            </span>
                          </div>
                        </div>

                        {/* Breadth & EMA: FULL TEXT (NO TRUNCATE) */}
                        <div className="text-xs text-slate-200 space-y-2 pt-0.5">
                          <div className="flex items-start gap-2">
                            <span className="text-sky-400 font-bold shrink-0 mt-0.5">•</span>
                            <span className="leading-relaxed">
                              <strong className="text-white font-medium">Breadth:</strong> {pillars.momentum.breadthStatus}
                            </span>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-sky-400 font-bold shrink-0 mt-0.5">•</span>
                            <span className="leading-relaxed">
                              <strong className="text-white font-medium">เส้น EMA:</strong> {pillars.momentum.spxEmaStatus}
                            </span>
                          </div>
                        </div>
                      </div>

                      <p className="text-xs text-slate-300 leading-relaxed font-normal pt-2 border-t border-white/[0.04]">
                        {pillars.momentum.summary}
                      </p>
                    </div>

                    {/* เสาที่ 3: Macro & Liquidity */}
                    <div className="p-4 sm:p-5 rounded-2xl bg-[#0B0E17]/80 border border-white/[0.06] flex flex-col justify-between space-y-4 hover:border-white/[0.12] transition-colors">
                      <div className="space-y-3.5">
                        {/* Clean Stacked Header */}
                        <div className="flex items-center gap-2.5 pb-2 border-b border-white/[0.04]">
                          <div className="p-1.5 rounded-lg bg-purple-500/15 text-purple-400 shrink-0">
                            <Scale className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="text-xs sm:text-sm font-bold text-purple-300">
                              เสาที่ 3: ต้นทุนการเงิน & Macro
                            </h4>
                            <span className="text-[11px] text-slate-400 font-mono block">
                              Macro & Rates
                            </span>
                          </div>
                        </div>

                        {/* US 10Y Yield */}
                        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] space-y-2">
                          <div className="flex items-center justify-between text-xs text-slate-300">
                            <span>US 10Y Bond Yield:</span>
                            <span className="font-mono font-bold text-base sm:text-lg text-white">
                              {formatNumber(pillars.macroLiquidity?.us10yYield)}%
                            </span>
                          </div>
                          <div className="text-[11px]">
                            <span
                              className={`px-2 py-0.5 rounded-md font-medium border inline-block ${
                                pillars.macroLiquidity.yieldPressureLevel === 'LOW'
                                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                                  : pillars.macroLiquidity.yieldPressureLevel === 'MODERATE'
                                  ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                                  : 'bg-rose-500/10 text-rose-300 border-rose-500/20'
                              }`}
                            >
                              {pillars.macroLiquidity.yieldPressureLabel}
                            </span>
                          </div>
                        </div>

                        {/* Fed Policy & CPI Expectations */}
                        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] space-y-2 text-xs">
                          <div className="text-slate-300 font-medium">ทิศทางดอกเบี้ย Fed & เงินเฟ้อ:</div>
                          <div className="text-xs text-slate-200 leading-relaxed space-y-1.5">
                            <div className="flex items-start gap-1.5">
                              <span className="text-purple-400 font-bold shrink-0 mt-0.5">•</span>
                              <span className="leading-relaxed">
                                <strong className="text-white font-medium">Fed:</strong> {pillars.macroLiquidity.fedPolicyStance}
                              </span>
                            </div>
                            <div className="flex items-start gap-1.5">
                              <span className="text-purple-400 font-bold shrink-0 mt-0.5">•</span>
                              <span className="leading-relaxed">
                                <strong className="text-white font-medium">CPI/PCE:</strong> {pillars.macroLiquidity.inflationExpectation}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <p className="text-xs text-slate-300 leading-relaxed font-normal pt-2 border-t border-white/[0.04]">
                        {pillars.macroLiquidity.summary}
                      </p>
                    </div>

                    {/* เสาที่ 4: Catalysts & Fund Flows */}
                    <div className="p-4 sm:p-5 rounded-2xl bg-[#0B0E17]/80 border border-white/[0.06] flex flex-col justify-between space-y-4 hover:border-white/[0.12] transition-colors">
                      <div className="space-y-3.5">
                        {/* Clean Stacked Header */}
                        <div className="flex items-center gap-2.5 pb-2 border-b border-white/[0.04]">
                          <div className="p-1.5 rounded-lg bg-amber-500/15 text-amber-400 shrink-0">
                            <Zap className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="text-xs sm:text-sm font-bold text-amber-300">
                              เสาที่ 4: ปัจจัยเร่ง & Fund Flows
                            </h4>
                            <span className="text-[11px] text-slate-400 font-mono block">
                              Flows & Events
                            </span>
                          </div>
                        </div>

                        {/* Safe-Haven Flow & Assets */}
                        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] space-y-2">
                          <div className="flex items-center justify-between text-xs gap-2">
                            <span className="text-slate-300 shrink-0">กระแสเงินทุน:</span>
                            <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/25 text-[11px] font-semibold text-right">
                              {pillars.catalystsAndFlows.safeHavenFlowLabel}
                            </span>
                          </div>
                          <div className="flex items-center justify-between pt-1.5 text-xs font-mono border-t border-white/[0.04] gap-2">
                            <div className="text-slate-300 whitespace-nowrap">
                              ทองคำ: <strong className="text-amber-200 font-bold">${formatLocale(pillars.catalystsAndFlows?.goldPrice, 1, '0.0')}</strong>
                            </div>
                            <div className="text-slate-300 whitespace-nowrap text-right">
                              DXY: <strong className="text-indigo-200 font-bold">{formatNumber(pillars.catalystsAndFlows?.dxyPrice)}</strong>
                            </div>
                          </div>
                        </div>

                        {/* 3 Key Catalysts: FULL TEXT (NO TRUNCATE) */}
                        <div className="space-y-2 pt-0.5">
                          <span className="text-xs font-bold text-slate-300 block">⚡ ข่าวใหญ่เฉพาะช่วง:</span>
                          <div className="space-y-2 text-xs text-slate-200 leading-relaxed">
                            {pillars.catalystsAndFlows.keyCatalysts.slice(0, 3).map((c, idx) => (
                              <div key={idx} className="flex items-start gap-2">
                                <span className="text-amber-400 font-bold shrink-0 mt-0.5">•</span>
                                <span className="leading-relaxed">{c}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <p className="text-xs text-slate-300 leading-relaxed font-normal pt-2 border-t border-white/[0.04]">
                        {pillars.catalystsAndFlows.summary}
                      </p>
                    </div>
                  </div>

                  {/* ── INFLECTION TRIGGERS ── */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                    {/* Greenlight Trigger */}
                    <div className="p-4 rounded-2xl bg-emerald-500/[0.05] border border-emerald-500/20 space-y-2">
                      <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs sm:text-sm">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>จุดปลดล็อกเข้าซื้อไม้ใหญ่ (Greenlight Trigger)</span>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-sans font-medium">
                        {pillars.formula.greenlightTrigger}
                      </p>
                    </div>

                    {/* Red Flag Trigger */}
                    <div className="p-4 rounded-2xl bg-rose-500/[0.05] border border-rose-500/20 space-y-2">
                      <div className="flex items-center gap-2 text-rose-400 font-bold text-xs sm:text-sm">
                        <ShieldAlert className="w-4 h-4 shrink-0" />
                        <span>จุดเตือนภัยขั้นสุด - ห้ามถัว (Red Flag Invalidation)</span>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-sans font-medium">
                        {pillars.formula.redflagTrigger}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* ── MIDDLE SECTION: 2 COLUMNS (PORTFOLIO RESILIENCE & CASH STRATEGY) ── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
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
                      {formatNumber(payload.cashStrategy?.currentCashPercent, 1)}%
                    </span>
                    <span className="text-slate-400 text-xs sm:text-sm ml-1.5 font-sans">
                      ({formatLocale(payload.cashStrategy?.currentCashTotalBase, 0, '0')}{' '}
                      {payload.cashStrategy?.baseCurrency || 'THB'})
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 3: Cash Deployment Strategy (6 Cols) */}
              <div className="lg:col-span-6 p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-[#121622] to-[#151A29] border border-white/[0.08] shadow-md space-y-4">
                <div className="flex items-center gap-2.5">
                  <Wallet className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-base font-bold text-white uppercase tracking-wider">
                    3. กลยุทธ์บริหารเงินสด (Cash Deployment Strategy)
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
            </div>

            {/* ── MIDDLE SECTION: TACTICAL ACTION CARDS ── */}
            <div className="p-5 sm:p-6 rounded-2xl bg-[#0F131D] border border-white/[0.08] shadow-md space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Target className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-base sm:text-lg font-bold text-white tracking-wide">
                    4. แผนวางหมากรายตัวสำหรับพอร์ตคุณ (Tactical Actions)
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
                                {item.currency}{formatNumber(item.currentPrice)}
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

            {/* ── CARD 5: TRACK RECORD REVIEW (ACCOUNTABILITY) ── */}
            <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-[#121622] to-[#151A29] border border-white/[0.08] shadow-md space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <History className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-base font-bold text-white uppercase tracking-wider">
                    5. การตรวจการบ้านคำแนะนำรอบก่อน (Track Record Review)
                  </h3>
                </div>
                <span className="text-xs text-slate-400 font-mono">Accountability</span>
              </div>

              {payload.outcomeMetrics && payload.outcomeMetrics.totalTrackedCalls > 0 && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06]">
                      <span className="text-[11px] text-slate-400 block">Win Rate จริง</span>
                      <span className="text-lg font-bold font-mono text-emerald-400">
                        {payload.outcomeMetrics.winRatePercent !== null
                          ? `${payload.outcomeMetrics.winRatePercent}%`
                          : 'รอประเมิน'}
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        ถูก {payload.outcomeMetrics.hits} / พลาด {payload.outcomeMetrics.misses}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06]">
                      <span className="text-[11px] text-slate-400 block">คำแนะนำที่ติดตามผล</span>
                      <span className="text-lg font-bold font-mono text-white">
                        {payload.outcomeMetrics.totalTrackedCalls}
                      </span>
                      <span className="text-[10px] text-slate-400 block">รายการย้อนหลัง (&gt;12 ชม.)</span>
                    </div>

                    <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06]">
                      <span className="text-[11px] text-slate-400 block">ผลตอบแทนเฉลี่ยฝั่งซื้อ</span>
                      <span
                        className={`text-lg font-bold font-mono ${
                          (payload.outcomeMetrics.avgAccumulateReturnPercent ?? 0) >= 0
                            ? 'text-emerald-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {payload.outcomeMetrics.avgAccumulateReturnPercent !== null
                          ? `${payload.outcomeMetrics.avgAccumulateReturnPercent >= 0 ? '+' : ''}${payload.outcomeMetrics.avgAccumulateReturnPercent}%`
                          : '—'}
                      </span>
                      <span className="text-[10px] text-slate-400 block">หลังแนะนำ ACCUMULATE</span>
                    </div>

                    <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06]">
                      <span className="text-[11px] text-slate-400 block">ความเสี่ยงที่หลบได้ฝั่งขาย</span>
                      <span
                        className={`text-lg font-bold font-mono ${
                          (payload.outcomeMetrics.avgTrimAvoidedDropPercent ?? 0) >= 0
                            ? 'text-cyan-300'
                            : 'text-amber-300'
                        }`}
                      >
                        {payload.outcomeMetrics.avgTrimAvoidedDropPercent !== null
                          ? `${payload.outcomeMetrics.avgTrimAvoidedDropPercent >= 0 ? '+' : ''}${payload.outcomeMetrics.avgTrimAvoidedDropPercent}%`
                          : '—'}
                      </span>
                      <span className="text-[10px] text-slate-400 block">หลังแนะนำ TRIM_PROFIT</span>
                    </div>
                  </div>

                  {payload.outcomeMetrics.recentCalls.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {payload.outcomeMetrics.recentCalls.slice(0, 8).map((c, cIdx) => (
                        <div
                          key={`${c.dateKey}-${c.ticker}-${cIdx}`}
                          className="px-2.5 py-1.5 rounded-lg bg-[#0A0D14] border border-white/[0.06] text-[11px] font-mono flex items-center gap-2"
                        >
                          <span className="font-bold text-white">{c.ticker}</span>
                          <span className="text-slate-400">
                            {c.currency}{c.recPrice} → {c.currency}{c.currentPrice}
                          </span>
                          <span className={c.returnPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                            {c.returnPercent >= 0 ? '+' : ''}
                            {c.returnPercent}%
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              c.verdict === 'HIT'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : c.verdict === 'MISS'
                                ? 'bg-rose-500/20 text-rose-300'
                                : 'bg-slate-700/60 text-slate-300'
                            }`}
                          >
                            {c.verdict}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {payload.trackRecordReview.length === 0 ? (
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04] text-xs sm:text-sm text-slate-400 text-center">
                  เป็นการวิเคราะห์รอบแรก ระบบจะเริ่มบันทึกและตรวจการบ้านในรอบถัดไป
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {payload.trackRecordReview.map((rec, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl bg-[#0A0D14] border border-white/[0.04] space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-indigo-300 text-xs sm:text-sm">{rec.period}</span>
                        <span
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                            rec.accuracyStatus === 'ACCURATE'
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                              : 'bg-slate-700/50 text-slate-300 border-slate-600'
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

            {/* ── CARD 6: COPILOT CHAT BOX ── */}
            <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-[#121622] via-[#141A28] to-[#121622] border border-indigo-500/25 shadow-lg space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-white/[0.06]">
                <div className="flex items-center gap-2.5">
                  <MessageSquare className="w-5 h-5 text-indigo-400" />
                  <div>
                    <h3 className="text-base font-bold text-white tracking-wide">
                      6. ถาม AI เจาะลึกเฉพาะกิจ (Tactical Copilot)
                    </h3>
                    <span className="text-xs text-slate-400">
                      {responseData?.isHistorical
                        ? 'แชตนี้ใช้ข้อมูลล่าสุดที่ตรวจได้ แม้กำลังเปิดรายงานย้อนหลัง'
                        : 'ถามเกี่ยวกับพอร์ตหรือระบุหุ้นที่ต้องการให้ตรวจสอบ'}
                    </span>
                  </div>
                </div>

                <Link
                  href="/ai-advisor"
                  className="px-3.5 py-1.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/40 text-indigo-300 text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-all self-start sm:self-auto shadow-sm"
                >
                  <Bot className="w-4 h-4 text-indigo-400" />
                  <span>เปิดห้องสนทนาเต็มหน้าจอ 360° AI Suite ↗</span>
                </Link>
              </div>

              {/* 1-Click Quick Question Pills */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-slate-400 text-xs sm:text-sm font-medium">ตัวอย่างคำถามคลิกเดียว:</span>
                {[
                  'อ่านกราฟและจุดกลับตัวของหุ้นทุกตัวที่ถืออยู่',
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
                <div className="p-5 sm:p-6 rounded-2xl bg-black/60 border border-indigo-500/30 text-sm sm:text-base text-slate-100 leading-relaxed font-sans space-y-4 animate-fadeIn">
                  <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm pb-2.5 border-b border-white/[0.08]">
                    <Sparkles className="w-4 h-4" />
                    <span>คำแนะนำเฉพาะตัวจาก Tactical Copilot:</span>
                  </div>
                  <FormattedCopilotMessage content={chatAnswer} />
                  {chatSources.length > 0 && (
                    <div className="border-t border-white/10 pt-3">
                      <p className="mb-2 text-sm font-semibold text-slate-300">แหล่งอ้างอิงจากการค้นเว็บ</p>
                      <ul className="space-y-1 text-sm">
                        {chatSources.map(({ url, title }) => (
                          <li key={url}>
                            <a href={url} target="_blank" rel="noreferrer" className="break-words text-indigo-300 underline underline-offset-4">
                              {title}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
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
