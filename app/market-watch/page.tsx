'use client'

import React, { useState } from 'react'
import useSWR from 'swr'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/PageHeader'
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
      label: 'CRYPTO ASSETS',
      icon: Coins,
      data: data?.crypto ?? [],
    },
    {
      key: 'usStocks',
      label: 'US EQUITIES',
      icon: Building2,
      data: data?.usStocks ?? [],
    },
    {
      key: 'thStocks',
      label: 'THAI EQUITIES',
      icon: Landmark,
      data: data?.thStocks ?? [],
    },
    {
      key: 'fxAndCommodities',
      label: 'COMMODITIES & FX',
      icon: DollarSign,
      data: data?.fxAndCommodities ?? [],
    },
  ]

  const inputClass = "bg-[#0a0a0a] border border-white/5 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-zinc-500 transition-colors w-full font-mono uppercase"

  return (
    <AppShell>
      <div className="space-y-8 max-w-[1600px] mx-auto w-full">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">ตลาดการเงิน</h1>
            <p className="text-sm text-zinc-500 mt-1">ติดตามหุ้นสหรัฐฯ หุ้นไทย คริปโต ทองคำ และอัตราแลกเปลี่ยน</p>
          </div>
          <button 
            onClick={() => revalidate()} 
            disabled={isValidating} 
            className="bg-[#050505] text-zinc-400 hover:text-white border border-white/10 hover:bg-white/5 disabled:opacity-50 px-4 py-2 rounded-lg font-medium text-xs flex items-center gap-2 transition-colors w-fit"
          >
            <RefreshCw className={`w-4 h-4 ${isValidating ? 'animate-spin' : ''}`} /> 
            {isValidating ? 'UPDATING...' : 'UPDATE PRICES'}
          </button>
        </div>

        {/* Currency Converter Card */}
        <div className="p-6 sm:p-8 rounded-3xl bg-[#0a0a0a] border border-white/5">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
              <ArrowRightLeft className="w-4 h-4 text-zinc-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">เครื่องมือแปลงสกุลเงิน (FX CONVERTER)</h2>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-11 gap-4 items-end">
            <div className="md:col-span-3">
              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">AMOUNT</label>
              <input type="number" step="any" className={inputClass} value={convAmount} onChange={(e) => setConvAmount(e.target.value)} />
            </div>

            <div className="md:col-span-3">
              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">FROM</label>
              <select className={inputClass} value={convFrom} onChange={(e) => setConvFrom(e.target.value)}>
                <option value="USD">USD - US DOLLAR</option>
                <option value="THB">THB - THAI BAHT</option>
              </select>
            </div>

            <div className="md:col-span-1 flex items-center justify-center pb-1">
              <button
                type="button"
                onClick={handleSwapCurrencies}
                className="w-10 h-10 rounded-xl bg-[#050505] border border-white/10 hover:bg-white/10 text-zinc-400 hover:text-white transition-all flex items-center justify-center"
              >
                <ArrowRightLeft className={`w-4 h-4 transition-transform duration-300 ${isFlipping ? 'rotate-180 scale-110' : ''}`} />
              </button>
            </div>

            <div className="md:col-span-3">
              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">TO</label>
              <select className={inputClass} value={convTo} onChange={(e) => setConvTo(e.target.value)}>
                <option value="THB">THB - THAI BAHT</option>
                <option value="USD">USD - US DOLLAR</option>
              </select>
            </div>
          </div>

          <div className="mt-6 p-4 sm:p-5 rounded-2xl bg-[#050505] border border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">EXCHANGE RATE (LIVE)</p>
              <p className="text-xs font-mono text-zinc-400 mt-1">1 USD = {usdRate.toFixed(4)} THB</p>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">RESULT</p>
              <p className="text-2xl sm:text-3xl font-bold text-white tabular-nums font-mono mt-1">
                {Number(calculateConversion()).toLocaleString('en-US', { minimumFractionDigits: 2 })}{' '}
                <span className="text-sm text-zinc-500 ml-1">{convTo}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Market Sections */}
        {isLoading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3 text-zinc-500">
            <Loader2 className="w-8 h-8 animate-spin" />
            <span className="text-[10px] font-mono tracking-widest uppercase">Fetching Live Market Data...</span>
          </div>
        ) : error ? (
          <div className="py-24 text-center text-rose-400 text-xs">Error connecting to market data providers.</div>
        ) : (
          <div className="space-y-10">
            {sections.map((section) => {
              const Icon = section.icon
              if (!section.data || section.data.length === 0) return null
              
              return (
                <div key={section.key} className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4 text-zinc-500" />
                    <h3 className="text-sm font-bold text-white tracking-widest uppercase">{section.label}</h3>
                    <div className="ml-auto flex items-center gap-1.5 px-2 py-1 rounded-sm bg-white/5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[9px] text-zinc-400 font-mono tracking-widest uppercase">LIVE FEED</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {section.data.map((q: any) => (
                      <QuoteCard key={q.symbol} quote={q} />
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

function QuoteCard({ quote }: { quote: any }) {
  const isPositive = (quote.changePercent ?? 0) >= 0
  const isZero = (quote.changePercent ?? 0) === 0

  return (
    <div className="p-5 rounded-2xl bg-[#0a0a0a] border border-white/5 hover:border-white/20 transition-all duration-300 group flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between mb-4">
          <div className="flex flex-col min-w-0 pr-2">
            <span className="font-bold text-white tracking-wide text-base group-hover:text-zinc-300 transition-colors truncate">
              {quote.symbol}
            </span>
            <span className="text-[10px] font-mono text-zinc-500 truncate mt-0.5 uppercase tracking-widest">
              {quote.name ?? quote.symbol}
            </span>
          </div>
          <span className="text-[9px] font-mono font-bold text-zinc-500 px-1.5 py-0.5 rounded-sm bg-white/5 uppercase tracking-widest shrink-0">
            {quote.currency}
          </span>
        </div>

        <p className="text-2xl font-bold text-white tabular-nums tracking-tight font-mono">
          {quote.currency === 'USD' ? '$' : '฿'}
          {Number(quote.price).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: quote.price < 1 ? 4 : 2,
          })}
        </p>
      </div>

      <div className="mt-5 pt-4 border-t border-white/5 flex items-center justify-between">
        <span className="text-[9px] font-mono font-bold text-zinc-600 uppercase tracking-widest truncate max-w-[50%]">
          {quote.provider}
        </span>

        {!isZero && quote.changePercent !== undefined ? (
          <span
            className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-bold tabular-nums font-mono tracking-widest ${
              isPositive
                ? 'text-emerald-400 bg-emerald-500/10'
                : 'text-rose-400 bg-rose-500/10'
            }`}
          >
            {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {isPositive ? '+' : ''}
            {Number(quote.changePercent).toFixed(2)}%
          </span>
        ) : (
          <span className="text-[9px] font-mono text-zinc-600 flex items-center gap-1 uppercase tracking-widest">
            <Clock className="w-3 h-3" />
            REF
          </span>
        )}
      </div>
    </div>
  )
}
