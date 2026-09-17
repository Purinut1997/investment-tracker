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
  Clock,
  CheckCircle
} from 'lucide-react'

export default function MarketWatchPage() {
  const { data, isLoading, error, mutate: revalidate, isValidating } = useSWR('/api/market-watch', {
    refreshInterval: 60000, // Auto refresh every 60s
  })

  // Currency Converter State
  const [convAmount, setConvAmount] = useState('100')
  const [convFrom, setConvFrom] = useState('USD')
  const [convTo, setConvTo] = useState('THB')
  const [isFlipping, setIsFlipping] = useState(false)

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

  const handleSwapCurrencies = () => {
    setIsFlipping(true)
    setTimeout(() => setIsFlipping(false), 350)
    const temp = convFrom
    setConvFrom(convTo)
    setConvTo(temp)
  }

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-gradient-to-tr from-cyan-500 to-emerald-400 text-black shadow-[0_0_15px_rgba(34,211,238,0.3)]">
                <TrendingUp className="w-6 h-6" />
              </div>
              <span>ตลาดการเงิน & อัตราแลกเปลี่ยน</span>
            </h1>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
              ติดตามราคาหุ้นสหรัฐฯ, หุ้นไทย, คริปโต, ทองคำ, และคำนวณอัตราแลกเปลี่ยนแบบ Real-time
            </p>
          </div>

          <button
            onClick={() => revalidate()}
            disabled={isValidating}
            className="btn btn-secondary text-xs sm:text-sm py-2 px-3.5 flex items-center gap-2 self-start sm:self-auto shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${isValidating ? 'animate-spin text-[var(--cyan-400)]' : ''}`} />
            <span>{isValidating ? 'กำลังดึงราคา...' : 'อัปเดตราคาล่าสุด'}</span>
          </button>
        </div>

        {/* Currency Converter Mini-Tool with 180° Flip Swap */}
        <div className="card-luxury p-5 border-cyan-500/25 relative overflow-hidden">
          <div className="flex items-center gap-2 mb-3">
            <ArrowRightLeft className="w-5 h-5 text-[var(--cyan-400)]" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              เครื่องมือแปลงสกุลเงินด่วน (Instant Currency Converter)
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
            <div className="sm:col-span-4">
              <label className="text-xs font-semibold text-[var(--text-secondary)] block mb-1">
                จำนวนเงิน
              </label>
              <input
                type="number"
                step="any"
                className="input text-sm font-bold text-white"
                value={convAmount}
                onChange={(e) => setConvAmount(e.target.value)}
              />
            </div>

            <div className="sm:col-span-3">
              <label className="text-xs font-semibold text-[var(--text-secondary)] block mb-1">
                จากสกุลเงิน
              </label>
              <select
                className="input text-sm font-semibold"
                value={convFrom}
                onChange={(e) => setConvFrom(e.target.value)}
              >
                <option value="USD">USD — ดอลลาร์สหรัฐ</option>
                <option value="THB">THB — บาทไทย</option>
              </select>
            </div>

            {/* Swap Button with 180° Flip Animation */}
            <div className="sm:col-span-1 flex items-center justify-center pb-1">
              <button
                type="button"
                onClick={handleSwapCurrencies}
                className="p-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]/80 hover:border-cyan-400/50 hover:bg-[var(--bg-surface)] text-[var(--cyan-400)] transition-all active:scale-95 shadow-sm"
                title="สลับสกุลเงิน"
              >
                <ArrowRightLeft
                  className={`w-4 h-4 transition-transform duration-300 ${
                    isFlipping ? 'rotate-180 scale-110' : ''
                  }`}
                />
              </button>
            </div>

            <div className="sm:col-span-4">
              <label className="text-xs font-semibold text-[var(--text-secondary)] block mb-1">
                ไปยังสกุลเงิน
              </label>
              <select
                className="input text-sm font-semibold"
                value={convTo}
                onChange={(e) => setConvTo(e.target.value)}
              >
                <option value="THB">THB — บาทไทย</option>
                <option value="USD">USD — ดอลลาร์สหรัฐ</option>
              </select>
            </div>
          </div>

          <div className="mt-4 p-3.5 rounded-xl bg-cyan-950/40 border border-cyan-500/30 flex items-center justify-between">
            <span className="text-xs text-[var(--text-secondary)] font-medium">
              อัตราแลกเปลี่ยนอ้างอิง: 1 USD ≈ {usdRate.toFixed(2)} THB
            </span>
            <div className="text-right">
              <span className="text-[10px] text-[var(--text-muted)] uppercase font-semibold block">ผลลัพธ์คำนวณ:</span>
              <span className="text-lg sm:text-xl font-black text-[var(--cyan-400)] tabular-nums">
                {Number(calculateConversion()).toLocaleString('en-US', { minimumFractionDigits: 2 })}{' '}
                <span className="text-xs text-white font-bold">{convTo}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Market Sections */}
        {isLoading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3 text-[var(--text-muted)]">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--cyan-400)]" />
            <span className="text-xs font-semibold">กำลังเชื่อมต่อข้อมูลตลาดสดระดับสากล...</span>
          </div>
        ) : error ? (
          <div className="card-luxury p-8 text-center text-rose-400 text-xs">
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
                <DollarSign className="w-4 h-4 text-violet-400" />
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
  const isPositive = (quote.changePercent ?? 0) >= 0
  const isZero = (quote.changePercent ?? 0) === 0

  return (
    <div className="card-luxury p-4 hover:border-cyan-500/40 transition-all group flex flex-col justify-between relative overflow-hidden">
      {/* Top accent light beam on hover */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

      <div>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-white tracking-wide text-sm group-hover:text-[var(--cyan-400)] transition-colors">
              {quote.symbol}
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-live" />
          </div>
          <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] border border-[var(--border)]">
            {quote.currency}
          </span>
        </div>

        <div className="mt-3">
          <p className="text-xl sm:text-2xl font-black text-white tabular-nums tracking-tight">
            {quote.currency === 'USD' ? '$' : '฿'}
            {Number(quote.price).toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: quote.price < 1 ? 4 : 2,
            })}
          </p>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-[var(--border)] flex items-center justify-between">
        <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
          {quote.provider}
        </span>
        {!isZero && quote.changePercent !== undefined ? (
          <span
            className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-extrabold tabular-nums ${
              isPositive
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 shadow-[0_0_12px_rgba(16,185,129,0.15)]'
                : 'bg-rose-500/15 text-rose-400 border border-rose-500/25 shadow-[0_0_12px_rgba(244,63,94,0.15)]'
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
          <span className="text-[10px] text-[var(--text-muted)] flex items-center gap-1 font-medium">
            <Clock className="w-3 h-3" />
            <span>ราคาอ้างอิง</span>
          </span>
        )}
      </div>
    </div>
  )
}
