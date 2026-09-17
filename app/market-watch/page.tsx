'use client'

import React, { useState } from 'react'
import useSWR from 'swr'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/PageHeader'
import type { MarketQuote } from '@/lib/market-data/types'
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
  TrendingUp,
} from 'lucide-react'

export default function MarketWatchPage() {
  const { data, isLoading, error, mutate: revalidate, isValidating } = useSWR('/api/market-watch', {
    refreshInterval: 60000,
  })

  const [convAmount, setConvAmount] = useState('100')
  const [convFrom, setConvFrom] = useState('USD')
  const [convTo, setConvTo] = useState('THB')
  const [isFlipping, setIsFlipping] = useState(false)

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

  const sections = [
    {
      key: 'crypto',
      label: 'สินทรัพย์คริปโต (Cryptocurrency)',
      icon: Coins,
      color: 'text-amber-400',
      data: data?.crypto ?? [],
    },
    {
      key: 'usStocks',
      label: 'หุ้นสหรัฐฯ (US Equities)',
      icon: Building2,
      color: 'text-blue-400',
      data: data?.usStocks ?? [],
    },
    {
      key: 'thStocks',
      label: 'หุ้นไทย (Thai SET Equities)',
      icon: Landmark,
      color: 'text-emerald-400',
      data: data?.thStocks ?? [],
    },
    {
      key: 'fxAndCommodities',
      label: 'อัตราแลกเปลี่ยนและสินค้าโภคภัณฑ์ (FX & Commodities)',
      icon: DollarSign,
      color: 'text-cyan-400',
      data: data?.fxAndCommodities ?? [],
    },
  ]

  const inputClass = "w-full bg-[#181C25] border border-white/[0.1] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all font-mono"

  return (
    <AppShell>
      <div className="space-y-6 max-w-[1600px] mx-auto w-full animate-fade-in">
        {/* Header */}
        <PageHeader
          eyebrow="Real-Time Quotes"
          title="กระดานจับตาตลาดการเงิน"
          description="ติดตามราคาตลาดสดแบบเรียลไทม์ หุ้นสหรัฐฯ หุ้นไทย คริปโตเคอร์เรนซี ทองคำ และอัตราแลกเปลี่ยน"
          action={
            <button 
              onClick={() => revalidate()} 
              disabled={isValidating} 
              className="bg-[#181C25] hover:bg-[#202532] text-slate-300 hover:text-white border border-white/[0.1] disabled:opacity-50 px-4 py-2 rounded-xl font-semibold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${isValidating ? 'animate-spin' : ''}`} /> 
              <span>{isValidating ? 'กำลังดึงราคาล่าสุด...' : 'รีเฟรชราคาตลาด'}</span>
            </button>
          }
        />

        {/* Currency Converter Card */}
        <div className="p-6 sm:p-7 rounded-2xl bg-[#12151C] border border-white/[0.08] shadow-xl shadow-black/40">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">เครื่องมือแปลงสกุลเงิน (FX Converter)</h2>
              <p className="text-xs text-slate-400 mt-0.5">คำนวณอัตราแลกเปลี่ยนระหว่าง USD และ THB แบบเรียลไทม์</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-11 gap-4 items-end">
            <div className="md:col-span-3">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">จำนวนเงิน</label>
              <input type="number" step="any" className={inputClass} value={convAmount} onChange={(e) => setConvAmount(e.target.value)} />
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">จากสกุลเงิน</label>
              <select className={inputClass} value={convFrom} onChange={(e) => setConvFrom(e.target.value)}>
                <option value="USD" className="bg-[#12151C] text-white">USD - ดอลลาร์สหรัฐ</option>
                <option value="THB" className="bg-[#12151C] text-white">THB - บาทไทย</option>
              </select>
            </div>

            <div className="md:col-span-1 flex items-center justify-center pb-1">
              <button
                type="button"
                onClick={handleSwapCurrencies}
                className="w-10 h-10 rounded-xl bg-[#181C25] border border-white/[0.1] hover:bg-[#202532] text-indigo-400 hover:text-white transition-all flex items-center justify-center cursor-pointer active:scale-95"
                title="สลับสกุลเงิน"
              >
                <ArrowRightLeft className={`w-4 h-4 transition-transform duration-300 ${isFlipping ? 'rotate-180 scale-110' : ''}`} />
              </button>
            </div>

            <div className="md:col-span-4">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">เป็นสกุลเงิน</label>
              <select className={inputClass} value={convTo} onChange={(e) => setConvTo(e.target.value)}>
                <option value="THB" className="bg-[#12151C] text-white">THB - บาทไทย</option>
                <option value="USD" className="bg-[#12151C] text-white">USD - ดอลลาร์สหรัฐ</option>
              </select>
            </div>
          </div>

          <div className="mt-5 p-4 sm:p-5 rounded-xl bg-[#181C25] border border-white/[0.06] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <span className="text-[11px] text-slate-400 font-medium">อัตราแลกเปลี่ยนอ้างอิงล่าสุด</span>
              <p className="text-xs font-mono text-slate-200 font-semibold mt-1">
                {usdRate ? `1 USD = ${usdRate.toFixed(4)} THB` : 'กำลังรอข้อมูลอัตราแลกเปลี่ยน'}
              </p>
            </div>
            <div className="text-left sm:text-right">
              <span className="text-[11px] text-slate-400 font-medium">ผลลัพธ์คำนวณสุทธิ</span>
              <p className="text-2xl sm:text-3xl font-bold text-white tabular-nums font-mono mt-0.5">
                {Number(calculateConversion()).toLocaleString('en-US', { minimumFractionDigits: 2 })}{' '}
                <span className="text-sm font-semibold text-indigo-400 ml-1">{convTo}</span>
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
            <p className="text-rose-300 text-xs mb-3">ไม่สามารถเชื่อมต่อข้อมูลราคาตลาดได้ในขณะนี้</p>
            <button onClick={() => revalidate()} className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-semibold text-white">ลองอีกครั้ง</button>
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
                    <h3 className="text-sm font-bold text-white tracking-tight">{section.label}</h3>
                    <div className="ml-auto flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-[10px] text-emerald-300 font-mono font-semibold tracking-wider">LIVE</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {section.data.map((q: MarketQuote) => (
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

function QuoteCard({ quote }: { quote: MarketQuote }) {
  const isPositive = (quote.changePercent ?? 0) >= 0
  const isZero = (quote.changePercent ?? 0) === 0

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-[#12151C] border border-white/[0.08] hover:border-white/[0.16] hover:bg-[#151922] transition-all duration-200 group flex flex-col justify-between shadow-xl shadow-black/30 min-h-[120px]">
      <div>
        <div className="flex items-start justify-between mb-3">
          <div className="min-w-0 pr-2">
            <span className="font-bold text-white text-sm sm:text-base group-hover:text-indigo-300 transition-colors truncate block">
              {quote.symbol}
            </span>
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
            {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
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
