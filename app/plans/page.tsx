'use client'

import React, { useState, useEffect, useMemo } from 'react'
import useSWR, { mutate } from 'swr'
import Link from 'next/link'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/PageHeader'
import { QuickAddModal } from '@/components/QuickAddModal'
import {
  Scale,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  X,
  Loader2,
  PieChart,
  ArrowRight,
  Sparkles,
  Clock,
  Coins,
  ShieldCheck,
  AlertTriangle,
  SlidersHorizontal,
  Copy,
  Check,
  Zap,
  DollarSign,
  Layers,
  ArrowDownRight,
  ArrowUpRight,
  RefreshCw,
  Wallet,
  Activity,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  PauseCircle,
} from 'lucide-react'
import CountUp from 'react-countup'
import { SubAllocationDrillDown } from '@/components/plans/SubAllocationDrillDown'
import { AiAdvisorDisplay } from '@/components/plans/AiAdvisorDisplay'
import {
  calculatePortfolioRebalance,
  RebalanceMode,
  RebalancePlanResult,
} from '@/lib/analytics/rebalancing'
import {
  STRATEGY_TEMPLATES,
  StrategyTemplate,
} from '@/lib/analytics/preset-templates'

const DEFAULT_CATEGORIES = ['US', 'TH', 'CRYPTO', 'GOLD', 'CASH']

const CATEGORY_CONFIG: Record<
  string,
  { label: string; emoji: string; color: string; barColor: string; bg: string }
