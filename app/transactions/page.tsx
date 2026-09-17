'use client'

import React, { useState, useEffect } from 'react'
import useSWR, { mutate } from 'swr'
import { AppShell } from '@/components/AppShell'
import { QuickAddModal } from '@/components/QuickAddModal'
import { PageHeader } from '@/components/PageHeader'
import {
  ArrowLeftRight,
  Plus,
  Upload,
  Search,
  Trash2,
  Edit2,
  Wallet,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  X
} from 'lucide-react'
import Papa from 'papaparse'

const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  BUY: { label: 'BUY', color: 'text-zinc-300', bg: 'bg-white/5 border-white/10' },
  SELL: { label: 'SELL', color: 'text-zinc-300', bg: 'bg-white/5 border-white/10' },
  DIVIDEND: { label: 'DIVIDEND', color: 'text-zinc-300', bg: 'bg-white/5 border-white/10' },
  DEPOSIT: { label: 'DEPOSIT', color: 'text-zinc-300', bg: 'bg-white/5 border-white/10' },
  WITHDRAW: { label: 'WITHDRAW', color: 'text-zinc-300', bg: 'bg-white/5 border-white/10' },
  FEE: { label: 'FEE', color: 'text-zinc-500', bg: 'bg-transparent border-white/5' },
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
    if (!confirm('ยืนยันลบรายการนี้?')) return
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

  // Common UI styles
  const inputClass = "bg-[#050505] border border-white/5 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-zinc-500 transition-colors w-full"
  
  return (
    <AppShell>
      <div className="space-y-6 max-w-[1600px] mx-auto w-full">
        
        {/* Header (Minimalist) */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">รายการธุรกรรม</h1>
            <p className="text-sm text-zinc-500 mt-1">ประวัติการซื้อขายและกระแสเงินสดทั้งหมด</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setCsvModalOpen(true)} className="bg-[#0a0a0a] border border-white/10 hover:bg-white/5 text-zinc-300 px-4 py-2 rounded-lg font-medium text-xs flex items-center gap-2 transition-colors">
              <Upload className="w-4 h-4" /> CSV
            </button>
            <button onClick={() => setQuickAddOpen(true)} className="bg-white text-black hover:bg-zinc-200 px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 transition-colors">
              <Plus className="w-4 h-4" /> เพิ่มธุรกรรม
            </button>
          </div>
        </div>

        {/* Toolbar (Summary + Filters) */}
        <div className="flex flex-col xl:flex-row gap-5 items-start xl:items-center justify-between p-5 rounded-3xl bg-[#0a0a0a] border border-white/5">
          <div className="flex items-center gap-6 overflow-x-auto w-full xl:w-auto pb-2 xl:pb-0 scrollbar-hide">
            <div className="flex flex-col">
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">ลงทุนรวม</span>
              <span className="text-sm font-bold text-white tabular-nums font-mono mt-0.5">
                ฿{totalOutflow.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="w-px h-8 bg-white/5 shrink-0" />
            <div className="flex flex-col">
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">ขาย/ปันผล</span>
              <span className="text-sm font-bold text-white tabular-nums font-mono mt-0.5">
                ฿{totalInflow.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="w-px h-8 bg-white/5 shrink-0" />
            <div className="flex flex-col">
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">ค่าธรรมเนียม</span>
              <span className="text-sm font-bold text-zinc-400 tabular-nums font-mono mt-0.5">
                ฿{totalFees.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 w-full xl:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                className={`${inputClass} pl-9`}
                placeholder="ค้นหา Ticker, ชื่อ..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              className={`${inputClass} sm:w-40 appearance-none`}
              value={selectedAccount}
              onChange={(e) => { setSelectedAccount(e.target.value); setPage(1) }}
            >
              <option value="">ทุกบัญชี</option>
              {accounts.map((acc: any) => (
                <option key={acc.id} value={acc.id}>{acc.accountName}</option>
              ))}
            </select>
            <select
              className={`${inputClass} sm:w-40 appearance-none`}
              value={selectedType}
              onChange={(e) => { setSelectedType(e.target.value); setPage(1) }}
            >
              <option value="">ทุกประเภท</option>
              <option value="BUY">BUY</option>
              <option value="SELL">SELL</option>
              <option value="DIVIDEND">DIVIDEND</option>
              <option value="DEPOSIT">DEPOSIT</option>
              <option value="WITHDRAW">WITHDRAW</option>
              <option value="FEE">FEE</option>
            </select>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="rounded-3xl bg-[#0a0a0a] border border-white/5 overflow-hidden min-h-[400px] flex flex-col">
          {isLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 py-20 text-zinc-500">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="text-xs font-mono uppercase tracking-widest">Loading...</span>
            </div>
          ) : error ? (
            <div className="flex-1 py-16 text-center text-xs text-rose-400">Error loading data</div>
          ) : filteredTransactions.length === 0 ? (
            <div className="flex-1 py-20 flex flex-col items-center justify-center text-center px-4">
              <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
                <ArrowLeftRight className="w-5 h-5 text-zinc-500" />
              </div>
              <h3 className="font-bold text-white text-sm mb-1">NO TRANSACTIONS</h3>
              <p className="text-xs text-zinc-500 mb-6">เริ่มบันทึกธุรกรรมแรกเพื่อวิเคราะห์พอร์ต</p>
              <button
                onClick={() => setQuickAddOpen(true)}
                className="bg-white text-black hover:bg-zinc-200 text-xs font-bold py-2.5 px-6 rounded-xl transition-colors"
              >
                เพิ่มธุรกรรม
              </button>
            </div>
          ) : (
            <div className="flex-1 flex flex-col">
              <div className="overflow-x-auto flex-1 scrollbar-thin">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 z-10 bg-[#050505] border-b border-white/5">
                    <tr>
                      <th className="py-4 px-5 font-bold text-zinc-500 text-[10px] uppercase tracking-[0.1em]">วันที่</th>
                      <th className="py-4 px-5 font-bold text-zinc-500 text-[10px] uppercase tracking-[0.1em]">ประเภท</th>
                      <th className="py-4 px-5 font-bold text-zinc-500 text-[10px] uppercase tracking-[0.1em]">สินทรัพย์</th>
                      <th className="py-4 px-5 font-bold text-zinc-500 text-[10px] uppercase tracking-[0.1em] text-right">จำนวน</th>
                      <th className="py-4 px-5 font-bold text-zinc-500 text-[10px] uppercase tracking-[0.1em] text-right">ราคา</th>
                      <th className="py-4 px-5 font-bold text-zinc-500 text-[10px] uppercase tracking-[0.1em] text-right hidden lg:table-cell">Fee</th>
                      <th className="py-4 px-5 font-bold text-zinc-500 text-[10px] uppercase tracking-[0.1em] text-right">ยอดรวม</th>
                      <th className="py-4 px-5 font-bold text-zinc-500 text-[10px] uppercase tracking-[0.1em] hidden md:table-cell">บัญชี</th>
                      <th className="py-4 px-5 font-bold text-zinc-500 text-[10px] uppercase tracking-[0.1em] text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredTransactions.map((txn: any) => {
                      const cfg = TYPE_CONFIG[txn.txnType] ?? { label: txn.txnType, color: 'text-zinc-500', bg: 'bg-transparent border-white/5' }
                      const formattedDate = new Date(txn.txnDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

                      return (
                        <tr key={txn.id} className="hover:bg-white/[0.02] transition-colors group">
                          <td className="py-4 px-5 text-zinc-400 font-mono text-[10px] uppercase whitespace-nowrap">
                            {formattedDate}
                          </td>
                          <td className="py-4 px-5 whitespace-nowrap">
                            <span className={`px-2 py-1 rounded-md text-[9px] font-bold border ${cfg.bg} ${cfg.color} tracking-widest`}>
                              {cfg.label}
                            </span>
                          </td>
                          <td className="py-4 px-5">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white tracking-wide">
                                {txn.asset?.ticker || 'N/A'}
                              </span>
                              {txn.asset?.market && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-sm bg-white/5 text-zinc-500 uppercase font-mono">
                                  {txn.asset.market}
                                </span>
                              )}
                            </div>
                            {txn.note && (
                              <p className="text-[10px] text-zinc-600 truncate max-w-[150px] mt-1">
                                {txn.note}
                              </p>
                            )}
                          </td>
                          <td className="py-4 px-5 text-right font-mono text-zinc-300">
                            {Number(txn.quantity).toLocaleString()}
                          </td>
                          <td className="py-4 px-5 text-right font-mono text-zinc-400">
                            {Number(txn.pricePerUnit).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-4 px-5 text-right font-mono text-zinc-600 hidden lg:table-cell">
                            {Number(txn.fee || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-4 px-5 text-right font-mono font-bold text-white">
                            ฿{Number(txn.totalAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-4 px-5 text-zinc-500 whitespace-nowrap hidden md:table-cell text-[11px]">
                            {txn.account?.accountName}
                          </td>
                          <td className="py-4 px-5 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => setEditingTxn(txn)}
                                className="p-1.5 rounded-lg text-zinc-400 hover:text-white transition-colors"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(txn.id)}
                                disabled={deletingId === txn.id}
                                className="p-1.5 rounded-lg text-zinc-400 hover:text-white transition-colors"
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
                <div className="px-5 py-4 border-t border-white/5 flex items-center justify-between bg-[#050505] text-xs">
                  <span className="text-zinc-500 font-mono text-[10px] uppercase tracking-widest">
                    PAGE {pagination.page} OF {pagination.totalPages}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={pagination.page <= 1}
                      className="p-1.5 rounded-lg border border-white/10 bg-white/5 text-zinc-400 hover:text-white disabled:opacity-30 transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                      disabled={pagination.page >= pagination.totalPages}
                      className="p-1.5 rounded-lg border border-white/10 bg-white/5 text-zinc-400 hover:text-white disabled:opacity-30 transition-colors"
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
      setError(err.message || 'Error')
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass = "w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-zinc-500 transition-colors font-mono"
  const labelClass = "block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between bg-[#050505]">
          <div>
            <h3 className="font-bold text-white text-base tracking-tight">EDIT TRANSACTION</h3>
            <p className="text-[10px] text-zinc-500 font-mono mt-0.5">{txn.asset?.ticker}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full text-zinc-500 hover:text-white hover:bg-white/10 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleUpdate} className="p-6 space-y-4">
          {error && <div className="text-xs text-rose-400 mb-2">{error}</div>}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>TYPE</label>
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
              <label className={labelClass}>DATE</label>
              <input type="date" className={inputClass} value={form.txnDate} onChange={(e) => setForm({ ...form, txnDate: e.target.value })} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>QTY</label>
              <input type="number" step="any" className={inputClass} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required />
            </div>
            <div>
              <label className={labelClass}>PRICE</label>
              <input type="number" step="any" className={inputClass} value={form.pricePerUnit} onChange={(e) => setForm({ ...form, pricePerUnit: e.target.value })} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>FEE</label>
              <input type="number" step="any" className={inputClass} value={form.fee} onChange={(e) => setForm({ ...form, fee: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>TAX</label>
              <input type="number" step="any" className={inputClass} value={form.taxWithheld} onChange={(e) => setForm({ ...form, taxWithheld: e.target.value })} />
            </div>
          </div>
          <div>
            <label className={labelClass}>NOTE</label>
            <input type="text" className={`${inputClass} font-sans`} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </div>
          <div className="pt-4 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="bg-white text-black hover:bg-zinc-200 px-6 py-2.5 rounded-xl text-xs font-bold transition-colors">
              {submitting ? 'Saving...' : 'Save Changes'}
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
          setError('No data found in CSV.')
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
      if (data.imported > 0) setTimeout(() => onSuccess(), 1500)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">
        <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between bg-[#050505]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base tracking-tight">IMPORT CSV</h3>
              <p className="text-[10px] text-zinc-500 font-mono mt-0.5">BATCH TRANSACTIONS</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full text-zinc-500 hover:text-white hover:bg-white/10 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {error && <div className="text-xs text-rose-400">{error}</div>}
          {result && (
            <div className="p-3 bg-white/5 border border-white/10 rounded-xl text-xs font-mono text-zinc-300">
              <p className="font-bold text-white mb-1">Import Complete</p>
              <p>Success: {result.imported}</p>
              <p>Skipped: {result.skipped}</p>
              {result.errors.length > 0 && <p className="text-rose-400">Errors: {result.errors.length}</p>}
            </div>
          )}

          <div>
            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">TARGET ACCOUNT</label>
            <select className="w-full bg-[#050505] border border-white/5 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none" value={selectedAccountId} onChange={(e) => setSelectedAccountId(e.target.value)}>
              {accounts.map((acc: any) => <option key={acc.id} value={acc.id}>{acc.accountName}</option>)}
            </select>
          </div>

          <label className="border-2 border-dashed border-white/10 hover:border-zinc-500 rounded-2xl p-8 text-center cursor-pointer transition-colors bg-[#050505] block">
            <input type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
            <Upload className="w-6 h-6 text-zinc-400 mx-auto mb-3" />
            <p className="text-xs font-bold text-white">{fileName || 'Click to select CSV'}</p>
            <p className="text-[10px] text-zinc-500 font-mono mt-2 uppercase">Headers: Date, Ticker, Type, Quantity, Price, Fee</p>
          </label>

          {rows.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">PREVIEW ({rows.length} ROWS)</p>
              <div className="border border-white/5 rounded-xl overflow-hidden max-h-32 overflow-y-auto">
                <table className="w-full text-left text-[10px] font-mono">
                  <thead className="bg-[#050505] text-zinc-500 sticky top-0">
                    <tr><th className="p-2">Date</th><th className="p-2">Ticker</th><th className="p-2 text-right">Qty</th></tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {rows.slice(0, 3).map((r, i) => (
                      <tr key={i}><td className="p-2 text-zinc-400">{r.txnDate.slice(0, 10)}</td><td className="p-2 text-white">{r.ticker}</td><td className="p-2 text-right text-zinc-400">{r.quantity}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-5 border-t border-white/5 flex justify-end gap-3 bg-[#050505]">
          <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white transition-colors">
            Cancel
          </button>
          <button type="button" onClick={handleImport} disabled={importing || rows.length === 0} className="bg-white text-black hover:bg-zinc-200 disabled:opacity-50 px-6 py-2.5 rounded-xl text-xs font-bold transition-colors">
            {importing ? 'Importing...' : 'Confirm Import'}
          </button>
        </div>
      </div>
    </div>
  )
}
