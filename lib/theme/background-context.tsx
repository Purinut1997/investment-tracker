'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'

export type BackgroundTheme =
  | 'candlestick'
  | 'aurora'
  | 'constellation'
  | 'gradient'
  | 'minimal'

export type BackgroundIntensity = 'subtle' | 'balanced' | 'vivid'

export interface ThemeOption {
  id: BackgroundTheme
  name: string
  nameEn: string
  description: string
  badge?: string
  accentColor: string
  previewGradient: string
}

export const BACKGROUND_THEMES: ThemeOption[] = [
  {
    id: 'candlestick',
    name: 'แท่งเทียนและคลื่นราคา',
    nameEn: 'Dynamic Candlestick & Price Waves',
    description: 'กราฟแท่งเทียนเคลื่อนไหวสลับเขียว-แดง พร้อมคลื่นราคาตลาดสดสไตล์ TradingView',
    badge: 'ยอดนิยม',
    accentColor: '#10b981',
    previewGradient: 'from-emerald-500/30 via-cyan-500/20 to-rose-500/30',
  },
  {
    id: 'aurora',
    name: 'ออโรร่าและกริดการเงิน',
    nameEn: 'Cyber Aurora & Trading Grid',
    description: 'คลื่นแสงออโรร่าสีคราม-มรกตเรืองแสงพริ้วไหว พร้อมตารางกริดระบบการเงินไฮเอนด์',
    accentColor: '#06b6d4',
    previewGradient: 'from-indigo-500/30 via-cyan-500/25 to-emerald-500/30',
  },
  {
    id: 'constellation',
    name: 'กลุ่มดาวและจุดราคา',
    nameEn: 'Interactive Constellation',
    description: 'จุดประกายแสงราคาเชื่อมต่อกันเป็นโครงข่าย ตอบสนองและกระจายแสงตามการเคลื่อนที่ของเมาส์',
    accentColor: '#8b5cf6',
    previewGradient: 'from-violet-500/30 via-indigo-500/20 to-pink-500/30',
  },
  {
    id: 'gradient',
    name: 'คลื่นสีหรูหรา',
    nameEn: 'Fluid Mesh Gradient',
    description: 'คลื่น Gradient สีนุ่มนวลระดับไฮเอนด์แบบ Stripe/Apple FinTech สบายตา',
    accentColor: '#3b82f6',
    previewGradient: 'from-blue-600/30 via-indigo-600/20 to-emerald-600/20',
  },
  {
    id: 'minimal',
    name: 'มืดสนิทเรียบง่าย',
    nameEn: 'Pure Minimal Dark',
    description: 'พื้นหลังสีดำสนิท ไร้ภาพเคลื่อนไหว คมชัดและประหยัดพลังงานสูงสุด',
    accentColor: '#64748b',
    previewGradient: 'from-slate-900 via-slate-950 to-black',
  },
]

interface BackgroundContextType {
  theme: BackgroundTheme
  setTheme: (theme: BackgroundTheme) => void
  intensity: BackgroundIntensity
  setIntensity: (intensity: BackgroundIntensity) => void
  isLoaded: boolean
}

const BackgroundContext = createContext<BackgroundContextType>({
  theme: 'candlestick',
  setTheme: () => {},
  intensity: 'balanced',
  setIntensity: () => {},
  isLoaded: false,
})

const STORAGE_KEY_THEME = 'investment_bg_theme'
const STORAGE_KEY_INTENSITY = 'investment_bg_intensity'

export function BackgroundThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<BackgroundTheme>('candlestick')
  const [intensity, setIntensityState] = useState<BackgroundIntensity>('balanced')
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem(STORAGE_KEY_THEME) as BackgroundTheme | null
      if (savedTheme && ['candlestick', 'aurora', 'constellation', 'gradient', 'minimal'].includes(savedTheme)) {
        setThemeState(savedTheme)
      } else {
        // Default to candlestick as selected by user
        setThemeState('candlestick')
      }

      const savedIntensity = localStorage.getItem(STORAGE_KEY_INTENSITY) as BackgroundIntensity | null
      if (savedIntensity && ['subtle', 'balanced', 'vivid'].includes(savedIntensity)) {
        setIntensityState(savedIntensity)
      } else {
        setIntensityState('balanced')
      }
    } catch {
      // LocalStorage might be restricted
    } finally {
      setIsLoaded(true)
    }
  }, [])

  const setTheme = (newTheme: BackgroundTheme) => {
    setThemeState(newTheme)
    try {
      localStorage.setItem(STORAGE_KEY_THEME, newTheme)
    } catch {}
  }

  const setIntensity = (newIntensity: BackgroundIntensity) => {
    setIntensityState(newIntensity)
    try {
      localStorage.setItem(STORAGE_KEY_INTENSITY, newIntensity)
    } catch {}
  }

  return (
    <BackgroundContext.Provider
      value={{
        theme,
        setTheme,
        intensity,
        setIntensity,
        isLoaded,
      }}
    >
      {children}
    </BackgroundContext.Provider>
  )
}

export function useBackgroundTheme() {
  return useContext(BackgroundContext)
}
