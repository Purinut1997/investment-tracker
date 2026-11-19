'use client'

import React, { useState } from 'react'
import { isGoldTicker } from '@/lib/market-data/gold'

interface StockLogoProps {
  ticker: string
  name?: string
  size?: number | string
  className?: string
}

// Consistent curated gradient colors for fallback avatars
const BADGE_COLORS = [
  'from-blue-600 to-indigo-600 text-white',
  'from-emerald-600 to-teal-600 text-white',
  'from-violet-600 to-purple-600 text-white',
  'from-rose-600 to-pink-600 text-white',
  'from-amber-600 to-orange-600 text-white',
  'from-cyan-600 to-blue-600 text-white',
  'from-indigo-600 to-cyan-600 text-white',
]

function getBadgeColor(ticker: string): string {
  let hash = 0
  for (let i = 0; i < ticker.length; i++) {
    hash = (hash << 5) - hash + ticker.charCodeAt(i)
  }
  return BADGE_COLORS[Math.abs(hash) % BADGE_COLORS.length]
}

export function StockLogo({
  ticker,
  name,
  size = 36,
  className = '',
}: StockLogoProps) {
  const [error, setError] = useState(false)
  const cleanTicker = (ticker || '').trim().toUpperCase()
  const dim = typeof size === 'number' ? `${size}px` : size

  // Special golden bullion emblem for Gold assets (XAU / GOLD965 / etc.)
  if (isGoldTicker(cleanTicker)) {
    return (
      <div
        className={`rounded-xl flex flex-col items-center justify-center font-black bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-600 text-amber-950 shadow-md shadow-amber-500/20 shrink-0 border border-amber-300/60 select-none ${className}`}
        style={{ width: dim, height: dim, minWidth: dim, minHeight: dim }}
        title={name || cleanTicker}
      >
        <span className="text-[11px] leading-none tracking-tight">Au</span>
        <span className="text-[8px] font-bold opacity-80 leading-none mt-0.5">
          {cleanTicker === 'GOLD965' ? '96.5' : '99.99'}
        </span>
      </div>
    )
  }

  // Parqet symbol logo CDN - high quality crisp SVG/PNG logos
  const logoUrl = `https://assets.parqet.com/logos/symbol/${encodeURIComponent(cleanTicker)}?format=png`

  if (error || !cleanTicker) {
    const initials = cleanTicker.slice(0, 3) || '?'
    const colorClass = getBadgeColor(cleanTicker)

    return (
      <div
        className={`rounded-xl flex items-center justify-center font-bold text-xs bg-gradient-to-br shadow-sm shrink-0 border border-white/10 select-none ${colorClass} ${className}`}
        style={{ width: dim, height: dim, minWidth: dim, minHeight: dim }}
        title={name || cleanTicker}
      >
        <span>{initials}</span>
      </div>
    )
  }

  return (
    <div
      className={`rounded-xl overflow-hidden bg-white/[0.04] p-1 border border-white/[0.08] flex items-center justify-center shrink-0 shadow-sm ${className}`}
      style={{ width: dim, height: dim, minWidth: dim, minHeight: dim }}
    >
      <img
        src={logoUrl}
        alt={`${cleanTicker} logo`}
        className="w-full h-full object-contain rounded-lg"
        loading="lazy"
        onError={() => setError(true)}
      />
    </div>
  )
}
