'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Loader2, ExternalLink } from 'lucide-react'

export type HeatmapCategory = 'sp500' | 'nasdaq' | 'dow' | 'all-us' | 'crypto' | 'etf'
export type HeatmapGrouping = 'sector' | 'no_group'

interface TradingViewHeatmapProps {
  category: HeatmapCategory
  grouping?: HeatmapGrouping
  isMonoSize?: boolean
  colorTheme?: 'dark' | 'light'
  height?: number | string
  isFullscreen?: boolean
  onToggleFullscreen?: () => void
  onGroupingChange?: (grouping: HeatmapGrouping) => void
  onMonoSizeChange?: (monoSize: boolean) => void
}

const CATEGORY_MAP: Record<
  HeatmapCategory,
  {
    scriptSrc: string
    title: string
    config: Record<string, any>
  }
> = {
  sp500: {
    scriptSrc: 'https://s3.tradingview.com/external-embedding/embed-widget-stock-heatmap.js',
    title: 'S&P 500 Stock Heatmap',
    config: {
      exchanges: [],
      dataSource: 'SPX500',
      grouping: 'sector',
      blockSize: 'market_cap_basic',
      blockColor: 'change',
      locale: 'th_TH',
      symbolUrl: '',
      colorTheme: 'dark',
      hasTopBar: true,
      isDataSetEnabled: true,
      isZoomEnabled: true,
      hasSymbolTooltip: true,
      isMonoSize: false,
      width: '100%',
      height: '100%',
    },
  },
  nasdaq: {
    scriptSrc: 'https://s3.tradingview.com/external-embedding/embed-widget-stock-heatmap.js',
    title: 'NASDAQ 100 Stock Heatmap',
    config: {
      exchanges: [],
      dataSource: 'NDX',
      grouping: 'sector',
      blockSize: 'market_cap_basic',
      blockColor: 'change',
      locale: 'th_TH',
      symbolUrl: '',
      colorTheme: 'dark',
      hasTopBar: true,
      isDataSetEnabled: true,
      isZoomEnabled: true,
      hasSymbolTooltip: true,
      isMonoSize: false,
      width: '100%',
      height: '100%',
    },
  },
  dow: {
    scriptSrc: 'https://s3.tradingview.com/external-embedding/embed-widget-stock-heatmap.js',
    title: 'Dow Jones 30 Heatmap',
    config: {
      exchanges: [],
      dataSource: 'DJI',
      grouping: 'sector',
      blockSize: 'market_cap_basic',
      blockColor: 'change',
      locale: 'th_TH',
      symbolUrl: '',
      colorTheme: 'dark',
      hasTopBar: true,
      isDataSetEnabled: true,
      isZoomEnabled: true,
      hasSymbolTooltip: true,
      isMonoSize: false,
      width: '100%',
      height: '100%',
    },
  },
  'all-us': {
    scriptSrc: 'https://s3.tradingview.com/external-embedding/embed-widget-stock-heatmap.js',
    title: 'All US Stocks Heatmap',
    config: {
      exchanges: [],
      dataSource: 'AllUS',
      grouping: 'sector',
      blockSize: 'market_cap_basic',
      blockColor: 'change',
      locale: 'th_TH',
      symbolUrl: '',
      colorTheme: 'dark',
      hasTopBar: true,
      isDataSetEnabled: true,
      isZoomEnabled: true,
      hasSymbolTooltip: true,
      isMonoSize: false,
      width: '100%',
      height: '100%',
    },
  },
  crypto: {
    scriptSrc: 'https://s3.tradingview.com/external-embedding/embed-widget-crypto-coins-heatmap.js',
    title: 'Cryptocurrency Market Heatmap',
    config: {
      dataSource: 'Crypto',
      blockSize: 'market_cap_calc',
      blockColor: 'change',
      locale: 'th_TH',
      symbolUrl: '',
      colorTheme: 'dark',
      hasTopBar: true,
      isDataSetEnabled: true,
      isZoomEnabled: true,
      hasSymbolTooltip: true,
      width: '100%',
      height: '100%',
    },
  },
  etf: {
    scriptSrc: 'https://s3.tradingview.com/external-embedding/embed-widget-etf-heatmap.js',
    title: 'US ETFs Heatmap',
    config: {
      dataSource: 'AllUsEtfs',
      blockSize: 'aum',
      blockColor: 'change',
      grouping: 'asset_class',
      locale: 'th_TH',
      colorTheme: 'dark',
      hasTopBar: true,
      isDataSetEnabled: true,
      isZoomEnabled: true,
      hasSymbolTooltip: true,
      width: '100%',
      height: '100%',
    },
  },
}

