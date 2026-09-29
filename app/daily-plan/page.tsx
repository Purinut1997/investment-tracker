'use client'

import React, { useState, useEffect, useMemo } from 'react'
import useSWR from 'swr'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/PageHeader'
import { QuickAddModal } from '@/components/QuickAddModal'
import { StockLogo } from '@/components/StockLogo'
import { AiBriefViewer } from '@/components/daily-plan/AiBriefViewer'
import { ChecklistDetailModal } from '@/components/daily-plan/ChecklistDetailModal'
import {
  CalendarCheck,
  Calendar,
  ChevronLeft,
  ChevronRight,
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
  Sparkles,
} from 'lucide-react'

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

  // Local state for interactive editing
  const [marketBias, setMarketBias] = useState<'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'VOLATILE'>('NEUTRAL')
  const [notes, setNotes] = useState('')
  const [checklist, setChecklist] = useState<ChecklistItem[]>([])
  const [targetActions, setTargetActions] = useState<TargetAction[]>([])
  const [newChecklistText, setNewChecklistText] = useState('')
  const [activeChecklistModalItem, setActiveChecklistModalItem] = useState<ChecklistItem | null>(null)

  // New action form state
  const [newTicker, setNewTicker] = useState('')
  const [newActionType, setNewActionType] = useState<'BUY' | 'SELL' | 'HOLD' | 'WATCH'>('BUY')
  const [newTargetPrice, setNewTargetPrice] = useState<string>('')
  const [newActionNote, setNewActionNote] = useState('')

  // Trigger filter
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

  // Sync server data to local state
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

  // Toggle checklist item or open modal
  const handleItemClick = (item: ChecklistItem) => {
    if (!item.done) {
      setActiveChecklistModalItem(item)
    } else {
      // If already done, clicking toggles it back to undone
      handleToggleChecklist(item.id, false)
    }
  }

  const handleToggleChecklist = (id: string, forceDone?: boolean) => {
    const updated = checklist.map((item) =>
      item.id === id ? { ...item, done: forceDone !== undefined ? forceDone : !item.done } : item
    )
    setChecklist(updated)
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

  // Add checklist item directly from AI Recommendation
  const handleAddToChecklistFromAi = (actionText: string) => {
    const cleanText = actionText.replace(/^[\d+.\-•*]\s*/, '').trim()
    if (!cleanText) return
    const newItem: ChecklistItem = {
      id: Date.now().toString(),
      text: cleanText,
      done: false,
      category: 'action',
    }
    const updated = [...checklist, newItem]
    setChecklist(updated)
    handleSavePlan(undefined, updated)
  }

  // Delete checklist item
  const handleDeleteChecklist = (id: string) => {
    const updated = checklist.filter((item) => item.id !== id)
    setChecklist(updated)
    handleSavePlan(undefined, updated)
  }

  // Add Target Action
  const handleAddAction = (ticker: string, targetPrice?: number, defaultNote?: string) => {
    const exists = targetActions.find((a) => a.ticker.toUpperCase() === ticker.toUpperCase() && a.status === 'PENDING')
    if (exists) return
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
      <div className="space-y-8 pb-24">
        {/* Top Header & Date Bar */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <PageHeader
            title="แผนการลงทุนประจำวัน (Daily Action Hub)"
            description="ศูนย์บัญชาการวิเคราะห์สภาวะตลาด ทิศทางแนวโน้ม และแผนปฏิบัติการลงมือทำประจำวันสำหรับพอร์ตของคุณ"
          />

          {/* Date Selector Pill */}
          <div className="flex items-center gap-2 bg-slate-900/90 border-2 border-white/[0.1] p-2 rounded-2xl shadow-2xl backdrop-blur-xl self-start md:self-auto">
            <button
              onClick={() => setSelectedDate(shiftDate(selectedDate, -1))}
              className="p-2 text-slate-300 hover:text-white hover:bg-white/[0.08] rounded-xl transition-colors"
              title="วันก่อนหน้า"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <button
              onClick={() => setSelectedDate(todayStr)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                selectedDate === todayStr
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                  : 'text-slate-300 hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              วันนี้
            </button>

            <div className="flex items-center gap-2 px-3 py-1.5 text-base font-bold text-white">
              <Calendar className="w-5 h-5 text-blue-400" />
              <span>{formatThaiDate(selectedDate)}</span>
            </div>

            <button
              onClick={() => setSelectedDate(shiftDate(selectedDate, 1))}
              className="p-2 text-slate-300 hover:text-white hover:bg-white/[0.08] rounded-xl transition-colors"
              title="วันถัดไป"
            >
              <ChevronRight className="w-5 h-5" />
            </button>

            <button
              onClick={() => revalidatePlan()}
              disabled={isLoading}
              className="p-2 text-slate-300 hover:text-blue-400 hover:bg-blue-500/10 rounded-xl transition-colors disabled:opacity-50"
              title="รีเฟรชข้อมูล"
            >
              <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin text-blue-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* SECTION 1: MARKET REGIME & SENTIMENT COMPASS */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Regime Badge Card */}
          <div className="lg:col-span-5 bg-gradient-to-br from-slate-900/95 via-slate-900/80 to-slate-950/95 border-2 border-white/[0.1] rounded-3xl p-6 shadow-2xl relative overflow-hidden backdrop-blur-2xl flex flex-col justify-between">
            <div className="absolute top-0 right-0 -mt-10 -mr-10 w-52 h-52 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />

            <div>
              <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
                    <Compass className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-blue-400 tracking-wider uppercase block">
                      Market Regime Compass
                    </span>
                    <h3 className="text-xl font-black text-white">สภาวะตลาดวันนี้</h3>
                  </div>
                </div>

                <div
                  className={`px-4 py-1.5 rounded-full text-sm font-extrabold border tracking-wide uppercase shadow-sm ${
                    data?.marketOverview?.regime?.bg || 'bg-cyan-500/15 border-cyan-500/40'
                  } ${data?.marketOverview?.regime?.color || 'text-cyan-300'}`}
                >
                  {data?.marketOverview?.regime?.title || 'กำลังวิเคราะห์...'}
                </div>
              </div>

              <div className="text-sm md:text-base text-slate-200 leading-relaxed mt-3 bg-white/[0.03] border border-white/[0.06] p-4 rounded-2xl">
                {data?.marketOverview?.regime?.description ||
                  'กำลังประมวลผลดัชนีตลาดหลักเพื่อวิเคราะห์โมเมนตัมและความเสี่ยง...'}
              </div>
            </div>

            {/* Dry Powder & Currency Info */}
            <div className="pt-5 mt-5 border-t border-white/[0.08] grid grid-cols-2 gap-4">
              <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-white/[0.06]">
                <span className="text-xs font-semibold text-slate-400 block mb-1">
                  เงินสดสำรอง (Dry Powder)
                </span>
                <span className="text-lg md:text-xl font-black text-emerald-400 font-mono">
                  ฿{(data?.totalCash ?? 0).toLocaleString()}
                </span>
                <span className="text-xs font-bold text-slate-400 ml-1.5">
                  ({data?.totalPortfolioValue ? ((data.totalCash / data.totalPortfolioValue) * 100).toFixed(1) : 0}%)
                </span>
              </div>
              <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-white/[0.06]">
                <span className="text-xs font-semibold text-slate-400 block mb-1">
                  อัตราแลกเปลี่ยน USD/THB
                </span>
                <span className="text-lg md:text-xl font-black text-cyan-300 font-mono">
                  ฿{data?.marketOverview?.usdThbRate ? data.marketOverview.usdThbRate.toFixed(2) : '33.30'}
                </span>
                <span className="text-xs text-slate-400 ml-1.5">บาท/ดอลลาร์</span>
              </div>
            </div>
          </div>

          {/* Benchmark Ticker Tiles */}
          <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-4">
            {(data?.marketOverview?.benchmarks || []).map((bm) => {
              const isUp = bm.changePercent >= 0
              return (
                <div
                  key={bm.symbol}
                  className="bg-slate-900/80 border-2 border-white/[0.08] hover:border-white/[0.18] rounded-3xl p-4 md:p-5 backdrop-blur-xl transition-all flex flex-col justify-between shadow-lg"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-black text-white tracking-tight">{bm.symbol}</span>
                    <span
                      className={`flex items-center text-xs font-black px-2 py-0.5 rounded-lg border ${
                        isUp
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                      }`}
                    >
                      {isUp ? <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" /> : <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />}
                      {isUp ? '+' : ''}
                      {bm.changePercent.toFixed(2)}%
                    </span>
                  </div>

                  <span className="text-xs font-semibold text-slate-300 truncate mb-2">{bm.name}</span>

                  <div className="text-lg md:text-xl font-black text-white font-mono">
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

        {/* SECTION 2: AI MARKET STRATEGIST BENTO VIEWER */}
        <AiBriefViewer
          text={data?.aiBriefing?.text || ''}
          modelUsed={data?.aiBriefing?.modelUsed}
          updatedAt={data?.aiBriefing?.updatedAt}
          isGenerating={generatingAi}
          error={aiError}
          onRegenerate={handleGenerateAiBrief}
          onCopyNotes={handleCopyAiToNotes}
          onAddToChecklist={handleAddToChecklistFromAi}
        />

        {/* SECTION 3: PORTFOLIO ACTIONABLE TRIGGERS & S/R WATCH */}
        <div className="bg-slate-900/80 border-2 border-white/[0.08] rounded-3xl p-6 md:p-8 shadow-2xl backdrop-blur-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2.5">
                <Target className="w-6 h-6 text-teal-400" />
                <h3 className="text-xl font-black text-white tracking-tight">
                  Portfolio Daily Action Watch (สแกนจุดซื้อ/ขายในพอร์ตวันนี้)
                </h3>
              </div>
              <p className="text-sm text-slate-300 mt-1">
                คัดกรองหุ้นในพอร์ตที่แตะแนวรับสำคัญ (S1/SMA), RSI Oversold, หรือส่งสัญญาณเตือน
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center bg-slate-950/80 p-1.5 rounded-2xl border border-white/[0.08] text-sm">
                <button
                  onClick={() => setTriggerTab('ALERTS_ONLY')}
                  className={`px-4 py-2 rounded-xl font-bold transition-all ${
                    triggerTab === 'ALERTS_ONLY'
                      ? 'bg-teal-500/25 text-teal-300 border border-teal-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  เฉพาะมีสัญญาณเตือน ({data?.portfolioTriggers?.filter((t) => t.actionPriority !== 'NORMAL').length || 0})
                </button>
                <button
                  onClick={() => setTriggerTab('ALL')}
                  className={`px-4 py-2 rounded-xl font-bold transition-all ${
                    triggerTab === 'ALL'
                      ? 'bg-teal-500/25 text-teal-300 border border-teal-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  ทั้งหมดในพอร์ต ({data?.portfolioTriggers?.length || 0})
                </button>
              </div>

              <button
                onClick={() => setQuickAddOpen(true)}
                className="px-4 py-2.5 rounded-2xl text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white transition-all flex items-center gap-2 shadow-lg shadow-blue-600/30"
              >
                <Plus className="w-4 h-4" />
                <span>บันทึกธุรกรรม</span>
              </button>
            </div>
          </div>

          {/* Triggers Table */}
          {displayedTriggers.length === 0 ? (
            <div className="py-14 text-center text-sm text-slate-300 border-2 border-dashed border-white/[0.08] rounded-2xl space-y-2">
              <ShieldCheck className="w-12 h-12 text-emerald-400/80 mx-auto" />
              <p className="text-base font-bold text-white">
                {triggerTab === 'ALERTS_ONLY'
                  ? 'ไม่พบสินทรัพย์ที่มีสัญญาณเตือนรุนแรงในวันนี้'
                  : 'ยังไม่มีสินทรัพย์ในพอร์ต'}
              </p>
              <p className="text-slate-400 text-sm max-w-md mx-auto">
                {triggerTab === 'ALERTS_ONLY'
                  ? 'สินทรัพย์ส่วนใหญ่เคลื่อนไหวในกรอบปกติ ไม่มีตัวใดหลุดแนวรับรุนแรงหรือเข้าเขต Oversold'
                  : 'เพิ่มธุรกรรมการซื้อเพื่อเริ่มระบบสแกนรายวัน'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto pb-3 -mx-2 px-2 scrollbar-thin">
              <table className="w-full min-w-[1200px] text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b-2 border-white/[0.08] text-slate-300 text-xs tracking-wider uppercase font-bold">
                    <th className="pb-3.5 pr-4 min-w-[200px] whitespace-nowrap">สินทรัพย์</th>
                    <th className="pb-3.5 px-4 text-right min-w-[140px] whitespace-nowrap">ราคาปัจจุบัน</th>
                    <th className="pb-3.5 px-4 text-center min-w-[110px] whitespace-nowrap">RSI(14)</th>
                    <th className="pb-3.5 px-4 text-right min-w-[110px] whitespace-nowrap">แนวรับ S1</th>
                    <th className="pb-3.5 px-4 text-right min-w-[140px] whitespace-nowrap">ระยะห่างถึงแนวรับ</th>
                    <th className="pb-3.5 px-4 min-w-[360px] whitespace-nowrap">สัญญาณทางเทคนิค & เหตุผล</th>
                    <th className="pb-3.5 pl-4 text-right min-w-[140px] whitespace-nowrap">การกระทำ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {displayedTriggers.map((item) => {
                    const rsi = item.rsi14
                    const isOversold = rsi !== null && rsi <= 35
                    const isOverbought = rsi !== null && rsi >= 68
                    const isNearS1 = item.distanceToS1Percent !== null && item.distanceToS1Percent <= 2.5

                    return (
                      <tr
                        key={item.ticker}
                        className="hover:bg-white/[0.03] transition-colors group"
                      >
                        {/* Ticker & Name */}
                        <td className="py-4 pr-4">
                          <div className="flex items-center gap-3">
                            <StockLogo
                              ticker={item.ticker}
                              name={item.assetName}
                              className="w-10 h-10 rounded-2xl shrink-0"
                            />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-base font-black text-white tracking-wide">
                                  {item.ticker}
                                </span>
                                <span className="text-xs px-2 py-0.5 rounded-md bg-white/[0.08] text-slate-300 font-semibold">
                                  {item.market === 'US' ? '🇺🇸' : item.market === 'TH' ? '🇹🇭' : '🪙'} {item.market}
                                </span>
                              </div>
                              {item.assetName && item.assetName.trim().toUpperCase() !== item.ticker.trim().toUpperCase() && (
                                <span className="text-xs font-semibold text-slate-400 block break-words mt-0.5 max-w-[180px]">
                                  {item.assetName}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Current Price */}
                        <td className="py-4 px-4 text-right font-mono">
                          <span className="text-base font-black text-white">
                            {item.currency === 'USD' ? '$' : item.currency === 'THB' ? '฿' : ''}
                            {item.currentPrice.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                          <span
                            className={`block text-xs font-bold ${
                              item.unrealizedPnLPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {item.unrealizedPnLPercent >= 0 ? '+' : ''}
                            {item.unrealizedPnLPercent.toFixed(1)}% ในพอร์ต
                          </span>
                        </td>

                        {/* RSI 14 Gauge */}
                        <td className="py-4 px-4 text-center">
                          {rsi !== null ? (
                            <div className="inline-flex flex-col items-center">
                              <span
                                className={`font-mono font-black text-sm px-3 py-1 rounded-xl border ${
                                  isOversold
                                    ? 'bg-emerald-500/25 text-emerald-300 border-emerald-500/40 shadow-xs'
                                    : isOverbought
                                    ? 'bg-amber-500/25 text-amber-300 border-amber-500/40'
                                    : 'bg-slate-800/90 text-slate-200 border-white/[0.08]'
                                }`}
                              >
                                {rsi.toFixed(1)}
                              </span>
                              <span className="text-[11px] font-semibold text-slate-400 mt-1">
                                {isOversold ? 'Oversold 🔥' : isOverbought ? 'Overbought ⚠️' : 'โซนปกติ'}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-500">-</span>
                          )}
                        </td>

                        {/* Support S1 */}
                        <td className="py-4 px-4 text-right font-mono">
                          {item.supportS1 ? (
                            <span className="text-base font-black text-slate-100">
                              ${item.supportS1.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-slate-500">N/A</span>
                          )}
                        </td>

                        {/* Distance to S1 */}
                        <td className="py-4 px-4 text-right font-mono">
                          {item.distanceToS1Percent !== null ? (
                            <span
                              className={`text-sm font-black ${
                                isNearS1
                                  ? 'text-teal-300 bg-teal-500/20 px-2 py-0.5 rounded-lg border border-teal-500/30'
                                  : item.distanceToS1Percent <= 5
                                  ? 'text-cyan-300'
                                  : 'text-slate-300'
                              }`}
                            >
                              {item.distanceToS1Percent > 0 ? '+' : ''}
                              {item.distanceToS1Percent.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-slate-500">-</span>
                          )}
                        </td>

                        {/* Technical Signal Tag & Reason (Full Text, Wrapped, No Ellipsis) */}
                        <td className="py-4 px-4">
                          <div className="space-y-1.5 max-w-[400px]">
                            <span
                              className={`inline-block px-3 py-1 rounded-xl text-xs font-bold border ${item.actionTagColor}`}
                            >
                              {item.actionTag}
                            </span>
                            <p className="text-xs sm:text-sm font-medium text-slate-200 leading-relaxed break-words whitespace-normal">
                              {item.technicalReason}
                            </p>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="py-4 pl-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleAddAction(item.ticker, item.supportS1 ?? item.currentPrice, item.actionTag)}
                              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-teal-500/15 hover:bg-teal-500/25 text-teal-300 border border-teal-500/30 transition-all flex items-center gap-1.5 shadow-xs whitespace-nowrap"
                              title="เพิ่มสินทรัพย์นี้ลงในแผนปฏิบัติการวันนี้"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>ใส่ในแผน</span>
                            </button>
                            <button
                              onClick={() => setQuickAddOpen(true)}
                              className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/[0.08] transition-colors"
                              title="เปิดหน้าต่างบันทึกธุรกรรม"
                            >
                              <Zap className="w-4 h-4 text-blue-400" />
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Interactive Daily Checklist */}
          <div className="lg:col-span-5 bg-slate-900/80 border-2 border-white/[0.08] rounded-3xl p-6 md:p-8 shadow-2xl backdrop-blur-2xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                    <CalendarCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block">
                      Daily Routine
                    </span>
                    <h3 className="text-xl font-black text-white tracking-tight">
                      เช็กลิสต์ประจำวัน
                    </h3>
                  </div>
                </div>
                <span className="text-sm font-mono font-bold text-emerald-300 bg-emerald-500/20 px-3.5 py-1.5 rounded-xl border border-emerald-500/30">
                  {completedCount}/{checklist.length} สำเร็จ ({progressPercent}%)
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-800 rounded-full h-2 mb-6 overflow-hidden">
                <div
                  className="bg-emerald-500 h-2 rounded-full transition-all duration-500 shadow-md shadow-emerald-500/50"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {/* Checklist Items */}
              <div className="space-y-3 mb-5">
                {checklist.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className={`group flex items-start justify-between gap-3.5 p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                      item.done
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-slate-400'
                        : 'bg-slate-950/60 hover:bg-slate-950/90 border-white/[0.08] text-slate-100 hover:border-emerald-500/40 shadow-sm hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-start gap-3.5 flex-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleItemClick(item)
                        }}
                        className="mt-0.5 text-emerald-400 hover:text-emerald-300 shrink-0"
                        title={item.done ? "คลิกเพื่อยกเลิกการติ๊ก" : "คลิกเพื่อเปิดอ่านคำแนะนำและติ๊กบันทึก"}
                      >
                        {item.done ? (
                          <CheckCircle2 className="w-5 h-5 fill-emerald-500/30 text-emerald-400" />
                        ) : (
                          <Circle className="w-5 h-5 text-slate-400 group-hover:text-emerald-400 transition-colors" />
                        )}
                      </button>
                      <div className="flex-1">
                        <span className={`text-sm md:text-base leading-relaxed font-medium block ${item.done ? 'line-through text-slate-500' : 'text-slate-100'}`}>
                          {item.text}
                        </span>
                        {!item.done && (
                          <span className="text-[11px] text-slate-400 mt-1 flex items-center gap-1 group-hover:text-emerald-400 transition-colors">
                            คลิกเพื่อเปิดอ่านคำแนะนำและบันทึกอัตโนมัติ ↗
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteChecklist(item.id)
                      }}
                      className="text-slate-500 hover:text-rose-400 p-1.5 transition-colors"
                      title="ลบข้อนี้"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add Custom Task Form */}
              <form onSubmit={handleAddChecklist} className="flex gap-2.5 mt-4">
                <input
                  type="text"
                  placeholder="+ เพิ่มสิ่งที่ต้องทำวันนี้..."
                  value={newChecklistText}
                  onChange={(e) => setNewChecklistText(e.target.value)}
                  className="flex-1 bg-slate-950/80 border-2 border-white/[0.1] focus:border-emerald-500/60 rounded-2xl px-4 py-3 text-sm text-white placeholder-slate-400 outline-none transition-all shadow-inner"
                />
                <button
                  type="submit"
                  disabled={!newChecklistText.trim()}
                  className="px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm font-bold transition-all shadow-lg shadow-emerald-600/30"
                >
                  เพิ่ม
                </button>
              </form>
            </div>

            <div className="text-xs font-medium text-slate-400 mt-6 pt-4 border-t border-white/[0.08] flex items-center justify-between">
              <span>* การติ๊กเลือกจะบันทึกอัตโนมัติลงฐานข้อมูลทันที</span>
              {saveSuccess && (
                <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                  <Check className="w-4 h-4" /> บันทึกแล้ว
                </span>
              )}
            </div>
          </div>

          {/* Right Column: Strategy Notes & Target Orders Plan */}
          <div className="lg:col-span-7 bg-slate-900/80 border-2 border-white/[0.08] rounded-3xl p-6 md:p-8 shadow-2xl backdrop-blur-2xl flex flex-col justify-between">
            <div className="space-y-6">
              {/* Header & Market Bias selector */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-blue-400 uppercase tracking-wider block">
                      Execution Strategy
                    </span>
                    <h3 className="text-xl font-black text-white tracking-tight">
                      บันทึกกลยุทธ์ & แผนตั้งรับ
                    </h3>
                  </div>
                </div>

                {/* Bias Selector */}
                <div className="flex items-center gap-1.5 bg-slate-950/80 p-1.5 rounded-2xl border border-white/[0.08] text-xs">
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
                        className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                          isSelected
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
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
              <div className="bg-slate-950/60 border border-white/[0.08] rounded-2xl p-4 md:p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-200">
                    🎯 สินทรัพย์เป้าหมายของวันนี้ (Target Orders)
                  </span>
                  <span className="text-xs font-bold text-slate-400 font-mono">
                    {targetActions.length} รายการ
                  </span>
                </div>

                {targetActions.length === 0 ? (
                  <div className="p-5 bg-slate-900/60 border-2 border-dashed border-white/[0.06] rounded-xl text-center text-sm text-slate-400">
                    ยังไม่มีรายการสั่งซื้อขายที่วางแผนไว้สำหรับวันนี้ (กด &quot;ใส่ในแผน&quot; จากตารางด้านบน หรือเพิ่มด้านล่าง)
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1">
                    {targetActions.map((action) => (
                      <div
                        key={action.id}
                        className="bg-slate-900/90 border border-white/[0.08] p-3.5 rounded-xl flex items-center justify-between gap-3 text-sm"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`px-2.5 py-1 rounded-lg font-black text-xs ${
                              action.action === 'BUY'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : action.action === 'SELL'
                                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                : 'bg-slate-800 text-slate-200'
                            }`}
                          >
                            {action.action}
                          </span>
                          <span className="font-black text-white font-mono text-base">{action.ticker}</span>
                          {action.targetPrice && (
                            <span className="text-slate-200 font-mono font-bold text-sm">
                              @ ${action.targetPrice.toFixed(2)}
                            </span>
                          )}
                          {action.note && (
                            <span className="text-slate-300 text-xs hidden sm:inline break-words">
                              ({action.note})
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2.5">
                          <select
                            value={action.status}
                            onChange={(e) =>
                              handleToggleActionStatus(
                                action.id,
                                e.target.value as 'PENDING' | 'EXECUTED' | 'CANCELLED'
                              )
                            }
                            className={`text-xs font-bold px-3 py-1.5 rounded-xl border bg-slate-900 outline-none ${
                              action.status === 'EXECUTED'
                                ? 'text-emerald-400 border-emerald-500/40 bg-emerald-950/20'
                                : action.status === 'CANCELLED'
                                ? 'text-rose-400 border-rose-500/40 bg-rose-950/20'
                                : 'text-amber-400 border-amber-500/40 bg-amber-950/20'
                            }`}
                          >
                            <option value="PENDING">รอดำเนินการ</option>
                            <option value="EXECUTED">ทำตามแผนแล้ว</option>
                            <option value="CANCELLED">ยกเลิก</option>
                          </select>

                          <button
                            type="button"
                            onClick={() => handleDeleteAction(action.id)}
                            className="text-slate-500 hover:text-rose-400 p-1.5"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Inline add action form */}
                <form onSubmit={handleAddCustomAction} className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 pt-2">
                  <input
                    type="text"
                    placeholder="Ticker (เช่น NVDA)"
                    value={newTicker}
                    onChange={(e) => setNewTicker(e.target.value)}
                    className="bg-slate-950/90 border border-white/[0.1] rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-400 uppercase outline-none font-bold"
                  />
                  <select
                    value={newActionType}
                    onChange={(e) => setNewActionType(e.target.value as any)}
                    className="bg-slate-950/90 border border-white/[0.1] rounded-xl px-3 py-2 text-sm text-white outline-none font-semibold"
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
                    className="bg-slate-950/90 border border-white/[0.1] rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-400 outline-none font-mono"
                  />
                  <button
                    type="submit"
                    disabled={!newTicker.trim()}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-bold transition-all flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/30"
                  >
                    <Plus className="w-4 h-4" />
                    <span>เพิ่มออร์เดอร์</span>
                  </button>
                </form>
              </div>

              {/* Free-form Strategy Notes */}
              <div>
                <label className="text-sm font-bold text-slate-200 block mb-2">
                  📝 บันทึกกลยุทธ์ & Trading Journal ส่วนตัว
                </label>
                <textarea
                  rows={5}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="เขียนแผนการตัดสินใจวันนี้ เช่น 'วันนี้ตั้งรับ NVDA ที่ $118 แบ่งซื้อ 1 ไม้ ไม่ไล่ราคาถ้ารีบาวด์แรง...'"
                  className="w-full bg-slate-950/80 border-2 border-white/[0.1] focus:border-blue-500/60 rounded-2xl p-4 text-sm md:text-base text-slate-100 placeholder-slate-400 outline-none transition-all resize-none leading-relaxed shadow-inner"
                />
              </div>
            </div>

            {/* Save Button Bar */}
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/[0.08]">
              <span className="text-xs text-slate-400 font-medium">
                {data?.plan?.updatedAt ? `บันทึกล่าสุด: ${new Date(data.plan.updatedAt).toLocaleTimeString('th-TH')}` : ''}
              </span>

              <button
                onClick={() => handleSavePlan()}
                disabled={savingPlan}
                className="px-6 py-3 rounded-2xl text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xl shadow-emerald-600/30 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {savingPlan ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>กำลังบันทึก...</span>
                  </>
                ) : saveSuccess ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>บันทึกสำเร็จ!</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
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

        {/* Checklist Detail Modal */}
        <ChecklistDetailModal
          isOpen={Boolean(activeChecklistModalItem)}
          item={activeChecklistModalItem}
          onClose={() => setActiveChecklistModalItem(null)}
          onConfirmComplete={(id, newDoneState) => {
            handleToggleChecklist(id, newDoneState ?? true)
          }}
          marketOverview={data?.marketOverview}
          portfolioTriggers={data?.portfolioTriggers}
          totalCash={data?.totalCash}
          totalPortfolioValue={data?.totalPortfolioValue}
          baseCurrency={data?.baseCurrency}
        />
      </div>
    </AppShell>
  )
}
