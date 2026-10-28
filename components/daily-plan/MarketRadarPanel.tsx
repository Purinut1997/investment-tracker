'use client'

import React, { useEffect, useState } from 'react'
import { Clock, Globe2, Gauge, DollarSign } from 'lucide-react'

export interface MacroData {
  dxy?: { price: number; changePercent: number }
  tnx?: { price: number; changePercent: number }
}

interface MarketRadarPanelProps {
  macro?: MacroData
  usdThbRate?: number
}

interface SessionState {
  name: string
  region: string
  flag: string
  hoursText: string
  isOpen: boolean
  isPreMarket?: boolean
  statusLabel: string
  dotClass: string
}

function computeTradingSessions(): SessionState[] {
  // Current time in Bangkok (UTC+7)
  const now = new Date()
  const utc = now.getTime() + now.getTimezoneOffset() * 60000
  const bkkTime = new Date(utc + 3600000 * 7)

  const day = bkkTime.getDay() // 0 = Sun, 6 = Sat
  const hour = bkkTime.getHours()
  const minute = bkkTime.getMinutes()
  const timeInMins = hour * 60 + minute

  const isWeekend = day === 0 || day === 6

  // 1. US Equities (NYSE / NASDAQ)
  // Standard / Summer: ~20:30 or 21:30 to 03:00 / 04:00 BKK
  // Pre-market starts ~15:00 BKK
  let usOpen = false
  let usPreMarket = false
  let usLabel = 'ปิดทำการ'
  let usDot = 'bg-slate-500'

  if (!isWeekend) {
    if (timeInMins >= 20 * 60 + 30 || timeInMins < 4 * 60) {
      usOpen = true
      usLabel = 'เปิดทำการ (Regular)'
      usDot = 'bg-emerald-400 animate-pulse'
    } else if (timeInMins >= 15 * 60 && timeInMins < 20 * 60 + 30) {
      usPreMarket = true
      usLabel = 'Pre-Market (ล่วงหน้า)'
      usDot = 'bg-amber-400 animate-pulse'
    } else {
      usLabel = 'ปิดทำการ (รอเปิด 20:30)'
      usDot = 'bg-slate-500'
    }
  } else {
    usLabel = 'วันหยุดสุดสัปดาห์'
    usDot = 'bg-slate-600'
  }

  // 2. Thai Equities (SET / mai)
  // Morning: 10:00 - 12:30, Afternoon: 14:30 - 16:30
  let thOpen = false
  let thLabel = 'ปิดทำการ'
  let thDot = 'bg-slate-500'

  if (!isWeekend) {
    if (timeInMins >= 10 * 60 && timeInMins < 12 * 60 + 30) {
      thOpen = true
      thLabel = 'เปิดภาคเช้า'
      thDot = 'bg-emerald-400 animate-pulse'
    } else if (timeInMins >= 12 * 60 + 30 && timeInMins < 14 * 60 + 30) {
      thLabel = 'พักเที่ยง (Intermission)'
      thDot = 'bg-amber-400'
    } else if (timeInMins >= 14 * 60 + 30 && timeInMins < 16 * 60 + 30) {
      thOpen = true
      thLabel = 'เปิดภาคบ่าย'
      thDot = 'bg-emerald-400 animate-pulse'
    } else {
      thLabel = 'ปิดทำการ'
      thDot = 'bg-slate-500'
    }
  } else {
    thLabel = 'วันหยุดสุดสัปดาห์'
    thDot = 'bg-slate-600'
  }

  return [
    {
      name: 'US Equity',
      region: 'NYSE / NASDAQ',
      flag: '🇺🇸',
      hoursText: '20:30 - 04:00',
      isOpen: usOpen,
      isPreMarket: usPreMarket,
      statusLabel: usLabel,
      dotClass: usDot,
    },
    {
      name: 'Thai Equity',
      region: 'SET / mai',
      flag: '🇹🇭',
      hoursText: '10:00 - 16:30',
      isOpen: thOpen,
      statusLabel: thLabel,
      dotClass: thDot,
    },
    {
      name: 'Crypto',
      region: 'Global 24/7',
      flag: '🪙',
      hoursText: 'ตลอด 24 ชั่วโมง',
      isOpen: true,
      statusLabel: 'เปิดตลอด 24 ชม.',
      dotClass: 'bg-emerald-400 animate-pulse',
    },
  ]
}

