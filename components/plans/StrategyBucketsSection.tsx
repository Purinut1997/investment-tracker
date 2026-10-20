'use client'

import React, { useState, useEffect, useMemo } from 'react'
import useSWR from 'swr'
import {
  Sparkles,
  Plus,
  Edit2,
  Trash2,
  X,
  Check,
  Loader2,
  Send,
  TrendingUp,
  TrendingDown,
  Target,
  ShieldAlert,
  Coins,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  MessageSquare,
  Zap,
  SlidersHorizontal,
  ExternalLink,
} from 'lucide-react'
import { HoldingItem } from '@/lib/analytics/holdings'
import {
  StrategyBucket,
  BucketStrategyType,
  STRATEGY_TYPE_META,
  computeBucketsWithHoldings,
  ComputedBucketItem,
} from '@/lib/analytics/strategy-buckets'
import { TechnicalSignal } from '@/lib/market-data/technical-signals'
import { StockLogo } from '@/components/StockLogo'

interface StrategyBucketsSectionProps {
  buckets: StrategyBucket[]
  holdings: HoldingItem[]
  totalCashBase: number
  totalPortfolioValue: number
  baseCurrency: string
  dcaBudget: number
  onSaveBuckets: (newBuckets: StrategyBucket[]) => Promise<void>
  onSelectStock: (stock: { symbol: string; name?: string; market?: string }) => void
  onQuickTrade: (data: { symbol: string; assetType?: string; market?: string }) => void
}

function renderFormattedAiAnswer(text: string) {
  const lines = text.split('\n').filter((l) => l.trim().length > 0)

  const highlightInline = (str: string) => {
    const parts = str.split(/(\*\*.*?\*\*)/g)
    return parts.map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        const inner = part.slice(2, -2)
        const isTicker = /^[A-Z]{1,6}(\.BK)?$/.test(inner)
        const isMoneyOrPct = /^[+$฿-]?\d/.test(inner)
        return (
          <strong
            key={idx}
            className={
              isTicker
                ? 'inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded bg-indigo-500/20 text-indigo-200 border border-indigo-500/30 font-mono text-[11px] font-bold'
                : isMoneyOrPct
                ? 'text-emerald-300 font-mono font-bold'
                : 'text-white font-semibold'
            }
          >
            {inner}
          </strong>
        )
      }
      return part
    })
  }

  return (
    <div className="space-y-2.5 text-xs sm:text-[13px] text-slate-200 leading-relaxed">
      {lines.map((line, idx) => {
        const trimmed = line.trim()
        if (trimmed.startsWith('###')) {
          const title = trimmed.replace(/^#+\s*/, '').replace(/\*\*/g, '')
          return (
            <h4
              key={idx}
              className="text-xs sm:text-sm font-bold text-indigo-300 pt-2 first:pt-0 border-t border-white/[0.06] first:border-t-0 flex items-center gap-1.5"
            >
              {title}
            </h4>
          )
        }
        if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-1">
              <span className="text-indigo-400 font-bold mt-0.5">•</span>
              <p className="flex-1">{highlightInline(trimmed.slice(2))}</p>
            </div>
          )
        }
        return <p key={idx}>{highlightInline(trimmed)}</p>
      })}
    </div>
  )
}

