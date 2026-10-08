'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/PageHeader'
import { TradingViewHeatmap, type HeatmapCategory } from '@/components/market-map/TradingViewHeatmap'
import { PortfolioHeatmap } from '@/components/market-map/PortfolioHeatmap'
import {
  Globe,
  PieChart,
  TrendingUp,
  LayoutGrid,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Zap,
} from 'lucide-react'

type MainViewMode = 'market' | 'portfolio'

interface MarketCategoryOption {
  id: HeatmapCategory
  label: string
  sublabel: string
  icon: string
}

const MARKET_CATEGORIES: MarketCategoryOption[] = [
  { id: 'sp500', label: 'S&P 500', sublabel: '500 บริษัทชั้นนำสหรัฐฯ', icon: '🇺🇸' },
  { id: 'nasdaq', label: 'NASDAQ 100', sublabel: 'เทคโนโลยีและนวัตกรรม', icon: '🚀' },
  { id: 'dow', label: 'Dow Jones 30', sublabel: 'หุ้นบลูชิพสหรัฐฯ', icon: '🏛️' },
  { id: 'all-us', label: 'หุ้นสหรัฐฯ ทั้งหมด', sublabel: 'US Broad Market', icon: '🌐' },
  { id: 'crypto', label: 'คริปโตเคอร์เรนซี', sublabel: 'BTC, ETH & Altcoins', icon: '🪙' },
  { id: 'etf', label: 'กองทุน ETF', sublabel: 'US Exchange-Traded Funds', icon: '📦' },
]

export default function MarketMapPage() {
  const [viewMode, setViewMode] = useState<MainViewMode>('market')
  const [marketCategory, setMarketCategory] = useState<HeatmapCategory>('sp500')

  return (
    <AppShell>
      <div className="space-y-6 max-w-[1600px] mx-auto w-full animate-fade-in">
        {/* Page Header */}
        <PageHeader
          eyebrow="Market & Portfolio Heatmap"
          title="แผนผังความร้อนตลาด & พอร์ตลงทุน"
          description="สำรวจทิศทางตลาดโลก ดัชนี S&P 500, หุ้นเทคโนโลยี, คริปโต หรือสลับดูแผนผังความร้อนพอร์ตลงทุนของคุณแบบเรียลไทม์"
          action={
            <div className="flex items-center gap-2">
              <Link
                href="/market-watch"
                className="bg-[#181C25] hover:bg-[#202532] text-slate-300 hover:text-white border border-white/[0.08] px-3.5 py-2 rounded-xl font-semibold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-sm active:scale-98"
              >
                <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
                <span>ไปหน้ากระดานจับตาตลาด</span>
              </Link>
            </div>
          }
        />

        {/* Primary View Switcher: Market vs Portfolio */}
        <div className="p-2 sm:p-2.5 rounded-2xl bg-[#12151C] border border-white/[0.08] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-lg shadow-black/20">
          <div className="flex items-center gap-1.5 p-1 bg-[#181C25] border border-white/[0.06] rounded-xl self-start sm:self-auto w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setViewMode('market')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                viewMode === 'market'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Globe className="w-4 h-4" />
              <span>ตลาดโลก (Macro Heatmap)</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('portfolio')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                viewMode === 'portfolio'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <PieChart className="w-4 h-4" />
              <span>พอร์ตของฉัน (My Portfolio)</span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400 px-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] font-medium hidden sm:inline">
              {viewMode === 'market'
                ? 'ข้อมูลสตรีมมิ่งสดจาก TradingView Data Engine (ไม่กินโควตา Server)'
                : 'คำนวณจากต้นทุนและมูลค่าพอร์ตของคุณแบบเรียลไทม์'}
            </span>
          </div>
        </div>

        {/* Global Market Mode View */}
        {viewMode === 'market' && (
          <div className="space-y-4">
            {/* Market Sub-Category Pill Bar */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              {MARKET_CATEGORIES.map((cat) => {
                const isActive = marketCategory === cat.id
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setMarketCategory(cat.id)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shrink-0 border ${
                      isActive
                        ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/40 shadow-sm shadow-indigo-500/10 font-bold'
                        : 'bg-[#12151C] text-slate-400 hover:text-white hover:bg-white/[0.04] border-white/[0.06]'
                    }`}
                  >
                    <span>{cat.icon}</span>
                    <span>{cat.label}</span>
                    <span className="text-[10px] text-slate-500 hidden md:inline font-normal">
                      ({cat.sublabel})
                    </span>
                  </button>
                )
              })}
            </div>

            {/* TradingView Heatmap Widget Frame */}
            <TradingViewHeatmap category={marketCategory} height={760} />
          </div>
        )}

        {/* My Portfolio Mode View */}
        {viewMode === 'portfolio' && (
          <div className="space-y-4">
            <PortfolioHeatmap />
          </div>
        )}
      </div>
    </AppShell>
  )
}
