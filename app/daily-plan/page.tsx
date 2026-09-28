'use client'

import React, { useState, useEffect, useMemo } from 'react'
import useSWR, { mutate } from 'swr'
import Link from 'next/link'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/PageHeader'
import { QuickAddModal } from '@/components/QuickAddModal'
import { StockLogo } from '@/components/StockLogo'
import {
  CalendarCheck,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Compass,
  ShieldCheck,
  AlertTriangle,
  Flame,
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  RefreshCw,
  Loader2,
  ArrowRight,
  DollarSign,
  Wallet,
  Activity,
  Target,
  FileText,
  Save,
  Check,
  Zap,
  Info,
  SlidersHorizontal,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  ExternalLink,
} from 'lucide-react'
import CountUp from 'react-countup'

interface ChecklistItem {
  id: string
  text: string
  done: boolean
  category?: 'routine' | 'action' | 'review'
}

interface TargetAction {
  id: string
  ticker: string
  action: 'BUY' | 'SELL' | 'HOLD' | 'WATCH'
  targetPrice?: number
  note?: string
  status: 'PENDING' | 'EXECUTED' | 'CANCELLED'
}

interface MarketBenchmark {
  symbol: string
  name: string
  price: number
  changePercent: number
  currency: 'USD' | 'THB' | 'PTS'
  category: 'index' | 'crypto' | 'commodity' | 'rates'
}

interface PortfolioTriggerItem {
  ticker: string
  assetName: string
  market: string
  currency: string
  currentPrice: number
  unrealizedPnLPercent: number
  allocationPercent: number
  currentValueBase: number
  rsi14: number | null
  supportS1: number | null
  resistanceR1: number | null
  sma50: number | null
  pullbackFromHigh: number
  distanceToS1Percent: number | null
  distanceToR1Percent: number | null
  signalType: 'STRONG_DIP_BUY' | 'NEAR_SUPPORT' | 'ACCUMULATE' | 'OVERBOUGHT_RESISTANCE' | 'NEUTRAL'
  badgeText: string
  badgeClass: string
  actionPriority: 'HIGH' | 'MEDIUM' | 'NORMAL'
  actionTag: string
  actionTagColor: string
  technicalReason: string
}

interface DailyPlanApiResponse {
  planDate: string
  isToday: boolean
  baseCurrency: string
  totalPortfolioValue: number
  investedValue: number
  totalCash: number
  marketOverview: {
    regime: {
      type: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'VOLATILE'
      title: string
      description: string
      color: string
      bg: string
    }
    benchmarks: MarketBenchmark[]
    usdThbRate: number
  }
  portfolioTriggers: PortfolioTriggerItem[]
  plan: {
    id: string | null
    marketBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'VOLATILE'
    notes: string
    checklist: ChecklistItem[]
    targetActions: TargetAction[]
    updatedAt: string | null
  }
  aiBriefing: {
    text: string
    modelUsed: string
    updatedAt: string
  } | null
  lastUpdated: string
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

function getTodayDateString(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return formatter.format(new Date())
}

function formatThaiDate(dateStr: string): string {
  try {
    const [year, month, day] = dateStr.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    return date.toLocaleDateString('th-TH', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

function shiftDate(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const d = new Date(year, month - 1, day)
  d.setDate(d.getDate() + days)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export default function DailyPlanPage() {
  const todayStr = useMemo(() => getTodayDateString(), [])
  const [selectedDate, setSelectedDate] = useState<string>(todayStr)
  const [quickAddOpen, setQuickAddOpen] = useState(false)

  // Local state for interactive editing before save
  const [marketBias, setMarketBias] = useState<'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'VOLATILE'>('NEUTRAL')
  const [notes, setNotes] = useState('')
  const [checklist, setChecklist] = useState<ChecklistItem[]>([])
  const [targetActions, setTargetActions] = useState<TargetAction[]>([])
  const [newChecklistText, setNewChecklistText] = useState('')

  // New action modal / inline input state
  const [newTicker, setNewTicker] = useState('')
  const [newActionType, setNewActionType] = useState<'BUY' | 'SELL' | 'HOLD' | 'WATCH'>('BUY')
  const [newTargetPrice, setNewTargetPrice] = useState<string>('')
  const [newActionNote, setNewActionNote] = useState('')

  // Trigger filters
  const [triggerTab, setTriggerTab] = useState<'ALL' | 'ALERTS_ONLY'>('ALERTS_ONLY')

  // Save & AI Status
  const [savingPlan, setSavingPlan] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [generatingAi, setGeneratingAi] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  const apiUrl = `/api/daily-plan?date=${selectedDate}`
  const { data, error, isLoading, mutate: revalidatePlan } = useSWR<DailyPlanApiResponse>(apiUrl, fetcher, {
    revalidateOnFocus: false,
  })

  // Sync server data to local edit state whenever date or data changes
  useEffect(() => {
    if (data?.plan) {
      setMarketBias(data.plan.marketBias || data.marketOverview?.regime?.type || 'NEUTRAL')
      setNotes(data.plan.notes || '')
      setChecklist(data.plan.checklist || [])
      setTargetActions(data.plan.targetActions || [])
    }
  }, [data])

  // Save daily plan to server
  const handleSavePlan = async (
    customBias?: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'VOLATILE',
    customChecklist?: ChecklistItem[],
    customActions?: TargetAction[],
    customNotes?: string
  ) => {
    setSavingPlan(true)
    setSaveSuccess(false)
    try {
      const res = await fetch('/api/daily-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planDate: selectedDate,
          marketBias: customBias ?? marketBias,
          notes: customNotes ?? notes,
          checklist: customChecklist ?? checklist,
          targetActions: customActions ?? targetActions,
        }),
      })
      if (!res.ok) throw new Error('Failed to save plan')
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
      revalidatePlan()
    } catch (err: any) {
      console.error('Save daily plan error:', err)
    } finally {
      setSavingPlan(false)
    }
  }

  // Toggle checklist item
  const handleToggleChecklist = (id: string) => {
    const updated = checklist.map((item) =>
      item.id === id ? { ...item, done: !item.done } : item
    )
    setChecklist(updated)
    // Optimistic background save
    handleSavePlan(undefined, updated)
  }

  // Add checklist item
  const handleAddChecklist = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!newChecklistText.trim()) return
    const newItem: ChecklistItem = {
      id: Date.now().toString(),
      text: newChecklistText.trim(),
      done: false,
      category: 'action',
    }
    const updated = [...checklist, newItem]
    setChecklist(updated)
    setNewChecklistText('')
    handleSavePlan(undefined, updated)
  }

