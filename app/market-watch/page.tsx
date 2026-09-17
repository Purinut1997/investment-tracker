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
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  DollarSign,
  Clock,
} from 'lucide-react'

export default function MarketWatchPage() {
  const { data, isLoading, error, mutate: revalidate, isValidating } = useSWR('/api/market-watch', {
    refreshInterval: 60000,
  })

  const [convAmount, setConvAmount] = useState('100')
  const [convFrom, setConvFrom] = useState('USD')
  const [convTo, setConvTo] = useState('THB')
  const [isFlipping, setIsFlipping] = useState(false)

  const fxList: any[] = data?.fxAndCommodities ?? []
  const usdItem = fxList.find((f) => f.symbol?.includes('USD / THB'))
  const usdRate = usdItem?.price ?? 35.5

  function calculateConversion(): string {
    const amt = parseFloat(convAmount) || 0
    if (convFrom === convTo) return amt.toFixed(2)
    if (convFrom === 'USD' && convTo === 'THB') return (amt * usdRate).toFixed(2)
    if (convFrom === 'THB' && convTo === 'USD') return (amt / usdRate).toFixed(2)
    return (amt * 1).toFixed(2)
  }

  const handleSwapCurrencies = () => {
    setIsFlipping(true)
    setTimeout(() => setIsFlipping(false), 350)
    const temp = convFrom
    setConvFrom(convTo)
    setConvTo(temp)
  }

  const sections = [
    {
      key: 'crypto',
      label: 'สินทรัพย์ดิจิทัล',
      sublabel: 'Crypto Top Assets',
      icon: Coins,
      iconColor: 'text-amber-400',
      accentColor: 'from-amber-500/20 to-transparent',
      data: data?.crypto ?? [],
    },
    {
      key: 'usStocks',
      label: 'หุ้นสหรัฐฯ',
      sublabel: 'US Tech Giants',
      icon: Building2,
      iconColor: 'text-blue-400',
      accentColor: 'from-blue-500/20 to-transparent',
      data: data?.usStocks ?? [],
    },
    {
      key: 'thStocks',
      label: 'หุ้นไทย',
      sublabel: 'SET Index Leaders',
      icon: Landmark,
      iconColor: 'text-emerald-400',
      accentColor: 'from-emerald-500/20 to-transparent',
      data: data?.thStocks ?? [],
    },
    {
      key: 'fxAndCommodities',
      label: 'สินค้าโภคภัณฑ์ & FX',
      sublabel: 'Commodities & Exchange Rates',
      icon: DollarSign,
      iconColor: 'text-violet-400',
      accentColor: 'from-violet-500/20 to-transparent',
      data: data?.fxAndCommodities ?? [],
    },
  ]

  return (
    <AppShell>
      <div className="space-y-6">
        {/* ── Page Header ─────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500 to-emerald-400 shadow-[0_0_20px_rgba(34,211,238,0.25)]">
                <TrendingUp className="w-5 h-5 text-black" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                ตลาดการเงิน & อัตราแลกเปลี่ยน
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] pl-11">
              ราคาหุ้นสหรัฐฯ, หุ้นไทย, คริปโต, ทองคำ แบบ Real-time
            </p>
          </div>

          <button
            onClick={() => revalidate()}
            disabled={isValidating}
            className="btn btn-secondary text-xs sm:text-sm py-2 px-4 flex items-center gap-2 self-start sm:self-auto"
          >
            <RefreshCw className={`w-4 h-4 ${isValidating ? 'animate-spin text-[var(--cyan-400)]' : ''}`} />
            <span>{isValidating ? 'กำลังดึงราคา...' : 'อัปเดตราคา'}</span>
          </button>
        </div>

        {/* ── Currency Converter ──────────────────────────── */}
        <div className="card p-5 relative overflow-hidden border-cyan-500/20">
          {/* subtle top glow line */}
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />

          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              <ArrowRightLeft className="w-4 h-4 text-[var(--cyan-400)]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">เครื่องมือแปลงสกุลเงิน</h2>
              <p className="text-[11px] text-[var(--text-muted)]">Instant Currency Converter</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
            <div className="sm:col-span-4">
              <label className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider block mb-1.5">
                จำนวนเงิน
              </label>
              <input
                type="number"
                step="any"
                className="input text-sm font-bold"
                value={convAmount}
                onChange={(e) => setConvAmount(e.target.value)}
              />
            </div>

            <div className="sm:col-span-3">
              <label className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider block mb-1.5">
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

            <div className="sm:col-span-1 flex items-center justify-center pb-1">
              <button
                type="button"
                onClick={handleSwapCurrencies}
                className="w-9 h-9 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] hover:border-cyan-500/40 hover:bg-cyan-500/10 text-[var(--cyan-400)] transition-all active:scale-95 flex items-center justify-center"
                title="สลับสกุลเงิน"
              >
                <ArrowRightLeft
                  className={`w-4 h-4 transition-transform duration-300 ${isFlipping ? 'rotate-180 scale-110' : ''}`}
                />
              </button>
            </div>

            <div className="sm:col-span-4">
              <label className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider block mb-1.5">
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

          <div className="mt-4 p-4 rounded-xl bg-[var(--bg-elevated)]/60 border border-[var(--border)] flex items-center justify-between">
            <div>
              <p className="text-[11px] text-[var(--text-muted)] font-medium">อ้างอิง</p>
              <p className="text-xs font-semibold text-white mt-0.5">
                1 USD ≈ {usdRate.toFixed(2)} THB
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-[var(--text-muted)] uppercase font-semibold tracking-wider">ผลลัพธ์</p>
              <p className="text-xl sm:text-2xl font-black text-[var(--cyan-400)] tabular-nums mt-0.5">
                {Number(calculateConversion()).toLocaleString('en-US', { minimumFractionDigits: 2 })}{' '}
                <span className="text-sm text-white font-bold">{convTo}</span>
              </p>
            </div>
          </div>
        </div>

        {/* ── Market Sections ─────────────────────────────── */}
        {isLoading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3 text-[var(--text-muted)]">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--cyan-400)]" />
            <span className="text-xs font-semibold">กำลังเชื่อมต่อข้อมูลตลาดสดระดับสากล...</span>
          </div>
        ) : error ? (
          <div className="card p-8 text-center text-[var(--red-400)] text-xs">
            ไม่สามารถเชื่อมต่อ Market Data Provider ได้ในขณะนี้
          </div>
        ) : (
          <div className="space-y-8">
            {sections.map((section) => {
              const Icon = section.icon
              return (
                <div key={section.key}>
                  {/* Section Header */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-8 h-8 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center ${section.iconColor}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">{section.label}</h3>
                      <p className="text-[11px] text-[var(--text-muted)]">{section.sublabel}</p>
                    </div>
                    <div className="ml-auto flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-[11px] text-emerald-400 font-semibold">LIVE</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {section.data.map((q: any) => (
                      <QuoteCard key={q.symbol} quote={q} accentClass={section.iconColor} />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </AppShell>
  )
}

function QuoteCard({ quote, accentClass }: { quote: any; accentClass: string }) {
  const isPositive = (quote.changePercent ?? 0) >= 0
  const isZero = (quote.changePercent ?? 0) === 0

  return (
    <div className="card p-4 hover:border-white/15 transition-all group flex flex-col justify-between relative overflow-hidden cursor-default">
      {/* Top accent beam on hover */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      <div>
        <div className="flex items-start justify-between mb-3">
          <div className="flex flex-col">
            <span className="font-extrabold text-white tracking-wide text-sm group-hover:text-[var(--cyan-400)] transition-colors">
              {quote.symbol}
            </span>
            <span className="text-[10px] text-[var(--text-muted)] mt-0.5">{quote.name ?? quote.symbol}</span>
          </div>
          <span className="text-[10px] font-bold text-[var(--text-muted)] px-1.5 py-0.5 rounded-md bg-[var(--bg-elevated)] border border-[var(--border)] uppercase tracking-wider">
            {quote.currency}
          </span>
        </div>

        <p className="text-xl sm:text-2xl font-black text-white tabular-nums tracking-tight">
          {quote.currency === 'USD' ? '$' : '฿'}
          {Number(quote.price).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: quote.price < 1 ? 4 : 2,
          })}
        </p>
      </div>

      <div className="mt-4 pt-3 border-t border-[var(--border)] flex items-center justify-between">
        <span className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider truncate max-w-[60%]">
          {quote.provider}
        </span>

        {!isZero && quote.changePercent !== undefined ? (
          <span
            className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-extrabold tabular-nums ${
              isPositive
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
            }`}
          >
            {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {isPositive ? '+' : ''}
            {Number(quote.changePercent).toFixed(2)}%
          </span>
        ) : (
          <span className="text-[10px] text-[var(--text-muted)] flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>อ้างอิง</span>
          </span>
        )}
      </div>
    </div>
  )
}
