'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  X,
  Search,
  Star,
  Loader2,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Building2,
  Coins,
  DollarSign,
  Landmark,
} from 'lucide-react'
import type { MarketQuote } from '@/lib/market-data/types'
import { StockLogo } from '@/components/StockLogo'

interface AddWatchlistModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  existingSymbols: string[]
}

type MarketCategory = 'US' | 'TH' | 'crypto' | 'gold'

const POPULAR_SUGGESTIONS: Record<MarketCategory, { symbol: string; name: string }[]> = {
  US: [
    { symbol: 'NVDA', name: 'NVIDIA' },
    { symbol: 'AAPL', name: 'Apple' },
    { symbol: 'TSLA', name: 'Tesla' },
    { symbol: 'MSFT', name: 'Microsoft' },
    { symbol: 'GOOGL', name: 'Alphabet' },
    { symbol: 'PLTR', name: 'Palantir' },
    { symbol: 'AMZN', name: 'Amazon' },
  ],
  TH: [
    { symbol: 'PTT', name: 'PTT Public' },
    { symbol: 'DELTA', name: 'Delta Electronics' },
    { symbol: 'CPALL', name: 'CP ALL' },
    { symbol: 'BDMS', name: 'Bangkok Dusit' },
    { symbol: 'KBANK', name: 'Kasikornbank' },
    { symbol: 'AOT', name: 'Airports of Thailand' },
  ],
  crypto: [
    { symbol: 'BTC', name: 'Bitcoin' },
    { symbol: 'ETH', name: 'Ethereum' },
    { symbol: 'SOL', name: 'Solana' },
    { symbol: 'BNB', name: 'Binance Coin' },
    { symbol: 'DOGE', name: 'Dogecoin' },
    { symbol: 'XRP', name: 'XRP' },
  ],
  gold: [
    { symbol: 'GOLD', name: 'Gold (XAU/USD)' },
  ],
}