> = {
  US: { label: 'หุ้นสหรัฐ', emoji: '🇺🇸', color: 'text-blue-400', barColor: 'bg-blue-500', bg: 'bg-blue-500/10 border-blue-500/20' },
  TH: { label: 'หุ้นไทย', emoji: '🇹🇭', color: 'text-emerald-400', barColor: 'bg-emerald-500', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  CRYPTO: { label: 'คริปโต', emoji: '🪙', color: 'text-amber-400', barColor: 'bg-amber-500', bg: 'bg-amber-500/10 border-amber-500/20' },
  GOLD: { label: 'ทองคำ', emoji: '🏆', color: 'text-yellow-300', barColor: 'bg-yellow-400', bg: 'bg-yellow-400/10 border-yellow-400/20' },
  CASH: { label: 'เงินสดและตราสารหนี้', emoji: '💵', color: 'text-cyan-400', barColor: 'bg-cyan-500', bg: 'bg-cyan-500/10 border-cyan-500/20' },
}

const RISK_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  conservative: { label: 'ระมัดระวัง (Conservative)', color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/20' },
  moderate: { label: 'สมดุล (Moderate)', color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/20' },
  aggressive: { label: 'เชิงรุก (Aggressive)', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
}

interface AllocationPreset {
  id: string
  presetName: string
  riskProfile: string
  targetAllocation: Record<string, number>
  subTargets?: Record<string, Record<string, number>>
  monthlyContribution: number | string
  targetAmount: number | string
  targetDate: string | null
  isDefault: boolean
}

function asAllocation(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object') return {}
  const out: Record<string, number> = {}
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (key.startsWith('_')) continue
    const n = Number(raw)
    if (!Number.isNaN(n)) out[key] = n
  }
  return out
}

function parsePresets(data: unknown): AllocationPreset[] {
  if (!data || typeof data !== 'object' || !('presets' in data)) return []
  const list = (data as { presets?: unknown }).presets
  if (!Array.isArray(list)) return []
  return list
    .filter((item): item is AllocationPreset => {
      if (!item || typeof item !== 'object') return false
      const record = item as Record<string, unknown>
      return typeof record.id === 'string' && typeof record.presetName === 'string'
    })
    .map((item) => {
      const rawAlloc =
        item.targetAllocation && typeof item.targetAllocation === 'object'
          ? (item.targetAllocation as Record<string, any>)
          : {}
      const subTargets = rawAlloc._subTargets || {}
      return {
        ...item,
        targetAllocation: asAllocation(item.targetAllocation),
        subTargets,
      }
    })
}

export default function PlansPage() {
  const { data, isLoading, error, mutate: revalidate } = useSWR('/api/plans')
  const presets = parsePresets(data)
  const actualAllocation: Record<string, number> = data?.actualAllocation ?? {}
  const totalValue: number = data?.totalPortfolioValue ?? 0
  const totalCash: number = data?.totalCash ?? 0
  const baseCurrency: string = data?.baseCurrency ?? 'THB'
  const holdings = data?.holdings ?? []

  const [modalOpen, setModalOpen] = useState(false)
  const [editingPreset, setEditingPreset] = useState<AllocationPreset | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  const defaultPreset = presets.find((p) => p.isDefault) ?? presets[0]
  const [selectedPresetId, setSelectedPresetId] = useState<string>('')
  const activePreset =
    presets.find((p) => p.id === (selectedPresetId || defaultPreset?.id)) ?? defaultPreset

  // Rebalancing Simulator States
  const [cashInflow, setCashInflow] = useState<number>(20000)
  const [rebalanceMode, setRebalanceMode] = useState<RebalanceMode>('CASH_FLOW')
  const [toleranceBand, setToleranceBand] = useState<number>(3.0)
  const [copied, setCopied] = useState(false)
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({ US: true })

  function toggleExpandCategory(catKey: string) {
    setExpandedCategories((prev) => ({
      ...prev,
      [catKey]: !prev[catKey],
    }))
  }

  async function handleSaveSubTargets(categoryKey: string, newSubTargets: Record<string, number>) {
    if (!activePreset?.id) return
    const key = categoryKey.toUpperCase()
    const updatedSubTargets = {
      ...(activePreset.subTargets || {}),
      [key]: newSubTargets,
    }
    const updatedAllocation = {
      ...activePreset.targetAllocation,
      _subTargets: updatedSubTargets,
    }

    try {
      const res = await fetch(`/api/plans/${activePreset.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetAllocation: updatedAllocation,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to update sub-targets')
      }
      await revalidate()
    } catch (err: any) {
      console.error('[save sub-targets]', err)
    }
  }

  // QuickAddModal integration
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [quickAddInitialData, setQuickAddInitialData] = useState<{
    symbol?: string
    assetType?: string
    amount?: number
    market?: string
  } | null>(null)

  // AI Advisor State
  const { data: aiAdvisorData, mutate: mutateAiAdvisor } = useSWR('/api/ai-advisor/analyze', {
    revalidateOnFocus: false,
  })
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  // Update default monthly inflow from active preset
  useEffect(() => {
    if (activePreset?.monthlyContribution && Number(activePreset.monthlyContribution) > 0) {
      setCashInflow(Number(activePreset.monthlyContribution))
    }
  }, [activePreset?.id, activePreset?.monthlyContribution])

  // Compute Smart Rebalance Plan
  const rebalancePlan: RebalancePlanResult | null = useMemo(() => {
    if (!activePreset?.targetAllocation || Object.keys(activePreset.targetAllocation).length === 0) {
      return null
    }

    return calculatePortfolioRebalance({
      holdings,
      totalCashBase: totalCash,
      targetAllocation: activePreset.targetAllocation,
      cashInflowBase: cashInflow,
      mode: rebalanceMode,
      tolerancePercent: toleranceBand,
      baseCurrency,
    })
  }, [holdings, totalCash, activePreset, cashInflow, rebalanceMode, toleranceBand, baseCurrency])

  async function handleRunAiAdvisor() {
    setIsAiAnalyzing(true)
    setAiError(null)
    try {
      const res = await fetch('/api/ai-advisor/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          presetName: activePreset?.presetName,
          targetAllocation: activePreset?.targetAllocation,
          monthlyContribution: cashInflow || Number(activePreset?.monthlyContribution) || 5000,
          subAllocations: activePreset?.subTargets || undefined,
        }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'วิเคราะห์ไม่สำเร็จ')
      await mutateAiAdvisor(result, false)
    } catch (err: any) {
      setAiError(err.message || 'เกิดข้อผิดพลาดในการวิเคราะห์')
    } finally {
      setIsAiAnalyzing(false)
    }
  }

  // Form State for Create/Edit Modal
  const [formData, setFormData] = useState({
    presetName: '',
    riskProfile: 'moderate',
    targetAllocation: { VOO: 50, SCHD: 25, GOOGL: 15, CASH: 10 } as Record<string, number>,
    monthlyContribution: 10000,
    targetAmount: 1000000,
    targetDate: '',
    isDefault: false,
  })

  // Dynamic custom allocation item inputs in modal
  const [customKey, setCustomKey] = useState('')
  const [customPct, setCustomPct] = useState<number>(10)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && modalOpen) setModalOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    if (modalOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [modalOpen])

  function openCreateModal() {
    setEditingPreset(null)
    setFormData({
      presetName: '',
      riskProfile: 'moderate',
      targetAllocation: { VOO: 45, SCHD: 25, GOOGL: 15, CASH: 15 },
      monthlyContribution: 15000,
      targetAmount: 2000000,
      targetDate: '',
      isDefault: presets.length === 0,
    })
    setFormError('')
    setModalOpen(true)
  }

  function openEditModal(preset: AllocationPreset) {
    setEditingPreset(preset)
    setFormData({
      presetName: preset.presetName,
      riskProfile: preset.riskProfile || 'moderate',
      targetAllocation: { ...preset.targetAllocation },
      monthlyContribution: Number(preset.monthlyContribution) || 0,
      targetAmount: Number(preset.targetAmount) || 0,
      targetDate: preset.targetDate ? preset.targetDate.split('T')[0] : '',
      isDefault: preset.isDefault,
    })
    setFormError('')
    setModalOpen(true)
  }

  function applyStrategyTemplate(tpl: StrategyTemplate) {
    setFormData((prev) => ({
      ...prev,
      presetName: tpl.name.split(' (')[0],
      riskProfile: tpl.riskProfile,
      targetAllocation: { ...tpl.targetAllocation },
    }))
  }

  function handleAddCustomAllocation() {
    const cleanKey = customKey.trim().toUpperCase()
    if (!cleanKey) return
    setFormData((prev) => ({
      ...prev,
      targetAllocation: {
        ...prev.targetAllocation,
        [cleanKey]: customPct,
      },
    }))
    setCustomKey('')
    setCustomPct(10)
  }

  function handleRemoveAllocationItem(key: string) {
    setFormData((prev) => {
      const next = { ...prev.targetAllocation }
      delete next[key]
      return { ...prev, targetAllocation: next }
    })
  }

  const totalAllocForm = Object.values(formData.targetAllocation).reduce(
    (acc, val) => acc + (Number(val) || 0),
    0
  )

  async function handleSavePreset(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')

    if (!formData.presetName.trim()) {
      setFormError('กรุณาระบุชื่อแผนการลงทุน')
      return
    }

    if (Math.abs(totalAllocForm - 100) > 0.05) {
      setFormError(`สัดส่วนเป้าหมายรวมต้องได้ 100% พอดี (ปัจจุบันได้ ${totalAllocForm.toFixed(1)}%)`)
      return
    }

    setSubmitting(true)
    try {
      const url = editingPreset ? `/api/plans/${editingPreset.id}` : '/api/plans'
      const method = editingPreset ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'บันทึกแผนไม่สำเร็จ')

      await revalidate()
      setModalOpen(false)
    } catch (err: any) {
      setFormError(err.message || 'เกิดข้อผิดพลาดในการบันทึก')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการลบแผนการลงทุนนี้?')) return
    try {
      const res = await fetch(`/api/plans/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('ลบไม่สำเร็จ')
      await revalidate()
      if (selectedPresetId === id) setSelectedPresetId('')
    } catch (err: any) {
      alert(err.message || 'เกิดข้อผิดพลาดในการลบแผน')
    }
  }

  function handleQuickBuy(item: { ticker?: string; key: string; recommendedAmountBase: number }) {
    setQuickAddInitialData({
      symbol: item.ticker || item.key,
      assetType: item.key === 'CASH' ? 'cash' : 'stock',
      amount: item.recommendedAmountBase,
      market: 'US',
    })
    setQuickAddOpen(true)
  }

  function handleCopyExecutionPlan() {
    if (!rebalancePlan) return
    const lines = [
      `📋 แผนปรับสมดุลพอร์ต: ${activePreset?.presetName}`,
      `โหมด: ${rebalanceMode === 'CASH_FLOW' ? 'เงินเติมใหม่ Smart DCA' : 'Full Rebalance'}`,
      `งบเงินเติม: ฿${cashInflow.toLocaleString()}`,
      `---------------------------------`,
      ...rebalancePlan.items
        .filter((i) => i.action !== 'HOLD')
        .map(
          (i) =>
            `• ${i.action === 'BUY' ? '🛒 ซื้อ' : '✂️ ขาย'} ${i.key}: ฿${i.recommendedAmountBase.toLocaleString()} ${
              i.estimatedShares ? `(~${i.estimatedShares} หุ้น)` : ''
            }`
        ),
      `---------------------------------`,
      `*สร้างโดย Investment Tracker Intelligence`,
    ]
    navigator.clipboard.writeText(lines.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const inputClass =
    'w-full bg-[#181C25] border border-white/[0.1] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all font-mono'
  const labelClass = 'block text-xs font-semibold text-slate-300 mb-1.5'

  return (
    <AppShell>
      <div className="space-y-6 max-w-[1600px] mx-auto w-full animate-fade-in pb-16">
        {/* Top Header */}
        <PageHeader
          eyebrow="Portfolio Allocation & Smart Rebalance"
          title="แผนการลงทุนและการปรับสมดุล"
          description="กำหนดสัดส่วนเป้าหมาย (Asset Allocation) ตรวจจับความเบี่ยงเบนของพอร์ต และจำลองการจัดสรรเงินเติมใหม่ (Smart DCA Rebalance) โดยไม่ต้องขายสินทรัพย์เดิม"
          action={
            <div className="flex items-center gap-2.5">
              <Link
                href="/forecast"
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-[#181C25] hover:bg-[#202532] border border-white/[0.1] transition-all flex items-center gap-1.5"
              >
                <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
                <span>จำลองพยากรณ์พอร์ต</span>
              </Link>
              <button
                type="button"
                onClick={openCreateModal}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl font-semibold text-xs flex items-center gap-2 transition-all shadow-lg shadow-indigo-600/25 active:scale-[0.98] cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>สร้างแผนใหม่</span>
              </button>
            </div>
          }
        />

        {/* ── TOP KPI SUMMARY CARDS ───────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
          {/* 1. Portfolio Drift Health */}
          <div className="glass-panel p-6 rounded-2xl flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400">
                  สถานะความสมดุลพอร์ต
                </span>
                <p className="text-xs text-slate-400 mt-0.5">Allocation Drift Score</p>
              </div>
              <span
                className={`text-xs px-2.5 py-1 rounded-full font-bold border flex items-center gap-1.5 ${
                  (rebalancePlan?.overallDriftScore ?? 0) > 40
                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                    : (rebalancePlan?.overallDriftScore ?? 0) > 15
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                    : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    (rebalancePlan?.overallDriftScore ?? 0) > 40
                      ? 'bg-rose-500'
                      : (rebalancePlan?.overallDriftScore ?? 0) > 15
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                />
                {(rebalancePlan?.overallDriftScore ?? 0) > 40
                  ? 'ต้องปรับสมดุล'
                  : (rebalancePlan?.overallDriftScore ?? 0) > 15
                  ? 'เริ่มเบี่ยงเบน'
                  : 'สมดุลดีเยี่ยม'}
              </span>
            </div>

            <div className="my-4">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl font-bold text-white tabular-nums tracking-tight font-mono">
                  {rebalancePlan?.overallDriftScore ?? 0}
                </span>
                <span className="text-xs text-slate-500 font-mono">/ 100 คะแนนเบี่ยงเบน</span>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                กรอบความคลาดเคลื่อนที่กำหนด: ±{toleranceBand}%
              </p>
            </div>

            <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
              <span>รายการที่หลุดกรอบ:</span>
              <span className="font-semibold text-white">
                {rebalancePlan?.items.filter((i) => i.status !== 'BALANCED').length ?? 0} รายการ
              </span>
            </div>
          </div>

          {/* 2. Dry Powder Cash */}
          <div className="glass-panel p-6 rounded-2xl flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400">
                  กระสุนเงินสดสำรอง
                </span>
                <p className="text-xs text-slate-400 mt-0.5">Dry Powder Liquidity</p>
              </div>
              <span className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                <Coins className="w-4 h-4" />
              </span>
            </div>

            <div className="my-4">
              <p className="text-3xl sm:text-4xl font-bold text-emerald-400 tabular-nums tracking-tight leading-none font-mono">
                ฿<CountUp end={totalCash} decimals={2} separator="," duration={1.2} />
              </p>
              <p className="text-xs text-slate-400 mt-2">
                คิดเป็น{' '}
                <span className="text-emerald-400 font-semibold">
                  {totalValue > 0 ? ((totalCash / totalValue) * 100).toFixed(1) : 0}%
                </span>{' '}
                ของพอร์ตรวม
              </p>
            </div>

            <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
              <span>สถานะเงินสด:</span>
              <span className="font-semibold text-emerald-400">พร้อม Rebalance</span>
            </div>
          </div>

          {/* 3. Rebalance Mode & Suggested Action */}
          <div className="glass-panel p-6 rounded-2xl flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400">
                  ยอดเงินที่ต้องซื้อปรับพอร์ต
                </span>
                <p className="text-xs text-slate-400 mt-0.5">Required Buy Inflow</p>
              </div>
              <span className="w-8 h-8 rounded-xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center">
                <Zap className="w-4 h-4" />
              </span>
            </div>

            <div className="my-4">
              <p className="text-3xl sm:text-4xl font-bold text-white tabular-nums tracking-tight leading-none font-mono">
                ฿
                <CountUp
                  end={rebalancePlan?.summaryNotes.totalBuyAmount ?? 0}
                  decimals={0}
                  separator=","
                  duration={1.2}
                />
              </p>
              <p className="text-xs text-slate-400 mt-2">
                {rebalanceMode === 'CASH_FLOW'
                  ? 'กระจายซื้อด้วยเงินเติมใหม่ (ไม่ต้องขาย)'
                  : `ขายส่วนเกิน ฿${rebalancePlan?.summaryNotes.totalTrimAmount.toLocaleString()} ไปซื้อตัวขาด`}
              </p>
            </div>

            <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
              <span>โหมดที่ใช้:</span>
              <span className="font-semibold text-indigo-400">
                {rebalanceMode === 'CASH_FLOW' ? 'Smart DCA Inflow' : 'Full Rebalance'}
              </span>
            </div>
          </div>

          {/* 4. Total Portfolio Value */}
          <div className="glass-panel p-6 rounded-2xl flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400">
                  มูลค่าพอร์ตลงทุนรวม
                </span>
                <p className="text-xs text-slate-400 mt-0.5">Total Portfolio Net Worth</p>
              </div>
              <span className="w-8 h-8 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center">
                <Activity className="w-4 h-4" />
              </span>
            </div>

            <div className="my-4">
              <p className="text-3xl sm:text-4xl font-bold text-white tabular-nums tracking-tight leading-none font-mono">
                ฿<CountUp end={totalValue} decimals={2} separator="," duration={1.2} />
              </p>
              <p className="text-xs text-slate-400 mt-2">
                แผนที่เลือก: <span className="text-white font-semibold">{activePreset?.presetName}</span>
              </p>
            </div>

            <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
              <span>เป้าหมายเกษียณ:</span>
              <span className="font-mono text-slate-300">
                ฿{Number(activePreset?.targetAmount || 0).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* ─── ACTIVE PRESET SELECTOR & REBALANCE SIMULATOR ────────────────── */}
        {activePreset && (
          <div className="p-6 sm:p-8 rounded-3xl bg-[#12151C] border border-white/[0.08] space-y-6 shadow-2xl shadow-black/50">
            {/* Header of Active Preset */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-white/[0.08]">
              <div>
                <span className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider">
                  แผนสัดส่วนเป้าหมายที่กำลังใช้งาน
                </span>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                    {activePreset.presetName}
                  </h2>
                  {activePreset.isDefault && (
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 font-medium">
                      ค่าเริ่มต้น
                    </span>
                  )}
                  <span
                    className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${
                      RISK_CONFIG[activePreset.riskProfile]?.bg || 'bg-slate-800'
                    } ${RISK_CONFIG[activePreset.riskProfile]?.color || 'text-slate-300'}`}
                  >
                    {RISK_CONFIG[activePreset.riskProfile]?.label || activePreset.riskProfile}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                {presets.length > 1 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 font-medium">สลับแผน:</span>
                    <select
                      className="bg-[#181C25] border border-white/[0.1] text-xs text-white rounded-xl px-3.5 py-2 outline-none font-medium focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all cursor-pointer"
                      value={activePreset.id}
                      onChange={(e) => setSelectedPresetId(e.target.value)}
                    >
                      {presets.map((p) => (
                        <option key={p.id} value={p.id} className="bg-[#12151C] text-white">
                          {p.presetName}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => openEditModal(activePreset)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-[#181C25] hover:bg-[#202532] border border-white/[0.1] transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>แก้ไขแผน</span>
                </button>
              </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════
                ⭐ SMART CASH FLOW REBALANCE SIMULATOR (FEATURE HIGHLIGHT)
            ══════════════════════════════════════════════════════════════ */}
            <div className="p-6 rounded-2xl bg-gradient-to-br from-[#151924] via-[#161B29] to-[#131620] border border-indigo-500/30 shadow-xl space-y-6">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-300">
                      <Zap className="w-4 h-4" />
                    </div>
                    <h3 className="text-base font-bold text-white tracking-wide">
                      Smart Cash Flow Rebalance Simulator (จำลองจัดสรรเงินเติมใหม่)
                    </h3>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    ใส่จำนวนเงินที่พร้อมลงทุนงวดนี้ ระบบจะคำนวณกระจายซื้อตัวที่ขาดเพื่อดึงพอร์ตกลับเข้าสู่เป้าหมายโดย{' '}
                    <strong className="text-emerald-400">ไม่ต้องขายสินทรัพย์เดิม</strong> (ประหยัดภาษีและค่าคอมมิชชัน)
                  </p>
                </div>

                {/* Mode Selector Tabs */}
                <div className="flex items-center gap-1 p-1 bg-black/40 rounded-xl border border-white/10 self-start lg:self-auto">
                  <button
                    type="button"
                    onClick={() => setRebalanceMode('CASH_FLOW')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      rebalanceMode === 'CASH_FLOW'
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    🌱 เงินเติมใหม่ (Smart DCA)
                  </button>
                  <button
                    type="button"
                    onClick={() => setRebalanceMode('FULL_REBALANCE')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      rebalanceMode === 'FULL_REBALANCE'
                        ? 'bg-amber-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    ⚖️ ปรับเต็มระบบ (ขาย+ซื้อ)
                  </button>
                </div>
              </div>

              {/* Inflow Input & Quick Preset Buttons */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
                <div className="relative flex-1">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400 font-mono">
                    ฿
                  </span>
                  <input
                    type="number"
                    step="1000"
                    min="0"
                    placeholder="ระบุเงินลงทุนงวดนี้ เช่น 20,000"
                    className="w-full bg-[#0F1218] border border-white/[0.12] rounded-xl pl-8 pr-4 py-2.5 text-sm font-bold text-emerald-400 font-mono focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                    value={cashInflow || ''}
                    onChange={(e) => setCashInflow(Math.max(0, parseFloat(e.target.value) || 0))}
                  />
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {[5000, 10000, 20000, 50000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setCashInflow(amt)}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold font-mono border transition-all cursor-pointer ${
                        cashInflow === amt
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-white/[0.03] text-slate-300 border-white/[0.08] hover:bg-white/[0.06]'
                      }`}
                    >
                      +฿{amt.toLocaleString()}
                    </button>
                  ))}
                  {totalCash > 0 && (
                    <button
                      type="button"
                      onClick={() => setCashInflow(Math.round(totalCash))}
                      className="px-3 py-2 rounded-xl text-xs font-semibold font-mono border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 transition-all cursor-pointer"
                      title="ใช้เงินสดที่มีในพอร์ตทั้งหมด"
                    >
                      ใช้เงินสดในพอร์ต (฿{Math.round(totalCash).toLocaleString()})
                    </button>
                  )}
                </div>

                {/* Tolerance Band selector */}
                <div className="flex items-center gap-1.5 border-l border-white/10 pl-3">
                  <span className="text-[11px] text-slate-400 shrink-0">กรอบเบี่ยงเบน:</span>
                  <select
                    className="bg-[#0F1218] border border-white/[0.1] text-xs text-white rounded-xl px-2.5 py-2 outline-none font-mono cursor-pointer"
                    value={toleranceBand}
                    onChange={(e) => setToleranceBand(parseFloat(e.target.value))}
                  >
                    <option value={2.0}>±2% (เคร่งครัด)</option>
                    <option value={3.0}>±3% (แนะนำสถาบัน)</option>
                    <option value={5.0}>±5% (ผ่อนปรน)</option>
                  </select>
                </div>
              </div>

              {/* ── ACTIONABLE REBALANCE EXECUTION SHEET ── */}
              {rebalancePlan && rebalancePlan.items.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                      <span>ใบสรุปคำสั่งจัดสรรเพื่อปรับสมดุล (Actionable Order Sheet)</span>
                      {rebalancePlan.hasTriggeredAlert && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                          มีสินทรัพย์หลุดกรอบเป้าหมาย
                        </span>
                      )}
                    </span>

                    <button
                      type="button"
                      onClick={handleCopyExecutionPlan}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-300 text-xs font-semibold transition-all cursor-pointer"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'คัดลอกแล้ว!' : 'คัดลอกรายการคำสั่ง'}</span>
                    </button>
                  </div>

                  <div className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-[#0C0F14]">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-white/[0.08] text-slate-400 font-semibold uppercase text-[10px] tracking-wider bg-white/[0.02]">
                          <th className="py-3 px-4">สินทรัพย์ (Ticker / กลุ่ม)</th>
                          <th className="py-3 px-3 text-right">สัดส่วนปัจจุบัน</th>
                          <th className="py-3 px-3 text-right">เป้าหมาย</th>
                          <th className="py-3 px-3 text-center">สถานะ</th>
                          <th className="py-3 px-3 text-center">คำแนะนำ</th>
                          <th className="py-3 px-3 text-right">จำนวนเงิน (฿)</th>
                          <th className="py-3 px-3 text-right">ประมาณการหุ้น</th>
                          <th className="py-3 px-3 text-right">สัดส่วนใหม่</th>
                          <th className="py-3 px-4 text-center">ดำเนินการ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.04] font-mono">
                        {rebalancePlan.items.map((item) => {
                          const isBuy = item.action === 'BUY'
                          const isTrim = item.action === 'TRIM'
                          return (
                            <tr
                              key={item.id}
                              className={`transition-colors ${
                                isBuy
                                  ? 'bg-emerald-500/[0.02] hover:bg-emerald-500/[0.05]'
                                  : isTrim
                                  ? 'bg-amber-500/[0.02] hover:bg-amber-500/[0.05]'
                                  : 'hover:bg-white/[0.02]'
                              }`}
                            >
                              <td className="py-3 px-4 font-sans">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-white font-mono px-2 py-0.5 rounded bg-white/[0.06] border border-white/[0.1]">
                                    {item.key}
                                  </span>
                                  <span className="text-slate-300 text-xs truncate max-w-[140px] font-sans">
                                    {item.label}
                                  </span>
                                </div>
                              </td>

                              <td className="py-3 px-3 text-right text-slate-300">
                                {item.currentWeight.toFixed(1)}%
                              </td>

                              <td className="py-3 px-3 text-right font-bold text-white">
                                {item.targetWeight}%
                              </td>

                              <td className="py-3 px-3 text-center">
                                {item.status === 'TRIGGERED' ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                    <AlertTriangle className="w-2.5 h-2.5" /> หลุดกรอบ
                                  </span>
                                ) : item.status === 'DRIFT' ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium bg-amber-500/15 text-amber-300 border border-amber-500/20">
                                    เริ่มเบี่ยงเบน
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/20">
                                    <CheckCircle2 className="w-2.5 h-2.5" /> สมดุล
                                  </span>
                                )}
                              </td>

                              <td className="py-3 px-3 text-center">
                                {isBuy ? (
                                  <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/30 text-[11px] inline-flex items-center gap-1">
                                    <ArrowUpRight className="w-3 h-3" /> ซื้อเพิ่ม
                                  </span>
                                ) : isTrim ? (
                                  <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-300 font-bold border border-amber-500/30 text-[11px] inline-flex items-center gap-1">
                                    <ArrowDownRight className="w-3 h-3" /> ลดน้ำหนัก
                                  </span>
                                ) : (
                                  <span className="px-2 py-1 rounded-lg bg-white/[0.04] text-slate-400 font-medium text-[11px]">
                                    คงสัดส่วน (Hold)
                                  </span>
                                )}
                              </td>

                              <td className="py-3 px-3 text-right">
                                {item.recommendedAmountBase > 0 ? (
                                  <span
                                    className={`font-bold ${
                                      isBuy ? 'text-emerald-400' : 'text-amber-400'
                                    }`}
                                  >
                                    ฿{item.recommendedAmountBase.toLocaleString()}
                                  </span>
                                ) : (
                                  <span className="text-slate-500">—</span>
                                )}
                              </td>

                              <td className="py-3 px-3 text-right text-slate-300">
                                {item.estimatedShares ? `~${item.estimatedShares} หุ้น` : '—'}
                              </td>

                              <td className="py-3 px-3 text-right">
                                <span className="text-indigo-300 font-bold">
                                  {item.postRebalanceWeight.toFixed(1)}%
                                </span>
                              </td>

                              <td className="py-3 px-4 text-center font-sans">
                                {isBuy && item.type === 'TICKER' ? (
                                  <button
                                    type="button"
                                    onClick={() => handleQuickBuy(item)}
                                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] transition-all cursor-pointer shadow-sm active:scale-95"
                                  >
                                    + บันทึกซื้อ
                                  </button>
                                ) : (
                                  <span className="text-[10px] text-slate-500">—</span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {rebalancePlan.summaryNotes.taxSavingsNote && (
                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>{rebalancePlan.summaryNotes.taxSavingsNote}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ══════════════════════════════════════════════════════════════
                EXECUTIVE REBALANCE MATRIX (INSTITUTIONAL TABLE)
            ══════════════════════════════════════════════════════════════ */}
            <div className="space-y-4 pt-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                    การเปรียบเทียบสัดส่วนเป้าหมายกับพอร์ตปัจจุบัน (Allocation Drift Matrix)
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-normal">
                      Institutional View
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    ตารางเมทริกซ์วิเคราะห์สัดส่วนจริงเทียบเป้าหมาย พร้อมคำแนะนำปรับสมดุลและระบบเจาะลึกสินทรัพย์รายตัว
                  </p>
                </div>
              </div>

              {/* Matrix Table Container */}
              <div className="rounded-2xl bg-[#141822] border border-white/[0.08] shadow-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-white/[0.08] bg-white/[0.02] text-slate-400 font-semibold text-[11px] uppercase tracking-wider">
                        <th className="py-3.5 px-4">กลุ่มสินทรัพย์</th>
                        <th className="py-3.5 px-4 min-w-[220px]">จริง vs เป้าหมาย (%)</th>
                        <th className="py-3.5 px-4 text-right">มูลค่าปัจจุบัน</th>
                        <th className="py-3.5 px-4 text-center">ส่วนต่าง (Drift)</th>
                        <th className="py-3.5 px-4">สถานะ & คำแนะนำ</th>
                        <th className="py-3.5 px-4 text-center">เจาะลึกสินทรัพย์</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.05]">
                      {Object.entries(activePreset.targetAllocation)
                        .filter(([key]) => !key.startsWith('_'))
                        .map(([key, targetPct]) => {
                          const upperKey = key.toUpperCase()
                          const cfg =
                            CATEGORY_CONFIG[upperKey] ?? {
                              label: key,
                              emoji: '📊',
                              color: 'text-indigo-400',
                              barColor: 'bg-indigo-500',
                              bg: 'bg-indigo-500/10 border-indigo-500/20',
                            }

                          // Find actual percent either from ticker or category
                          let actualPct = actualAllocation[upperKey] ?? 0
                          if (data?.actualByTicker && data.actualByTicker[upperKey] !== undefined) {
                            actualPct = data.actualByTicker[upperKey]
                          }

                          const diff = actualPct - targetPct
                          const isOver = diff > 0
                          const isUnder = diff < 0
                          const absDiff = Math.abs(diff)
                          const diffAmount = (absDiff / 100) * totalValue
                          const isOnTarget = absDiff <= toleranceBand

                          // Holdings matching this category
                          const matchingHoldings = holdings.filter((h: any) => {
                            const hMarket = (h.market || '').toUpperCase()
                            const hType = (h.assetType || '').toUpperCase()
                            if (upperKey === 'US') return hMarket === 'US' || (!hMarket && hType !== 'CRYPTO' && hType !== 'GOLD')
                            if (upperKey === 'TH') return hMarket === 'TH' || h.ticker.endsWith('.BK')
                            if (upperKey === 'CRYPTO') return hType === 'CRYPTO'
                            if (upperKey === 'GOLD') return hType === 'GOLD'
                            if (upperKey === 'CASH') return false
                            return hMarket === upperKey || hType === upperKey
                          })

                          const categoryValue =
                            upperKey === 'CASH'
                              ? totalCash
                              : matchingHoldings.reduce((sum: number, h: any) => sum + (h.currentValueBase || 0), 0)

                          const isExpanded = !!expandedCategories[key] || !!expandedCategories[upperKey]

                          return (
                            <React.Fragment key={key}>
                              <tr
                                className={`transition-all hover:bg-white/[0.02] ${
                                  isExpanded ? 'bg-indigo-950/20' : ''
                                }`}
                              >
                                {/* Asset Class */}
                                <td className="py-4 px-4">
                                  <div className="flex items-center gap-2.5">
                                    <span className="text-xl shrink-0">{cfg.emoji}</span>
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <span className="font-bold text-white text-sm">{key}</span>
                                        <span className="text-xs text-slate-400 font-sans">
                                          {cfg.label}
                                        </span>
                                      </div>
                                      <div className="mt-0.5">
                                        {absDiff > toleranceBand * 1.7 ? (
                                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                            หลุดกรอบเป้าหมาย
                                          </span>
                                        ) : !isOnTarget ? (
                                          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-amber-500/15 text-amber-300 border border-amber-500/20">
                                            เริ่มเบี่ยงเบน
                                          </span>
                                        ) : (
                                          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/20">
                                            สมดุลดี
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </td>

                                {/* Actual vs Target with Visual Target Marker Pin */}
                                <td className="py-4 px-4 min-w-[220px]">
                                  <div className="space-y-1.5">
                                    <div className="flex items-center justify-between text-xs font-mono">
                                      <div>
                                        <span className="text-slate-400 text-[10px] mr-1">จริง:</span>
                                        <span className={`font-bold ${cfg.color}`}>
                                          {actualPct.toFixed(1)}%
                                        </span>
                                      </div>
                                      <div>
                                        <span className="text-slate-400 text-[10px] mr-1">เป้า:</span>
                                        <span className="text-slate-200 font-semibold">
                                          {targetPct}%
                                        </span>
                                      </div>
                                    </div>

                                    {/* Unified Progress Bar with Glowing Target Pin */}
                                    <div className="relative h-2.5 w-full bg-slate-800 rounded-full overflow-hidden">
                                      {/* Actual Fill */}
                                      <div
                                        className={`h-full ${cfg.barColor} rounded-full transition-all duration-500`}
                                        style={{ width: `${Math.min(100, actualPct)}%` }}
                                      />
                                      {/* Target Pin Marker */}
                                      {targetPct > 0 && targetPct < 100 && (
                                        <div
                                          className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)] z-10 pointer-events-none"
                                          style={{ left: `calc(${targetPct}% - 2px)` }}
                                          title={`เป้าหมาย: ${targetPct}%`}
                                        />
                                      )}
                                    </div>
                                  </div>
                                </td>

                                {/* Portfolio Value */}
                                <td className="py-4 px-4 text-right font-mono">
                                  <div className="font-bold text-white text-sm">
                                    ฿{Math.round(categoryValue).toLocaleString()}
                                  </div>
                                  <div className="text-[11px] text-slate-400 font-sans">
                                    {matchingHoldings.length} รายการ
                                  </div>
                                </td>

                                {/* Variance (Drift) */}
                                <td className="py-4 px-4 text-center">
                                  <span
                                    className={`inline-block px-2.5 py-1 rounded-lg text-xs font-mono font-bold ${
                                      isOnTarget
                                        ? 'text-slate-300 bg-white/[0.04] border border-white/[0.08]'
                                        : isOver
                                        ? 'text-amber-300 bg-amber-500/15 border border-amber-500/30'
                                        : 'text-blue-300 bg-blue-500/15 border border-blue-500/30'
                                    }`}
                                  >
                                    {diff > 0 ? '+' : ''}
                                    {diff.toFixed(1)}%
                                  </span>
                                </td>

                                {/* Action Recommendation */}
                                <td className="py-4 px-4">
                                  {absDiff > toleranceBand && totalValue > 0 ? (
                                    isOver ? (
                                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[11px]">
                                        <PauseCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                        <span>
                                          เกินเป้า ~฿{Math.round(diffAmount).toLocaleString()} (ชะลอเติม)
                                        </span>
                                      </div>
                                    ) : (
                                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-[11px]">
                                        <TrendingUp className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                        <span>
                                          ขาดเป้า ~฿{Math.round(diffAmount).toLocaleString()} (เน้นเติม)
                                        </span>
                                      </div>
                                    )
                                  ) : (
                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 text-[11px]">
                                      <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                                      <span>สัดส่วนสมดุลดี (DCA ตามปกติ)</span>
                                    </div>
                                  )}
                                </td>

                                {/* Drill-Down Action Button */}
                                <td className="py-4 px-4 text-center">
                                  <button
                                    type="button"
                                    onClick={() => toggleExpandCategory(key)}
                                    className={`px-3 py-1.5 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95 mx-auto ${
                                      isExpanded
                                        ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'
                                        : 'bg-white/[0.04] hover:bg-indigo-600/20 text-indigo-300 hover:text-white border border-indigo-500/25'
                                    }`}
                                  >
                                    <span>
                                      {isExpanded ? 'ปิด' : `ดูย่อย (${matchingHoldings.length})`}
                                    </span>
                                    {isExpanded ? (
                                      <ChevronUp className="w-3.5 h-3.5" />
                                    ) : (
                                      <ChevronDown className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </td>
                              </tr>

                              {/* Expandable Sub-Allocation Drill-Down Row */}
                              {isExpanded && (
                                <tr className="bg-[#0e111a] border-b border-indigo-500/30">
                                  <td
                                    colSpan={6}
                                    className="p-3 sm:p-5 bg-gradient-to-b from-[#131726]/90 via-[#0e121e] to-[#0a0d16]"
                                  >
                                    <div className="rounded-2xl border border-indigo-500/25 p-2 sm:p-4 bg-black/40 shadow-inner">
                                      <SubAllocationDrillDown
                                        categoryKey={key}
                                        categoryLabel={cfg.label}
                                        categoryEmoji={cfg.emoji}
                                        holdings={holdings}
                                        categoryTotalValue={categoryValue}
                                        portfolioTotalValue={totalValue}
                                        baseCurrency={baseCurrency}
                                        targetCategoryPct={targetPct}
                                        actualCategoryPct={actualPct}
                                        defaultDcaBudget={
                                          Number(activePreset.monthlyContribution) || 5000
                                        }
                                        savedSubTargets={
                                          activePreset.subTargets?.[upperKey] || {}
                                        }
                                        onSaveSubTargets={(newSub) =>
                                          handleSaveSubTargets(key, newSub)
                                        }
                                      />
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          )
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── AI REBALANCE & ALLOCATION ADVISOR ───────────────────────────── */}
        <div className="rounded-3xl glass-panel p-6 sm:p-7 border border-indigo-500/20 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-72 h-72 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.08] relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  Gemini AI Rebalance & Portfolio Advisor
                </h3>
                <p className="text-xs text-slate-400">
                  สังเคราะห์และวิเคราะห์เชิงยุทธศาสตร์เพื่อปรับพอร์ตให้สอดคล้องกับสภาวะเศรษฐกิจ
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 self-start sm:self-auto">
              {aiAdvisorData?.updatedAt && (
                <span className="text-xs text-slate-400 flex items-center gap-1.5 bg-white/[0.03] px-3 py-1.5 rounded-xl border border-white/[0.06]">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  วิเคราะห์ล่าสุด:{' '}
                  {new Date(aiAdvisorData.updatedAt).toLocaleTimeString('th-TH', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}{' '}
                  น.
                </span>
              )}
              <button
                type="button"
                onClick={handleRunAiAdvisor}
                disabled={isAiAnalyzing}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-all flex items-center gap-2 shadow-md shadow-indigo-600/25 active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <Sparkles className={`w-3.5 h-3.5 ${isAiAnalyzing ? 'animate-spin' : ''}`} />
                <span>
                  {isAiAnalyzing
                    ? 'กำลังประมวลผล AI...'
                    : aiAdvisorData?.advice
                    ? 'วิเคราะห์ปรับพอร์ตใหม่ด้วย AI'
                    : 'วิเคราะห์ปรับพอร์ตด้วย AI'}
                </span>
              </button>
            </div>
          </div>

          {aiError && (
            <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{aiError}</span>
            </div>
          )}

          {aiAdvisorData?.advice ? (
            <div className="mt-5 relative z-10">
              <AiAdvisorDisplay
                advice={aiAdvisorData.advice}
                disclaimer={aiAdvisorData.disclaimer}
                modelUsed={aiAdvisorData.modelUsed}
                updatedAt={aiAdvisorData.updatedAt}
                onRefresh={handleRunAiAdvisor}
                isRefreshing={isAiAnalyzing}
              />
            </div>
          ) : (
            <div className="mt-6 py-6 text-center space-y-3 relative z-10">
              <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                ยังไม่มีประวัติการวิเคราะห์สัดส่วนพอร์ต — คลิกปุ่ม{' '}
                <strong>&quot;วิเคราะห์ปรับพอร์ตด้วย AI&quot;</strong> ด้านบน
                เพื่อรับคำแนะนำจัดสรรสินทรัพย์และลดความเสี่ยงแบบ Real-time
              </p>
            </div>
          )}
        </div>

        {/* ─── SAVED PRESETS LIST ─────────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white tracking-wide">
              แผนการลงทุนที่บันทึกไว้ ({presets.length})
            </h3>
          </div>

          {isLoading ? (
            <div className="py-16 text-center flex flex-col items-center justify-center gap-3 text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
              <span className="text-xs">กำลังโหลดแผนการลงทุน...</span>
            </div>
          ) : error ? (
            <div className="p-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-center flex flex-col items-center justify-center">
              <AlertCircle className="w-8 h-8 text-rose-400 mb-3" />
              <p className="text-xs text-rose-300 mb-4">โหลดข้อมูลแผนไม่สำเร็จ</p>
              <button
                onClick={() => revalidate()}
                className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-semibold text-white"
              >
                ลองอีกครั้ง
              </button>
            </div>
          ) : presets.length === 0 ? (
            <div className="p-14 rounded-2xl bg-[#12151C] border border-white/[0.08] text-center flex flex-col items-center justify-center min-h-[280px]">
              <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-4">
                <Scale className="w-7 h-7" />
              </div>
              <h4 className="font-bold text-white text-base mb-1.5">ยังไม่มีแผนการลงทุน</h4>
              <p className="text-xs text-slate-400 max-w-sm mb-5 leading-relaxed">
                สร้างแผนสัดส่วนเป้าหมายเพื่อช่วยกำกับและติดตามการจัดสรรพอร์ตอย่างเป็นระบบ
              </p>
              <button
                onClick={openCreateModal}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold py-2 px-5 rounded-xl transition-all shadow-lg shadow-indigo-600/25 cursor-pointer"
              >
                สร้างแผนแรก
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {presets.map((preset) => {
                const riskCfg =
                  RISK_CONFIG[preset.riskProfile] ?? {
                    label: preset.riskProfile,
                    color: 'text-slate-300',
                    bg: 'bg-slate-800',
                  }
                const isActive = preset.id === activePreset?.id

                return (
                  <div
                    key={preset.id}
                    className={`p-5 rounded-2xl bg-[#12151C] border transition-all duration-200 group flex flex-col justify-between min-h-[200px] shadow-xl shadow-black/30 ${
                      isActive
                        ? 'border-indigo-500/50 ring-1 ring-indigo-500/20'
                        : 'border-white/[0.08] hover:border-white/[0.16]'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-bold text-white text-base tracking-tight">
                            {preset.presetName}
                          </h4>
                          <span
                            className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-md border mt-1.5 ${riskCfg.bg} ${riskCfg.color}`}
                          >
                            {riskCfg.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openEditModal(preset)}
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                            title="แก้ไข"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(preset.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                            title="ลบ"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-1.5">
                        {Object.entries(preset.targetAllocation).map(([cat, pct]) => {
                          return (
                            <span
                              key={cat}
                              className="px-2 py-0.5 rounded-md bg-[#181C25] border border-white/[0.06] text-slate-400 text-[10px] font-mono"
                            >
                              {cat} <span className="text-white font-semibold ml-1">{pct}%</span>
                            </span>
                          )
                        })}
                      </div>
                    </div>

                    <div className="mt-5 pt-3.5 border-t border-white/[0.06] flex items-center justify-between">
                      <span className="text-xs font-mono text-slate-400">
                        +฿{Number(preset.monthlyContribution).toLocaleString()}/เดือน
                      </span>
                      {preset.isDefault ? (
                        <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400">
                          <CheckCircle className="w-3 h-3" /> ค่าเริ่มต้น
                        </span>
                      ) : (
                        <button
                          onClick={() => setSelectedPresetId(preset.id)}
                          className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
                        >
                          เลือกดูแผนนี้
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ─── PRESET CREATE / EDIT MODAL ────────────────────────────────────── */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false)
          }}
        >
          <div className="bg-[#12151C] border border-white/[0.1] rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl shadow-black/80 flex flex-col max-h-[92vh]">
            <div className="px-6 py-4.5 border-b border-white/[0.08] flex items-center justify-between bg-[#181C25]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <Scale className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-white text-base tracking-tight">
                  {editingPreset ? 'แก้ไขแผนการลงทุน' : 'สร้างแผนการลงทุนใหม่'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePreset} className="p-6 overflow-y-auto space-y-5 flex-1">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-xs text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Strategy Template Quick Picker */}
              {!editingPreset && (
                <div className="space-y-2 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    เลือกใช้แม่แบบกลยุทธ์มาตรฐานระดับโลก (1-Click Template)
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                    {STRATEGY_TEMPLATES.map((tpl) => (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => applyStrategyTemplate(tpl)}
                        className="p-2.5 rounded-xl bg-[#181C25] hover:bg-[#202532] border border-white/[0.06] hover:border-indigo-500/40 text-left transition-all cursor-pointer group"
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <span>{tpl.iconEmoji}</span>
                          <span className="text-xs font-bold text-white truncate group-hover:text-indigo-300">
                            {tpl.name.split(' (')[0]}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 line-clamp-1">{tpl.subtitle}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className={labelClass}>ชื่อแผนการลงทุน *</label>
                <input
                  type="text"
                  className={inputClass}
                  placeholder="เช่น Core-Satellite สมดุล, Buffett 90/10, เกษียณ 2035"
                  value={formData.presetName}
                  onChange={(e) => setFormData({ ...formData, presetName: e.target.value })}
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className={labelClass}>ระดับความเสี่ยง (Risk Profile)</label>
                <select
                  className={inputClass}
                  value={formData.riskProfile}
                  onChange={(e) => setFormData({ ...formData, riskProfile: e.target.value })}
                >
                  <option value="conservative" className="bg-[#12151C] text-white">
                    ระมัดระวัง (Conservative)
                  </option>
                  <option value="moderate" className="bg-[#12151C] text-white">
                    สมดุล (Moderate)
                  </option>
                  <option value="aggressive" className="bg-[#12151C] text-white">
                    เชิงรุก (Aggressive)
                  </option>
                </select>
              </div>

              {/* Allocations breakdown */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className={labelClass}>
                    สัดส่วนเป้าหมาย (รองรับ Ticker รายตัว หรือ หมวดหมู่)
                  </label>
                  <span
                    className={`text-xs font-mono font-bold ${
                      Math.abs(totalAllocForm - 100) < 0.05 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    รวม: {totalAllocForm.toFixed(1)}% / 100%
                  </span>
                </div>

                <div className="space-y-2 p-3.5 rounded-2xl bg-[#181C25] border border-white/[0.06] max-h-56 overflow-y-auto">
                  {Object.entries(formData.targetAllocation).map(([cat, pct]) => {
                    return (
                      <div
                        key={cat}
                        className="flex items-center justify-between gap-3 p-2 rounded-xl bg-black/20 border border-white/[0.04]"
                      >
                        <span className="text-xs font-bold text-white font-mono flex items-center gap-1.5 min-w-[90px]">
                          <span>{cat}</span>
                        </span>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.5"
                            className="w-20 bg-[#12151C] border border-white/[0.1] rounded-lg px-2.5 py-1 text-xs text-white font-mono text-right outline-none focus:border-indigo-500"
                            value={pct}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0
                              setFormData({
                                ...formData,
                                targetAllocation: { ...formData.targetAllocation, [cat]: val },
                              })
                            }}
                          />
                          <span className="text-xs text-slate-500 font-mono">%</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveAllocationItem(cat)}
                            className="p-1 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                            title="ลบรายการนี้"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )
                  })}

                  {/* Add Custom Item Row */}
                  <div className="flex items-center gap-2 pt-2 border-t border-white/[0.06]">
                    <input
                      type="text"
                      placeholder="ใส่ Ticker เช่น VOO, SCHD หรือ CASH"
                      className="flex-1 bg-[#12151C] border border-white/[0.1] rounded-lg px-3 py-1.5 text-xs text-white font-mono outline-none focus:border-indigo-500"
                      value={customKey}
                      onChange={(e) => setCustomKey(e.target.value)}
                    />
                    <div className="flex items-center gap-1 w-20">
                      <input
                        type="number"
                        min="1"
                        max="100"
                        className="w-full bg-[#12151C] border border-white/[0.1] rounded-lg px-2 py-1.5 text-xs text-white font-mono text-right outline-none"
                        value={customPct}
                        onChange={(e) => setCustomPct(parseFloat(e.target.value) || 0)}
                      />
                      <span className="text-xs text-slate-500 font-mono">%</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddCustomAllocation}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600 text-indigo-300 hover:text-white text-xs font-semibold transition-all cursor-pointer"
                    >
                      + เพิ่ม
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className={labelClass}>เงินออมรายเดือน (฿/เดือน)</label>
                  <input
                    type="number"
                    step="1000"
                    className={inputClass}
                    value={formData.monthlyContribution}
                    onChange={(e) =>
                      setFormData({ ...formData, monthlyContribution: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
                <div>
                  <label className={labelClass}>เป้าหมายมูลค่าพอร์ตเกษียณ (฿)</label>
                  <input
                    type="number"
                    step="50000"
                    className={inputClass}
                    value={formData.targetAmount}
                    onChange={(e) =>
                      setFormData({ ...formData, targetAmount: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="is-default"
                  checked={formData.isDefault}
                  onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500/30 cursor-pointer"
                />
                <label htmlFor="is-default" className="text-xs text-slate-300 cursor-pointer select-none">
                  ตั้งเป็นแผนสัดส่วนเริ่มต้นของระบบ (Default Active Plan)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-[#181C25] hover:bg-[#202532] border border-white/[0.1] transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-600/25 active:scale-[0.98] disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  <span>{editingPreset ? 'บันทึกการแก้ไข' : 'สร้างแผนการลงทุน'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Add Modal Integration */}
      {quickAddOpen && (
        <QuickAddModal
          initialTab="manual"
          onClose={() => {
            setQuickAddOpen(false)
            setQuickAddInitialData(null)
          }}
          onSuccess={() => {
            setQuickAddOpen(false)
            revalidate()
          }}
        />
      )}
    </AppShell>
  )
}
