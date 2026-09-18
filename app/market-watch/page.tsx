'use client'

import React, { useState } from 'react'
import useSWR from 'swr'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/PageHeader'
import type { MarketQuote } from '@/lib/market-data/types'
import { AddWatchlistModal } from '@/components/market-watch/AddWatchlistModal'
import { StockDetailModal } from '@/components/market-watch/StockDetailModal'
import {
  Coins,
  Building2,
  Landmark,
  ArrowRightLeft,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  DollarSign,
  Star,
  Plus,
  Trash2,
  Sparkles,
} from 'lucide-react'

interface WatchlistWithQuote {
  id: string
  userId: string
  symbol: string
  displayName: string
  itemType: string
  sortOrder: number
  addedAt: string
  market?: string
  quote: MarketQuote | null
}

export default function MarketWatchPage() {
  // 1. Fetch general market data
  const {
    data,
    isLoading,
    error,
    mutate: revalidate,
    isValidating,
  } = useSWR('/api/market-watch', {
    refreshInterval: 60000,
  })

  // 2. Fetch user's personal watchlist
  const {
    data: watchlistData,
    isLoading: isWatchlistLoading,
    mutate: mutateWatchlist,
  } = useSWR<{ items: WatchlistWithQuote[] }>('/api/watchlist', {
    refreshInterval: 45000,
  })

  const [convAmount, setConvAmount] = useState('100')
  const [convFrom, setConvFrom] = useState('USD')
  const [convTo, setConvTo] = useState('THB')
  const [isFlipping, setIsFlipping] = useState(false)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [starringSymbol, setStarringSymbol] = useState<string | null>(null)
  const [selectedStock, setSelectedStock] = useState<{
    symbol: string
    name?: string
    market?: string
  } | null>(null)

  const watchlistItems: WatchlistWithQuote[] = watchlistData?.items ?? []
  const existingSymbols = watchlistItems.map((item) => item.symbol)

  const fxList: MarketQuote[] = Array.isArray(data?.fxAndCommodities) ? data.fxAndCommodities : []
  const usdItem = fxList.find((f) => f.symbol?.includes('USD / THB'))
  const usdRate = usdItem?.price as number | undefined

  function calculateConversion(): string {
    const amt = parseFloat(convAmount) || 0
    if (convFrom === convTo) return amt.toFixed(2)
    if (!usdRate) return '--'
    if (convFrom === 'USD' && convTo === 'THB') return (amt * usdRate).toFixed(2)
    if (convFrom === 'THB' && convTo === 'USD') return (amt / usdRate).toFixed(2)
    return (amt * 1).toFixed(2)
  }

  const handleSwapCurrencies = () => {
    setIsFlipping(true)
    setTimeout(() => setIsFlipping(false), 300)
    const temp = convFrom
    setConvFrom(convTo)
    setConvTo(temp)
  }

  // 1-Click Star Toggle
  const handleToggleStar = async (
    quote: MarketQuote,
    itemType = 'stock',
    market = 'US'
  ) => {
    const cleanSym = quote.symbol.trim().toUpperCase()
    const existing = watchlistItems.find((w) => w.symbol.toUpperCase() === cleanSym)

    setStarringSymbol(cleanSym)

    try {
      if (existing) {
        // Optimistic remove
        mutateWatchlist(
          { items: watchlistItems.filter((w) => w.id !== existing.id) },
          false
        )
        await fetch(`/api/watchlist/${existing.id}`, { method: 'DELETE' })
      } else {
        // Optimistic add
        const tempItem: WatchlistWithQuote = {
          id: `temp-${Date.now()}`,
          userId: 'me',
          symbol: cleanSym,
          displayName: quote.name || cleanSym,
          itemType,
          sortOrder: watchlistItems.length,
          addedAt: new Date().toISOString(),
          market,
          quote,
        }
        mutateWatchlist({ items: [...watchlistItems, tempItem] }, false)

        await fetch('/api/watchlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            symbol: cleanSym,
            displayName: quote.name || cleanSym,
            itemType,
            market,
          }),
        })
      }
    } catch (err) {
      console.error('[handleToggleStar error]', err)
    } finally {
      mutateWatchlist()
      setStarringSymbol(null)
    }
  }

  // Quick Add from chip
  const handleQuickAdd = async (symbol: string, itemType?: string, market?: string) => {
    const cleanSym = symbol.trim().toUpperCase()
    if (existingSymbols.some((s) => s.toUpperCase() === cleanSym)) return

    try {
      await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: cleanSym,
          itemType,
          market,
        }),
      })
      mutateWatchlist()
    } catch (err) {
      console.error('[handleQuickAdd error]', err)
    }
  }

  // Delete Watchlist Item
  const handleDeleteWatchlistItem = async (id: string) => {
    try {
      mutateWatchlist(
        { items: watchlistItems.filter((w) => w.id !== id) },
        false
      )
      await fetch(`/api/watchlist/${id}`, { method: 'DELETE' })
    } catch (err) {
      console.error('[handleDeleteWatchlistItem error]', err)
    } finally {
      mutateWatchlist()
    }
  }

  const sections = [
    {
      key: 'crypto',
      label: 'สินทรัพย์คริปโต (Cryptocurrency)',
      icon: Coins,
      color: 'text-amber-400',
      itemType: 'crypto',
      market: 'GLOBAL',
      data: data?.crypto ?? [],
    },
    {
      key: 'usStocks',
      label: 'หุ้นสหรัฐฯ (US Equities)',
      icon: Building2,
      color: 'text-blue-400',
      itemType: 'stock',
      market: 'US',
      data: data?.usStocks ?? [],
    },
    {
      key: 'thStocks',
      label: 'หุ้นไทย (Thai SET Equities)',
      icon: Landmark,
      color: 'text-emerald-400',
      itemType: 'stock',
      market: 'TH',
      data: data?.thStocks ?? [],
    },
    {
      key: 'fxAndCommodities',
      label: 'อัตราแลกเปลี่ยนและสินค้าโภคภัณฑ์ (FX & Commodities)',
      icon: DollarSign,
      color: 'text-cyan-400',
      itemType: 'gold',
      market: 'GLOBAL',
      data: data?.fxAndCommodities ?? [],
    },
  ]

  const inputClass =
    'w-full bg-[#181C25] border border-white/[0.1] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all font-mono'

  return (
    <AppShell>
      <div className="space-y-6 max-w-[1600px] mx-auto w-full animate-fade-in">
        {/* Header */}
        <PageHeader
          eyebrow="Real-Time Quotes"
          title="กระดานจับตาตลาดการเงิน"
          description="ติดตามราคาตลาดสดแบบเรียลไทม์ หุ้นที่คุณสนใจ หุ้นสหรัฐฯ หุ้นไทย คริปโตเคอร์เรนซี และอัตราแลกเปลี่ยน"
          action={
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl font-semibold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-indigo-600/30 active:scale-98"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>เพิ่มหุ้นที่สนใจ</span>
              </button>

              <button
                onClick={() => {
                  revalidate()
                  mutateWatchlist()
                }}
                disabled={isValidating}
                className="bg-[#181C25] hover:bg-[#202532] text-slate-300 hover:text-white border border-white/[0.1] disabled:opacity-50 px-4 py-2 rounded-xl font-semibold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-sm"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 text-indigo-400 ${isValidating ? 'animate-spin' : ''}`}
                />
                <span>{isValidating ? 'กำลังดึงราคา...' : 'รีเฟรชราคาตลาด'}</span>
              </button>
            </div>
          }
        />

        {/* ============================================================ */}
        {/* PERSONAL WATCHLIST SECTION */}
        {/* ============================================================ */}
        <div className="p-6 sm:p-7 rounded-2xl bg-[#12151C] border border-white/[0.08] shadow-xl shadow-black/40 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
                <Star className="w-4.5 h-4.5 fill-amber-400/40 text-amber-400" />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-base font-bold text-white tracking-tight">
                    หุ้นและสินทรัพย์ที่กำลังจับตา (Watchlist)
                  </h2>
                  {watchlistItems.length > 0 && (
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono text-[11px] font-bold">
                      {watchlistItems.length} รายการ
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  ติดตามราคาตลาดสดของสินทรัพย์ที่คุณเลือกไว้ พร้อมอัปเดตราคาแบบอัตโนมัติ
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="self-start sm:self-auto px-4 py-2 rounded-xl bg-[#181C25] hover:bg-[#202532] text-amber-300 hover:text-white border border-amber-500/30 hover:border-amber-500/50 font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-98"
            >
              <Plus className="w-3.5 h-3.5 text-amber-400" />
              <span>+ เพิ่มหุ้นที่สนใจ</span>
            </button>
          </div>

          {/* Watchlist Content */}
          {isWatchlistLoading ? (
            <div className="py-12 flex items-center justify-center gap-2.5 text-slate-500 text-xs">
              <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
              <span>กำลังดึงข้อมูลรายการที่สนใจของคุณ...</span>
            </div>
          ) : watchlistItems.length === 0 ? (
            /* Empty State */
            <div className="py-8 px-6 sm:px-10 rounded-xl bg-[#181C25]/40 border border-dashed border-white/[0.08] flex flex-col items-center text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shadow-inner">
                <Star className="w-6 h-6 fill-amber-400/20" />
              </div>
              <div className="max-w-md space-y-1">
                <h3 className="text-sm font-bold text-white">
                  ยังไม่มีหุ้นในรายการจับตาของคุณ
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  คลิกปุ่มด้านบน หรือคลิกชิปด่วนด้านล่างเพื่อเพิ่มหุ้นสหรัฐฯ หุ้นไทย หรือคริปโตที่คุณต้องการติดตามราคาตลาดสด
                </p>
              </div>

              {/* Quick Add Chips */}
              <div className="pt-2 flex flex-col sm:flex-row items-center gap-2">
                <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  เพิ่มด่วน:
                </span>
                <div className="flex flex-wrap items-center justify-center gap-1.5">
                  {[
                    { sym: 'NVDA', type: 'stock', market: 'US' },
                    { sym: 'AAPL', type: 'stock', market: 'US' },
                    { sym: 'TSLA', type: 'stock', market: 'US' },
                    { sym: 'PTT', type: 'stock', market: 'TH' },
                    { sym: 'DELTA', type: 'stock', market: 'TH' },
                    { sym: 'BTC', type: 'crypto', market: 'GLOBAL' },
                    { sym: 'GOLD', type: 'gold', market: 'GLOBAL' },
                  ].map((chip) => (
                    <button
                      key={chip.sym}
                      type="button"
                      onClick={() => handleQuickAdd(chip.sym, chip.type, chip.market)}
                      className="px-2.5 py-1 rounded-lg bg-[#181C25] hover:bg-amber-500/15 text-slate-300 hover:text-amber-300 border border-white/[0.08] hover:border-amber-500/30 text-xs font-mono font-semibold transition-all cursor-pointer active:scale-95"
                    >
                      +{chip.sym}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Populated Watchlist Grid */
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {watchlistItems.map((item) => (
                <WatchlistCard
                  key={item.id}
                  item={item}
                  onDelete={() => handleDeleteWatchlistItem(item.id)}
                  onSelect={() =>
                    setSelectedStock({
                      symbol: item.symbol,
                      name: item.displayName || item.quote?.name,
                      market: item.market,
                    })
                  }
                />
              ))}
            </div>
          )}
        </div>

        {/* Currency Converter Card */}
        <div className="p-6 sm:p-7 rounded-2xl bg-[#12151C] border border-white/[0.08] shadow-xl shadow-black/40">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">
                เครื่องมือแปลงสกุลเงิน (FX Converter)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                คำนวณอัตราแลกเปลี่ยนระหว่าง USD และ THB แบบเรียลไทม์
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-11 gap-4 items-end">
            <div className="md:col-span-3">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                จำนวนเงิน
              </label>
              <input
                type="number"
                step="any"
                className={inputClass}
                value={convAmount}
                onChange={(e) => setConvAmount(e.target.value)}
              />
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                จากสกุลเงิน
              </label>
              <select
                className={inputClass}
                value={convFrom}
                onChange={(e) => setConvFrom(e.target.value)}
              >
                <option value="USD" className="bg-[#12151C] text-white">
                  USD - ดอลลาร์สหรัฐ
                </option>
                <option value="THB" className="bg-[#12151C] text-white">
                  THB - บาทไทย
                </option>
              </select>
            </div>

            <div className="md:col-span-1 flex items-center justify-center pb-1">
              <button
                type="button"
                onClick={handleSwapCurrencies}
                className="w-10 h-10 rounded-xl bg-[#181C25] border border-white/[0.1] hover:bg-[#202532] text-indigo-400 hover:text-white transition-all flex items-center justify-center cursor-pointer active:scale-95"
                title="สลับสกุลเงิน"
              >
                <ArrowRightLeft
                  className={`w-4 h-4 transition-transform duration-300 ${
                    isFlipping ? 'rotate-180 scale-110' : ''
                  }`}
                />
              </button>
            </div>

            <div className="md:col-span-4">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                เป็นสกุลเงิน
              </label>
              <select
                className={inputClass}
                value={convTo}
                onChange={(e) => setConvTo(e.target.value)}
              >
                <option value="THB" className="bg-[#12151C] text-white">
                  THB - บาทไทย
                </option>
                <option value="USD" className="bg-[#12151C] text-white">
                  USD - ดอลลาร์สหรัฐ
                </option>
              </select>
            </div>
          </div>

          <div className="mt-5 p-4 sm:p-5 rounded-xl bg-[#181C25] border border-white/[0.06] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <span className="text-[11px] text-slate-400 font-medium">
                อัตราแลกเปลี่ยนอ้างอิงล่าสุด
              </span>
              <p className="text-xs font-mono text-slate-200 font-semibold mt-1">
                {usdRate
                  ? `1 USD = ${usdRate.toFixed(4)} THB`
                  : 'กำลังรอข้อมูลอัตราแลกเปลี่ยน'}
              </p>
            </div>
            <div className="text-left sm:text-right">
              <span className="text-[11px] text-slate-400 font-medium">
                ผลลัพธ์คำนวณสุทธิ
              </span>
              <p className="text-2xl sm:text-3xl font-bold text-white tabular-nums font-mono mt-0.5">
                {Number(calculateConversion()).toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                })}{' '}
                <span className="text-sm font-semibold text-indigo-400 ml-1">
                  {convTo}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Market Sections */}
        {isLoading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            <span className="text-xs font-medium">กำลังดึงข้อมูลราคาตลาดสด...</span>
          </div>
        ) : error ? (
          <div className="py-16 p-8 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex flex-col items-center justify-center text-center">
            <p className="text-rose-300 text-xs mb-3">
              ไม่สามารถเชื่อมต่อข้อมูลราคาตลาดได้ในขณะนี้
            </p>
            <button
              onClick={() => revalidate()}
              className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-semibold text-white"
            >
              ลองอีกครั้ง
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {sections.map((section) => {
              const Icon = section.icon
              if (!section.data || section.data.length === 0) return null

              return (
                <div key={section.key} className="space-y-3.5">
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${section.color}`} />
                    <h3 className="text-sm font-bold text-white tracking-tight">
                      {section.label}
                    </h3>
                    <div className="ml-auto flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-[10px] text-emerald-300 font-mono font-semibold tracking-wider">
                        LIVE
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {section.data.map((q: MarketQuote) => {
                      const cleanSym = q.symbol.trim().toUpperCase()
                      const isStarred = existingSymbols.some(
                        (s) => s.toUpperCase() === cleanSym
                      )
                      const isStarring = starringSymbol === cleanSym

                      return (
                        <QuoteCard
                          key={q.symbol}
                          quote={q}
                          isStarred={isStarred}
                          isStarring={isStarring}
                          onToggleStar={() =>
                            handleToggleStar(q, section.itemType, section.market)
                          }
                          onSelect={() =>
                            setSelectedStock({
                              symbol: q.symbol,
                              name: q.name,
                              market: section.market,
                            })
                          }
                        />
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Interactive Add Watchlist Modal */}
      <AddWatchlistModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => mutateWatchlist()}
        existingSymbols={existingSymbols}
      />

      {/* Interactive Stock Detail & AI Insights Modal */}
      <StockDetailModal
        isOpen={Boolean(selectedStock)}
        onClose={() => setSelectedStock(null)}
        symbol={selectedStock?.symbol ?? null}
        initialName={selectedStock?.name}
        market={selectedStock?.market}
      />
    </AppShell>
  )
}

/**
 * Dedicated Watchlist Card for user's tracked assets
 */
function WatchlistCard({
  item,
  onDelete,
  onSelect,
}: {
  item: WatchlistWithQuote
  onDelete: () => void
  onSelect?: () => void
}) {
  const quote = item.quote
  const price = quote?.price
  const changePercent = quote?.changePercent ?? 0
  const isPositive = changePercent >= 0
  const isZero = changePercent === 0

  return (
    <div
      onClick={onSelect}
      className="p-4 sm:p-5 rounded-2xl bg-[#12151C] border border-amber-500/20 hover:border-amber-500/50 hover:bg-[#151922] transition-all duration-200 group flex flex-col justify-between shadow-xl shadow-black/30 min-h-[148px] relative cursor-pointer active:scale-[0.99]"
    >
      {/* Top Header: Badge & Delete Button */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-bold tracking-wider">
            {item.market === 'TH'
              ? 'TH'
              : item.itemType === 'crypto'
              ? 'CRYPTO'
              : item.itemType === 'gold'
              ? 'GOLD'
              : 'US'}
          </span>

          {/* Unstar / Delete Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            title="ถอนออกจากรายการจับตา"
            className="w-7 h-7 rounded-lg bg-white/[0.04] hover:bg-rose-500/20 hover:text-rose-400 text-slate-400 flex items-center justify-center transition-all cursor-pointer opacity-70 hover:opacity-100 shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Ticker Symbol & Company Name (Full Width, never squeezed by buttons) */}
        <div className="min-w-0">
          <h4 className="font-bold text-white text-base sm:text-lg group-hover:text-amber-300 transition-colors font-mono tracking-tight truncate">
            {item.symbol}
          </h4>
          <p
            className="text-[11px] text-slate-400 truncate mt-0.5 font-normal"
            title={item.displayName || quote?.name || item.symbol}
          >
            {item.displayName || quote?.name || item.symbol}
          </p>
        </div>
      </div>

      {/* Bottom Row: Price and % Change */}
      <div className="mt-3 pt-2.5 border-t border-white/[0.05] flex items-center justify-between gap-1">
        <span className="text-base sm:text-lg font-bold text-white font-mono tabular-nums tracking-tight">
          {price !== undefined ? (
            <>
              {quote?.currency === 'THB' ? '฿' : '$'}
              {Number(price).toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: price < 1 ? 4 : 2,
              })}
            </>
          ) : (
            <span className="text-slate-500 text-xs font-normal">กำลังดึงราคา...</span>
          )}
        </span>

        <span
          className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[11px] font-mono font-bold border shrink-0 ${
            isZero
              ? 'bg-slate-800 text-slate-400 border-slate-700'
              : isPositive
              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
              : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
          }`}
        >
          {isPositive ? (
            <ArrowUpRight className="w-3 h-3" />
          ) : (
            <ArrowDownRight className="w-3 h-3" />
          )}
          {isPositive ? '+' : ''}
          {changePercent.toFixed(2)}%
        </span>
      </div>
    </div>
  )
}

/**
 * Standard Market Quote Card with 1-Click Star Toggle
 */
function QuoteCard({
  quote,
  isStarred,
  isStarring,
  onToggleStar,
  onSelect,
}: {
  quote: MarketQuote
  isStarred?: boolean
  isStarring?: boolean
  onToggleStar?: () => void
  onSelect?: () => void
}) {
  const isPositive = (quote.changePercent ?? 0) >= 0
  const isZero = (quote.changePercent ?? 0) === 0

  return (
    <div
      onClick={onSelect}
      className="p-4 sm:p-5 rounded-2xl bg-[#12151C] border border-white/[0.08] hover:border-indigo-500/40 hover:bg-[#151922] transition-all duration-200 group flex flex-col justify-between shadow-xl shadow-black/30 min-h-[120px] relative cursor-pointer active:scale-[0.99]"
    >
      <div>
        <div className="flex items-start justify-between mb-3">
          <div className="min-w-0 pr-2">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-white text-sm sm:text-base group-hover:text-indigo-300 transition-colors truncate block">
                {quote.symbol}
              </span>
              {/* Star toggle button */}
              {onToggleStar && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onToggleStar()
                  }}
                  disabled={isStarring}
                  title={isStarred ? 'ถอนออกจากรายการจับตา' : 'เพิ่มเข้าในรายการจับตา'}
                  className="text-slate-500 hover:text-amber-400 p-0.5 rounded cursor-pointer transition-colors"
                >
                  {isStarring ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                  ) : (
                    <Star
                      className={`w-3.5 h-3.5 transition-transform active:scale-125 ${
                        isStarred
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-slate-500 hover:text-amber-400'
                      }`}
                    />
                  )}
                </button>
              )}
            </div>
            <span className="text-[11px] text-slate-400 truncate block mt-0.5">
              {quote.name ?? quote.symbol}
            </span>
          </div>

          <span
            className={`flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[11px] font-mono font-bold shrink-0 border ${
              isZero
                ? 'bg-slate-800 text-slate-400 border-slate-700'
                : isPositive
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
            }`}
          >
            {isPositive ? (
              <ArrowUpRight className="w-3 h-3" />
            ) : (
              <ArrowDownRight className="w-3 h-3" />
            )}
            {isPositive ? '+' : ''}
            {(quote.changePercent ?? 0).toFixed(2)}%
          </span>
        </div>
      </div>

      <div className="mt-2 pt-2.5 border-t border-white/[0.04] flex items-baseline justify-between">
        <span className="text-base sm:text-lg font-bold text-white font-mono tabular-nums">
          {quote.currency === 'THB' ? '฿' : '$'}
          {Number(quote.price).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: quote.price < 1 ? 4 : 2,
          })}
        </span>
        <span className="text-[10px] text-slate-500 font-mono uppercase">
          {quote.currency ?? 'USD'}
        </span>
      </div>
    </div>
  )
}
