'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/PageHeader'
import {
  TradingViewHeatmap,
  type HeatmapCategory,
  type HeatmapGrouping,
} from '@/components/market-map/TradingViewHeatmap'
import { PortfolioHeatmap } from '@/components/market-map/PortfolioHeatmap'
import {
  Globe,
  PieChart,
  TrendingUp,
  Maximize2,
  Minimize2,
  Sparkles,
  Layers,
  SlidersHorizontal,
  Info,
  Calendar,
} from 'lucide-react'

type MainViewMode = 'market' | 'portfolio'

interface MarketCategoryOption {
  id: HeatmapCategory
  label: string
  sublabel: string
  icon: string
  description: string
}

const MARKET_CATEGORIES: MarketCategoryOption[] = [
  {
    id: 'sp500',
    label: 'S&P 500',
    sublabel: '500 หุ้นใหญ่สหรัฐฯ',
    icon: '🇺🇸',
    description: 'ภาพรวม 500 บริษัทยักษ์ใหญ่ของสหรัฐฯ แยกตามสัดส่วน Market Cap และกลุ่มอุตสาหกรรม',
  },
  {
    id: 'nasdaq',
    label: 'NASDAQ 100',
    sublabel: 'เทคโนโลยีและนวัตกรรม',
    icon: '🚀',
    description: '100 บริษัทเทคโนโลยีชั้นนำ เช่น Apple, Microsoft, NVIDIA, Alphabet, Amazon',
  },
  {
    id: 'dow',
    label: 'Dow Jones 30',
    sublabel: 'บลูชิพสหรัฐฯ',
    icon: '🏛️',
    description: '30 บริษัทชั้นนำระดับเสาหลักเศรษฐกิจของสหรัฐฯ',
  },
  {
    id: 'all-us',
    label: 'หุ้นสหรัฐฯ ทั้งหมด',
    sublabel: 'Broad US Market',
    icon: '🌐',
    description: 'ตลาดหุ้นสหรัฐฯ วงกว้าง รวมหุ้นขนาดกลางและขนาดเล็ก',
  },
  {
    id: 'etf',
    label: 'กองทุน ETF',
    sublabel: 'US ETFs & Indices',
    icon: '📦',
    description: 'กองทุน ETF ยอดนิยม เช่น SPY, QQQ, VOO, SCHD, SMH, TLT',
  },
  {
    id: 'crypto',
    label: 'คริปโตเคอร์เรนซี',
    sublabel: 'BTC, ETH & Altcoins',
    icon: '🪙',
    description: 'แผนผังตลาดเหรียญดิจิทัลและสินทรัพย์คริปโตชั้นนำ',
  },
]

