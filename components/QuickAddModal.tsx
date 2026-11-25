'use client'

import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import useSWR, { mutate } from 'swr'
import type { normalizeExtraction } from '@/lib/ai/transaction-extraction'
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
  Calculator,
} from 'lucide-react'
import {
  ACCOUNT_TYPES,
  accountTypeLabel,
  getErrorMessage,
  parseAccountsPayload,
  type AccountTypeValue,
} from '@/lib/accounts'
import { StatusModal, type StatusDetailItem } from '@/components/ui/StatusModal'
import {
  GRAMS_PER_THAI_BAHT_BAR,
  formatGoldWeightSublabel,
  getAssetUnitLabel,
  gramsToOz,
  isThai965GoldTicker,
  normalizeGoldTicker,
} from '@/lib/market-data/gold'

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
  sourceImageIndex?: number | null
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

function toReviewRows(data: ReturnType<typeof normalizeExtraction>) {
  const txns: ExtractedTxn[] = data.transactions.map((txn) => ({
    ...txn,
    selected: false,
    ticker: txn.ticker ?? '',
    assetName: txn.assetName ?? '',
    market: txn.market ?? (txn.currency === 'THB' ? 'TH' : 'US'),
    assetType: txn.assetType ?? 'stock',
    quantity: txn.quantity ?? 0,
    pricePerUnit: txn.pricePerUnit ?? 0,
    fee: txn.fee ?? 0,
    taxWithheld: txn.taxWithheld ?? 0,
    totalAmount: txn.totalAmount ?? 0,
    currency: txn.currency ?? '',
    txnDate: txn.txnDate ?? '',
    matchedAccountId: txn.matchedAccountId ?? '',
    accountName: txn.accountName ?? '',
  }))
  const cash: ExtractedCash[] = data.cashBalances.map((balance) => ({
    ...balance,
    selected: false,
    matchedAccountId: balance.matchedAccountId ?? '',
    accountName: balance.accountName ?? '',
    accountType: ACCOUNT_TYPES.find((type) => type.value === balance.accountType)?.value ?? 'bank',
    balanceDate: balance.balanceDate ?? undefined,
    accruedInterest: balance.accruedInterest ?? 0,
  }))
  return { txns, cash }
}

interface QuickAddModalProps {
  onClose: () => void
  onSuccess?: () => void
  initialTab?: 'photos' | 'ai' | 'manual'
  initialData?: {
    ticker?: string
    action?: TransactionType
    price?: number
    market?: Market
    assetName?: string
  }
}

async function parseResponseJson(res: Response, fallbackError: string) {
  const contentType = res.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    const json = await res.json()
    if (!res.ok) {
      throw new Error(json.error || json.message || fallbackError)
    }
    return json
  }
  const rawText = await res.text()
  if (!res.ok) {
    if (res.status === 504 || rawText.includes('timeout') || rawText.includes('FUNCTION_INVOCATION_TIMEOUT')) {
      throw new Error('ระบบประมวลผลนานเกินกำหนด กรุณาลองใหม่อีกครั้ง หรือแบ่งข้อความเป็นชุดสั้นลง')
    }
    throw new Error(rawText.length < 150 && rawText.length > 0 ? rawText : fallbackError)
  }
  try {
    return JSON.parse(rawText)
  } catch {
    throw new Error(fallbackError)
  }
}

function calculateTxnTotal(
  txnType: TransactionType,
  quantity: number,
  pricePerUnit: number,
  fee: number = 0,
  taxWithheld: number = 0
): number {
  const q = Number(quantity) || 0
  const p = Number(pricePerUnit) || 0
  const f = Number(fee) || 0
  const t = Number(taxWithheld) || 0

  if (txnType === 'SELL') {
    return Number(Math.max(0, q * p - f - t).toFixed(2))
  }
  if (txnType === 'DIVIDEND') {
    return Number(Math.max(0, q * p - f - t).toFixed(2))
  }
  if (txnType === 'FEE') {
    return Number(f.toFixed(2))
  }
  // BUY, DEPOSIT, WITHDRAW, etc.
  return Number(Math.max(0, q * p + f).toFixed(2))
}

function compressImage(
  file: File,
  maxDimension = 1600,
  quality = 0.85
): Promise<{ base64: string; mimeType: string; size: number }> {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) {
      resolve({ base64: '', mimeType: 'image/jpeg', size: 0 })
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        let width = img.width
        let height = img.height

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width)
            width = maxDimension
          } else {
            width = Math.round((width * maxDimension) / height)
            height = maxDimension
          }
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height)
          const compressedBase64 = canvas.toDataURL('image/jpeg', quality)
          const approxSize = Math.round((compressedBase64.length * 3) / 4)
          resolve({
            base64: compressedBase64,
            mimeType: 'image/jpeg',
            size: approxSize,
          })
          return
        }

        resolve({
          base64: e.target?.result as string,
          mimeType: file.type || 'image/jpeg',
          size: file.size,
        })
      }

      img.onerror = () => {
        resolve({
          base64: e.target?.result as string,
          mimeType: file.type || 'image/jpeg',
          size: file.size,
        })
      }

      img.src = e.target?.result as string
    }

    reader.onerror = () => {
      resolve({ base64: '', mimeType: 'image/jpeg', size: 0 })
    }

    reader.readAsDataURL(file)
  })
}

