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
  Plus
} from 'lucide-react'

type TransactionType = 'BUY' | 'SELL' | 'DIVIDEND' | 'DEPOSIT' | 'WITHDRAW' | 'FEE'
type Market = 'US' | 'TH' | 'CRYPTO'
type AssetType = 'stock' | 'fund' | 'crypto' | 'bond' | 'gold'

interface Account {
  id: string
  accountName: string
  accountType: string
  currency: string
}

interface ParsedQuickAdd {
  ticker?: string
  txnType?: TransactionType
  quantity?: number
  pricePerUnit?: number
  fee?: number
  note?: string
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
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
  const { data: accountsData } = useSWR('/api/accounts')
  const accounts: Account[] = accountsData?.accounts ?? []

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

  // AI Parser Handler (Fallback rule-based parser if AI service route not yet active)
  async function handleAIParse(e: React.FormEvent) {
    e.preventDefault()
    if (!nlText.trim()) return

    setParsing(true)
    setError('')

    try {
      const res = await fetch('/api/ai-advisor/quick-add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: nlText }),
      })

      if (res.ok) {
        const parsed = (await res.json()) as ParsedQuickAdd
        if (parsed.ticker) {
          setFormData((prev) => ({
            ...prev,
            ticker: parsed.ticker ?? prev.ticker,
            txnType: parsed.txnType ?? prev.txnType,
            quantity: parsed.quantity?.toString() ?? prev.quantity,
            pricePerUnit: parsed.pricePerUnit?.toString() ?? prev.pricePerUnit,
            fee: parsed.fee?.toString() ?? prev.fee,
            note: parsed.note ?? nlText,
          }))
          setTab('manual')
          setSuccessMsg('✨ AI แยกข้อมูลรายการสำเร็จ กรุณาตรวจสอบและกดบันทึก')
          return
        }
      }

      // Local heuristic fallback parser
      const lower = nlText.toLowerCase()
      let type: TransactionType = 'BUY'
      if (lower.includes('ขาย') || lower.includes('sell')) type = 'SELL'
      else if (lower.includes('ปันผล') || lower.includes('dividend')) type = 'DIVIDEND'
      else if (lower.includes('ฝาก') || lower.includes('deposit')) type = 'DEPOSIT'

      const words = nlText.split(/\s+/)
      let foundTicker = ''
      const numbers: number[] = []

      for (const w of words) {
        const num = parseFloat(w.replace(/,/g, ''))
        if (!isNaN(num)) {
          numbers.push(num)
        } else if (/^[A-Za-z0-9.]{2,8}$/.test(w) && !['buy', 'sell', 'stock', 'usd', 'thb'].includes(w.toLowerCase())) {
          foundTicker = w.toUpperCase()
        }
      }

      setFormData((prev) => ({
        ...prev,
        txnType: type,
        ticker: foundTicker || prev.ticker,
        quantity: numbers[0]?.toString() || prev.quantity,
        pricePerUnit: numbers[1]?.toString() || prev.pricePerUnit,
        note: nlText,
      }))

      setTab('manual')
      setSuccessMsg('ระบบแยกข้อมูลเบื้องต้นเรียบร้อย กรุณาตรวจสอบความถูกต้อง')
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'ไม่สามารถวิเคราะห์ข้อความได้'))
    } finally {
      setParsing(false)
    }
  }

  // Submit Transaction
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccessMsg('')

    if (!accountId) {
      setError('กรุณาเลือกบัญชีการลงทุน')
      return
    }
    if (!formData.ticker.trim()) {
      setError('กรุณาระบุ Ticker / ชื่อย่อสินทรัพย์')
      return
    }
    if (quantityNum <= 0) {
      setError('จำนวนต้องมากกว่า 0')
      return
    }
    if (priceNum <= 0 && formData.txnType !== 'DIVIDEND') {
      setError('ราคาต่อหน่วยต้องมากกว่า 0')
      return
    }

    setSubmitting(true)

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

      if (onSuccess) onSuccess()
      onClose()
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'เกิดข้อผิดพลาดในการบันทึก'))
    } finally {
      setSubmitting(false)
    }
  }

  // Common input styles
  const inputClass = "w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-zinc-500 focus:bg-white/10 transition-colors"
  const labelClass = "block text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-2"

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in"
    >
      <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between bg-[#050505]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center text-white">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">บันทึกธุรกรรม</h2>
              <p className="text-[11px] text-zinc-500 font-mono mt-0.5">NEW TRANSACTION</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-zinc-500 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {accountsData && accounts.length === 0 ? (
          <div className="p-10 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-6">
              <Wallet className="w-8 h-8 text-zinc-600" />
            </div>
            <h3 className="text-base font-bold text-white mb-2">ยังไม่มีบัญชีการลงทุน</h3>
            <p className="text-xs text-zinc-500 mb-8 max-w-[280px]">
              คุณจำเป็นต้องมีบัญชีการลงทุนก่อน จึงจะสามารถเพิ่มธุรกรรมได้
            </p>
            <a 
              href="/accounts" 
              onClick={onClose}
              className="bg-white text-black hover:bg-zinc-200 px-6 py-2.5 rounded-xl font-semibold text-sm flex items-center transition-colors"
            >
              สร้างบัญชีลงทุน <ArrowRight className="w-4 h-4 ml-2" />
            </a>
          </div>
        ) : (
          <>
            {/* Tab Switcher */}
            <div className="flex bg-[#050505] p-1.5 gap-1 mx-6 mt-6 rounded-xl border border-white/10">
              <button
                type="button"
                onClick={() => setTab('manual')}
                className={`flex-1 min-h-10 py-1.5 text-xs font-semibold flex items-center justify-center gap-2 rounded-lg transition-all ${
                  tab === 'manual'
                    ? 'bg-white/10 text-white shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>กรอกฟอร์มมาตรฐาน</span>
              </button>
              <button
                type="button"
                onClick={() => setTab('ai')}
                className={`flex-1 min-h-10 py-1.5 text-xs font-semibold flex items-center justify-center gap-2 rounded-lg transition-all ${
                  tab === 'ai'
                    ? 'bg-white/10 text-white shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>พิมพ์ข้อความ (AI)</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-6 overflow-y-auto flex-1 space-y-6">
              {error && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-2 text-xs text-rose-400">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-2 text-xs text-emerald-400">
                  <Check className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* AI NLP TAB */}
              {tab === 'ai' && (
                <form onSubmit={handleAIParse} className="space-y-5">
                  <div>
                    <label className={labelClass}>รายละเอียดธุรกรรม</label>
                    <textarea
                      className={`${inputClass} min-h-[100px] resize-none`}
                      placeholder="เช่น: ซื้อ AAPL 5 หุ้น ที่ราคา 182.5 ดอลลาร์ ค่าธรรมเนียม 1 บัญชี Dime เมื่อวานนี้"
                      value={nlText}
                      onChange={(e) => setNlText(e.target.value)}
                      disabled={parsing}
                      autoFocus
                    />
                  </div>

                  <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-xs text-zinc-500 space-y-2 font-mono">
                    <p className="font-bold text-zinc-400 flex items-center gap-1.5 uppercase tracking-widest">
                      <HelpCircle className="w-3.5 h-3.5" />
                      Examples
                    </p>
                    <p>• ซื้อ NVDA 10 หุ้น 120 USD ค่าคอม 2</p>
                    <p>• ขาย BTC 0.05 ราคา 65000</p>
                    <p>• รับปันผล PTT 1500 บาท</p>
                  </div>

                  <button
                    type="submit"
                    disabled={parsing || !nlText.trim()}
                    className="w-full bg-white text-black hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors"
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
                <form onSubmit={handleSubmit} id="manual-form" className="space-y-5">
                  
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
                          {acc.accountName} ({acc.accountType} — {acc.currency})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Transaction Type & Date */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                      <label className={labelClass}>วันที่ *</label>
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
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="col-span-1">
                      <label className={labelClass}>ตลาด</label>
                      <select
                        className={inputClass}
                        value={formData.market}
                        onChange={(e) => setFormData({ ...formData, market: e.target.value as Market })}
                      >
                        <option value="US">US</option>
                        <option value="TH">TH</option>
                        <option value="CRYPTO">CRYPTO</option>
                      </select>
                    </div>
                    <div className="col-span-1 sm:col-span-2">
                      <label className={labelClass}>TICKER *</label>
                      <input
                        type="text"
                        className={`${inputClass} font-mono uppercase font-bold`}
                        placeholder="AAPL, BTC"
                        value={formData.ticker}
                        onChange={(e) => setFormData({ ...formData, ticker: e.target.value.toUpperCase() })}
                        required
                      />
                    </div>
                  </div>

                  {/* Quantity & Price */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>จำนวน (QTY) *</label>
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
                      <label className={labelClass}>ราคา/หน่วย (PRICE) *</label>
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                      <label className={labelClass}>ภาษี</label>
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
                  <div className="p-4 rounded-xl bg-[#050505] border border-white/5 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                        TOTAL AMOUNT
                      </p>
                      <p className="text-[10px] text-zinc-600 font-mono mt-0.5">
                        (QTY × PRICE) + FEE - TAX
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-xl font-bold text-white font-mono tabular-nums">
                        {isNaN(Number(totalAmount)) ? '0.00' : Number(totalAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  {/* Note */}
                  <div>
                    <label className={labelClass}>บันทึกเพิ่มเติม (Note)</label>
                    <input
                      type="text"
                      className={inputClass}
                      placeholder="รายละเอียดเพิ่มเติม (optional)"
                      value={formData.note}
                      onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                    />
                  </div>
                </form>
              )}
            </div>

            {/* Modal Footer */}
            {tab === 'manual' && (
              <div className="px-6 py-5 border-t border-white/5 bg-[#050505] flex items-center justify-end gap-3 sticky bottom-0">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
                  disabled={submitting}
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  form="manual-form"
                  disabled={submitting || accounts.length === 0}
                  className="bg-white text-black hover:bg-zinc-200 disabled:opacity-50 px-6 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors min-w-[120px] justify-center"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>บันทึก...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
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