export default function MarketMapPage() {
  const [viewMode, setViewMode] = useState<MainViewMode>('market')
  const [marketCategory, setMarketCategory] = useState<HeatmapCategory>('sp500')
  const [grouping, setGrouping] = useState<HeatmapGrouping>('sector')
  const [isMonoSize, setIsMonoSize] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [widgetHeight, setWidgetHeight] = useState<number>(760)

  // Listen to Escape key to exit fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isFullscreen])

  const currentCategoryMeta = MARKET_CATEGORIES.find((c) => c.id === marketCategory) || MARKET_CATEGORIES[0]

  return (
    <AppShell>
      <div className="space-y-6 max-w-[1600px] mx-auto w-full animate-fade-in">
        {/* Page Header */}
        <PageHeader
          eyebrow="Institutional Market Terminal"
          title="แผนผังความร้อนตลาด & พอร์ตลงทุน (Market Heatmap)"
          description="สำรวจทิศทางตลาดโลก ดัชนี S&P 500, หุ้นเทคโนโลยี, คริปโต หรือสลับดูแผนผังความร้อนพอร์ตลงทุนของคุณแบบเรียลไทม์"
          action={
            <div className="flex items-center gap-2">
              <Link
                href="/economic-calendar"
                className="bg-[#181C25] hover:bg-[#202532] text-slate-300 hover:text-white border border-white/[0.08] px-3.5 py-2 rounded-xl font-semibold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-sm active:scale-98"
              >
                <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                <span>ปฏิทินเศรษฐกิจ</span>
              </Link>
              <Link
                href="/market-watch"
                className="bg-[#181C25] hover:bg-[#202532] text-slate-300 hover:text-white border border-white/[0.08] px-3.5 py-2 rounded-xl font-semibold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-sm active:scale-98"
              >
                <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
                <span>ไปหน้าจับตาตลาดสด</span>
              </Link>
            </div>
          }
        />

        {/* Primary View Switcher: Market vs Portfolio */}
        <div className="p-2 sm:p-2.5 rounded-2xl bg-gradient-to-r from-[#12151C] via-[#151923] to-[#12151C] border border-white/[0.08] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-xl shadow-black/30">
          <div className="flex items-center gap-1.5 p-1 bg-[#181C25] border border-white/[0.06] rounded-xl self-start sm:self-auto w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setViewMode('market')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                viewMode === 'market'
                  ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-md shadow-indigo-600/30'
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
                  ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <PieChart className="w-4 h-4" />
              <span>พอร์ตของฉัน (My Portfolio Heatmap)</span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400 px-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-[11px] font-medium hidden sm:inline text-slate-300">
              {viewMode === 'market'
                ? 'ข้อมูลสตรีมมิ่งสดจาก TradingView Data Engine (ไม่กินโควตา Server)'
                : 'คำนวณจากต้นทุนและมูลค่าจริงในพอร์ตของคุณแบบเรียลไทม์'}
            </span>
          </div>
        </div>

        {/* ============================================================ */}
        {/* GLOBAL MACRO MARKET MODE */}
        {/* ============================================================ */}
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
                    className={`px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shrink-0 border ${
                      isActive
                        ? 'bg-indigo-500/20 text-indigo-200 border-indigo-500/50 shadow-md shadow-indigo-500/10 font-bold scale-[1.02]'
                        : 'bg-[#12151C] text-slate-400 hover:text-white hover:bg-white/[0.04] border-white/[0.06]'
                    }`}
                  >
                    <span className="text-sm">{cat.icon}</span>
                    <span>{cat.label}</span>
                    <span className="text-[10px] text-slate-400 hidden lg:inline font-normal">
                      • {cat.sublabel}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Quick Layout Presets Toolbar */}
            <div className="p-3 sm:p-3.5 rounded-2xl bg-[#12151C] border border-white/[0.08] flex flex-wrap items-center justify-between gap-3 shadow-lg shadow-black/20">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-slate-400 text-xs font-semibold flex items-center gap-1.5 pl-1">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-400" />
                  รูปแบบการจัดวาง:
                </span>

                {/* 1. Grouping Modes */}
                {marketCategory !== 'crypto' && (
                  <div className="flex items-center bg-[#181C25] border border-white/[0.08] rounded-xl p-1 text-xs">
                    <button
                      type="button"
                      onClick={() => setGrouping('sector')}
                      className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                        grouping === 'sector'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                      title="แบ่งกลุ่มตามหมวดหมู่อุตสาหกรรม (เช่น เทคโนโลยี, สุขภาพ, การเงิน)"
                    >
                      <span>🏢 แยกหมวดอุตสาหกรรม</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setGrouping('no_group')}
                      className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                        grouping === 'no_group'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                      title="รวมหุ้นทั้งตลาดบนผืนเดียว ไม่มีเส้นแบ่งกลุ่ม เพื่อเปรียบเทียบขนาด Market Cap ทั้งตลาด"
                    >
                      <span>🌐 รวมแผ่นเดียวทั้งตลาด</span>
                    </button>
                  </div>
                )}

                {/* 2. Block Sizing Modes */}
                {marketCategory !== 'crypto' && (
                  <div className="flex items-center bg-[#181C25] border border-white/[0.08] rounded-xl p-1 text-xs">
                    <button
                      type="button"
                      onClick={() => setIsMonoSize(false)}
                      className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                        !isMonoSize
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                      title="ขนาดกล่องตามมูลค่าหลักทรัพย์ Market Cap จริง"
                    >
                      ตาม Market Cap
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsMonoSize(true)}
                      className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                        isMonoSize
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                      title="กล่องขนาดเท่ากันทุกตัว เหมาะสำหรับกวาดสายตาดูอารมณ์ตลาดโดยรวม"
                    >
                      ขนาดเท่ากันทุกตัว
                    </button>
                  </div>
                )}

                {/* Height Presets */}
                <div className="hidden sm:flex items-center bg-[#181C25] border border-white/[0.08] rounded-xl p-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setWidgetHeight(760)}
                    className={`px-2.5 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                      widgetHeight === 760
                        ? 'bg-white/10 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    มาตรฐาน (760px)
                  </button>
                  <button
                    type="button"
                    onClick={() => setWidgetHeight(920)}
                    className={`px-2.5 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                      widgetHeight === 920
                        ? 'bg-white/10 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    กว้างพิเศษ (920px)
                  </button>
                </div>
              </div>

              {/* Theater / Fullscreen Button */}
              <button
                type="button"
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="px-3.5 py-1.5 rounded-xl bg-[#181C25] hover:bg-[#202532] text-indigo-300 hover:text-white border border-indigo-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
              >
                {isFullscreen ? (
                  <>
                    <Minimize2 className="w-3.5 h-3.5" />
                    <span>ออกจากโหมดเต็มจอ</span>
                  </>
                ) : (
                  <>
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span>ขยายเต็มจอ (Theater Mode)</span>
                  </>
                )}
              </button>
            </div>

            {/* TradingView Heatmap Container */}
            <div className="relative">
              <TradingViewHeatmap
                category={marketCategory}
                grouping={grouping}
                isMonoSize={isMonoSize}
                height={widgetHeight}
                isFullscreen={false}
                onToggleFullscreen={() => setIsFullscreen(true)}
                onGroupingChange={(g) => setGrouping(g)}
                onMonoSizeChange={(m) => setIsMonoSize(m)}
              />
            </div>

            {/* Feature Guide & Tips Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-2">
              <div className="p-4 rounded-2xl bg-[#12151C] border border-white/[0.08] flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                  <Layers className="w-4 h-4" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-white">เลือกรูปแบบที่ต้องการ</h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    สลับระหว่าง <strong>แยกหมวดอุตสาหกรรม</strong> เพื่อดูเงินไหลเข้ากลุ่มธุรกิจ หรือ <strong>รวมแผ่นเดียว</strong> เพื่อดูสัดส่วนหุ้นใหญ่ หรือ <strong>ขนาดเท่ากัน</strong> เพื่อกวาดสายตาดูทั้งตลาด
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#12151C] border border-white/[0.08] flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-white">เปลี่ยนช่วงเวลาได้ทันที</h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    คลิกที่เมนู <strong>"การเปลี่ยนแปลง 1D, %"</strong> ด้านบนของกราฟ เพื่อสลับดูผลตอบแทน <strong>1 สัปดาห์ (1W)</strong>, <strong>1 เดือน (1M)</strong>, หรือ <strong>ตั้งแต่ต้นปี (YTD)</strong>
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#12151C] border border-white/[0.08] flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-white">ซูมเข้าดูหุ้นตัวย่อย</h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    ดับเบิลคลิกที่กล่องหมวดธุรกิจเพื่อซูมเข้าไปดูหุ้นตัวเล็ก หรือหมุนลูกกลิ้งเมาส์ (Scroll Wheel) เพื่อสำรวจรายละเอียดได้อย่างลื่นไหล
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* MY PORTFOLIO HEATMAP MODE */}
        {/* ============================================================ */}
        {viewMode === 'portfolio' && (
          <div className="space-y-4">
            <PortfolioHeatmap />
          </div>
        )}

        {/* ============================================================ */}
        {/* FULLSCREEN THEATER OVERLAY */}
        {/* ============================================================ */}
        {isFullscreen && (
          <div className="fixed inset-0 z-50 bg-[#090B10] flex flex-col p-3 animate-in fade-in duration-200">
            {/* Top Bar inside Fullscreen */}
            <div className="flex items-center justify-between px-3 py-2 bg-[#12151C] border border-white/[0.1] rounded-xl mb-2">
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-white flex items-center gap-2">
                  <span>{currentCategoryMeta.icon}</span>
                  <span>{currentCategoryMeta.label} Heatmap (Theater View)</span>
                </span>
                <span className="text-xs text-slate-400 hidden sm:inline">
                  • กดปุ่ม ESC หรือคลิกปุ่มขวาเพื่อออก
                </span>
              </div>

              <div className="flex items-center gap-2">
                {marketCategory !== 'crypto' && (
                  <div className="flex items-center bg-[#181C25] border border-white/[0.08] rounded-lg p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setGrouping(grouping === 'sector' ? 'no_group' : 'sector')}
                      className="px-2.5 py-1 text-slate-300 hover:text-white"
                    >
                      {grouping === 'sector' ? '🏢 แยกหมวด' : '🌐 แผ่นเดี่ยว'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsMonoSize(!isMonoSize)}
                      className="px-2.5 py-1 text-slate-300 hover:text-white border-l border-white/[0.08]"
                    >
                      {isMonoSize ? '⚖️ บล็อกเท่ากัน' : '📊 Market Cap'}
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setIsFullscreen(false)}
                  className="px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold hover:bg-rose-500/30 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Minimize2 className="w-3.5 h-3.5" />
                  <span>ออกโหมดเต็มจอ (ESC)</span>
                </button>
              </div>
            </div>

            {/* Fullscreen Heatmap Widget */}
            <div className="flex-1 w-full rounded-xl overflow-hidden">
              <TradingViewHeatmap
                category={marketCategory}
                grouping={grouping}
                isMonoSize={isMonoSize}
                height="100%"
                isFullscreen={true}
                onToggleFullscreen={() => setIsFullscreen(false)}
              />
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
