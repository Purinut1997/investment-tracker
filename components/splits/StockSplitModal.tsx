'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import useSWR, { mutate } from 'swr'
import {
  Scissors,
  X,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Trash2,
  ArrowRight,
  Ban,
  Sparkles,
} from 'lucide-react'

export interface SplitModalHoldingInput {
  assetId: string
  ticker: string
  assetName: string
  market: string
  currency: string
  quantity: number
  avgCost: number
  totalCost: number
  currentPrice: number
}

interface AssetOption {
  id: string
  ticker: string
  assetName: string
  market: string
  currency: string
  assetType?: string
}

interface StoredSplitRow {
  id: string
  assetId: string
  userId: string | null
  splitDate: string
  numerator: number
  denominator: number
  splitRatio: string
  source: 'auto_yahoo' | 'manual'
  note: string | null
  asset: AssetOption
}

export interface StockSplitModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
  initialAssetId?: string
  initialTicker?: string
  holdings?: SplitModalHoldingInput[]
}

const FORWARD_PRESETS = [
  { label: '2:1', num: 2, den: 1 },
  { label: '4:1', num: 4, den: 1 },
  { label: '5:1', num: 5, den: 1 },
  { label: '8:1', num: 8, den: 1 },
  { label: '10:1', num: 10, den: 1 },
]

const REVERSE_PRESETS = [
  { label: '1:5', num: 1, den: 5 },
  { label: '1:10', num: 1, den: 10 },
  { label: '1:20', num: 1, den: 20 },
]

function formatThaiSplitDate(isoDate: string): string {
  const d = new Date(isoDate)
  if (isNaN(d.getTime())) return isoDate
  return d.toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

async function revalidateAllPortfolioViews() {
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.removeItem('port_summary_cache_v1')
    } catch {}
  }
  await Promise.all([
    mutate('/api/splits'),
    mutate('/api/portfolio/summary'),
    mutate('/api/portfolio/performance-summary'),
    mutate((key) => typeof key === 'string' && key.startsWith('/api/transactions')),
  ])
}

