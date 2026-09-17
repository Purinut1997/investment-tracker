'use client'

import React, { useState } from 'react'
import useSWR, { mutate } from 'swr'
import Link from 'next/link'
import { AppShell } from '@/components/AppShell'
import {
  Scale,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Check,
  X,
  Loader2,
} from 'lucide-react'

const DEFAULT_CATEGORIES = ['US', 'TH', 'CRYPTO', 'GOLD', 'CASH']

const CATEGORY_CONFIG: Record<string, { label: string; emoji: string; color: string; barColor: string }> = {
  US:     { label: 'หุ้นสหรัฐฯ (US Stocks)',       emoji: '🇺🇸', color: 'text-blue-400',    barColor: 'bg-blue-400' },
  TH:     { label: 'หุ้นไทย (SET)',                 emoji: '🇹🇭', color: 'text-emerald-400', barColor: 'bg-emerald-400' },
  CRYPTO: { label: 'สินทรัพย์ดิจิทัล (Crypto)',    emoji: '🪙',  color: 'text-amber-400',   barColor: 'bg-amber-400' },
  GOLD:   { label: 'ทองคำ (Gold)',                  emoji: '🏆',  color: 'text-yellow-400',  barColor: 'bg-yellow-400' },
  CASH:   { label: 'เงินสด & ตราสารหนี้',          emoji: '💵',  color: 'text-violet-400',  barColor: 'bg-violet-400' },
}