export function TradingViewHeatmap({
  category,
  grouping = 'sector',
  isMonoSize = false,
  colorTheme = 'dark',
  height = 760,
  isFullscreen = false,
  onToggleFullscreen,
  onGroupingChange,
  onMonoSizeChange,
}: TradingViewHeatmapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setIsLoading(true)

    // Override TradingView widget host to official CDN fallback if needed
    if (typeof window !== 'undefined') {
      try {
        ;(window as any).WIDGET_HOST = 'https://s.tradingview.com'
      } catch {}
    }

    const currentContainer = containerRef.current
    if (!currentContainer) return

    // Clean up previous elements
    currentContainer.innerHTML = ''

    const info = CATEGORY_MAP[category] || CATEGORY_MAP.sp500

    // Clone base config and apply interactive overrides
    const config = { ...info.config }
    if (category !== 'crypto') {
      if (category === 'etf') {
        config.grouping = grouping === 'no_group' ? 'no_group' : 'asset_class'
      } else {
        config.grouping = grouping
      }
      config.isMonoSize = isMonoSize
    }
    config.colorTheme = colorTheme

    const widgetWrapper = document.createElement('div')
    widgetWrapper.className = 'tradingview-widget-container'
    widgetWrapper.style.width = '100%'
    widgetWrapper.style.height = '100%'

    const widgetSlot = document.createElement('div')
    widgetSlot.className = 'tradingview-widget-container__widget'
    widgetSlot.style.width = '100%'
    widgetSlot.style.height = '100%'
    widgetWrapper.appendChild(widgetSlot)

    const script = document.createElement('script')
    script.type = 'text/javascript'
    script.src = info.scriptSrc
    script.async = true
    script.innerHTML = JSON.stringify(config)

    widgetWrapper.appendChild(script)
    currentContainer.appendChild(widgetWrapper)

    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 850)

    return () => {
      clearTimeout(timer)
      if (currentContainer) {
        currentContainer.innerHTML = ''
      }
    }
  }, [category, grouping, isMonoSize, colorTheme])

  return (
    <div className="relative w-full rounded-2xl overflow-hidden bg-[#0D1017] border border-white/[0.08] shadow-2xl shadow-black/50 ring-1 ring-white/[0.04]">
      {/* Sleek Top Chrome Bar */}
      <div className="px-4 py-2.5 bg-gradient-to-r from-[#141822] via-[#10131B] to-[#141822] border-b border-white/[0.07] flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <span className="text-white font-semibold text-xs tracking-tight">
              {CATEGORY_MAP[category]?.title || 'Stock Heatmap'}
            </span>
          </div>

          <span className="text-[11px] text-slate-400 hidden sm:inline">
            • สตรีมมิ่งข้อมูลตลาดสด TradingView
          </span>
        </div>

        {/* Quick Style / Layout Controls */}
        <div className="flex items-center gap-2">
          {category !== 'crypto' && onGroupingChange && (
            <div className="flex items-center bg-[#090B10] border border-white/[0.08] rounded-lg p-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => onGroupingChange('sector')}
                className={`px-2.5 py-1 rounded font-medium transition-all cursor-pointer ${
                  grouping === 'sector'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="จัดกลุ่มตามหมวดธุรกิจ (Sector)"
              >
                🏢 แยกหมวด
              </button>
              <button
                type="button"
                onClick={() => onGroupingChange('no_group')}
                className={`px-2.5 py-1 rounded font-medium transition-all cursor-pointer ${
                  grouping === 'no_group'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="รวมแผ่นเดียวทั้งตลาด ไม่แบ่งหมวด (Flat Broad Market)"
              >
                🌐 แผ่นเดี่ยว
              </button>
            </div>
          )}

          {category !== 'crypto' && onMonoSizeChange && (
            <button
              type="button"
              onClick={() => onMonoSizeChange(!isMonoSize)}
              className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-all cursor-pointer ${
                isMonoSize
                  ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                  : 'bg-[#090B10] text-slate-400 hover:text-white border-white/[0.08]'
              }`}
              title="ขนาดบล็อกเท่ากันทุกตัว ไม่แบ่งตามขนาด Market Cap"
            >
              ⚖️ {isMonoSize ? 'ขนาดเท่ากัน' : 'ตาม Market Cap'}
            </button>
          )}

          {onToggleFullscreen && (
            <button
              type="button"
              onClick={onToggleFullscreen}
              className="px-2.5 py-1 rounded-lg bg-[#090B10] hover:bg-white/[0.08] text-slate-300 hover:text-white border border-white/[0.08] text-[11px] font-medium transition-all cursor-pointer flex items-center gap-1"
              title="ขยายโหมดโรงภาพยนตร์เต็มจอ"
            >
              <span>{isFullscreen ? '✕ ย่อจอ' : '⛶ เต็มจอ'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Loading Skeleton Indicator */}
      {isLoading && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#0D1017]/95 backdrop-blur-sm transition-opacity duration-300">
          <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mb-3" />
          <p className="text-xs font-semibold text-slate-200">
            กำลังสตรีมข้อมูลแผนผังความร้อน {CATEGORY_MAP[category]?.title}...
          </p>
          <span className="text-[11px] text-slate-500 mt-1">
            ดึงข้อมูล Real-time ความเร็วสูง ไม่ใช้โควตา API หรือทรัพยากรเซิร์ฟเวอร์
          </span>
        </div>
      )}

      {/* TradingView Widget Mount Container */}
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: isFullscreen ? 'calc(100vh - 85px)' : typeof height === 'number' ? `${height}px` : height,
          minHeight: isFullscreen ? 'calc(100vh - 85px)' : '620px',
        }}
      />

      {/* Subtle Attribution & Status Bar */}
      <div className="px-4 py-2 bg-[#0A0D13] border-t border-white/[0.06] flex items-center justify-between text-[11px] text-slate-500">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">
            💡 คลิกสองครั้งที่หมวดหมู่เพื่อซูมเข้า (Zoom in) หรือใช้เมาส์ Wheel ซูมแผนผัง
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden md:inline">สามารถคลิกเมนูในแถบด้านบนของกราฟเพื่อเลือกเกณฑ์สี/ช่วงเวลาได้ทันที</span>
          <a
            href="https://www.tradingview.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-400 hover:text-indigo-400 transition-colors inline-flex items-center gap-1 font-semibold"
          >
            <span>Powered by TradingView</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  )
}
