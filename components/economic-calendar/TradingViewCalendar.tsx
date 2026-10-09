'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Loader2, ExternalLink, Calendar, Filter, Maximize2, Minimize2 } from 'lucide-react'

export type CalendarImportance = 'all' | 'high_medium' | 'high_only'
export type CalendarRegion = 'ALL' | 'USD' | 'EUR' | 'JPY' | 'THB' | 'CNY' | 'GBP'

interface TradingViewCalendarProps {
  importance?: CalendarImportance
  region?: CalendarRegion
  colorTheme?: 'dark' | 'light'
  height?: number | string
  isFullscreen?: boolean
  onToggleFullscreen?: () => void
  onImportanceChange?: (importance: CalendarImportance) => void
  onRegionChange?: (region: CalendarRegion) => void
}

const IMPORTANCE_VALUES: Record<CalendarImportance, string> = {
  high_only: '1',
  high_medium: '0,1',
  all: '-1,0,1',
}

const REGION_CURRENCY_MAP: Record<CalendarRegion, string | null> = {
  ALL: null,
  USD: 'USD',
  EUR: 'EUR',
  JPY: 'JPY',
  THB: 'THB',
  CNY: 'CNY',
  GBP: 'GBP',
}

export function TradingViewCalendar({
  importance = 'high_medium',
  region = 'ALL',
  colorTheme = 'dark',
  height = 760,
  isFullscreen = false,
  onToggleFullscreen,
  onImportanceChange,
  onRegionChange,
}: TradingViewCalendarProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setIsLoading(true)
    const currentContainer = containerRef.current
    if (!currentContainer) return

    // Clean up previous elements
    currentContainer.innerHTML = ''

    const widgetWrapper = document.createElement('div')
    widgetWrapper.className = 'tradingview-widget-container'
    widgetWrapper.style.width = '100%'
    widgetWrapper.style.height = '100%'

    const widgetSlot = document.createElement('div')
    widgetSlot.className = 'tradingview-widget-container__widget'
    widgetSlot.style.width = '100%'
    widgetSlot.style.height = '100%'
    widgetWrapper.appendChild(widgetSlot)

    const config: Record<string, any> = {
      colorTheme,
      isTransparent: false,
      width: '100%',
      height: '100%',
      locale: 'th_TH',
      importanceFilter: IMPORTANCE_VALUES[importance] || '0,1',
    }

    const currencyCode = REGION_CURRENCY_MAP[region]
    if (currencyCode) {
      config.currencyFilter = currencyCode
    }

    const script = document.createElement('script')
    script.type = 'text/javascript'
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-events.js'
    script.async = true
    script.innerHTML = JSON.stringify(config)

    widgetWrapper.appendChild(script)
    currentContainer.appendChild(widgetWrapper)

    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 750)

    return () => {
      clearTimeout(timer)
      if (currentContainer) {
        currentContainer.innerHTML = ''
      }
    }
  }, [importance, region, colorTheme])

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
            <span className="text-white font-semibold text-xs tracking-tight flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-indigo-400" />
              <span>ปฏิทินเศรษฐกิจโลกแบบเรียลไทม์ (Live Events Stream)</span>
            </span>
          </div>

          <span className="text-[11px] text-slate-400 hidden sm:inline">
            • เวลาประเทศไทย (GMT+7) อัตโนมัติ
          </span>
        </div>

        {/* Quick Importance & Region Controls (if parent provides handlers) */}
        <div className="flex items-center gap-2">
          {onImportanceChange && (
            <div className="flex items-center bg-[#090B10] border border-white/[0.08] rounded-lg p-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => onImportanceChange('high_only')}
                className={`px-2.5 py-1 rounded font-medium transition-all cursor-pointer ${
                  importance === 'high_only'
                    ? 'bg-rose-600/90 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="เฉพาะเหตุการณ์สำคัญระดับสูง (High Impact เช่น ดอกเบี้ย FED, CPI, Non-Farm)"
              >
                🔴 สำคัญมาก
              </button>
              <button
                type="button"
                onClick={() => onImportanceChange('high_medium')}
                className={`px-2.5 py-1 rounded font-medium transition-all cursor-pointer ${
                  importance === 'high_medium'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="ระดับปานกลางและสูง (Medium & High Impact)"
              >
                🟡🔴 ปานกลาง+สูง
              </button>
              <button
                type="button"
                onClick={() => onImportanceChange('all')}
                className={`px-2.5 py-1 rounded font-medium transition-all cursor-pointer ${
                  importance === 'all'
                    ? 'bg-slate-700 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="แสดงเหตุการณ์ทุกระดับ"
              >
                ⚪ ทั้งหมด
              </button>
            </div>
          )}

          {onToggleFullscreen && (
            <button
              type="button"
              onClick={onToggleFullscreen}
              className="px-2.5 py-1 rounded-lg bg-[#090B10] hover:bg-white/[0.08] text-slate-300 hover:text-white border border-white/[0.08] text-[11px] font-medium transition-all cursor-pointer flex items-center gap-1"
              title="ขยายโหมดโรงภาพยนตร์เต็มจอ"
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">ย่อจอ</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">เต็มจอ</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Loading Skeleton Indicator */}
      {isLoading && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#0D1017]/95 backdrop-blur-sm transition-opacity duration-300">
          <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mb-3" />
          <p className="text-xs font-semibold text-slate-200">
            กำลังสตรีมข้อมูลปฏิทินเศรษฐกิจโลกแบบสด...
          </p>
          <span className="text-[11px] text-slate-500 mt-1">
            ดึงข้อมูล Real-time TradingView Events Engine ความเร็วสูง
          </span>
        </div>
      )}

      {/* TradingView Calendar Widget Mount Container */}
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: isFullscreen ? 'calc(100vh - 85px)' : typeof height === 'number' ? `${height}px` : height,
          minHeight: isFullscreen ? 'calc(100vh - 85px)' : '640px',
        }}
      />

      {/* Subtle Attribution & Status Bar */}
      <div className="px-4 py-2 bg-[#0A0D13] border-t border-white/[0.06] flex items-center justify-between text-[11px] text-slate-500">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">
            💡 คลิกที่ชื่อรายการตัวเลขเศรษฐกิจเพื่อดูกราฟสถิติย้อนหลังและคำอธิบายโดยละเอียด
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden md:inline">Actual (ผลจริง) • Forecast (คาดการณ์) • Prior (ครั้งก่อน)</span>
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
