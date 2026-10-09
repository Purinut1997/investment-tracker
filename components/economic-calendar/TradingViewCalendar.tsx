'use client'

import React, { useEffect, useRef, useState } from 'react'
import {
  Loader2,
  ExternalLink,
  Calendar,
  Filter,
  Maximize2,
  Minimize2,
  AlertTriangle,
  RotateCcw,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Settings,
  HelpCircle,
  Sparkles,
  Info,
} from 'lucide-react'

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
  onSwitchToNative?: () => void
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

const REGION_COUNTRY_MAP: Record<CalendarRegion, string | null> = {
  ALL: null,
  USD: 'us',
  EUR: 'eu,de,fr,it,es',
  JPY: 'jp',
  THB: 'th',
  CNY: 'cn',
  GBP: 'gb',
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
  onSwitchToNative,
}: TradingViewCalendarProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [showDnsHelp, setShowDnsHelp] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    setIsLoading(true)
    setLoadError(false)

    // Override TradingView host to official CDN fallback if needed
    if (typeof window !== 'undefined') {
      try {
        ;(window as any).WIDGET_HOST = 'https://s.tradingview.com'
      } catch {}
    }

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
      locale: 'th',
      importanceFilter: IMPORTANCE_VALUES[importance] || '0,1',
    }

    const currencyCode = REGION_CURRENCY_MAP[region]
    if (currencyCode) {
      config.currencyFilter = currencyCode
    }

    const countryCode = REGION_COUNTRY_MAP[region]
    if (countryCode) {
      config.countryFilter = countryCode
    }

    const script = document.createElement('script')
    script.type = 'text/javascript'
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-events.js'
    script.async = true
    script.innerHTML = JSON.stringify(config)

    script.onerror = () => {
      setLoadError(true)
      setIsLoading(false)
    }

    widgetWrapper.appendChild(script)
    currentContainer.appendChild(widgetWrapper)

    // Loading timeout check: If TradingView widget fails to render iframe after 4.5s
    const timer = setTimeout(() => {
      setIsLoading(false)
      const iframe = currentContainer.querySelector('iframe')
      if (!iframe) {
        setLoadError(true)
      }
    }, 4500)

    // Quick loading dismissal if widget rendered quickly
    const quickTimer = setTimeout(() => {
      const iframe = currentContainer.querySelector('iframe')
      if (iframe) {
        setIsLoading(false)
      }
    }, 1200)

    return () => {
      clearTimeout(timer)
      clearTimeout(quickTimer)
      if (currentContainer) {
        currentContainer.innerHTML = ''
      }
    }
  }, [importance, region, colorTheme, reloadKey])

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

          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            className="p-1.5 rounded-lg bg-[#090B10] hover:bg-white/[0.08] text-slate-400 hover:text-white border border-white/[0.08] text-[11px] transition-all cursor-pointer"
            title="รีโหลดวิดเจ็ตใหม่"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setShowDnsHelp(!showDnsHelp)}
            className="px-2.5 py-1 rounded-lg bg-[#090B10] hover:bg-white/[0.08] text-slate-400 hover:text-white border border-white/[0.08] text-[11px] font-medium transition-all cursor-pointer flex items-center gap-1"
            title="วิธีแก้ปัญหาหากวิดเจ็ตไม่แสดงผล"
          >
            <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden md:inline">ช่วยเหลือ</span>
          </button>

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

      {/* Explanatory Data Value Strip (คำอธิบายตัวเลข 3 คอลัมน์) */}
      <div className="px-4 py-2 bg-[#090C12] border-b border-white/[0.07] flex flex-wrap items-center justify-between gap-2.5 text-xs text-slate-300">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3.5">
          <span className="text-slate-400 font-bold flex items-center gap-1.5 shrink-0 text-xs">
            <Info className="w-3.5 h-3.5 text-indigo-400" />
            <span>คำอธิบายตัวเลข 3 คอลัมน์ด้านขวา:</span>
          </span>

          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px]">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
            <strong>1. ผลจริง (Actual):</strong> ตัวเลขจริงที่เพิ่งประกาศสด
          </span>

          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[11px]">
            <span className="w-2 h-2 rounded-full bg-indigo-400 inline-block" />
            <strong>2. คาดการณ์ (Forecast):</strong> ตัวเลขประมาณการของตลาด
          </span>

          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-700/30 border border-slate-600/30 text-slate-300 text-[11px]">
            <span className="w-2 h-2 rounded-full bg-slate-400 inline-block" />
            <strong>3. ครั้งก่อน (Prior):</strong> สถิติตัวเลขในงวดที่แล้ว
          </span>
        </div>

        <span className="text-[11px] text-slate-500 hidden xl:inline">
          * รายการที่ยังไม่ถึงเวลาประกาศ จะมีเฉพาะช่องคาดการณ์และครั้งก่อน
        </span>
      </div>

      {/* OFFICIAL TABLE COLUMN HEADERS (แถบหัวคอลัมน์บอกชื่อค่าชัดเจน 100%) */}
      <div className="bg-[#121622] border-b border-white/[0.1] px-4 py-2.5 flex items-center justify-between text-xs font-bold text-slate-200 select-none shadow-sm">
        {/* Left Columns Header: Time, Country, Impact, Event Name */}
        <div className="flex items-center gap-3 sm:gap-6 flex-1 min-w-0">
          <span className="w-14 shrink-0 text-slate-400 font-bold text-xs uppercase tracking-wider">
            เวลา
          </span>
          <span className="w-24 sm:w-28 shrink-0 text-slate-400 font-bold text-xs uppercase tracking-wider">
            ประเทศ
          </span>
          <span className="w-8 shrink-0 text-slate-500 font-normal hidden sm:inline text-center text-[11px]">
            ระดับ
          </span>
          <span className="truncate text-white font-bold text-xs tracking-tight">
            เหตุการณ์ / ตัวเลขเศรษฐกิจ (Economic Event)
          </span>
        </div>

        {/* Right 3 Data Value Columns Header (Aligned with TradingView numbers) */}
        <div className="grid grid-cols-3 gap-2 w-[220px] sm:w-[280px] shrink-0 text-right pr-2">
          {/* Column 1: Actual */}
          <div
            className="flex flex-col items-end"
            title="Actual: ตัวเลขผลลัพธ์จริงที่เพิ่งประกาศ (จะปรากฏสดเมื่อถึงเวลาประกาศ)"
          >
            <div className="flex items-center gap-1 font-bold text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              <span className="tracking-tight text-xs">ผลจริง</span>
            </div>
            <span className="text-[10px] text-emerald-400/70 font-mono tracking-wider uppercase">
              Actual
            </span>
          </div>

          {/* Column 2: Forecast */}
          <div
            className="flex flex-col items-end"
            title="Forecast: ตัวเลขคาดการณ์ของนักวิเคราะห์ตลาด (Consensus Estimate)"
          >
            <div className="flex items-center gap-1 font-bold text-indigo-300">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
              <span className="tracking-tight text-xs">คาดการณ์</span>
            </div>
            <span className="text-[10px] text-indigo-300/70 font-mono tracking-wider uppercase">
              Forecast
            </span>
          </div>

          {/* Column 3: Prior */}
          <div
            className="flex flex-col items-end"
            title="Prior: ตัวเลขสถิติของงวดก่อนหน้า (Previous Period Value)"
          >
            <div className="flex items-center gap-1 font-bold text-slate-300">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
              <span className="tracking-tight text-xs">ครั้งก่อน</span>
            </div>
            <span className="text-[10px] text-slate-400/80 font-mono tracking-wider uppercase">
              Prior
            </span>
          </div>
        </div>
      </div>

      {/* Expandable DNS / AdBlock Help Drawer */}
      {showDnsHelp && (
        <div className="p-4 bg-[#141822] border-b border-white/[0.08] text-xs space-y-3 animate-in fade-in duration-200">
          <div className="flex items-start gap-2.5 text-slate-200">
            <HelpCircle className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="font-bold text-white text-xs">
                สาเหตุและวิธีแก้ไขปัญหาหาก TradingView Widget โดนบล็อก:
              </h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                เราเตอร์อินเทอร์เน็ตบางค่าย หรือส่วนขยายปิดกั้นโฆษณา (เช่น uBlock, AdBlock, Brave Shields) อาจปิดกั้นโดเมน <code className="text-indigo-300">tradingview-widget.com</code>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1">
            <div className="p-3 rounded-xl bg-[#0F1219] border border-white/[0.06] space-y-1.5">
              <span className="font-bold text-emerald-400 block">
                วิธีที่ 1: ตั้งค่า DNS เป็น 1.1.1.1 บนเครื่อง Mac (หายถาวรใน 1 นาที)
              </span>
              <ol className="list-decimal list-inside text-[11px] text-slate-300 space-y-1">
                <li>เปิด <strong>System Settings (การตั้งค่าระบบ)</strong> &gt; <strong>Wi-Fi</strong></li>
                <li>คลิกปุ่ม <strong>Details... (รายละเอียด)</strong> ข้างชื่อ Wi-Fi ที่ต่ออยู่</li>
                <li>เลือกเมนู <strong>DNS</strong> ด้านซ้าย &gt; กดปุ่ม <strong>+</strong> ด้านล่าง</li>
                <li>เพิ่มเลข <code className="text-amber-300 font-bold">1.1.1.1</code> และ <code className="text-amber-300 font-bold">8.8.8.8</code> แล้วกด OK</li>
              </ol>
            </div>

            <div className="p-3 rounded-xl bg-[#0F1219] border border-white/[0.06] space-y-1.5">
              <span className="font-bold text-indigo-400 block">
                วิธีที่ 2: สลับใช้ปฏิทินในระบบ (100% ไม่ต้องตั้งค่า)
              </span>
              <ul className="list-disc list-inside text-[11px] text-slate-300 space-y-1">
                <li>คลิกปุ่ม <strong>"ปฏิทินในระบบ"</strong> บนแถบเมนูด้านบน เพื่อดูตัวเลขสรุปแบบไม่มีวันโดนบล็อก</li>
                <li>
                  หรือเปิดดูบน{' '}
                  <a
                    href="https://www.tradingview.com/markets/world-stocks/economic-calendar/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-400 underline"
                  >
                    TradingView เว็บหลักโดยตรง
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

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
          height: isFullscreen ? 'calc(100vh - 120px)' : typeof height === 'number' ? `${height}px` : height,
          minHeight: isFullscreen ? 'calc(100vh - 120px)' : '640px',
        }}
      />

      {/* Fallback Panel if Load Error detected */}
      {loadError && (
        <div className="p-6 bg-[#12151C] border-t border-rose-500/20 text-center space-y-3">
          <div className="w-10 h-10 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-5 h-5 text-rose-400" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-white">
              ไม่สามารถโหลด TradingView Widget ได้เนื่องจากการบล็อกของเครือข่าย/DNS
            </h4>
            <p className="text-xs text-slate-400 max-w-lg mx-auto">
              เครือข่ายของคุณตอบสนองด้วย NXDOMAIN สำหรับโดเมน widget ของ TradingView ท่านสามารถใช้ปฏิทินเศรษฐกิจฉบับ Native ในระบบได้ทันที
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {onSwitchToNative && (
              <button
                type="button"
                onClick={onSwitchToNative}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>เปิดดูปฏิทินเศรษฐกิจในระบบ (พร้อมใช้งานทันที)</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowDnsHelp(true)}
              className="px-3.5 py-2 rounded-xl bg-[#181C25] hover:bg-[#202532] text-slate-300 hover:text-white border border-white/[0.08] font-semibold text-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5 text-indigo-400" />
              <span>ดูวิธีแก้ DNS บน Mac</span>
            </button>

            <a
              href="https://www.tradingview.com/markets/world-stocks/economic-calendar/"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 rounded-xl bg-[#181C25] hover:bg-[#202532] text-slate-300 hover:text-white border border-white/[0.08] font-semibold text-xs transition-all flex items-center gap-1.5"
            >
              <span>เปิดดูบน TradingView เว็บหลัก</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      )}

      {/* Subtle Attribution & Status Bar */}
      <div className="px-4 py-2 bg-[#0A0D13] border-t border-white/[0.06] flex items-center justify-between text-[11px] text-slate-500">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">
            💡 คลิกที่ชื่อรายการตัวเลขเศรษฐกิจเพื่อดูกราฟสถิติย้อนหลังและคำอธิบายโดยละเอียด
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden md:inline">
            <span className="text-emerald-400 font-semibold">Actual</span> (ผลจริง) • <span className="text-indigo-400 font-semibold">Forecast</span> (คาดการณ์) • <span className="text-slate-400 font-semibold">Prior</span> (ครั้งก่อน)
          </span>
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
