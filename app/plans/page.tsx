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
} from 'lucide-react'

const DEFAULT_CATEGORIES = ['US', 'TH', 'CRYPTO', 'GOLD', 'CASH']

const CATEGORY_CONFIG: Record<string, { label: string; emoji: string; color: string; barColor: string }> = {
  US:     { label: 'US Equities',  emoji: '🇺🇸', color: 'text-zinc-300', barColor: 'bg-zinc-300' },
  TH:     { label: 'Thai Equities',emoji: '🇹🇭', color: 'text-zinc-400', barColor: 'bg-zinc-400' },
  CRYPTO: { label: 'Crypto',       emoji: '🪙', color: 'text-zinc-500', barColor: 'bg-zinc-500' },
  GOLD:   { label: 'Gold',         emoji: '🏆', color: 'text-zinc-600', barColor: 'bg-zinc-600' },
  CASH:   { label: 'Cash & Bonds', emoji: '💵', color: 'text-zinc-700', barColor: 'bg-zinc-700' },
}

const RISK_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  conservative: { label: 'CONSERVATIVE', color: 'text-zinc-500', bg: 'bg-white/5 border-white/10' },
  moderate:     { label: 'MODERATE',     color: 'text-zinc-300', bg: 'bg-white/10 border-white/20' },
  aggressive:   { label: 'AGGRESSIVE',   color: 'text-white',    bg: 'bg-white/20 border-white/30' },
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
      setFormError(`Target allocation must sum to 100% (Current: ${totalAlloc}%)`)
      return
    }
    setSubmitting(true); setFormError('')
    try {
      const url = editingPreset ? `/api/plans/${editingPreset.id}` : '/api/plans'
      const method = editingPreset ? 'PUT' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) })
      const resJson = await res.json()
      if (!res.ok) throw new Error(resJson.error || 'Failed to save plan')
      mutate('/api/plans')
      setModalOpen(false)
    } catch (err: any) {
      setFormError(err.message || 'An error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this plan?')) return
    try {
      await fetch(`/api/plans/${id}`, { method: 'DELETE' })
      mutate('/api/plans')
    } catch {
      alert('Failed to delete plan')
    }
  }

  const totalAllocForm = Object.values(formData.targetAllocation).reduce((a, b) => a + Number(b || 0), 0)
  
  const inputClass = "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-zinc-500 transition-colors font-mono"
  const labelClass = "block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2"

  return (
    <AppShell>
      <div className="space-y-8 max-w-[1600px] mx-auto w-full">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">แผนการลงทุน</h1>
            <p className="text-sm text-zinc-500 mt-1">กำหนดสัดส่วนเป้าหมาย ตรวจสอบความเบี่ยงเบน และปรับพอร์ต</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/forecast"
              className="bg-[#050505] text-zinc-400 hover:text-white border border-white/10 hover:bg-white/5 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors"
            >
              <TrendingUp className="w-4 h-4" /> Monte Carlo
            </Link>
            <button onClick={openCreateModal} className="bg-white text-black hover:bg-zinc-200 px-5 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition-colors h-[34px]">
              <Plus className="w-4 h-4" /> สร้างแผนใหม่
            </button>
          </div>
        </div>

        {/* Rebalancing Comparison */}
        {activePreset && (
          <div className="p-6 md:p-8 rounded-3xl bg-[#0a0a0a] border border-white/5 space-y-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">
                  ACTIVE ALLOCATION PLAN
                </p>
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold text-white tracking-wide">
                    {activePreset.presetName}
                  </h2>
                  {activePreset.isDefault && (
                    <span className="text-[9px] px-2 py-0.5 rounded-sm bg-white/10 text-white font-mono uppercase tracking-widest">
                      DEFAULT
                    </span>
                  )}
                </div>
              </div>

              {presets.length > 1 && (
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">SWITCH PLAN:</span>
                  <select
                    className="bg-[#050505] border border-white/10 text-xs text-white rounded-lg px-3 py-2 outline-none font-mono focus:border-zinc-500"
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
            <div className="space-y-4">
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                TARGET VS ACTUAL ALLOCATION
              </p>
              {Object.entries(activePreset.targetAllocation as Record<string, number>).map(([category, targetPct]) => {
                const cfg = CATEGORY_CONFIG[category] ?? { label: category, emoji: '📊', color: 'text-zinc-400', barColor: 'bg-zinc-400' }
                const actualPct = actualAllocation[category] ?? 0
                const diff = actualPct - targetPct
                const isOver = diff > 0
                const diffAmount = (Math.abs(diff) / 100) * totalValue
                const isOnTarget = Math.abs(diff) < 2

                return (
                  <div key={category} className="p-5 rounded-2xl bg-[#050505] border border-white/5 hover:border-white/10 transition-colors space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <span className="font-bold text-white flex items-center gap-2 tracking-wide text-sm">
                        <span>{cfg.emoji}</span>
                        <span className="uppercase">{cfg.label}</span>
                      </span>
                      
                      <div className="flex items-center gap-4 text-xs font-mono">
                        <div className="flex flex-col items-end">
                          <span className="text-[9px] text-zinc-500 tracking-widest">TARGET</span>
                          <span className="text-white">{targetPct}%</span>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-[9px] text-zinc-500 tracking-widest">ACTUAL</span>
                          <span className={cfg.color}>{actualPct.toFixed(1)}%</span>
                        </div>
                        <div className="flex flex-col items-end pl-2 border-l border-white/10">
                          <span className="text-[9px] text-zinc-500 tracking-widest">DRIFT</span>
                          <span className={`font-bold ${
                            isOnTarget ? 'text-zinc-500'
                            : isOver ? 'text-white' : 'text-zinc-300'
                          }`}>
                            {diff > 0 ? '+' : ''}{diff.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <span className="text-[9px] font-bold text-zinc-600 w-12 tracking-widest">TARGET</span>
                        <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-white/20 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, targetPct)}%` }} />
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[9px] font-bold text-zinc-600 w-12 tracking-widest">ACTUAL</span>
                        <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div className={`h-full ${cfg.barColor} rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(255,255,255,0.1)]`} style={{ width: `${Math.min(100, actualPct)}%` }} />
                        </div>
                      </div>
                    </div>

                    {Math.abs(diff) >= 3 && totalValue > 0 && (
                      <div className="pt-3 border-t border-white/5">
                        <p className="text-[10px] font-mono text-zinc-400 flex items-center gap-2">
                          <span className="w-4 h-4 rounded bg-white/10 flex items-center justify-center shrink-0">💡</span>
                          {isOver ? (
                            <span>
                              SELL ~฿{diffAmount.toLocaleString('en-US', { maximumFractionDigits: 0 })} TO REBALANCE
                            </span>
                          ) : (
                            <span className="text-white">
                              BUY ~฿{diffAmount.toLocaleString('en-US', { maximumFractionDigits: 0 })} TO REBALANCE
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
        <div>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
              SAVED PLANS ({presets.length})
            </h3>
          </div>

          {isLoading ? (
            <div className="py-16 text-center flex flex-col items-center justify-center gap-3 text-zinc-500">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="text-[10px] font-mono tracking-widest uppercase">Loading plans...</span>
            </div>
          ) : presets.length === 0 ? (
            <div className="p-14 rounded-3xl bg-[#0a0a0a] border border-white/5 text-center flex flex-col items-center justify-center min-h-[300px]">
              <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center text-zinc-600 mb-6">
                <Scale className="w-8 h-8" />
              </div>
              <h4 className="font-bold text-white text-lg mb-2">NO PLANS CREATED</h4>
              <p className="text-[10px] font-mono tracking-widest text-zinc-500 max-w-sm mb-6 uppercase">
                Create a target allocation plan to guide your investments.
              </p>
              <button onClick={openCreateModal} className="bg-white text-black hover:bg-zinc-200 text-xs font-bold py-2.5 px-6 rounded-xl transition-colors">
                CREATE FIRST PLAN
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {presets.map((preset) => {
                const riskCfg = RISK_CONFIG[preset.riskProfile] ?? { label: preset.riskProfile, color: 'text-zinc-500', bg: 'bg-white/5' }
                const isActive = preset.id === activePreset?.id

                return (
                  <div
                    key={preset.id}
                    className={`p-6 rounded-3xl bg-[#0a0a0a] border transition-all duration-300 relative overflow-hidden group flex flex-col justify-between min-h-[220px] ${
                      isActive ? 'border-white/20' : 'border-white/5 hover:border-white/15'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-bold text-white text-lg tracking-wide">{preset.presetName}</h4>
                          <span className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded-sm border mt-2 uppercase tracking-widest ${riskCfg.bg} ${riskCfg.color}`}>
                            {riskCfg.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEditModal(preset)} className="p-2 text-zinc-500 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDelete(preset.id)} className="p-2 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="mt-5 flex flex-wrap gap-2">
                        {Object.entries(preset.targetAllocation as Record<string, number>).map(([cat, pct]) => {
                          return (
                            <span key={cat} className="px-2 py-1 rounded bg-[#050505] border border-white/5 text-zinc-400 text-[10px] font-mono">
                              {cat} <span className="text-white font-bold ml-1">{pct}%</span>
                            </span>
                          )
                        })}
                      </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between">
                      <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
                        +฿{Number(preset.monthlyContribution).toLocaleString()}/MO
                      </span>
                      {preset.isDefault ? (
                        <span className="flex items-center gap-1.5 text-[9px] font-bold text-white tracking-widest uppercase">
                          <CheckCircle className="w-3 h-3" /> DEFAULT
                        </span>
                      ) : (
                        <button onClick={() => setSelectedPresetId(preset.id)} className="text-[9px] font-bold text-zinc-500 hover:text-white uppercase tracking-widest transition-colors">
                          VIEW PLAN
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

      {/* Preset Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in" onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false) }}>
          <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between bg-[#050505]">
              <h3 className="font-bold text-white text-base tracking-tight uppercase">
                {editingPreset ? 'EDIT PLAN' : 'NEW PLAN'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="p-2 rounded-full text-zinc-500 hover:text-white hover:bg-white/10 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePreset} className="p-6 overflow-y-auto space-y-6 flex-1">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-2 text-xs text-rose-400">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className={labelClass}>PLAN NAME</label>
                <input
                  type="text"
                  className={inputClass}
                  placeholder="e.g. 80/20 Growth, All-Weather"
                  value={formData.presetName}
                  onChange={(e) => setFormData({ ...formData, presetName: e.target.value })}
                  required
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>RISK PROFILE</label>
                  <select
                    className={inputClass}
                    value={formData.riskProfile}
                    onChange={(e) => setFormData({ ...formData, riskProfile: e.target.value })}
                  >
                    <option value="conservative">Conservative</option>
                    <option value="moderate">Moderate</option>
                    <option value="aggressive">Aggressive</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>MONTHLY SAVINGS (฿)</label>
                  <input
                    type="number"
                    step="1000"
                    className={inputClass}
                    value={formData.monthlyContribution}
                    onChange={(e) => setFormData({ ...formData, monthlyContribution: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>

              {/* Allocation Weights */}
              <div className="space-y-3 pt-4 border-t border-white/5">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest m-0">TARGET ALLOCATION (%)</label>
                  <span className={`text-[10px] font-bold font-mono tracking-widest ${Math.abs(totalAllocForm - 100) < 0.01 ? 'text-white' : 'text-rose-400'}`}>
                    {totalAllocForm}% / 100%
                  </span>
                </div>

                {DEFAULT_CATEGORIES.map((cat) => {
                  return (
                    <div key={cat} className="flex items-center justify-between gap-4">
                      <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-600"></span>
                        {cat}
                      </span>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="5"
                          className="bg-[#050505] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500 transition-colors w-20 text-right font-mono"
                          value={formData.targetAllocation[cat] ?? 0}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0
                            setFormData({ ...formData, targetAllocation: { ...formData.targetAllocation, [cat]: val } })
                          }}
                        />
                        <span className="text-xs font-mono text-zinc-500">%</span>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
                <div>
                  <label className={labelClass}>TARGET PORTFOLIO (฿)</label>
                  <input
                    type="number"
                    step="100000"
                    className={inputClass}
                    placeholder="1000000"
                    value={formData.targetAmount}
                    onChange={(e) => setFormData({ ...formData, targetAmount: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label className={labelClass}>TARGET DATE</label>
                  <input
                    type="date"
                    className={inputClass}
                    value={formData.targetDate}
                    onChange={(e) => setFormData({ ...formData, targetDate: e.target.value })}
                  />
                </div>
              </div>

              <label className="flex items-center gap-3 text-xs text-white cursor-pointer mt-2 bg-white/5 p-3 rounded-xl border border-white/5 hover:bg-white/10 transition-colors">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-white/20 bg-[#050505] text-white"
                  checked={formData.isDefault}
                  onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                />
                <span className="font-bold uppercase tracking-widest text-[10px]">Set as Default Plan</span>
              </label>

              <div className="pt-6 flex justify-end gap-3">
                <button type="button" onClick={() => setModalOpen(false)} className="px-5 py-2.5 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="bg-white text-black hover:bg-zinc-200 px-6 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors min-w-[120px] justify-center">
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>{editingPreset ? 'Save Changes' : 'Create Plan'}</span>
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
