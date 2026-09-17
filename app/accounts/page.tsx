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
  Banknote,
  Edit2,
  Trash2,
  AlertCircle,
  Loader2,
  Check,
  X,
  Layers,
} from 'lucide-react'

const ACCOUNT_TYPES = [
  { value: 'brokerage', label: 'Brokerage', icon: Building2, desc: 'Dime, InnovestX, IBKR', color: 'text-blue-400' },
  { value: 'crypto_exchange', label: 'Crypto', icon: Coins, desc: 'Bitkub, Binance, OKX', color: 'text-amber-400' },
  { value: 'bank', label: 'Bank', icon: Landmark, desc: 'Savings / Checking', color: 'text-emerald-400' },
  { value: 'cash', label: 'Cash', icon: Banknote, desc: 'Physical / Idle Cash', color: 'text-zinc-400' },
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
    if (!formData.accountName.trim()) { setFormError('Account name is required'); return }
    setSubmitting(true); setFormError('')
    try {
      const url = editingAccount ? `/api/accounts/${editingAccount.id}` : '/api/accounts'
      const method = editingAccount ? 'PUT' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) })
      const resJson = await res.json()
      if (!res.ok) throw new Error(resJson.error || 'Failed to save account')
      mutate('/api/accounts')
      setModalOpen(false)
    } catch (err: any) {
      setFormError(err.message || 'Error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeleteAccount(acc: any) {
    if (acc._count?.transactions > 0) {
      alert(`Cannot delete account "${acc.accountName}" because it has ${acc._count.transactions} transactions associated with it.`)
      return
    }
    if (!confirm(`Are you sure you want to delete account "${acc.accountName}"?`)) return
    setDeletingId(acc.id)
    try {
      const res = await fetch(`/api/accounts/${acc.id}`, { method: 'DELETE' })
      const resJson = await res.json()
      if (!res.ok) throw new Error(resJson.error || 'Failed to delete account')
      mutate('/api/accounts')
    } catch (err: any) {
      alert(err.message || 'Error occurred while deleting account')
    } finally {
      setDeletingId(null)
    }
  }

  const brokerageCount = accounts.filter((a) => a.accountType === 'brokerage').length
  const cryptoCount = accounts.filter((a) => a.accountType === 'crypto_exchange').length
  const bankCount = accounts.filter((a) => a.accountType === 'bank' || a.accountType === 'cash').length

  const inputClass = "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-zinc-500 transition-colors"
  const labelClass = "block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2"

  return (
    <AppShell>
      <div className="space-y-8 max-w-[1600px] mx-auto w-full">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">บัญชีการลงทุน</h1>
            <p className="text-sm text-zinc-500 mt-1">จัดการพอร์ตและบัญชีลงทุนต่างๆ ในพื้นที่เดียว</p>
          </div>
          <button onClick={openCreateModal} className="bg-white text-black hover:bg-zinc-200 px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-colors">
            <Plus className="w-4 h-4" /> สร้างบัญชีใหม่
          </button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'ALL ACCOUNTS', value: `${accounts.length}`, icon: Layers },
            { label: 'BROKERAGE', value: `${brokerageCount}`, icon: Building2 },
            { label: 'CRYPTO', value: `${cryptoCount}`, icon: Coins },
            { label: 'BANK & CASH', value: `${bankCount}`, icon: Landmark },
          ].map((stat) => {
            const Icon = stat.icon
            return (
              <div key={stat.label} className="p-5 rounded-3xl bg-[#0a0a0a] border border-white/5 flex flex-col gap-3 min-h-[110px] justify-between">
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-zinc-500" />
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{stat.label}</p>
                </div>
                <p className="text-3xl font-bold text-white tabular-nums font-mono leading-none">{stat.value}</p>
              </div>
            )
          })}
        </div>

        {/* Accounts Grid */}
        {isLoading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-4 text-zinc-500">
            <Loader2 className="w-8 h-8 animate-spin" />
            <span className="text-[10px] font-mono tracking-widest uppercase">Loading accounts...</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-400 text-xs">Error loading accounts</div>
        ) : accounts.length === 0 ? (
          <div className="p-16 rounded-3xl bg-[#0a0a0a] border border-white/5 text-center flex flex-col items-center justify-center min-h-[400px]">
            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center text-zinc-600 mb-6">
              <Wallet className="w-8 h-8" />
            </div>
            <h3 className="font-bold text-white text-lg mb-2">NO ACCOUNTS FOUND</h3>
            <p className="text-xs text-zinc-500 max-w-sm mb-6 uppercase tracking-widest font-mono">
              CREATE YOUR FIRST ACCOUNT TO START TRACKING YOUR PORTFOLIO
            </p>
            <button onClick={openCreateModal} className="bg-white text-black hover:bg-zinc-200 text-xs font-bold py-2.5 px-6 rounded-xl flex items-center gap-2 transition-colors">
              <Plus className="w-4 h-4" /> CREATE ACCOUNT
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {accounts.map((acc: any) => {
              const typeObj = ACCOUNT_TYPES.find((t) => t.value === acc.accountType) ?? ACCOUNT_TYPES[0]
              const Icon = typeObj.icon
              const txnCount = acc._count?.transactions ?? 0

              return (
                <div
                  key={acc.id}
                  className="p-6 rounded-3xl bg-[#0a0a0a] border border-white/5 hover:border-white/20 transition-all duration-300 group flex flex-col justify-between min-h-[160px]"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3.5">
                      <div className={`w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center ${typeObj.color}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-base tracking-wide truncate max-w-[120px]">
                          {acc.accountName}
                        </h3>
                        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                          {typeObj.label}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEditModal(acc)}
                        className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/10 transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteAccount(acc)}
                        disabled={deletingId === acc.id}
                        className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold text-zinc-500 px-2 py-0.5 rounded-sm bg-white/5 uppercase tracking-widest">
                      {acc.currency}
                    </span>
                    <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest">
                      {txnCount} TXNS
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in" onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false) }}>
          <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between bg-[#050505]">
              <h3 className="font-bold text-white text-base tracking-tight">
                {editingAccount ? 'EDIT ACCOUNT' : 'NEW ACCOUNT'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="p-2 rounded-full text-zinc-500 hover:text-white hover:bg-white/10 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAccount} className="p-6 space-y-5">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-2 text-xs text-rose-400">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className={labelClass}>ACCOUNT NAME</label>
                <input
                  type="text"
                  className={inputClass}
                  placeholder="e.g. Dime, InnovestX, Bitkub"
                  value={formData.accountName}
                  onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className={labelClass}>ACCOUNT TYPE</label>
                <div className="grid grid-cols-2 gap-3">
                  {ACCOUNT_TYPES.map((type) => {
                    const Icon = type.icon
                    const isSelected = formData.accountType === type.value
                    return (
                      <div
                        key={type.value}
                        onClick={() => setFormData({ ...formData, accountType: type.value })}
                        className={`p-3 rounded-xl border cursor-pointer flex flex-col justify-between min-h-[80px] transition-all ${
                          isSelected
                            ? 'bg-white/10 border-white/20 text-white'
                            : 'bg-transparent border-white/5 text-zinc-500 hover:border-white/10 hover:bg-white/5'
                        }`}
                      >
                        <Icon className={`w-5 h-5 ${isSelected ? type.color : 'text-zinc-500'}`} />
                        <p className={`text-[11px] font-bold uppercase tracking-widest mt-2 ${isSelected ? 'text-white' : 'text-zinc-500'}`}>
                          {type.label}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className={labelClass}>CURRENCY</label>
                <select
                  className={inputClass}
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                >
                  <option value="THB">THB</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="SGD">SGD</option>
                  <option value="JPY">JPY</option>
                </select>
              </div>

              <div className="pt-4 flex justify-end gap-3">
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
                    <span>{editingAccount ? 'Save Changes' : 'Create Account'}</span>
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