export function AddWatchlistModal({
  isOpen,
  onClose,
  onSuccess,
  existingSymbols,
}: AddWatchlistModalProps) {
  const [category, setCategory] = useState<MarketCategory>('US')
  const [searchQuery, setSearchQuery] = useState('')
  const [customName, setCustomName] = useState('')
  const [hasUserEditedName, setHasUserEditedName] = useState(false)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [previewQuote, setPreviewQuote] = useState<MarketQuote | null>(null)
  const [selectedAssetType, setSelectedAssetType] = useState<string>('all')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Lock body scroll while modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  const [detectedItemType, setDetectedItemType] = useState<string>('stock')
  const [resolvedMarket, setResolvedMarket] = useState<string>('US')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('')
      setCustomName('')
      setHasUserEditedName(false)
      setPreviewQuote(null)
      setErrorMessage(null)
      setHasSearched(false)
    }
  }, [isOpen])

  // ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Debounced search for live quote
  const fetchLiveQuote = useCallback(async (query: string, cat: MarketCategory) => {
    const clean = query.trim().toUpperCase()
    if (!clean) {
      setPreviewQuote(null)
      setErrorMessage(null)
      setIsLoadingPreview(false)
      setHasSearched(false)
      return
    }

    setIsLoadingPreview(true)
    setErrorMessage(null)
    setHasSearched(true)

    try {
      const typeParam = cat === 'crypto' ? 'crypto' : cat === 'gold' ? 'gold' : 'stock'
      const marketParam = cat === 'TH' ? 'TH' : cat === 'US' ? 'US' : ''
      const res = await fetch(
        `/api/watchlist/search?q=${encodeURIComponent(clean)}&type=${typeParam}&market=${marketParam}`
      )
      const data = await res.json()

      if (data.previewQuote) {
        setPreviewQuote(data.previewQuote)
        setDetectedItemType(data.itemType || typeParam)
        setResolvedMarket(data.market || (cat === 'TH' ? 'TH' : 'US'))
        if (!hasUserEditedName) {
          setCustomName(data.previewQuote.name || '')
        }
      } else {
        setPreviewQuote(null)
        setErrorMessage('ไม่พบข้อมูลราคาตลาดของสัญลักษณ์นี้ โปรดตรวจสอบตัวสะกด')
      }
    } catch (err) {
      console.error('[AddWatchlistModal] search error', err)
      setErrorMessage('เกิดข้อผิดพลาดในการตรวจสอบราคาตลาด')
    } finally {
      setIsLoadingPreview(false)
    }
  }, [hasUserEditedName])

  // Effect for typing debounce
  useEffect(() => {
    if (!searchQuery.trim()) {
      setPreviewQuote(null)
      setErrorMessage(null)
      setHasSearched(false)
      return
    }

    const timer = setTimeout(() => {
      fetchLiveQuote(searchQuery, category)
    }, 450)

    return () => clearTimeout(timer)
  }, [searchQuery, category, fetchLiveQuote])

  if (!isOpen) return null

  const isAlreadyInWatchlist =
    previewQuote &&
    existingSymbols.some(
      (s) => s.toUpperCase() === (previewQuote.symbol || searchQuery).trim().toUpperCase()
    )

  const handleSelectSuggestion = (sym: string) => {
    setSearchQuery(sym)
    setCustomName('')
    setHasUserEditedName(false)
    fetchLiveQuote(sym, category)
  }

  const handleCategoryChange = (newCat: MarketCategory) => {
    setCategory(newCat)
    if (searchQuery.trim()) {
      fetchLiveQuote(searchQuery, newCat)
    }
  }

  const handleAdd = async () => {
    if (!previewQuote && !searchQuery.trim()) return
    const symbolToAdd = (previewQuote?.symbol || searchQuery).trim().toUpperCase()

    if (existingSymbols.some((s) => s.toUpperCase() === symbolToAdd)) {
      setErrorMessage(`สัญลักษณ์ "${symbolToAdd}" อยู่ในรายการที่สนใจแล้ว`)
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const res = await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: symbolToAdd,
          displayName: customName.trim() || previewQuote?.name || symbolToAdd,
          itemType: detectedItemType,
          market: resolvedMarket,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'ไม่สามารถเพิ่มรายการได้')
      }

      onSuccess()
      onClose()
    } catch (err: any) {
      setErrorMessage(err.message || 'เกิดข้อผิดพลาดในการบันทึก')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen || !mounted) return null

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/85 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-xl bg-[#12151C] border border-white/[0.12] rounded-2xl sm:rounded-3xl shadow-2xl shadow-black/95 p-6 sm:p-7 overflow-hidden z-10 flex flex-col gap-5 max-h-[90vh] overflow-y-auto my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Glow Accent */}
        <div className="absolute top-0 right-1/4 -translate-y-1/2 w-72 h-36 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-inner">
              <Star className="w-5 h-5 fill-amber-400/30" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                เพิ่มหุ้นและสินทรัพย์ที่สนใจ
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                ติดตามราคาตลาดสดแบบเรียลไทม์ในหน้ากระดานส่วนตัวของคุณ
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/[0.04] hover:bg-white/[0.1] border border-white/[0.08] text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Category Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-1 bg-[#181C25] rounded-xl border border-white/[0.06]">
          {[
            { id: 'US', label: 'หุ้นสหรัฐฯ', icon: Building2 },
            { id: 'TH', label: 'หุ้นไทย (SET)', icon: Landmark },
            { id: 'crypto', label: 'คริปโต', icon: Coins },
            { id: 'gold', label: 'ทองคำ/โภคภัณฑ์', icon: DollarSign },
          ].map((cat) => {
            const Icon = cat.icon
            const active = category === cat.id
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleCategoryChange(cat.id as MarketCategory)}
                className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  active
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{cat.label}</span>
              </button>
            )
          })}
        </div>

        {/* Input Bar */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-slate-300">
            สัญลักษณ์หรือชื่อย่อหุ้น (Ticker Symbol)
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                category === 'US'
                  ? 'เช่น NVDA, AAPL, TSLA, MSFT, PLTR'
                  : category === 'TH'
                  ? 'เช่น PTT, DELTA, CPALL, BDMS, KBANK'
                  : category === 'crypto'
                  ? 'เช่น BTC, ETH, SOL, BNB, DOGE'
                  : 'เช่น GOLD'
              }
              className="w-full bg-[#181C25] border border-white/[0.1] rounded-xl pl-10 pr-10 py-3 text-sm text-white placeholder:text-slate-500 font-mono focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all uppercase"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('')
                  setPreviewQuote(null)
                  setErrorMessage(null)
                }}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Quick Suggestion Chips */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-400" />
            ตัวเลือกยอดนิยมในหมวดนี้:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {POPULAR_SUGGESTIONS[category].map((item) => (
              <button
                key={item.symbol}
                type="button"
                onClick={() => handleSelectSuggestion(item.symbol)}
                className={`text-xs px-2.5 py-1 rounded-lg border transition-all cursor-pointer font-mono font-medium ${
                  searchQuery.toUpperCase() === item.symbol
                    ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300'
                    : 'bg-[#181C25] border-white/[0.06] text-slate-300 hover:bg-[#202532] hover:text-white'
                }`}
              >
                +{item.symbol}
              </button>
            ))}
          </div>
        </div>

        {/* Live Preview Box */}
        <div className="min-h-[110px]">
          {isLoadingPreview ? (
            <div className="p-6 rounded-2xl bg-[#181C25] border border-white/[0.06] flex items-center justify-center gap-3 text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
              <span className="text-xs font-medium">กำลังตรวจสอบราคาตลาดแบบเรียลไทม์...</span>
            </div>
          ) : previewQuote ? (
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-[#181C25] to-[#141720] border border-emerald-500/30 shadow-lg space-y-3 animate-fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-semibold text-emerald-300">
                    พบข้อมูลตลาดสด (Verified Quote)
                  </span>
                </div>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-white/[0.06] text-slate-400 border border-white/[0.08]">
                  {previewQuote.provider} • {previewQuote.currency}
                </span>
              </div>

              <div className="flex items-start justify-between pt-1">
                <div className="flex items-center gap-3">
                  <StockLogo
                    ticker={previewQuote.symbol}
                    name={previewQuote.name}
                    size={40}
                    className="rounded-xl shadow-md shrink-0"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-bold text-white font-mono">
                        {previewQuote.symbol}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 font-medium">
                        {resolvedMarket === 'TH' ? 'หุ้นไทย' : category === 'crypto' ? 'คริปโต' : category === 'gold' ? 'ทองคำ' : 'หุ้นสหรัฐฯ'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {previewQuote.name || previewQuote.symbol}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xl sm:text-2xl font-bold text-white font-mono tabular-nums">
                    {previewQuote.currency === 'THB' ? '฿' : '$'}
                    {Number(previewQuote.price).toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: previewQuote.price < 1 ? 4 : 2,
                    })}
                  </div>
                  <span
                    className={`inline-flex items-center gap-0.5 text-xs font-mono font-bold mt-0.5 ${
                      (previewQuote.changePercent ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {(previewQuote.changePercent ?? 0) >= 0 ? (
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    ) : (
                      <ArrowDownRight className="w-3.5 h-3.5" />
                    )}
                    {(previewQuote.changePercent ?? 0) >= 0 ? '+' : ''}
                    {(previewQuote.changePercent ?? 0).toFixed(2)}%
                  </span>
                </div>
              </div>

              {/* Custom Display Name (Optional) */}
              <div className="pt-2 border-t border-white/[0.06]">
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  ชื่อแสดงในรายการ (กำหนดชื่อเรียกได้เอง)
                </label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => {
                    setCustomName(e.target.value)
                    setHasUserEditedName(true)
                  }}
                  placeholder="เช่น NVIDIA, ปตท., หรือชื่อที่ต้องการ"
                  className="w-full bg-[#12151C] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          ) : hasSearched && errorMessage ? (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-3 text-rose-300 text-xs">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          ) : (
            <div className="p-6 rounded-2xl bg-[#181C25]/50 border border-dashed border-white/[0.08] text-center text-slate-500 text-xs flex flex-col items-center justify-center gap-1">
              <span>พิมพ์สัญลักษณ์หรือเลือกจากปุ่มด้านบนเพื่อตรวจสอบราคาตลาดสด</span>
            </div>
          )}
        </div>

        {/* Warning if already in watchlist */}
        {isAlreadyInWatchlist && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>สัญลักษณ์นี้มีอยู่ในรายการที่สนใจของคุณเรียบร้อยแล้ว</span>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/[0.08]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-[#181C25] hover:bg-[#202532] text-slate-300 hover:text-white border border-white/[0.08] text-xs font-semibold transition-all cursor-pointer"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={handleAdd}
            disabled={!previewQuote || isAlreadyInWatchlist || isSubmitting}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 transition-all cursor-pointer active:scale-98"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Star className="w-4 h-4 fill-white" />
            )}
            <span>เพิ่มในรายการที่สนใจ</span>
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
