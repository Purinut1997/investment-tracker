'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Palette, Check, Sparkles, Moon, Layers } from 'lucide-react'

export type ThemeStyle = 'aurora' | 'minimal' | 'emerald'

export interface ThemeOption {
  id: ThemeStyle
  name: string
  subtitle: string
  tag: string
  dots: string[]
  previewBg: string
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'aurora',
    name: 'Aurora Glass',
    subtitle: 'กระจกฝ้า Deep Indigo & แสงออโรร่า นุ่มนวล มีชีวิตชีวา',
    tag: 'ยอดนิยม',
    dots: ['#a78bfa', '#67e8f9', '#ec4899'],
    previewBg: 'from-violet-950/80 via-[#07041a] to-cyan-950/60',
  },
  {
    id: 'minimal',
    name: 'Minimal Slate',
    subtitle: 'คมชัด เรียบหรู สะอาดตา ไร้แสงฟุ้ง สไตล์ Linear / Apple',
    tag: 'สบายตา',
    dots: ['#f3f4f6', '#9ca3af', '#38bdf8'],
    previewBg: 'from-[#13151b] via-[#0b0c10] to-[#171a22]',
  },
  {
    id: 'emerald',
    name: 'Cyber Emerald',
    subtitle: 'โทนดำลึกตัดเขียวมรกต สไตล์ High-Tech FinTech & Wealth',
    tag: 'หรูหรา',
    dots: ['#10b981', '#2dd4bf', '#34d399'],
    previewBg: 'from-emerald-950/80 via-[#020906] to-teal-950/70',
  },
]

export function ThemeStyleSelector({ variant = 'dropdown' }: { variant?: 'dropdown' | 'inline' }) {
  const [currentTheme, setCurrentTheme] = useState<ThemeStyle>('aurora')
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const saved = localStorage.getItem('investment_theme_style') as ThemeStyle | null
    if (saved && (saved === 'aurora' || saved === 'minimal' || saved === 'emerald')) {
      setCurrentTheme(saved)
      document.documentElement.setAttribute('data-theme-style', saved)
    } else {
      document.documentElement.setAttribute('data-theme-style', 'aurora')
    }
  }, [])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  function selectTheme(theme: ThemeStyle) {
    setCurrentTheme(theme)
    localStorage.setItem('investment_theme_style', theme)
    document.documentElement.setAttribute('data-theme-style', theme)
    setOpen(false)
  }

  const activeOption = THEME_OPTIONS.find((t) => t.id === currentTheme) || THEME_OPTIONS[0]

  if (variant === 'inline') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {THEME_OPTIONS.map((opt) => {
          const isActive = currentTheme === opt.id
          return (
            <button
              key={opt.id}
              onClick={() => selectTheme(opt.id)}
              className={`text-left p-4 rounded-2xl border transition-all duration-200 relative overflow-hidden flex flex-col justify-between group ${
                isActive
                  ? 'bg-white/[0.08] border-violet-400/50 shadow-[0_0_24px_rgba(167,139,250,0.18)] ring-1 ring-violet-400/40'
                  : 'bg-white/[0.03] border-white/[0.08] hover:border-white/20 hover:bg-white/[0.05]'
              }`}
            >
              {/* Preview mini banner */}
              <div className={`w-full h-12 rounded-xl mb-3.5 bg-gradient-to-br ${opt.previewBg} p-2.5 flex items-center justify-between border border-white/10`}>
                <div className="flex items-center gap-1.5">
                  {opt.dots.map((d, i) => (
                    <span key={i} className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: d }} />
                  ))}
                </div>
                {isActive && (
                  <span className="w-5 h-5 rounded-full bg-emerald-500 text-black flex items-center justify-center shadow-md">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </span>
                )}
              </div>

              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-bold text-white group-hover:text-violet-300 transition-colors">
                    {opt.name}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-[var(--text-secondary)] font-medium">
                    {opt.tag}
                  </span>
                </div>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                  {opt.subtitle}
                </p>
              </div>
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.08] hover:border-white/20 text-xs font-medium text-[var(--text-secondary)] hover:text-white transition-all shadow-sm"
        title="เลือกรูปแบบธีมและการตกแต่ง"
      >
        <Palette className="w-3.5 h-3.5 text-[var(--violet)]" />
        <span className="hidden sm:inline text-xs">{activeOption.name}</span>
        <div className="flex items-center gap-1">
          {activeOption.dots.map((d, i) => (
            <span key={i} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: d }} />
          ))}
        </div>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 p-2.5 rounded-2xl bg-[#0d0a2e]/95 backdrop-blur-2xl border border-white/15 shadow-[0_16px_48px_rgba(0,0,0,0.7)] z-50 animate-scale-in">
          <div className="px-2.5 py-2 border-b border-white/[0.08] mb-2 flex items-center justify-between">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[var(--violet)]" />
              รูปแบบและธีม UI
            </span>
            <span className="text-[10px] text-[var(--text-muted)]">3 รูปแบบ</span>
          </div>

          <div className="space-y-1.5">
            {THEME_OPTIONS.map((opt) => {
              const isActive = currentTheme === opt.id
              return (
                <button
                  key={opt.id}
                  onClick={() => selectTheme(opt.id)}
                  className={`w-full text-left p-2.5 rounded-xl transition-all flex items-start gap-3 group ${
                    isActive
                      ? 'bg-violet-500/15 border border-violet-500/30 text-white'
                      : 'hover:bg-white/[0.06] border border-transparent text-[var(--text-secondary)] hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-1 mt-1 shrink-0">
                    {opt.dots.map((d, i) => (
                      <span key={i} className="w-2 h-2 rounded-full shadow-xs" style={{ backgroundColor: d }} />
                    ))}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-white group-hover:text-violet-300">
                        {opt.name}
                      </span>
                      {isActive && (
                        <span className="w-4 h-4 rounded-full bg-emerald-500 text-black flex items-center justify-center shrink-0">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[var(--text-muted)] truncate mt-0.5">
                      {opt.subtitle}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
