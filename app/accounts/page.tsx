'use client'

import React, { useState } from 'react'
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
  ArrowRight,
  AlertCircle,
  Loader2,
  Check,
  X,
  Layers
} from 'lucide-react'

const ACCOUNT_TYPES = [
  { value: 'brokerage', label: 'โบรกเกอร์ (Brokerage)', icon: Building2, desc: 'เช่น Dime, InnovestX, Interactive Brokers' },
  { value: 'crypto_exchange', label: 'ศูนย์ซื้อขายคริปโต (Crypto)', icon: Coins, desc: 'เช่น Bitkub, Binance' },
  { value: 'bank', label: 'บัญชีธนาคาร (Bank)', icon: Landmark, desc: 'เงินฝากประจำ/ออมทรัพย์' },
  { value: 'cash', label: 'เงินสด (Cash)', icon: Banknote, desc: 'เงินสดสำหรับรอจังหวะลงทุน' },
]

export default function AccountsPage() {
  const { data, isLoading, error } = useSWR('/api/accounts')
  const accounts: any[] = Array.isArray(data) ? data : (data?.accounts ?? [])

  const [modalOpen, setModalOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<any | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Modal form state
  const [formData, setFormData] = useState({
    accountName: '',
    accountType: 'brokerage',
    currency: 'THB',
  })

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
    if (!formData.accountName.trim()) {
      setFormError('กรุณากรอกชื่อบัญชี')
      return
    }

    setSubmitting(true)
    setFormError('')

    try {
      const url = editingAccount ? `/api/accounts/${editingAccount.id}` : '/api/accounts'
      const method = editingAccount ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

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
      alert(`ไม่สามารถลบบัญชี "${acc.accountName}" ได้เนื่องจากมีธุรกรรม ${acc._count.transactions} รายการที่ผูกอยู่`)
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

  // Type Counts
  const brokerageCount = accounts.filter((a) => a.accountType === 'brokerage').length
  const cryptoCount = accounts.filter((a) => a.accountType === 'crypto_exchange').length
  const bankCount = accounts.filter((a) => a.accountType === 'bank' || a.accountType === 'cash').length

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-2.5">
              <Wallet className="w-7 h-7 text-[var(--cyan-400)]" />
              <span>บัญชีการเงิน</span>
            </h1>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
              จัดการพอร์ตและบัญชีลงทุนต่างๆ (Brokerage, Crypto Exchange, Bank, Cash)
            </p>
          </div>

          <button
            onClick={openCreateModal}
            className="btn btn-primary text-xs sm:text-sm py-2 px-4 flex items-center gap-2 shadow-[0_0_20px_rgba(34,211,238,0.2)]"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>สร้างบัญชีใหม่</span>
          </button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="card p-4">
            <p className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
              บัญชีทั้งหมด
            </p>
            <p className="text-xl sm:text-2xl font-bold text-white mt-1 tabular-nums">
              {accounts.length} บัญชี
            </p>
          </div>
          <div className="card p-4">
            <p className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-blue-400" />
              <span>โบรกเกอร์หุ้น</span>
            </p>
            <p className="text-xl sm:text-2xl font-bold text-white mt-1 tabular-nums">
              {brokerageCount} บัญชี
            </p>
          </div>
          <div className="card p-4">
            <p className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1">
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              <span>Crypto Exchange</span>
            </p>
            <p className="text-xl sm:text-2xl font-bold text-white mt-1 tabular-nums">
              {cryptoCount} บัญชี
            </p>
          </div>
          <div className="card p-4">
            <p className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1">
              <Landmark className="w-3.5 h-3.5 text-[var(--green-400)]" />
              <span>ธนาคาร & เงินสด</span>
            </p>
            <p className="text-xl sm:text-2xl font-bold text-white mt-1 tabular-nums">
              {bankCount} บัญชี
            </p>
          </div>
        </div>

        {/* Accounts Grid */}
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-[var(--text-muted)]">
            <Loader2 className="w-7 h-7 animate-spin text-[var(--cyan-400)]" />
            <span className="text-xs">กำลังโหลดบัญชีการเงิน...</span>
          </div>
        ) : error ? (
          <div className="card p-8 text-center text-red-400 text-xs">
            เกิดข้อผิดพลาดในการโหลดข้อมูลบัญชี
          </div>
        ) : accounts.length === 0 ? (
          <div className="card p-12 text-center flex flex-col items-center justify-center">
            <div className="w-14 h-14 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] mb-4">
              <Wallet className="w-7 h-7 text-[var(--cyan-400)]" />
            </div>
            <h3 className="font-bold text-white text-base">ยังไม่มีบัญชีการลงทุน</h3>
            <p className="text-xs text-[var(--text-secondary)] mt-1.5 max-w-sm">
              เริ่มต้นด้วยการสร้างบัญชีเพื่อบันทึกรายการซื้อขาย เช่น Dime, InnovestX, หรือ Bitkub
            </p>
            <button
              onClick={openCreateModal}
              className="btn btn-primary text-xs mt-5 py-2.5 px-4 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>สร้างบัญชีแรกของคุณ</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {accounts.map((acc: any) => {
              const typeObj = ACCOUNT_TYPES.find((t) => t.value === acc.accountType) ?? ACCOUNT_TYPES[0]
              const Icon = typeObj.icon
              const txnCount = acc._count?.transactions ?? 0

              return (
                <div
                  key={acc.id}
                  className="card p-5 hover:border-cyan-500/30 transition-all group flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center text-[var(--cyan-400)] group-hover:scale-105 transition-transform">
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-bold text-white text-base group-hover:text-[var(--cyan-400)] transition-colors">
                            {acc.accountName}
                          </h3>
                          <span className="text-[11px] text-[var(--text-muted)] uppercase tracking-wider">
                            {typeObj.label.split(' ')[0]}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                        <button
                          onClick={() => openEditModal(acc)}
                          className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-white hover:bg-[var(--bg-elevated)]"
                          title="แก้ไขบัญชี"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteAccount(acc)}
                          disabled={deletingId === acc.id}
                          className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10"
                          title="ลบบัญชี"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-5 pt-4 border-t border-[var(--border)] flex items-center justify-between text-xs">
                      <div>
                        <span className="text-[var(--text-muted)]">สกุลเงินหลัก: </span>
                        <span className="font-semibold text-white px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] border border-[var(--border)]">
                          {acc.currency}
                        </span>
                      </div>
                      <div>
                        <span className="text-[var(--text-muted)]">ธุรกรรม: </span>
                        <span className="font-bold text-white tabular-nums">
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

      {/* Account Modal (Create / Edit) */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
              <h3 className="font-bold text-white text-base">
                {editingAccount ? 'แก้ไขบัญชีการเงิน' : 'สร้างบัญชีการเงินใหม่'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAccount} className="p-5 space-y-4">
              {formError && (
                <div className="alert alert-danger text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
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
                        className={`p-3 rounded-xl border cursor-pointer flex items-center justify-between transition-all ${
                          isSelected
                            ? 'bg-cyan-500/10 border-cyan-500/40 text-white'
                            : 'bg-[var(--bg-elevated)]/40 border-[var(--border)] text-[var(--text-secondary)] hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className={`w-4 h-4 ${isSelected ? 'text-[var(--cyan-400)]' : 'text-[var(--text-muted)]'}`} />
                          <div>
                            <p className="text-xs font-semibold text-white">{type.label}</p>
                            <p className="text-[10px] text-[var(--text-muted)]">{type.desc}</p>
                          </div>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-[var(--cyan-400)]" />}
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
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="btn btn-ghost text-xs py-2 px-3.5"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary text-xs py-2 px-5 flex items-center gap-2"
                >
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
