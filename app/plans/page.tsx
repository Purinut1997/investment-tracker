'use client'

import React, { useState } from 'react'
import useSWR, { mutate } from 'swr'
import Link from 'next/link'
import { AppShell } from '@/components/AppShell'
import {
  PieChart,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  ArrowRight,
  Shield,
  Layers,
  Check,
  X,
  Loader2,
  Scale
} from 'lucide-react'

const DEFAULT_CATEGORIES = ['US', 'TH', 'CRYPTO', 'GOLD', 'CASH']

const CATEGORY_LABELS: Record<string, string> = {
  US: '🇺🇸 หุ้นสหรัฐฯ (US Stocks)',
  TH: '🇹🇭 หุ้นไทย (SET)',
  CRYPTO: '🪙 สินทรัพย์ดิจิทัล (Crypto)',
  GOLD: '🏆 ทองคำ (Gold)',
  CASH: '💵 เงินสด & ตราสารหนี้ (Cash/Bond)',
}

export default function PlansPage() {
  const { data, isLoading, error } = useSWR('/api/plans')
  const presets: any[] = data?.presets ?? []
  const actualAllocation: Record<string, number> = data?.actualAllocation ?? {}
  const totalValue: number = data?.totalPortfolioValue ?? 0

  const [modalOpen, setModalOpen] = useState(false)
  const [editingPreset, setEditingPreset] = useState<any | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  // Active preset for rebalance comparison
  const defaultPreset = presets.find((p) => p.isDefault) ?? presets[0]
  const [selectedPresetId, setSelectedPresetId] = useState<string>('')

  const activePreset = presets.find((p) => p.id === (selectedPresetId || defaultPreset?.id)) ?? defaultPreset

  // Form state
  const [formData, setFormData] = useState({
    presetName: '',
    riskProfile: 'moderate',
    targetAllocation: {
      US: 50,
      TH: 20,
      CRYPTO: 15,
      GOLD: 15,
    } as Record<string, number>,
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
    // Verify total allocation sums to 100
    const totalAlloc = Object.values(formData.targetAllocation).reduce((a, b) => a + Number(b || 0), 0)
    if (Math.abs(totalAlloc - 100) > 0.01) {
      setFormError(`ผลรวมสัดส่วนเป้าหมายต้องเท่ากับ 100% (ปัจจุบันรวมได้ ${totalAlloc}%)`)
      return
    }

    setSubmitting(true)
    setFormError('')

    try {
      const url = editingPreset ? `/api/plans/${editingPreset.id}` : '/api/plans'
      const method = editingPreset ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

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
    } catch (err) {
      alert('ลบแผนไม่สำเร็จ')
    }
  }

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-2.5">
              <Scale className="w-7 h-7 text-[var(--cyan-400)]" />
              <span>แผนจัดสรรสินทรัพย์ & Rebalancing</span>
            </h1>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
              กำหนดสัดส่วนเป้าหมาย (Target Allocation), ตรวจสอบความเบี่ยงเบน, และคำนวณการปรับสมดุลพอร์ต
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href="/forecast"
              className="btn btn-secondary text-xs sm:text-sm py-2 px-3.5 flex items-center gap-2"
            >
              <TrendingUp className="w-4 h-4" />
              <span>จำลอง Monte Carlo</span>
            </Link>
            <button
              onClick={openCreateModal}
              className="btn btn-primary text-xs sm:text-sm py-2 px-4 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>สร้างแผนเป้าหมายใหม่</span>
            </button>
          </div>
        </div>

        {/* REBALANCING COMPARISON SECTION */}
        {activePreset && (
          <div className="card p-5 sm:p-6 space-y-5 border-cyan-500/25 bg-gradient-to-br from-[var(--bg-surface)] to-[var(--bg-elevated)]/40">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[var(--border)]">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--cyan-400)]">
                  Active Preset
                </span>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>{activePreset.presetName}</span>
                  {activePreset.isDefault && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-[var(--cyan-400)] font-semibold border border-cyan-500/30">
                      Default
                    </span>
                  )}
                </h2>
              </div>

              {presets.length > 1 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--text-muted)]">สลับดูแผน:</span>
                  <select
                    className="select text-xs py-1"
                    value={activePreset.id}
                    onChange={(e) => setSelectedPresetId(e.target.value)}
                  >
                    {presets.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.presetName}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Comparison Bars */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                เปรียบเทียบสัดส่วนปัจจุบัน vs สัดส่วนเป้าหมาย (Current vs Target)
              </h3>

              <div className="space-y-3">
                {Object.entries(activePreset.targetAllocation as Record<string, number>).map(
                  ([category, targetPct]) => {
                    const actualPct = actualAllocation[category] ?? 0
                    const diff = actualPct - targetPct
                    const isOver = diff > 0
                    const diffAmount = (Math.abs(diff) / 100) * totalValue

                    return (
                      <div
                        key={category}
                        className="p-3.5 rounded-xl bg-[var(--bg-elevated)]/50 border border-[var(--border)] space-y-2"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-white">
                            {CATEGORY_LABELS[category] ?? category}
                          </span>
                          <div className="flex items-center gap-3">
                            <span className="text-[var(--text-muted)]">
                              เป้าหมาย: <strong className="text-white">{targetPct}%</strong>
                            </span>
                            <span className="text-[var(--text-muted)]">
                              ปัจจุบัน: <strong className="text-cyan-400">{actualPct.toFixed(1)}%</strong>
                            </span>
                            <span
                              className={`font-bold tabular-nums px-1.5 py-0.5 rounded text-[10px] ${
                                Math.abs(diff) < 2
                                  ? 'bg-emerald-500/15 text-emerald-400'
                                  : isOver
                                  ? 'bg-amber-500/15 text-amber-300'
                                  : 'bg-rose-500/15 text-rose-400'
                              }`}
                            >
                              {diff > 0 ? '+' : ''}
                              {diff.toFixed(1)}%
                            </span>
                          </div>
                        </div>

                        {/* Visual Bar */}
                        <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden flex">
                          <div
                            className="bg-[var(--cyan-400)] transition-all duration-500"
                            style={{ width: `${Math.min(100, actualPct)}%` }}
                          />
                        </div>

                        {/* Action Recommendation */}
                        {Math.abs(diff) >= 3 && totalValue > 0 && (
                          <p className="text-[11px] text-[var(--text-secondary)] flex items-center gap-1.5 pt-1">
                            <span>💡 แนะนำ:</span>
                            {isOver ? (
                              <span className="text-amber-300">
                                ทยอยขายทำกำไรประมาณ ฿{diffAmount.toLocaleString('en-US', { maximumFractionDigits: 0 })} เพื่อคืนสัดส่วน
                              </span>
                            ) : (
                              <span className="text-cyan-300">
                                ลงทุนเพิ่มอีกประมาณ ฿{diffAmount.toLocaleString('en-US', { maximumFractionDigits: 0 })} ในสินทรัพย์หมวดนี้
                              </span>
                            )}
                          </p>
                        )}
                      </div>
                    )
                  }
                )}
              </div>
            </div>
          </div>
        )}

        {/* PRESETS LIST CARDS */}
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3">
            แผนการลงทุนทั้งหมดของคุณ ({presets.length})
          </h3>

          {isLoading ? (
            <div className="py-16 text-center text-xs text-[var(--text-muted)] flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-[var(--cyan-400)]" />
              <span>กำลังโหลดแผนการลงทุน...</span>
            </div>
          ) : presets.length === 0 ? (
            <div className="card p-10 text-center flex flex-col items-center justify-center">
              <Scale className="w-10 h-10 text-[var(--text-muted)] mb-3" />
              <h4 className="font-bold text-white text-base">ยังไม่มีแผนการลงทุน</h4>
              <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-sm">
                สร้างแผนแรกเพื่อตั้งเป้าหมายสัดส่วนพอร์ต เช่น 80/20 หรือ All-Weather
              </p>
              <button
                onClick={openCreateModal}
                className="btn btn-primary text-xs mt-4 py-2 px-4"
              >
                สร้างแผนการลงทุน
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {presets.map((preset) => (
                <div
                  key={preset.id}
                  className={`card p-5 flex flex-col justify-between transition-all hover:border-cyan-500/40 ${
                    preset.id === activePreset?.id ? 'border-cyan-500/40 bg-cyan-950/10' : ''
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-bold text-white text-base">{preset.presetName}</h4>
                        <span className="text-[11px] text-[var(--text-muted)] capitalize">
                          ระดับความเสี่ยง: {preset.riskProfile}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEditModal(preset)}
                          className="p-1.5 text-[var(--text-muted)] hover:text-white rounded-lg hover:bg-[var(--bg-elevated)]"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(preset.id)}
                          className="p-1.5 text-[var(--text-muted)] hover:text-red-400 rounded-lg hover:bg-red-500/10"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Target Allocation Pills */}
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {Object.entries(preset.targetAllocation as Record<string, number>).map(
                        ([cat, pct]) => (
                          <span
                            key={cat}
                            className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-[var(--bg-elevated)] border border-[var(--border)] text-white"
                          >
                            {cat}: {pct}%
                          </span>
                        )
                      )}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-[var(--border)] flex items-center justify-between text-xs text-[var(--text-secondary)]">
                    <span>
                      ออมเพิ่ม: ฿{Number(preset.monthlyContribution).toLocaleString()}/ด.
                    </span>
                    {preset.isDefault ? (
                      <span className="text-[10px] font-bold text-cyan-400">Default Plan</span>
                    ) : (
                      <button
                        onClick={() => setSelectedPresetId(preset.id)}
                        className="text-[11px] text-cyan-400 hover:underline"
                      >
                        เลือกดูแผนนี้
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Preset Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
              <h3 className="font-bold text-white text-base">
                {editingPreset ? 'แก้ไขแผนการลงทุน' : 'สร้างแผนเป้าหมายใหม่'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="p-1 text-[var(--text-muted)] hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePreset} className="p-5 overflow-y-auto space-y-4 flex-1">
              {formError && (
                <div className="alert alert-danger text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="label">ชื่อแผนเป้าหมาย *</label>
                <input
                  type="text"
                  className="input text-xs sm:text-sm"
                  placeholder="เช่น พอร์ตอิสรภาพทางการเงิน, 80/20 DCA, All-Weather"
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
                  <label className="label">เงินออมลงทุนต่อเดือน (บาท)</label>
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
                  <label className="label">สัดส่วนสินทรัพย์เป้าหมาย (%) *</label>
                  <span className="text-xs font-bold text-cyan-400">
                    รวม:{' '}
                    {Object.values(formData.targetAllocation).reduce((a, b) => a + Number(b || 0), 0)}%
                    / 100%
                  </span>
                </div>

                {DEFAULT_CATEGORIES.map((cat) => (
                  <div key={cat} className="flex items-center justify-between gap-3 text-xs">
                    <span className="font-semibold text-[var(--text-secondary)] w-44">
                      {CATEGORY_LABELS[cat] ?? cat}
                    </span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="5"
                      className="input text-xs w-24 text-right font-bold"
                      value={formData.targetAllocation[cat] ?? 0}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0
                        setFormData({
                          ...formData,
                          targetAllocation: {
                            ...formData.targetAllocation,
                            [cat]: val,
                          },
                        })
                      }}
                    />
                    <span className="text-[var(--text-muted)]">%</span>
                  </div>
                ))}
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
                  <label className="label">วันที่เป้าหมาย (Target Date)</label>
                  <input
                    type="date"
                    className="input text-xs"
                    value={formData.targetDate}
                    onChange={(e) => setFormData({ ...formData, targetDate: e.target.value })}
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-cyan-300 pt-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="accent-cyan-400"
                  checked={formData.isDefault}
                  onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                />
                <span>ตั้งเป็นแผนเริ่มต้นของพอร์ต (Default Plan)</span>
              </label>

              <div className="pt-3 border-t border-[var(--border)] flex justify-end gap-2">
                <button type="button" onClick={() => setModalOpen(false)} className="btn btn-ghost text-xs py-2 px-3">
                  ยกเลิก
                </button>
                <button type="submit" disabled={submitting} className="btn btn-primary text-xs py-2 px-4">
                  {submitting ? 'กำลังบันทึก...' : 'บันทึกแผน'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  )
}