export function StockSplitModal({
  isOpen,
  onClose,
  onSuccess,
  initialAssetId,
  initialTicker,
  holdings,
}: StockSplitModalProps) {
  const [mounted, setMounted] = useState(false)
  const [selectedAssetId, setSelectedAssetId] = useState('')
  const [manualTicker, setManualTicker] = useState('')
  const [manualMarket, setManualMarket] = useState<'US' | 'TH' | 'CRYPTO'>('US')
  const [splitMode, setSplitMode] = useState<'forward' | 'reverse'>('forward')
  const [numerator, setNumerator] = useState('8')
  const [denominator, setDenominator] = useState('1')
  const [splitDate, setSplitDate] = useState(() => new Date().toISOString().split('T')[0])
  const [note, setNote] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [syncBanner, setSyncBanner] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  const { data: splitsData, isLoading: splitsLoading } = useSWR<{
    assets: AssetOption[]
    splits: StoredSplitRow[]
  }>(isOpen ? '/api/splits' : null, { revalidateOnFocus: false })

  const { data: liveSummaryData } = useSWR<{ holdings: SplitModalHoldingInput[] }>(
    isOpen && !holdings ? '/api/portfolio/summary' : null,
    { revalidateOnFocus: false }
  )

  const effectiveHoldings = useMemo(
    () => holdings || liveSummaryData?.holdings || [],
    [holdings, liveSummaryData]
  )

  const assetOptions = useMemo(() => {
    const map = new Map<string, AssetOption>()
    for (const a of splitsData?.assets || []) {
      map.set(a.id, a)
    }
    for (const h of effectiveHoldings) {
      if (!map.has(h.assetId)) {
        map.set(h.assetId, {
          id: h.assetId,
          ticker: h.ticker,
          assetName: h.assetName,
          market: h.market,
          currency: h.currency,
        })
      }
    }
    return Array.from(map.values()).sort((a, b) => a.ticker.localeCompare(b.ticker))
  }, [splitsData?.assets, effectiveHoldings])

  useEffect(() => {
    if (!isOpen) return
    setErrorMsg(null)
    setSyncBanner(null)

    if (initialAssetId && assetOptions.some((a) => a.id === initialAssetId)) {
      setSelectedAssetId(initialAssetId)
      return
    }
    if (initialTicker) {
      const matched = assetOptions.find(
        (a) => a.ticker.toUpperCase() === initialTicker.trim().toUpperCase()
      )
      if (matched) {
        setSelectedAssetId(matched.id)
        return
      }
    }
    if (assetOptions.length > 0 && !selectedAssetId) {
      setSelectedAssetId(assetOptions[0].id)
    }
  }, [isOpen, initialAssetId, initialTicker, assetOptions, selectedAssetId])

  const selectedHolding = useMemo(() => {
    if (!selectedAssetId || selectedAssetId === '__MANUAL__') return null
    return effectiveHoldings.find((h) => h.assetId === selectedAssetId) || null
  }, [effectiveHoldings, selectedAssetId])

  const numVal = Number(numerator)
  const denVal = Number(denominator)
  const previewMultiplier =
    Number.isFinite(numVal) && Number.isFinite(denVal) && numVal > 0 && denVal > 0
      ? numVal / denVal
      : 1

  const sym =
    selectedHolding?.currency === 'THB' || selectedHolding?.market === 'TH' ? '฿' : '$'

  async function handleAutoSync() {
    setSyncing(true)
    setErrorMsg(null)
    setSyncBanner(null)
    try {
      const res = await fetch('/api/splits/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'ซิงค์ไม่สำเร็จ')

      await revalidateAllPortfolioViews()
      onSuccess?.()

      if (Array.isArray(json.newlyAddedSplits) && json.newlyAddedSplits.length > 0) {
        const listStr = json.newlyAddedSplits
          .map((s: any) => `${s.ticker} (${s.splitRatio} • ${s.splitDate})`)
          .join(', ')
        setSyncBanner(`ตรวจพบและปรับฐานแตกพาร์ใหม่อัตโนมัติ: ${listStr}`)
      } else if ((json.totalSplitsFound ?? 0) > 0) {
        setSyncBanner(
          `ตรวจสอบแล้วจาก ${json.syncedAssetsCount ?? 0} สินทรัพย์ — ข้อมูลแตกพาร์เป็นปัจจุบันทั้งหมด (${json.totalSplitsFound} รายการในประวัติ)`
        )
      } else {
        setSyncBanner(`ตรวจสอบจาก Yahoo Finance แล้ว ยังไม่พบการแตกพาร์เพิ่มเติม`)
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'ซิงค์ข้อมูลจาก Yahoo Finance ไม่สำเร็จ')
    } finally {
      setSyncing(false)
    }
  }

  async function handleSubmitSplit(e: React.FormEvent) {
    e.preventDefault()
    if (!Number.isFinite(numVal) || numVal <= 0 || !Number.isFinite(denVal) || denVal <= 0) {
      setErrorMsg('กรุณาระบุสัดส่วนการแตกพาร์ที่เป็นจำนวนบวก (เช่น 8 ต่อ 1 หรือ 1 ต่อ 10)')
      return
    }
    if (!splitDate) {
      setErrorMsg('กรุณาเลือกวันที่มีผลแตกพาร์ (Ex-Split Date)')
      return
    }

    const isManualTicker = selectedAssetId === '__MANUAL__' || assetOptions.length === 0
    if (isManualTicker && !manualTicker.trim()) {
      setErrorMsg('กรุณาระบุชื่อย่อหุ้น (Ticker)')
      return
    }
    if (!isManualTicker && !selectedAssetId) {
      setErrorMsg('กรุณาเลือกสินทรัพย์')
      return
    }

    setSubmitting(true)
    setErrorMsg(null)
    setSyncBanner(null)

    try {
      const payload = isManualTicker
        ? {
            ticker: manualTicker.trim().toUpperCase(),
            market: manualMarket,
            splitDate,
            numerator: numVal,
            denominator: denVal,
            note: note.trim() || undefined,
          }
        : {
            assetId: selectedAssetId,
            splitDate,
            numerator: numVal,
            denominator: denVal,
            note: note.trim() || undefined,
          }

      const res = await fetch('/api/splits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'บันทึกการแตกพาร์ไม่สำเร็จ')

      await revalidateAllPortfolioViews()
      onSuccess?.()
      setNote('')
      setSyncBanner(
        `บันทึกการปรับพาร์ ${json.asset?.ticker || ''} (${json.splitRatio}) เรียบร้อยแล้ว — ต้นทุนและจำนวนหุ้นถูกปรับอัตโนมัติ`
      )
    } catch (err: any) {
      setErrorMsg(err.message || 'เกิดข้อผิดพลาดในการบันทึก')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeleteManualSplit(id: string) {
    if (!confirm('ยืนยันลบรายการแตกพาร์ที่บันทึกเองนี้? ระบบจะคำนวณต้นทุนพอร์ตใหม่ทันที')) return
    setDeletingId(id)
    setErrorMsg(null)
    try {
      const res = await fetch(`/api/splits/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'ลบไม่สำเร็จ')
      await revalidateAllPortfolioViews()
      onSuccess?.()
    } catch (err: any) {
      setErrorMsg(err.message || 'ลบรายการไม่สำเร็จ')
    } finally {
      setDeletingId(null)
    }
  }

  async function handleCancelGlobalSplit(row: StoredSplitRow) {
    const dayStr = row.splitDate.slice(0, 10)
    if (
      !confirm(
        `ต้องการยกเลิกผลกระทบของ ${row.asset.ticker} (${row.splitRatio}) วันที่ ${formatThaiSplitDate(
          row.splitDate
        )} เฉพาะในพอร์ตของคุณใช่หรือไม่?\nระบบจะบันทึก 1:1 Override เพื่อคืนจำนวนหุ้น/ต้นทุนเดิม`
      )
    ) {
      return
    }
    setDeletingId(row.id)
    setErrorMsg(null)
    try {
      const res = await fetch('/api/splits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId: row.assetId,
          splitDate: dayStr,
          numerator: 1,
          denominator: 1,
          note: `ยกเลิกผล ${row.splitRatio} (${row.source})`,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'ยกเลิกผลไม่สำเร็จ')
      await revalidateAllPortfolioViews()
      onSuccess?.()
    } catch (err: any) {
      setErrorMsg(err.message || 'ยกเลิกผลไม่สำเร็จ')
    } finally {
      setDeletingId(null)
    }
  }

  if (!isOpen || !mounted) return null

  const inputClass =
    'w-full rounded-xl bg-[#0F1218] border border-white/[0.1] px-3.5 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-purple-500 transition-colors'

  const splitsList = splitsData?.splits || []

  const modalUi = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl bg-[#121620] border border-white/[0.12] shadow-2xl shadow-black/60 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between gap-3 bg-[#151A26] sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/20 border border-purple-500/40 text-purple-300 flex items-center justify-center shrink-0">
              <Scissors className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">
                จัดการแตกพาร์ &amp; รวมพาร์ (Stock Split Manager)
              </h2>
              <p className="text-xs text-slate-400">
                ปรับจำนวนหุ้นและต้นทุนเฉลี่ยย้อนหลังแบบ FIFO โดยไม่กระทบเงินสดในบัญชี
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 space-y-5">
          {/* Auto Sync Bar */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-950/40 via-indigo-950/30 to-[#151A26] border border-purple-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-purple-200">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span>ตรวจจับการแตกพาร์อัตโนมัติจากตลาดโลก (Yahoo Finance)</span>
              </div>
              <p className="text-[11px] text-slate-400">
                รองรับหุ้นสหรัฐฯ และหุ้นไทย เช่น SNDK (8:1), NVDA (10:1), GOOGL (20:1) โดยอัตโนมัติ
              </p>
            </div>

            <button
              type="button"
              onClick={handleAutoSync}
              disabled={syncing}
              className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-purple-600/25 transition-all cursor-pointer shrink-0"
            >
              {syncing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              <span>{syncing ? 'กำลังซิงค์...' : 'ซิงค์แตกพาร์อัตโนมัติ (Yahoo)'}</span>
            </button>
          </div>

          {/* Feedback Banners */}
          {syncBanner && (
            <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/35 text-emerald-200 text-xs flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{syncBanner}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/35 text-rose-200 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Add / Override Form */}
          <form
            onSubmit={handleSubmitSplit}
            className="p-4 sm:p-5 rounded-2xl bg-[#161B26] border border-white/[0.08] space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-white/[0.06]">
              <h3 className="text-xs sm:text-sm font-bold text-white">
                บันทึกแตกพาร์ / รวมพาร์ด้วยตัวเอง (หรือปรับทับค่าอัตโนมัติ)
              </h3>

              {/* Mode Switch */}
              <div className="flex bg-[#0F1218] p-0.5 rounded-xl border border-white/[0.08] text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setSplitMode('forward')
                    if (Number(numerator) < Number(denominator)) {
                      setNumerator('2')
                      setDenominator('1')
                    }
                  }}
                  className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                    splitMode === 'forward'
                      ? 'bg-purple-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  แตกพาร์ (Forward)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSplitMode('reverse')
                    if (Number(numerator) >= Number(denominator)) {
                      setNumerator('1')
                      setDenominator('10')
                    }
                  }}
                  className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                    splitMode === 'reverse'
                      ? 'bg-amber-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  รวมพาร์ (Reverse)
                </button>
              </div>
            </div>

            {/* Row 1: Asset + Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="text-xs text-slate-400 font-medium block mb-1.5">
                  สินทรัพย์ที่แตกพาร์ *
                </label>
                {assetOptions.length > 0 ? (
                  <select
                    className={inputClass}
                    value={selectedAssetId}
                    onChange={(e) => setSelectedAssetId(e.target.value)}
                  >
                    {assetOptions.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.ticker} — {a.assetName} ({a.market})
                      </option>
                    ))}
                    <option value="__MANUAL__">+ ระบุ Ticker เอง...</option>
                  </select>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className={`${inputClass} font-mono uppercase`}
                      placeholder="เช่น SNDK"
                      value={manualTicker}
                      onChange={(e) => setManualTicker(e.target.value.toUpperCase())}
                    />
                    <select
                      className="rounded-xl bg-[#0F1218] border border-white/[0.1] px-2.5 py-2 text-xs text-white"
                      value={manualMarket}
                      onChange={(e) => setManualMarket(e.target.value as 'US' | 'TH' | 'CRYPTO')}
                    >
                      <option value="US">US</option>
                      <option value="TH">TH</option>
                    </select>
                  </div>
                )}

                {selectedAssetId === '__MANUAL__' && assetOptions.length > 0 && (
                  <div className="flex gap-2 mt-2">
                    <input
                      type="text"
                      className={`${inputClass} font-mono uppercase`}
                      placeholder="เช่น SNDK"
                      value={manualTicker}
                      onChange={(e) => setManualTicker(e.target.value.toUpperCase())}
                    />
                    <select
                      className="rounded-xl bg-[#0F1218] border border-white/[0.1] px-2.5 py-2 text-xs text-white"
                      value={manualMarket}
                      onChange={(e) => setManualMarket(e.target.value as 'US' | 'TH' | 'CRYPTO')}
                    >
                      <option value="US">US</option>
                      <option value="TH">TH</option>
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs text-slate-400 font-medium block mb-1.5">
                  วันที่มีผลแตกพาร์ (Ex-Split Date) *
                </label>
                <input
                  type="date"
                  className={`${inputClass} font-mono`}
                  value={splitDate}
                  onChange={(e) => setSplitDate(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Row 2: Preset Chips + Numerator / Denominator */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs text-slate-400 font-medium">
                  สัดส่วน (หุ้นใหม่ : หุ้นเดิม):
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {(splitMode === 'forward' ? FORWARD_PRESETS : REVERSE_PRESETS).map((p) => {
                    const isActive =
                      Number(numerator) === p.num && Number(denominator) === p.den
                    return (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => {
                          setNumerator(String(p.num))
                          setDenominator(String(p.den))
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border transition-all cursor-pointer ${
                          isActive
                            ? 'bg-purple-600 text-white border-purple-500'
                            : 'bg-[#0F1218] text-slate-300 border-white/[0.08] hover:border-purple-400/40'
                        }`}
                      >
                        {p.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="grid grid-cols-11 gap-2 items-center">
                <div className="col-span-5">
                  <label className="text-[11px] text-slate-400 block mb-1">
                    จำนวนหุ้นใหม่ (Numerator)
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0.0001"
                    className={`${inputClass} font-mono font-bold text-center`}
                    value={numerator}
                    onChange={(e) => setNumerator(e.target.value)}
                    required
                  />
                </div>
                <div className="col-span-1 text-center text-slate-400 font-bold text-lg pt-4">:</div>
                <div className="col-span-5">
                  <label className="text-[11px] text-slate-400 block mb-1">
                    ต่อหุ้นเดิม (Denominator)
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0.0001"
                    className={`${inputClass} font-mono font-bold text-center`}
                    value={denominator}
                    onChange={(e) => setDenominator(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Live Impact Preview Card */}
            {selectedHolding && (
              <div className="p-3.5 rounded-xl bg-purple-500/[0.08] border border-purple-500/25 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-purple-200">
                    ตัวอย่างผลลัพธ์หากปรับฐานจากพอร์ตปัจจุบันของ {selectedHolding.ticker}:
                  </span>
                  <span className="font-mono text-[11px] text-purple-300 font-semibold">
                    ×{Number(previewMultiplier.toFixed(4))}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs font-mono">
                  <div className="p-2.5 rounded-lg bg-black/35 border border-white/[0.05]">
                    <span className="text-[10px] text-slate-400 font-sans block">
                      จำนวนหุ้นในพอร์ต
                    </span>
                    <div className="flex items-center gap-1.5 text-white font-bold mt-0.5">
                      <span className="text-slate-400">
                        {Number(selectedHolding.quantity).toFixed(4)}
                      </span>
                      <ArrowRight className="w-3 h-3 text-purple-400" />
                      <span className="text-emerald-300">
                        {(selectedHolding.quantity * previewMultiplier).toFixed(4)}
                      </span>
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-black/35 border border-white/[0.05]">
                    <span className="text-[10px] text-slate-400 font-sans block">
                      ต้นทุนเฉลี่ยต่อหุ้น
                    </span>
                    <div className="flex items-center gap-1.5 text-white font-bold mt-0.5">
                      <span className="text-slate-400">
                        {sym}
                        {Number(selectedHolding.avgCost).toFixed(2)}
                      </span>
                      <ArrowRight className="w-3 h-3 text-purple-400" />
                      <span className="text-indigo-300">
                        {sym}
                        {(selectedHolding.avgCost / previewMultiplier).toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-black/35 border border-white/[0.05]">
                    <span className="text-[10px] text-slate-400 font-sans block">
                      ต้นทุนรวม (คงเดิม ไม่กระทบเงินสด)
                    </span>
                    <span className="text-white font-bold mt-0.5 block">
                      {sym}
                      {Number(selectedHolding.totalCost).toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Note & Submit */}
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
              <div className="flex-1">
                <label className="text-xs text-slate-400 font-medium block mb-1.5">
                  หมายเหตุ (ไม่บังคับ)
                </label>
                <input
                  type="text"
                  className={inputClass}
                  placeholder="เช่น 8-for-1 forward stock split"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs sm:text-sm font-bold transition-all shadow-lg shadow-indigo-600/25 cursor-pointer shrink-0"
              >
                {submitting ? 'กำลังบันทึก...' : 'บันทึกการปรับพาร์'}
              </button>
            </div>
          </form>

          {/* Recorded Splits History Table */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs sm:text-sm font-bold text-white">
                ประวัติการแตกพาร์ / รวมพาร์ที่ระบบนำไปคำนวณ ({splitsList.length} รายการ)
              </h3>
              <span className="text-[11px] text-slate-400">
                รายการที่บันทึกเองในวันเดียวกันจะทับค่าอัตโนมัติ
              </span>
            </div>

            {splitsLoading ? (
              <div className="p-6 text-center text-xs text-slate-400 bg-[#161B26] rounded-2xl border border-white/[0.06]">
                กำลังโหลดข้อมูลการแตกพาร์...
              </div>
            ) : splitsList.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 bg-[#161B26] rounded-2xl border border-white/[0.06]">
                ยังไม่มีประวัติการแตกพาร์สำหรับสินทรัพย์ในพอร์ต กดปุ่ม &ldquo;ซิงค์แตกพาร์อัตโนมัติ&rdquo; ด้านบนเพื่อตรวจจับจากตลาด
              </div>
            ) : (
              <div className="border border-white/[0.08] rounded-2xl overflow-hidden bg-[#161B26]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#0F1218] text-slate-400 border-b border-white/[0.06]">
                    <tr>
                      <th className="px-4 py-2.5 font-semibold">วันที่มีผล</th>
                      <th className="px-4 py-2.5 font-semibold">สินทรัพย์</th>
                      <th className="px-4 py-2.5 font-semibold">อัตราส่วน</th>
                      <th className="px-4 py-2.5 font-semibold hidden sm:table-cell">แหล่งที่มา</th>
                      <th className="px-4 py-2.5 font-semibold text-right">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.05]">
                    {splitsList.map((row) => {
                      const isManual = row.source === 'manual'
                      const isCancelled = Math.abs(row.numerator / row.denominator - 1) < 1e-6
                      return (
                        <tr key={row.id} className="hover:bg-white/[0.02]">
                          <td className="px-4 py-2.5 font-mono text-slate-300">
                            {formatThaiSplitDate(row.splitDate)}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="font-mono font-bold text-white">
                              {row.asset?.ticker}
                            </span>
                            {row.note && (
                              <span className="text-[10px] text-slate-400 block truncate max-w-[180px]">
                                {row.note}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            <span
                              className={`px-2 py-0.5 rounded-md font-mono font-bold border ${
                                isCancelled
                                  ? 'bg-slate-700/40 text-slate-400 border-slate-600/40'
                                  : row.numerator > row.denominator
                                  ? 'bg-purple-500/20 text-purple-300 border-purple-500/35'
                                  : 'bg-amber-500/20 text-amber-300 border-amber-500/35'
                              }`}
                            >
                              {isCancelled ? '1:1 (ยกเลิกผล)' : row.splitRatio}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 hidden sm:table-cell">
                            {isManual ? (
                              <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                                ✏️ บันทึกเอง
                              </span>
                            ) : (
                              <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                ⚡ อัตโนมัติ (Yahoo)
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            {isManual ? (
                              <button
                                type="button"
                                onClick={() => handleDeleteManualSplit(row.id)}
                                disabled={deletingId === row.id}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/25 text-rose-300 border border-rose-500/25 text-[11px] font-semibold cursor-pointer disabled:opacity-40"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>ลบ</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleCancelGlobalSplit(row)}
                                disabled={deletingId === row.id}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-amber-500/20 text-slate-300 hover:text-amber-200 border border-white/[0.08] text-[11px] font-medium cursor-pointer disabled:opacity-40"
                                title="สร้าง 1:1 Override เพื่อยกเลิกผลการแตกพาร์อัตโนมัตินี้"
                              >
                                <Ban className="w-3 h-3" />
                                <span>ยกเลิกผล (1:1)</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(modalUi, document.body)
}
