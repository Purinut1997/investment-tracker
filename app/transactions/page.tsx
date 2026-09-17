'use client'

import React, { useState } from 'react'
import useSWR, { mutate } from 'swr'
import { AppShell } from '@/components/AppShell'
import { QuickAddModal } from '@/components/QuickAddModal'
import {
  ArrowLeftRight,
  Plus,
  Upload,
  Search,
  Filter,
  Trash2,
  Edit2,
  Calendar,
  Wallet,
  Layers,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ArrowDownLeft,
  ArrowUpRight,
  Sparkles,
  FileSpreadsheet,
  X
} from 'lucide-react'
import Papa from 'papaparse'

const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  BUY: { label: 'ซื้อ (BUY)', color: 'text-[var(--green-400)]', bg: 'bg-green-500/10 border-green-500/20' },
  SELL: { label: 'ขาย (SELL)', color: 'text-[var(--red-400)]', bg: 'bg-red-500/10 border-red-500/20' },
  DIVIDEND: { label: 'ปันผล (DIVIDEND)', color: 'text-amber-400', bg: 'bg-amber-500/15 border-amber-500/30' },
  DEPOSIT: { label: 'ฝากเงิน (DEPOSIT)', color: 'text-cyan-400', bg: 'bg-cyan-500/15 border-cyan-500/30' },
  WITHDRAW: { label: 'ถอนเงิน (WITHDRAW)', color: 'text-purple-400', bg: 'bg-purple-500/15 border-purple-500/30' },
  FEE: { label: 'ค่าธรรมเนียม (FEE)', color: 'text-slate-400', bg: 'bg-slate-500/15 border-slate-500/30' },
}

