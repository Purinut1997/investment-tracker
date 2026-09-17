'use client'

import React, { useState, useEffect } from 'react'
import useSWR, { mutate } from 'swr'
import {
  X,
  Sparkles,
  ArrowRight,
  Check,
  AlertCircle,
  Loader2,
  Layers,
  Wallet,
  HelpCircle,
  Plus,
} from 'lucide-react'
import {
  ACCOUNT_TYPES,
  accountTypeLabel,
  getErrorMessage,
  parseAccountsPayload,
  type AccountTypeValue,
} from '@/lib/accounts'

type TransactionType = 'BUY' | 'SELL' | 'DIVIDEND' | 'DEPOSIT' | 'WITHDRAW' | 'FEE'
type Market = 'US' | 'TH' | 'CRYPTO'
type AssetType = 'stock' | 'fund' | 'crypto' | 'bond' | 'gold'

interface ParsedQuickAdd {
  ticker?: string
  txnType?: TransactionType
  quantity?: number
  pricePerUnit?: number
  fee?: number
  note?: string
}

interface QuickAddModalProps {
  onClose: () => void
  onSuccess?: () => void
}

export function QuickAddModal({ onClose, onSuccess }: QuickAddModalProps) {
  const [tab, setTab] = useState<'ai' | 'manual'>('manual')
  const [nlText, setNlText] = useState('')
  const [parsing, setParsing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Accounts list
  const { data: accountsData, isLoading: accountsLoading } = useSWR('/api/accounts')
  const accounts = parseAccountsPayload(accountsData)

  const [creatingAccount, setCreatingAccount] = useState(false)
  const [newAccountName, setNewAccountName] = useState('')
  const [newAccountType, setNewAccountType] = useState<AccountTypeValue>('brokerage')
  const [newAccountCurrency, setNewAccountCurrency] = useState('THB')

  // Manual Form State
  const [formData, setFormData] = useState({
    accountId: '',
    ticker: '',
    market: 'US' as Market,
    assetType: 'stock' as AssetType,
    assetName: '',
    txnDate: new Date().toISOString().split('T')[0],
    txnType: 'BUY' as TransactionType,
    quantity: '',
    pricePerUnit: '',
    fee: '0',
    taxWithheld: '0',
    note: '',
  })

  const accountId = formData.accountId || accounts[0]?.id || ''

  // Computed total
  const quantityNum = parseFloat(formData.quantity) || 0
  const priceNum = parseFloat(formData.pricePerUnit) || 0
  const feeNum = parseFloat(formData.fee) || 0
  const taxNum = parseFloat(formData.taxWithheld) || 0
  const totalAmount = (quantityNum * priceNum + feeNum - taxNum).toFixed(2)

  // ESC key dismiss and body scroll lock
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = originalOverflow
    }
  }, [onClose])

  async function handleCreateAccount(e: React.FormEvent) {
    e.preventDefault()
    if (!newAccountName.trim()) {
      setError('กรุณาระบุชื่อบัญชี')
      return
    }

    setCreatingAccount(true)
    setError('')

    try {
      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountName: newAccountName.trim(),
          accountType: newAccountType,
          currency: newAccountCurrency,
        }),
      })
      const created = await res.json() as { id?: string; error?: string }
      if (!res.ok || !created.id) throw new Error(created.error || 'สร้างบัญชีไม่สำเร็จ')

      await mutate('/api/accounts')
      setFormData((prev) => ({ ...prev, accountId: created.id as string }))
      setSuccessMsg('สร้างบัญชีแล้ว กรอกธุรกรรมต่อได้เลย')
      setNewAccountName('')
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'สร้างบัญชีไม่สำเร็จ'))
    } finally {
      setCreatingAccount(false)
    }
  }

  // AI Parser Handler
  async function handleAIParse(e: React.FormEvent) {
    e.preventDefault()
    if (!nlText.trim()) return

    setParsing(true)
    setError('')
    setSuccessMsg('')

    try {
      const res = await fetch('/api/ai/parse-transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: nlText }),
      })

      if (!res.ok) {
        throw new Error('AI Parser ยังไม่พร้อมทำงาน กรุณากรอกแบบฟอร์มด้วยตนเอง')
      }

      const parsed: ParsedQuickAdd = await res.json()

      setFormData((prev) => ({
        ...prev,
        ticker: parsed.ticker || prev.ticker,
        txnType: parsed.txnType || prev.txnType,
        quantity: parsed.quantity?.toString() || prev.quantity,
        pricePerUnit: parsed.pricePerUnit?.toString() || prev.pricePerUnit,
        fee: parsed.fee?.toString() || prev.fee,
        note: parsed.note || prev.note,
      }))

      setSuccessMsg('AI วิเคราะห์ข้อมูลเรียบร้อยแล้ว ตรวจสอบและกดยืนยันบันทึก')
      setTab('manual')
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'เกิดข้อผิดพลาดในการวิเคราะห์ข้อความ'))
    } finally {
      setParsing(false)
    }
  }

  // Handle Manual Form Submit
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formData.ticker.trim()) {
      setError('กรุณาระบุชื่อย่อสินทรัพย์ (Ticker)')
      return
    }
    if (quantityNum <= 0) {
      setError('จำนวนสินทรัพย์ต้องมากกว่า 0')
      return
    }
    if (priceNum < 0) {
      setError('ราคาต่อหน่วยต้องไม่ติดลบ')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const assetRes = await fetch('/api/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker: formData.ticker.trim().toUpperCase(),
          market: formData.market,
          assetName: formData.assetName.trim() || formData.ticker.trim().toUpperCase(),
          assetType: formData.assetType,
          currency: formData.market === 'US' ? 'USD' : 'THB',
        }),
      })

      if (!assetRes.ok) {
        const errJson = await assetRes.json()
        throw new Error(errJson.error || 'ไม่สามารถบันทึกข้อมูลสินทรัพย์ได้')
      }

      const assetData = await assetRes.json()

      const txnRes = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId,
          assetId: assetData.id,
          txnDate: new Date(formData.txnDate).toISOString(),
          txnType: formData.txnType,
          quantity: quantityNum,
          pricePerUnit: priceNum,
          fee: feeNum,
          taxWithheld: taxNum,
          note: formData.note || undefined,
          source: tab === 'ai' ? 'quick_add' : 'manual',
        }),
      })

      if (!txnRes.ok) {
        const errJson = await txnRes.json()
        throw new Error(errJson.error || 'บันทึกธุรกรรมล้มเหลว')
      }

      mutate('/api/transactions')
      mutate('/api/accounts')
      mutate('/api/portfolio/summary')
      mutate('/api/portfolio/holdings')

      if (onSuccess) onSuccess()
      onClose()
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'เกิดข้อผิดพลาดในการบันทึก'))
    } finally {
      setSubmitting(false)
    }
  }

  // Common input styles
  const inputClass = "w-full bg-[#181C25] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
  const labelClass = "block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1.5"

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in"
    >
      <div className="bg-[#12151C] border border-white/10 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="px-6 py-4.5 border-b border-white/[0.08] flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white tracking-tight">บันทึกรายการธุรกรรม</h2>
              <p className="text-xs text-zinc-400 mt-0.5">เพิ่มธุรกรรมเข้าสู่พอร์ตโฟลิโอ</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {accountsLoading ? (
          <div className="p-10 flex flex-col items-center justify-center text-center text-zinc-400">
            <Loader2 className="w-8 h-8 animate-spin mb-3 text-indigo-400" />
            <p className="text-xs">กำลังโหลดบัญชี...</p>
          </div>
        ) : accounts.length === 0 ? (
          <form onSubmit={handleCreateAccount} className="p-8 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#181C25] border border-white/10 flex items-center justify-center mb-5 text-zinc-400">
              <Wallet className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-white mb-2">ยังไม่มีบัญชีการลงทุน</h3>
            <p className="text-xs text-zinc-400 mb-6 max-w-[320px]">
              สร้างบัญชีก่อนแล้วกลับมากรอกธุรกรรมต่อในหน้าต่างนี้ โดยไม่ต้องออกจากขั้นตอน
            </p>

            {error && (
              <div className="w-full mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-2 text-xs text-rose-400 text-left">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            <div className="w-full space-y-3 text-left">
              <div>
                <label className={labelClass}>ชื่อบัญชี *</label>
                <input
                  type="text"
                  className={inputClass}
                  placeholder="เช่น Dime, Bitkub"
                  value={newAccountName}
                  onChange={(e) => setNewAccountName(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className={labelClass}>ประเภทบัญชี</label>
                <select
                  className={inputClass}
                  value={newAccountType}
                  onChange={(e) => setNewAccountType(e.target.value as AccountTypeValue)}
                >
                  {ACCOUNT_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>สกุลเงิน</label>
                <select
                  className={inputClass}
                  value={newAccountCurrency}
                  onChange={(e) => setNewAccountCurrency(e.target.value)}
                >
                  <option value="THB">บาท (THB)</option>
                  <option value="USD">ดอลลาร์สหรัฐ (USD)</option>
                  <option value="EUR">ยูโร (EUR)</option>
                  <option value="SGD">ดอลลาร์สิงคโปร์ (SGD)</option>
                  <option value="JPY">เยน (JPY)</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={creatingAccount}
              className="mt-6 w-full bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl font-medium text-xs flex items-center justify-center gap-2 transition-colors shadow-lg shadow-indigo-600/25"
            >
              {creatingAccount ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  กำลังสร้างบัญชี...
                </>
              ) : (
                <>
                  สร้างบัญชีแล้วทำธุรกรรมต่อ <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>
        ) : (
          <>
            {/* Tab Switcher */}
            <div className="flex bg-[#181C25] p-1.5 gap-1.5 mx-6 mt-5 rounded-xl border border-white/[0.06]">
              <button
                type="button"
                onClick={() => setTab('manual')}
                className={`flex-1 min-h-9 py-1.5 text-xs font-medium flex items-center justify-center gap-2 rounded-lg transition-all ${
                  tab === 'manual'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>กรอกฟอร์มมาตรฐาน</span>
              </button>
              <button
                type="button"
                onClick={() => setTab('ai')}
                className={`flex-1 min-h-9 py-1.5 text-xs font-medium flex items-center justify-center gap-2 rounded-lg transition-all ${
                  tab === 'ai'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>พิมพ์ข้อความด้วย AI</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-5 overflow-y-auto flex-1 space-y-5">
              {error && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-2 text-xs text-rose-400">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                  <span>{error}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-2 text-xs text-emerald-400">
                  <Check className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* AI NLP TAB */}
              {tab === 'ai' && (
                <form onSubmit={handleAIParse} className="space-y-4">
                  <div>
                    <label className={labelClass}>รายละเอียดธุรกรรม (ภาษาธรรมชาติ)</label>
                    <textarea
                      className={`${inputClass} min-h-[100px] resize-none`}
                      placeholder="เช่น: ซื้อ AAPL 5 หุ้น ที่ราคา 182.5 ดอลลาร์ ค่าธรรมเนียม 1 บัญชี Dime เมื่อวานนี้"
                      value={nlText}
                      onChange={(e) => setNlText(e.target.value)}
                      disabled={parsing}
                      autoFocus
                    />
                  </div>

                  <div className="p-3.5 rounded-xl bg-[#181C25] border border-white/[0.06] text-xs text-zinc-400 space-y-1.5">
                    <p className="font-semibold text-indigo-400 flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
                      <HelpCircle className="w-3.5 h-3.5" />
                      ตัวอย่างข้อความ
                    </p>
                    <p>• ซื้อ NVDA 10 หุ้น 120 USD ค่าคอม 2</p>
                    <p>• ขาย BTC 0.05 ราคา 65000</p>
                    <p>• รับปันผล PTT 1500 บาท</p>
                  </div>

                  <button
                    type="submit"
                    disabled={parsing || !nlText.trim()}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 disabled:cursor-not-allowed py-2.5 rounded-xl font-medium text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/25"
                  >
                    {parsing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>AI กำลังวิเคราะห์ข้อมูล...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>วิเคราะห์ข้อมูลด้วย AI</span>
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* MANUAL FORM TAB */}
              {tab === 'manual' && (
                <form onSubmit={handleSubmit} id="manual-form" className="space-y-4">
                  
                  {/* Account Selection */}
                  <div>
                    <label className={labelClass}>บัญชีการเงิน *</label>
                    <select
                      className={inputClass}
                      value={accountId}
                      onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
                      required
                    >
                      {accounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.accountName} ({accountTypeLabel(acc.accountType)} — {acc.currency})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Transaction Type & Date */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className={labelClass}>ประเภทรายการ *</label>
                      <select
                        className={inputClass}
                        value={formData.txnType}
                        onChange={(e) => setFormData({ ...formData, txnType: e.target.value as TransactionType })}
                      >
                        <option value="BUY">ซื้อ (BUY)</option>
                        <option value="SELL">ขาย (SELL)</option>
                        <option value="DIVIDEND">ปันผล (DIVIDEND)</option>
                        <option value="DEPOSIT">ฝากเงิน (DEPOSIT)</option>
                        <option value="WITHDRAW">ถอนเงิน (WITHDRAW)</option>
                        <option value="FEE">ค่าธรรมเนียม (FEE)</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>วันที่ทำรายการ *</label>
                      <input
                        type="date"
                        className={inputClass}
                        value={formData.txnDate}
                        onChange={(e) => setFormData({ ...formData, txnDate: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  {/* Ticker & Market */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    <div className="col-span-1">
                      <label className={labelClass}>ตลาด</label>
                      <select
                        className={inputClass}
                        value={formData.market}
                        onChange={(e) => setFormData({ ...formData, market: e.target.value as Market })}
                      >
                        <option value="US">หุ้นสหรัฐ</option>
                        <option value="TH">หุ้นไทย / กองทุน</option>
                        <option value="CRYPTO">คริปโต</option>
                      </select>
                    </div>
                    <div className="col-span-1 sm:col-span-2">
                      <label className={labelClass}>ชื่อย่อสินทรัพย์ *</label>
                      <input
                        type="text"
                        className={`${inputClass} font-mono uppercase font-semibold`}
                        placeholder="AAPL, BTC, SCB"
                        value={formData.ticker}
                        onChange={(e) => setFormData({ ...formData, ticker: e.target.value.toUpperCase() })}
                        required
                      />
                    </div>
                  </div>

                  {/* Quantity & Price */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className={labelClass}>จำนวนหุ้น/หน่วย *</label>
                      <input
                        type="number"
                        step="any"
                        className={`${inputClass} font-mono`}
                        placeholder="0.00"
                        value={formData.quantity}
                        onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <label className={labelClass}>ราคาต่อหน่วย *</label>
                      <input
                        type="number"
                        step="any"
                        className={`${inputClass} font-mono`}
                        placeholder="0.00"
                        value={formData.pricePerUnit}
                        onChange={(e) => setFormData({ ...formData, pricePerUnit: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  {/* Fee & Tax */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className={labelClass}>ค่าธรรมเนียม</label>
                      <input
                        type="number"
                        step="any"
                        className={`${inputClass} font-mono`}
                        placeholder="0.00"
                        value={formData.fee}
                        onChange={(e) => setFormData({ ...formData, fee: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>ภาษีหัก ณ ที่จ่าย</label>
                      <input
                        type="number"
                        step="any"
                        className={`${inputClass} font-mono`}
                        placeholder="0.00"
                        value={formData.taxWithheld}
                        onChange={(e) => setFormData({ ...formData, taxWithheld: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Calculated Total Box */}
                  <div className="p-4 rounded-xl bg-[#181C25] border border-white/[0.06] flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[11px] text-zinc-400 font-semibold uppercase tracking-wider">
                        ยอดรวมโดยประมาณ
                      </p>
                      <p className="text-[11px] text-zinc-500 font-mono mt-0.5">
                        (จำนวน × ราคา) + ค่าธรรมเนียม - ภาษี
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-xl font-bold text-white font-mono tabular-nums">
                        ฿{isNaN(Number(totalAmount)) ? '0.00' : Number(totalAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  {/* Note */}
                  <div>
                    <label className={labelClass}>บันทึกเพิ่มเติม</label>
                    <input
                      type="text"
                      className={inputClass}
                      placeholder="เช่น DCA ประจำเดือน, ซื้อตามแผน"
                      value={formData.note}
                      onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                    />
                  </div>
                </form>
              )}
            </div>

            {/* Modal Footer */}
            {tab === 'manual' && (
              <div className="px-6 py-4 border-t border-white/[0.08] bg-white/[0.02] flex items-center justify-end gap-3 sticky bottom-0">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white transition-colors"
                  disabled={submitting}
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  form="manual-form"
                  disabled={submitting || accounts.length === 0}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 px-5 py-2 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all shadow-lg shadow-indigo-600/25 min-w-[120px] justify-center"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>กำลังบันทึก...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>บันทึกรายการ</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
