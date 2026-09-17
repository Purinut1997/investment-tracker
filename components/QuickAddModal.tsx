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

      // Local heuristic fallback parser (e.g. "ซื้อ AAPL 10 หุ้น ที่ 150")
      const lower = nlText.toLowerCase()
      let type: TransactionType = 'BUY'
      if (lower.includes('ขาย') || lower.includes('sell')) type = 'SELL'
      else if (lower.includes('ปันผล') || lower.includes('dividend')) type = 'DIVIDEND'
      else if (lower.includes('ฝาก') || lower.includes('deposit')) type = 'DEPOSIT'

      // Match numbers and symbols
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
      // Step 1: Ensure asset exists or create it
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

      // Step 2: Create Transaction
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

      // Revalidate SWR caches
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

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-[#050609]/80 backdrop-blur-sm animate-in fade-in"
    >
      <div className="bg-[#11141b] border border-white/[0.12] rounded-2xl sm:rounded-3xl w-full max-w-xl overflow-hidden shadow-[0_32px_96px_rgba(0,0,0,0.65)] flex flex-col max-h-[min(760px,calc(100dvh-24px))]">
        {/* Modal Header */}
        <div className="px-5 py-4 sm:px-6 sm:py-5 border-b border-white/[0.08] flex items-center justify-between bg-[#151821]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--accent-soft)] border border-[var(--border-accent)] flex items-center justify-center text-[var(--accent)]">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight leading-tight">บันทึกธุรกรรม</h2>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">เพิ่มรายการลงทุนเข้าสู่พอร์ต</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[var(--text-muted)] hover:text-white hover:bg-white/[0.08] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {accountsData && accounts.length === 0 ? (
          <div className="p-8 sm:p-12 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center mb-5">
              <Wallet className="w-8 h-8 text-zinc-400" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">ยังไม่มีบัญชีการลงทุน</h3>
            <p className="text-sm text-[var(--text-muted)] mb-8 max-w-[280px]">
              คุณจำเป็นต้องมีบัญชีการลงทุนก่อน จึงจะสามารถเพิ่มธุรกรรมได้
            </p>
            <a 
              href="/accounts" 
              onClick={onClose}
              className="btn btn-primary text-sm px-6 py-2.5 w-full sm:w-auto shadow-[0_4px_16px_rgba(124,58,237,0.4)]"
            >
              สร้างบัญชีลงทุน <ArrowRight className="w-4 h-4 ml-2 inline" />
            </a>
          </div>
        ) : (
          <>
            {/* Tab Switcher */}
        <div className="flex bg-[#0b0d12] p-1 gap-1 mx-5 sm:mx-6 mt-5 rounded-xl border border-white/[0.07]">
          <button
            type="button"
            onClick={() => setTab('manual')}
            className={`flex-1 min-h-10 py-2 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 rounded-lg transition-all ${
              tab === 'manual'
                ? 'bg-white/[0.1] text-white'
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
          >
            <Layers className="w-4 h-4 text-[var(--violet)]" />
            <span>กรอกฟอร์มมาตรฐาน</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('ai')}
            className={`flex-1 min-h-10 py-2 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 rounded-lg transition-all ${
              tab === 'ai'
                ? 'bg-white/[0.1] text-white'
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
          >
            <Sparkles className="w-4 h-4 text-[var(--violet)]" />
            <span>พิมพ์ข้อความ / AI สรุป</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="px-5 py-5 sm:px-6 sm:py-6 overflow-y-auto flex-1 space-y-5">
          {error && (
            <div className="alert alert-danger flex items-start gap-2 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="alert alert-success flex items-start gap-2 text-xs">
              <Check className="w-4 h-4 shrink-0 text-[var(--green-400)] mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* AI NLP TAB */}
          {tab === 'ai' && (
            <form onSubmit={handleAIParse} className="space-y-4">
              <div>
                <label className="label">
                  พิมพ์ประโยคธุรกรรมตามธรรมชาติ (ภาษาไทยหรืออังกฤษ)
                </label>
                <textarea
                  className="input min-h-[90px] text-sm"
                  placeholder="เช่น: ซื้อ AAPL 5 หุ้น ที่ราคา 182.5 ดอลลาร์ ค่าธรรมเนียม 1 บัญชี Dime เมื่อวานนี้"
                  value={nlText}
                  onChange={(e) => setNlText(e.target.value)}
                  disabled={parsing}
                  autoFocus
                />
              </div>

              <div className="p-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] text-xs text-[var(--text-secondary)] space-y-1">
                <p className="font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-[var(--cyan-400)]" />
                  ตัวอย่างที่ระบบเข้าใจได้:
                </p>
                <p>• &quot;ซื้อ NVDA 10 หุ้น 120 USD ค่าคอม 2&quot;</p>
                <p>• &quot;ขาย BTC 0.05 ราคา 65000 ใน Bitkub&quot;</p>
                <p>• &quot;รับปันผล PTT 1500 บาท บัญชี InnovestX&quot;</p>
              </div>

              <button
                type="submit"
                disabled={parsing || !nlText.trim()}
                className="btn btn-primary w-full py-3 flex items-center justify-center gap-2"
              >
                {parsing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>AI กำลังวิเคราะห์ข้อมูล...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>วิเคราะห์และเติมข้อมูลในฟอร์ม</span>
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
                <label className="label">บัญชีการเงิน *</label>
                {accounts.length === 0 ? (
                  <div className="text-xs text-amber-400 bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20">
                    ยังไม่มีบัญชีการลงทุน กรุณาสร้างบัญชีที่หน้า /accounts ก่อน
                  </div>
                ) : (
                  <select
                    className="select text-sm"
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
                )}
              </div>

              {/* Transaction Type & Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">ประเภทรายการ *</label>
                  <select
                    className="select text-sm"
                    value={formData.txnType}
                    onChange={(e) => setFormData({ ...formData, txnType: e.target.value as TransactionType })}
                  >
                    <option value="BUY">🟢 ซื้อ (BUY)</option>
                    <option value="SELL">🔴 ขาย (SELL)</option>
                    <option value="DIVIDEND">💰 ปันผล (DIVIDEND)</option>
                    <option value="DEPOSIT">📥 ฝากเงิน (DEPOSIT)</option>
                    <option value="WITHDRAW">📤 ถอนเงิน (WITHDRAW)</option>
                    <option value="FEE">🧾 ค่าธรรมเนียม (FEE)</option>
                  </select>
                </div>
                <div>
                  <label className="label">วันที่ทำรายการ *</label>
                  <input
                    type="date"
                    className="input text-sm"
                    value={formData.txnDate}
                    onChange={(e) => setFormData({ ...formData, txnDate: e.target.value })}
                    required
                  />
                </div>
              </div>

              {/* Ticker, Market & Asset Type */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="col-span-1">
                  <label className="label">ตลาด</label>
                  <select
                    className="select text-xs"
                    value={formData.market}
                    onChange={(e) => setFormData({ ...formData, market: e.target.value as Market })}
                  >
                    <option value="US">🇺🇸 หุ้น US</option>
                    <option value="TH">🇹🇭 หุ้นไทย (SET)</option>
                    <option value="CRYPTO">🪙 Crypto</option>
                  </select>
                </div>
                <div className="col-span-1 sm:col-span-2">
                  <label className="label">Ticker / สัญลักษณ์ *</label>
                  <input
                    type="text"
                    className="input uppercase text-sm font-semibold"
                    placeholder="เช่น AAPL, PTT, BTC"
                    value={formData.ticker}
                    onChange={(e) => setFormData({ ...formData, ticker: e.target.value.toUpperCase() })}
                    required
                  />
                </div>
              </div>

              {/* Quantity & Price */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">จำนวนหน่วย (Quantity) *</label>
                  <input
                    type="number"
                    step="any"
                    className="input text-sm"
                    placeholder="0.00"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="label">ราคาต่อหน่วย (Price) *</label>
                  <input
                    type="number"
                    step="any"
                    className="input text-sm"
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
                  <label className="label">ค่าคอม/ธรรมเนียม</label>
                  <input
                    type="number"
                    step="any"
                    className="input text-sm"
                    placeholder="0.00"
                    value={formData.fee}
                    onChange={(e) => setFormData({ ...formData, fee: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">ภาษีหัก ณ ที่จ่าย</label>
                  <input
                    type="number"
                    step="any"
                    className="input text-sm"
                    placeholder="0.00"
                    value={formData.taxWithheld}
                    onChange={(e) => setFormData({ ...formData, taxWithheld: e.target.value })}
                  />
                </div>
              </div>

              {/* Calculated Total Box */}
              <div className="p-4 rounded-xl bg-[#191d27] border border-white/[0.09] flex items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] text-[var(--text-muted)] font-medium">
                    ยอดรวมคำนวณอัตโนมัติ (Total Amount)
                  </p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    (จำนวน × ราคา) + ค่าธรรมเนียม - ภาษี
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xl font-extrabold text-[var(--violet)] tabular-nums">
                    {isNaN(Number(totalAmount)) ? '0.00' : Number(totalAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="label">บันทึกเพิ่มเติม (Optional)</label>
                <input
                  type="text"
                  className="input text-sm"
                  placeholder="เช่น DCA ประจำเดือน, รับปันผลงวด 1"
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                />
              </div>
            </form>
          )}
        </div>

        {/* Modal Footer */}
        {tab === 'manual' && (
          <div className="px-5 py-4 sm:px-6 border-t border-white/[0.08] bg-[#151821] flex items-center justify-end gap-3 sticky bottom-0">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-ghost text-xs sm:text-sm py-2 px-4"
              disabled={submitting}
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              form="manual-form"
              disabled={submitting || accounts.length === 0}
              className="btn btn-primary text-xs sm:text-sm py-2.5 px-5 flex items-center gap-2 min-w-[142px]"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>กำลังบันทึก...</span>
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