const RISK_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  conservative: { label: 'Conservative (ต่ำ)',  color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  moderate:     { label: 'Moderate (ปานกลาง)', color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/20' },
  aggressive:   { label: 'Aggressive (สูง)',    color: 'text-rose-400',    bg: 'bg-rose-500/10 border-rose-500/20' },
}

export default function PlansPage() {
  const { data, isLoading } = useSWR('/api/plans')
  const presets: any[] = data?.presets ?? []
  const actualAllocation: Record<string, number> = data?.actualAllocation ?? {}
  const totalValue: number = data?.totalPortfolioValue ?? 0

  const [modalOpen, setModalOpen] = useState(false)
  const [editingPreset, setEditingPreset] = useState<any | null>(null)
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

  function openEditModal(preset: any) {
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
    const totalAlloc = Object.values(formData.targetAllocation).reduce((a, b) => a + Number(b || 0), 0)
    if (Math.abs(totalAlloc - 100) > 0.01) {
      setFormError(`ผลรวมสัดส่วนเป้าหมายต้องเท่ากับ 100% (ปัจจุบัน: ${totalAlloc}%)`)
      return
    }
    setSubmitting(true); setFormError('')
    try {
      const url = editingPreset ? `/api/plans/${editingPreset.id}` : '/api/plans'
      const method = editingPreset ? 'PUT' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) })
      const resJson = await res.json()
      if (!res.ok) throw new Error(resJson.error || 'บันทึกแผนไม่สำเร็จ')
      mutate('/api/plans')
      setModalOpen(false)
    } catch (err: any) {
      setFormError(err.message || 'เกิดข้อผิดพลาด')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('คุณต้องการลบแผนเป้าหมายนี้ใช่หรือไม่?')) return
    try {
      await fetch(`/api/plans/${id}`, { method: 'DELETE' })
      mutate('/api/plans')
    } catch {
      alert('ลบแผนไม่สำเร็จ')
    }
  }

  const totalAllocForm = Object.values(formData.targetAllocation).reduce((a, b) => a + Number(b || 0), 0)

  return (
    <AppShell>
      <div className="space-y-6">
        {/* ── Header ─────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500 to-violet-500 shadow-[0_0_20px_rgba(139,92,246,0.25)]">
                <Scale className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                แผนจัดสรรสินทรัพย์
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] pl-11">
              กำหนดสัดส่วนเป้าหมาย, ตรวจสอบความเบี่ยงเบน, และคำนวณ Rebalancing
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href="/forecast"
              className="btn btn-secondary text-xs sm:text-sm py-2 px-3.5 flex items-center gap-2"
            >
              <TrendingUp className="w-4 h-4" />
              <span>Monte Carlo</span>
            </Link>
            <button
              onClick={openCreateModal}
              className="btn btn-primary text-xs sm:text-sm py-2.5 px-5 flex items-center gap-2"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>สร้างแผนใหม่</span>
            </button>
          </div>
        </div>

        {/* ── Rebalancing Comparison ─────────────────────── */}
        {activePreset && (
          <div className="p-6 rounded-3xl bg-white/[0.04] backdrop-blur-2xl border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.36)] space-y-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-violet-400/40 to-transparent" />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--violet)] mb-0.5">
                  Active Allocation Plan
                </p>
                <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
                  {activePreset.presetName}
                  {activePreset.isDefault && (
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-violet-500/20 text-[var(--violet)] font-semibold border border-violet-500/30">
                      แผนหลัก (Default)
                    </span>
                  )}
                </h2>
              </div>

              {presets.length > 1 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--text-muted)]">สลับดูแผน:</span>
                  <select
                    className="select text-xs py-1.5 rounded-xl bg-white/[0.04] border-white/[0.08]"
                    value={activePreset.id}
                    onChange={(e) => setSelectedPresetId(e.target.value)}
                  >
                    {presets.map((p) => (
                      <option key={p.id} value={p.id}>{p.presetName}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Comparison Bars */}
            <div className="space-y-3.5">
              <p className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                เปรียบเทียบสัดส่วนปัจจุบัน vs เป้าหมาย
              </p>
              {Object.entries(activePreset.targetAllocation as Record<string, number>).map(([category, targetPct]) => {
                const cfg = CATEGORY_CONFIG[category] ?? { label: category, emoji: '📊', color: 'text-slate-400', barColor: 'bg-slate-400' }
                const actualPct = actualAllocation[category] ?? 0
                const diff = actualPct - targetPct
                const isOver = diff > 0
                const diffAmount = (Math.abs(diff) / 100) * totalValue
                const isOnTarget = Math.abs(diff) < 2

                return (
                  <div key={category} className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-white/15 transition-all space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-white flex items-center gap-2">
                        <span className="text-base">{cfg.emoji}</span>
                        <span>{cfg.label}</span>
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-[var(--text-muted)]">
                          เป้า <strong className="text-white">{targetPct}%</strong>
                        </span>
                        <span className="text-[var(--text-muted)]">
                          ตอนนี้ <strong className={cfg.color}>{actualPct.toFixed(1)}%</strong>
                        </span>
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg border tabular-nums ${
                          isOnTarget ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25'
                          : isOver    ? 'bg-amber-500/15 text-amber-300 border-amber-500/25'
                                      : 'bg-rose-500/15 text-rose-400 border-rose-500/25'
                        }`}>
                          {diff > 0 ? '+' : ''}{diff.toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    {/* Dual bar: target vs actual */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2.5">
                        <span className="text-[10px] font-medium text-[var(--text-muted)] w-10">เป้า</span>
                        <div className="flex-1 h-2 bg-white/[0.05] rounded-full overflow-hidden">
                          <div className="h-full bg-white/25 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, targetPct)}%` }} />
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <span className="text-[10px] font-medium text-[var(--text-muted)] w-10">จริง</span>
                        <div className="flex-1 h-2 bg-white/[0.05] rounded-full overflow-hidden">
                          <div className={`h-full ${cfg.barColor} rounded-full transition-all duration-500 shadow-sm`} style={{ width: `${Math.min(100, actualPct)}%` }} />
                        </div>
                      </div>
                    </div>

                    {/* Recommendation */}
                    {Math.abs(diff) >= 3 && totalValue > 0 && (
                      <p className="text-[11px] text-[var(--text-secondary)] flex items-start gap-1.5 pt-1 border-t border-white/[0.04]">
                        <span className="shrink-0">💡</span>
                        {isOver ? (
                          <span className="text-amber-300">
                            แนะนำทยอยขายประมาณ ฿{diffAmount.toLocaleString('en-US', { maximumFractionDigits: 0 })} เพื่อคืนสัดส่วน
                          </span>
                        ) : (
                          <span className="text-[var(--cyan-400)]">
                            แนะนำลงทุนเพิ่มอีกประมาณ ฿{diffAmount.toLocaleString('en-US', { maximumFractionDigits: 0 })} ในสินทรัพย์หมวดนี้
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Presets List ────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              แผนการลงทุนของคุณ
              <span className="ml-2 text-[var(--text-muted)] font-normal normal-case">({presets.length})</span>
            </h3>
          </div>

          {isLoading ? (
            <div className="py-16 text-center text-xs text-[var(--text-muted)] flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-[var(--cyan-400)]" />
              <span>กำลังโหลดแผนการลงทุน...</span>
            </div>
          ) : presets.length === 0 ? (
            <div className="p-14 rounded-3xl bg-white/[0.04] backdrop-blur-2xl border border-white/[0.08] text-center flex flex-col items-center justify-center">
              <div className="w-16 h-16 rounded-2xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-[var(--text-muted)] mb-5">
                <Scale className="w-8 h-8" />
              </div>
              <h4 className="font-bold text-white text-lg mb-2">ยังไม่มีแผนการลงทุน</h4>
              <p className="text-sm text-[var(--text-secondary)] max-w-sm mb-6">
                สร้างแผนแรกเพื่อตั้งเป้าหมายสัดส่วนพอร์ต เช่น 80/20 หรือ All-Weather
              </p>
              <button onClick={openCreateModal} className="btn btn-primary text-sm py-2.5 px-5">
                สร้างแผนการลงทุน
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {presets.map((preset) => {
                const riskCfg = RISK_CONFIG[preset.riskProfile] ?? { label: preset.riskProfile, color: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/20' }
                const isActive = preset.id === activePreset?.id

                return (
                  <div
                    key={preset.id}
                    className={`p-6 rounded-3xl bg-white/[0.04] backdrop-blur-2xl border transition-all duration-300 shadow-[0_8px_32px_rgba(0,0,0,0.36)] relative overflow-hidden group flex flex-col justify-between ${
                      isActive ? 'border-violet-500/40 ring-1 ring-violet-500/30' : 'border-white/[0.08] hover:border-white/20'
                    }`}
                  >
                    {isActive && (
                      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />
                    )}

                    <div>
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-bold text-white text-base">{preset.presetName}</h4>
                          <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full border mt-1.5 ${riskCfg.bg} ${riskCfg.color}`}>
                            {riskCfg.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openEditModal(preset)}
                            className="p-1.5 text-[var(--text-muted)] hover:text-[var(--cyan-400)] rounded-lg hover:bg-cyan-500/10 transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(preset.id)}
                            className="p-1.5 text-[var(--text-muted)] hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Allocation Pills */}
                      <div className="mt-4 flex flex-wrap gap-1.5">
                        {Object.entries(preset.targetAllocation as Record<string, number>).map(([cat, pct]) => {
                          const catCfg = CATEGORY_CONFIG[cat]
                          return (
                            <span
                              key={cat}
                              className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-[var(--bg-elevated)] border border-[var(--border)] text-white"
                            >
                              {catCfg?.emoji} {cat}: {pct}%
                            </span>
                          )
                        })}
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-[var(--border)] flex items-center justify-between text-xs">
                      <span className="text-[var(--text-secondary)]">
                        ออมเพิ่ม ฿{Number(preset.monthlyContribution).toLocaleString()}/เดือน
                      </span>
                      {preset.isDefault ? (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-[var(--cyan-400)]">
                          <CheckCircle className="w-3 h-3" />
                          Default
                        </span>
                      ) : (
                        <button
                          onClick={() => setSelectedPresetId(preset.id)}
                          className="text-[11px] text-[var(--cyan-400)] hover:underline"
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

      {/* ── Preset Modal ────────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[var(--bg-surface-solid)] border border-[var(--border-strong)] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
              <h3 className="font-bold text-white text-base">
                {editingPreset ? 'แก้ไขแผนการลงทุน' : 'สร้างแผนเป้าหมายใหม่'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-white hover:bg-[var(--bg-elevated)] transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePreset} className="p-5 overflow-y-auto space-y-4 flex-1">
              {formError && (
                <div className="alert alert-danger text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="label">ชื่อแผนเป้าหมาย *</label>
                <input
                  type="text"
                  className="input text-sm"
                  placeholder="เช่น พอร์ตอิสรภาพ, 80/20 DCA, All-Weather"
                  value={formData.presetName}
                  onChange={(e) => setFormData({ ...formData, presetName: e.target.value })}
                  required
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">ระดับความเสี่ยง</label>
                  <select
                    className="select text-xs"
                    value={formData.riskProfile}
                    onChange={(e) => setFormData({ ...formData, riskProfile: e.target.value })}
                  >
                    <option value="conservative">ต่ำ (Conservative)</option>
                    <option value="moderate">ปานกลาง (Moderate)</option>
                    <option value="aggressive">สูง (Aggressive)</option>
                  </select>
                </div>
                <div>
                  <label className="label">เงินออมต่อเดือน (บาท)</label>
                  <input
                    type="number"
                    step="1000"
                    className="input text-xs"
                    value={formData.monthlyContribution}
                    onChange={(e) => setFormData({ ...formData, monthlyContribution: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>

              {/* Allocation Weights */}
              <div className="space-y-2 pt-2 border-t border-[var(--border)]">
                <div className="flex items-center justify-between">
                  <label className="label mb-0">สัดส่วนสินทรัพย์เป้าหมาย (%) *</label>
                  <span className={`text-xs font-bold tabular-nums ${Math.abs(totalAllocForm - 100) < 0.01 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {totalAllocForm}% / 100%
                  </span>
                </div>

                {DEFAULT_CATEGORIES.map((cat) => {
                  const catCfg = CATEGORY_CONFIG[cat]
                  return (
                    <div key={cat} className="flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold text-[var(--text-secondary)] flex items-center gap-1.5">
                        <span>{catCfg?.emoji}</span>
                        <span className="truncate">{catCfg?.label ?? cat}</span>
                      </span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="5"
                          className="input text-xs w-20 text-right font-bold"
                          value={formData.targetAllocation[cat] ?? 0}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0
                            setFormData({ ...formData, targetAllocation: { ...formData.targetAllocation, [cat]: val } })
                          }}
                        />
                        <span className="text-xs text-[var(--text-muted)]">%</span>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="label">เป้าหมายมูลค่าพอร์ต (บาท)</label>
                  <input
                    type="number"
                    step="100000"
                    className="input text-xs"
                    placeholder="เช่น 1,000,000"
                    value={formData.targetAmount}
                    onChange={(e) => setFormData({ ...formData, targetAmount: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label className="label">วันที่เป้าหมาย</label>
                  <input
                    type="date"
                    className="input text-xs"
                    value={formData.targetDate}
                    onChange={(e) => setFormData({ ...formData, targetDate: e.target.value })}
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-[var(--cyan-400)] pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  className="accent-cyan-400 w-3.5 h-3.5"
                  checked={formData.isDefault}
                  onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                />
                <span>ตั้งเป็นแผนเริ่มต้นของพอร์ต (Default Plan)</span>
              </label>

              <div className="pt-3 border-t border-[var(--border)] flex justify-end gap-2">
                <button type="button" onClick={() => setModalOpen(false)} className="btn btn-ghost text-xs py-2 px-3">
                  ยกเลิก
                </button>
                <button type="submit" disabled={submitting} className="btn btn-primary text-xs py-2 px-4 flex items-center gap-2">
                  {submitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>กำลังบันทึก...</span>
                    </>
                  ) : (
                    <span>บันทึกแผน</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  )
}
