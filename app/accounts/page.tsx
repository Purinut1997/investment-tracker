'use client'

import React, { useState, useEffect } from 'react'
import useSWR, { mutate } from 'swr'
import { AppShell } from '@/components/AppShell'
import {
  Wallet,
  Plus,
  Building2,
  Coins,
  Landmark,
  Banknote,
  Edit2,
  Trash2,
  AlertCircle,
  Loader2,
  Check,
  X,
  Layers,
  ArrowRight
} from 'lucide-react'

const ACCOUNT_TYPES = [
  { value: 'brokerage', label: 'โบรกเกอร์ (Brokerage)', icon: Building2, desc: 'เช่น Dime, InnovestX, Interactive Brokers', color: 'text-blue-400', glow: 'from-blue-500/20' },
  { value: 'crypto_exchange', label: 'ศูนย์ซื้อขายคริปโต (Crypto)', icon: Coins, desc: 'เช่น Bitkub, Binance', color: 'text-amber-400', glow: 'from-amber-500/20' },
  { value: 'bank', label: 'บัญชีธนาคาร (Bank)', icon: Landmark, desc: 'เงินฝากประจำ/ออมทรัพย์', color: 'text-emerald-400', glow: 'from-emerald-500/20' },
  { value: 'cash', label: 'เงินสด (Cash)', icon: Banknote, desc: 'เงินสดสำหรับรอจังหวะลงทุน', color: 'text-violet-400', glow: 'from-violet-500/20' },
]

