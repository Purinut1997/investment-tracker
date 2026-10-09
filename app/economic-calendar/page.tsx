'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/PageHeader'
import {
  TradingViewCalendar,
  type CalendarImportance,
  type CalendarRegion,
} from '@/components/economic-calendar/TradingViewCalendar'
import {
  Calendar,
  TrendingUp,
  LayoutGrid,
  Newspaper,
  Maximize2,
  Minimize2,
  Clock,
  ShieldAlert,
  SlidersHorizontal,
  Info,
  Layers,
} from 'lucide-react'

interface RegionOption {
  id: CalendarRegion
  label: string
  sublabel: string
  flag: string
}

const REGION_OPTIONS: RegionOption[] = [
  { id: 'ALL', label: 'ทั่วโลก', sublabel: 'Global Events', flag: '🌐' },
  { id: 'USD', label: 'สหรัฐฯ (USD)', sublabel: 'Fed, CPI, NFP', flag: '🇺🇸' },
  { id: 'EUR', label: 'ยุโรป (EUR)', sublabel: 'ECB & Eurozone', flag: '🇪🇺' },
  { id: 'JPY', label: 'ญี่ปุ่น (JPY)', sublabel: 'BOJ & Nikkei', flag: '🇯🇵' },
  { id: 'THB', label: 'ไทย (THB)', sublabel: 'ธปท. & เศรษฐกิจไทย', flag: '🇹🇭' },
  { id: 'CNY', label: 'จีน (CNY)', sublabel: 'PMI & GDP จีน', flag: '🇨🇳' },
  { id: 'GBP', label: 'อังกฤษ (GBP)', sublabel: 'BOE & UK Data', flag: '🇬🇧' },
]

