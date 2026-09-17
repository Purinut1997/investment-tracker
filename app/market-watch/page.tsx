'use client'

import React, { useState } from 'react'
import useSWR from 'swr'
import { AppShell } from '@/components/AppShell'
import {
  TrendingUp,
  Coins,
  Building2,
  Landmark,
  ArrowRightLeft,
  RefreshCw,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  DollarSign,
  Clock
} from 'lucide-react'

export default function MarketWatchPage() {
  const { data, isLoading, error, mutate: revalidate } = useSWR('/api/market-watch', {
    refreshInterval: 60000, // Auto refresh every 60s
  })

  // Currency Converter State
  const [convAmount, setConvAmount] = useState('100')
  const [convFrom, setConvFrom] = useState('USD')
  const [convTo, setConvTo] = useState('THB')

  // Find current USD/THB rate for converter
  const fxList: any[] = data?.fxAndCommodities ?? []
  const usdItem = fxList.find((f) => f.symbol?.includes('USD / THB'))
  const usdRate = usdItem?.price ?? 35.5

  function calculateConversion(): string {
    const amt = parseFloat(convAmount) || 0
    if (convFrom === convTo) return amt.toFixed(2)

    if (convFrom === 'USD' && convTo === 'THB') {
      return (amt * usdRate).toFixed(2)
    }
    if (convFrom === 'THB' && convTo === 'USD') {
      return (amt / usdRate).toFixed(2)
    }
    return (amt * 1).toFixed(2)
  }

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-2.5">
              <TrendingUp className="w-7 h-7 text-[var(--cyan-400)]" />
              <span>ตลาดการเงิน & อัตราแลกเปลี่ยน</span>
            </h1>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
              ติดตามราคาหุ้นสหรัฐฯ, หุ้นไทย, คริปโต, ทองคำ, และคำนวณอัตราแลกเปลี่ยนแบบ Real-time
            </p>
          </div>

          <button
            onClick={() => revalidate()}
            className="btn btn-secondary text-xs sm:text-sm py-2 px-3.5 flex items-center gap-2 self-start sm:self-auto"
          >
            <RefreshCw className="w-4 h-4" />
            <span>อัปเดตราคาล่าสุด</span>
          </button>
        </div>

        {/* Currency Converter Mini-Tool */}
        <div className="card p-5 bg-gradient-to-r from-[var(--bg-surface)] to-[var(--bg-elevated)] border-cyan-500/25">
          <div className="flex items-center gap-2 mb-3">
            <ArrowRightLeft className="w-5 h-5 text-[var(--cyan-400)]" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              เครื่องมือแปลงสกุลเงินด่วน (Instant Currency Converter)
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
            <div className="sm:col-span-1">
              <label className="label">จำนวนเงิน</label>
              <input
                type="number"
                step="any"
                className="input text-sm font-semibold text-white"
                value={convAmount}
                onChange={(e) => setConvAmount(e.target.value)}
              />
            </div>

            <div>
              <label className="label">จากสกุลเงิน</label>
              <select
                className="select text-sm"
                value={convFrom}
                onChange={(e) => setConvFrom(e.target.value)}
              >
                <option value="USD">USD — ดอลลาร์สหรัฐ</option>
                <option value="THB">THB — บาทไทย</option>
              </select>
            </div>

            <div>
              <label className="label">ไปยังสกุลเงิน</label>
              <select
                className="select text-sm"
                value={convTo}
                onChange={(e) => setConvTo(e.target.value)}
              >
                <option value="THB">THB — บาทไทย</option>
                <option value="USD">USD — ดอลลาร์สหรัฐ</option>
              </select>
            </div>

            <div className="p-2.5 rounded-xl bg-cyan-950/40 border border-cyan-500/30 flex flex-col justify-center">
              <span className="text-[10px] text-[var(--text-muted)] font-medium">ผลลัพธ์คำนวณ:</span>
              <span className="text-lg font-bold text-[var(--cyan-400)] tabular-nums">
                {Number(calculateConversion()).toLocaleString('en-US', { minimumFractionDigits: 2 })}{' '}
                <span className="text-xs text-white">{convTo}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Market Sections */}
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-[var(--text-muted)]">
            <Loader2 className="w-7 h-7 animate-spin text-[var(--cyan-400)]" />
            <span className="text-xs">กำลังดึงข้อมูลราคาตลาดล่าสุด...</span>
          </div>
        ) : error ? (
          <div className="card p-8 text-center text-red-400 text-xs">
            ไม่สามารถเชื่อมต่อ Market Data Provider ได้ในขณะนี้
          </div>
        ) : (
          <div className="space-y-6">
            {/* 1. Crypto Market */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Coins className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  ตลาดสินทรัพย์ดิจิทัล (Crypto Top Assets)
                </h3>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {(data?.crypto ?? []).map((q: any) => (
                  <QuoteCard key={q.symbol} quote={q} />
                ))}
              </div>
            </div>

            {/* 2. US Stocks */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Building2 className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  หุ้นสหรัฐฯ ยอดนิยม (US Tech Giants)
                </h3>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {(data?.usStocks ?? []).map((q: any) => (
                  <QuoteCard key={q.symbol} quote={q} />
                ))}
              </div>
            </div>

            {/* 3. Thai Stocks */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Landmark className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  หุ้นไทยเด่น (SET Index Leaders)
                </h3>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {(data?.thStocks ?? []).map((q: any) => (
                  <QuoteCard key={q.symbol} quote={q} />
                ))}
              </div>
            </div>

            {/* 4. Commodities & FX */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <DollarSign className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  สินค้าโภคภัณฑ์ & อัตราแลกเปลี่ยน (Commodities & FX)
                </h3>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {(data?.fxAndCommodities ?? []).map((q: any) => (
                  <QuoteCard key={q.symbol} quote={q} />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}

function QuoteCard({ quote }: { quote: any }) {
  const isPositive = quote.changePercent >= 0

  return (
    <div className="card p-4 hover:border-cyan-500/40 transition-all group flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between">
          <span className="font-bold text-white tracking-wide text-sm group-hover:text-[var(--cyan-400)] transition-colors">
            {quote.symbol}
          </span>
          <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
            {quote.currency}
          </span>
        </div>

        <div className="mt-2.5">
          <p className="text-lg sm:text-xl font-bold text-white tabular-nums">
            {quote.currency === 'USD' ? '$' : '฿'}
            {Number(quote.price).toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: quote.price < 1 ? 4 : 2,
            })}
          </p>
        </div>
      </div>

      <div className="mt-3 pt-2.5 border-t border-[var(--border)] flex items-center justify-between">
        <span className="text-[10px] text-[var(--text-muted)] capitalize">
          {quote.provider}
        </span>
        {quote.changePercent !== undefined && quote.changePercent !== 0 ? (
          <span
            className={`inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums ${
              isPositive ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {isPositive ? (
              <ArrowUpRight className="w-3.5 h-3.5" />
            ) : (
              <ArrowDownRight className="w-3.5 h-3.5" />
            )}
            <span>
              {isPositive ? '+' : ''}
              {Number(quote.changePercent).toFixed(2)}%
            </span>
          </span>
        ) : (
          <span className="text-[10px] text-[var(--text-muted)] flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>ราคาอ้างอิง</span>
          </span>
        )}
      </div>
    </div>
  )
}