export default function AccountsPage() {
  const { data, isLoading, error } = useSWR('/api/accounts')
  const accounts: any[] = Array.isArray(data) ? data : (data?.accounts ?? [])

  const [modalOpen, setModalOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<any | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [formData, setFormData] = useState({
    accountName: '',
    accountType: 'brokerage',
    currency: 'THB',
  })

  // ESC key and body scroll lock for account modal
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
    setEditingAccount(null)
    setFormData({ accountName: '', accountType: 'brokerage', currency: 'THB' })
    setFormError('')
    setModalOpen(true)
  }

  function openEditModal(acc: any) {
    setEditingAccount(acc)
    setFormData({
      accountName: acc.accountName,
      accountType: acc.accountType,
      currency: acc.currency,
    })
    setFormError('')
    setModalOpen(true)
  }

  async function handleSaveAccount(e: React.FormEvent) {
    e.preventDefault()
    if (!formData.accountName.trim()) { setFormError('กรุณากรอกชื่อบัญชี'); return }
    setSubmitting(true); setFormError('')
    try {
      const url = editingAccount ? `/api/accounts/${editingAccount.id}` : '/api/accounts'
      const method = editingAccount ? 'PUT' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) })
      const resJson = await res.json()
      if (!res.ok) throw new Error(resJson.error || 'ไม่สามารถบันทึกบัญชีได้')
      mutate('/api/accounts')
      setModalOpen(false)
    } catch (err: any) {
      setFormError(err.message || 'เกิดข้อผิดพลาด')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeleteAccount(acc: any) {
    if (acc._count?.transactions > 0) {
      alert(`ไม่สามารถลบบัญชี "${acc.accountName}" ได้ เนื่องจากมีธุรกรรม ${acc._count.transactions} รายการที่ผูกอยู่`)
      return
    }
    if (!confirm(`คุณต้องการลบบัญชี "${acc.accountName}" ใช่หรือไม่?`)) return
    setDeletingId(acc.id)
    try {
      const res = await fetch(`/api/accounts/${acc.id}`, { method: 'DELETE' })
      const resJson = await res.json()
      if (!res.ok) throw new Error(resJson.error || 'ลบบัญชีไม่สำเร็จ')
      mutate('/api/accounts')
    } catch (err: any) {
      alert(err.message || 'ลบบัญชีไม่สำเร็จ')
    } finally {
      setDeletingId(null)
    }
  }

  const brokerageCount = accounts.filter((a) => a.accountType === 'brokerage').length
  const cryptoCount = accounts.filter((a) => a.accountType === 'crypto_exchange').length
  const bankCount = accounts.filter((a) => a.accountType === 'bank' || a.accountType === 'cash').length

  return (
    <AppShell>
      <div className="space-y-6">
        {/* ── Header ─────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-400 shadow-[0_0_20px_rgba(139,92,246,0.25)]">
                <Wallet className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">บัญชีการเงิน</h1>
            </div>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] pl-11">
              จัดการพอร์ตและบัญชีลงทุนต่างๆ — Brokerage, Crypto, Bank, Cash
            </p>
          </div>
          <button
            onClick={openCreateModal}
            className="btn btn-primary text-xs sm:text-sm py-2.5 px-5 flex items-center gap-2 shadow-[0_0_20px_rgba(34,211,238,0.2)] self-start sm:self-auto"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>สร้างบัญชีใหม่</span>
          </button>
        </div>

        {/* ── Stats Row ───────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'บัญชีทั้งหมด', value: `${accounts.length}`, icon: Layers, color: 'text-[var(--cyan-400)]', bg: 'bg-cyan-500/10' },
            { label: 'โบรกเกอร์หุ้น', value: `${brokerageCount}`, icon: Building2, color: 'text-blue-400', bg: 'bg-blue-500/10' },
            { label: 'Crypto Exchange', value: `${cryptoCount}`, icon: Coins, color: 'text-amber-400', bg: 'bg-amber-500/10' },
            { label: 'ธนาคาร & เงินสด', value: `${bankCount}`, icon: Landmark, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          ].map((stat) => {
            const Icon = stat.icon
            return (
              <div key={stat.label} className="p-5 rounded-2xl bg-white/[0.04] backdrop-blur-2xl border border-white/[0.08] shadow-[0_4px_24px_rgba(0,0,0,0.3)] flex items-start gap-3.5 hover:border-white/15 transition-all">
                <div className={`w-10 h-10 rounded-xl ${stat.bg} border border-white/[0.08] flex items-center justify-center shrink-0 ${stat.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider truncate">{stat.label}</p>
                  <p className="text-2xl font-extrabold text-white mt-0.5 tabular-nums">{stat.value}</p>
                </div>
              </div>
            )
          })}
        </div>

        {/* ── Accounts Grid ───────────────────────────────── */}
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-[var(--text-muted)]">
            <Loader2 className="w-7 h-7 animate-spin text-[var(--cyan-400)]" />
            <span className="text-xs">กำลังโหลดบัญชีการเงิน...</span>
          </div>
        ) : error ? (
          <div className="p-8 rounded-2xl bg-white/[0.04] border border-red-500/20 text-center text-[var(--red-400)] text-xs">เกิดข้อผิดพลาดในการโหลดข้อมูลบัญชี</div>
        ) : accounts.length === 0 ? (
          <div className="p-16 rounded-3xl bg-white/[0.04] backdrop-blur-2xl border border-white/[0.08] text-center flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-2xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-[var(--text-muted)] mb-5">
              <Wallet className="w-8 h-8" />
            </div>
            <h3 className="font-bold text-white text-lg mb-2">ยังไม่มีบัญชีการลงทุน</h3>
            <p className="text-sm text-[var(--text-secondary)] max-w-sm mb-6">
              เริ่มต้นด้วยการสร้างบัญชีเพื่อบันทึกรายการซื้อขาย เช่น Dime, InnovestX, หรือ Bitkub
            </p>
            <button onClick={openCreateModal} className="btn btn-primary text-sm py-2.5 px-5 flex items-center gap-2">
              <Plus className="w-4 h-4" />
              <span>สร้างบัญชีแรกของคุณ</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {accounts.map((acc: any) => {
              const typeObj = ACCOUNT_TYPES.find((t) => t.value === acc.accountType) ?? ACCOUNT_TYPES[0]
              const Icon = typeObj.icon
              const txnCount = acc._count?.transactions ?? 0

              return (
                <div
                  key={acc.id}
                  className="p-6 rounded-3xl bg-white/[0.04] backdrop-blur-2xl border border-white/[0.08] hover:border-white/20 transition-all duration-300 shadow-[0_8px_32px_rgba(0,0,0,0.36)] group flex flex-col justify-between relative overflow-hidden"
                >
                  {/* Subtle top card shimmer */}
                  <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />

                  <div>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3.5">
                        <div className={`w-12 h-12 rounded-2xl bg-white/[0.06] border border-white/10 flex items-center justify-center group-hover:scale-105 transition-transform ${typeObj.color} shadow-sm`}>
                          <Icon className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="font-bold text-white text-base group-hover:text-[var(--violet)] transition-colors">
                            {acc.accountName}
                          </h3>
                          <span className="text-[11px] text-[var(--text-muted)] font-medium">
                            {typeObj.label.split(' ')[0]}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openEditModal(acc)}
                          className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--cyan-400)] hover:bg-white/[0.08] transition-colors"
                          title="แก้ไขบัญชี"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteAccount(acc)}
                          disabled={deletingId === acc.id}
                          className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          title="ลบบัญชี"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-white/[0.06] flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-[var(--text-muted)]">สกุลเงิน</span>
                        <span className="font-semibold text-white px-2 py-0.5 rounded-lg bg-white/[0.06] border border-white/[0.08]">
                          {acc.currency}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[var(--text-muted)]">บันทึกธุรกรรม</span>
                        <span className="font-bold text-white tabular-nums px-2 py-0.5 rounded-lg bg-violet-500/15 text-[var(--violet)] border border-violet-500/20">
                          {txnCount} รายการ
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Create / Edit Modal ─────────────────────────── */}
      {modalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false)
          }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-md animate-in fade-in"
        >
          <div className="bg-[var(--bg-surface-solid)]/95 border border-white/10 rounded-t-3xl sm:rounded-3xl w-full max-w-md overflow-hidden shadow-[0_24px_64px_rgba(0,0,0,0.75)]">
            <div className="p-4 sm:p-5 border-b border-white/[0.08] flex items-center justify-between bg-white/[0.02]">
              <h3 className="font-bold text-white text-base tracking-tight">
                {editingAccount ? 'แก้ไขบัญชีการเงิน' : 'สร้างบัญชีการเงินใหม่'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-xl text-[var(--text-muted)] hover:text-white hover:bg-white/[0.06] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAccount} className="p-5 space-y-4">
              {formError && (
                <div className="alert alert-danger text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="label">ชื่อบัญชี *</label>
                <input
                  type="text"
                  className="input text-sm"
                  placeholder="เช่น Dime, InnovestX, Bitkub, K-Bank"
                  value={formData.accountName}
                  onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="label">ประเภทบัญชี *</label>
                <div className="space-y-2">
                  {ACCOUNT_TYPES.map((type) => {
                    const Icon = type.icon
                    const isSelected = formData.accountType === type.value
                    return (
                      <div
                        key={type.value}
                        onClick={() => setFormData({ ...formData, accountType: type.value })}
                        className={`p-3 rounded-2xl border cursor-pointer flex items-center justify-between transition-all ${
                          isSelected
                            ? 'bg-violet-500/15 border-violet-500/40 text-white shadow-sm ring-1 ring-violet-500/30'
                            : 'bg-white/[0.03] border-white/[0.08] text-[var(--text-secondary)] hover:border-white/15'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className={`w-4 h-4 ${isSelected ? type.color : 'text-[var(--text-muted)]'}`} />
                          <div>
                            <p className="text-xs font-semibold text-white">{type.label}</p>
                            <p className="text-[10px] text-[var(--text-muted)]">{type.desc}</p>
                          </div>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-[var(--violet)]" />}
                      </div>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="label">สกุลเงินหลัก *</label>
                <select
                  className="select text-sm"
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                >
                  <option value="THB">THB — บาทไทย</option>
                  <option value="USD">USD — ดอลลาร์สหรัฐ</option>
                  <option value="EUR">EUR — ยูโร</option>
                  <option value="SGD">SGD — ดอลลาร์สิงคโปร์</option>
                  <option value="JPY">JPY — เยนญี่ปุ่น</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2.5">
                <button type="button" onClick={() => setModalOpen(false)} className="btn btn-ghost text-xs py-2 px-3.5">
                  ยกเลิก
                </button>
                <button type="submit" disabled={submitting} className="btn btn-primary text-xs py-2 px-5 flex items-center gap-2">
                  {submitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>กำลังบันทึก...</span>
                    </>
                  ) : (
                    <span>{editingAccount ? 'บันทึกการแก้ไข' : 'สร้างบัญชี'}</span>
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