export function StrategyBucketsSection({
  buckets,
  holdings,
  totalCashBase,
  totalPortfolioValue,
  baseCurrency,
  dcaBudget,
  onSaveBuckets,
  onSelectStock,
  onQuickTrade,
}: StrategyBucketsSectionProps) {
  const { computedBuckets, unassignedHoldings } = useMemo(
    () => computeBucketsWithHoldings(buckets, holdings, totalCashBase, totalPortfolioValue),
    [buckets, holdings, totalCashBase, totalPortfolioValue]
  )

  // Collect all unique tickers across buckets and holdings for live technical signals
  const allTickers = useMemo(() => {
    const set = new Set<string>()
    holdings.forEach((h) => set.add(h.ticker.toUpperCase()))
    buckets.forEach((b) =>
      b.tickers.forEach((t) => {
        if (t.toUpperCase() !== 'CASH') set.add(t.toUpperCase())
      })
    )
    return Array.from(set)
  }, [holdings, buckets])

  const { data: signalsData } = useSWR<{ signals: Record<string, TechnicalSignal> }>(
    allTickers.length > 0
      ? `/api/market-data/technical-signals?tickers=${allTickers.join(',')}`
      : null,
    { revalidateOnFocus: false, dedupingInterval: 120000 }
  )
  const signals = signalsData?.signals || {}

  // Per-bucket AI Q&A states
  const [activeAiBucketId, setActiveAiBucketId] = useState<string | null>(null)
  const [customQuestions, setCustomQuestions] = useState<Record<string, string>>({})
  const [loadingBucketId, setLoadingBucketId] = useState<string | null>(null)
  const [bucketAnswers, setBucketAnswers] = useState<
    Record<string, { question: string; answer: string; updatedAt: string; modelUsed?: string }>
  >({})
  const [bucketErrors, setBucketErrors] = useState<Record<string, string>>({})

  // Load saved AI answers per bucket from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const saved = localStorage.getItem('bucket_ai_answers_v1')
      if (saved) {
        setBucketAnswers(JSON.parse(saved))
      }
    } catch {}
  }, [])

  // Add ticker inline state per bucket
  const [addingTickerForBucket, setAddingTickerForBucket] = useState<string | null>(null)
  const [newTickerInput, setNewTickerInput] = useState('')
  const [savingBuckets, setSavingBuckets] = useState(false)

  // Bucket create/edit modal state
  const [editingBucket, setEditingBucket] = useState<StrategyBucket | null>(null)
  const [isBucketModalOpen, setIsBucketModalOpen] = useState(false)
  const [bucketForm, setBucketForm] = useState<{
    id: string
    name: string
    emoji: string
    strategyType: BucketStrategyType
    description: string
    targetPercent: number
    tickersText: string
    takeProfitPercent: number
    stopLossPercent: number
  }>({
    id: '',
    name: '',
    emoji: '🌱',
    strategyType: 'LONG_TERM',
    description: '',
    targetPercent: 25,
    tickersText: '',
    takeProfitPercent: 15,
    stopLossPercent: 8,
  })

  async function handleAskBucketAi(bucket: ComputedBucketItem, questionText: string) {
    const cleanQ = questionText.trim()
    if (!cleanQ || loadingBucketId) return

    setActiveAiBucketId(bucket.id)
    setLoadingBucketId(bucket.id)
    setBucketErrors((prev) => ({ ...prev, [bucket.id]: '' }))

    try {
      const res = await fetch('/api/ai-advisor/bucket-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bucket: {
            id: bucket.id,
            name: bucket.name,
            strategyType: bucket.strategyType,
            description: bucket.description,
            targetPercent: bucket.targetPercent,
            actualPercent: bucket.actualPercent,
            tickers: bucket.tickers,
            takeProfitPercent: bucket.takeProfitPercent,
            stopLossPercent: bucket.stopLossPercent,
          },
          question: cleanQ,
          dcaBudget,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'ถาม AI ไม่สำเร็จ')

      const nextAnswers = {
        ...bucketAnswers,
        [bucket.id]: {
          question: cleanQ,
          answer: data.answer,
          updatedAt: data.updatedAt || new Date().toISOString(),
          modelUsed: data.modelUsed,
        },
      }
      setBucketAnswers(nextAnswers)
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('bucket_ai_answers_v1', JSON.stringify(nextAnswers))
        } catch {}
      }
    } catch (err: any) {
      setBucketErrors((prev) => ({
        ...prev,
        [bucket.id]: err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ AI',
      }))
    } finally {
      setLoadingBucketId(null)
    }
  }

  async function handleAssignTickerToBucket(ticker: string, targetBucketId: string) {
    const sym = ticker.trim().toUpperCase()
    if (!sym) return
    setSavingBuckets(true)
    try {
      const next = buckets.map((b) => {
        const filtered = b.tickers.filter((t) => t.toUpperCase() !== sym)
        if (b.id === targetBucketId) {
          return { ...b, tickers: [...filtered, sym] }
        }
        return { ...b, tickers: filtered }
      })
      await onSaveBuckets(next)
      setNewTickerInput('')
      setAddingTickerForBucket(null)
    } finally {
      setSavingBuckets(false)
    }
  }

  async function handleRemoveTickerFromBucket(ticker: string, bucketId: string) {
    const sym = ticker.trim().toUpperCase()
    setSavingBuckets(true)
    try {
      const next = buckets.map((b) =>
        b.id === bucketId
          ? { ...b, tickers: b.tickers.filter((t) => t.toUpperCase() !== sym) }
          : b
      )
      await onSaveBuckets(next)
    } finally {
      setSavingBuckets(false)
    }
  }

  function openNewBucketModal() {
    setEditingBucket(null)
    setBucketForm({
      id: `bucket-${Date.now()}`,
      name: '',
      emoji: '🎯',
      strategyType: 'SHORT_TERM',
      description: STRATEGY_TYPE_META.SHORT_TERM.defaultDescription,
      targetPercent: 15,
      tickersText: '',
      takeProfitPercent: 15,
      stopLossPercent: 8,
    })
    setIsBucketModalOpen(true)
  }

  function openEditBucketModal(b: StrategyBucket) {
    setEditingBucket(b)
    setBucketForm({
      id: b.id,
      name: b.name,
      emoji: b.emoji,
      strategyType: b.strategyType,
      description: b.description,
      targetPercent: b.targetPercent,
      tickersText: b.tickers.filter((t) => t !== 'CASH').join(', '),
      takeProfitPercent: b.takeProfitPercent ?? 15,
      stopLossPercent: b.stopLossPercent ?? 8,
    })
    setIsBucketModalOpen(true)
  }

  async function handleSaveBucketModal(e: React.FormEvent) {
    e.preventDefault()
    if (!bucketForm.name.trim()) return

    setSavingBuckets(true)
    try {
      const parsedTickers =
        bucketForm.strategyType === 'CASH'
          ? ['CASH']
          : bucketForm.tickersText
              .split(',')
              .map((t) => t.trim().toUpperCase())
              .filter(Boolean)

      const newBucketObj: StrategyBucket = {
        id: bucketForm.id,
        name: bucketForm.name.trim(),
        emoji: bucketForm.emoji || STRATEGY_TYPE_META[bucketForm.strategyType].emoji,
        strategyType: bucketForm.strategyType,
        description:
          bucketForm.description.trim() ||
          STRATEGY_TYPE_META[bucketForm.strategyType].defaultDescription,
        targetPercent: Number(bucketForm.targetPercent) || 0,
        tickers: parsedTickers,
        ...(bucketForm.strategyType === 'SHORT_TERM' && {
          takeProfitPercent: Number(bucketForm.takeProfitPercent) || 15,
          stopLossPercent: Number(bucketForm.stopLossPercent) || 8,
        }),
      }

      const exists = buckets.some((b) => b.id === newBucketObj.id)
      const next = exists
        ? buckets.map((b) => (b.id === newBucketObj.id ? newBucketObj : b))
        : [...buckets, newBucketObj]

      await onSaveBuckets(next)
      setIsBucketModalOpen(false)
    } finally {
      setSavingBuckets(false)
    }
  }

  async function handleDeleteBucket(bucketId: string) {
    if (buckets.length <= 1) return
    setSavingBuckets(true)
    try {
      const next = buckets.filter((b) => b.id !== bucketId)
      await onSaveBuckets(next)
      setIsBucketModalOpen(false)
    } finally {
      setSavingBuckets(false)
    }
  }

  const totalTargetPercent = computedBuckets.reduce((s, b) => s + b.targetPercent, 0)

  return (
    <div className="space-y-6">
      {/* ── HEADER & MULTI-BUCKET OVERVIEW BAR ───────────────────── */}
      <div className="rounded-3xl bg-[#12151C] border border-white/[0.08] p-5 sm:p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-white/[0.06]">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                Dime!-Style Custom Strategy Pies
              </span>
              <span
                className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                  Math.abs(totalTargetPercent - 100) <= 0.5
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                }`}
              >
                เป้าหมายรวม {totalTargetPercent}%
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-white mt-2">
              จัดตะกร้าพอร์ตตามกลยุทธ์ & ถาม AI รายส่วน
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              แยกสัดส่วนหุ้นถือยาวเพื่ออนาคต, หุ้นปันผล, และหุ้นเก็งกำไรระยะสั้น พร้อมถาม AI เจาะลึกเฉพาะแต่ละตะกร้าได้ทันที
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
            <button
              type="button"
              onClick={openNewBucketModal}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>สร้างตะกร้ากลยุทธ์เพิ่ม</span>
            </button>
          </div>
        </div>

        {/* Visual Stacked Bar of Buckets */}
        <div className="mt-5 space-y-2.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>สัดส่วนจริงแยกตามตะกร้ากลยุทธ์</span>
            <span className="font-mono text-slate-300">
              มูลค่าพอร์ตรวม ฿{Math.round(totalPortfolioValue).toLocaleString()}
            </span>
          </div>
          <div className="h-3.5 w-full rounded-full bg-slate-900 overflow-hidden flex p-0.5 gap-0.5 border border-white/[0.06]">
            {computedBuckets.map((b) => {
              const meta = STRATEGY_TYPE_META[b.strategyType] || STRATEGY_TYPE_META.CUSTOM
              const widthPct = Math.max(b.actualPercent, 2)
              return (
                <div
                  key={b.id}
                  style={{
                    width: `${widthPct}%`,
                    backgroundColor: meta.accentColor,
                  }}
                  className="h-full first:rounded-l-full last:rounded-r-full transition-all duration-500"
                  title={`${b.emoji} ${b.name}: จริง ${b.actualPercent}% (เป้า ${b.targetPercent}%)`}
                />
              )
            })}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            {computedBuckets.map((b) => {
              const meta = STRATEGY_TYPE_META[b.strategyType] || STRATEGY_TYPE_META.CUSTOM
              return (
                <div
                  key={b.id}
                  className="p-2.5 rounded-xl bg-[#171B24] border border-white/[0.05] flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: meta.accentColor }}
                    />
                    <span className="text-xs font-semibold text-slate-200 truncate">
                      {b.emoji} {b.name}
                    </span>
                  </div>
                  <span className="text-xs font-mono font-bold text-white shrink-0">
                    {b.actualPercent}%{' '}
                    <span className="text-[10px] text-slate-400 font-normal">/{b.targetPercent}%</span>
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Unassigned Holdings Quick-Assign Banner */}
        {unassignedHoldings.length > 0 && (
          <div className="mt-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-amber-300">
                📌 มีสินทรัพย์ในพอร์ต {unassignedHoldings.length} รายการที่ยังไม่ได้จัดเข้าตะกร้ากลยุทธ์
              </p>
              <p className="text-[11px] text-amber-200/80 mt-0.5">
                คลิกเลือกตะกร้าให้กับหุ้นแต่ละตัวเพื่อให้ระบบคำนวณสัดส่วนและให้ AI วิเคราะห์ได้ตรงกลุ่ม
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {unassignedHoldings.map((uh) => (
                <div
                  key={uh.ticker}
                  className="flex items-center gap-1.5 bg-[#141821] border border-amber-500/30 px-2.5 py-1.5 rounded-xl text-xs"
                >
                  <span className="font-mono font-bold text-white">{uh.ticker}</span>
                  <span className="text-slate-500">→</span>
                  {computedBuckets
                    .filter((b) => b.strategyType !== 'CASH')
                    .map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        disabled={savingBuckets}
                        onClick={() => handleAssignTickerToBucket(uh.ticker, b.id)}
                        className="px-2 py-0.5 rounded-lg bg-white/[0.05] hover:bg-indigo-600/30 text-[11px] text-slate-200 hover:text-white border border-white/[0.08] transition-colors cursor-pointer"
                        title={`ย้าย ${uh.ticker} เข้า ${b.name}`}
                      >
                        {b.emoji} {STRATEGY_TYPE_META[b.strategyType]?.shortLabel || b.name.slice(0, 8)}
                      </button>
                    ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── BUCKET CARDS GRID ────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {computedBuckets.map((bucket) => {
          const meta = STRATEGY_TYPE_META[bucket.strategyType] || STRATEGY_TYPE_META.CUSTOM
          const isCashBucket = bucket.strategyType === 'CASH'
          const isProfit = bucket.unrealizedPnLBase >= 0
          const savedAi = bucketAnswers[bucket.id]
          const isAskingThis = loadingBucketId === bucket.id
          const errText = bucketErrors[bucket.id]

          return (
            <div
              key={bucket.id}
              className="rounded-3xl bg-[#12151C] border border-white/[0.08] hover:border-white/[0.14] transition-all flex flex-col justify-between overflow-hidden shadow-xl"
            >
              <div>
                {/* Bucket Card Top Header */}
                <div className="p-5 sm:p-6 border-b border-white/[0.06] bg-gradient-to-br from-white/[0.02] to-transparent">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0 border border-white/10 shadow-inner"
                        style={{ backgroundColor: `${meta.accentColor}20` }}
                      >
                        {bucket.emoji}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base sm:text-lg font-bold text-white truncate">
                            {bucket.name}
                          </h3>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${meta.badgeClass}`}
                          >
                            {meta.shortLabel}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                          {bucket.description}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => openEditBucketModal(bucket)}
                      className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.06] border border-transparent hover:border-white/10 transition-colors shrink-0 cursor-pointer"
                      title="แก้ไขชื่อตะกร้า สัดส่วนเป้าหมาย หรือกติกาทำกำไร"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Bucket KPI Strip */}
                  <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-white/[0.06]">
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        มูลค่าในตะกร้านี้
                      </span>
                      <p className="text-base sm:text-lg font-bold font-mono text-white mt-0.5 tabular-nums">
                        ฿{Math.round(bucket.actualValueBase).toLocaleString()}
                      </p>
                    </div>

                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        สัดส่วนจริง / เป้าหมาย
                      </span>
                      <div className="flex items-baseline gap-1.5 mt-0.5 font-mono">
                        <span className="text-base sm:text-lg font-bold text-white">
                          {bucket.actualPercent}%
                        </span>
                        <span className="text-xs text-slate-400">/ {bucket.targetPercent}%</span>
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        {isCashBucket ? 'สถานะสภาพคล่อง' : 'กำไร/ขาดทุนในตะกร้า'}
                      </span>
                      {isCashBucket ? (
                        <p className="text-xs sm:text-sm font-bold text-cyan-300 mt-1 font-mono">
                          พร้อมช้อนทันที
                        </p>
                      ) : (
                        <p
                          className={`text-sm sm:text-base font-bold font-mono mt-0.5 tabular-nums ${
                            isProfit ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {isProfit ? '+' : ''}
                          {bucket.unrealizedPnLPercent.toFixed(1)}%
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Short-Term Target Rules Strip */}
                  {bucket.strategyType === 'SHORT_TERM' && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-mono">
                        🎯 เป้า Take Profit: +{bucket.takeProfitPercent ?? 15}% (หรือชนแนวต้าน R1)
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-300 border border-rose-500/20 font-mono">
                        🛡️ จุด Stop Loss: -{bucket.stopLossPercent ?? 8}% (หรือหลุด S1)
                      </span>
                    </div>
                  )}
                </div>

                {/* Holdings List inside Bucket */}
                <div className="p-5 sm:p-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-indigo-400" />
                      {isCashBucket
                        ? 'ยอดเงินสดสำรองในบัญชี'
                        : `สินทรัพย์ในตะกร้านี้ (${bucket.holdings.length + bucket.unheldTickers.length})`}
                    </span>

                    {!isCashBucket && (
                      <button
                        type="button"
                        onClick={() =>
                          setAddingTickerForBucket(
                            addingTickerForBucket === bucket.id ? null : bucket.id
                          )
                        }
                        className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>เพิ่ม/ย้ายหุ้นเข้าตะกร้า</span>
                      </button>
                    )}
                  </div>

                  {/* Inline Add/Move Ticker Panel */}
                  {addingTickerForBucket === bucket.id && !isCashBucket && (
                    <div className="p-3.5 rounded-2xl bg-[#181C26] border border-indigo-500/30 space-y-2.5 animate-fade-in">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={newTickerInput}
                          onChange={(e) => setNewTickerInput(e.target.value.toUpperCase())}
                          placeholder="พิมพ์ชื่อหุ้น เช่น NVDA, SCHD, PTT..."
                          className="flex-1 bg-[#10131A] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              handleAssignTickerToBucket(newTickerInput, bucket.id)
                            }
                          }}
                        />
                        <button
                          type="button"
                          disabled={!newTickerInput.trim() || savingBuckets}
                          onClick={() => handleAssignTickerToBucket(newTickerInput, bucket.id)}
                          className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold disabled:opacity-50 cursor-pointer"
                        >
                          เพิ่ม
                        </button>
                      </div>

                      {/* Quick pick from existing portfolio holdings */}
                      {holdings.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <span className="text-[10px] text-slate-400 mr-1">ดึงจากพอร์ต:</span>
                          {holdings.map((h) => {
                            const inThisBucket = bucket.tickers.includes(h.ticker.toUpperCase())
                            return (
                              <button
                                key={h.ticker}
                                type="button"
                                disabled={inThisBucket || savingBuckets}
                                onClick={() => handleAssignTickerToBucket(h.ticker, bucket.id)}
                                className={`px-2 py-0.5 rounded-lg text-[11px] font-mono font-semibold border transition-colors ${
                                  inThisBucket
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 opacity-60'
                                    : 'bg-white/[0.04] hover:bg-indigo-500/20 text-slate-200 border-white/10 cursor-pointer'
                                }`}
                              >
                                {inThisBucket ? `✓ ${h.ticker}` : `+ ${h.ticker}`}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {isCashBucket ? (
                    <div className="p-4 rounded-2xl bg-[#171B24] border border-white/[0.05] flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold text-slate-200">
                          💵 เงินสดรวมทุกบัญชี (Dime! Save / USD / THB)
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          พร้อมใช้สำหรับช้อนหุ้นเมื่อเกิดสัญญาณแนวรับ S1 หรือปรับสมดุลพอร์ต
                        </p>
                      </div>
                      <span className="text-base font-bold font-mono text-cyan-300">
                        ฿{Math.round(totalCashBase).toLocaleString()}
                      </span>
                    </div>
                  ) : bucket.holdings.length === 0 && bucket.unheldTickers.length === 0 ? (
                    <div className="p-6 rounded-2xl bg-[#161A23] border border-dashed border-white/10 text-center">
                      <p className="text-xs text-slate-400">
                        ยังไม่มีหุ้นในตะกร้านี้ กด <strong className="text-indigo-300">+ เพิ่ม/ย้ายหุ้นเข้าตะกร้า</strong> ด้านบนได้เลย
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                      {bucket.holdings.map((h) => {
                        const sym = h.currency === 'USD' ? '$' : '฿'
                        const sig = signals[h.ticker.toUpperCase()]
                        const pnl = Number(h.unrealizedPnLPercent || 0)
                        const hitTakeProfit =
                          bucket.strategyType === 'SHORT_TERM' &&
                          pnl >= (bucket.takeProfitPercent ?? 15)
                        const hitStopLoss =
                          bucket.strategyType === 'SHORT_TERM' &&
                          pnl <= -(bucket.stopLossPercent ?? 8)

                        return (
                          <div
                            key={h.ticker}
                            className="p-3 rounded-2xl bg-[#171B24] hover:bg-[#1C212C] border border-white/[0.06] transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 group"
                          >
                            <div
                              onClick={() =>
                                onSelectStock({
                                  symbol: h.ticker,
                                  name: h.assetName,
                                  market: h.market,
                                })
                              }
                              className="flex items-center gap-2.5 min-w-0 cursor-pointer"
                            >
                              <StockLogo ticker={h.ticker} name={h.assetName} size={32} />
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-mono font-bold text-sm text-white group-hover:text-indigo-300 transition-colors">
                                    {h.ticker}
                                  </span>
                                  <span className="text-[11px] font-mono text-slate-300">
                                    {sym}
                                    {Number(h.currentPrice).toFixed(2)}
                                  </span>
                                  {hitTakeProfit && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                      🎯 ถึงเป้าทำกำไร!
                                    </span>
                                  )}
                                  {hitStopLoss && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40">
                                      🛡️ เตือนจุดคัทลอส
                                    </span>
                                  )}
                                  {sig && sig.signalType !== 'NEUTRAL' && (
                                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                                      {sig.badgeText}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-400 font-mono mt-0.5 flex flex-wrap items-center gap-2">
                                  <span>ทุน {sym}{Number(h.avgCost).toFixed(2)}</span>
                                  {sig?.supportS1 && (
                                    <span className="text-emerald-400/90">
                                      รับ S1: {sym}{sig.supportS1.toFixed(2)}
                                    </span>
                                  )}
                                  {sig?.resistanceR1 && (
                                    <span className="text-amber-300/90">
                                      ต้าน R1: {sym}{sig.resistanceR1.toFixed(2)}
                                    </span>
                                  )}
                                  {sig?.rsi14 !== null && sig?.rsi14 !== undefined && (
                                    <span>RSI {sig.rsi14}</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0">
                              <div className="text-right font-mono">
                                <div className="text-xs font-bold text-white">
                                  ฿{Math.round(h.currentValueBase).toLocaleString()}
                                </div>
                                <div
                                  className={`text-[11px] font-bold ${
                                    pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                                  }`}
                                >
                                  {pnl >= 0 ? '+' : ''}
                                  {pnl.toFixed(1)}%
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  onQuickTrade({
                                    symbol: h.ticker,
                                    assetType: h.assetType,
                                    market: h.market,
                                  })
                                }
                                className="px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 text-[11px] font-semibold transition-all cursor-pointer"
                                title={`บันทึกซื้อ/ขาย ${h.ticker}`}
                              >
                                ซื้อ/ขาย
                              </button>

                              <button
                                type="button"
                                onClick={() => handleRemoveTickerFromBucket(h.ticker, bucket.id)}
                                className="p-1 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                                title="นำออกจากตะกร้านี้"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        )
                      })}

                      {/* Unheld Target Tickers in Bucket */}
                      {bucket.unheldTickers.map((sym) => {
                        const sig = signals[sym]
                        return (
                          <div
                            key={sym}
                            className="p-3 rounded-2xl bg-[#141821]/70 border border-dashed border-white/10 flex items-center justify-between gap-2"
                          >
                            <div
                              onClick={() => onSelectStock({ symbol: sym })}
                              className="flex items-center gap-2.5 cursor-pointer"
                            >
                              <StockLogo ticker={sym} name={sym} size={28} />
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-xs text-slate-200">
                                    {sym}
                                  </span>
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                                    เป้าหมายในตะกร้า (ยังไม่ได้ถือ)
                                  </span>
                                </div>
                                {sig && (
                                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                                    ราคา ${sig.currentPrice?.toFixed(2)} | แนวรับ S1: $
                                    {sig.supportS1?.toFixed(2) ?? '-'} | RSI {sig.rsi14 ?? '-'}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => onQuickTrade({ symbol: sym })}
                                className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-[11px] font-semibold cursor-pointer"
                              >
                                + ซื้อไม้แรก
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveTickerFromBucket(sym, bucket.id)}
                                className="p-1 text-slate-500 hover:text-rose-400 cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* ── PER-BUCKET INTERACTIVE AI COPILOT ────────────────────── */}
              <div className="p-5 sm:p-6 bg-[#0E1117] border-t border-white/[0.07] space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-400" />
                    <span className="text-xs font-bold text-white">
                      ถาม AI เฉพาะส่วน &ldquo;{bucket.name}&rdquo;
                    </span>
                  </div>
                  {savedAi && (
                    <span className="text-[10px] text-slate-500 font-mono">
                      วิเคราะห์ล่าสุด{' '}
                      {new Date(savedAi.updatedAt).toLocaleTimeString('th-TH', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  )}
                </div>

                {/* 1-Click Quick Question Pills */}
                <div className="flex flex-wrap gap-1.5">
                  {meta.quickPrompts.map((q, qIdx) => (
                    <button
                      key={qIdx}
                      type="button"
                      disabled={isAskingThis}
                      onClick={() => handleAskBucketAi(bucket, q)}
                      className="text-left text-[11px] px-2.5 py-1.5 rounded-xl bg-[#171C28] hover:bg-indigo-600/20 text-slate-300 hover:text-indigo-200 border border-white/[0.07] hover:border-indigo-500/40 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {q}
                    </button>
                  ))}
                </div>

                {/* Custom Question Input */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    const q = customQuestions[bucket.id] || ''
                    if (q.trim()) {
                      handleAskBucketAi(bucket, q)
                    }
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={customQuestions[bucket.id] || ''}
                    onChange={(e) =>
                      setCustomQuestions((prev) => ({
                        ...prev,
                        [bucket.id]: e.target.value,
                      }))
                    }
                    placeholder={`ถาม AI เกี่ยวกับ ${bucket.name} เช่น ระยะนี้ควรเล่นแบบไหน...`}
                    className="flex-1 bg-[#151922] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="submit"
                    disabled={isAskingThis || !(customQuestions[bucket.id] || '').trim()}
                    className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50 transition-all shrink-0 cursor-pointer"
                  >
                    {isAskingThis ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>กำลังคิด...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>ถาม AI</span>
                      </>
                    )}
                  </button>
                </form>

                {errText && (
                  <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2">
                    {errText}
                  </p>
                )}

                {/* AI Answer Display Box */}
                {isAskingThis && (
                  <div className="p-4 rounded-2xl bg-indigo-950/20 border border-indigo-500/25 flex items-center gap-3 text-xs text-indigo-200 animate-pulse">
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-400 shrink-0" />
                    <span>
                      กำลังดึงราคาแนวรับ S1/R1, ค่า RSI และต้นทุนพอร์ตในตะกร้า &ldquo;{bucket.name}&rdquo; มาวางแผนให้คุณ...
                    </span>
                  </div>
                )}

                {!isAskingThis && savedAi && (
                  <div className="p-4 rounded-2xl bg-[#141822] border border-indigo-500/25 space-y-2.5 animate-fade-in">
                    <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/[0.06]">
                      <span className="text-[11px] font-semibold text-indigo-300 truncate">
                        💬 คำถาม: &ldquo;{savedAi.question}&rdquo;
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const next = { ...bucketAnswers }
                          delete next[bucket.id]
                          setBucketAnswers(next)
                        }}
                        className="text-[10px] text-slate-500 hover:text-slate-300 shrink-0 cursor-pointer"
                      >
                        ซ่อนคำตอบ
                      </button>
                    </div>
                    {renderFormattedAiAnswer(savedAi.answer)}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── CREATE / EDIT BUCKET MODAL ───────────────────────────── */}
      {isBucketModalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsBucketModalOpen(false)
          }}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <div className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl bg-[#121620] border border-white/10 p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-base font-bold text-white">
                {editingBucket ? 'แก้ไขตะกร้ากลยุทธ์' : 'สร้างตะกร้ากลยุทธ์ใหม่'}
              </h3>
              <button
                type="button"
                onClick={() => setIsBucketModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBucketModal} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  รูปแบบกลยุทธ์ของตะกร้านี้
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['LONG_TERM', 'DIVIDEND', 'SHORT_TERM', 'CUSTOM'] as BucketStrategyType[]).map(
                    (st) => {
                      const m = STRATEGY_TYPE_META[st]
                      const active = bucketForm.strategyType === st
                      return (
                        <button
                          key={st}
                          type="button"
                          onClick={() =>
                            setBucketForm((prev) => ({
                              ...prev,
                              strategyType: st,
                              emoji: m.emoji,
                              name: prev.name || m.label.split(' (')[0],
                              description: m.defaultDescription,
                            }))
                          }
                          className={`p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                            active
                              ? 'bg-indigo-600/20 border-indigo-500 text-white font-semibold'
                              : 'bg-[#171B26] border-white/10 text-slate-300 hover:border-white/20'
                          }`}
                        >
                          <div className="font-bold">
                            {m.emoji} {m.shortLabel}
                          </div>
                        </button>
                      )
                    }
                  )}
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3">
                <div className="col-span-1">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">ไอคอน</label>
                  <input
                    type="text"
                    value={bucketForm.emoji}
                    onChange={(e) => setBucketForm((prev) => ({ ...prev, emoji: e.target.value }))}
                    className="w-full bg-[#171B26] border border-white/10 rounded-xl px-3 py-2 text-center text-base text-white"
                  />
                </div>
                <div className="col-span-3">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    ชื่อตะกร้าพอร์ต
                  </label>
                  <input
                    type="text"
                    required
                    value={bucketForm.name}
                    onChange={(e) => setBucketForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="เช่น พอร์ตเก็งกำไรระยะสั้น, พอร์ตปันผลเกษียณ"
                    className="w-full bg-[#171B26] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    สัดส่วนเป้าหมาย (%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={bucketForm.targetPercent}
                    onChange={(e) =>
                      setBucketForm((prev) => ({ ...prev, targetPercent: Number(e.target.value) }))
                    }
                    className="w-full bg-[#171B26] border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>

                {bucketForm.strategyType === 'SHORT_TERM' && (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-emerald-300 mb-1">
                        เป้าทำกำไร Take Profit (%)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={500}
                        value={bucketForm.takeProfitPercent}
                        onChange={(e) =>
                          setBucketForm((prev) => ({
                            ...prev,
                            takeProfitPercent: Number(e.target.value),
                          }))
                        }
                        className="w-full bg-[#171B26] border border-emerald-500/30 rounded-xl px-3 py-2 text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-rose-300 mb-1">
                        จุดคัทลอส Stop Loss (%)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={bucketForm.stopLossPercent}
                        onChange={(e) =>
                          setBucketForm((prev) => ({
                            ...prev,
                            stopLossPercent: Number(e.target.value),
                          }))
                        }
                        className="w-full bg-[#171B26] border border-rose-500/30 rounded-xl px-3 py-2 text-xs text-white font-mono"
                      />
                    </div>
                  </>
                )}
              </div>

              {bucketForm.strategyType !== 'CASH' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    รายชื่อหุ้นในตะกร้านี้ (คั่นด้วยลูกน้ำ ,)
                  </label>
                  <input
                    type="text"
                    value={bucketForm.tickersText}
                    onChange={(e) =>
                      setBucketForm((prev) => ({
                        ...prev,
                        tickersText: e.target.value.toUpperCase(),
                      }))
                    }
                    placeholder="เช่น VOO, QQQM, GOOGL"
                    className="w-full bg-[#171B26] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white font-mono"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  คำอธิบาย / กติกาประจำตะกร้า (AI จะใช้เป็นโจทย์วิเคราะห์)
                </label>
                <textarea
                  rows={2}
                  value={bucketForm.description}
                  onChange={(e) =>
                    setBucketForm((prev) => ({ ...prev, description: e.target.value }))
                  }
                  className="w-full bg-[#171B26] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-white/10">
                {editingBucket && buckets.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteBucket(editingBucket.id)}
                    className="px-3 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>ลบตะกร้านี้</span>
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsBucketModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={savingBuckets}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer"
                  >
                    {savingBuckets ? 'กำลังบันทึก...' : 'บันทึกตะกร้า'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