export default function EconomicCalendarPage() {
  const [importance, setImportance] = useState<CalendarImportance>('high_medium')
  const [region, setRegion] = useState<CalendarRegion>('ALL')
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

  const currentRegionMeta = REGION_OPTIONS.find((r) => r.id === region) || REGION_OPTIONS[0]

  return (
    <AppShell>
      <div className="space-y-6 max-w-[1600px] mx-auto w-full animate-fade-in pb-12">
        {/* Page Header */}
        <PageHeader
          eyebrow="Macro Intelligence & Events"
          title="ปฏิทินเศรษฐกิจโลก (Economic Calendar)"
          description="ติดตามตัวเลขเศรษฐกิจ ประกาศดอกเบี้ยธนาคารกลาง และเหตุการณ์สำคัญระดับโลกแบบสด เพื่อจับจังหวะและวางแผนการลงทุนได้อย่างแม่นยำ"
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/market-watch"
                className="bg-[#181C25] hover:bg-[#202532] text-slate-300 hover:text-white border border-white/[0.08] px-3.5 py-2 rounded-xl font-semibold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-sm active:scale-98"
              >
                <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
                <span>จับตาตลาด</span>
              </Link>

              <Link
                href="/market-map"
                className="bg-[#181C25] hover:bg-[#202532] text-slate-300 hover:text-white border border-white/[0.08] px-3.5 py-2 rounded-xl font-semibold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-sm active:scale-98"
              >
                <LayoutGrid className="w-3.5 h-3.5 text-indigo-400" />
                <span>แผนผังตลาด Heatmap</span>
              </Link>

              <Link
                href="/news"
                className="bg-[#181C25] hover:bg-[#202532] text-slate-300 hover:text-white border border-white/[0.08] px-3.5 py-2 rounded-xl font-semibold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-sm active:scale-98"
              >
                <Newspaper className="w-3.5 h-3.5 text-indigo-400" />
                <span>สรุปข่าวเศรษฐกิจ</span>
              </Link>
            </div>
          }
        />

        {/* Region & Currency Selector Pill Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {REGION_OPTIONS.map((item) => {
            const isActive = region === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setRegion(item.id)}
                className={`px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shrink-0 border ${
                  isActive
                    ? 'bg-indigo-500/20 text-indigo-200 border-indigo-500/50 shadow-md shadow-indigo-500/10 font-bold scale-[1.02]'
                    : 'bg-[#12151C] text-slate-400 hover:text-white hover:bg-white/[0.04] border-white/[0.06]'
                }`}
              >
                <span className="text-sm">{item.flag}</span>
                <span>{item.label}</span>
                <span className="text-[10px] text-slate-400 hidden lg:inline font-normal">
                  • {item.sublabel}
                </span>
              </button>
            )
          })}
        </div>

        {/* Quick Toolbar */}
        <div className="p-3 sm:p-3.5 rounded-2xl bg-[#12151C] border border-white/[0.08] flex flex-wrap items-center justify-between gap-3 shadow-lg shadow-black/20">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-slate-400 text-xs font-semibold flex items-center gap-1.5 pl-1">
              <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-400" />
              ระดับความสำคัญ:
            </span>

            {/* Importance Selection */}
            <div className="flex items-center bg-[#181C25] border border-white/[0.08] rounded-xl p-1 text-xs">
              <button
                type="button"
                onClick={() => setImportance('high_only')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  importance === 'high_only'
                    ? 'bg-rose-600/90 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="เฉพาะตัวเลขสำคัญมาก (High Impact เช่น ดอกเบี้ย FED, เงินเฟ้อ CPI, Non-Farm)"
              >
                <span>🔴 สำคัญมาก (High Impact)</span>
              </button>

              <button
                type="button"
                onClick={() => setImportance('high_medium')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  importance === 'high_medium'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="ตัวเลขสำคัญปานกลางและสูง (Medium & High Impact)"
              >
                <span>🟡🔴 ปานกลาง & สูง</span>
              </button>

              <button
                type="button"
                onClick={() => setImportance('all')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  importance === 'all'
                    ? 'bg-slate-700 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="แสดงเหตุการณ์เศรษฐกิจทั้งหมด"
              >
                <span>⚪ ทั้งหมด</span>
              </button>
            </div>

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
                onClick={() => setWidgetHeight(940)}
                className={`px-2.5 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                  widgetHeight === 940
                    ? 'bg-white/10 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                กว้างพิเศษ (940px)
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

        {/* TradingView Calendar Widget */}
        <div className="relative">
          <TradingViewCalendar
            importance={importance}
            region={region}
            height={widgetHeight}
            isFullscreen={false}
            onToggleFullscreen={() => setIsFullscreen(true)}
            onImportanceChange={(imp) => setImportance(imp)}
            onRegionChange={(reg) => setRegion(reg)}
          />
        </div>

        {/* Minimalist Macro Guide & Risk Tips */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-2">
          <div className="p-4 rounded-2xl bg-[#12151C] border border-white/[0.08] flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
              <Layers className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-white">การอ่านค่าตัวเลข</h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                <strong>Actual</strong> คือตัวเลขจริงที่เพิ่งประกาศ, <strong>Forecast</strong> คือค่าประมาณการของตลาด หากตัวเลขจริงออกมาห่างจากคาดการณ์มาก ตลาดมักจะผันผวนรุนแรง
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[#12151C] border border-white/[0.08] flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-white">ช่วงเวลาสำคัญของตลาดสหรัฐฯ</h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                ตัวเลขหลัก (CPI, Non-Farm, GDP) มักประกาศเวลา <strong>19:30 น.</strong> หรือ <strong>20:30 น.</strong> (เวลาไทย) ส่วนมติ FOMC ของ FED จะประกาศเวลา <strong>01:00 น.</strong>
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[#12151C] border border-white/[0.08] flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-white">การบริหารความเสี่ยงพอร์ต</h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                ก่อนตัวเลข <strong>🔴 สำคัญมาก</strong> ประกาศ แนะนำตรวจสอบสัดส่วนเงินสด (Cash Buffer) และหลีกเลี่ยงการเปิด Position ใหม่ช่วงไม่กี่นาทีก่อนประกาศเพื่อลดความเสี่ยงจาก Spread ถ่าง
              </p>
            </div>
          </div>
        </div>

        {/* Fullscreen Theater Overlay */}
        {isFullscreen && (
          <div className="fixed inset-0 z-50 bg-[#090B10] flex flex-col p-3 animate-in fade-in duration-200">
            {/* Top Bar inside Fullscreen */}
            <div className="flex items-center justify-between px-3 py-2 bg-[#12151C] border border-white/[0.1] rounded-xl mb-2">
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-white flex items-center gap-2">
                  <span>{currentRegionMeta.flag}</span>
                  <span>ปฏิทินเศรษฐกิจ ({currentRegionMeta.label}) — โหมดขยายเต็มจอ</span>
                </span>
                <span className="text-xs text-slate-400 hidden sm:inline">
                  • กดปุ่ม ESC หรือคลิกปุ่มขวาเพื่อออกจากโหมดเต็มจอ
                </span>
              </div>

              <div className="flex items-center gap-2">
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

            {/* Fullscreen Widget */}
            <div className="flex-1 w-full rounded-xl overflow-hidden">
              <TradingViewCalendar
                importance={importance}
                region={region}
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
