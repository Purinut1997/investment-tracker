'use client'

import React, { useState, useEffect, useRef } from 'react'
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
  UploadCloud,
  Image as ImageIcon,
  Trash2,
  Calendar,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Coins,
  CheckSquare,
  Square,
  Edit2,
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

interface ExtractedTxn {
  id: string
  selected: boolean
  txnType: TransactionType
  ticker: string
  assetName: string
  market: Market
  assetType: AssetType
  quantity: number
  pricePerUnit: number
  fee: number
  taxWithheld: number
  totalAmount: number
  currency: string
  txnDate: string
  matchedAccountId?: string
  accountName: string
  note?: string
  confidence?: number
}

interface ExtractedCash {
  matchedAccountId?: string
  accountName: string
  accountType: AccountTypeValue
  currency: string
  cashAmount: number
  accruedInterest: number
  interestDays?: number | null
  balanceDate?: string
  selected: boolean
}

interface QuickAddModalProps {
  onClose: () => void
  onSuccess?: () => void
  initialTab?: 'photos' | 'ai' | 'manual'
}

export function QuickAddModal({ onClose, onSuccess, initialTab = 'photos' }: QuickAddModalProps) {
  const [tab, setTab] = useState<'photos' | 'ai' | 'manual'>(initialTab)
  const [nlText, setNlText] = useState('')
  const [parsing, setParsing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Multi-Image State
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ name: string; size: number; base64: string; mimeType: string }>>([])
  const [extractedTxns, setExtractedTxns] = useState<ExtractedTxn[]>([])
  const [extractedCash, setExtractedCash] = useState<ExtractedCash[]>([])
  const [aiSummaryText, setAiSummaryText] = useState('')
  const [hasExtracted, setHasExtracted] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

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

  // Computed total for manual form
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

  // Clipboard Paste listener for screenshots (Ctrl+V)
  useEffect(() => {
    function handlePaste(e: ClipboardEvent) {
      if (tab !== 'photos') return
      const items = e.clipboardData?.items
      if (!items) return

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile()
          if (file) {
            processImageFile(file)
          }
        }
      }
    }

    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [tab])

  function processImageFile(file: File) {
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      setUploadedFiles((prev) => [
        ...prev,
        {
          name: file.name || `screenshot-${Date.now()}.png`,
          size: file.size,
          base64: result,
          mimeType: file.type || 'image/jpeg',
        },
      ])
      setError('')
    }
    reader.readAsDataURL(file)
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return
    Array.from(files).forEach(processImageFile)
  }

  function removeFile(index: number) {
    setUploadedFiles((prev) => prev.filter((_, idx) => idx !== index))
  }

  function clearAllFiles() {
    setUploadedFiles([])
    setExtractedTxns([])
    setExtractedCash([])
    setHasExtracted(false)
    setAiSummaryText('')
  }

  // Multi-Image Extraction AI Handler
  async function handleAnalyzeMultiImages() {
    if (uploadedFiles.length === 0) {
      setError('กรุณาเลือกรูปภาพสลิปอย่างน้อย 1 ภาพ')
      return
    }

    setParsing(true)
    setError('')
    setSuccessMsg('')

    try {
      const res = await fetch('/api/ai/extract-slips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images: uploadedFiles.map((f) => ({ data: f.base64, mimeType: f.mimeType })),
        }),
      })

      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || 'การวิเคราะห์ภาพถ่ายล้มเหลว')
      }

      const txns: ExtractedTxn[] = (json.data?.transactions || []).map((t: any, i: number) => ({
        id: t.id || `txn_${i + 1}`,
        selected: true,
        txnType: t.txnType || 'BUY',
        ticker: t.ticker || 'UNKNOWN',
        assetName: t.assetName || t.ticker || 'Asset',
        market: t.market || 'US',
        assetType: t.assetType || 'stock',
        quantity: Number(t.quantity || 0),
        pricePerUnit: Number(t.pricePerUnit || 0),
        fee: Number(t.fee || 0),
        taxWithheld: Number(t.taxWithheld || 0),
        totalAmount: Number(t.totalAmount || 0),
        currency: t.currency || 'USD',
        txnDate: t.txnDate || new Date().toISOString(),
        matchedAccountId: t.matchedAccountId || accounts[0]?.id || '',
        accountName: t.accountName || 'Dime! USD',
        note: t.note || '',
        confidence: t.confidence || 0.9,
      }))

      const cash: ExtractedCash[] = (json.data?.cashBalances || []).map((c: any) => ({
        matchedAccountId: c.matchedAccountId || accounts[0]?.id || '',
        accountName: c.accountName || 'Dime! Save',
        accountType: c.accountType || 'bank',
        currency: c.currency || 'THB',
        cashAmount: Number(c.cashAmount || 0),
        accruedInterest: Number(c.accruedInterest || 0),
        interestDays: c.interestDays ?? 104,
        balanceDate: c.balanceDate || new Date().toISOString(),
        selected: true,
      }))

      setExtractedTxns(txns)
      setExtractedCash(cash)
      setAiSummaryText(json.data?.summary || `พบ ${txns.length} รายการธุรกรรม และ ${cash.length} บัญชีเงินสด`)
      setHasExtracted(true)

      if (txns.length === 0 && cash.length === 0) {
        setError('ไม่พบข้อมูลธุรกรรมหรือเงินสดในภาพที่ส่งมา กรุณาตรวจสอบความคมชัดของภาพ')
      }
    } catch (err: any) {
      setError(getErrorMessage(err, 'เกิดข้อผิดพลาดในการวิเคราะห์สลิป'))
    } finally {
      setParsing(false)
    }
  }

  // Batch Save Handler
  async function handleBatchSave() {
    const selectedTxns = extractedTxns.filter((t) => t.selected)
    const selectedCash = extractedCash.filter((c) => c.selected)

    if (selectedTxns.length === 0 && selectedCash.length === 0) {
      setError('กรุณาเลือกรายการที่ต้องการบันทึกอย่างน้อย 1 รายการ')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const res = await fetch('/api/transactions/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactions: selectedTxns.map((t) => ({
            accountId: t.matchedAccountId || undefined,
            accountName: t.accountName,
            currency: t.currency,
            ticker: t.ticker,
            assetName: t.assetName,
            market: t.market,
            assetType: t.assetType,
            txnDate: t.txnDate,
            txnType: t.txnType,
            quantity: t.quantity,
            pricePerUnit: t.pricePerUnit,
            fee: t.fee,
            taxWithheld: t.taxWithheld,
            totalAmount: t.totalAmount,
            note: t.note,
          })),
          cashBalances: selectedCash.map((c) => ({
            accountId: c.matchedAccountId || undefined,
            accountName: c.accountName,
            currency: c.currency,
            accountType: c.accountType,
            cashAmount: c.cashAmount,
            accruedInterest: c.accruedInterest,
            interestDays: c.interestDays,
            balanceDate: c.balanceDate,
          })),
          updateCashBalances: true,
        }),
      })

      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || 'บันทึกรายการแบบกลุ่มล้มเหลว')
      }

      // Revalidate all caches
      mutate('/api/transactions')
      mutate('/api/accounts')
      mutate('/api/cash-wallet')
      mutate('/api/portfolio/summary')
      mutate('/api/portfolio/holdings')

      if (onSuccess) onSuccess()
      onClose()
    } catch (err: any) {
      setError(getErrorMessage(err, 'เกิดข้อผิดพลาดในการบันทึกรายการ'))
    } finally {
      setSubmitting(false)
    }
  }

  // Account creation handler
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
      const created = (await res.json()) as { id?: string; error?: string }
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

  // Single NLP AI Parser Handler
  async function handleSingleAIParse(e: React.FormEvent) {
    e.preventDefault()
    if (!nlText.trim()) return

    setParsing(true)
    setError('')
    setSuccessMsg('')

    try {
      const res = await fetch('/api/ai-advisor/quick-add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: nlText }),
      })

      if (!res.ok) {
        throw new Error('AI Parser ยังไม่พร้อมทำงาน กรุณากรอกแบบฟอร์มด้วยตนเอง')
      }

      const parsed = await res.json()

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
  async function handleManualSubmit(e: React.FormEvent) {
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
      mutate('/api/cash-wallet')
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

  const inputClass =
    'w-full bg-[#181C25] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors'
  const labelClass = 'block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1.5'

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in"
    >
      <div className="bg-[#12151C] border border-white/10 rounded-2xl w-full max-w-2xl lg:max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white tracking-tight">บันทึกรายการธุรกรรม</h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                {tab === 'photos'
                  ? 'อัปโหลดสลิปหลายภาพให้ AI แกะข้อมูลอัตโนมัติ'
                  : 'เพิ่มธุรกรรมเข้าสู่พอร์ตโฟลิโอ'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher (3 Tabs) */}
        <div className="flex bg-[#181C25] p-1.5 gap-1.5 mx-6 mt-4 rounded-xl border border-white/[0.06]">
          <button
            type="button"
            onClick={() => setTab('photos')}
            className={`flex-1 min-h-9 py-1.5 text-xs font-medium flex items-center justify-center gap-1.5 rounded-lg transition-all cursor-pointer ${
              tab === 'photos'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>สแกนสลิปหลายภาพ (AI)</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('ai')}
            className={`flex-1 min-h-9 py-1.5 text-xs font-medium flex items-center justify-center gap-1.5 rounded-lg transition-all cursor-pointer ${
              tab === 'ai'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>พิมพ์ข้อความ AI</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('manual')}
            className={`flex-1 min-h-9 py-1.5 text-xs font-medium flex items-center justify-center gap-1.5 rounded-lg transition-all cursor-pointer ${
              tab === 'manual'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>กรอกฟอร์มมาตรฐาน</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="px-6 py-5 overflow-y-auto flex-1 space-y-5">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-2.5 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-2.5 text-xs text-emerald-300">
              <Check className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* ════════════════ TAB 1: MULTI-IMAGE SCAN (AI) ════════════════ */}
          {tab === 'photos' && (
            <div className="space-y-4">
              {!hasExtracted ? (
                <>
                  {/* Drag and Drop Zone */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault()
                      setIsDragOver(true)
                    }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault()
                      setIsDragOver(false)
                      if (e.dataTransfer.files) {
                        Array.from(e.dataTransfer.files).forEach(processImageFile)
                      }
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-all ${
                      isDragOver
                        ? 'border-indigo-500 bg-indigo-500/10'
                        : 'border-white/10 hover:border-indigo-500/40 hover:bg-white/[0.02]'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                    <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-3 text-indigo-400 shadow-lg shadow-indigo-500/10">
                      <UploadCloud className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-bold text-white mb-1">
                      คลิกเพื่อเลือกภาพ หรือลากรูปภาพมาวางที่นี่
                    </p>
                    <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
                      รองรับการส่งพร้อมกันหลายภาพ (สลิปซื้อ, สลิปขาย, ปันผล, หรือหน้ากระเป๋าเงินสด)
                    </p>
                    <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 text-[11px] text-zinc-400">
                      <span>💡 หรือกดปุ่ม</span>
                      <kbd className="px-1.5 py-0.5 rounded bg-black/40 border border-white/20 font-mono text-[10px] text-white">
                        Ctrl + V
                      </kbd>
                      <span>เพื่อวางภาพหน้าจอได้ทันที</span>
                    </div>
                  </div>

                  {/* Uploaded Files Previews */}
                  {uploadedFiles.length > 0 && (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between text-xs text-zinc-400">
                        <span className="font-semibold text-white">
                          ภาพที่เลือก ({uploadedFiles.length} ภาพ)
                        </span>
                        <button
                          onClick={clearAllFiles}
                          className="text-rose-400 hover:text-rose-300 transition-colors"
                        >
                          ล้างทั้งหมด
                        </button>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        {uploadedFiles.map((file, idx) => (
                          <div
                            key={idx}
                            className="relative group rounded-xl bg-[#181C25] border border-white/10 overflow-hidden p-2 flex flex-col gap-1.5"
                          >
                            <div className="aspect-square rounded-lg bg-black/40 overflow-hidden flex items-center justify-center relative">
                              <img
                                src={file.base64}
                                alt={file.name}
                                className="w-full h-full object-cover"
                              />
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  removeFile(idx)
                                }}
                                className="absolute top-1 right-1 p-1 rounded-md bg-black/70 hover:bg-rose-600 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                title="ลบภาพนี้"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <span className="text-[10px] text-zinc-300 truncate font-mono">
                              {file.name}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Analyze Button */}
                      <button
                        type="button"
                        onClick={handleAnalyzeMultiImages}
                        disabled={parsing}
                        className="w-full mt-3 bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/25 cursor-pointer"
                      >
                        {parsing ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>AI กำลังวิเคราะห์สลิปทั้ง {uploadedFiles.length} ภาพ...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 text-amber-300" />
                            <span>วิเคราะห์ข้อมูลทุกภาพด้วย AI</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </>
              ) : (
                /* ── BATCH REVIEW SCREEN ── */
                <div className="space-y-4">
                  {/* Summary Bar */}
                  <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-white">วิเคราะห์ผลสำเร็จ!</p>
                        <p className="text-[11px] text-zinc-300">{aiSummaryText}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setHasExtracted(false)}
                      className="text-xs text-indigo-300 hover:text-white underline"
                    >
                      เลือกภาพใหม่
                    </button>
                  </div>

                  {/* Extracted Transactions Review Table */}
                  {extractedTxns.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white uppercase tracking-wider">
                          รายการซื้อขาย & ปันผล ({extractedTxns.length} รายการ)
                        </span>
                        <span className="text-[11px] text-zinc-400">
                          เลือก {extractedTxns.filter((t) => t.selected).length} / {extractedTxns.length}
                        </span>
                      </div>

                      <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                        {extractedTxns.map((txn, idx) => {
                          const isBuy = txn.txnType === 'BUY'
                          const isSell = txn.txnType === 'SELL'
                          const isDiv = txn.txnType === 'DIVIDEND'
                          const isFee = txn.txnType === 'FEE'

                          let badgeColor = 'bg-zinc-700 text-zinc-300'
                          let badgeText: string = txn.txnType
                          if (isBuy) {
                            badgeColor = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            badgeText = 'ซื้อ'
                          } else if (isSell) {
                            badgeColor = 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                            badgeText = 'ขาย'
                          } else if (isDiv) {
                            badgeColor = 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                            badgeText = 'ปันผล'
                          } else if (isFee) {
                            badgeColor = 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            badgeText = 'ค่าธรรมเนียม'
                          }

                          return (
                            <div
                              key={txn.id}
                              className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                                txn.selected
                                  ? 'bg-[#181C25] border-white/10'
                                  : 'bg-[#14161E]/50 border-white/5 opacity-60'
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setExtractedTxns((prev) =>
                                      prev.map((t, i) => (i === idx ? { ...t, selected: !t.selected } : t))
                                    )
                                  }}
                                  className="text-zinc-400 hover:text-white shrink-0 cursor-pointer"
                                >
                                  {txn.selected ? (
                                    <CheckSquare className="w-4 h-4 text-indigo-400" />
                                  ) : (
                                    <Square className="w-4 h-4" />
                                  )}
                                </button>

                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${badgeColor}`}>
                                      {badgeText}
                                    </span>
                                    <span className="font-bold text-white text-xs font-mono">
                                      {txn.ticker}
                                    </span>
                                    <span className="text-[10px] text-zinc-400 truncate hidden sm:inline">
                                      {txn.assetName}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-zinc-400 font-mono mt-0.5 flex flex-wrap items-center gap-x-2">
                                    <span>
                                      {txn.quantity} หุ้น @ ${txn.pricePerUnit.toFixed(2)}
                                    </span>
                                    {txn.fee > 0 && <span>(ค่าคอมฯ ${txn.fee.toFixed(2)})</span>}
                                    {txn.taxWithheld > 0 && <span>(ภาษี ${txn.taxWithheld.toFixed(2)})</span>}
                                    <span className="text-zinc-400 font-sans">
                                      • {new Date(txn.txnDate).toLocaleDateString('th-TH')}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Right: Total Amount & Account Selection */}
                              <div className="text-right shrink-0">
                                <span className="font-bold text-white text-xs font-mono tabular-nums">
                                  ${txn.totalAmount.toFixed(2)} {txn.currency}
                                </span>
                                <div className="mt-1">
                                  <select
                                    value={txn.matchedAccountId}
                                    onChange={(e) => {
                                      const val = e.target.value
                                      setExtractedTxns((prev) =>
                                        prev.map((t, i) =>
                                          i === idx ? { ...t, matchedAccountId: val } : t
                                        )
                                      )
                                    }}
                                    className="text-[10px] bg-[#12151C] border border-white/10 rounded px-1.5 py-0.5 text-zinc-300 focus:outline-none"
                                  >
                                    {accounts.map((acc) => (
                                      <option key={acc.id} value={acc.id}>
                                        {acc.accountName}
                                      </option>
                                    ))}
                                    <option value="">สร้างบัญชีใหม่ตามสลิป ({txn.accountName})</option>
                                  </select>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Extracted Cash Balances Review */}
                  {extractedCash.length > 0 && (
                    <div className="p-3.5 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/20 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Coins className="w-4 h-4 text-emerald-400" />
                          <span className="text-xs font-bold text-white">
                            อัปเดตยอดกระเป๋าเงินสด ({extractedCash.length} บัญชี)
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        {extractedCash.map((cash, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-2 rounded-lg bg-[#181C25] border border-white/10 text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setExtractedCash((prev) =>
                                    prev.map((c, i) => (i === idx ? { ...c, selected: !c.selected } : c))
                                  )
                                }}
                                className="text-zinc-400 hover:text-white cursor-pointer"
                              >
                                {cash.selected ? (
                                  <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Square className="w-3.5 h-3.5" />
                                )}
                              </button>
                              <span className="font-semibold text-white">{cash.accountName}</span>
                              <span className="text-[10px] text-zinc-400">({cash.currency})</span>
                            </div>
                            <div className="text-right font-mono">
                              <span className="font-bold text-emerald-300">
                                {cash.cashAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} {cash.currency}
                              </span>
                              {cash.accruedInterest > 0 && (
                                <p className="text-[10px] text-zinc-400">
                                  ดอกเบี้ยสะสม: {cash.accruedInterest} {cash.currency}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Batch Save Action Bar */}
                  <div className="pt-2 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setHasExtracted(false)}
                      className="text-xs text-zinc-400 hover:text-white px-3 py-2"
                    >
                      ย้อนกลับ
                    </button>
                    <button
                      type="button"
                      onClick={handleBatchSave}
                      disabled={submitting}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-600/25 cursor-pointer"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>กำลังบันทึกทุกรายการ...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          <span>
                            บันทึกทุกรายการเข้าสู่ระบบ (
                            {extractedTxns.filter((t) => t.selected).length +
                              extractedCash.filter((c) => c.selected).length}{' '}
                            รายการ)
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ════════════════ TAB 2: AI TEXT PROMPT ════════════════ */}
          {tab === 'ai' && (
            <form onSubmit={handleSingleAIParse} className="space-y-4">
              <div>
                <label className={labelClass}>รายละเอียดธุรกรรม (ภาษาธรรมชาติ)</label>
                <textarea
                  className={`${inputClass} min-h-[100px] resize-none`}
                  placeholder="เช่น: ซื้อ GOOGL 1 หุ้น ราคา 328.94 ดอลลาร์ ค่าคอม 0.53 บัญชี Dime เมื่อวานนี้"
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
                <p>• ขาย MU 0.319 หุ้น ราคา 1034 USD</p>
                <p>• รับปันผล GOOGL 0.44 USD หักภาษี 0.06</p>
              </div>

              <button
                type="submit"
                disabled={parsing || !nlText.trim()}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 py-2.5 rounded-xl font-medium text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/25 cursor-pointer"
              >
                {parsing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>AI กำลังวิเคราะห์ข้อความ...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>วิเคราะห์ข้อความด้วย AI</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* ════════════════ TAB 3: MANUAL STANDARD FORM ════════════════ */}
          {tab === 'manual' && (
            <form onSubmit={handleManualSubmit} id="manual-form" className="space-y-4">
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
                    placeholder="GOOGL, MU, AAPL, BTC"
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

              {/* Total Box */}
              <div className="p-4 rounded-xl bg-[#181C25] border border-white/[0.06] flex items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] text-zinc-400 font-semibold uppercase tracking-wider">
                    ยอดรวมโดยประมาณ
                  </p>
                  <p className="text-[11px] text-zinc-400 font-mono mt-0.5">
                    (จำนวน × ราคา) + ค่าธรรมเนียม - ภาษี
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xl font-bold text-white font-mono tabular-nums">
                    ${isNaN(Number(totalAmount)) ? '0.00' : Number(totalAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
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

              <div className="pt-3 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs text-zinc-400 hover:text-white"
                  disabled={submitting}
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 px-5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-indigo-600/25"
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
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
