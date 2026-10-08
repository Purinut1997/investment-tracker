'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Loader2, ExternalLink } from 'lucide-react'

export type HeatmapCategory = 'sp500' | 'nasdaq' | 'dow' | 'all-us' | 'crypto' | 'etf'

interface TradingViewHeatmapProps {
  category: HeatmapCategory
  height?: number | string
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

export function TradingViewHeatmap({ category, height = 750 }: TradingViewHeatmapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setIsLoading(true)
    const currentContainer = containerRef.current
    if (!currentContainer) return

    // Clean up previous elements
    currentContainer.innerHTML = ''

    const info = CATEGORY_MAP[category] || CATEGORY_MAP.sp500

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
    script.innerHTML = JSON.stringify(info.config)

    widgetWrapper.appendChild(script)
    currentContainer.appendChild(widgetWrapper)

    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 900)

    return () => {
      clearTimeout(timer)
      if (currentContainer) {
        currentContainer.innerHTML = ''
      }
    }
  }, [category])

  return (
    <div className="relative w-full rounded-2xl overflow-hidden bg-[#12151C] border border-white/[0.08] shadow-2xl shadow-black/40">
      {/* Loading Skeleton Indicator */}
      {isLoading && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#12151C]/90 backdrop-blur-sm transition-opacity duration-300">
          <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mb-3" />
          <p className="text-xs font-semibold text-slate-300">
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
          height: typeof height === 'number' ? `${height}px` : height,
          minHeight: '620px',
        }}
      />

      {/* Subtle Attribution & Status Bar */}
      <div className="px-4 py-2 bg-[#0E1117] border-t border-white/[0.06] flex items-center justify-between text-[11px] text-slate-500">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-slate-400 font-medium">สตรีมข้อมูลตลาดสดเรียลไทม์ (Live Streaming Data)</span>
        </div>
        <div className="flex items-center gap-3">
          <span>คลิกสองครั้งที่กลุ่มเพื่อซูม (Zoom in / out)</span>
          <a
            href="https://www.tradingview.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-400 hover:text-indigo-400 transition-colors inline-flex items-center gap-1"
          >
            <span>Powered by TradingView</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  )
}
