'use client'

import React from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { TrendingUp, TrendingDown, ArrowRight } from 'lucide-react'

export interface TickerItem {
  symbol: string
  name: string
  price: number
  changePercent: number
  change?: number
  currency: 'USD' | 'THB' | 'PTS'
  category: 'index' | 'crypto' | 'stock' | 'commodity' | 'fx'
}

const DEFAULT_FALLBACK_TICKERS: TickerItem[] = [
  { symbol: 'SET INDEX', name: 'ตลาดหุ้นไทย', price: 1583.34, changePercent: 1.32, currency: 'PTS', category: 'index' },
  { symbol: 'S&P 500', name: 'ดัชนีสหรัฐฯ', price: 7634.97, changePercent: 1.10, currency: 'USD', category: 'index' },
  { symbol: 'NASDAQ', name: 'หุ้นเทคโนโลยี', price: 26399.90, changePercent: 1.62, currency: 'USD', category: 'index' },
  { symbol: 'BTC', name: 'Bitcoin', price: 76670.0, changePercent: 1.14, currency: 'USD', category: 'crypto' },
  { symbol: 'ETH', name: 'Ethereum', price: 2467.94, changePercent: 2.97, currency: 'USD', category: 'crypto' },
  { symbol: 'SOL', name: 'Solana', price: 101.36, changePercent: 4.33, currency: 'USD', category: 'crypto' },
  { symbol: 'GOLD (XAU)', name: 'ทองคำโลก', price: 4398.70, changePercent: 0.26, currency: 'USD', category: 'commodity' },
  { symbol: 'NVDA', name: 'NVIDIA', price: 218.93, changePercent: 2.35, currency: 'USD', category: 'stock' },
  { symbol: 'PTT', name: 'ปตท.', price: 42.25, changePercent: 0.60, currency: 'THB', category: 'stock' },
  { symbol: 'USD / THB', name: 'ดอลลาร์/บาท', price: 33.31, changePercent: 0, currency: 'THB', category: 'fx' },
  { symbol: 'EUR / THB', name: 'ยูโร/บาท', price: 38.45, changePercent: 0, currency: 'THB', category: 'fx' },
]

function getCategoryIcon(item: TickerItem) {
  if (item.symbol.includes('SET') || item.symbol === 'PTT' || item.symbol === 'DELTA') return '🇹🇭'
  if (item.symbol === 'S&P 500' || item.symbol === 'NASDAQ' || item.symbol === 'NVDA' || item.symbol === 'AAPL' || item.symbol === 'TSLA') return '🇺🇸'
  if (item.category === 'crypto') return '🪙'
  if (item.category === 'commodity') return '🥇'
  if (item.category === 'fx') return '💱'
  return '📈'
}

function formatPrice(price: number, currency: string) {
  if (currency === 'PTS') {
    return `${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} pts`
  }
  if (currency === 'USD') {
    return `$${price.toLocaleString('en-US', {
      minimumFractionDigits: price < 10 ? 4 : 2,
      maximumFractionDigits: price < 10 ? 4 : 2,
    })}`
  }
  return `฿${price.toLocaleString('en-US', {
    minimumFractionDigits: price < 1 ? 4 : 2,
    maximumFractionDigits: price < 1 ? 4 : 2,
  })}`
}

export function TickerTape() {
  const { data } = useSWR<{ items: TickerItem[] }>('/api/market-data/ticker', {
    refreshInterval: 45000, // Refresh real prices every 45s
    revalidateOnFocus: true,
  })

  const items = (data?.items && data.items.length > 0) ? data.items : DEFAULT_FALLBACK_TICKERS
  const duplicated = [...items, ...items]

  return (
    <div className="w-full h-9 relative overflow-hidden bg-[#0c0e15] border-b border-white/[0.08] text-xs select-none z-30 shadow-inner">
      {/* ── Fixed Left Badge (Live Indicator) ────────────────── */}
      <div className="absolute left-0 inset-y-0 z-30 px-3 sm:px-3.5 bg-[#0c0e15]/95 backdrop-blur-md flex items-center gap-2 border-r border-white/[0.08] shadow-[4px_0_12px_rgba(0,0,0,0.6)]">
        <img src="/logo.png" alt="Logo" className="w-4 h-4 object-contain rounded-sm" />
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        <span className="font-bold text-[10px] tracking-wider text-emerald-400 uppercase hidden sm:inline font-mono">
          LIVE MARKETS
        </span>
      </div>

      {/* ── Marquee Continuous Track ────────────────────────── */}
      <div
        className="overflow-hidden pl-16 sm:pl-36 pr-10"
        style={{
          maskImage: 'linear-gradient(to right, transparent, black 40px, black calc(100% - 40px), transparent)',
          WebkitMaskImage: 'linear-gradient(to right, transparent, black 40px, black calc(100% - 40px), transparent)',
        }}
      >
        <div className="animate-marquee h-9 items-center gap-6 sm:gap-7 py-1">
          {duplicated.map((item, idx) => {
            const isPositive = item.changePercent > 0
            const isNegative = item.changePercent < 0
            const isZero = item.changePercent === 0

            return (
              <Link
                key={`${item.symbol}-${idx}`}
                href="/market-watch"
                className="flex items-center gap-2 group cursor-pointer no-underline whitespace-nowrap transition-transform hover:scale-[1.02]"
                title={`${item.name} (${item.symbol})`}
              >
                <span className="text-xs">{getCategoryIcon(item)}</span>

                <span className="font-bold text-white tracking-wide text-xs group-hover:text-indigo-400 transition-colors">
                  {item.symbol}
                </span>

                <span className="text-zinc-300 font-mono font-medium text-xs tabular-nums">
                  {formatPrice(item.price, item.currency)}
                </span>

                {!isZero ? (
                  <span
                    className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold tabular-nums border ${
                      isPositive
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                    }`}
                  >
                    {isPositive ? (
                      <TrendingUp className="w-2.5 h-2.5" />
                    ) : (
                      <TrendingDown className="w-2.5 h-2.5" />
                    )}
                    <span>
                      {isPositive ? '+' : ''}
                      {item.changePercent.toFixed(2)}%
                    </span>
                  </span>
                ) : (
                  <span className="text-[10px] text-zinc-500 font-mono">
                    0.00%
                  </span>
                )}

                <span className="text-zinc-700 ml-3">•</span>
              </Link>
            )
          })}
        </div>
      </div>

      {/* ── Fixed Right Shortcut ────────────────────────────── */}
      <Link
        href="/market-watch"
        className="absolute right-0 inset-y-0 z-30 px-3 bg-[#0c0e15]/95 backdrop-blur-md flex items-center gap-1 border-l border-white/[0.08] text-[10px] font-medium text-zinc-400 hover:text-white transition-colors no-underline hidden md:flex"
        title="ดูภาพรวมตลาดทั้งหมด"
      >
        <span>ตลาด</span>
        <ArrowRight className="w-3 h-3" />
      </Link>
    </div>
  )
}
