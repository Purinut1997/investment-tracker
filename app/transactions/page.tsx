'use client'

import React, { useState } from 'react'
import useSWR, { mutate } from 'swr'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/PageHeader'
import { QuickAddModal } from '@/components/QuickAddModal'
import {
  ArrowLeftRight,
  Plus,
  Upload,
  Search,
  Trash2,
  Edit2,
  AlertCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  X,
  Filter,
  DollarSign,
  TrendingDown,
  Coins
} from 'lucide-react'
import Papa from 'papaparse'

const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  BUY: { label: 'BUY', color: 'text-emerald-400', bg: 'bg-emerald-500/15 border-emerald-500/30' },
  SELL: { label: 'SELL', color: 'text-rose-400', bg: 'bg-rose-500/15 border-rose-500/30' },
  DIVIDEND: { label: 'DIVIDEND', color: 'text-cyan-400', bg: 'bg-cyan-500/15 border-cyan-500/30' },
  DEPOSIT: { label: 'DEPOSIT', color: 'text-indigo-400', bg: 'bg-indigo-500/15 border-indigo-500/30' },
  WITHDRAW: { label: 'WITHDRAW', color: 'text-amber-400', bg: 'bg-amber-500/15 border-amber-500/30' },
  FEE: { label: 'FEE', color: 'text-slate-400', bg: 'bg-slate-800/80 border-slate-700/80' },
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

  const { data: accountsData } = useSWR('/api/accounts')
  const accounts = accountsData?.accounts ?? []

  const queryParams = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    ...(selectedAccount && { accountId: selectedAccount }),
    ...(selectedType && { txnType: selectedType }),
  })

  const { data: txnData, isLoading, error } = useSWR(`/api/transactions?${queryParams.toString()}`)
  const transactions = txnData?.transactions ?? []
  const pagination = txnData?.pagination ?? { page: 1, totalPages: 1, total: 0 }
  const hasAnyTransactions = pagination.total > 0

  const filteredTransactions = transactions.filter((t: any) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    const ticker = t.asset?.ticker?.toLowerCase() ?? ''
    const assetName = t.asset?.assetName?.toLowerCase() ?? ''
    const note = t.note?.toLowerCase() ?? ''
    return ticker.includes(q) || assetName.includes(q) || note.includes(q)
  })

  const totalInflow = filteredTransactions
    .filter((t: any) => t.txnType === 'SELL' || t.txnType === 'DIVIDEND')
    .reduce((sum: number, t: any) => sum + Number(t.totalAmount || 0), 0)

  const totalOutflow = filteredTransactions
    .filter((t: any) => t.txnType === 'BUY')
    .reduce((sum: number, t: any) => sum + Number(t.totalAmount || 0), 0)

  const totalFees = filteredTransactions
    .reduce((sum: number, t: any) => sum + Number(t.fee || 0), 0)

  async function handleDelete(id: string) {
    if (!confirm('ยืนยันลบรายการนี้? การลบจะมีผลต่อการคำนวณต้นทุนพอร์ต')) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/transactions/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      mutate(`/api/transactions?${queryParams.toString()}`)
      mutate('/api/portfolio/summary')
      mutate('/api/portfolio/holdings')
    } catch (err: any) {
      alert(err.message || 'ลบรายการไม่สำเร็จ')
    } finally {
      setDeletingId(null)
    }
  }

  // Common UI styles
  const inputClass = "bg-slate-900/80 border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors w-full"
  
  return (
    <AppShell>
      <div className="space-y-6 max-w-[1600px] mx-auto w-full animate-fade-in">
        
        {/* Header */}
        <PageHeader
          eyebrow="Transactions History"
          title="ประวัติรายการธุรกรรม"
          description="บันทึกและตรวจสอบประวัติการซื้อขาย เงินปันผล ค่าธรรมเนียม และกระแสเงินสดทั้งหมดในพอร์ต"
          action={
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => setCsvModalOpen(true)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-[#181C25] hover:bg-[#202532] border border-white/[0.1] transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-indigo-400" />
                <span>นำเข้า CSV</span>
              </button>
              <button
                onClick={() => setQuickAddOpen(true)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-all flex items-center gap-1.5 shadow-lg shadow-indigo-600/25 active:scale-[0.98] cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>เพิ่มธุรกรรม</span>
              </button>
            </div>
          }
        />

        {/* KPI Summary Strip */}
        {hasAnyTransactions && <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="glass-panel p-4 sm:p-5 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400">เงินลงทุนสะสม (BUY)</span>
              <p className="text-xl sm:text-2xl font-bold text-white font-mono tabular-nums mt-1">
                ฿{totalOutflow.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>

          <div className="glass-panel p-4 sm:p-5 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400">ขาย + เงินปันผลรับ</span>
              <p className="text-xl sm:text-2xl font-bold text-emerald-400 font-mono tabular-nums mt-1">
                ฿{totalInflow.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
              <Coins className="w-5 h-5" />
            </div>
          </div>

          <div className="glass-panel p-4 sm:p-5 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400">ค่าธรรมเนียมรวม (Fee)</span>
              <p className="text-xl sm:text-2xl font-bold text-slate-300 font-mono tabular-nums mt-1">
                ฿{totalFees.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-800 text-slate-400 flex items-center justify-center">
              <TrendingDown className="w-5 h-5" />
            </div>
          </div>
        </div>}

        {/* Toolbar & Filters */}
        <div className="glass-panel p-4 rounded-2xl flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              className={`${inputClass} pl-9`}
              placeholder="ค้นหา Ticker, ชื่อสินทรัพย์, โน้ต..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 shrink-0">
              <Filter className="w-3.5 h-3.5 text-indigo-400" />
              <span>ตัวกรอง:</span>
            </div>
            <select
              className={`${inputClass} sm:w-44`}
              value={selectedAccount}
              onChange={(e) => { setSelectedAccount(e.target.value); setPage(1) }}
            >
              <option value="">ทุกบัญชีการลงทุน</option>
              {accounts.map((acc: any) => (
                <option key={acc.id} value={acc.id}>{acc.accountName}</option>
              ))}
            </select>
            <select
              className={`${inputClass} sm:w-36`}
              value={selectedType}
              onChange={(e) => { setSelectedType(e.target.value); setPage(1) }}
            >
              <option value="">ทุกประเภทรายการ</option>
              <option value="BUY">BUY (ซื้อ)</option>
              <option value="SELL">SELL (ขาย)</option>
              <option value="DIVIDEND">DIVIDEND (ปันผล)</option>
              <option value="DEPOSIT">DEPOSIT (ฝาก)</option>
              <option value="WITHDRAW">WITHDRAW (ถอน)</option>
              <option value="FEE">FEE (ค่าธรรมเนียม)</option>
            </select>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="glass-panel rounded-3xl overflow-hidden min-h-[400px] flex flex-col">
          {isLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 py-24 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
              <span className="text-xs font-mono uppercase tracking-wider">กำลังโหลดรายการธุรกรรม...</span>
            </div>
          ) : error ? (
            <div className="flex-1 py-20 flex flex-col items-center justify-center gap-4 text-center text-xs text-rose-400">
              เกิดข้อผิดพลาดในการดึงข้อมูลรายการธุรกรรม
              <button onClick={() => mutate(`/api/transactions?${queryParams.toString()}`)} className="min-h-11 px-4 rounded-xl border border-rose-500/30 text-rose-300 hover:bg-rose-500/10 font-semibold">
                ลองอีกครั้ง
              </button>
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="flex-1 py-20 flex flex-col items-center justify-center text-center px-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-4">
                <ArrowLeftRight className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-white text-base mb-1">ไม่พบรายการธุรกรรม</h3>
              <p className="text-xs text-slate-400 mb-6 max-w-xs">
                {search || selectedAccount || selectedType
                  ? 'ไม่พบข้อมูลที่ตรงกับเงื่อนไขการค้นหา ลองปรับตัวกรองใหม่อีกครั้ง'
                  : 'เริ่มต้นบันทึกธุรกรรมแรกเพื่อสร้างประวัติพอร์ต'}
              </p>
              {accounts.length > 0 ? (
                <button
                  onClick={() => setQuickAddOpen(true)}
                  className="min-h-11 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-2.5 px-5 rounded-xl transition-all shadow-md shadow-indigo-600/20"
                >
                  เพิ่มธุรกรรมใหม่
                </button>
              ) : (
                <a href="/accounts" className="min-h-11 inline-flex items-center bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-2.5 px-5 rounded-xl transition-all shadow-md shadow-indigo-600/20">
                  สร้างบัญชีลงทุน
                </a>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col">
              <div className="overflow-x-auto flex-1">
                <table className="custom-table text-left">
                  <thead>
                    <tr>
                      <th>วันที่</th>
                      <th>ประเภท</th>
                      <th>สินทรัพย์</th>
                      <th className="text-right">จำนวน</th>
                      <th className="text-right">ราคา/หน่วย</th>
                      <th className="text-right hidden lg:table-cell">ค่าธรรมเนียม</th>
                      <th className="text-right">ยอดรวม</th>
                      <th className="hidden md:table-cell">บัญชี</th>
                      <th className="text-right">การจัดการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.map((txn: any) => {
                      const cfg = TYPE_CONFIG[txn.txnType] ?? { label: txn.txnType, color: 'text-slate-400', bg: 'bg-slate-800/80 border-slate-700/80' }
                      const formattedDate = new Date(txn.txnDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

                      return (
                        <tr key={txn.id} className="transition-colors group">
                          <td className="text-slate-400 font-mono text-xs whitespace-nowrap">
                            {formattedDate}
                          </td>
                          <td className="whitespace-nowrap">
                            <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold border ${cfg.bg} ${cfg.color} tracking-wider`}>
                              {cfg.label}
                            </span>
                          </td>
                          <td>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white group-hover:text-indigo-300 transition-colors">
                                {txn.asset?.ticker || 'N/A'}
                              </span>
                              {txn.asset?.market && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 uppercase font-mono border border-slate-700/60">
                                  {txn.asset.market}
                                </span>
                              )}
                            </div>
                            {txn.note && (
                              <p className="text-[11px] text-slate-400 truncate max-w-[180px] mt-0.5">
                                {txn.note}
                              </p>
                            )}
                          </td>
                          <td className="text-right font-mono text-xs text-slate-200">
                            {Number(txn.quantity).toLocaleString()}
                          </td>
                          <td className="text-right font-mono text-xs text-slate-300">
                            {Number(txn.pricePerUnit).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="text-right font-mono text-xs text-slate-400 hidden lg:table-cell">
                            {Number(txn.fee || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="text-right font-mono text-sm font-bold text-white">
                            ฿{Number(txn.totalAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="text-slate-400 whitespace-nowrap hidden md:table-cell text-xs">
                            {txn.account?.accountName}
                          </td>
                          <td className="text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5 opacity-70 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => setEditingTxn(txn)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                                title="แก้ไขรายการ"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(txn.id)}
                                disabled={deletingId === txn.id}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
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

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between bg-slate-900/40 text-xs">
                  <span className="text-slate-400 font-mono text-[11px] uppercase tracking-wider">
                    หน้า {pagination.page} จาก {pagination.totalPages} (ทั้งหมด {pagination.total} รายการ)
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={pagination.page <= 1}
                      className="p-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:text-white disabled:opacity-30 transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                      disabled={pagination.page >= pagination.totalPages}
                      className="p-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:text-white disabled:opacity-30 transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {quickAddOpen && (
        <QuickAddModal
          onClose={() => setQuickAddOpen(false)}
          onSuccess={() => mutate(`/api/transactions?${queryParams.toString()}`)}
        />
      )}

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
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to update')
      onSuccess()
    } catch (err: any) {
      setError(err.message || 'Error updating transaction')
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass = "w-full bg-slate-900/80 border border-slate-700/80 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono transition-colors"
  const labelClass = "block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="glass-panel bg-slate-950/95 border border-slate-700/80 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="px-6 py-4.5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div>
            <h3 className="font-bold text-white text-base tracking-tight">แก้ไขรายการธุรกรรม</h3>
            <p className="text-[11px] text-indigo-400 font-mono mt-0.5">{txn.asset?.ticker}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleUpdate} className="p-6 space-y-4">
          {error && <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">{error}</div>}
          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className={labelClass}>ประเภทรายการ</label>
              <select className={inputClass} value={form.txnType} onChange={(e) => setForm({ ...form, txnType: e.target.value })}>
                <option value="BUY">BUY</option>
                <option value="SELL">SELL</option>
                <option value="DIVIDEND">DIVIDEND</option>
                <option value="DEPOSIT">DEPOSIT</option>
                <option value="WITHDRAW">WITHDRAW</option>
                <option value="FEE">FEE</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>วันที่</label>
              <input type="date" className={inputClass} value={form.txnDate} onChange={(e) => setForm({ ...form, txnDate: e.target.value })} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className={labelClass}>จำนวน (QTY)</label>
              <input type="number" step="any" className={inputClass} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required />
            </div>
            <div>
              <label className={labelClass}>ราคา/หน่วย</label>
              <input type="number" step="any" className={inputClass} value={form.pricePerUnit} onChange={(e) => setForm({ ...form, pricePerUnit: e.target.value })} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className={labelClass}>ค่าธรรมเนียม</label>
              <input type="number" step="any" className={inputClass} value={form.fee} onChange={(e) => setForm({ ...form, fee: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>ภาษี</label>
              <input type="number" step="any" className={inputClass} value={form.taxWithheld} onChange={(e) => setForm({ ...form, taxWithheld: e.target.value })} />
            </div>
          </div>
          <div>
            <label className={labelClass}>บันทึกเพิ่มเติม (Note)</label>
            <input type="text" className={`${inputClass} font-sans`} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </div>
          <div className="pt-3 flex justify-end gap-3 border-t border-slate-800">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-colors">
              ยกเลิก
            </button>
            <button type="submit" disabled={submitting} className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/20">
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
      error: (err) => setError(err.message),
    })
  }

  async function handleImport() {
    if (!selectedAccountId || rows.length === 0) return
    setImporting(true)
    setError('')
    try {
      const res = await fetch('/api/transactions/import-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: selectedAccountId, rows }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Import failed')
      setResult(data)
      if (data.imported > 0) setTimeout(() => onSuccess(), 1200)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="glass-panel bg-slate-950/95 border border-slate-700/80 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        <div className="px-6 py-4.5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base tracking-tight">นำเข้ารายการธุรกรรมจาก CSV</h3>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">BATCH IMPORT TRANSACTIONS</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {error && <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">{error}</div>}
          {result && (
            <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs font-mono text-emerald-300">
              <p className="font-bold text-white mb-1">การนำเข้าเสร็จสมบูรณ์</p>
              <p>นำเข้าสำเร็จ: {result.imported} รายการ</p>
              <p>ข้าม: {result.skipped} รายการ</p>
              {result.errors.length > 0 && <p className="text-rose-400">พบข้อผิดพลาด: {result.errors.length} รายการ</p>}
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              เลือกบัญชีปลายทาง *
            </label>
            <select
              className="w-full bg-slate-900/80 border border-slate-700/80 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
            >
              {accounts.map((acc: any) => <option key={acc.id} value={acc.id}>{acc.accountName}</option>)}
            </select>
          </div>

          <label className="border-2 border-dashed border-slate-700/80 hover:border-indigo-500/60 rounded-2xl p-7 text-center cursor-pointer transition-colors bg-slate-900/40 block">
            <input type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
            <Upload className="w-7 h-7 text-indigo-400 mx-auto mb-2" />
            <p className="text-xs font-bold text-white">{fileName || 'คลิกเพื่อเลือกไฟล์ CSV'}</p>
            <p className="text-[11px] text-slate-400 font-mono mt-1">คอลัมน์ที่รองรับ: Date, Ticker, Type, Quantity, Price, Fee</p>
          </label>

          {rows.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">ตัวอย่างข้อมูล ({rows.length} แถว)</p>
              <div className="border border-slate-800 rounded-xl overflow-hidden max-h-32 overflow-y-auto">
                <table className="w-full text-left text-[11px] font-mono">
                  <thead className="bg-slate-900 text-slate-400 sticky top-0">
                    <tr><th className="p-2">วันที่</th><th className="p-2">Ticker</th><th className="p-2 text-right">จำนวน</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {rows.slice(0, 3).map((r, i) => (
                      <tr key={i}><td className="p-2 text-slate-400">{r.txnDate.slice(0, 10)}</td><td className="p-2 text-white font-bold">{r.ticker}</td><td className="p-2 text-right text-slate-300">{r.quantity}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-800 flex justify-end gap-3 bg-slate-900/60">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-colors">
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={importing || rows.length === 0}
            className="bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/20"
          >
            {importing ? 'กำลังนำเข้า...' : 'ยืนยันการนำเข้า'}
          </button>
        </div>
      </div>
    </div>
  )
}