export default function TransactionsPage() {
  const [page, setPage] = useState(1)
  const [limit] = useState(25)
  const [search, setSearch] = useState('')
  const [selectedAccount, setSelectedAccount] = useState('')
  const [selectedType, setSelectedType] = useState('')
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [csvModalOpen, setCsvModalOpen] = useState(false)
  const [editingTxn, setEditingTxn] = useState<any | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Fetch accounts for filter
  const { data: accountsData } = useSWR('/api/accounts')
  const accounts = accountsData?.accounts ?? []

  // Fetch transactions query
  const queryParams = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    ...(selectedAccount && { accountId: selectedAccount }),
    ...(selectedType && { txnType: selectedType }),
  })

  const { data: txnData, isLoading, error } = useSWR(`/api/transactions?${queryParams.toString()}`)
  const transactions = txnData?.transactions ?? []
  const pagination = txnData?.pagination ?? { page: 1, totalPages: 1, total: 0 }

  // Filter client-side by search ticker / note
  const filteredTransactions = transactions.filter((t: any) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    const ticker = t.asset?.ticker?.toLowerCase() ?? ''
    const assetName = t.asset?.assetName?.toLowerCase() ?? ''
    const note = t.note?.toLowerCase() ?? ''
    return ticker.includes(q) || assetName.includes(q) || note.includes(q)
  })

  // Quick summary stats
  const totalInflow = filteredTransactions
    .filter((t: any) => t.txnType === 'SELL' || t.txnType === 'DIVIDEND')
    .reduce((sum: number, t: any) => sum + Number(t.totalAmount || 0), 0)

  const totalOutflow = filteredTransactions
    .filter((t: any) => t.txnType === 'BUY')
    .reduce((sum: number, t: any) => sum + Number(t.totalAmount || 0), 0)

  const totalFees = filteredTransactions
    .reduce((sum: number, t: any) => sum + Number(t.fee || 0), 0)

  // Handle Delete
  async function handleDelete(id: string) {
    if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการลบรายการนี้?')) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/transactions/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      mutate(`/api/transactions?${queryParams.toString()}`)
    } catch (err: any) {
      alert(err.message || 'ลบรายการไม่สำเร็จ')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <AppShell>
      <div className="space-y-6">
        {/* ── Page Header ─────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 shadow-[0_0_20px_rgba(34,211,238,0.25)]">
                <ArrowLeftRight className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">รายการธุรกรรม</h1>
            </div>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] pl-11">
              บันทึก ตรวจสอบ และจัดการประวัติการซื้อ-ขายและปันผลทั้งหมด
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setCsvModalOpen(true)}
              className="btn btn-secondary text-xs sm:text-sm py-2 px-3.5 flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              <span>นำเข้า CSV</span>
            </button>
            <button
              onClick={() => setQuickAddOpen(true)}
              className="btn btn-primary text-xs sm:text-sm py-2.5 px-5 flex items-center gap-2 shadow-[0_0_20px_rgba(34,211,238,0.2)]"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>เพิ่มธุรกรรม</span>
            </button>
          </div>
        </div>

        {/* ── Summary Metric Cards ─────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: 'รายการทั้งหมด',
              value: `${pagination.total}`,
              unit: 'รายการ',
              icon: ArrowLeftRight,
              color: 'text-[var(--cyan-400)]',
              iconBg: 'bg-cyan-500/10 border-cyan-500/20',
            },
            {
              label: 'ลงทุนรวม (ซื้อ)',
              value: `฿${totalOutflow.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              unit: '',
              icon: ArrowDownLeft,
              color: 'text-emerald-400',
              iconBg: 'bg-emerald-500/10 border-emerald-500/20',
            },
            {
              label: 'กระแสกลับ (ขาย/ปันผล)',
              value: `฿${totalInflow.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              unit: '',
              icon: ArrowUpRight,
              color: 'text-amber-400',
              iconBg: 'bg-amber-500/10 border-amber-500/20',
            },
            {
              label: 'ค่าธรรมเนียมรวม',
              value: `฿${totalFees.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              unit: '',
              icon: Wallet,
              color: 'text-[var(--text-muted)]',
              iconBg: 'bg-white/[0.05] border-white/[0.08]',
            },
          ].map((stat) => {
            const Icon = stat.icon
            return (
              <div key={stat.label} className="p-5 rounded-2xl bg-white/[0.04] backdrop-blur-2xl border border-white/[0.08] shadow-[0_4px_24px_rgba(0,0,0,0.3)] flex items-start gap-3.5 hover:border-white/15 transition-all">
                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${stat.iconBg} ${stat.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider truncate">{stat.label}</p>
                  <p className="text-xl sm:text-2xl font-black text-white mt-0.5 tabular-nums truncate">
                    {stat.value} <span className="text-[var(--text-muted)] text-xs font-normal">{stat.unit}</span>
                  </p>
                </div>
              </div>
            )
          })}
        </div>

        {/* ── Filters Toolbar ──────────────────────────────── */}
        <div className="p-4 rounded-2xl bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] shadow-sm">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                className="input pl-10 text-xs sm:text-sm rounded-xl bg-white/[0.04] border-white/[0.08] focus:border-violet-500/50"
                placeholder="ค้นหา Ticker, ชื่อสินทรัพย์, หรือบันทึก..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="w-full sm:w-52">
              <select
                className="select text-xs sm:text-sm rounded-xl bg-white/[0.04] border-white/[0.08]"
                value={selectedAccount}
                onChange={(e) => { setSelectedAccount(e.target.value); setPage(1) }}
              >
                <option value="">ทุกบัญชีการเงิน</option>
                {accounts.map((acc: any) => (
                  <option key={acc.id} value={acc.id}>{acc.accountName} ({acc.currency})</option>
                ))}
              </select>
            </div>
            <div className="w-full sm:w-48">
              <select
                className="select text-xs sm:text-sm rounded-xl bg-white/[0.04] border-white/[0.08]"
                value={selectedType}
                onChange={(e) => { setSelectedType(e.target.value); setPage(1) }}
              >
                <option value="">ทุกประเภทรายการ</option>
                <option value="BUY">🟢 ซื้อ (BUY)</option>
                <option value="SELL">🔴 ขาย (SELL)</option>
                <option value="DIVIDEND">💰 ปันผล (DIVIDEND)</option>
                <option value="DEPOSIT">📥 ฝากเงิน</option>
                <option value="WITHDRAW">📤 ถอนเงิน</option>
                <option value="FEE">🧾 ค่าธรรมเนียม</option>
              </select>
            </div>
          </div>
        </div>

        {/* Transactions Table / List */}
        <div className="rounded-3xl bg-white/[0.04] backdrop-blur-2xl border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.36)] overflow-hidden">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-[var(--text-muted)]">
              <Loader2 className="w-7 h-7 animate-spin text-[var(--cyan-400)]" />
              <span className="text-xs">กำลังโหลดข้อมูลธุรกรรม...</span>
            </div>
          ) : error ? (
            <div className="py-16 text-center text-red-400 text-xs">
              เกิดข้อผิดพลาดในการโหลดข้อมูลธุรกรรม
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-center px-4">
              <div className="w-12 h-12 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] mb-3">
                <ArrowLeftRight className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-white text-base">ไม่พบรายการธุรกรรม</h3>
              <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-sm">
                คุณยังไม่มีรายการธุรกรรม หรือไม่มีรายการที่ตรงกับตัวกรองที่เลือก
              </p>
              <button
                onClick={() => setQuickAddOpen(true)}
                className="btn btn-primary text-xs mt-4 py-2 px-4 flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>เพิ่มธุรกรรมแรก</span>
              </button>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[var(--bg-elevated)]/80 text-[var(--text-muted)] uppercase tracking-widest text-[10px] border-b border-[var(--border)]">
                    <tr>
                      <th className="py-3.5 px-4 font-semibold">วันที่</th>
                      <th className="py-3.5 px-4 font-semibold">ประเภท</th>
                      <th className="py-3.5 px-4 font-semibold">สินทรัพย์ / Ticker</th>
                      <th className="py-3.5 px-4 text-right font-semibold">จำนวน</th>
                      <th className="py-3.5 px-4 text-right font-semibold">ราคา/หน่วย</th>
                      <th className="py-3.5 px-4 text-right font-semibold">Fee</th>
                      <th className="py-3.5 px-4 text-right font-semibold">ยอดรวม</th>
                      <th className="py-3.5 px-4 font-semibold">บัญชี</th>
                      <th className="py-3.5 px-4 text-right font-semibold">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {filteredTransactions.map((txn: any) => {
                      const cfg = TYPE_CONFIG[txn.txnType] ?? { label: txn.txnType, color: 'text-slate-300', bg: 'bg-slate-500/20' }
                      const formattedDate = new Date(txn.txnDate).toLocaleDateString('th-TH', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })

                      return (
                        <tr key={txn.id} className="hover:bg-[var(--bg-elevated)]/50 transition-colors group">
                          <td className="py-3.5 px-4 text-[var(--text-secondary)] font-medium whitespace-nowrap">
                            {formattedDate}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${cfg.bg} ${cfg.color}`}>
                              {cfg.label}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-white tracking-wide">
                                {txn.asset?.ticker}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-[var(--border)] uppercase">
                                {txn.asset?.market}
                              </span>
                            </div>
                            {txn.note && (
                              <p className="text-[11px] text-[var(--text-muted)] truncate max-w-[200px]">
                                {txn.note}
                              </p>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right font-medium text-white tabular-nums">
                            {Number(txn.quantity).toLocaleString()}
                          </td>
                          <td className="py-3.5 px-4 text-right text-[var(--text-secondary)] tabular-nums">
                            {Number(txn.pricePerUnit).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3.5 px-4 text-right text-[var(--text-muted)] tabular-nums">
                            {Number(txn.fee || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3.5 px-4 text-right font-bold text-white tabular-nums">
                            {Number(txn.totalAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3.5 px-4 text-[var(--text-secondary)] whitespace-nowrap">
                            <span className="flex items-center gap-1 text-[11px]">
                              <Wallet className="w-3 h-3 text-[var(--text-muted)]" />
                              <span>{txn.account?.accountName}</span>
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => setEditingTxn(txn)}
                                className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--cyan-400)] hover:bg-cyan-500/10 transition-colors"
                                title="แก้ไขรายการ"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(txn.id)}
                                disabled={deletingId === txn.id}
                                className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                title="ลบรายการ"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List View */}
              <div className="md:hidden divide-y divide-[var(--border)]">
                {filteredTransactions.map((txn: any) => {
                  const cfg = TYPE_CONFIG[txn.txnType] ?? { label: txn.txnType, color: 'text-slate-300', bg: 'bg-slate-500/20' }
                  const formattedDate = new Date(txn.txnDate).toLocaleDateString('th-TH', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })

                  return (
                    <div key={txn.id} className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${cfg.bg} ${cfg.color}`}>
                            {cfg.label}
                          </span>
                          <span className="text-xs text-[var(--text-muted)]">{formattedDate}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setEditingTxn(txn)}
                            className="p-1 text-[var(--text-muted)] hover:text-white"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(txn.id)}
                            className="p-1 text-[var(--text-muted)] hover:text-red-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-baseline justify-between">
                        <div>
                          <span className="font-bold text-white text-base mr-1.5">
                            {txn.asset?.ticker}
                          </span>
                          <span className="text-[10px] text-[var(--text-muted)]">
                            {txn.account?.accountName}
                          </span>
                        </div>
                        <span className="text-base font-bold text-white tabular-nums">
                          ฿{Number(txn.totalAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                        <span>
                          {Number(txn.quantity).toLocaleString()} หน่วย @ ฿{Number(txn.pricePerUnit).toLocaleString()}
                        </span>
                        {Number(txn.fee) > 0 && (
                          <span className="text-[11px] text-[var(--text-muted)]">
                            ค่าคอม ฿{Number(txn.fee).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Pagination Controls */}
              {pagination.totalPages > 1 && (
                <div className="p-4 border-t border-[var(--border)] flex items-center justify-between bg-[var(--bg-elevated)]/20 text-xs">
                  <span className="text-[var(--text-muted)]">
                    หน้า {pagination.page} จากทั้งหมด {pagination.totalPages}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={pagination.page <= 1}
                      className="p-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-secondary)] disabled:opacity-40"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                      disabled={pagination.page >= pagination.totalPages}
                      className="p-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-secondary)] disabled:opacity-40"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Quick Add Modal */}
      {quickAddOpen && (
        <QuickAddModal
          onClose={() => setQuickAddOpen(false)}
          onSuccess={() => mutate(`/api/transactions?${queryParams.toString()}`)}
        />
      )}

      {/* Edit Transaction Modal */}
      {editingTxn && (
        <EditTransactionModal
          txn={editingTxn}
          onClose={() => setEditingTxn(null)}
          onSuccess={() => {
            setEditingTxn(null)
            mutate(`/api/transactions?${queryParams.toString()}`)
          }}
        />
      )}

      {/* CSV Import Modal */}
      {csvModalOpen && (
        <CsvImportModal
          accounts={accounts}
          onClose={() => setCsvModalOpen(false)}
          onSuccess={() => {
            setCsvModalOpen(false)
            mutate(`/api/transactions?${queryParams.toString()}`)
          }}
        />
      )}
    </AppShell>
  )
}

// ─── EDIT TRANSACTION MODAL ──────────────────────────────────────
function EditTransactionModal({ txn, onClose, onSuccess }: { txn: any; onClose: () => void; onSuccess: () => void }) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    txnDate: new Date(txn.txnDate).toISOString().split('T')[0],
    txnType: txn.txnType,
    quantity: txn.quantity.toString(),
    pricePerUnit: txn.pricePerUnit.toString(),
    fee: (txn.fee ?? 0).toString(),
    taxWithheld: (txn.taxWithheld ?? 0).toString(),
    note: txn.note ?? '',
  })

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    try {
      const res = await fetch(`/api/transactions/${txn.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          txnDate: new Date(form.txnDate).toISOString(),
          txnType: form.txnType,
          quantity: parseFloat(form.quantity),
          pricePerUnit: parseFloat(form.pricePerUnit),
          fee: parseFloat(form.fee) || 0,
          taxWithheld: parseFloat(form.taxWithheld) || 0,
          note: form.note || undefined,
        }),
      })

      if (!res.ok) {
        const errJson = await res.json()
        throw new Error(errJson.error || 'แก้ไขรายการไม่สำเร็จ')
      }

      onSuccess()
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาด')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
          <h3 className="font-bold text-white text-base">แก้ไขรายการ ({txn.asset?.ticker})</h3>
          <button onClick={onClose} className="p-1 rounded-lg text-[var(--text-muted)] hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleUpdate} className="p-5 space-y-4">
          {error && (
            <div className="alert alert-danger text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300">
            ℹ️ ค่าเดิมจะถูกบันทึกประวัติไว้ใน TransactionEditHistory ก่อนแก้ไขเสมอ
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">ประเภท</label>
              <select
                className="select text-xs"
                value={form.txnType}
                onChange={(e) => setForm({ ...form, txnType: e.target.value })}
              >
                <option value="BUY">ซื้อ (BUY)</option>
                <option value="SELL">ขาย (SELL)</option>
                <option value="DIVIDEND">ปันผล (DIVIDEND)</option>
                <option value="DEPOSIT">ฝากเงิน</option>
                <option value="WITHDRAW">ถอนเงิน</option>
                <option value="FEE">ค่าธรรมเนียม</option>
              </select>
            </div>
            <div>
              <label className="label">วันที่</label>
              <input
                type="date"
                className="input text-xs"
                value={form.txnDate}
                onChange={(e) => setForm({ ...form, txnDate: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">จำนวนหน่วย</label>
              <input
                type="number"
                step="any"
                className="input text-xs"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label">ราคาต่อหน่วย</label>
              <input
                type="number"
                step="any"
                className="input text-xs"
                value={form.pricePerUnit}
                onChange={(e) => setForm({ ...form, pricePerUnit: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">ค่าธรรมเนียม</label>
              <input
                type="number"
                step="any"
                className="input text-xs"
                value={form.fee}
                onChange={(e) => setForm({ ...form, fee: e.target.value })}
              />
            </div>
            <div>
              <label className="label">ภาษีหัก ณ ที่จ่าย</label>
              <input
                type="number"
                step="any"
                className="input text-xs"
                value={form.taxWithheld}
                onChange={(e) => setForm({ ...form, taxWithheld: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="label">บันทึกเพิ่มเติม</label>
            <input
              type="text"
              className="input text-xs"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn btn-ghost text-xs py-2 px-3">
              ยกเลิก
            </button>
            <button type="submit" disabled={submitting} className="btn btn-primary text-xs py-2 px-4">
              {submitting ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── CSV IMPORT MODAL ─────────────────────────────────────────────
function CsvImportModal({ accounts, onClose, onSuccess }: { accounts: any[]; onClose: () => void; onSuccess: () => void }) {
  const [selectedAccountId, setSelectedAccountId] = useState(accounts[0]?.id ?? '')
  const [rows, setRows] = useState<any[]>([])
  const [fileName, setFileName] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null)
  const [error, setError] = useState('')

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setError('')
    setResult(null)

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (!results.data || results.data.length === 0) {
          setError('ไม่พบข้อมูลในไฟล์ CSV')
          return
        }

        // Normalize rows to expected CsvRow schema
        const parsedRows = (results.data as any[]).map((r) => ({
          txnDate: r.txnDate || r.Date || r.date || new Date().toISOString(),
          txnType: (r.txnType || r.Type || r.type || 'BUY').toUpperCase(),
          ticker: (r.ticker || r.Ticker || r.Symbol || r.symbol || '').toUpperCase(),
          market: r.market || r.Market || 'US',
          quantity: (r.quantity || r.Quantity || r.Shares || r.shares || '0').toString(),
          pricePerUnit: (r.pricePerUnit || r.Price || r.price || '0').toString(),
          fee: (r.fee || r.Fee || '0').toString(),
          note: r.note || r.Note || '',
        }))

        setRows(parsedRows)
      },
      error: (err) => {
        setError(`การอ่านไฟล์ล้มเหลว: ${err.message}`)
      },
    })
  }

  async function handleImport() {
    if (!selectedAccountId) {
      setError('กรุณาเลือกบัญชีที่ต้องการนำเข้าข้อมูล')
      return
    }
    if (rows.length === 0) {
      setError('กรุณาอัปโหลดไฟล์ CSV ที่มีข้อมูลก่อน')
      return
    }

    setImporting(true)
    setError('')

    try {
      const res = await fetch('/api/transactions/import-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: selectedAccountId,
          rows,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'นำเข้าข้อมูลไม่สำเร็จ')

      setResult(data)
      if (data.imported > 0) {
        setTimeout(() => onSuccess(), 1500)
      }
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาดในการนำเข้า')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-[var(--cyan-400)]" />
            <h3 className="font-bold text-white text-base">นำเข้าข้อมูลจาก CSV</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-[var(--text-muted)] hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="alert alert-danger text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {result && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-green-500/20 text-xs text-emerald-300 space-y-1">
              <p className="font-bold flex items-center gap-1.5 text-[var(--green-400)]">
                <CheckCircle2 className="w-4 h-4" />
                นำเข้าข้อมูลเสร็จสิ้น
              </p>
              <p>• สำเร็จ: {result.imported} รายการ</p>
              <p>• ข้าม (รายการซ้ำ): {result.skipped} รายการ</p>
              {result.errors.length > 0 && (
                <p className="text-amber-400">• ข้อผิดพลาด: {result.errors.length} รายการ</p>
              )}
            </div>
          )}

          <div>
            <label className="label">เลือกบัญชีที่ต้องการบันทึก *</label>
            <select
              className="select text-xs sm:text-sm"
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
            >
              {accounts.map((acc: any) => (
                <option key={acc.id} value={acc.id}>
                  {acc.accountName} ({acc.accountType} — {acc.currency})
                </option>
              ))}
            </select>
          </div>

          <div className="border-2 border-dashed border-[var(--border)] hover:border-cyan-500/50 rounded-2xl p-6 text-center cursor-pointer transition-colors bg-[var(--bg-elevated)]/30">
            <input
              type="file"
              accept=".csv"
              id="csv-file"
              onChange={handleFileChange}
              className="hidden"
            />
            <label htmlFor="csv-file" className="cursor-pointer space-y-2 block">
              <Upload className="w-8 h-8 text-[var(--cyan-400)] mx-auto" />
              <p className="text-xs sm:text-sm font-semibold text-white">
                {fileName ? fileName : 'คลิกเพื่อเลือกไฟล์ CSV หรือลากไฟล์มาวางที่นี่'}
              </p>
              <p className="text-[11px] text-[var(--text-muted)]">
                รองรับหัวตาราง: Date, Ticker, Type, Quantity, Price, Fee
              </p>
            </label>
          </div>

          {/* Preview Rows */}
          {rows.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white">
                  ตัวอย่างข้อมูล ({rows.length} รายการ)
                </span>
                <span className="text-[11px] text-cyan-400">ระบบตรวจสอบรายการซ้ำอัตโนมัติ</span>
              </div>
              <div className="border border-[var(--border)] rounded-xl overflow-hidden max-h-40 overflow-y-auto">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-[var(--bg-elevated)] text-[var(--text-muted)] sticky top-0">
                    <tr>
                      <th className="p-2">วันที่</th>
                      <th className="p-2">Ticker</th>
                      <th className="p-2">ประเภท</th>
                      <th className="p-2 text-right">จำนวน</th>
                      <th className="p-2 text-right">ราคา</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {rows.slice(0, 5).map((r, i) => (
                      <tr key={i}>
                        <td className="p-2 text-[var(--text-secondary)]">{r.txnDate.slice(0, 10)}</td>
                        <td className="p-2 font-bold text-white">{r.ticker}</td>
                        <td className="p-2 text-[var(--green-400)]">{r.txnType}</td>
                        <td className="p-2 text-right">{r.quantity}</td>
                        <td className="p-2 text-right">{r.pricePerUnit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-[var(--border)] flex justify-end gap-2 bg-[var(--bg-elevated)]/30">
          <button type="button" onClick={onClose} className="btn btn-ghost text-xs py-2 px-3">
            ปิด
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={importing || rows.length === 0}
            className="btn btn-primary text-xs py-2 px-4 flex items-center gap-1.5"
          >
            {importing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>กำลังนำเข้า...</span>
              </>
            ) : (
              <span>ยืนยันนำเข้า {rows.length} รายการ</span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
