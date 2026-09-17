'use client'

import React, { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'

export function ThemeToggle({ className = '' }: { className?: string }) {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('theme') as 'dark' | 'light' | null
    if (saved) {
      setTheme(saved)
      document.documentElement.setAttribute('data-theme', saved)
    } else {
      document.documentElement.setAttribute('data-theme', 'dark')
    }
    setMounted(true)
  }, [])

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('theme', next)
    document.documentElement.setAttribute('data-theme', next)
  }

  if (!mounted) {
    return (
      <div className={`w-8 h-8 rounded-lg bg-[var(--bg-elevated)] animate-pulse ${className}`} />
    )
  }

  const isDark = theme === 'dark'

  return (
    <button
      onClick={toggleTheme}
      className={`relative p-2 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]/70 text-[var(--text-secondary)] hover:text-white hover:border-[var(--cyan-400)]/40 transition-all hover:shadow-[0_0_12px_rgba(34,211,238,0.15)] active:scale-95 flex items-center justify-center ${className}`}
      title={isDark ? 'สลับเป็นโหมดสว่าง (Light Mode)' : 'สลับเป็นโหมดมืด (Dark Mode)'}
      aria-label="Toggle Theme"
    >
      <div className="relative w-4 h-4">
        <Sun
          className={`w-4 h-4 text-amber-400 absolute inset-0 transition-transform duration-300 ${
            isDark ? 'scale-0 rotate-90 opacity-0' : 'scale-100 rotate-0 opacity-100'
          }`}
        />
        <Moon
          className={`w-4 h-4 text-[var(--cyan-400)] absolute inset-0 transition-transform duration-300 ${
            isDark ? 'scale-100 rotate-0 opacity-100' : 'scale-0 -rotate-90 opacity-0'
          }`}
        />
      </div>
    </button>
  )
}
