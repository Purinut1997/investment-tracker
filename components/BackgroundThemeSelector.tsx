'use client'

import React from 'react'
import {
  useBackgroundTheme,
  BACKGROUND_THEMES,
  BackgroundTheme,
  BackgroundIntensity,
} from '@/lib/theme/background-context'
import {
  Check,
  Sparkles,
  TrendingUp,
  Activity,
  Layers,
  Moon,
  SunMedium,
  Sliders,
} from 'lucide-react'

const THEME_ICONS: Record<BackgroundTheme, React.ComponentType<{ className?: string }>> = {
  candlestick: TrendingUp,
  aurora: Activity,
  constellation: Sparkles,
  gradient: Layers,
  minimal: Moon,
}

export function BackgroundThemeSelector() {
  const { theme, setTheme, intensity, setIntensity, isLoaded } = useBackgroundTheme()

  if (!isLoaded) {
    return (
      <div className="animate-pulse flex items-center justify-center p-8 bg-slate-900/40 rounded-2xl border border-slate-800">
        <span className="text-xs text-slate-500 font-mono">กำลังโหลดตัวเลือกธีม...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ── Theme Cards Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {BACKGROUND_THEMES.map((t) => {
          const Icon = THEME_ICONS[t.id]
          const isSelected = theme === t.id

          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTheme(t.id)}
              className={`group relative text-left p-4 rounded-2xl border transition-all duration-200 cursor-pointer overflow-hidden ${
                isSelected
                  ? 'bg-slate-900/90 border-indigo-500/80 shadow-lg shadow-indigo-500/10 ring-1 ring-indigo-500/50'
                  : 'bg-slate-900/40 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40'
              }`}
            >
              {/* Mini Preview Background Gradient */}
              <div
                className={`absolute inset-0 bg-gradient-to-br ${t.previewGradient} opacity-30 group-hover:opacity-45 transition-opacity pointer-events-none`}
              />

              <div className="relative z-10 flex flex-col justify-between h-full space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center border ${
                        isSelected
                          ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                          : 'bg-slate-800/80 border-slate-700/60 text-slate-400 group-hover:text-white'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-sm text-white">
                          {t.name}
                        </span>
                        {t.badge && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            {t.badge}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-mono text-slate-400 block truncate max-w-[190px]">
                        {t.nameEn}
                      </span>
                    </div>
                  </div>

                  {/* Active Radio Badge */}
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center border transition-all ${
                      isSelected
                        ? 'bg-indigo-600 border-indigo-500 text-white'
                        : 'border-slate-700 bg-slate-900/80 text-transparent'
                    }`}
                  >
                    <Check className="w-3 h-3" />
                  </div>
                </div>

                <p className="text-xs text-slate-300/80 line-clamp-2 leading-relaxed">
                  {t.description}
                </p>
              </div>
            </button>
          )
        })}
      </div>

      {/* ── Intensity Adjustment (Shown when not minimal) ── */}
      {theme !== 'minimal' && (
        <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Sliders className="w-4 h-4 text-indigo-400" />
            <div>
              <span className="text-xs font-semibold text-white">
                ระดับความชัดและแสงเรืองรอง (Intensity)
              </span>
              <p className="text-[11px] text-slate-400">
                ปรับแต่งความสว่างของแท่งเทียนและคลื่นแสงให้เหมาะกับสายตาและหน้าจอของคุณ
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-950/80 border border-slate-800">
            {(
              [
                { id: 'subtle', label: 'เบา / สบายตา' },
                { id: 'balanced', label: 'สมดุล (แนะนำ)' },
                { id: 'vivid', label: 'ชัดเจน / เรืองแสง' },
              ] as { id: BackgroundIntensity; label: string }[]
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setIntensity(opt.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  intensity === opt.id
                    ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