export function MarketRadarPanel({ macro, usdThbRate }: MarketRadarPanelProps) {
  const [sessions, setSessions] = useState<SessionState[]>(computeTradingSessions)
  const [currentTimeStr, setCurrentTimeStr] = useState<string>('')

  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      setSessions(computeTradingSessions())
      setCurrentTimeStr(
        now.toLocaleTimeString('th-TH', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })
      )
    }

    updateTime()
    const timer = setInterval(updateTime, 30000)
    return () => clearInterval(timer)
  }, [])

  const dxy = macro?.dxy?.price ?? 104.18
  const dxyChg = macro?.dxy?.changePercent ?? 0.12
  const tnx = macro?.tnx?.price ?? 4.24
  const tnxChg = macro?.tnx?.changePercent ?? -0.05
  const fx = usdThbRate ?? 33.5

  return (
    <div className="bg-slate-900/85 border border-white/[0.08] rounded-2xl p-3.5 sm:p-4 backdrop-blur-xl shadow-md flex flex-col justify-between">
      {/* Top Header Row: Title & Current Time */}
      <div className="flex items-center justify-between gap-2 mb-3 pb-2.5 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <Globe2 className="w-4 h-4 text-blue-400" />
          <h4 className="text-xs font-bold text-white tracking-wide">
            ชั่วโมงเปิดทำการตลาดโลก & ตัวชี้วัดมหภาค (Market Sessions & Macro)
          </h4>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400 bg-white/[0.04] px-2.5 py-0.5 rounded-full border border-white/[0.06]">
          <Clock className="w-3 h-3 text-slate-400" />
          <span>เวลาไทย: {currentTimeStr || '22:40'} น.</span>
        </div>
      </div>

      {/* Grid: Left: 3 Trading Session Badges | Right: Macro Pulse */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
        {/* Left: 3 Market Sessions (7 columns) */}
        <div className="md:col-span-7 grid grid-cols-3 gap-2">
          {sessions.map((s) => (
            <div
              key={s.name}
              className="bg-slate-950/60 rounded-xl p-2 border border-white/[0.05] flex flex-col justify-between"
            >
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="text-xs font-black text-white flex items-center gap-1 truncate">
                  <span>{s.flag}</span>
                  <span className="truncate">{s.name}</span>
                </span>
                <span className={`w-2 h-2 rounded-full shrink-0 ${s.dotClass}`} />
              </div>
              <span className="text-[10px] font-semibold text-slate-300 truncate">
                {s.statusLabel}
              </span>
              <span className="text-[9px] text-slate-500 font-mono mt-0.5 truncate">
                {s.hoursText}
              </span>
            </div>
          ))}
        </div>

        {/* Right: Macro Indicators (5 columns) */}
        <div className="md:col-span-5 grid grid-cols-3 gap-2">
          {/* DXY */}
          <div className="bg-slate-950/60 rounded-xl p-2 border border-white/[0.05] text-center">
            <span className="text-[10px] font-medium text-slate-400 block truncate">
              💵 DXY Index
            </span>
            <span className="text-xs font-black text-white font-mono block mt-0.5">
              {dxy.toFixed(2)}
            </span>
            <span
              className={`text-[9px] font-bold font-mono ${
                dxyChg >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {dxyChg >= 0 ? '+' : ''}
              {dxyChg.toFixed(2)}%
            </span>
          </div>

          {/* US 10Y Yield */}
          <div className="bg-slate-950/60 rounded-xl p-2 border border-white/[0.05] text-center">
            <span className="text-[10px] font-medium text-slate-400 block truncate">
              📈 US 10Y Yield
            </span>
            <span className="text-xs font-black text-white font-mono block mt-0.5">
              {tnx.toFixed(2)}%
            </span>
            <span
              className={`text-[9px] font-bold font-mono ${
                tnxChg >= 0 ? 'text-amber-400' : 'text-emerald-400'
              }`}
            >
              {tnxChg >= 0 ? '+' : ''}
              {tnxChg.toFixed(2)}%
            </span>
          </div>

          {/* USD/THB */}
          <div className="bg-slate-950/60 rounded-xl p-2 border border-white/[0.05] text-center">
            <span className="text-[10px] font-medium text-slate-400 block truncate">
              💱 USD/THB
            </span>
            <span className="text-xs font-black text-cyan-300 font-mono block mt-0.5">
              ฿{fx.toFixed(2)}
            </span>
            <span className="text-[9px] text-slate-500 font-medium">บาท/ดอลลาร์</span>
          </div>
        </div>
      </div>
    </div>
  )
}
