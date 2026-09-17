'use client'

import React, { useState, useEffect } from 'react'
import useSWR, { mutate } from 'swr'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/PageHeader'
import {
  Cpu,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  AlertCircle,
  Loader2,
  Shield,
  Star,
  Check,
  X,
  Layers,
} from 'lucide-react'

export default function SuperadminSettingsPage() {
  const { data: models, isLoading, error } = useSWR('/api/superadmin/models')
  const modelList: any[] = Array.isArray(models) ? models : []

  const [modalOpen, setModalOpen] = useState(false)
  const [editingModel, setEditingModel] = useState<any | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  const [formData, setFormData] = useState({
    modelId: '',
    displayName: '',
    tier: 'free',
    isDefaultForAuto: false,
    isActive: true,
    sortOrder: 1,
    notes: '',
  })

  // ESC key and body scroll lock
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
    setEditingModel(null)
    setFormData({
      modelId: '',
      displayName: '',
      tier: 'free',
      isDefaultForAuto: false,
      isActive: true,
      sortOrder: modelList.length + 1,
      notes: '',
    })
    setFormError('')
    setModalOpen(true)
  }

  function openEditModal(m: any) {
    setEditingModel(m)
    setFormData({
      modelId: m.modelId,
      displayName: m.displayName,
      tier: m.tier,
      isDefaultForAuto: m.isDefaultForAuto,
      isActive: m.isActive,
      sortOrder: m.sortOrder,
      notes: m.notes ?? '',
    })
    setFormError('')
    setModalOpen(true)
  }

  async function handleSaveModel(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setFormError('')

    try {
      const url = editingModel ? `/api/superadmin/models/${editingModel.id}` : '/api/superadmin/models'
      const method = editingModel ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const resJson = await res.json()
      if (!res.ok) throw new Error(resJson.error || 'บันทึกโมเดลไม่สำเร็จ')

      mutate('/api/superadmin/models')
      setModalOpen(false)
    } catch (err: any) {
      setFormError(err.message || 'เกิดข้อผิดพลาดในการบันทึก')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleToggleActive(m: any) {
    try {
      await fetch(`/api/superadmin/models/${m.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !m.isActive }),
      })
      mutate('/api/superadmin/models')
    } catch (err) {
      alert('เปลี่ยนสถานะไม่สำเร็จ')
    }
  }

  async function handleSetDefaultAuto(m: any) {
    try {
      await fetch(`/api/superadmin/models/${m.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefaultForAuto: true }),
      })
      mutate('/api/superadmin/models')
    } catch (err) {
      alert('ตั้งค่า Default ไม่สำเร็จ')
    }
  }

  async function handleDeleteModel(m: any) {
    if (!confirm(`คุณต้องการลบโมเดล "${m.displayName}" ใช่หรือไม่?`)) return
    try {
      await fetch(`/api/superadmin/models/${m.id}`, { method: 'DELETE' })
      mutate('/api/superadmin/models')
    } catch (err) {
      alert('ลบโมเดลไม่สำเร็จ')
    }
  }

  return (
    <AppShell>
      <div className="space-y-6 max-w-7xl mx-auto w-full pb-12">
        <PageHeader
          eyebrow="SUPERADMIN SYSTEM CONFIG"
          title="จัดการโมเดล AI"
          description="เพิ่มหรือแก้ไขรายชื่อ Google Gemini Models โดยไม่ต้อง deploy ระบบใหม่"
          action={
            <button
              onClick={openCreateModal}
              className="bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-medium px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-indigo-600/25 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>เพิ่มโมเดลใหม่</span>
            </button>
          }
        />

        {/* Models Table */}
        <div className="bg-[#12151C] border border-white/[0.08] rounded-2xl shadow-xl shadow-black/20 overflow-hidden">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-zinc-500">
              <Loader2 className="w-7 h-7 animate-spin text-indigo-400" />
              <span className="text-xs">กำลังโหลดรายชื่อโมเดล...</span>
            </div>
          ) : error ? (
            <div className="py-12 text-center text-xs text-rose-400">
              เกิดข้อผิดพลาดในการโหลดข้อมูลโมเดล
            </div>
          ) : modelList.length === 0 ? (
            <div className="py-12 text-center text-xs text-zinc-500">
              ยังไม่มีโมเดล AI ในระบบ
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#181C25]/80 text-zinc-400 font-semibold uppercase tracking-wider text-[11px] border-b border-white/[0.06]">
                  <tr>
                    <th className="py-3.5 px-4">ลำดับ / ชื่อแสดงผล</th>
                    <th className="py-3.5 px-4">Model ID (API String)</th>
                    <th className="py-3.5 px-4">Tier</th>
                    <th className="py-3.5 px-4">โหมด Auto Default</th>
                    <th className="py-3.5 px-4">สถานะใช้งาน</th>
                    <th className="py-3.5 px-4 text-right">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {modelList.map((m) => (
                    <tr key={m.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-white">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-zinc-500 font-mono">
                            #{m.sortOrder}
                          </span>
                          <span>{m.displayName}</span>
                        </div>
                        {m.notes && <p className="text-[11px] text-zinc-400 font-normal mt-0.5">{m.notes}</p>}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-cyan-400 text-xs">
                        {m.modelId}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                            m.tier === 'free'
                              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                              : 'bg-purple-500/15 border-purple-500/30 text-purple-300'
                          }`}
                        >
                          {m.tier.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {m.isDefaultForAuto ? (
                          <span className="inline-flex items-center gap-1.5 text-amber-400 font-semibold text-xs">
                            <Star className="w-3.5 h-3.5 fill-amber-400" />
                            <span>Auto Default</span>
                          </span>
                        ) : (
                          <button
                            onClick={() => handleSetDefaultAuto(m)}
                            className="text-xs text-zinc-500 hover:text-amber-400 transition-colors underline underline-offset-2"
                          >
                            ตั้งเป็น Default
                          </button>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => handleToggleActive(m)}
                          className={`px-3 py-1 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-all ${
                            m.isActive
                              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
                              : 'bg-zinc-800 border-white/10 text-zinc-400 hover:bg-zinc-700'
                          }`}
                        >
                          {m.isActive ? 'เปิดใช้งาน' : 'ปิดการใช้งาน'}
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEditModal(m)}
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors"
                            title="แก้ไขโมเดล"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteModel(m)}
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                            title="ลบโมเดล"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false)
          }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in"
        >
          <div className="bg-[#12151C] border border-white/10 rounded-t-3xl sm:rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-white/[0.08] flex items-center justify-between bg-white/[0.02]">
              <h3 className="font-semibold text-white text-base">
                {editingModel ? 'แก้ไขโมเดล AI' : 'เพิ่มโมเดล AI ใหม่'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveModel} className="p-5 space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-zinc-300">
                  ชื่อแสดงผล (Display Name) *
                </label>
                <input
                  type="text"
                  className="w-full bg-[#181C25] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                  placeholder="เช่น Gemini 2.0 Flash"
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-zinc-300">
                  Model ID ใน Google AI Studio (API Name) *
                </label>
                <input
                  type="text"
                  className="w-full bg-[#181C25] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors font-mono disabled:opacity-50"
                  placeholder="เช่น gemini-2.0-flash"
                  value={formData.modelId}
                  onChange={(e) => setFormData({ ...formData, modelId: e.target.value })}
                  required
                  disabled={Boolean(editingModel)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-zinc-300">ประเภท Tier</label>
                  <select
                    className="w-full bg-[#181C25] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors"
                    value={formData.tier}
                    onChange={(e) => setFormData({ ...formData, tier: e.target.value })}
                  >
                    <option value="free">Free Tier</option>
                    <option value="requires_billing">Requires Billing (Pro)</option>
                    <option value="paid_only">Paid Only</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-zinc-300">ลำดับ Fallback (Sort Order)</label>
                  <input
                    type="number"
                    className="w-full bg-[#181C25] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors font-mono"
                    value={formData.sortOrder}
                    onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 1 })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-zinc-300">หมายเหตุ (Notes)</label>
                <input
                  type="text"
                  className="w-full bg-[#181C25] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                  placeholder="เช่น รุ่นความเร็วสูง โควตาฟรี 15 RPM"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>

              <div className="space-y-2 pt-2 border-t border-white/[0.06]">
                <label className="flex items-center gap-2.5 text-xs text-zinc-200 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-white/20 bg-[#181C25] text-indigo-600 accent-indigo-600 cursor-pointer"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  />
                  <span>เปิดใช้งานโมเดลนี้ (Active)</span>
                </label>

                <label className="flex items-center gap-2.5 text-xs text-amber-300 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-white/20 bg-[#181C25] text-amber-500 accent-amber-500 cursor-pointer"
                    checked={formData.isDefaultForAuto}
                    onChange={(e) => setFormData({ ...formData, isDefaultForAuto: e.target.checked })}
                  />
                  <span>ตั้งเป็นตัวเลือกแรกของโหมด Auto (Default for Auto)</span>
                </label>
              </div>

              <div className="pt-3 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-xl text-xs font-medium shadow-md shadow-indigo-600/20 transition-all disabled:opacity-50"
                >
                  {submitting ? 'กำลังบันทึก...' : 'บันทึกโมเดล'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  )
}