  // Delete checklist item
  const handleDeleteChecklist = (id: string) => {
    const updated = checklist.filter((item) => item.id !== id)
    setChecklist(updated)
    handleSavePlan(undefined, updated)
  }

  // Add Target Action (from Trigger list or manual)
  const handleAddAction = (ticker: string, targetPrice?: number, defaultNote?: string) => {
    const exists = targetActions.find((a) => a.ticker.toUpperCase() === ticker.toUpperCase() && a.status === 'PENDING')
    if (exists) {
      // Already in list, scroll to it or alert
      return
    }
    const newAction: TargetAction = {
      id: Date.now().toString(),
      ticker: ticker.toUpperCase(),
      action: 'BUY',
      targetPrice: targetPrice ?? undefined,
      note: defaultNote ?? 'จังหวะย่อตัวแตะแนวรับ S1',
      status: 'PENDING',
    }
    const updated = [...targetActions, newAction]
    setTargetActions(updated)
    handleSavePlan(undefined, undefined, updated)
  }

  // Add custom action from form
  const handleAddCustomAction = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTicker.trim()) return
    const newAction: TargetAction = {
      id: Date.now().toString(),
      ticker: newTicker.trim().toUpperCase(),
      action: newActionType,
      targetPrice: newTargetPrice ? Number(newTargetPrice) : undefined,
      note: newActionNote.trim() || undefined,
      status: 'PENDING',
    }
    const updated = [...targetActions, newAction]
    setTargetActions(updated)
    setNewTicker('')
    setNewTargetPrice('')
    setNewActionNote('')
    handleSavePlan(undefined, undefined, updated)
  }

  // Toggle Action Status
  const handleToggleActionStatus = (id: string, status: 'PENDING' | 'EXECUTED' | 'CANCELLED') => {
    const updated = targetActions.map((a) => (a.id === id ? { ...a, status } : a))
    setTargetActions(updated)
    handleSavePlan(undefined, undefined, updated)
  }

  // Delete Action
  const handleDeleteAction = (id: string) => {
    const updated = targetActions.filter((a) => a.id !== id)
    setTargetActions(updated)
    handleSavePlan(undefined, undefined, updated)
  }

  // Generate AI Daily Brief
  const handleGenerateAiBrief = async () => {
    if (!data) return
    setGeneratingAi(true)
    setAiError(null)
    try {
      const res = await fetch('/api/daily-plan/ai-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planDate: selectedDate,
          marketOverview: data.marketOverview,
          portfolioTriggers: data.portfolioTriggers,
          totalPortfolioValue: data.totalPortfolioValue,
          totalCash: data.totalCash,
          baseCurrency: data.baseCurrency,
        }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Failed to generate AI brief')

      // Refresh SWR data to get the updated AI briefing
      await revalidatePlan()
    } catch (err: any) {
      console.error('AI generation error:', err)
      setAiError(err.message || 'เกิดข้อผิดพลาดในการประมวลผล AI')
    } finally {
      setGeneratingAi(false)
    }
  }

  // Copy AI Brief into user's notes
  const handleCopyAiToNotes = () => {
    if (!data?.aiBriefing?.text) return
    const combined = notes
      ? `${notes}\n\n---\n[สรุปโดย AI เมื่อ ${new Date(data.aiBriefing.updatedAt).toLocaleTimeString('th-TH')}]\n${data.aiBriefing.text}`
      : `[สรุปโดย AI เมื่อ ${new Date(data.aiBriefing.updatedAt).toLocaleTimeString('th-TH')}]\n${data.aiBriefing.text}`
    setNotes(combined)
    handleSavePlan(undefined, undefined, undefined, combined)
  }

  // Filtered triggers
  const displayedTriggers = useMemo(() => {
    if (!data?.portfolioTriggers) return []
    if (triggerTab === 'ALERTS_ONLY') {
      return data.portfolioTriggers.filter(
        (t) => t.actionPriority === 'HIGH' || t.actionPriority === 'MEDIUM'
      )
    }
    return data.portfolioTriggers
  }, [data?.portfolioTriggers, triggerTab])

  // Checklist completion stats
  const completedCount = checklist.filter((c) => c.done).length
  const progressPercent = checklist.length > 0 ? Math.round((completedCount / checklist.length) * 100) : 0

  return (
    <AppShell>
      <div className="space-y-6 pb-20">
        {/* Page Header with Date Navigator */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <PageHeader
            title="แผนการลงทุนประจำวัน (Daily Action Hub)"
            description="ศูนย์บัญชาการวิเคราะห์สภาวะตลาด ทิศทางแนวโน้ม และแผนปฏิบัติการลงมือทำประจำวันสำหรับพอร์ตของคุณ"
          />

          {/* Date Selector Pill */}
          <div className="flex items-center gap-2 bg-slate-900/90 border border-white/[0.08] p-1.5 rounded-2xl shadow-xl backdrop-blur-xl self-start md:self-auto">
            <button
              onClick={() => setSelectedDate(shiftDate(selectedDate, -1))}
              className="p-2 text-slate-400 hover:text-white hover:bg-white/[0.06] rounded-xl transition-colors"
              title="วันก่อนหน้า"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              onClick={() => setSelectedDate(todayStr)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                selectedDate === todayStr
                  ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40 shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              วันนี้
            </button>

            <div className="flex items-center gap-1.5 px-3 py-1 text-sm font-semibold text-white">
              <Calendar className="w-4 h-4 text-blue-400" />
              <span>{formatThaiDate(selectedDate)}</span>
            </div>

            <button
              onClick={() => setSelectedDate(shiftDate(selectedDate, 1))}
              className="p-2 text-slate-400 hover:text-white hover:bg-white/[0.06] rounded-xl transition-colors"
              title="วันถัดไป"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => revalidatePlan()}
              disabled={isLoading}
              className="p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-xl transition-colors disabled:opacity-50"
              title="รีเฟรชข้อมูล"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* SECTION 1: MARKET REGIME & SENTIMENT COMPASS */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Regime Badge Card */}
          <div className="lg:col-span-5 bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-slate-950/90 border border-white/[0.08] rounded-2xl p-5 shadow-xl relative overflow-hidden backdrop-blur-xl flex flex-col justify-between">
            <div className="absolute top-0 right-0 -mt-8 -mr-8 w-44 h-44 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                    <Compass className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-slate-400 tracking-wider uppercase">
                      Market Regime Compass
                    </span>
                    <h3 className="text-base font-bold text-white">สภาวะตลาดวันนี้</h3>
                  </div>
                </div>

                <div
                  className={`px-3 py-1 rounded-full text-xs font-bold border tracking-wide uppercase ${
                    data?.marketOverview?.regime?.bg || 'bg-cyan-500/10 border-cyan-500/30'
                  } ${data?.marketOverview?.regime?.color || 'text-cyan-400'}`}
                >
                  {data?.marketOverview?.regime?.title || 'กำลังวิเคราะห์...'}
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed mt-2 bg-white/[0.02] border border-white/[0.04] p-3 rounded-xl">
                {data?.marketOverview?.regime?.description ||
                  'กำลังประมวลผลดัชนีตลาดหลักเพื่อวิเคราะห์โมเมนตัมและความเสี่ยง...'}
              </p>
            </div>

            {/* Dry Powder & Currency Info */}
            <div className="pt-4 mt-4 border-t border-white/[0.06] grid grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-950/40 p-2.5 rounded-xl border border-white/[0.04]">
                <span className="text-slate-400 block text-[11px]">เงินสดสำรอง (Dry Powder)</span>
                <span className="text-sm font-bold text-emerald-400">
                  ฿{(data?.totalCash ?? 0).toLocaleString()}
                </span>
                <span className="text-[10px] text-slate-500 ml-1">
                  ({data?.totalPortfolioValue ? ((data.totalCash / data.totalPortfolioValue) * 100).toFixed(1) : 0}%)
                </span>
              </div>
              <div className="bg-slate-950/40 p-2.5 rounded-xl border border-white/[0.04]">
                <span className="text-slate-400 block text-[11px]">อัตราแลกเปลี่ยน USD/THB</span>
                <span className="text-sm font-bold text-cyan-300">
                  ฿{data?.marketOverview?.usdThbRate ? data.marketOverview.usdThbRate.toFixed(2) : '33.30'}
                </span>
                <span className="text-[10px] text-slate-500 ml-1">บาท/ดอลลาร์</span>
              </div>
            </div>
          </div>

          {/* Benchmark Ticker Tiles */}
          <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-3">
            {(data?.marketOverview?.benchmarks || []).map((bm) => {
              const isUp = bm.changePercent >= 0
              return (
                <div
                  key={bm.symbol}
                  className="bg-slate-900/60 border border-white/[0.06] hover:border-white/[0.12] rounded-2xl p-3.5 backdrop-blur-xl transition-all flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-white tracking-tight">{bm.symbol}</span>
                    <span
                      className={`flex items-center text-[11px] font-bold px-1.5 py-0.5 rounded-md ${
                        isUp
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : 'bg-rose-500/15 text-rose-400'
                      }`}
                    >
                      {isUp ? <ArrowUpRight className="w-3 h-3 mr-0.5" /> : <ArrowDownRight className="w-3 h-3 mr-0.5" />}
                      {isUp ? '+' : ''}
                      {bm.changePercent.toFixed(2)}%
                    </span>
                  </div>

                  <span className="text-[11px] text-slate-400 truncate mb-2">{bm.name}</span>

                  <div className="text-base font-extrabold text-white font-mono">
                    {bm.currency === 'USD' ? '$' : bm.currency === 'THB' ? '฿' : ''}
                    {bm.price.toLocaleString(undefined, {
                      minimumFractionDigits: bm.price < 10 ? 3 : 2,
                      maximumFractionDigits: bm.price < 10 ? 3 : 2,
                    })}
                    {bm.currency === 'PTS' ? ' pts' : ''}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* SECTION 2: AI DAILY INTELLIGENCE BRIEF */}
        <div className="bg-gradient-to-r from-indigo-950/40 via-purple-950/20 to-slate-900/80 border border-indigo-500/30 rounded-2xl p-5 md:p-6 shadow-2xl backdrop-blur-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-12 -mr-12 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-300 shadow-md shadow-indigo-950/50">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white tracking-tight">
                    AI Market Strategist (สรุปตลาดเฉพาะพอร์ตคุณ)
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    AI INTELLIGENCE
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  {data?.aiBriefing?.updatedAt
                    ? `อัปเดตล่าสุด: ${new Date(data.aiBriefing.updatedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น. (โมเดล: ${data.aiBriefing.modelUsed})`
                    : 'วิเคราะห์ทิศทางตลาดมหภาคผสานสัญญาณแนวรับ/แนวต้านของหุ้นในพอร์ตคุณ'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              {data?.aiBriefing?.text && (
                <button
                  onClick={handleCopyAiToNotes}
                  className="px-3 py-1.5 rounded-xl text-xs font-medium bg-white/[0.06] hover:bg-white/[0.1] text-slate-200 border border-white/[0.1] transition-all flex items-center gap-1.5"
                  title="คัดลอกบทวิเคราะห์ลงในสมุดบันทึกประจำวัน"
                >
                  <FileText className="w-3.5 h-3.5 text-indigo-400" />
                  <span>คัดลอกลงบันทึก</span>
                </button>
              )}

              <button
                onClick={handleGenerateAiBrief}
                disabled={generatingAi || isLoading}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {generatingAi ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>กำลังวิเคราะห์...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    <span>{data?.aiBriefing ? 'ขอคำแนะนำ AI ใหม่' : 'เริ่มให้ AI วางแผน'}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {aiError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{aiError}</span>
            </div>
          )}

          {data?.aiBriefing?.text ? (
            <div className="bg-slate-950/60 border border-white/[0.06] rounded-xl p-4 md:p-5 text-xs text-slate-200 leading-relaxed font-sans whitespace-pre-line space-y-2">
              {data.aiBriefing.text}
            </div>
          ) : (
            <div className="bg-slate-950/40 border border-dashed border-white/[0.08] rounded-xl p-6 text-center text-xs text-slate-400 space-y-2">
              <Sparkles className="w-8 h-8 text-indigo-400/60 mx-auto" />
              <p className="font-medium text-slate-300">ยังไม่มีบทวิเคราะห์สำหรับวันนี้</p>
              <p className="text-slate-500 text-[11px] max-w-md mx-auto">
                กดปุ่ม &quot;เริ่มให้ AI วางแผน&quot; ด้านบน เพื่อให้ Gemini AI รวบรวมสภาวะตลาด และสแกนหุ้นในพอร์ตคุณเพื่อสร้าง Daily Action Plan
              </p>
            </div>
          )}
        </div>

        {/* SECTION 3: PORTFOLIO ACTIONABLE TRIGGERS & S/R WATCH */}
        <div className="bg-slate-900/60 border border-white/[0.08] rounded-2xl p-5 md:p-6 shadow-xl backdrop-blur-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div>
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-teal-400" />
                <h3 className="text-base font-bold text-white tracking-tight">
                  Portfolio Daily Action Watch (สแกนจุดซื้อ/ขายในพอร์ตวันนี้)
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                คัดกรองหุ้นในพอร์ตที่ลงมาแตะแนวรับสำคัญ (S1/SMA), RSI Oversold, หรือส่งสัญญาณเตือน
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center bg-slate-950/60 p-1 rounded-xl border border-white/[0.06] text-xs">
                <button
                  onClick={() => setTriggerTab('ALERTS_ONLY')}
                  className={`px-3 py-1 rounded-lg font-medium transition-all ${
                    triggerTab === 'ALERTS_ONLY'
                      ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  เฉพาะที่มีสัญญาณเตือน ({data?.portfolioTriggers?.filter((t) => t.actionPriority !== 'NORMAL').length || 0})
                </button>
                <button
                  onClick={() => setTriggerTab('ALL')}
                  className={`px-3 py-1 rounded-lg font-medium transition-all ${
                    triggerTab === 'ALL'
                      ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  ทั้งหมดในพอร์ต ({data?.portfolioTriggers?.length || 0})
                </button>
              </div>

              <button
                onClick={() => setQuickAddOpen(true)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-all flex items-center gap-1.5 shadow-md shadow-blue-600/20"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>บันทึกธุรกรรม</span>
              </button>
            </div>
          </div>

          {/* Triggers Table */}
          {displayedTriggers.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 border border-dashed border-white/[0.06] rounded-xl">
              <ShieldCheck className="w-10 h-10 text-emerald-400/60 mx-auto mb-2" />
              <p className="font-semibold text-slate-300">
                {triggerTab === 'ALERTS_ONLY'
                  ? 'ไม่พบสินทรัพย์ที่มีสัญญาณเตือนระดับสูงในวันนี้'
                  : 'ยังไม่มีสินทรัพย์ในพอร์ต'}
              </p>
              <p className="text-slate-500 text-[11px] mt-1">
                {triggerTab === 'ALERTS_ONLY'
                  ? 'สินทรัพย์ส่วนใหญ่เคลื่อนไหวในกรอบปกติ ไม่มีตัวใดแตะแนวรับรุนแรงหรือ Oversold'
                  : 'เพิ่มธุรกรรมการซื้อเพื่อเริ่มระบบสแกนรายวัน'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/[0.08] text-slate-400 text-[11px] tracking-wider uppercase font-semibold">
                    <th className="pb-3 pr-4">สินทรัพย์</th>
                    <th className="pb-3 px-4 text-right">ราคาปัจจุบัน</th>
                    <th className="pb-3 px-4 text-center">RSI(14)</th>
                    <th className="pb-3 px-4 text-right">แนวรับ S1</th>
                    <th className="pb-3 px-4 text-right">ระยะห่างถึงแนวรับ</th>
                    <th className="pb-3 px-4">สัญญาณทางเทคนิค</th>
                    <th className="pb-3 pl-4 text-right">การกระทำที่แนะนำ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {displayedTriggers.map((item) => {
                    const rsi = item.rsi14
                    const isOversold = rsi !== null && rsi <= 35
                    const isOverbought = rsi !== null && rsi >= 68
                    const isNearS1 = item.distanceToS1Percent !== null && item.distanceToS1Percent <= 2.5

                    return (
                      <tr
                        key={item.ticker}
                        className="hover:bg-white/[0.02] transition-colors group"
                      >
                        {/* Ticker & Name */}
                        <td className="py-3.5 pr-4">
                          <div className="flex items-center gap-2.5">
                            <StockLogo
                              ticker={item.ticker}
                              name={item.assetName}
                              className="w-8 h-8 rounded-xl shrink-0"
                            />
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-white tracking-wide">
                                  {item.ticker}
                                </span>
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/[0.06] text-slate-400">
                                  {item.market === 'US' ? '🇺🇸' : item.market === 'TH' ? '🇹🇭' : '🪙'} {item.market}
                                </span>
                              </div>
                              <span className="text-[11px] text-slate-400 truncate block max-w-[140px]">
                                {item.assetName}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Current Price */}
                        <td className="py-3.5 px-4 text-right font-mono">
                          <span className="font-bold text-white">
                            {item.currency === 'USD' ? '$' : item.currency === 'THB' ? '฿' : ''}
                            {item.currentPrice.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                          <span
                            className={`block text-[10px] font-semibold ${
                              item.unrealizedPnLPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            กำไรพอร์ต {item.unrealizedPnLPercent >= 0 ? '+' : ''}
                            {item.unrealizedPnLPercent.toFixed(1)}%
                          </span>
                        </td>

                        {/* RSI 14 Gauge */}
                        <td className="py-3.5 px-4 text-center">
                          {rsi !== null ? (
                            <div className="inline-flex flex-col items-center">
                              <span
                                className={`font-mono font-bold text-xs px-2 py-0.5 rounded-md ${
                                  isOversold
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                    : isOverbought
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                    : 'bg-slate-800 text-slate-300'
                                }`}
                              >
                                {rsi.toFixed(1)}
                              </span>
                              <span className="text-[9px] text-slate-500 mt-0.5">
                                {isOversold ? 'Oversold 🔥' : isOverbought ? 'Overbought ⚠️' : 'โซนปกติ'}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-500">-</span>
                          )}
                        </td>

                        {/* Support S1 */}
                        <td className="py-3.5 px-4 text-right font-mono">
                          {item.supportS1 ? (
                            <span className="text-slate-300 font-semibold">
                              ${item.supportS1.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-slate-500">N/A</span>
                          )}
                        </td>

                        {/* Distance to S1 */}
                        <td className="py-3.5 px-4 text-right font-mono">
                          {item.distanceToS1Percent !== null ? (
                            <span
                              className={`font-semibold ${
                                isNearS1
                                  ? 'text-teal-400 font-bold'
                                  : item.distanceToS1Percent <= 5
                                  ? 'text-cyan-300'
                                  : 'text-slate-400'
                              }`}
                            >
                              {item.distanceToS1Percent > 0 ? '+' : ''}
                              {item.distanceToS1Percent.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-slate-500">-</span>
                          )}
                        </td>

                        {/* Technical Signal Tag */}
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-block px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${item.actionTagColor}`}
                          >
                            {item.actionTag}
                          </span>
                          <span className="block text-[10px] text-slate-400 mt-1 max-w-[200px] truncate" title={item.technicalReason}>
                            {item.technicalReason}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 pl-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleAddAction(item.ticker, item.supportS1 ?? item.currentPrice, item.actionTag)}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border border-teal-500/30 transition-all flex items-center gap-1"
                              title="เพิ่มสินทรัพย์นี้ลงในแผนปฏิบัติการวันนี้"
                            >
                              <Plus className="w-3 h-3" />
                              <span>ใส่ในแผน</span>
                            </button>
                            <button
                              onClick={() => setQuickAddOpen(true)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
                              title="เปิดหน้าต่างบันทึกธุรกรรม"
                            >
                              <Zap className="w-3.5 h-3.5 text-blue-400" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* SECTION 4: TODAY'S EXECUTION PLAN & INTERACTIVE CHECKLIST */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Interactive Daily Checklist */}
          <div className="lg:col-span-5 bg-slate-900/60 border border-white/[0.08] rounded-2xl p-5 md:p-6 shadow-xl backdrop-blur-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <CalendarCheck className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-base font-bold text-white tracking-tight">
                    เช็กลิสต์ประจำวัน (Daily Checklist)
                  </h3>
                </div>
                <span className="text-xs font-mono font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                  {completedCount}/{checklist.length} สำเร็จ ({progressPercent}%)
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-800 rounded-full h-1.5 mb-5 overflow-hidden">
                <div
                  className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {/* Checklist Items */}
              <div className="space-y-2 mb-4">
                {checklist.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleToggleChecklist(item.id)}
                    className={`flex items-start justify-between gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                      item.done
                        ? 'bg-emerald-500/5 border-emerald-500/20 text-slate-400'
                        : 'bg-slate-950/40 hover:bg-white/[0.02] border-white/[0.04] text-slate-200'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 flex-1">
                      <button
                        type="button"
                        className="mt-0.5 text-emerald-400 hover:text-emerald-300 shrink-0"
                      >
                        {item.done ? (
                          <CheckCircle2 className="w-4 h-4 fill-emerald-500/20" />
                        ) : (
                          <Circle className="w-4 h-4 text-slate-500" />
                        )}
                      </button>
                      <span className={`text-xs leading-relaxed ${item.done ? 'line-through text-slate-500' : ''}`}>
                        {item.text}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteChecklist(item.id)
                      }}
                      className="text-slate-600 hover:text-rose-400 p-1 transition-colors"
                      title="ลบข้อนี้"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add Custom Task Form */}
              <form onSubmit={handleAddChecklist} className="flex gap-2 mt-3">
                <input
                  type="text"
                  placeholder="+ เพิ่มสิ่งที่ต้องทำวันนี้..."
                  value={newChecklistText}
                  onChange={(e) => setNewChecklistText(e.target.value)}
                  className="flex-1 bg-slate-950/60 border border-white/[0.08] focus:border-emerald-500/50 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 outline-none transition-all"
                />
                <button
                  type="submit"
                  disabled={!newChecklistText.trim()}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-semibold transition-all"
                >
                  เพิ่ม
                </button>
              </form>
            </div>

            <div className="text-[11px] text-slate-500 mt-6 pt-3 border-t border-white/[0.04] flex items-center justify-between">
              <span>* การติ๊กเลือกจะบันทึกอัตโนมัติลงฐานข้อมูล</span>
              {saveSuccess && <span className="text-emerald-400 font-semibold flex items-center gap-1"><Check className="w-3 h-3" /> บันทึกแล้ว</span>}
            </div>
          </div>

          {/* Right Column: Strategy Notes & Target Orders Plan */}
          <div className="lg:col-span-7 bg-slate-900/60 border border-white/[0.08] rounded-2xl p-5 md:p-6 shadow-xl backdrop-blur-xl flex flex-col justify-between">
            <div>
              {/* Header & Market Bias selector */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-400" />
                    บันทึกกลยุทธ์ & แผนตั้งรับประจำวัน
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    กำหนดจุดยืนและคำสั่งซื้อขายที่ตั้งเป้าหมายไว้สำหรับวันนี้
                  </p>
                </div>

                {/* Bias Selector */}
                <div className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-white/[0.06] text-[11px]">
                  {(['BULLISH', 'NEUTRAL', 'BEARISH', 'VOLATILE'] as const).map((b) => {
                    const isSelected = marketBias === b
                    const label =
                      b === 'BULLISH'
                        ? '🟢 Bullish'
                        : b === 'NEUTRAL'
                        ? '⚪ Neutral'
                        : b === 'BEARISH'
                        ? '🔴 Bearish'
                        : '⚡ Volatile'
                    return (
                      <button
                        key={b}
                        onClick={() => {
                          setMarketBias(b)
                          handleSavePlan(b)
                        }}
                        className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                          isSelected
                            ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40 shadow-xs'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Planned Target Orders Table */}
              <div className="mb-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-300">
                    🎯 สินทรัพย์เป้าหมายของวันนี้ (Target Orders)
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {targetActions.length} รายการ
                  </span>
                </div>

                {targetActions.length === 0 ? (
                  <div className="p-4 bg-slate-950/40 border border-dashed border-white/[0.06] rounded-xl text-center text-xs text-slate-500">
                    ยังไม่มีรายการสั่งซื้อขายที่วางแผนไว้สำหรับวันนี้ (กด &quot;ใส่ในแผน&quot; จากตารางด้านบน หรือเพิ่มด้านล่าง)
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {targetActions.map((action) => (
                      <div
                        key={action.id}
                        className="bg-slate-950/60 border border-white/[0.04] p-3 rounded-xl flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                              action.action === 'BUY'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : action.action === 'SELL'
                                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {action.action}
                          </span>
                          <span className="font-bold text-white font-mono">{action.ticker}</span>
                          {action.targetPrice && (
                            <span className="text-slate-300 font-mono">
                              @ ${action.targetPrice.toFixed(2)}
                            </span>
                          )}
                          {action.note && (
                            <span className="text-slate-500 text-[11px] hidden sm:inline truncate max-w-[150px]">
                              ({action.note})
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <select
                            value={action.status}
                            onChange={(e) =>
                              handleToggleActionStatus(
                                action.id,
                                e.target.value as 'PENDING' | 'EXECUTED' | 'CANCELLED'
                              )
                            }
                            className={`text-[10px] font-semibold px-2 py-1 rounded-lg border bg-slate-900 outline-none ${
                              action.status === 'EXECUTED'
                                ? 'text-emerald-400 border-emerald-500/30'
                                : action.status === 'CANCELLED'
                                ? 'text-rose-400 border-rose-500/30'
                                : 'text-amber-400 border-amber-500/30'
                            }`}
                          >
                            <option value="PENDING">รอดำเนินการ</option>
                            <option value="EXECUTED">ทำตามแผนแล้ว</option>
                            <option value="CANCELLED">ยกเลิก</option>
                          </select>

                          <button
                            type="button"
                            onClick={() => handleDeleteAction(action.id)}
                            className="text-slate-600 hover:text-rose-400 p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Inline add action form */}
                <form onSubmit={handleAddCustomAction} className="grid grid-cols-1 sm:grid-cols-4 gap-2 mt-2.5">
                  <input
                    type="text"
                    placeholder="Ticker (เช่น NVDA)"
                    value={newTicker}
                    onChange={(e) => setNewTicker(e.target.value)}
                    className="bg-slate-950/60 border border-white/[0.08] rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 uppercase outline-none"
                  />
                  <select
                    value={newActionType}
                    onChange={(e) => setNewActionType(e.target.value as any)}
                    className="bg-slate-950/60 border border-white/[0.08] rounded-xl px-2 py-1.5 text-xs text-white outline-none"
                  >
                    <option value="BUY">BUY (ซื้อ)</option>
                    <option value="SELL">SELL (ขาย)</option>
                    <option value="HOLD">HOLD (ถือ)</option>
                    <option value="WATCH">WATCH (เฝ้าดู)</option>
                  </select>
                  <input
                    type="number"
                    step="any"
                    placeholder="ราคาเป้าหมาย ($)"
                    value={newTargetPrice}
                    onChange={(e) => setNewTargetPrice(e.target.value)}
                    className="bg-slate-950/60 border border-white/[0.08] rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!newTicker.trim()}
                    className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-semibold transition-all flex items-center justify-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>เพิ่มออร์เดอร์</span>
                  </button>
                </form>
              </div>

              {/* Free-form Strategy Notes */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  📝 บันทึกกลยุทธ์ & Trading Journal ส่วนตัว
                </label>
                <textarea
                  rows={4}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="เขียนแผนการตัดสินใจวันนี้ เช่น 'วันนี้ตั้งรับ NVDA ที่ $118 แบ่งซื้อ 1 ไม้ ไม่ไล่ราคาถ้ารีบาวด์แรง...'"
                  className="w-full bg-slate-950/60 border border-white/[0.08] focus:border-blue-500/50 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-500 outline-none transition-all resize-none leading-relaxed"
                />
              </div>
            </div>

            {/* Save Button Bar */}
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/[0.04]">
              <span className="text-[11px] text-slate-500">
                {data?.plan?.updatedAt ? `บันทึกล่าสุด: ${new Date(data.plan.updatedAt).toLocaleTimeString('th-TH')}` : ''}
              </span>

              <button
                onClick={() => handleSavePlan()}
                disabled={savingPlan}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {savingPlan ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>กำลังบันทึก...</span>
                  </>
                ) : saveSuccess ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>บันทึกสำเร็จ!</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>บันทึกแผนงานวันนี้</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Quick Add Modal */}
        {quickAddOpen && (
          <QuickAddModal
            onClose={() => setQuickAddOpen(false)}
            onSuccess={() => {
              setQuickAddOpen(false)
              revalidatePlan()
            }}
          />
        )}
      </div>
    </AppShell>
  )
}
