'use client'

import React, { useState, useMemo, useRef, useEffect } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import {
  computeSquarifiedTreemap,
  type TreemapInputItem,
  type TreemapLayoutRect,
} from '@/lib/analytics/treemap'
import { StockLogo } from '@/components/StockLogo'
import { StockDetailModal } from '@/components/market-watch/StockDetailModal'
import {
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  Sparkles,
  Layers,
  DollarSign,
  Percent,
  Plus,
  Loader2,
  PieChart,
  HelpCircle,
  Maximize2,
} from 'lucide-react'

export interface PortfolioHoldingItem {
  ticker: string
  name?: string
  assetType?: string
  market?: string
  shares?: number
  currentPrice?: number
  costBasisBase: number
  currentValueBase: number
  unrealizedPnLBase: number
  unrealizedPnLPercent: number
  todayChangePercent?: number
  todayPnLBase?: number
  allocationPercent?: number
}

interface PortfolioHeatmapProps {
  onOpenStockModal?: (symbol: string, name?: string, market?: string) => void
}

type SizeMetric = 'value' | 'cost'
type ColorMetric = 'today' | 'unrealized'
type GroupingMode = 'flat' | 'grouped'

const ASSET_CLASS_LABELS: Record<string, string> = {
  stock: 'หุ้นรายตัว (Equities)',
  fund: 'กองทุน & ETF (Funds & ETFs)',
  crypto: 'คริปโตเคอร์เรนซี (Crypto)',
  bond: 'ตราสารหนี้ (Fixed Income)',
  gold: 'ทองคำ & สินค้าโภคภัณฑ์ (Commodities)',
}

function getTileColor(value: number, metric: ColorMetric): { bg: string; text: string; border: string } {
  if (value > 0) {
    if (value >= 5) {
      return { bg: 'bg-[#059669]', text: 'text-emerald-100', border: 'border-emerald-400/40' }
    }
    if (value >= 2) {
      return { bg: 'bg-[#10b981]', text: 'text-emerald-100', border: 'border-emerald-300/40' }
    }
    if (value >= 0.5) {
      return { bg: 'bg-[#047857]/80', text: 'text-emerald-200', border: 'border-emerald-500/30' }
    }
    return { bg: 'bg-[#064e3b]/80', text: 'text-emerald-300', border: 'border-emerald-600/30' }
  } else if (value < 0) {
    const abs = Math.abs(value)
    if (abs >= 5) {
      return { bg: 'bg-[#be123c]', text: 'text-rose-100', border: 'border-rose-400/40' }
    }
    if (abs >= 2) {
      return { bg: 'bg-[#e11d48]', text: 'text-rose-100', border: 'border-rose-300/40' }
    }
    if (abs >= 0.5) {
      return { bg: 'bg-[#9f1239]/80', text: 'text-rose-200', border: 'border-rose-500/30' }
    }
    return { bg: 'bg-[#4c0519]/80', text: 'text-rose-300', border: 'border-rose-600/30' }
  }
  return { bg: 'bg-[#1e293b]', text: 'text-slate-300', border: 'border-slate-700/40' }
}

