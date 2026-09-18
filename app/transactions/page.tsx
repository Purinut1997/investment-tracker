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
  Coins,
  CheckSquare,
  Square,
  ShieldAlert,
  Wallet,
  Check
} from 'lucide-react'
import Papa from 'papaparse'
import { parseAccountsPayload } from '@/lib/accounts'
import { StatusModal, type StatusDetailItem } from '@/components/ui/StatusModal'

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
  const [clearAllModalOpen, setClearAllModalOpen] = useState(false)
  const [editingTxn, setEditingTxn] = useState<any | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Multi-select state
  const [selectedTxnIds, setSelectedTxnIds] = useState<string[]>([])
  const [deletingBatch, setDeletingBatch] = useState(false)

  // Status popup
  const [statusModal, setStatusModal] = useState<{
    isOpen: boolean
    type: 'loading' | 'success' | 'error' | 'warning'
    title: string
    description?: string
    details?: StatusDetailItem[]
    primaryAction?: { label: string; onClick: () => void }
    autoCloseMs?: number
  } | null>(null)

  const { data: accountsData } = useSWR('/api/accounts')
  const accounts = parseAccountsPayload(accountsData)

  const queryParams = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    ...(selectedAccount && { accountId: selectedAccount }),
    ...(selectedType && { txnType: selectedType }),
  })

  const { data: txnData, isLoading, error } = useSWR(`/api/transactions?${queryParams.toString()}`)
  const rawTxns = txnData?.transactions ?? txnData?.data ?? []
  const transactions = Array.isArray(rawTxns) ? rawTxns : []
  const pagination = txnData?.pagination ?? { page: 1, totalPages: 1, total: 0 }
  const hasAnyTransactions = (pagination.total ?? 0) > 0 || transactions.length > 0

  const filteredTransactions = transactions.filter((t: any) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    const ticker = t.asset?.ticker?.toLowerCase() ?? ''
    const assetName = t.asset?.assetName?.toLowerCase() ?? ''
    const note = t.note?.toLowerCase() ?? ''
    return ticker.includes(q) || assetName.includes(q) || note.includes(q)
  })

  // Group totals by currency (USD vs THB)
  const usdOutflow = filteredTransactions
    .filter((t: any) => t.txnType === 'BUY' && (t.account?.currency === 'USD' || t.asset?.currency === 'USD' || t.asset?.market === 'US'))
    .reduce((sum: number, t: any) => sum + Number(t.totalAmount || 0), 0)

  const thbOutflow = filteredTransactions
    .filter((t: any) => t.txnType === 'BUY' && !(t.account?.currency === 'USD' || t.asset?.currency === 'USD' || t.asset?.market === 'US'))
    .reduce((sum: number, t: any) => sum + Number(t.totalAmount || 0), 0)

  const usdInflow = filteredTransactions
    .filter((t: any) => (t.txnType === 'SELL' || t.txnType === 'DIVIDEND') && (t.account?.currency === 'USD' || t.asset?.currency === 'USD' || t.asset?.market === 'US'))
    .reduce((sum: number, t: any) => sum + Number(t.totalAmount || 0), 0)

  const thbInflow = filteredTransactions
    .filter((t: any) => (t.txnType === 'SELL' || t.txnType === 'DIVIDEND') && !(t.account?.currency === 'USD' || t.asset?.currency === 'USD' || t.asset?.market === 'US'))
    .reduce((sum: number, t: any) => sum + Number(t.totalAmount || 0), 0)

  const usdFees = filteredTransactions
    .filter((t: any) => (t.account?.currency === 'USD' || t.asset?.currency === 'USD' || t.asset?.market === 'US'))
    .reduce((sum: number, t: any) => sum + Number(t.fee || 0), 0)

  const thbFees = filteredTransactions
    .filter((t: any) => !(t.account?.currency === 'USD' || t.asset?.currency === 'USD' || t.asset?.market === 'US'))
    .reduce((sum: number, t: any) => sum + Number(t.fee || 0), 0)

  // Single delete
  async function handleDelete(id: string) {
    if (!confirm('ยืนยันลบรายการนี้? การลบจะมีผลต่อการคำนวณต้นทุนพอร์ต')) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/transactions/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      setSelectedTxnIds((prev) => prev.filter((item) => item !== id))
      mutate((key) => typeof key === 'string' && key.startsWith('/api/transactions'))
      mutate('/api/portfolio/summary')
      mutate('/api/portfolio/holdings')
      mutate('/api/accounts')
    } catch (err: any) {
      alert(err.message || 'ลบรายการไม่สำเร็จ')
    } finally {
      setDeletingId(null)
    }
  }

  // Batch delete selected transactions
  async function handleBatchDelete() {
    if (selectedTxnIds.length === 0) return
    if (!confirm(`ยืนยันลบรายการธุรกรรมที่เลือก ${selectedTxnIds.length} รายการ? การลบจะมีผลต่อการคำนวณต้นทุนพอร์ต`)) return
    setDeletingBatch(true)
    try {
      const res = await fetch('/api/transactions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedTxnIds }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete transactions')

      const count = data.count ?? selectedTxnIds.length
      setSelectedTxnIds([])
      mutate((key) => typeof key === 'string' && key.startsWith('/api/transactions'))
      mutate('/api/portfolio/summary')
      mutate('/api/portfolio/holdings')
      mutate('/api/accounts')

      setStatusModal({
        isOpen: true,
        type: 'success',
        title: 'ลบรายการที่เลือกเรียบร้อยแล้ว!',
        description: `นำรายการธุรกรรมออกจากระบบจำนวน ${count} รายการแล้ว`,
        autoCloseMs: 2500,
        primaryAction: {
          label: 'ตกลง',
          onClick: () => setStatusModal(null),
        },
      })
    } catch (err: any) {
      alert(err.message || 'เกิดข้อผิดพลาดในการลบ')
    } finally {
      setDeletingBatch(false)
    }
  }

  // Selection toggle
  const allCurrentSelected =
    filteredTransactions.length > 0 &&
    filteredTransactions.every((t: any) => selectedTxnIds.includes(t.id))

  function toggleSelectAllCurrent() {
    if (allCurrentSelected) {
      const currentIds = new Set(filteredTransactions.map((t: any) => t.id))
      setSelectedTxnIds((prev) => prev.filter((id) => !currentIds.has(id)))
    } else {
      const newIds = new Set([...selectedTxnIds, ...filteredTransactions.map((t: any) => t.id)])
      setSelectedTxnIds(Array.from(newIds))
    }
  }

  function toggleSelectTxn(id: string) {
    if (selectedTxnIds.includes(id)) {
      setSelectedTxnIds((prev) => prev.filter((item) => item !== id))
    } else {
      setSelectedTxnIds((prev) => [...prev, id])
    }
  }

  // Common UI styles
  const inputClass =
    'bg-slate-900/80 border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors w-full'

  return (
    <AppShell>
      <div className="space-y-6 max-w-[1600px] mx-auto w-full animate-fade-in relative pb-16">
        {/* Header */}
        <PageHeader
          eyebrow="Transactions History"
          title="ประวัติรายการธุรกรรม"
          description="บันทึกและตรวจสอบประวัติการซื้อขาย เงินปันผล ค่าธรรมเนียม และกระแสเงินสดทั้งหมดในพอร์ต"
          action={
            <div className="flex items-center gap-2.5 flex-wrap">
              {hasAnyTransactions && (
                <button
                  onClick={() => setClearAllModalOpen(true)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-rose-300 hover:text-white bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                  title="ล้างข้อมูลธุรกรรมทั้งหมดเพื่อลงใหม่"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  <span>ล้างข้อมูลธุรกรรม</span>
                </button>
              )}
              <button
                onClick={() => setCsvModalOpen(true)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-[#181C25] hover:bg-[#202532] border border-white/[0.1] transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
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
        {hasAnyTransactions && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="glass-panel p-4 sm:p-5 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400">
                  เงินลงทุนสะสม (BUY)
                </span>
                <div className="mt-1 space-y-0.5">
                  {usdOutflow > 0 && (
                    <p className="text-xl sm:text-2xl font-bold text-white font-mono tabular-nums">
                      ${usdOutflow.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      <span className="text-xs font-normal text-indigo-400 ml-1.5">USD</span>
                    </p>
                  )}
                  {thbOutflow > 0 && (
                    <p className={`${usdOutflow > 0 ? 'text-xs text-slate-400' : 'text-xl sm:text-2xl font-bold text-white'} font-mono tabular-nums`}>
                      ฿{thbOutflow.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      <span className="text-xs font-normal text-emerald-400 ml-1.5">THB</span>
                    </p>
                  )}
                  {usdOutflow === 0 && thbOutflow === 0 && (
                    <p className="text-xl sm:text-2xl font-bold text-white font-mono tabular-nums">
                      $0.00
                    </p>
                  )}
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>

            <div className="glass-panel p-4 sm:p-5 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400">
                  ขาย + เงินปันผลรับ
                </span>
                <div className="mt-1 space-y-0.5">
                  {usdInflow > 0 && (
                    <p className="text-xl sm:text-2xl font-bold text-emerald-400 font-mono tabular-nums">
                      ${usdInflow.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      <span className="text-xs font-normal text-emerald-300 ml-1.5">USD</span>
                    </p>
                  )}
                  {thbInflow > 0 && (
                    <p className={`${usdInflow > 0 ? 'text-xs text-emerald-400/80' : 'text-xl sm:text-2xl font-bold text-emerald-400'} font-mono tabular-nums`}>
                      ฿{thbInflow.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      <span className="text-xs font-normal text-emerald-300 ml-1.5">THB</span>
                    </p>
                  )}
                  {usdInflow === 0 && thbInflow === 0 && (
                    <p className="text-xl sm:text-2xl font-bold text-emerald-400 font-mono tabular-nums">
                      $0.00
                    </p>
                  )}
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                <Coins className="w-5 h-5" />
              </div>
            </div>

            <div className="glass-panel p-4 sm:p-5 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400">
                  ค่าธรรมเนียมรวม (Fee)
                </span>
                <div className="mt-1 space-y-0.5">
                  {usdFees > 0 && (
                    <p className="text-xl sm:text-2xl font-bold text-slate-300 font-mono tabular-nums">
                      ${usdFees.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      <span className="text-xs font-normal text-slate-400 ml-1.5">USD</span>
                    </p>
                  )}
                  {thbFees > 0 && (
                    <p className={`${usdFees > 0 ? 'text-xs text-slate-400' : 'text-xl sm:text-2xl font-bold text-slate-300'} font-mono tabular-nums`}>
                      ฿{thbFees.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      <span className="text-xs font-normal text-slate-400 ml-1.5">THB</span>
                    </p>
                  )}
                  {usdFees === 0 && thbFees === 0 && (
                    <p className="text-xl sm:text-2xl font-bold text-slate-300 font-mono tabular-nums">
                      $0.00
                    </p>
                  )}
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-slate-800 text-slate-400 flex items-center justify-center">
                <TrendingDown className="w-5 h-5" />
              </div>
            </div>
          </div>
        )}

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
              onChange={(e) => {
                setSelectedAccount(e.target.value)
                setPage(1)
              }}
            >
              <option value="">ทุกบัญชีการลงทุน</option>
              {accounts.map((acc: any) => (
                <option key={acc.id} value={acc.id}>
                  {acc.accountName} ({acc.currency})
                </option>
              ))}
            </select>
            <select
              className={`${inputClass} sm:w-36`}
              value={selectedType}
              onChange={(e) => {
                setSelectedType(e.target.value)
                setPage(1)
              }}
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
              <button
                onClick={() => mutate(`/api/transactions?${queryParams.toString()}`)}
                className="min-h-11 px-4 rounded-xl border border-rose-500/30 text-rose-300 hover:bg-rose-500/10 font-semibold"
              >
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
                <a
                  href="/accounts"
                  className="min-h-11 inline-flex items-center bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-2.5 px-5 rounded-xl transition-all shadow-md shadow-indigo-600/20"
                >
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
                      <th className="w-10 text-center">
                        <input
                          type="checkbox"
                          checked={allCurrentSelected}
                          onChange={toggleSelectAllCurrent}
                          title="เลือกทั้งหมดในหน้านี้"
                          className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-950 cursor-pointer"
                        />
                      </th>
                      <th>วันที่</th>
                      <th>ประเภท</th>
                      <th>สินทรัพย์</th>
                      <th className="text-right">จำนวน</th>
                      <th className="text-right">ราคา/หน่วย</th>
                      <th className="text-right hidden lg:table-cell">ค่าธรรมเนียม</th>
                      <th className="text-right">ยอดรวม</th>
                      <th className="hidden md:table-cell">บัญชี/กระเป๋า</th>
                      <th className="text-right">การจัดการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.map((txn: any) => {
                      const cfg = TYPE_CONFIG[txn.txnType] ?? {
                        label: txn.txnType,
                        color: 'text-slate-400',
                        bg: 'bg-slate-800/80 border-slate-700/80',
                      }
                      const formattedDate = new Date(txn.txnDate).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })

                      const isUsd =
                        txn.account?.currency === 'USD' ||
                        txn.asset?.currency === 'USD' ||
                        txn.asset?.market === 'US'
                      const currSym = isUsd ? '$' : '฿'
                      const isSelected = selectedTxnIds.includes(txn.id)

                      return (
                        <tr
                          key={txn.id}
                          className={`transition-colors group ${isSelected ? 'bg-indigo-600/10' : ''}`}
                        >
                          <td className="w-10 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectTxn(txn.id)}
                              className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-950 cursor-pointer"
                            />
                          </td>
                          <td className="text-slate-400 font-mono text-xs whitespace-nowrap">
                            {formattedDate}
                          </td>
                          <td className="whitespace-nowrap">
                            <span
                              className={`px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold border ${cfg.bg} ${cfg.color} tracking-wider`}
                            >
                              {cfg.label}
                            </span>
                          </td>
                          <td>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white group-hover:text-indigo-300 transition-colors">
                                {txn.asset?.ticker || 'N/A'}
                              </span>
                              {txn.asset?.market && (
                                <span className={`text-[9px] px-1.5 py-0.2 rounded uppercase font-mono border ${isUsd ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30' : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'}`}>
                                  {txn.asset.market}
                                </span>
                              )}
                            </div>
                            {txn.note && (
                              <p className="text-[11px] text-slate-400 truncate max-w-[200px] mt-0.5">
                                {txn.note}
                              </p>
                            )}
                          </td>
                          <td className="text-right font-mono text-xs text-slate-200">
                            {Number(txn.quantity).toLocaleString()}
                          </td>
                          <td className="text-right font-mono text-xs text-slate-300">
                            {currSym}
                            {Number(txn.pricePerUnit).toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                            })}
                          </td>
                          <td className="text-right font-mono text-xs text-slate-400 hidden lg:table-cell">
                            {currSym}
                            {Number(txn.fee || 0).toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                            })}
                          </td>
                          <td className="text-right font-mono text-sm font-bold text-white">
                            {currSym}
                            {Number(txn.totalAmount).toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                            })}
                          </td>
                          <td className="text-slate-400 whitespace-nowrap hidden md:table-cell text-xs">
                            <div className="flex items-center gap-1.5">
                              <span className="text-slate-300">{txn.account?.accountName}</span>
                              <span
                                className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                                  isUsd
                                    ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                                    : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                }`}
                              >
                                {txn.account?.currency || (isUsd ? 'USD' : 'THB')}
                              </span>
                            </div>
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

        {/* Floating Bulk Action Bar */}
        {selectedTxnIds.length > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-5 py-3 rounded-2xl bg-[#12151C]/95 border border-indigo-500/40 shadow-2xl backdrop-blur-xl animate-fade-in">
            <span className="text-xs font-semibold text-white">
              เลือกอยู่ <span className="text-indigo-400 font-bold font-mono">{selectedTxnIds.length}</span> รายการ
            </span>
            <div className="h-4 w-px bg-white/10" />
            <button
              onClick={handleBatchDelete}
              disabled={deletingBatch}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 transition-all flex items-center gap-1.5 shadow-lg shadow-rose-600/25 active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{deletingBatch ? 'กำลังลบ...' : `ลบรายการที่เลือก (${selectedTxnIds.length})`}</span>
            </button>
            <button
              onClick={() => setSelectedTxnIds([])}
              className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              ยกเลิก
            </button>
          </div>
        )}
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
            mutate(`/api/transactions?${queryParams.toString()}`)
            mutate('/api/portfolio/summary')
            mutate('/api/portfolio/holdings')
            mutate('/api/accounts')
          }}
        />
      )}

      {clearAllModalOpen && (
        <ClearAllTransactionsModal
          accounts={accounts}
          totalCount={pagination.total ?? transactions.length}
          onClose={() => setClearAllModalOpen(false)}
          onSuccess={() => {
            setSelectedTxnIds([])
            mutate(`/api/transactions?${queryParams.toString()}`)
            mutate('/api/portfolio/summary')
            mutate('/api/portfolio/holdings')
            mutate('/api/accounts')
          }}
        />
      )}

      {statusModal && (
        <StatusModal
          isOpen={statusModal.isOpen}
          type={statusModal.type}
          title={statusModal.title}
          description={statusModal.description}
          details={statusModal.details}
          primaryAction={statusModal.primaryAction}
          onClose={() => setStatusModal(null)}
          autoCloseMs={statusModal.autoCloseMs}
        />
      )}
    </AppShell>
  )
}

// ─── EDIT TRANSACTION MODAL ───────────────────────────────────────
function EditTransactionModal({ txn, onClose, onSuccess }: { txn: any; onClose: () => void; onSuccess: () => void }) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [statusModal, setStatusModal] = useState<{
    isOpen: boolean
    type: 'loading' | 'success' | 'error' | 'warning'
    title: string
    description?: string
    details?: StatusDetailItem[]
    primaryAction?: { label: string; onClick: () => void }
    autoCloseMs?: number
  } | null>(null)

  const [form, setForm] = useState({
    txnType: txn.txnType,
    txnDate: new Date(txn.txnDate).toISOString().split('T')[0],
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
    setStatusModal({
      isOpen: true,
      type: 'loading',
      title: 'กำลังบันทึกการแก้ไข...',
      description: `กำลังปรับปรุงข้อมูล ${txn.asset?.ticker || 'ธุรกรรม'}`,
    })

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

      setStatusModal({
        isOpen: true,
        type: 'success',
        title: 'บันทึกเรียบร้อยแล้ว!',
        description: 'อัปเดตข้อมูลรายการธุรกรรมและคำนวณต้นทุนใหม่แล้ว',
        details: [
          { label: 'Ticker', value: txn.asset?.ticker || '-', color: 'text-indigo-400' },
          { label: 'ประเภท', value: form.txnType, color: 'text-emerald-400' },
          { label: 'จำนวน', value: form.quantity, color: 'text-white' },
        ],
        autoCloseMs: 2500,
        primaryAction: {
          label: 'ตกลง',
          onClick: () => {
            setStatusModal(null)
            onSuccess()
            onClose()
          },
        },
      })
    } catch (err: any) {
      setError(err.message || 'Error updating transaction')
      setStatusModal({
        isOpen: true,
        type: 'error',
        title: 'บันทึกไม่สำเร็จ',
        description: err.message || 'เกิดข้อผิดพลาดในการแก้ไขรายการ',
        primaryAction: {
          label: 'ปิด',
          onClick: () => setStatusModal(null),
        },
      })
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass =
    'w-full bg-slate-900/80 border border-slate-700/80 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono transition-colors'
  const labelClass = 'block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="glass-panel bg-slate-950/95 border border-slate-700/80 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="px-6 py-4.5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div>
            <h3 className="font-bold text-white text-base tracking-tight">แก้ไขรายการธุรกรรม</h3>
            <p className="text-[11px] text-indigo-400 font-mono mt-0.5">{txn.asset?.ticker}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleUpdate} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
              {error}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className={labelClass}>ประเภทรายการ</label>
              <select
                className={inputClass}
                value={form.txnType}
                onChange={(e) => setForm({ ...form, txnType: e.target.value })}
              >
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
              <input
                type="date"
                className={inputClass}
                value={form.txnDate}
                onChange={(e) => setForm({ ...form, txnDate: e.target.value })}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className={labelClass}>จำนวน (QTY)</label>
              <input
                type="number"
                step="any"
                className={inputClass}
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                required
              />
            </div>
            <div>
              <label className={labelClass}>ราคา/หน่วย</label>
              <input
                type="number"
                step="any"
                className={inputClass}
                value={form.pricePerUnit}
                onChange={(e) => setForm({ ...form, pricePerUnit: e.target.value })}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className={labelClass}>ค่าธรรมเนียม</label>
              <input
                type="number"
                step="any"
                className={inputClass}
                value={form.fee}
                onChange={(e) => setForm({ ...form, fee: e.target.value })}
              />
            </div>
            <div>
              <label className={labelClass}>ภาษี</label>
              <input
                type="number"
                step="any"
                className={inputClass}
                value={form.taxWithheld}
                onChange={(e) => setForm({ ...form, taxWithheld: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className={labelClass}>บันทึกเพิ่มเติม (Note)</label>
            <input
              type="text"
              className={`${inputClass} font-sans`}
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
          </div>
          <div className="pt-3 flex justify-end gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-colors"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/20"
            >
              {submitting ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
            </button>
          </div>
        </form>
      </div>

      {statusModal && (
        <StatusModal
          isOpen={statusModal.isOpen}
          type={statusModal.type}
          title={statusModal.title}
          description={statusModal.description}
          details={statusModal.details}
          primaryAction={statusModal.primaryAction}
          onClose={() => {
            const wasSuccess = statusModal.type === 'success'
            setStatusModal(null)
            if (wasSuccess) {
              onSuccess()
              onClose()
            }
          }}
          autoCloseMs={statusModal.autoCloseMs}
        />
      )}
    </div>
  )
}

// ─── CLEAR ALL / RESET TRANSACTIONS MODAL ─────────────────────────
function ClearAllTransactionsModal({
  accounts,
  totalCount,
  onClose,
  onSuccess,
}: {
  accounts: any[]
  totalCount: number
  onClose: () => void
  onSuccess: () => void
}) {
  const [scope, setScope] = useState<string>('ALL')
  const [resetCash, setResetCash] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [statusModal, setStatusModal] = useState<{
    isOpen: boolean
    type: 'loading' | 'success' | 'error' | 'warning'
    title: string
    description?: string
    primaryAction?: { label: string; onClick: () => void }
    autoCloseMs?: number
  } | null>(null)

  const isConfirmed = confirmText.trim().toUpperCase() === 'DELETE' || confirmText.trim() === 'ลบ'

  async function handleClearAll() {
    if (!isConfirmed) return
    setSubmitting(true)
    setStatusModal({
      isOpen: true,
      type: 'loading',
      title: 'กำลังล้างข้อมูลธุรกรรม...',
      description: 'ระบบกำลังนำข้อมูลออกจากฐานข้อมูลและรีเซ็ตการคำนวณพอร์ต',
    })

    try {
      const res = await fetch('/api/transactions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clearAll: true,
          accountId: scope,
          resetCashBalance: resetCash,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to clear transactions')

      setStatusModal({
        isOpen: true,
        type: 'success',
        title: 'ล้างข้อมูลเรียบร้อยแล้ว!',
        description: `ลบรายการธุรกรรมทั้งหมด ${data.count ?? 0} รายการสำเร็จแล้ว`,
        autoCloseMs: 3000,
        primaryAction: {
          label: 'ตกลง',
          onClick: () => {
            setStatusModal(null)
            onSuccess()
            onClose()
          },
        },
      })
    } catch (err: any) {
      setStatusModal({
        isOpen: true,
        type: 'error',
        title: 'ล้างข้อมูลไม่สำเร็จ',
        description: err.message || 'เกิดข้อผิดพลาดในการล้างข้อมูล',
        primaryAction: {
          label: 'ปิด',
          onClick: () => setStatusModal(null),
        },
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="glass-panel bg-[#12151C] border border-rose-500/30 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl relative">
        <div className="absolute top-0 right-1/4 -translate-y-1/2 w-64 h-32 bg-rose-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-inner">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base tracking-tight">ล้างข้อมูลประวัติการลงทุน</h3>
              <p className="text-[11px] text-rose-400 font-mono mt-0.5">RESET & CLEAR TRANSACTIONS</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-xs text-rose-200 leading-relaxed">
            <p className="font-bold text-rose-300 flex items-center gap-1.5 mb-1">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              คำเตือน: การล้างข้อมูลจะมีผลทันทีและไม่สามารถกู้คืนได้
            </p>
            การลบนี้จะล้างประวัติธุรกรรม (ซื้อ, ขาย, ปันผล) เพื่อให้คุณเริ่มต้นนำเข้าหรือกรอกข้อมูลใหม่ได้อย่างถูกต้อง
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              เลือกขอบเขตที่ต้องการล้าง *
            </label>
            <select
              className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-rose-500 transition-colors"
              value={scope}
              onChange={(e) => setScope(e.target.value)}
            >
              <option value="ALL">ล้างทุกรายการในทุกบัญชี (ทั้งหมด {totalCount} รายการ)</option>
              {accounts.map((acc: any) => (
                <option key={acc.id} value={acc.id}>
                  เฉพาะบัญชี: {acc.accountName} ({acc.currency})
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-900/60 border border-white/[0.06] cursor-pointer hover:bg-slate-900 transition-colors">
            <input
              type="checkbox"
              checked={resetCash}
              onChange={(e) => setResetCash(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-slate-700 bg-slate-800 text-rose-600 focus:ring-rose-500 cursor-pointer"
            />
            <div className="text-xs">
              <span className="font-bold text-white block">รีเซ็ตยอดเงินคงเหลือในกระเป๋า (Cash Balance) เป็น 0</span>
              <span className="text-slate-400 text-[11px] mt-0.5 block">
                คืนค่ายอดเงินสดในกระเป๋าที่เกี่ยวข้องเพื่อเริ่มต้นใหม่
              </span>
            </div>
          </label>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              พิมพ์คำว่า <span className="text-rose-400 font-mono font-bold">DELETE</span> หรือ <span className="text-rose-400 font-mono font-bold">ลบ</span> เพื่อยืนยัน:
            </label>
            <input
              type="text"
              placeholder="DELETE"
              className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-rose-500 font-mono"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800/80 flex items-center justify-end gap-3 bg-slate-900/40">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-colors"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={handleClearAll}
            disabled={!isConfirmed || submitting}
            className="bg-rose-600 hover:bg-rose-500 text-white disabled:opacity-30 disabled:hover:bg-rose-600 px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-md shadow-rose-600/25 active:scale-95 flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{submitting ? 'กำลังล้างข้อมูล...' : 'ยืนยันล้างข้อมูลทั้งหมด'}</span>
          </button>
        </div>
      </div>

      {statusModal && (
        <StatusModal
          isOpen={statusModal.isOpen}
          type={statusModal.type}
          title={statusModal.title}
          description={statusModal.description}
          primaryAction={statusModal.primaryAction}
          onClose={() => {
            const wasSuccess = statusModal.type === 'success'
            setStatusModal(null)
            if (wasSuccess) {
              onSuccess()
              onClose()
            }
          }}
          autoCloseMs={statusModal.autoCloseMs}
        />
      )}
    </div>
  )
}

// ─── CSV IMPORT MODAL WITH SMART MULTI-WALLET ROUTING ─────────────
function CsvImportModal({
  accounts,
  onClose,
  onSuccess,
}: {
  accounts: any[]
  onClose: () => void
  onSuccess: () => void
}) {
  const usdAccounts = accounts.filter(
    (a) => a.currency === 'USD' || a.accountName.toLowerCase().includes('usd') || a.accountName.toLowerCase().includes('fcd')
  )
  const thbAccounts = accounts.filter(
    (a) => a.currency === 'THB' || a.accountName.toLowerCase().includes('save')
  )

  const [autoRoute, setAutoRoute] = useState(true)
  const [selectedUsdAccountId, setSelectedUsdAccountId] = useState(usdAccounts[0]?.id || '')
  const [selectedThbAccountId, setSelectedThbAccountId] = useState(thbAccounts[0]?.id || accounts[0]?.id || '')
  const [singleAccountId, setSingleAccountId] = useState(accounts[0]?.id || '')

  const [rows, setRows] = useState<any[]>([])
  const [fileName, setFileName] = useState('')
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState('')

  const [statusModal, setStatusModal] = useState<{
    isOpen: boolean
    type: 'loading' | 'success' | 'error' | 'warning'
    title: string
    description?: string
    progressStep?: string
    details?: StatusDetailItem[]
    primaryAction?: { label: string; onClick: () => void }
    autoCloseMs?: number
  } | null>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setError('')

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
          taxWithheld: (r.taxWithheld || r.TaxWithheld || r.tax || '0').toString(),
          note: r.note || r.Note || '',
        }))
        setRows(parsedRows)
      },
      error: (err) => setError(err.message),
    })
  }

  async function handleImport() {
    if (rows.length === 0) return
    setImporting(true)
    setError('')

    setStatusModal({
      isOpen: true,
      type: 'loading',
      title: 'กำลังนำเข้าข้อมูลจาก CSV...',
      description: `กำลังประมวลผลข้อมูล ${rows.length} รายการ`,
      progressStep: autoRoute
        ? 'กำลังแยกกระเป๋าอัตโนมัติ (US ➔ USD, TH ➔ THB)...'
        : 'กำลังบันทึกธุรกรรมลงในบัญชี...',
    })

    try {
      const res = await fetch('/api/transactions/import-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          autoRoute,
          usdAccountId: selectedUsdAccountId,
          thbAccountId: selectedThbAccountId,
          accountId: singleAccountId,
          rows,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Import failed')

      setStatusModal({
        isOpen: true,
        type: 'success',
        title: 'นำเข้าข้อมูลสำเร็จเรียบร้อย!',
        description: 'บันทึกรายการธุรกรรมและแยกกระเป๋าตามสกุลเงินเรียบร้อยแล้ว',
        details: [
          { label: 'นำเข้าสำเร็จ', value: `${data.imported} รายการ`, color: 'text-emerald-400' },
          { label: 'หุ้นสหรัฐฯ (USD)', value: `${data.usdCount ?? 0} รายการ`, color: 'text-indigo-400' },
          { label: 'หุ้นไทย (THB)', value: `${data.thbCount ?? 0} รายการ`, color: 'text-emerald-300' },
          { label: 'ข้ามรายการซ้ำ', value: `${data.skipped ?? 0} รายการ`, color: 'text-amber-400' },
        ],
        autoCloseMs: 3500,
        primaryAction: {
          label: 'ดูรายการทั้งหมด',
          onClick: () => {
            setStatusModal(null)
            onSuccess()
            onClose()
          },
        },
      })
    } catch (err: any) {
      setError(err.message)
      setStatusModal({
        isOpen: true,
        type: 'error',
        title: 'นำเข้าไม่สำเร็จ',
        description: err.message || 'เกิดข้อผิดพลาดในการประมวลผลไฟล์ CSV',
        primaryAction: {
          label: 'ปิด',
          onClick: () => setStatusModal(null),
        },
      })
    } finally {
      setImporting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="glass-panel bg-slate-950/95 border border-slate-700/80 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base tracking-tight">นำเข้ารายการธุรกรรมจาก CSV</h3>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">SMART MULTI-WALLET CSV IMPORT</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
              {error}
            </div>
          )}

          {/* Smart Wallet Routing Toggle */}
          <div className="p-4 rounded-2xl bg-[#181C25] border border-white/[0.08] space-y-3">
            <label className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <Wallet className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white block">แยกกระเป๋าและสกุลเงินอัตโนมัติ (แนะนำ)</span>
                  <span className="text-[11px] text-slate-400 block">
                    หุ้นสหรัฐฯ ➔ กระเป๋า USD, หุ้นไทย ➔ กระเป๋า THB
                  </span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={autoRoute}
                onChange={(e) => setAutoRoute(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
            </label>

            {autoRoute ? (
              <div className="pt-3 border-t border-white/[0.06] grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-1">
                    🇺🇸 กระเป๋าหุ้นสหรัฐฯ (USD)
                  </label>
                  <select
                    className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    value={selectedUsdAccountId}
                    onChange={(e) => setSelectedUsdAccountId(e.target.value)}
                  >
                    {usdAccounts.length > 0 ? (
                      usdAccounts.map((acc: any) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.accountName} ({acc.currency})
                        </option>
                      ))
                    ) : (
                      <option value="">สร้าง Dime! USD อัตโนมัติ</option>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-1">
                    🇹🇭 กระเป๋าหุ้นไทย / เงินสด (THB)
                  </label>
                  <select
                    className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    value={selectedThbAccountId}
                    onChange={(e) => setSelectedThbAccountId(e.target.value)}
                  >
                    {thbAccounts.map((acc: any) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.accountName} ({acc.currency})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <div className="pt-3 border-t border-white/[0.06]">
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  เลือกบัญชีปลายทางเดียวสำหรับทุกรายการ
                </label>
                <select
                  className="w-full bg-slate-900/80 border border-slate-700/80 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  value={singleAccountId}
                  onChange={(e) => setSingleAccountId(e.target.value)}
                >
                  {accounts.map((acc: any) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.accountName} ({acc.currency})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* File Picker */}
          <label className="border-2 border-dashed border-slate-700/80 hover:border-indigo-500/60 rounded-2xl p-7 text-center cursor-pointer transition-colors bg-slate-900/40 block">
            <input type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
            <Upload className="w-7 h-7 text-indigo-400 mx-auto mb-2" />
            <p className="text-xs font-bold text-white">{fileName || 'คลิกเพื่อเลือกไฟล์ CSV จากเครื่องของคุณ'}</p>
            <p className="text-[11px] text-slate-400 font-mono mt-1">
              รองรับคอลัมน์: Date, Ticker, Type, Quantity, Price, Fee, Note
            </p>
          </label>

          {rows.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                ตัวอย่างข้อมูล ({rows.length} แถว)
              </p>
              <div className="border border-slate-800 rounded-xl overflow-hidden max-h-36 overflow-y-auto">
                <table className="w-full text-left text-[11px] font-mono">
                  <thead className="bg-slate-900 text-slate-400 sticky top-0">
                    <tr>
                      <th className="p-2">วันที่</th>
                      <th className="p-2">Ticker</th>
                      <th className="p-2">ประเภท</th>
                      <th className="p-2 text-right">จำนวน</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {rows.slice(0, 4).map((r, i) => (
                      <tr key={i}>
                        <td className="p-2 text-slate-400">{r.txnDate.slice(0, 10)}</td>
                        <td className="p-2 text-white font-bold">{r.ticker}</td>
                        <td className="p-2 text-indigo-400">{r.txnType}</td>
                        <td className="p-2 text-right text-slate-300">{r.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-800 flex justify-end gap-3 bg-slate-900/60">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-colors"
          >
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

      {statusModal && (
        <StatusModal
          isOpen={statusModal.isOpen}
          type={statusModal.type}
          title={statusModal.title}
          description={statusModal.description}
          progressStep={statusModal.progressStep}
          details={statusModal.details}
          primaryAction={statusModal.primaryAction}
          onClose={() => {
            const wasSuccess = statusModal.type === 'success'
            setStatusModal(null)
            if (wasSuccess) {
              onSuccess()
              onClose()
            }
          }}
          autoCloseMs={statusModal.autoCloseMs}
        />
      )}
    </div>
  )
}
