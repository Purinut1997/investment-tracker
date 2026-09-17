'use client'

import React, { useState } from 'react'
import useSWR, { mutate } from 'swr'
import { AppShell } from '@/components/AppShell'
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
  Layers
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
      setFormError(err.message || 'เกิดข้อผิดพลาด')
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
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Superadmin System Config
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-2.5">
              <Cpu className="w-7 h-7 text-amber-400" />
              <span>จัดการโมเดล AI (AiModelOption)</span>
            </h1>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
              เพิ่ม/แก้ไขรายชื่อ Google Gemini Models ได้ทันทีโดยไม่ต้อง Redeploy ระบบ
            </p>
          </div>

          <button
            onClick={openCreateModal}
            className="btn btn-primary text-xs sm:text-sm py-2 px-4 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>เพิ่มโมเดลใหม่</span>
          </button>
        </div>

        {/* Models Table */}
        <div className="card overflow-hidden">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-[var(--text-muted)]">
              <Loader2 className="w-7 h-7 animate-spin text-amber-400" />
              <span className="text-xs">กำลังโหลดรายชื่อโมเดล...</span>
            </div>
          ) : error ? (
            <div className="py-12 text-center text-xs text-red-400">
              เกิดข้อผิดพลาดในการโหลดข้อมูลโมเดล
            </div>
          ) : modelList.length === 0 ? (
            <div className="py-12 text-center text-xs text-[var(--text-muted)]">
              ยังไม่มีโมเดล AI ในระบบ
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[var(--bg-elevated)]/60 text-[var(--text-muted)] uppercase tracking-wider text-[11px] border-b border-[var(--border)]">
                  <tr>
                    <th className="py-3 px-4">ลำดับ / ชื่อแสดงผล</th>
                    <th className="py-3 px-4">Model ID (API String)</th>
                    <th className="py-3 px-4">Tier</th>
                    <th className="py-3 px-4">โหมด Auto Default</th>
                    <th className="py-3 px-4">สถานะใช้งาน</th>
                    <th className="py-3 px-4 text-right">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {modelList.map((m) => (
                    <tr key={m.id} className="hover:bg-[var(--bg-elevated)]/30 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-white">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-[var(--text-muted)] font-mono">
                            #{m.sortOrder}
                          </span>
                          <span>{m.displayName}</span>
                        </div>
                        {m.notes && <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{m.notes}</p>}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[var(--cyan-400)] text-xs">
                        {m.modelId}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            m.tier === 'free'
                              ? 'bg-green-500/10 border-green-500/20 text-[var(--green-400)]'
                              : 'bg-purple-500/15 border-purple-500/30 text-purple-300'
                          }`}
                        >
                          {m.tier.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {m.isDefaultForAuto ? (
                          <span className="inline-flex items-center gap-1 text-amber-400 font-bold text-xs">
                            <Star className="w-3.5 h-3.5 fill-amber-400" />
                            <span>Auto Default</span>
                          </span>
                        ) : (
                          <button
                            onClick={() => handleSetDefaultAuto(m)}
                            className="text-[11px] text-[var(--text-muted)] hover:text-amber-300 underline"
                          >
                            ตั้งเป็น Default
                          </button>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => handleToggleActive(m)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold border flex items-center gap-1.5 ${
                            m.isActive
                              ? 'bg-emerald-500/10 border-green-500/20 text-[var(--green-400)]'
                              : 'bg-slate-500/10 border-slate-500/30 text-slate-400'
                          }`}
                        >
                          {m.isActive ? 'เปิดใช้งาน' : 'ปิดการใช้งาน'}
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditModal(m)}
                            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-white"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteModel(m)}
                            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
              <h3 className="font-bold text-white text-base">
                {editingModel ? 'แก้ไขโมเดล AI' : 'เพิ่มโมเดล AI ใหม่'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="p-1 rounded-lg text-[var(--text-muted)] hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveModel} className="p-5 space-y-4">
              {formError && (
                <div className="alert alert-danger text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="label">ชื่อแสดงผล (Display Name) *</label>
                <input
                  type="text"
                  className="input text-xs sm:text-sm"
                  placeholder="เช่น Gemini 2.0 Flash"
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="label">Model ID ใน Google AI Studio (API Name) *</label>
                <input
                  type="text"
                  className="input text-xs sm:text-sm font-mono"
                  placeholder="เช่น gemini-2.0-flash"
                  value={formData.modelId}
                  onChange={(e) => setFormData({ ...formData, modelId: e.target.value })}
                  required
                  disabled={Boolean(editingModel)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">ประเภท Tier</label>
                  <select
                    className="select text-xs"
                    value={formData.tier}
                    onChange={(e) => setFormData({ ...formData, tier: e.target.value })}
                  >
                    <option value="free">Free Tier</option>
                    <option value="requires_billing">Requires Billing (Pro)</option>
                    <option value="paid_only">Paid Only</option>
                  </select>
                </div>
                <div>
                  <label className="label">ลำดับ Fallback (Sort Order)</label>
                  <input
                    type="number"
                    className="input text-xs"
                    value={formData.sortOrder}
                    onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 1 })}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="label">หมายเหตุ (Notes)</label>
                <input
                  type="text"
                  className="input text-xs"
                  placeholder="เช่น รุ่นความเร็วสูง โควตาฟรี 15 RPM"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>

              <div className="space-y-2 pt-2 border-t border-[var(--border)]">
                <label className="flex items-center gap-2 text-xs text-white cursor-pointer">
                  <input
                    type="checkbox"
                    className="accent-cyan-400"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  />
                  <span>เปิดใช้งานโมเดลนี้ (Active)</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-amber-300 cursor-pointer">
                  <input
                    type="checkbox"
                    className="accent-amber-400"
                    checked={formData.isDefaultForAuto}
                    onChange={(e) => setFormData({ ...formData, isDefaultForAuto: e.target.checked })}
                  />
                  <span>ตั้งเป็นตัวเลือกแรกของโหมด Auto (Default for Auto)</span>
                </label>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button type="button" onClick={() => setModalOpen(false)} className="btn btn-ghost text-xs py-2 px-3">
                  ยกเลิก
                </button>
                <button type="submit" disabled={submitting} className="btn btn-primary text-xs py-2 px-4">
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