export function QuickAddModal({
  onClose,
  onSuccess,
  initialTab = 'photos',
  initialData,
}: QuickAddModalProps) {
  const [tab, setTab] = useState<'photos' | 'ai' | 'manual'>(
    initialData?.ticker ? 'manual' : initialTab
  )
  const [nlText, setNlText] = useState('')
  const [parsing, setParsing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Animated Status Modal (Loading / Success / Error)
  const [statusModal, setStatusModal] = useState<{
    isOpen: boolean
    type: 'loading' | 'success' | 'error' | 'warning'
    title: string
    description?: string
    progressStep?: string
    details?: StatusDetailItem[]
    primaryAction?: { label: string; onClick: () => void; icon?: React.ReactNode }
    secondaryAction?: { label: string; onClick: () => void }
    autoCloseMs?: number
  } | null>(null)

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
    ticker: initialData?.ticker || '',
    market: (initialData?.market || 'US') as Market,
    assetType: 'stock' as AssetType,
    assetName: initialData?.assetName || '',
    txnDate: new Date().toISOString().split('T')[0],
    txnType: (initialData?.action || 'BUY') as TransactionType,
    quantity: '',
    pricePerUnit: initialData?.price ? String(initialData.price) : '',
    fee: '0',
    taxWithheld: '0',
    note: '',
  })

  // Sync if initialData is provided/updated
  useEffect(() => {
    if (initialData?.ticker) {
      setTab('manual')
      setFormData((prev) => ({
        ...prev,
        ticker: initialData.ticker || prev.ticker,
        market: (initialData.market || prev.market) as Market,
        txnType: (initialData.action || prev.txnType) as TransactionType,
        pricePerUnit: initialData.price ? String(initialData.price) : prev.pricePerUnit,
        assetName: initialData.assetName || prev.assetName,
      }))
    }
  }, [initialData])

  const accountId = formData.accountId || accounts[0]?.id || ''

  // Fee Breakdown Calculator State
  const [showFeeCalculator, setShowFeeCalculator] = useState(false)
  const [feeBreakdown, setFeeBreakdown] = useState({
    commission: '',
    otherFees: '',
    secFee: '',
    tafFee: '',
  })

  const isThaiMarket = formData.market === 'TH'
  const isSellTxn = formData.txnType === 'SELL'
  const isGoldMode = formData.assetType === 'gold'

  // Live Gold Price & Weight/Spend Calculator State (for Dime! Gold 99.99% & Thai Gold 96.5%)
  const [goldLiveQuote, setGoldLiveQuote] = useState<{
    xauUsdPerOz: number
    usdThbRate: number
    thai965ThbPerBaht: number
  } | null>(null)
  const [fetchingGoldPrice, setFetchingGoldPrice] = useState(false)
  const [goldInputMode, setGoldInputMode] = useState<
    'amount_usd' | 'amount_thb' | 'weight_oz' | 'weight_grams'
  >('amount_usd')
  const [goldCalcInput, setGoldCalcInput] = useState('')

  async function fetchLiveGoldPrice(applyToPriceField = true, targetTicker?: string) {
    setFetchingGoldPrice(true)
    try {
      const res = await fetch('/api/market-data/gold')
      if (!res.ok) return
      const json = await res.json()
      const quoteData = {
        xauUsdPerOz: Number(json.xauUsdPerOz || 0),
        usdThbRate: Number(json.usdThbRate || 35.5),
        thai965ThbPerBaht: Number(json.thai965ThbPerBaht || 0),
      }
      setGoldLiveQuote(quoteData)

      if (applyToPriceField) {
        const sym = (targetTicker || formData.ticker).toUpperCase()
        if (isThai965GoldTicker(sym) && quoteData.thai965ThbPerBaht > 0) {
          setFormData((prev) => ({
            ...prev,
            pricePerUnit: String(quoteData.thai965ThbPerBaht),
          }))
        } else if (quoteData.xauUsdPerOz > 0) {
          setFormData((prev) => ({
            ...prev,
            pricePerUnit: quoteData.xauUsdPerOz.toFixed(2),
          }))
        }
      }
    } catch {
      // ignore gold live price fetch error cleanly
    } finally {
      setFetchingGoldPrice(false)
    }
  }

  function selectManualCategory(category: 'US' | 'TH' | 'DIME_GOLD' | 'THAI_GOLD' | 'CRYPTO') {
    const findAccountByCurrency = (curr: string, keyword?: string) => {
      if (keyword) {
        const byKw = accounts.find((a) =>
          a.accountName.toLowerCase().includes(keyword.toLowerCase())
        )
        if (byKw) return byKw.id
      }
      return accounts.find((a) => a.currency?.toUpperCase() === curr)?.id || accounts[0]?.id || ''
    }

    if (category === 'DIME_GOLD') {
      const targetAcc = findAccountByCurrency('USD', 'dime')
      setGoldInputMode('amount_usd')
      setGoldCalcInput('')
      setFormData((prev) => ({
        ...prev,
        accountId: targetAcc || prev.accountId,
        market: 'US',
        assetType: 'gold',
        ticker: 'XAU',
        assetName: 'Dime! Gold 99.99% (USD/oz)',
        fee: '0',
        taxWithheld: '0',
      }))
      fetchLiveGoldPrice(true, 'XAU')
    } else if (category === 'THAI_GOLD') {
      const targetAcc = findAccountByCurrency('THB')
      setGoldInputMode('weight_oz')
      setGoldCalcInput('')
      setFormData((prev) => ({
        ...prev,
        accountId: targetAcc || prev.accountId,
        market: 'TH',
        assetType: 'gold',
        ticker: 'GOLD965',
        assetName: 'ทองคำแท่งไทย 96.5% (THB/บาททอง)',
        fee: '0',
        taxWithheld: '0',
      }))
      fetchLiveGoldPrice(true, 'GOLD965')
    } else if (category === 'TH') {
      const targetAcc = findAccountByCurrency('THB')
      setFormData((prev) => ({
        ...prev,
        accountId: targetAcc || prev.accountId,
        market: 'TH',
        assetType: prev.assetType === 'gold' || prev.assetType === 'crypto' ? 'stock' : prev.assetType,
        ticker: prev.assetType === 'gold' ? '' : prev.ticker,
        assetName: prev.assetType === 'gold' ? '' : prev.assetName,
      }))
    } else if (category === 'CRYPTO') {
      setFormData((prev) => ({
        ...prev,
        market: 'CRYPTO',
        assetType: 'crypto',
        ticker: prev.assetType === 'gold' ? '' : prev.ticker,
        assetName: prev.assetType === 'gold' ? '' : prev.assetName,
      }))
    } else {
      const targetAcc = findAccountByCurrency('USD')
      setFormData((prev) => ({
        ...prev,
        accountId: targetAcc || prev.accountId,
        market: 'US',
        assetType: 'stock',
        ticker: prev.assetType === 'gold' ? '' : prev.ticker,
        assetName: prev.assetType === 'gold' ? '' : prev.assetName,
      }))
    }
  }

  useEffect(() => {
    if (formData.assetType !== 'gold' || goldInputMode === 'weight_oz') return
    const val = parseFloat(goldCalcInput)
    const p = parseFloat(formData.pricePerUnit)
    if (!Number.isFinite(val) || val <= 0) return

    let computedQty: number | null = null
    const isThai965 = isThai965GoldTicker(formData.ticker)

    if (goldInputMode === 'weight_grams') {
      computedQty = isThai965 ? val / GRAMS_PER_THAI_BAHT_BAR : gramsToOz(val)
    } else if (goldInputMode === 'amount_usd' && Number.isFinite(p) && p > 0) {
      computedQty = val / p
    } else if (goldInputMode === 'amount_thb' && Number.isFinite(p) && p > 0) {
      if (isThai965) {
        computedQty = val / p
      } else {
        const fx = goldLiveQuote?.usdThbRate || 35.5
        computedQty = val / fx / p
      }
    }

    if (computedQty !== null && Number.isFinite(computedQty) && computedQty > 0) {
      const nextStr = computedQty.toFixed(isThai965 ? 4 : 6)
      setFormData((prev) => (prev.quantity === nextStr ? prev : { ...prev, quantity: nextStr }))
    }
  }, [
    goldCalcInput,
    goldInputMode,
    formData.assetType,
    formData.ticker,
    formData.pricePerUnit,
    goldLiveQuote?.usdThbRate,
  ])
  const commNum = parseFloat(feeBreakdown.commission) || 0
  const otherFeesNum = parseFloat(feeBreakdown.otherFees) || 0
  const secFeeNum = parseFloat(feeBreakdown.secFee) || 0
  const tafFeeNum = parseFloat(feeBreakdown.tafFee) || 0

  const vatCalculated = isThaiMarket ? (commNum + otherFeesNum) * 0.07 : commNum * 0.07
  const totalBreakdownFee = isThaiMarket
    ? commNum + otherFeesNum + vatCalculated
    : commNum + vatCalculated + (isSellTxn ? secFeeNum + tafFeeNum : 0)

  // Computed total for manual form
  const quantityNum = parseFloat(formData.quantity) || 0
  const priceNum = parseFloat(formData.pricePerUnit) || 0
  const feeNum = parseFloat(formData.fee) || 0
  const taxNum = parseFloat(formData.taxWithheld) || 0
  const totalAmount = calculateTxnTotal(formData.txnType, quantityNum, priceNum, feeNum, taxNum).toFixed(2)

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

  async function processImageFile(file: File) {
    if (!file.type.startsWith('image/')) return

    try {
      const compressed = await compressImage(file)
      if (!compressed.base64) return
      setUploadedFiles((prev) => [
        ...prev,
        {
          name: file.name || `slip-${Date.now()}.jpg`,
          size: compressed.size,
          base64: compressed.base64,
          mimeType: compressed.mimeType,
        },
      ])
      setError('')
    } catch {
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

    const abortController = new AbortController()
    setParsing(true)
    setError('')
    setSuccessMsg('')

    // 45s safety timeout
    const timeoutId = setTimeout(() => {
      abortController.abort()
    }, 45000)

    const handleCancelScan = () => {
      clearTimeout(timeoutId)
      abortController.abort()
      setParsing(false)
      setStatusModal(null)
    }

    setStatusModal({
      isOpen: true,
      type: 'loading',
      title: 'กำลังสแกนและวิเคราะห์สลิป...',
      description: `ระบบกำลังถอดรหัสภาพสลิปจำนวน ${uploadedFiles.length} รูป และสกัดรายการลงทุน`,
      progressStep: 'AI Vision & Multimodal Extraction...',
      secondaryAction: {
        label: 'ยกเลิก',
        onClick: handleCancelScan,
      },
    })

    try {
      const res = await fetch('/api/ai/extract-slips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortController.signal,
        body: JSON.stringify({
          images: uploadedFiles.map((f) => ({ data: f.base64, mimeType: f.mimeType })),
        }),
      })

      clearTimeout(timeoutId)
      const json = await parseResponseJson(res, 'การวิเคราะห์ภาพถ่ายล้มเหลว')

      const { txns, cash } = toReviewRows(json.data)

      setExtractedTxns(txns)
      setExtractedCash(cash)
      setAiSummaryText(json.data?.summary || `พบ ${txns.length} รายการธุรกรรม และ ${cash.length} บัญชีเงินสด`)
      setHasExtracted(true)

      // CRITICAL FIX: Dismiss the loading modal so user can view and edit extracted items
      setStatusModal(null)

      if (txns.length === 0 && cash.length === 0) {
        setError('ไม่พบข้อมูลธุรกรรมหรือเงินสดในภาพที่ส่งมา กรุณาตรวจสอบความคมชัดของภาพ')
        setStatusModal({
          isOpen: true,
          type: 'warning',
          title: 'ไม่พบรายการในภาพ',
          description: 'ระบบไม่สามารถตรวจพบรายการซื้อขายหรือยอดเงินสดในสลิปที่แนบมา กรุณาลองอัปโหลดภาพที่มีความคมชัดอีกครั้ง',
          primaryAction: {
            label: 'ตกลง',
            onClick: () => setStatusModal(null),
          },
        })
      } else {
        setSuccessMsg(`วิเคราะห์สลิปสำเร็จ! พบ ${txns.length} รายการธุรกรรม ตรวจสอบและแก้ไขข้อมูลก่อนกดบันทึกได้เลย`)
      }
    } catch (err: unknown) {
      clearTimeout(timeoutId)
      const isAbort = (err as any)?.name === 'AbortError'
      if (isAbort) {
        setError('ยกเลิกการสแกนสลิป หรือการเชื่อมต่อหมดเวลา (Timeout)')
        setStatusModal({
          isOpen: true,
          type: 'warning',
          title: 'การวิเคราะห์หมดเวลาหรือถูกยกเลิก',
          description: 'การสกัดข้อมูลภาพใช้เวลานานเกินกำหนด หรือคุณได้กดยกเลิก กรุณาลองใหม่อีกครั้ง',
          primaryAction: { label: 'ตกลง', onClick: () => setStatusModal(null) },
        })
      } else {
        setError(getErrorMessage(err, 'การวิเคราะห์ภาพถ่ายล้มเหลว'))
        setStatusModal({
          isOpen: true,
          type: 'error',
          title: 'การวิเคราะห์ภาพถ่ายล้มเหลว',
          description: getErrorMessage(err, 'ไม่สามารถสกัดข้อมูลจากภาพได้ กรุณาลองใหม่อีกครั้ง'),
          primaryAction: { label: 'ลองใหม่', onClick: () => setStatusModal(null) },
        })
      }
    } finally {
      clearTimeout(timeoutId)
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

    let sanitizedTxns: ExtractedTxn[]
    try {
      sanitizedTxns = selectedTxns.map((txn, index) => {
        const label = txn.ticker || `รายการที่ ${index + 1}`
        const account = accounts.find((item) => item.id === txn.matchedAccountId)
        if (!account || account.currency !== txn.currency) throw new Error(`${label}: กรุณาเลือกบัญชีสกุลเงินเดียวกับรายการ`)
        if (!txn.txnDate || !Number.isFinite(Date.parse(txn.txnDate))) throw new Error(`${label}: กรุณาระบุวันที่ทำรายการ`)
        const cashFlow = txn.txnType === 'FEE' || txn.txnType === 'DEPOSIT' || txn.txnType === 'WITHDRAW'
        if (!cashFlow && !txn.ticker.trim()) throw new Error(`${label}: กรุณาระบุ ticker`)
        let quantity = txn.quantity
        let pricePerUnit = txn.pricePerUnit
        if (cashFlow) {
          const amount = txn.totalAmount || (txn.txnType === 'FEE' ? txn.fee : txn.pricePerUnit)
          if (amount <= 0) throw new Error(`${label}: กรุณาระบุยอดเงิน`)
          return { ...txn, ticker: txn.ticker || 'CASH', quantity: 1, pricePerUnit: amount, totalAmount: amount }
        }
        const gross = txn.txnType === 'BUY' ? txn.totalAmount - txn.fee : txn.totalAmount + txn.fee + txn.taxWithheld
        if (txn.totalAmount > 0 && gross > 0) {
          if (quantity > 0 && pricePerUnit <= 0) pricePerUnit = gross / quantity
          else if (pricePerUnit > 0 && quantity <= 0) quantity = gross / pricePerUnit
        }
        if (quantity <= 0 || pricePerUnit <= 0) throw new Error(`${label}: กรุณากรอกจำนวนและราคาต่อหน่วยจากหลักฐาน`)
        const totalAmount = Number(calculateTxnTotal(txn.txnType, quantity, pricePerUnit, txn.fee, txn.taxWithheld).toFixed(2))
        if (txn.totalAmount > 0 && Math.abs(totalAmount - txn.totalAmount) > 0.02) {
          throw new Error(`${label}: ยอดในเอกสารไม่ตรงกับจำนวน ราคา และค่าธรรมเนียม กรุณาตรวจรายการ`)
        }
        return { ...txn, quantity, pricePerUnit, totalAmount }
      })
      for (const cash of selectedCash) {
        const account = accounts.find((item) => item.id === cash.matchedAccountId)
        if (!account || account.currency !== cash.currency || !cash.balanceDate || !Number.isFinite(Date.parse(cash.balanceDate))) {
          throw new Error('ยอดเงินสด: กรุณาเลือกบัญชีที่ตรงสกุลเงินและระบุวันที่ยอดคงเหลือ')
        }
      }
    } catch (error) {
      setError(getErrorMessage(error, 'กรุณาตรวจข้อมูลที่ต้องการบันทึก'))
      return
    }

    setSubmitting(true)
    setError('')
    setStatusModal({
      isOpen: true,
      type: 'loading',
      title: 'กำลังบันทึกรายการธุรกรรม...',
      description: 'กำลังตรวจสอบข้อมูล ปรับปรุงยอดกระเป๋าเงินสด และคำนวณต้นทุนพอร์ต',
      progressStep: `กำลังบันทึก ${sanitizedTxns.length + selectedCash.length} รายการ`,
    })

    try {
      const res = await fetch('/api/transactions/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactions: sanitizedTxns.map((t) => {
            const rawDate = t.txnDate.length === 10 ? `${t.txnDate}T00:00:00+07:00` : t.txnDate
            const isoDate = new Date(rawDate).toISOString()
            return {
              accountId: t.matchedAccountId,
              accountName: t.accountName,
              currency: t.currency,
              ticker: t.ticker.trim().toUpperCase(),
              assetName: t.assetName || t.ticker.trim().toUpperCase(),
              market: t.market || (t.currency === 'THB' ? 'TH' : 'US'),
              assetType: t.assetType || 'stock',
              txnDate: isoDate,
              txnType: t.txnType,
              quantity: Number(t.quantity),
              pricePerUnit: Number(t.pricePerUnit),
              fee: Number(t.fee || 0),
              taxWithheld: Number(t.taxWithheld || 0),
              totalAmount: Number(t.totalAmount),
              note: t.note || undefined,
            }
          }),
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

      const json = await parseResponseJson(res, 'บันทึกรายการแบบกลุ่มล้มเหลว')

      // Revalidate all caches including parameterized queries
      mutate((key) => typeof key === 'string' && key.startsWith('/api/transactions'))
      mutate((key) => typeof key === 'string' && key.startsWith('/api/accounts'))
      mutate((key) => typeof key === 'string' && key.startsWith('/api/cash-wallet'))
      mutate((key) => typeof key === 'string' && key.startsWith('/api/portfolio'))

      const totalCount = sanitizedTxns.length + selectedCash.length
      const totalInvested = sanitizedTxns.reduce((sum, t) => sum + (Number(t.totalAmount) || 0), 0)
      const primaryCurr = sanitizedTxns[0]?.currency || 'USD'

      setStatusModal({
        isOpen: true,
        type: 'success',
        title: '🎉 บันทึกรายการเรียบร้อยแล้ว!',
        description: `ระบบได้บันทึกธุรกรรมทั้งหมด ${totalCount} รายการเข้าสู่พอร์ตของคุณเรียบร้อยแล้ว พร้อมอัปเดตยอดกระเป๋าเงินสดและต้นทุนเฉลี่ยทันที`,
        details: [
          { label: 'จำนวนรายการ', value: `${totalCount} รายการ`, color: 'text-emerald-400' },
          {
            label: 'ยอดรวมธุรกรรม',
            value: `${primaryCurr === 'USD' ? '$' : '฿'}${totalInvested.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })} ${primaryCurr}`,
            color: 'text-white',
          },
          { label: 'สถานะระบบ', value: 'อัปเดตพอร์ตแล้ว', color: 'text-cyan-400' },
        ],
        primaryAction: {
          label: 'ดูประวัติธุรกรรม',
          onClick: () => {
            setStatusModal(null)
            if (onSuccess) onSuccess()
            onClose()
            window.location.href = '/transactions'
          },
        },
        secondaryAction: {
          label: 'ปิด',
          onClick: () => {
            setStatusModal(null)
            if (onSuccess) onSuccess()
            onClose()
          },
        },
        autoCloseMs: 4000,
      })
    } catch (err: any) {
      setError(getErrorMessage(err, 'เกิดข้อผิดพลาดในการบันทึกรายการ'))
      setStatusModal({
        isOpen: true,
        type: 'error',
        title: 'บันทึกไม่สำเร็จ',
        description: getErrorMessage(err, 'เกิดข้อผิดพลาดในการบันทึกรายการ กรุณาตรวจสอบข้อมูล'),
        primaryAction: {
          label: 'ปิดหน้าต่าง',
          onClick: () => setStatusModal(null),
        },
      })
    } finally {
      setSubmitting(false)
    }
  }

  // Helper functions for Batch Transactions Editor
  function handleAddBlankRow() {
    const defaultAcc = accounts[0]
    const newTxn: ExtractedTxn = {
      id: `manual_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      selected: true,
      txnType: 'BUY',
      ticker: '',
      assetName: '',
      market: 'US',
      assetType: 'stock',
      quantity: 1,
      pricePerUnit: 0,
      fee: 0,
      taxWithheld: 0,
      totalAmount: 0,
      currency: defaultAcc?.currency === 'THB' ? 'THB' : 'USD',
      txnDate: new Date().toISOString().split('T')[0],
      matchedAccountId: defaultAcc?.id || '',
      accountName: defaultAcc?.accountName || 'Dime! USD',
      note: '',
      confidence: 1.0,
    }
    setExtractedTxns((prev) => [...prev, newTxn])
  }

  function handleRemoveTxn(idx: number) {
    setExtractedTxns((prev) => prev.filter((_, i) => i !== idx))
  }

  function handleUpdateTxn(idx: number, patch: Partial<ExtractedTxn>) {
    setExtractedTxns((prev) =>
      prev.map((item, i) => {
        if (i !== idx) return item
        const updated = { ...item, ...patch }
        if (patch.ticker !== undefined) {
          updated.ticker = patch.ticker.toUpperCase()
        }
        if (
          patch.quantity !== undefined ||
          patch.pricePerUnit !== undefined ||
          patch.fee !== undefined ||
          patch.taxWithheld !== undefined ||
          patch.txnType !== undefined
        ) {
          const q = Number(updated.quantity) || 0
          const p = Number(updated.pricePerUnit) || 0
          const f = Number(updated.fee) || 0
          const t = Number(updated.taxWithheld) || 0
          if (q > 0 && p > 0) {
            updated.totalAmount = calculateTxnTotal(updated.txnType, q, p, f, t)
          } else if (updated.txnType === 'FEE') {
            updated.totalAmount = f
          }
        }
        return updated
      })
    )
  }

  function handleToggleAll(select: boolean) {
    setExtractedTxns((prev) => prev.map((t) => ({ ...t, selected: select })))
    setExtractedCash((prev) => prev.map((c) => ({ ...c, selected: select })))
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
      const created = await parseResponseJson(res, 'สร้างบัญชีไม่สำเร็จ')
      if (!created.id) throw new Error(created.error || 'สร้างบัญชีไม่สำเร็จ')

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

  // Multi-Stock & Multi-Transaction NLP AI Parser Handler
  async function handleSingleAIParse(e: React.FormEvent) {
    e.preventDefault()
    if (!nlText.trim()) return

    setParsing(true)
    setError('')
    setSuccessMsg('')
    setStatusModal({
      isOpen: true,
      type: 'loading',
      title: 'AI กำลังวิเคราะห์ข้อมูล...',
      description: 'ระบบกำลังอ่านข้อความธุรกรรม จับคู่หุ้น และแปลงอัตราแลกเปลี่ยน',
      progressStep: 'กำลังประมวลผลด้วย Gemini AI...',
    })

    try {
      const res = await fetch('/api/ai-advisor/quick-add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: nlText }),
      })

      const json = await parseResponseJson(res, 'AI Parser ยังไม่พร้อมทำงาน กรุณาลองใหม่อีกครั้ง')

      const { txns, cash } = toReviewRows(json)

      if (txns.length > 0 || cash.length > 0) {
        setExtractedTxns(txns)
        setExtractedCash(cash)
        setAiSummaryText(json.summary || `พบ ${txns.length} รายการธุรกรรมจากข้อความ`)
        setHasExtracted(true)
        setSuccessMsg(`พบ ${txns.length} รายการธุรกรรม ตรวจและเลือกรายการที่จะบันทึก`)
        setStatusModal(null)
      } else {
        setError('ไม่พบข้อมูลธุรกรรมในข้อความ กรุณาระบุรายละเอียด เช่น ชื่อย่อหุ้น จำนวน ราคา หรือคำสั่งซื้อขาย')
        setStatusModal(null)
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'เกิดข้อผิดพลาดในการวิเคราะห์ข้อความ'))
      setStatusModal(null)
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
      const normalizedGold =
        formData.assetType === 'gold'
          ? normalizeGoldTicker(
              formData.ticker,
              formData.assetType,
              formData.market === 'TH' ? 'THB' : 'USD'
            )
          : null
      const submitTicker = normalizedGold
        ? normalizedGold.ticker
        : formData.ticker.trim().toUpperCase()
      const submitMarket = normalizedGold ? normalizedGold.market : formData.market
      const submitCurrency = normalizedGold
        ? normalizedGold.currency
        : formData.market === 'TH'
        ? 'THB'
        : 'USD'
      const submitName = normalizedGold
        ? normalizedGold.assetName
        : formData.assetName.trim() || submitTicker

      const assetRes = await fetch('/api/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker: submitTicker,
          market: submitMarket,
          assetName: submitName,
          assetType: formData.assetType,
          currency: submitCurrency,
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

      mutate((key) => typeof key === 'string' && key.startsWith('/api/transactions'))
      mutate((key) => typeof key === 'string' && key.startsWith('/api/accounts'))
      mutate((key) => typeof key === 'string' && key.startsWith('/api/cash-wallet'))
      mutate((key) => typeof key === 'string' && key.startsWith('/api/portfolio'))

      const unitWord = getAssetUnitLabel(formData.ticker, formData.assetType)
      const currSymPopup = formData.market === 'TH' ? '฿' : '$'

      setStatusModal({
        isOpen: true,
        type: 'success',
        title: 'บันทึกธุรกรรมเรียบร้อยแล้ว!',
        description: `บันทึกรายการ ${formData.txnType} ${formData.ticker.toUpperCase()} จำนวน ${formData.quantity} ${unitWord} เข้าสู่ระบบเรียบร้อยแล้ว`,
        details: [
          { label: 'ประเภท', value: formData.txnType, color: 'text-indigo-400' },
          { label: 'สินทรัพย์', value: formData.ticker.toUpperCase(), color: 'text-emerald-400' },
          {
            label: 'ยอดรวม',
            value: `${currSymPopup}${Number(totalAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
            color: 'text-white',
          },
        ],
        primaryAction: {
          label: 'ดูรายการในพอร์ต',
          onClick: () => {
            setStatusModal(null)
            if (onSuccess) onSuccess()
            onClose()
            window.location.href = '/transactions'
          },
        },
        secondaryAction: {
          label: 'เสร็จสิ้น',
          onClick: () => {
            setStatusModal(null)
            if (onSuccess) onSuccess()
            onClose()
          },
        },
        autoCloseMs: 3000,
      })
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'เกิดข้อผิดพลาดในการบันทึก'))
      setStatusModal({
        isOpen: true,
        type: 'error',
        title: 'บันทึกไม่สำเร็จ',
        description: getErrorMessage(err, 'เกิดข้อผิดพลาดในการบันทึก'),
        primaryAction: { label: 'ปิด', onClick: () => setStatusModal(null) },
      })
    } finally {
      setSubmitting(false)
    }
  }

  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  const inputClass =
    'w-full bg-[#181C25] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors'
  const labelClass = 'block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1.5'

  if (!mounted) return null

  return createPortal(
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-2.5 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in"
    >
      <div className="bg-[#12151C] border border-white/10 rounded-2xl w-full max-w-2xl lg:max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[calc(100dvh-1.25rem)] sm:max-h-[90dvh]">
        {/* Modal Header */}
        <div className="shrink-0 px-4 sm:px-6 py-3.5 sm:py-4 border-b border-white/[0.08] flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white tracking-tight">
                {hasExtracted ? 'ตรวจสอบและยืนยันรายการธุรกรรม' : 'บันทึกรายการธุรกรรม'}
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                {hasExtracted
                  ? `พบ ${extractedTxns.length} รายการธุรกรรม ตรวจสอบและบันทึกพร้อมกันได้ทันที`
                  : tab === 'photos'
                  ? 'อัปโหลดสลิปหลายภาพให้ AI แกะข้อมูลอัตโนมัติ'
                  : tab === 'ai'
                  ? 'พิมพ์หรือวางสรุปรายงาน AI จะดึงข้อมูลทุกหุ้นพร้อมกัน'
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

        {/* Tab Switcher (3 Tabs) - only show when not in batch review mode */}
        {!hasExtracted && (
          <div className="shrink-0 flex bg-[#181C25] p-1 sm:p-1.5 gap-1 sm:gap-1.5 mx-4 sm:mx-6 mt-3 sm:mt-4 rounded-xl border border-white/[0.06]">
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
              <span>พิมพ์ข้อความ AI (ดึงหลายหุ้น)</span>
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
        )}

        {/* Modal Body */}
        <div className="px-4 sm:px-6 py-4 sm:py-5 overflow-y-auto overscroll-contain flex-1 min-h-0 space-y-4 sm:space-y-5">
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

          {/* ════════════════ COMMON BATCH REVIEW & SAVE SCREEN ════════════════ */}
          {hasExtracted ? (
            <div className="space-y-4">
              {/* Summary Bar */}
              <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">ผลการจัดเตรียมธุรกรรม</p>
                    <p className="text-[11px] text-zinc-300">{aiSummaryText}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAddBlankRow}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-300 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>เพิ่มรายการใหม่</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setHasExtracted(false)}
                    className="text-xs text-zinc-400 hover:text-white px-2.5 py-1.5 underline cursor-pointer"
                  >
                    ย้อนกลับ
                  </button>
                </div>
              </div>

              {/* Extracted Transactions Review Table */}
              {extractedTxns.length > 0 ? (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between px-1 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white uppercase tracking-wider">
                        รายการซื้อขาย & ปันผล ({extractedTxns.length} รายการ)
                      </span>
                      <span className="text-[11px] text-zinc-400">
                        เลือก {extractedTxns.filter((t) => t.selected).length} จาก {extractedTxns.length}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleToggleAll(true)}
                        className="text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
                      >
                        เลือกทั้งหมด
                      </button>
                      <span className="text-zinc-600">•</span>
                      <button
                        type="button"
                        onClick={() => handleToggleAll(false)}
                        className="text-[11px] text-zinc-400 hover:text-zinc-300 transition-colors cursor-pointer"
                      >
                        ยกเลิกทั้งหมด
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2.5 sm:max-h-[380px] sm:overflow-y-auto pr-1">
                    {extractedTxns.map((txn, idx) => {
                      return (
                        <div
                          key={txn.id}
                          className={`p-3.5 rounded-xl border transition-all space-y-3 ${
                            txn.selected
                              ? 'bg-[#181C25] border-white/10'
                              : 'bg-[#14161E]/40 border-white/5 opacity-60'
                          }`}
                        >
                          {/* Top Row: Checkbox, Type, Ticker, Account Selector, Trash */}
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5 flex-1 min-w-[240px]">
                              <button
                                type="button"
                                onClick={() => handleUpdateTxn(idx, { selected: !txn.selected })}
                                className="text-zinc-400 hover:text-white shrink-0 cursor-pointer"
                                title={txn.selected ? 'ยกเลิกการเลือก' : 'เลือกรายการนี้'}
                              >
                                {txn.selected ? (
                                  <CheckSquare className="w-4 h-4 text-indigo-400" />
                                ) : (
                                  <Square className="w-4 h-4" />
                                )}
                              </button>

                              {/* Transaction Type Selector */}
                              <select
                                aria-label="บัญชีธุรกรรม"
                                value={txn.txnType}
                                onChange={(e) => handleUpdateTxn(idx, { txnType: e.target.value as TransactionType })}
                                className={`text-xs font-bold px-2 py-1 rounded-lg border focus:outline-none cursor-pointer ${
                                  txn.txnType === 'BUY'
                                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                    : txn.txnType === 'SELL'
                                    ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                                    : txn.txnType === 'DIVIDEND'
                                    ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                                    : txn.txnType === 'FEE'
                                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                    : 'bg-zinc-700 text-zinc-300 border-zinc-600'
                                }`}
                              >
                                <option value="BUY" className="bg-[#181C25] text-emerald-400">ซื้อ (BUY)</option>
                                <option value="SELL" className="bg-[#181C25] text-rose-400">ขาย (SELL)</option>
                                <option value="DIVIDEND" className="bg-[#181C25] text-blue-400">ปันผล (DIVIDEND)</option>
                                <option value="FEE" className="bg-[#181C25] text-amber-400">ค่าธรรมเนียม (FEE)</option>
                                <option value="DEPOSIT" className="bg-[#181C25] text-white">ฝากเงิน (DEPOSIT)</option>
                                <option value="WITHDRAW" className="bg-[#181C25] text-white">ถอนเงิน (WITHDRAW)</option>
                              </select>

                              {/* Ticker Input */}
                              <div className="relative flex-1 min-w-[100px] max-w-[150px]">
                                <input
                                  type="text"
                                  value={txn.ticker}
                                  onChange={(e) => handleUpdateTxn(idx, { ticker: e.target.value.toUpperCase() })}
                                  placeholder="ชื่อย่อหุ้น"
                                  className="w-full uppercase font-mono font-bold text-xs bg-[#12151C] border border-white/10 rounded-lg px-2.5 py-1 text-white focus:outline-none focus:border-indigo-500"
                                />
                              </div>

                              {/* Asset Type Badge & Name */}
                              <select
                                value={txn.assetType}
                                onChange={(e) => {
                                  const nextType = e.target.value as AssetType
                                  if (nextType === 'gold') {
                                    const norm = normalizeGoldTicker(txn.ticker || 'XAU', 'gold', txn.currency)
                                    handleUpdateTxn(idx, {
                                      assetType: 'gold',
                                      ticker: norm?.ticker || 'XAU',
                                      assetName: norm?.assetName || 'Dime! Gold 99.99% (USD/oz)',
                                      market: norm?.market || 'US',
                                      currency: norm?.currency || 'USD',
                                    })
                                  } else {
                                    handleUpdateTxn(idx, { assetType: nextType })
                                  }
                                }}
                                className={`text-[10px] font-bold px-1.5 py-1 rounded-lg border focus:outline-none cursor-pointer ${
                                  txn.assetType === 'gold'
                                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                    : txn.assetType === 'crypto'
                                    ? 'bg-orange-500/15 text-orange-300 border-orange-500/30'
                                    : 'bg-[#12151C] text-zinc-400 border-white/10'
                                }`}
                              >
                                <option value="stock">STOCK</option>
                                <option value="fund">ETF/FUND</option>
                                <option value="gold">🪙 GOLD</option>
                                <option value="crypto">CRYPTO</option>
                                <option value="bond">BOND</option>
                              </select>

                              <span className="text-[11px] text-zinc-400 truncate hidden md:inline max-w-[140px]">
                                {txn.assetName}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {/* Account Dropdown */}
                              <select
                                value={txn.matchedAccountId}
                                onChange={(e) => {
                                  const val = e.target.value
                                  const matched = accounts.find((a) => a.id === val)
                                  handleUpdateTxn(idx, {
                                    matchedAccountId: val,
                                    accountName: matched?.accountName || txn.accountName,
                                    currency: matched?.currency || txn.currency,
                                  })
                                }}
                                className="text-[11px] bg-[#12151C] border border-white/10 rounded-lg px-2 py-1 text-zinc-300 focus:outline-none cursor-pointer max-w-[160px] truncate"
                              >
                                <option value="">เลือกบัญชี</option>
                                {accounts.filter((acc) => !txn.currency || acc.currency === txn.currency).map((acc) => (
                                  <option key={acc.id} value={acc.id}>
                                    {acc.accountName} ({acc.currency})
                                  </option>
                                ))}
                              </select>

                              {/* Delete Row Button */}
                              <button
                                type="button"
                                onClick={() => handleRemoveTxn(idx)}
                                className="p-1 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                title="ลบรายการนี้"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Bottom Row: Quantity, Price, Fee, Date, Calculated Total */}
                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2 border-t border-white/[0.04] text-xs">
                            <div>
                              <label className="text-[10px] text-zinc-400 block mb-0.5">
                                จำนวน ({getAssetUnitLabel(txn.ticker, txn.assetType)})
                              </label>
                              <input
                                type="number"
                                step="any"
                                value={txn.quantity}
                                onFocus={(e) => e.target.select()}
                                onBlur={(e) => {
                                  const num = parseFloat(e.target.value)
                                  if (!isNaN(num)) {
                                    e.target.value = num.toString()
                                    handleUpdateTxn(idx, { quantity: num })
                                  }
                                }}
                                onChange={(e) => handleUpdateTxn(idx, { quantity: parseFloat(e.target.value) || 0 })}
                                className="w-full bg-[#12151C] border border-white/10 rounded px-2 py-1 text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
                              />
                            </div>

                            <div>
                              <label className="text-[10px] text-zinc-400 block mb-0.5">ราคาต่อหน่วย ({txn.currency})</label>
                              <input
                                type="number"
                                step="any"
                                value={txn.pricePerUnit}
                                onFocus={(e) => e.target.select()}
                                onBlur={(e) => {
                                  const num = parseFloat(e.target.value)
                                  if (!isNaN(num)) {
                                    e.target.value = num.toString()
                                    handleUpdateTxn(idx, { pricePerUnit: num })
                                  }
                                }}
                                onChange={(e) => handleUpdateTxn(idx, { pricePerUnit: parseFloat(e.target.value) || 0 })}
                                className="w-full bg-[#12151C] border border-white/10 rounded px-2 py-1 text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
                              />
                            </div>

                            <div>
                              <div className="flex items-center justify-between mb-0.5">
                                <label className="text-[10px] text-zinc-400">ค่าคอมฯ/ธรรมเนียม</label>
                                <div className="group relative">
                                  <HelpCircle className="w-3 h-3 text-zinc-500 hover:text-indigo-400 transition-colors cursor-pointer" />
                                  <div className="absolute bottom-full right-0 mb-1.5 hidden group-hover:block w-56 p-2.5 bg-[#1F2430] border border-white/10 rounded-xl text-[10px] text-zinc-300 shadow-2xl z-30 pointer-events-none">
                                    <p className="font-bold text-white mb-1">
                                      {txn.currency === 'THB' ? '🇹🇭 หุ้นไทย (THB)' : '🇺🇸 หุ้นนอก (USD)'}
                                    </p>
                                    <p className="leading-relaxed">
                                      {txn.currency === 'THB'
                                        ? 'ยอดรวม = ค่าคอมมิชชั่น + ค่าธรรมเนียมอื่นๆ + VAT 7%'
                                        : txn.txnType === 'SELL'
                                        ? 'ยอดรวม = ค่าคอมฯ + VAT 7% + ค่าธรรมเนียมรอจ่าย (SEC Fee) + TAF Fee'
                                        : 'ยอดรวม = ค่าคอมฯ + VAT 7%'}
                                    </p>
                                  </div>
                                </div>
                              </div>
                              <input
                                type="number"
                                step="any"
                                value={txn.fee}
                                onFocus={(e) => e.target.select()}
                                onBlur={(e) => {
                                  const num = parseFloat(e.target.value)
                                  if (!isNaN(num)) {
                                    e.target.value = num.toString()
                                    handleUpdateTxn(idx, { fee: num })
                                  }
                                }}
                                onChange={(e) => handleUpdateTxn(idx, { fee: parseFloat(e.target.value) || 0 })}
                                className="w-full bg-[#12151C] border border-white/10 rounded px-2 py-1 text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
                              />
                            </div>

                            <div>
                              <label className="text-[10px] text-zinc-400 block mb-0.5">วันที่ทำรายการ</label>
                              <input
                                type="date"
                                value={txn.txnDate ? txn.txnDate.split('T')[0] : ''}
                                onChange={(e) => handleUpdateTxn(idx, { txnDate: e.target.value })}
                                className="w-full bg-[#12151C] border border-white/10 rounded px-2 py-1 text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
                              />
                            </div>

                            <div className="col-span-2 sm:col-span-1 flex flex-col justify-end text-right">
                              <span className="text-[10px] text-zinc-400">มูลค่ารวม</span>
                              <span className="font-mono font-bold text-white text-xs tabular-nums">
                                {txn.currency === 'USD' ? '$' : '฿'}
                                {Number(txn.totalAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                                {txn.currency}
                              </span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 rounded-xl bg-[#181C25] border border-white/10 text-xs text-zinc-400 space-y-3">
                  <p>ยังไม่มีรายการธุรกรรมในชุดนี้</p>
                  <button
                    type="button"
                    onClick={handleAddBlankRow}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>เพิ่มรายการแรก</span>
                  </button>
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
                          <div className="flex flex-wrap gap-2">
                            <select
                              value={cash.matchedAccountId}
                              aria-label="บัญชีสำหรับยอดเงินสด"
                              className="rounded border border-white/10 bg-[#12151C] px-2 py-1 text-white"
                              onChange={(event) => {
                                const account = accounts.find((item) => item.id === event.target.value)
                                setExtractedCash((prev) => prev.map((balance, i) => i === idx ? {
                                  ...balance,
                                  matchedAccountId: account?.id || '',
                                  accountName: account?.accountName || balance.accountName,
                                  accountType: account?.accountType || balance.accountType,
                                } : balance))
                              }}
                            >
                              <option value="">{cash.accountName || 'เลือกบัญชี'}</option>
                              {accounts.filter((account) => account.currency === cash.currency).map((account) => (
                                <option key={account.id} value={account.id}>{account.accountName}</option>
                              ))}
                            </select>
                            <input
                              type="date"
                              value={cash.balanceDate?.slice(0, 10) || ''}
                              aria-label="วันที่ยอดเงินสด"
                              className="rounded border border-white/10 bg-[#12151C] px-2 py-1 text-white"
                              onChange={(event) => {
                                const date = event.target.value
                                setExtractedCash((prev) => prev.map((balance, i) => i === idx ? { ...balance, balanceDate: date } : balance))
                              }}
                            />
                          </div>
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

              {/* Error Alert placed directly above action buttons so user never misses it */}
              {error && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-start gap-2.5 text-xs text-rose-300">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* ════════════════ TAB 1: MULTI-IMAGE SCAN (AI) ════════════════ */}
              {tab === 'photos' && (
                <div className="space-y-4">
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
                    className={`border-2 border-dashed rounded-2xl text-center cursor-pointer transition-all ${
                      uploadedFiles.length > 0 ? 'p-3.5 sm:p-5' : 'p-6 sm:p-8'
                    } ${
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
                    <div
                      className={`rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto text-indigo-400 shadow-lg shadow-indigo-500/10 ${
                        uploadedFiles.length > 0 ? 'w-9 h-9 mb-2' : 'w-12 h-12 mb-3'
                      }`}
                    >
                      <UploadCloud className={uploadedFiles.length > 0 ? 'w-4 h-4' : 'w-6 h-6'} />
                    </div>
                    <p className="text-xs sm:text-sm font-bold text-white mb-0.5">
                      {uploadedFiles.length > 0
                        ? 'แตะเพื่อเพิ่มภาพสลิปอีก หรือลากรูปมาวางเพิ่ม'
                        : 'คลิกเพื่อเลือกภาพ หรือลากรูปภาพมาวางที่นี่'}
                    </p>
                    <p className="text-[11px] sm:text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
                      รองรับการส่งพร้อมกันหลายภาพ (สลิปซื้อ, สลิปขาย, ปันผล, หรือหน้ากระเป๋าเงินสด)
                    </p>
                    <div className="mt-2.5 hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 text-[11px] text-zinc-400">
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
                          type="button"
                          onClick={clearAllFiles}
                          className="text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
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
                                className="absolute top-1 right-1 p-1 rounded-md bg-black/75 hover:bg-rose-600 text-white opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity cursor-pointer"
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
                    </div>
                  )}
                </div>
              )}

              {/* ════════════════ TAB 2: AI TEXT PROMPT ════════════════ */}
              {tab === 'ai' && (
                <form id="ai-parse-form" onSubmit={handleSingleAIParse} className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className={labelClass}>รายละเอียดธุรกรรม (ภาษาธรรมชาติ / สรุปรายงานหลายหุ้น)</label>
                      <span className="text-[10px] font-semibold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                        ดึงได้หลายหุ้นพร้อมกัน
                      </span>
                    </div>
                    <textarea
                      className={`${inputClass} min-h-[140px] resize-none font-mono text-xs`}
                      placeholder="วางข้อความรายงานสรุป หรือพิมพ์หลายรายการ เช่น:&#10;• ซื้อ NVDA 10 หุ้น 120 USD ค่าคอม 2&#10;• ซื้อทอง Dime 100 USD ราคา 3,850 หรือ ออมทองใน Dime 0.025 oz&#10;• ขาย MU 0.319 หุ้น ราคา 1034 USD&#10;• รับปันผล GOOGL 0.44 USD วันที่ 15 ก.ย. 69 บัญชี Dime! USD"
                      value={nlText}
                      onChange={(e) => setNlText(e.target.value)}
                      disabled={parsing}
                      autoFocus
                    />
                  </div>

                  <div className="p-3.5 rounded-xl bg-[#181C25] border border-white/[0.06] text-xs text-zinc-400 space-y-1.5">
                    <p className="font-semibold text-indigo-400 flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
                      <HelpCircle className="w-3.5 h-3.5" />
                      รองรับการบันทึกทีเดียวหลายหุ้นหลายรายการ
                    </p>
                    <p className="text-[11px]">• สามารถวางสรุปรายงานการซื้อขายประจำเดือน/ปี (แปลง พ.ศ. 2568, 2569 เป็น ค.ศ. อัตโนมัติ)</p>
                    <p className="text-[11px]">• สกัดทุกหุ้นและประเภทธุรกรรม (ซื้อ, ขาย, ปันผล, ค่าธรรมเนียม) ลงตารางให้อัตโนมัติ</p>
                    <p className="text-[11px]">• คุณสามารถตรวจสอบ ปรับเปลี่ยนราคา/จำนวน หรือเพิ่มรายการเองได้ก่อนบันทึก</p>
                  </div>
                </form>
              )}

              {/* ════════════════ TAB 3: MANUAL STANDARD FORM ════════════════ */}
              {tab === 'manual' && (
                <div className="space-y-4">
                  {/* Multi-Row Batch Switcher Banner */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                    <div className="flex items-center gap-2.5">
                      <Layers className="w-4 h-4 text-indigo-400 shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-white">ต้องการบันทึกหลายหุ้นพร้อมกัน?</p>
                        <p className="text-[11px] text-zinc-400">เปิดตารางกรอกหลายรายการ เพื่อเพิ่ม 2, 3, 5+ หุ้นและบันทึกทีเดียว</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const initialItem: ExtractedTxn = {
                          id: `manual_${Date.now()}_1`,
                          selected: true,
                          txnType: formData.txnType,
                          ticker: formData.ticker.trim().toUpperCase() || '',
                          assetName: formData.assetName.trim() || formData.ticker.trim().toUpperCase() || '',
                          market: formData.market,
                          assetType: formData.assetType,
                          quantity: quantityNum > 0 ? quantityNum : 1,
                          pricePerUnit: priceNum > 0 ? priceNum : 0,
                          fee: feeNum,
                          taxWithheld: taxNum,
                          totalAmount: Number(totalAmount) || 0,
                          currency: formData.market === 'TH' ? 'THB' : 'USD',
                          txnDate: formData.txnDate || new Date().toISOString().split('T')[0],
                          matchedAccountId: accountId,
                          accountName: accounts.find((a) => a.id === accountId)?.accountName || 'Dime! USD',
                          note: formData.note,
                          confidence: 1.0,
                        }
                        setExtractedTxns([initialItem])
                        setAiSummaryText('โหมดกรอกข้อมูลหลายรายการพร้อมกัน (Multi-Entry Table)')
                        setHasExtracted(true)
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-md shadow-indigo-600/20 shrink-0 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>เปิดตารางหลายรายการ</span>
                    </button>
                  </div>

                  <form onSubmit={handleManualSubmit} id="manual-form" className="space-y-4">
                    {/* Quick Asset Category Selector (Supports Dime! Gold 99.99% & Thai Gold 96.5%) */}
                    <div>
                      <label className={labelClass}>ประเภทสินทรัพย์ที่ต้องการบันทึก</label>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                        {[
                          {
                            id: 'US' as const,
                            label: '🇺🇸 หุ้นสหรัฐฯ',
                            active: formData.market === 'US' && formData.assetType !== 'gold',
                          },
                          {
                            id: 'TH' as const,
                            label: '🇹🇭 หุ้นไทย / กองทุน',
                            active: formData.market === 'TH' && formData.assetType !== 'gold',
                          },
                          {
                            id: 'DIME_GOLD' as const,
                            label: '🪙 ทอง Dime! 99.99%',
                            active:
                              formData.assetType === 'gold' && !isThai965GoldTicker(formData.ticker),
                          },
                          {
                            id: 'THAI_GOLD' as const,
                            label: '🥇 ทองไทย 96.5%',
                            active:
                              formData.assetType === 'gold' && isThai965GoldTicker(formData.ticker),
                          },
                          {
                            id: 'CRYPTO' as const,
                            label: '₿ คริปโต',
                            active: formData.market === 'CRYPTO' || formData.assetType === 'crypto',
                          },
                        ].map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => selectManualCategory(opt.id)}
                            className={`px-2.5 py-2 rounded-xl text-[11px] font-bold border transition-all cursor-pointer text-center ${
                              opt.active
                                ? opt.id === 'DIME_GOLD' || opt.id === 'THAI_GOLD'
                                  ? 'bg-amber-500/20 text-amber-200 border-amber-400/50 shadow-sm'
                                  : 'bg-indigo-600/25 text-indigo-200 border-indigo-400/50 shadow-sm'
                                : 'bg-[#181C25] text-zinc-400 hover:text-white border-white/[0.08]'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

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
                  <label className={labelClass}>{isGoldMode ? 'ประเภทสินทรัพย์' : 'ตลาด'}</label>
                  {isGoldMode ? (
                    <select
                      className={inputClass}
                      value={isThai965GoldTicker(formData.ticker) ? 'GOLD965' : 'XAU'}
                      onChange={(e) =>
                        selectManualCategory(e.target.value === 'GOLD965' ? 'THAI_GOLD' : 'DIME_GOLD')
                      }
                    >
                      <option value="XAU">🪙 ทอง Dime! 99.99% (USD/oz)</option>
                      <option value="GOLD965">🥇 ทองไทย 96.5% (THB/บาททอง)</option>
                    </select>
                  ) : (
                    <select
                      className={inputClass}
                      value={formData.market}
                      onChange={(e) => {
                        const nextMkt = e.target.value as Market
                        setFormData({
                          ...formData,
                          market: nextMkt,
                          assetType: nextMkt === 'CRYPTO' ? 'crypto' : 'stock',
                        })
                      }}
                    >
                      <option value="US">หุ้นสหรัฐ</option>
                      <option value="TH">หุ้นไทย / กองทุน</option>
                      <option value="CRYPTO">คริปโต</option>
                    </select>
                  )}
                </div>
                <div className="col-span-1 sm:col-span-2">
                  <label className={labelClass}>
                    {isGoldMode ? 'รหัสอ้างอิงทองคำ *' : 'ชื่อย่อสินทรัพย์ *'}
                  </label>
                  <input
                    type="text"
                    className={`${inputClass} font-mono uppercase font-semibold`}
                    placeholder={isGoldMode ? 'XAU หรือ GOLD965' : 'GOOGL, MU, AAPL, BTC'}
                    value={formData.ticker}
                    onChange={(e) => setFormData({ ...formData, ticker: e.target.value.toUpperCase() })}
                    required
                  />
                </div>
              </div>

              {/* Dime! Gold Live Price & Smart Unit/Spend Calculator */}
              {isGoldMode && (
                <div className="p-3.5 rounded-xl bg-amber-500/[0.07] border border-amber-500/25 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs">
                      <span className="font-bold text-amber-300 flex items-center gap-1.5">
                        🪙 ตัวช่วยคำนวณทองคำ ({isThai965GoldTicker(formData.ticker) ? 'ไทย 96.5%' : 'Dime! Gold 99.99%'})
                      </span>
                      {goldLiveQuote && goldLiveQuote.xauUsdPerOz > 0 && (
                        <p className="text-[11px] text-amber-200/80 font-mono mt-0.5">
                          Spot โลก: ${goldLiveQuote.xauUsdPerOz.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/oz
                          {' • '}USD/THB ฿{goldLiveQuote.usdThbRate.toFixed(2)}
                          {' • '}96.5% ≈ ฿{goldLiveQuote.thai965ThbPerBaht.toLocaleString()}/บาททอง
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => fetchLiveGoldPrice(true)}
                      disabled={fetchingGoldPrice}
                      className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/30 transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      {fetchingGoldPrice ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <TrendingUp className="w-3 h-3" />
                      )}
                      <span>ดึงราคาทองสด</span>
                    </button>
                  </div>

                  {/* Mode Pills */}
                  <div className="flex flex-wrap gap-1.5 text-[11px]">
                    {(isThai965GoldTicker(formData.ticker)
                      ? [
                          { id: 'weight_oz' as const, label: '⚖️ กรอกเป็นบาททอง' },
                          { id: 'amount_thb' as const, label: '฿ กรอกยอดเงินบาท' },
                          { id: 'weight_grams' as const, label: '📏 กรอกเป็นกรัม' },
                        ]
                      : [
                          { id: 'amount_usd' as const, label: '$ กรอกยอดเงิน USD' },
                          { id: 'amount_thb' as const, label: '฿ กรอกยอดเงินบาท (THB)' },
                          { id: 'weight_oz' as const, label: '⚖️ กรอกน้ำหนัก (oz)' },
                          { id: 'weight_grams' as const, label: '📏 กรอกน้ำหนัก (กรัม)' },
                        ]
                    ).map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setGoldInputMode(m.id)
                          setGoldCalcInput('')
                        }}
                        className={`px-2.5 py-1 rounded-lg font-semibold border transition-all cursor-pointer ${
                          goldInputMode === m.id
                            ? 'bg-amber-400/25 text-amber-100 border-amber-300/50'
                            : 'bg-black/30 text-zinc-400 hover:text-white border-white/[0.06]'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>

                  {goldInputMode !== 'weight_oz' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-end">
                      <div>
                        <label className="text-[11px] text-amber-200/90 block mb-1">
                          {goldInputMode === 'amount_usd'
                            ? 'จำนวนเงินที่ซื้อ/ขาย (USD)'
                            : goldInputMode === 'amount_thb'
                            ? 'จำนวนเงินที่ซื้อ/ขาย (THB)'
                            : 'น้ำหนักทองคำ (กรัม)'}
                        </label>
                        <input
                          type="number"
                          step="any"
                          value={goldCalcInput}
                          onChange={(e) => setGoldCalcInput(e.target.value)}
                          placeholder={
                            goldInputMode === 'amount_usd'
                              ? 'เช่น 100.00'
                              : goldInputMode === 'amount_thb'
                              ? 'เช่น 3500'
                              : 'เช่น 1.55'
                          }
                          className="w-full bg-[#12151C] border border-amber-400/30 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-400"
                        />
                      </div>
                      <div className="text-[11px] text-amber-200/80 font-mono pb-2">
                        {quantityNum > 0
                          ? `➔ น้ำหนักที่บันทึก: ${quantityNum} ${getAssetUnitLabel(
                              formData.ticker,
                              formData.assetType
                            )} (${formatGoldWeightSublabel(
                              quantityNum,
                              formData.ticker,
                              formData.assetType
                            )})`
                          : 'ใส่จำนวนเงิน/น้ำหนัก + ราคาต่อหน่วย เพื่อคำนวณอัตโนมัติ'}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Quantity & Price */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className={labelClass}>
                    จำนวน ({getAssetUnitLabel(formData.ticker, formData.assetType)}) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    className={`${inputClass} font-mono`}
                    placeholder={isGoldMode ? '0.000000' : '0.00'}
                    value={formData.quantity}
                    onChange={(e) => {
                      if (isGoldMode) setGoldInputMode('weight_oz')
                      setFormData({ ...formData, quantity: e.target.value })
                    }}
                    required
                  />
                  {isGoldMode && quantityNum > 0 && (
                    <p className="text-[11px] text-amber-300/80 font-mono mt-1">
                      {formatGoldWeightSublabel(quantityNum, formData.ticker, formData.assetType)}
                    </p>
                  )}
                </div>
                <div>
                  <label className={labelClass}>
                    {isGoldMode
                      ? isThai965GoldTicker(formData.ticker)
                        ? 'ราคาต่อบาททอง (THB) *'
                        : 'ราคาทองต่อออนซ์ (USD/oz) *'
                      : 'ราคาต่อหน่วย *'}
                  </label>
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
                  <div className="flex items-center justify-between mb-1">
                    <label className={labelClass}>ค่าธรรมเนียม</label>
                    <button
                      type="button"
                      onClick={() => setShowFeeCalculator(!showFeeCalculator)}
                      className="inline-flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 font-medium transition-colors cursor-pointer"
                    >
                      <Calculator className="w-3 h-3" />
                      <span>{showFeeCalculator ? 'ซ่อนตัวช่วยคำนวณ' : 'แจกแจงค่าธรรมเนียม'}</span>
                    </button>
                  </div>
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

              {/* Fee Breakdown Calculator Expandable Box */}
              {showFeeCalculator && (
                <div className="p-3.5 rounded-xl bg-[#141722] border border-indigo-500/20 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Calculator className="w-3.5 h-3.5 text-indigo-400" />
                      แจกแจงค่าธรรมเนียม ({isThaiMarket ? 'หุ้นไทย THB' : 'หุ้นนอก USD'})
                    </span>
                    <span className="text-[10px] text-zinc-400 font-mono">VAT 7% อัตโนมัติ</span>
                  </div>

                  {isThaiMarket ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div>
                        <label className="text-[10px] text-zinc-400 block mb-0.5">ค่าคอมมิชชั่น (THB)</label>
                        <input
                          type="number"
                          step="any"
                          placeholder="0.00"
                          value={feeBreakdown.commission}
                          onChange={(e) => setFeeBreakdown({ ...feeBreakdown, commission: e.target.value })}
                          className="w-full bg-[#12151C] border border-white/10 rounded px-2.5 py-1 text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-400 block mb-0.5">ค่าธรรมเนียมอื่นๆ ตลาดฯ (THB)</label>
                        <input
                          type="number"
                          step="any"
                          placeholder="0.00"
                          value={feeBreakdown.otherFees}
                          onChange={(e) => setFeeBreakdown({ ...feeBreakdown, otherFees: e.target.value })}
                          className="w-full bg-[#12151C] border border-white/10 rounded px-2.5 py-1 text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div className="sm:col-span-2 text-[10px] text-zinc-400 font-mono">
                        + VAT 7%: ฿{vatCalculated.toFixed(2)} THB
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div>
                        <label className="text-[10px] text-zinc-400 block mb-0.5">ค่าคอมมิชชั่น (USD)</label>
                        <input
                          type="number"
                          step="any"
                          placeholder="0.00"
                          value={feeBreakdown.commission}
                          onChange={(e) => setFeeBreakdown({ ...feeBreakdown, commission: e.target.value })}
                          className="w-full bg-[#12151C] border border-white/10 rounded px-2.5 py-1 text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-400 block mb-0.5">VAT 7% (คำนวณจากคอมฯ)</label>
                        <input
                          type="text"
                          readOnly
                          value={`$${vatCalculated.toFixed(4)}`}
                          className="w-full bg-[#12151C]/60 border border-white/5 rounded px-2.5 py-1 text-zinc-400 font-mono text-xs cursor-not-allowed"
                        />
                      </div>
                      {isSellTxn && (
                        <>
                          <div>
                            <label className="text-[10px] text-zinc-400 block mb-0.5">ค่าธรรมเนียมตลาดฯ (SEC Fee)</label>
                            <input
                              type="number"
                              step="any"
                              placeholder="0.00"
                              value={feeBreakdown.secFee}
                              onChange={(e) => setFeeBreakdown({ ...feeBreakdown, secFee: e.target.value })}
                              className="w-full bg-[#12151C] border border-white/10 rounded px-2.5 py-1 text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-zinc-400 block mb-0.5">ค่าธรรมเนียมการขาย (TAF Fee)</label>
                            <input
                              type="number"
                              step="any"
                              placeholder="0.00"
                              value={feeBreakdown.tafFee}
                              onChange={(e) => setFeeBreakdown({ ...feeBreakdown, tafFee: e.target.value })}
                              className="w-full bg-[#12151C] border border-white/10 rounded px-2.5 py-1 text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
                            />
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
                    <div className="text-[11px] text-zinc-300 font-mono">
                      รวมค่าธรรมเนียม:{' '}
                      <span className="font-bold text-white">
                        {isThaiMarket ? '฿' : '$'}
                        {totalBreakdownFee.toFixed(2)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setFormData({ ...formData, fee: totalBreakdownFee.toFixed(2) })
                        setShowFeeCalculator(false)
                      }}
                      className="px-3 py-1 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors cursor-pointer"
                    >
                      นำไปใช้ในฟอร์ม
                    </button>
                  </div>
                </div>
              )}

              {/* Total Box */}
              <div className="p-4 rounded-xl bg-[#181C25] border border-white/[0.06] flex items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] text-zinc-400 font-semibold uppercase tracking-wider">
                    ยอดรวมโดยประมาณ
                  </p>
                  <p className="text-[11px] text-zinc-400 font-mono mt-0.5">
                    {formData.txnType === 'SELL'
                      ? '(จำนวน × ราคา) - ค่าธรรมเนียม - ภาษี'
                      : formData.txnType === 'DIVIDEND'
                      ? '(จำนวน × ราคา) - ภาษีหัก ณ ที่จ่าย'
                      : formData.txnType === 'FEE'
                      ? 'ค่าธรรมเนียม'
                      : '(จำนวน × ราคา) + ค่าธรรมเนียม'}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xl font-bold text-white font-mono tabular-nums">
                    {formData.market === 'TH' ? '฿' : '$'}
                    {isNaN(Number(totalAmount)) ? '0.00' : Number(totalAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
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
          </div>
        )}
      </>
    )}
  </div>

        {/* Sticky Modal Footer Action Bar (Always reachable on mobile & desktop) */}
        {(hasExtracted || tab !== 'photos' || uploadedFiles.length > 0) && (
          <div className="shrink-0 border-t border-white/[0.08] bg-[#12151C]/95 backdrop-blur-md px-4 sm:px-6 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {hasExtracted ? (
              <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => setHasExtracted(false)}
                  className="text-xs text-zinc-400 hover:text-white px-3 py-2.5 rounded-xl border border-white/10 hover:bg-white/[0.04] transition-colors cursor-pointer"
                >
                  ย้อนกลับ
                </button>
                <button
                  type="button"
                  onClick={handleAddBlankRow}
                  className="inline-flex items-center justify-center gap-1.5 text-xs text-indigo-300 hover:text-white px-3 py-2.5 border border-white/10 rounded-xl hover:bg-white/[0.04] transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>เพิ่มอีกรายการ</span>
                </button>
                <button
                  type="button"
                  onClick={handleBatchSave}
                  disabled={
                    submitting ||
                    (extractedTxns.filter((t) => t.selected).length === 0 &&
                      extractedCash.filter((c) => c.selected).length === 0)
                  }
                  className="w-full sm:w-auto sm:flex-1 bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-600/25 cursor-pointer"
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
            ) : tab === 'photos' && uploadedFiles.length > 0 ? (
              <button
                type="button"
                onClick={handleAnalyzeMultiImages}
                disabled={parsing}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/25 cursor-pointer"
              >
                {parsing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>AI กำลังวิเคราะห์สลิปทั้ง {uploadedFiles.length} ภาพ...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>วิเคราะห์ข้อมูลทุกภาพด้วย AI ({uploadedFiles.length} ภาพ)</span>
                  </>
                )}
              </button>
            ) : tab === 'ai' ? (
              <button
                type="submit"
                form="ai-parse-form"
                disabled={parsing || !nlText.trim()}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/25 cursor-pointer"
              >
                {parsing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>AI กำลังวิเคราะห์ข้อความและแยกทุกรายการธุรกรรม...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>วิเคราะห์ข้อความด้วย AI (ดึงทุกหุ้นพร้อมกัน)</span>
                  </>
                )}
              </button>
            ) : tab === 'manual' ? (
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl text-xs text-zinc-400 hover:text-white border border-white/10 hover:bg-white/[0.04] transition-colors cursor-pointer"
                  disabled={submitting}
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  form="manual-form"
                  disabled={submitting}
                  className="flex-1 sm:flex-initial bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 px-6 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/25 cursor-pointer"
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
            ) : null}
          </div>
        )}
      </div>

      {/* ── Status Modal (Loading / Success / Error Popups) ── */}
      {statusModal && (
        <StatusModal
          isOpen={statusModal.isOpen}
          type={statusModal.type}
          title={statusModal.title}
          description={statusModal.description}
          progressStep={statusModal.progressStep}
          details={statusModal.details}
          primaryAction={statusModal.primaryAction}
          secondaryAction={statusModal.secondaryAction}
          onClose={() => {
            const wasSuccess = statusModal.type === 'success'
            setStatusModal(null)
            if (wasSuccess) {
              if (onSuccess) onSuccess()
              onClose()
            }
          }}
          autoCloseMs={statusModal.autoCloseMs}
        />
      )}
    </div>,
    document.body
  )
}
