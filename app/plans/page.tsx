'use client'

import React, { useState, useEffect } from 'react'
import useSWR, { mutate } from 'swr'
import Link from 'next/link'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/PageHeader'
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
} from 'lucide-react'

const DEFAULT_CATEGORIES = ['US', 'TH', 'CRYPTO', 'GOLD', 'CASH']

const CATEGORY_CONFIG: Record<string, { label: string; emoji: string; color: string; barColor: string; bg: string }> = {
  US:     { label: 'หุ้นสหรัฐ', emoji: '🇺🇸', color: 'text-blue-400', barColor: 'bg-blue-500', bg: 'bg-blue-500/10 border-blue-500/20' },
  TH:     { label: 'หุ้นไทย', emoji: '🇹🇭', color: 'text-emerald-400', barColor: 'bg-emerald-500', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  CRYPTO: { label: 'คริปโต', emoji: '🪙', color: 'text-amber-400', barColor: 'bg-amber-500', bg: 'bg-amber-500/10 border-amber-500/20' },
  GOLD:   { label: 'ทองคำ', emoji: '🏆', color: 'text-yellow-300', barColor: 'bg-yellow-400', bg: 'bg-yellow-400/10 border-yellow-400/20' },
  CASH:   { label: 'เงินสดและตราสารหนี้', emoji: '💵', color: 'text-cyan-400', barColor: 'bg-cyan-500', bg: 'bg-cyan-500/10 border-cyan-500/20' },
}

const RISK_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  conservative: { label: 'ระมัดระวัง', color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/20' },
  moderate:     { label: 'สมดุล', color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/20' },
  aggressive:   { label: 'เชิงรุก', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
}

interface AllocationPreset {
  id: string
  presetName: string
  riskProfile: string
  targetAllocation: Record<string, number>
  monthlyContribution: number | string
  targetAmount: number | string
  targetDate: string | null
  isDefault: boolean
}

function asAllocation(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object') return {}
  const out: Record<string, number> = {}
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const n = Number(raw)
    if (!Number.isNaN(n)) out[key] = n
  }
  return out
}

function parsePresets(data: unknown): AllocationPreset[] {
  if (!data || typeof data !== 'object' || !('presets' in data)) return []
  const list = (data as { presets?: unknown }).presets
  if (!Array.isArray(list)) return []
  return list.filter((item): item is AllocationPreset => {
    if (!item || typeof item !== 'object') return false
    const record = item as Record<string, unknown>
    return typeof record.id === 'string' && typeof record.presetName === 'string'
  }).map((item) => ({
    ...item,
    targetAllocation: asAllocation(item.targetAllocation),
  }))
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

export default function PlansPage() {
  const { data, isLoading, error, mutate: revalidate } = useSWR('/api/plans')
  const presets = parsePresets(data)
  const actualAllocation: Record<string, number> = data?.actualAllocation ?? {}
  const totalValue: number = data?.totalPortfolioValue ?? 0

  const [modalOpen, setModalOpen] = useState(false)
  const [editingPreset, setEditingPreset] = useState<AllocationPreset | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  const defaultPreset = presets.find((p) => p.isDefault) ?? presets[0]
  const [selectedPresetId, setSelectedPresetId] = useState<string>('')
  const activePreset = presets.find((p) => p.id === (selectedPresetId || defaultPreset?.id)) ?? defaultPreset

  const [formData, setFormData] = useState({
    presetName: '',
    riskProfile: 'moderate',
    targetAllocation: { US: 50, TH: 20, CRYPTO: 15, GOLD: 15 } as Record<string, number>,
    monthlyContribution: 10000,
    targetAmount: 1000000,
    targetDate: '',
    isDefault: false,
  })

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
      targetAllocation: { US: 50, TH: 20, CRYPTO: 15, GOLD: 15 },
      monthlyContribution: 10000,
      targetAmount: 1000000,
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
      riskProfile: preset.riskProfile,
      targetAllocation: preset.targetAllocation,
      monthlyContribution: Number(preset.monthlyContribution ?? 0),
      targetAmount: Number(preset.targetAmount ?? 0),
      targetDate: preset.targetDate ? preset.targetDate.slice(0, 10) : '',
      isDefault: preset.isDefault,
    })
    setFormError('')
    setModalOpen(true)
  }

  async function handleSavePreset(e: React.FormEvent) {
    e.preventDefault()
    if (!formData.presetName.trim()) { setFormError('กรุณาระบุชื่อแผนการลงทุน'); return }
    const sum = Object.values(formData.targetAllocation).reduce((a, b) => a + Number(b || 0), 0)
    if (Math.abs(sum - 100) > 0.01) {
      setFormError(`สัดส่วนเป้าหมายรวมต้องเท่ากับ 100% (ปัจจุบัน: ${sum}%)`)
      return
    }

    setSubmitting(true); setFormError('')
    try {
      const url = editingPreset ? `/api/plans/${editingPreset.id}` : '/api/plans'
      const method = editingPreset ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      const resJson = await res.json() as { error?: string }
      if (!res.ok) throw new Error(resJson.error || 'บันทึกแผนไม่สำเร็จ')
      mutate('/api/plans')
      setModalOpen(false)
    } catch (err: unknown) {
      setFormError(getErrorMessage(err, 'เกิดข้อผิดพลาด'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('คุณแน่ใจว่าต้องการลบแผนนี้ใช่หรือไม่?')) return
    try {
      await fetch(`/api/plans/${id}`, { method: 'DELETE' })
      mutate('/api/plans')
    } catch {
      alert('ลบแผนไม่สำเร็จ')
    }
  }

  const totalAllocForm = Object.values(formData.targetAllocation).reduce((a, b) => a + Number(b || 0), 0)
  
  const inputClass = "w-full bg-[#181C25] border border-white/[0.1] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all font-mono"
  const labelClass = "block text-xs font-semibold text-slate-300 mb-1.5"

  return (
    <AppShell>
      <div className="space-y-6 max-w-[1600px] mx-auto w-full animate-fade-in">
        {/* Header */}
        <PageHeader
          eyebrow="Portfolio Allocation"
          title="แผนการลงทุนและการปรับสมดุล"
          description="กำหนดสัดส่วนเป้าหมาย (Asset Allocation) ตรวจสอบความเบี่ยงเบนของพอร์ต และรับคำแนะนำในการ Rebalance"
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
                onClick={openCreateModal}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl font-semibold text-xs flex items-center gap-2 transition-all shadow-lg shadow-indigo-600/25 active:scale-[0.98] cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>สร้างแผนใหม่</span>
              </button>
            </div>
          }
        />

        {/* Rebalancing Comparison */}
        {activePreset && (
          <div className="p-6 sm:p-8 rounded-2xl bg-[#12151C] border border-white/[0.08] space-y-6 shadow-xl shadow-black/40">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-white/[0.08]">
              <div>
                <span className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider">
                  แผนสัดส่วนที่กำลังใช้งาน
                </span>
                <div className="flex items-center gap-3 mt-1">
                  <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                    {activePreset.presetName}
                  </h2>
                  {activePreset.isDefault && (
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 font-medium">
                      ค่าเริ่มต้น
                    </span>
                  )}
                </div>
              </div>

              {presets.length > 1 && (
                <div className="flex items-center gap-2.5">
                  <span className="text-xs text-slate-400 font-medium">เปลี่ยนแผน:</span>
                  <select
                    className="bg-[#181C25] border border-white/[0.1] text-xs text-white rounded-xl px-3.5 py-2 outline-none font-medium focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    value={activePreset.id}
                    onChange={(e) => setSelectedPresetId(e.target.value)}
                  >
                    {presets.map((p) => (
                      <option key={p.id} value={p.id} className="bg-[#12151C] text-white">{p.presetName}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Comparison Bars */}
            <div className="space-y-3.5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                เปรียบเทียบสัดส่วนเป้าหมายกับปัจจุบัน
              </p>
              {Object.entries(activePreset.targetAllocation).map(([category, targetPct]) => {
                const cfg = CATEGORY_CONFIG[category] ?? { label: category, emoji: '📊', color: 'text-slate-300', barColor: 'bg-slate-400', bg: 'bg-slate-800' }
                const actualPct = actualAllocation[category] ?? 0
                const diff = actualPct - targetPct
                const isOver = diff > 0
                const diffAmount = (Math.abs(diff) / 100) * totalValue
                const isOnTarget = Math.abs(diff) < 2

                return (
                  <div key={category} className="p-4 sm:p-5 rounded-xl bg-[#181C25] border border-white/[0.06] hover:border-white/[0.12] transition-all space-y-3.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <span className="text-lg">{cfg.emoji}</span>
                        <span className="font-bold text-white text-sm">{cfg.label}</span>
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md border ${cfg.bg} ${cfg.color}`}>
                          {category}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-4 text-xs font-mono">
                        <div className="flex flex-col items-end">
                          <span className="text-[10px] text-slate-500">เป้าหมาย</span>
                          <span className="text-white font-semibold">{targetPct}%</span>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-[10px] text-slate-500">ปัจจุบัน</span>
                          <span className={`font-semibold ${cfg.color}`}>{actualPct.toFixed(1)}%</span>
                        </div>
                        <div className="flex flex-col items-end pl-3 border-l border-white/[0.1]">
                          <span className="text-[10px] text-slate-500">ส่วนต่าง</span>
                          <span className={`font-bold ${
                            isOnTarget ? 'text-slate-400'
                            : isOver ? 'text-amber-400' : 'text-blue-400'
                          }`}>
                            {diff > 0 ? '+' : ''}{diff.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-medium text-slate-500 w-12 shrink-0">เป้าหมาย</span>
                        <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-slate-600 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, targetPct)}%` }} />
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-medium text-slate-500 w-12 shrink-0">ปัจจุบัน</span>
                        <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div className={`h-full ${cfg.barColor} rounded-full transition-all duration-500 shadow-sm`} style={{ width: `${Math.min(100, actualPct)}%` }} />
                        </div>
                      </div>
                    </div>

                    {Math.abs(diff) >= 3 && totalValue > 0 && (
                      <div className="pt-2.5 border-t border-white/[0.04]">
                        <p className="text-xs font-mono text-slate-300 flex items-center gap-2">
                          <span className="text-indigo-400">💡</span>
                          {isOver ? (
                            <span>
                              แนะนำขายออกประมาณ <strong className="text-amber-400">฿{diffAmount.toLocaleString('en-US', { maximumFractionDigits: 0 })}</strong> เพื่อลดสัดส่วนให้สมดุล
                            </span>
                          ) : (
                            <span>
                              แนะนำซื้อเพิ่มประมาณ <strong className="text-emerald-400">฿{diffAmount.toLocaleString('en-US', { maximumFractionDigits: 0 })}</strong> เพื่อเติมสัดส่วนให้ครบ
                            </span>
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Presets List */}
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
              <button onClick={() => revalidate()} className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-semibold text-white">ลองอีกครั้ง</button>
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
                const riskCfg = RISK_CONFIG[preset.riskProfile] ?? { label: preset.riskProfile, color: 'text-slate-300', bg: 'bg-slate-800' }
                const isActive = preset.id === activePreset?.id

                return (
                  <div
                    key={preset.id}
                    className={`p-5 rounded-2xl bg-[#12151C] border transition-all duration-200 group flex flex-col justify-between min-h-[200px] shadow-xl shadow-black/30 ${
                      isActive ? 'border-indigo-500/50 ring-1 ring-indigo-500/20' : 'border-white/[0.08] hover:border-white/[0.16]'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-bold text-white text-base tracking-tight">{preset.presetName}</h4>
                          <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-md border mt-1.5 ${riskCfg.bg} ${riskCfg.color}`}>
                            {riskCfg.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEditModal(preset)} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors" title="แก้ไข">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDelete(preset.id)} className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors" title="ลบ">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-1.5">
                        {Object.entries(preset.targetAllocation).map(([cat, pct]) => {
                          return (
                            <span key={cat} className="px-2 py-0.5 rounded-md bg-[#181C25] border border-white/[0.06] text-slate-400 text-[10px] font-mono">
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

      {/* Preset Create / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in" onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false) }}>
          <div className="bg-[#12151C] border border-white/[0.1] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl shadow-black/80 flex flex-col max-h-[90vh]">
            <div className="px-6 py-4.5 border-b border-white/[0.08] flex items-center justify-between bg-[#181C25]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <Scale className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-white text-base tracking-tight">
                  {editingPreset ? 'แก้ไขแผนการลงทุน' : 'สร้างแผนการลงทุนใหม่'}
                </h3>
              </div>
              <button onClick={() => setModalOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer">
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

              <div>
                <label className={labelClass}>ชื่อแผนการลงทุน *</label>
                <input
                  type="text"
                  className={inputClass}
                  placeholder="เช่น พอร์ตเติบโต 80/20, All-Weather เกษียณ"
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
                  <option value="conservative" className="bg-[#12151C] text-white">ระมัดระวัง (Conservative)</option>
                  <option value="moderate" className="bg-[#12151C] text-white">สมดุล (Moderate)</option>
                  <option value="aggressive" className="bg-[#12151C] text-white">เชิงรุก (Aggressive)</option>
                </select>
              </div>

              {/* Allocations breakdown */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className={labelClass}>สัดส่วนเป้าหมาย (รวมต้องได้ 100%)</label>
                  <span className={`text-xs font-mono font-bold ${Math.abs(totalAllocForm - 100) < 0.01 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    รวม: {totalAllocForm}%
                  </span>
                </div>
                <div className="space-y-2.5 p-3.5 rounded-xl bg-[#181C25] border border-white/[0.06]">
                  {DEFAULT_CATEGORIES.map((cat) => {
                    const cfg = CATEGORY_CONFIG[cat] ?? { label: cat, emoji: '📊' }
                    return (
                      <div key={cat} className="flex items-center justify-between gap-3">
                        <span className="text-xs font-medium text-slate-300 flex items-center gap-1.5 min-w-[120px]">
                          <span>{cfg.emoji}</span>
                          <span>{cfg.label}</span>
                        </span>
                        <div className="flex items-center gap-1.5 w-24">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            className="w-full bg-[#12151C] border border-white/[0.1] rounded-lg px-2.5 py-1.5 text-xs text-white font-mono text-right outline-none focus:border-indigo-500"
                            value={formData.targetAllocation[cat] ?? 0}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0
                              setFormData({
                                ...formData,
                                targetAllocation: { ...formData.targetAllocation, [cat]: val },
                              })
                            }}
                          />
                          <span className="text-xs text-slate-500 font-mono">%</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className={labelClass}>เงินออมต่อเดือน (฿)</label>
                  <input
                    type="number"
                    step="1000"
                    className={inputClass}
                    value={formData.monthlyContribution}
                    onChange={(e) => setFormData({ ...formData, monthlyContribution: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label className={labelClass}>เป้าหมายมูลค่าพอร์ต (฿)</label>
                  <input
                    type="number"
                    step="50000"
                    className={inputClass}
                    value={formData.targetAmount}
                    onChange={(e) => setFormData({ ...formData, targetAmount: parseFloat(e.target.value) || 0 })}
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
                  ตั้งเป็นแผนสัดส่วนเริ่มต้นของระบบ (Default)
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
                  <span>{editingPreset ? 'บันทึกการแก้ไข' : 'สร้างแผน'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  )
}
