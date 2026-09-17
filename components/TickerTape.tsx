'use client'

import React from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { ArrowUpRight, ArrowDownRight, Radio } from 'lucide-react'

interface TickerItem {
  symbol: string
  name?: string
  price: number
  changePercent?: number
  currency?: string
}

const DEFAULT_TICKERS: TickerItem[] = [
  { symbol: 'SET INDEX', name: 'ตลาดหุ้นไทย', price: 1438.2, changePercent: 0.48, currency: 'THB' },
  { symbol: 'S&P 500', name: 'US Market', price: 5864.67, changePercent: 0.65, currency: 'USD' },
  { symbol: 'BTC', name: 'Bitcoin', price: 64280.0, changePercent: 2.4, currency: 'USD' },
  { symbol: 'ETH', name: 'Ethereum', price: 3450.5, changePercent: 1.85, currency: 'USD' },
  { symbol: 'GOLD', name: 'XAU/USD', price: 2652.5, changePercent: 0.32, currency: 'USD' },
  { symbol: 'USD/THB', name: 'FX Rate', price: 35.45, changePercent: -0.15, currency: 'THB' },
]

export function TickerTape() {
  const { data } = useSWR('/api/market-watch', {
    refreshInterval: 60000,
    revalidateOnFocus: false,
  })

  // Build live ticker list from API if available, falling back to default
  const items: TickerItem[] = React.useMemo(() => {
    if (!data) return DEFAULT_TICKERS

    const list: TickerItem[] = []

    // 1. Th stocks or SET index
    if (data.thStocks && data.thStocks.length > 0) {
      data.thStocks.slice(0, 3).forEach((s: any) => {
        list.push({
          symbol: s.symbol,
          price: s.price,
          changePercent: s.changePercent ?? 0,
          currency: s.currency ?? 'THB',
        })
      })
    } else {
      list.push(DEFAULT_TICKERS[0])
    }

    // 2. US stocks
    if (data.usStocks && data.usStocks.length > 0) {
      data.usStocks.slice(0, 3).forEach((s: any) => {
        list.push({
          symbol: s.symbol,
          price: s.price,
          changePercent: s.changePercent ?? 0,
          currency: s.currency ?? 'USD',
        })
      })
    } else {
      list.push(DEFAULT_TICKERS[1])
    }

    // 3. Crypto
    if (data.crypto && data.crypto.length > 0) {
      data.crypto.slice(0, 3).forEach((c: any) => {
        list.push({
          symbol: c.symbol,
          price: c.price,
          changePercent: c.changePercent ?? 0,
          currency: c.currency ?? 'USD',
        })
      })
    } else {
      list.push(DEFAULT_TICKERS[2], DEFAULT_TICKERS[3])
    }

    // 4. Commodities & FX
    if (data.fxAndCommodities && data.fxAndCommodities.length > 0) {
      data.fxAndCommodities.forEach((f: any) => {
        list.push({
          symbol: f.symbol.replace(' (XAU/USD)', ''),
          price: f.price,
          changePercent: f.changePercent ?? 0,
          currency: f.currency ?? 'THB',
        })
      })
    } else {
      list.push(DEFAULT_TICKERS[4], DEFAULT_TICKERS[5])
    }

    return list.length > 0 ? list : DEFAULT_TICKERS
  }, [data])

  // Duplicate list to achieve a seamless continuous infinite scroll
  const duplicated = [...items, ...items, ...items]

  return (
    <div className="w-full relative overflow-hidden bg-[var(--bg-surface)]/80 backdrop-blur-md border-b border-[var(--border)] py-2 text-xs select-none z-20">
      {/* Live Badge Anchor */}
      <div className="absolute left-0 top-0 bottom-0 z-30 px-3 sm:px-4 bg-[var(--bg-surface)] flex items-center gap-1.5 border-r border-[var(--border)] shadow-[4px_0_12px_rgba(0,0,0,0.3)]">
        <span className="relative flex h-2 w-2">
          <span className="pulse-live absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        <span className="font-bold text-[10px] tracking-wider text-[var(--cyan-400)] uppercase hidden xs:inline">
          LIVE
        </span>
      </div>

      {/* Marquee Container with Gradient Edge Vignettes */}
      <div
        className="overflow-hidden pl-16 sm:pl-20"
        style={{
          maskImage: 'linear-gradient(to right, transparent, black 40px, black calc(100% - 40px), transparent)',
          WebkitMaskImage: 'linear-gradient(to right, transparent, black 40px, black calc(100% - 40px), transparent)',
        }}
      >
        <div className="marquee-track flex items-center gap-6 sm:gap-8">
          {duplicated.map((item, idx) => {
            const isPositive = (item.changePercent ?? 0) >= 0
            const isZero = (item.changePercent ?? 0) === 0
            return (
              <Link
                key={`${item.symbol}-${idx}`}
                href="/market-watch"
                className="flex items-center gap-2 group cursor-pointer transition-opacity hover:opacity-80 no-underline"
              >
                <span className="font-bold text-white tracking-wide group-hover:text-[var(--cyan-400)] transition-colors">
                  {item.symbol}
                </span>

                <span className="text-[var(--text-secondary)] font-medium tabular-nums">
                  {item.currency === 'USD' ? '$' : '฿'}
                  {Number(item.price).toLocaleString('en-US', {
                    minimumFractionDigits: item.price < 10 ? 2 : 2,
                    maximumFractionDigits: item.price < 1 ? 4 : 2,
                  })}
                </span>

                {!isZero && (
                  <span
                    className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold tabular-nums ${
                      isPositive
                        ? 'bg-green-500/10 text-[var(--green-400)] border border-green-500/20'
                        : 'bg-red-500/10 text-[var(--red-400)] border border-red-500/20'
                    }`}
                  >
                    {isPositive ? (
                      <ArrowUpRight className="w-2.5 h-2.5" />
                    ) : (
                      <ArrowDownRight className="w-2.5 h-2.5" />
                    )}
                    <span>
                      {isPositive ? '+' : ''}
                      {Number(item.changePercent).toFixed(2)}%
                    </span>
                  </span>
                )}

                <span className="text-[var(--border-strong)] mx-1">•</span>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
