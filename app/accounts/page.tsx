'use client'

import React, { useState, useEffect } from 'react'
import useSWR, { mutate } from 'swr'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/PageHeader'
import {
  Wallet,
  Plus,
  Building2,
  Coins,
  Landmark,
  Edit2,
  Trash2,
  AlertCircle,
  Loader2,
  X,
  Layers,
  ArrowRight,
} from 'lucide-react'
import {
  ACCOUNT_TYPES,
  getErrorMessage,
  parseAccountsPayload,
  type AccountTypeValue,
  type InvestmentAccountRecord,
} from '@/lib/accounts'

export default function AccountsPage() {
  const { data, isLoading, error } = useSWR('/api/accounts')
  const accounts = parseAccountsPayload(data)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<InvestmentAccountRecord | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [formData, setFormData] = useState({
    accountName: '',
    accountType: 'brokerage' as AccountTypeValue,
    currency: 'THB',
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
    setEditingAccount(null)
    setFormData({ accountName: '', accountType: 'brokerage', currency: 'THB' })
    setFormError('')
    setModalOpen(true)
  }

  function openEditModal(acc: InvestmentAccountRecord) {
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
    if (!formData.accountName.trim()) { setFormError('กรุณาระบุชื่อบัญชี'); return }
    setSubmitting(true); setFormError('')
    try {
      const url = editingAccount ? `/api/accounts/${editingAccount.id}` : '/api/accounts'
      const method = editingAccount ? 'PUT' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) })
      const resJson = await res.json() as { error?: string }
      if (!res.ok) throw new Error(resJson.error || 'บันทึกบัญชีไม่สำเร็จ')
      mutate('/api/accounts')
      setModalOpen(false)
    } catch (err: unknown) {
      setFormError(getErrorMessage(err, 'เกิดข้อผิดพลาด'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeleteAccount(acc: InvestmentAccountRecord) {
    if (acc._count?.transactions && acc._count.transactions > 0) {
      alert(`ไม่สามารถลบบัญชี "${acc.accountName}" ได้ เนื่องจากมีประวัติธุรกรรมค้างอยู่ ${acc._count.transactions} รายการ`)
      return
    }

    if (!confirm(`คุณแน่ใจว่าต้องการลบบัญชี "${acc.accountName}" หรือไม่?`)) return
    setDeletingId(acc.id)
    try {
      const res = await fetch(`/api/accounts/${acc.id}`, { method: 'DELETE' })
      const resJson = await res.json() as { error?: string }
      if (!res.ok) throw new Error(resJson.error || 'ลบบัญชีไม่สำเร็จ')
      mutate('/api/accounts')
    } catch (err: unknown) {
      alert(getErrorMessage(err, 'ลบบัญชีไม่สำเร็จ'))
    } finally {
      setDeletingId(null)
    }
  }

  const brokerageCount = accounts.filter((a) => a.accountType === 'brokerage').length
  const cryptoCount = accounts.filter((a) => a.accountType === 'crypto_exchange').length
  const bankCount = accounts.filter((a) => a.accountType === 'bank' || a.accountType === 'cash').length

  const inputClass = "w-full bg-[#181C25] border border-white/[0.1] rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
  const labelClass = "block text-xs font-semibold text-slate-300 mb-1.5"

  return (
    <AppShell>
      <div className="space-y-6 max-w-[1600px] mx-auto w-full animate-fade-in">
        {/* Header */}
        <PageHeader
          eyebrow="Portfolio Accounts"
          title="บัญชีการลงทุน"
          description="จัดการพอร์ตและบัญชีลงทุนต่างๆ ของคุณในที่เดียว แยกตามโบรกเกอร์ คริปโต และกระแสเงินสด"
          action={
            <button
              onClick={openCreateModal}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl font-semibold text-xs flex items-center gap-2 transition-all shadow-lg shadow-indigo-600/25 active:scale-[0.98] cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>สร้างบัญชีใหม่</span>
            </button>
          }
        />

        {/* Stats Grid */}
        {!isLoading && !error && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'บัญชีทั้งหมด', value: `${accounts.length}`, icon: Layers, color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/20' },
              { label: 'โบรกเกอร์หุ้น', value: `${brokerageCount}`, icon: Building2, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
              { label: 'กระเป๋าคริปโต', value: `${cryptoCount}`, icon: Coins, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
              { label: 'ธนาคารและเงินสด', value: `${bankCount}`, icon: Landmark, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
            ].map((stat) => {
              const Icon = stat.icon
              return (
                <div
                  key={stat.label}
                  className="p-5 rounded-2xl bg-[#12151C] border border-white/[0.08] flex flex-col justify-between min-h-[110px] shadow-xl shadow-black/30"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-400">{stat.label}</span>
                    <div className={`p-2 rounded-xl border ${stat.bg} ${stat.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                  </div>
                  <p className="text-3xl font-bold text-white tabular-nums font-mono tracking-tight leading-none mt-2">
                    {stat.value}
                  </p>
                </div>
              )
            })}
          </div>
        )}

        {/* Content Section */}
        {isLoading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            <span className="text-xs font-medium">กำลังโหลดข้อมูลบัญชี...</span>
          </div>
        ) : error ? (
          <div className="p-8 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-center text-rose-300 text-xs">
            เกิดข้อผิดพลาดในการโหลดข้อมูลบัญชี กรุณาลองใหม่อีกครั้ง
          </div>
        ) : accounts.length === 0 ? (
          <div className="p-16 rounded-2xl bg-[#12151C] border border-white/[0.08] text-center flex flex-col items-center justify-center min-h-[380px] shadow-xl shadow-black/40">
            <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-5">
              <Wallet className="w-8 h-8" />
            </div>
            <h3 className="font-bold text-white text-lg mb-2">ยังไม่มีบัญชีการลงทุน</h3>
            <p className="text-xs text-slate-400 max-w-sm mb-6 leading-relaxed">
              สร้างบัญชีแรก เช่น บัญชีโบรกเกอร์ หรือกระเป๋าคริปโต เพื่อเริ่มบันทึกธุรกรรมและติดตามพอร์ตของคุณ
            </p>
            <button
              onClick={openCreateModal}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold py-2.5 px-5 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-indigo-600/25 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>สร้างบัญชีลงทุนแรก</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {accounts.map((acc) => {
              const typeObj = ACCOUNT_TYPES.find((t) => t.value === acc.accountType) ?? ACCOUNT_TYPES[0]
              const Icon = typeObj.icon
              const txnCount = acc._count?.transactions ?? 0

              return (
                <div
                  key={acc.id}
                  className="p-5 rounded-2xl bg-[#12151C] border border-white/[0.08] hover:border-white/[0.16] hover:bg-[#151922] transition-all duration-200 group flex flex-col justify-between min-h-[160px] shadow-xl shadow-black/30"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-center text-indigo-400 shrink-0">
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-white text-sm truncate tracking-tight">
                          {acc.accountName}
                        </h3>
                        <span className="text-[11px] text-slate-400">
                          {typeObj.label}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        onClick={() => openEditModal(acc)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                        title="แก้ไขบัญชี"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteAccount(acc)}
                        disabled={deletingId === acc.id}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        title="ลบบัญชี"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between">
                    <span className="text-[10px] font-mono font-semibold text-slate-300 px-2 py-0.5 rounded-md bg-slate-800/80 border border-slate-700/80 uppercase">
                      {acc.currency}
                    </span>
                    <span className="text-xs font-mono text-slate-400 tabular-nums">
                      {txnCount} รายการธุรกรรม
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in"
          onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false) }}
        >
          <div className="bg-[#12151C] border border-white/[0.1] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl shadow-black/80 flex flex-col">
            <div className="px-6 py-4.5 border-b border-white/[0.08] flex items-center justify-between bg-[#181C25]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <Wallet className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-white text-base tracking-tight">
                  {editingAccount ? 'แก้ไขบัญชีลงทุน' : 'สร้างบัญชีลงทุนใหม่'}
                </h3>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAccount} className="p-6 space-y-4.5">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className={labelClass}>ชื่อบัญชี *</label>
                <input
                  type="text"
                  className={inputClass}
                  placeholder="เช่น Dime, InnovestX, Bitkub, พอร์ตหลัก"
                  value={formData.accountName}
                  onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className={labelClass}>ประเภทบัญชี</label>
                <select
                  className={inputClass}
                  value={formData.accountType}
                  onChange={(e) => setFormData({ ...formData, accountType: e.target.value as AccountTypeValue })}
                >
                  {ACCOUNT_TYPES.map((type) => (
                    <option key={type.value} value={type.value} className="bg-[#12151C] text-white">
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>สกุลเงินหลักของบัญชี</label>
                <select
                  className={inputClass}
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                >
                  <option value="THB" className="bg-[#12151C] text-white">บาทไทย (THB)</option>
                  <option value="USD" className="bg-[#12151C] text-white">ดอลลาร์สหรัฐ (USD)</option>
                  <option value="EUR" className="bg-[#12151C] text-white">ยูโร (EUR)</option>
                  <option value="SGD" className="bg-[#12151C] text-white">ดอลลาร์สิงคโปร์ (SGD)</option>
                  <option value="JPY" className="bg-[#12151C] text-white">เยนญี่ปุ่น (JPY)</option>
                </select>
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
                  <span>{editingAccount ? 'บันทึกการแก้ไข' : 'สร้างบัญชี'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  )
}