export function PortfolioHeatmap({ onOpenStockModal }: PortfolioHeatmapProps) {
  const { data, isLoading } = useSWR('/api/portfolio/summary', {
    refreshInterval: 60000,
    revalidateOnFocus: false,
  })

  const [sizeMetric, setSizeMetric] = useState<SizeMetric>('value')
  const [colorMetric, setColorMetric] = useState<ColorMetric>('today')
  const [groupingMode, setGroupingMode] = useState<GroupingMode>('flat')
  const [searchQuery, setSearchQuery] = useState('')
  const [hoveredItem, setHoveredItem] = useState<PortfolioHoldingItem | null>(null)
  const [selectedStock, setSelectedStock] = useState<{ symbol: string; name?: string; market?: string } | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 1000, height: 600 })

  useEffect(() => {
    if (!containerRef.current) return
    const updateDims = () => {
      if (containerRef.current) {
        const w = containerRef.current.clientWidth
        // Maintain a pleasant aspect ratio ~ 16:9 or min height
        const h = Math.max(540, Math.min(750, Math.round(w * 0.58)))
        setDimensions({ width: w, height: h })
      }
    }
    updateDims()

    const observer = new ResizeObserver(() => updateDims())
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  const holdings: PortfolioHoldingItem[] = data?.holdings || []
  const baseCurrency: string = data?.baseCurrency || 'THB'
  const currencySymbol = baseCurrency === 'USD' ? '$' : '฿'

  // Filtered holdings
  const filteredHoldings = useMemo(() => {
    if (!searchQuery.trim()) return holdings
    const q = searchQuery.trim().toUpperCase()
    return holdings.filter(
      (h) => h.ticker.toUpperCase().includes(q) || (h.name && h.name.toUpperCase().includes(q))
    )
  }, [holdings, searchQuery])

  // Total value of filtered items
  const totalDisplayValue = useMemo(() => {
    return filteredHoldings.reduce((sum, h) => {
      const val = sizeMetric === 'value' ? h.currentValueBase : h.costBasisBase
      return sum + (val > 0 ? val : 0)
    }, 0)
  }, [filteredHoldings, sizeMetric])

  // Compute Treemap layout for FLAT mode
  const flatTreemapRects = useMemo(() => {
    if (groupingMode !== 'flat' || filteredHoldings.length === 0) return []

    const items: TreemapInputItem<PortfolioHoldingItem>[] = filteredHoldings.map((h) => ({
      id: h.ticker,
      value: Math.max(0.01, sizeMetric === 'value' ? h.currentValueBase : h.costBasisBase),
      data: h,
    }))

    return computeSquarifiedTreemap(items, 0, 0, dimensions.width, dimensions.height)
  }, [filteredHoldings, groupingMode, sizeMetric, dimensions])

  // Compute Treemap layout for GROUPED mode
  const groupedTreemaps = useMemo(() => {
    if (groupingMode !== 'grouped' || filteredHoldings.length === 0) return []

    // Group items by assetClass
    const groups: Record<string, PortfolioHoldingItem[]> = {}
    for (const h of filteredHoldings) {
      const rawType = (h.assetType || 'stock').toLowerCase()
      const key = ASSET_CLASS_LABELS[rawType] ? rawType : 'stock'
      if (!groups[key]) groups[key] = []
      groups[key].push(h)
    }

    const groupKeys = Object.keys(groups)
    const groupTotals = groupKeys.map((key) => {
      const val = groups[key].reduce((sum, h) => {
        const v = sizeMetric === 'value' ? h.currentValueBase : h.costBasisBase
        return sum + (v > 0 ? v : 0)
      }, 0)
      return { key, val, items: groups[key] }
    })

    // Compute layout for the outer groups
    const outerItems: TreemapInputItem<{ key: string; items: PortfolioHoldingItem[] }>[] = groupTotals.map(
      (g) => ({
        id: g.key,
        value: Math.max(0.01, g.val),
        data: { key: g.key, items: g.items },
      })
    )

    const outerRects = computeSquarifiedTreemap(outerItems, 0, 0, dimensions.width, dimensions.height)

    // Subdivide inside each outer group rectangle
    return outerRects.map((outer) => {
      const padding = 28 // space for group title
      const innerW = Math.max(10, outer.width - 6)
      const innerH = Math.max(10, outer.height - padding - 6)

      const innerItems: TreemapInputItem<PortfolioHoldingItem>[] = outer.data.items.map((h) => ({
        id: h.ticker,
        value: Math.max(0.01, sizeMetric === 'value' ? h.currentValueBase : h.costBasisBase),
        data: h,
      }))

      const innerRects = computeSquarifiedTreemap(
        innerItems,
        outer.x + 3,
        outer.y + padding + 3,
        innerW,
        innerH
      )

      return {
        key: outer.data.key,
        title: ASSET_CLASS_LABELS[outer.data.key] || outer.data.key,
        outer,
        innerRects,
      }
    })
  }, [filteredHoldings, groupingMode, sizeMetric, dimensions])

  const handleTileClick = (holding: PortfolioHoldingItem) => {
    if (onOpenStockModal) {
      onOpenStockModal(holding.ticker, holding.name, holding.market)
    } else {
      setSelectedStock({
        symbol: holding.ticker,
        name: holding.name,
        market: holding.market,
      })
    }
  }

  // Format monetary amounts
  const formatMoney = (val: number) => {
    return `${currencySymbol}${Math.round(val).toLocaleString()}`
  }

  // Empty state
  if (!isLoading && holdings.length === 0) {
    return (
      <div className="p-12 rounded-2xl bg-[#12151C] border border-white/[0.08] text-center max-w-xl mx-auto my-8 space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto">
          <PieChart className="w-7 h-7" />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-base font-bold text-white">ยังไม่มีสินทรัพย์ในพอร์ตของคุณ</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            เมื่อคุณเพิ่มรายการธุรกรรมซื้อหุ้น, กองทุน หรือคริปโต ระบบจะวาดแผนผังความร้อน (Heatmap)
            เปรียบเทียบสัดส่วนและกำไรขาดทุนของพอร์ตให้คุณทันที
          </p>
        </div>
        <Link
          href="/transactions"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all shadow-lg shadow-indigo-600/30"
        >
          <Plus className="w-4 h-4" />
          <span>ไปที่หน้ารายการธุรกรรมเพื่อเพิ่มสินทรัพย์</span>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Top Controls Toolbar */}
      <div className="p-4 rounded-2xl bg-[#12151C] border border-white/[0.08] flex flex-wrap items-center justify-between gap-3 shadow-lg shadow-black/20">
        <div className="flex flex-wrap items-center gap-2">
          {/* Size Metric Selector */}
          <div className="flex items-center bg-[#181C25] border border-white/[0.08] rounded-xl p-1 text-xs">
            <span className="px-2 text-slate-400 text-[11px] font-medium hidden sm:inline">ขนาด:</span>
            <button
              type="button"
              onClick={() => setSizeMetric('value')}
              className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                sizeMetric === 'value'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              มูลค่าพอร์ตจริง
            </button>
            <button
              type="button"
              onClick={() => setSizeMetric('cost')}
              className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                sizeMetric === 'cost'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              เงินต้นทุน
            </button>
          </div>

          {/* Color Metric Selector */}
          <div className="flex items-center bg-[#181C25] border border-white/[0.08] rounded-xl p-1 text-xs">
            <span className="px-2 text-slate-400 text-[11px] font-medium hidden sm:inline">สี:</span>
            <button
              type="button"
              onClick={() => setColorMetric('today')}
              className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                colorMetric === 'today'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              วันนี้ (Today %)
            </button>
            <button
              type="button"
              onClick={() => setColorMetric('unrealized')}
              className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                colorMetric === 'unrealized'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              กำไรสะสม (Total P&L %)
            </button>
          </div>

          {/* Grouping Mode */}
          <div className="flex items-center bg-[#181C25] border border-white/[0.08] rounded-xl p-1 text-xs">
            <button
              type="button"
              onClick={() => setGroupingMode('flat')}
              className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                groupingMode === 'flat'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              รวมแผ่นเดียว
            </button>
            <button
              type="button"
              onClick={() => setGroupingMode('grouped')}
              className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                groupingMode === 'grouped'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              แยกหมวดสินทรัพย์
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-56">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาหุ้นในพอร์ต..."
            className="w-full bg-[#181C25] border border-white/[0.08] rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/50 transition-colors"
          />
        </div>
      </div>

      {/* Portfolio Quick Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-[#12151C] border border-white/[0.08]">
          <span className="text-[11px] text-slate-400">มูลค่าพอร์ตรวม</span>
          <p className="text-sm sm:text-base font-bold font-mono text-white mt-0.5">
            {formatMoney(data?.totalValue || 0)}
          </p>
        </div>
        <div className="p-3.5 rounded-xl bg-[#12151C] border border-white/[0.08]">
          <span className="text-[11px] text-slate-400">การเปลี่ยนแปลงวันนี้</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span
              className={`text-sm sm:text-base font-bold font-mono ${
                (data?.todayPnL || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {(data?.todayPnL || 0) >= 0 ? '+' : ''}
              {formatMoney(data?.todayPnL || 0)}
            </span>
            <span
              className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                (data?.todayPnLPercent || 0) >= 0
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : 'bg-rose-500/20 text-rose-300'
              }`}
            >
              {(data?.todayPnLPercent || 0) >= 0 ? '+' : ''}
              {(data?.todayPnLPercent || 0).toFixed(2)}%
            </span>
          </div>
        </div>
        <div className="p-3.5 rounded-xl bg-[#12151C] border border-white/[0.08]">
          <span className="text-[11px] text-slate-400">กำไร/ขาดทุนสะสม (Unrealized)</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span
              className={`text-sm sm:text-base font-bold font-mono ${
                (data?.unrealizedPnL || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {(data?.unrealizedPnL || 0) >= 0 ? '+' : ''}
              {formatMoney(data?.unrealizedPnL || 0)}
            </span>
            <span
              className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                (data?.unrealizedPnLPercent || 0) >= 0
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : 'bg-rose-500/20 text-rose-300'
              }`}
            >
              {(data?.unrealizedPnLPercent || 0) >= 0 ? '+' : ''}
              {(data?.unrealizedPnLPercent || 0).toFixed(2)}%
            </span>
          </div>
        </div>
        <div className="p-3.5 rounded-xl bg-[#12151C] border border-white/[0.08]">
          <span className="text-[11px] text-slate-400">จำนวนสินทรัพย์ในพอร์ต</span>
          <p className="text-sm sm:text-base font-bold font-mono text-white mt-0.5">
            {filteredHoldings.length} รายการ
          </p>
        </div>
      </div>

      {/* Main Treemap Canvas Container */}
      <div
        ref={containerRef}
        className="relative w-full rounded-2xl bg-[#0B0D13] border border-white/[0.08] shadow-2xl shadow-black/40 overflow-hidden select-none"
        style={{ height: `${dimensions.height}px` }}
      >
        {isLoading && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#0B0D13]/80 backdrop-blur-xs">
            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mb-2" />
            <span className="text-xs text-slate-400 font-medium">กำลังคำนวณแผนผังพอร์ต...</span>
          </div>
        )}

        {/* FLAT TREEMAP RENDER */}
        {groupingMode === 'flat' &&
          flatTreemapRects.map((rect) => {
            const holding = rect.data
            const metricVal =
              colorMetric === 'today'
                ? holding.todayChangePercent || 0
                : holding.unrealizedPnLPercent || 0
            const colors = getTileColor(metricVal, colorMetric)
            const isHovered = hoveredItem?.ticker === holding.ticker

            const isTiny = rect.width < 65 || rect.height < 50
            const isMicro = rect.width < 45 || rect.height < 35

            return (
              <div
                key={rect.id}
                onClick={() => handleTileClick(holding)}
                onMouseEnter={() => setHoveredItem(holding)}
                onMouseLeave={() => setHoveredItem(null)}
                style={{
                  position: 'absolute',
                  left: `${rect.x}px`,
                  top: `${rect.y}px`,
                  width: `${rect.width}px`,
                  height: `${rect.height}px`,
                  padding: '2px',
                }}
                className="transition-transform duration-150 cursor-pointer"
              >
                <div
                  className={`w-full h-full rounded-lg ${colors.bg} ${colors.border} border flex flex-col items-center justify-center p-1.5 transition-all duration-200 overflow-hidden relative shadow-inner ${
                    isHovered
                      ? 'ring-2 ring-white z-10 scale-[1.01] brightness-125'
                      : 'hover:brightness-110'
                  }`}
                >
                  {/* Ticker & Logo */}
                  <span
                    className={`font-black font-mono tracking-tight text-white ${
                      isMicro
                        ? 'text-[10px]'
                        : isTiny
                        ? 'text-xs'
                        : rect.width > 120
                        ? 'text-base sm:text-lg'
                        : 'text-sm'
                    }`}
                  >
                    {holding.ticker}
                  </span>

                  {/* Return % */}
                  {!isMicro && (
                    <span
                      className={`font-mono font-bold leading-tight ${colors.text} ${
                        isTiny ? 'text-[10px]' : 'text-xs sm:text-sm'
                      }`}
                    >
                      {metricVal >= 0 ? '+' : ''}
                      {metricVal.toFixed(2)}%
                    </span>
                  )}

                  {/* Portfolio Weight & Value (if space allows) */}
                  {!isTiny && rect.height > 75 && (
                    <div className="mt-1 flex flex-col items-center text-center">
                      <span className="text-[10px] text-white/80 font-mono font-medium">
                        {rect.percent.toFixed(1)}% พอร์ต
                      </span>
                      {rect.height > 95 && (
                        <span className="text-[10px] text-white/60 font-mono">
                          {formatMoney(holding.currentValueBase)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}

        {/* GROUPED TREEMAP RENDER */}
        {groupingMode === 'grouped' &&
          groupedTreemaps.map((group) => (
            <div
              key={group.key}
              style={{
                position: 'absolute',
                left: `${group.outer.x}px`,
                top: `${group.outer.y}px`,
                width: `${group.outer.width}px`,
                height: `${group.outer.height}px`,
              }}
              className="p-1"
            >
              <div className="w-full h-full rounded-xl bg-[#141822] border border-white/[0.08] relative overflow-hidden">
                {/* Sector / Group Header Tag */}
                <div className="h-7 px-3 flex items-center justify-between bg-white/[0.03] border-b border-white/[0.06] text-[11px] font-bold text-slate-300">
                  <span className="truncate">{group.title}</span>
                  <span className="text-[10px] font-mono text-slate-400 font-semibold shrink-0">
                    {group.outer.percent.toFixed(1)}%
                  </span>
                </div>

                {/* Sub-tiles inside group */}
                {group.innerRects.map((rect) => {
                  const holding = rect.data
                  const metricVal =
                    colorMetric === 'today'
                      ? holding.todayChangePercent || 0
                      : holding.unrealizedPnLPercent || 0
                  const colors = getTileColor(metricVal, colorMetric)
                  const isHovered = hoveredItem?.ticker === holding.ticker
                  const isTiny = rect.width < 60 || rect.height < 45

                  return (
                    <div
                      key={rect.id}
                      onClick={() => handleTileClick(holding)}
                      onMouseEnter={() => setHoveredItem(holding)}
                      onMouseLeave={() => setHoveredItem(null)}
                      style={{
                        position: 'absolute',
                        left: `${rect.x - group.outer.x}px`,
                        top: `${rect.y - group.outer.y}px`,
                        width: `${rect.width}px`,
                        height: `${rect.height}px`,
                        padding: '1.5px',
                      }}
                      className="cursor-pointer"
                    >
                      <div
                        className={`w-full h-full rounded-md ${colors.bg} ${colors.border} border flex flex-col items-center justify-center p-1 overflow-hidden transition-all duration-150 ${
                          isHovered
                            ? 'ring-2 ring-white z-10 scale-[1.01] brightness-125'
                            : 'hover:brightness-110'
                        }`}
                      >
                        <span className="font-black font-mono text-white text-xs sm:text-sm">
                          {holding.ticker}
                        </span>
                        <span className={`font-mono font-bold text-[10px] sm:text-xs ${colors.text}`}>
                          {metricVal >= 0 ? '+' : ''}
                          {metricVal.toFixed(2)}%
                        </span>
                        {!isTiny && rect.height > 65 && (
                          <span className="text-[10px] text-white/70 font-mono mt-0.5">
                            {formatMoney(holding.currentValueBase)}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

        {/* Interactive Floating Hover Card / Tooltip */}
        {hoveredItem && (
          <div className="absolute top-3 right-3 z-30 p-3.5 rounded-xl bg-[#181C25]/95 border border-white/20 shadow-2xl backdrop-blur-md text-xs text-white max-w-xs animate-in fade-in zoom-in-95 duration-100 pointer-events-none">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-2">
              <div>
                <span className="font-bold text-sm font-mono text-white block">
                  {hoveredItem.ticker}
                </span>
                <span className="text-[10px] text-slate-400 block truncate max-w-[170px]">
                  {hoveredItem.name || hoveredItem.ticker}
                </span>
              </div>
              <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono text-[10px] font-bold">
                {hoveredItem.market || 'US'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 pt-2 text-[11px]">
              <div>
                <span className="text-slate-400 text-[10px]">มูลค่าปัจจุบัน:</span>
                <p className="font-mono font-bold text-white">
                  {formatMoney(hoveredItem.currentValueBase)}
                </p>
              </div>
              <div>
                <span className="text-slate-400 text-[10px]">สัดส่วนพอร์ต:</span>
                <p className="font-mono font-bold text-white">
                  {totalDisplayValue > 0
                    ? ((hoveredItem.currentValueBase / totalDisplayValue) * 100).toFixed(1)
                    : 0}
                  %
                </p>
              </div>
              <div>
                <span className="text-slate-400 text-[10px]">ผลตอบแทนวันนี้:</span>
                <p
                  className={`font-mono font-bold ${
                    (hoveredItem.todayChangePercent || 0) >= 0
                      ? 'text-emerald-400'
                      : 'text-rose-400'
                  }`}
                >
                  {(hoveredItem.todayChangePercent || 0) >= 0 ? '+' : ''}
                  {(hoveredItem.todayChangePercent || 0).toFixed(2)}%
                </p>
              </div>
              <div>
                <span className="text-slate-400 text-[10px]">กำไร/ขาดทุนสะสม:</span>
                <p
                  className={`font-mono font-bold ${
                    (hoveredItem.unrealizedPnLPercent || 0) >= 0
                      ? 'text-emerald-400'
                      : 'text-rose-400'
                  }`}
                >
                  {(hoveredItem.unrealizedPnLPercent || 0) >= 0 ? '+' : ''}
                  {(hoveredItem.unrealizedPnLPercent || 0).toFixed(2)}%
                </p>
              </div>
            </div>
            <div className="mt-2 pt-1.5 border-t border-white/[0.08] text-[10px] text-indigo-300 font-medium text-center">
              คลิกเพื่อเปิดกราฟแท่งเทียน & บทวิเคราะห์ AI ➔
            </div>
          </div>
        )}
      </div>

      {/* Color Scale Legend */}
      <div className="p-3 rounded-xl bg-[#12151C] border border-white/[0.08] flex flex-wrap items-center justify-between gap-3 text-xs">
        <span className="text-slate-400 text-[11px]">
          เกณฑ์สี ({colorMetric === 'today' ? "การเปลี่ยนแปลงวันนี้" : "กำไร/ขาดทุนสะสม"}):
        </span>
        <div className="flex items-center gap-1 font-mono text-[10px] font-bold">
          <span className="px-2 py-0.5 rounded bg-[#be123c] text-white">&lt; -5%</span>
          <span className="px-2 py-0.5 rounded bg-[#e11d48] text-white">-2%</span>
          <span className="px-2 py-0.5 rounded bg-[#9f1239] text-rose-200">-0.5%</span>
          <span className="px-2 py-0.5 rounded bg-[#1e293b] text-slate-300">0%</span>
          <span className="px-2 py-0.5 rounded bg-[#047857] text-emerald-200">+0.5%</span>
          <span className="px-2 py-0.5 rounded bg-[#10b981] text-white">+2%</span>
          <span className="px-2 py-0.5 rounded bg-[#059669] text-white">&gt; +5%</span>
        </div>
        <span className="text-slate-500 text-[11px] hidden sm:inline">
          💡 คลิกที่กล่องเพื่อดูกราฟแท่งเทียน Candlestick
        </span>
      </div>

      {/* Stock Detail Modal Integration */}
      {selectedStock && (
        <StockDetailModal
          isOpen={!!selectedStock}
          onClose={() => setSelectedStock(null)}
          symbol={selectedStock.symbol}
          initialName={selectedStock.name}
          market={selectedStock.market}
        />
      )}
    </div>
  )
}
