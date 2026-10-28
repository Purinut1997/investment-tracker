'use client'

import React, { useId, useMemo } from 'react'
import { ArrowUpRight, ArrowDownRight, TrendingUp, Cpu, Building2, Coins, Shield, Activity } from 'lucide-react'

export interface MarketBenchmark {
  symbol: string
  name: string
  price: number
  changePercent: number
  change?: number
  high?: number
  low?: number
  previousClose?: number
  currency: string
  category?: string
}

interface BenchmarkCardProps {
  benchmark: MarketBenchmark
  onClick?: () => void
}

/**
 * Deterministically generates smooth sparkline points based on quote parameters
 */
function generateSparklinePoints(
  symbol: string,
  price: number,
  changePercent: number,
  high?: number,
  low?: number,
  previousClose?: number
): number[] {
  const count = 9
  const prev = previousClose && previousClose > 0
    ? previousClose
    : (price / (1 + (changePercent / 100 || 0.001)))

  const minPrice = low && low < price && low < prev ? low : Math.min(price, prev) * 0.995
  const maxPrice = high && high > price && high > prev ? high : Math.max(price, prev) * 1.005

  // Deterministic seed based on symbol character codes
  let seed = 0
  for (let i = 0; i < symbol.length; i++) {
    seed = (seed * 31 + symbol.charCodeAt(i)) % 1000
  }

  const points: number[] = [prev]
  for (let i = 1; i < count - 1; i++) {
    const progress = i / (count - 1)
    const base = prev + (price - prev) * progress
    const wave = Math.sin(seed + i * 1.8) * 0.5 + Math.cos(seed * 0.7 + i * 2.3) * 0.5
    const spread = (maxPrice - minPrice) * 0.22
    let val = base + wave * spread
    val = Math.max(minPrice, Math.min(maxPrice, val))
    points.push(val)
  }
  points.push(price)
  return points
}

/**
 * Converts points into smooth cubic bezier SVG paths
 */
function createSmoothSvgPaths(points: number[], width = 100, height = 32) {
  if (!points || points.length < 2) return { linePath: '', areaPath: '', endPoint: { x: 0, y: 0 } }

  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 1
  const pt = 3
  const pb = 3
  const usableH = height - pt - pb

  const coords = points.map((p, idx) => {
    const x = (idx / (points.length - 1)) * width
    const y = height - pb - ((p - min) / range) * usableH
    return { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) }
  })

  let d = `M ${coords[0].x} ${coords[0].y}`
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[i === 0 ? i : i - 1]
    const p1 = coords[i]
    const p2 = coords[i + 1]
    const p3 = coords[i + 2] || p2

    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
  }

  const last = coords[coords.length - 1]
  const areaD = `${d} L ${width} ${height} L 0 ${height} Z`

  return { linePath: d, areaPath: areaD, endPoint: last }
}

export function BenchmarkCard({ benchmark, onClick }: BenchmarkCardProps) {
  const gradientId = useId()
  const isVix = benchmark.symbol.toUpperCase().includes('VIX')
  const isUp = benchmark.changePercent >= 0

  // Asset Metadata (Icons, category tags, color schemes)
  const meta = useMemo(() => {
    const sym = benchmark.symbol.toUpperCase()
    if (sym.includes('S&P') || sym.includes('SPX')) {
      return {
        tag: 'INDEX',
        sub: benchmark.name || 'ดัชนีตลาดสหรัฐฯ',
        icon: <TrendingUp className="w-3.5 h-3.5 text-blue-400" />,
        badgeBg: 'bg-blue-500/10 border-blue-500/25',
        dotColor: '#3b82f6',
      }
    }
    if (sym.includes('NASDAQ') || sym.includes('NDX')) {
      return {
        tag: 'TECH',
        sub: benchmark.name || 'หุ้นเทคโนโลยี',
        icon: <Cpu className="w-3.5 h-3.5 text-indigo-400" />,
        badgeBg: 'bg-indigo-500/10 border-indigo-500/25',
        dotColor: '#6366f1',
      }
    }
    if (sym.includes('SET')) {
      return {
        tag: 'THAI',
        sub: benchmark.name || 'ตลาดหุ้นไทย',
        icon: <Building2 className="w-3.5 h-3.5 text-emerald-400" />,
        badgeBg: 'bg-emerald-500/10 border-emerald-500/25',
        dotColor: '#10b981',
      }
    }
    if (sym.includes('BTC') || sym.includes('BITCOIN')) {
      return {
        tag: 'CRYPTO',
        sub: benchmark.name || 'Bitcoin',
        icon: <Coins className="w-3.5 h-3.5 text-amber-400" />,
        badgeBg: 'bg-amber-500/10 border-amber-500/25',
        dotColor: '#f59e0b',
      }
    }
    if (sym.includes('GOLD') || sym.includes('XAU')) {
      return {
        tag: 'METALS',
        sub: benchmark.name || 'ทองคำสปอต',
        icon: <Shield className="w-3.5 h-3.5 text-yellow-400" />,
        badgeBg: 'bg-yellow-500/10 border-yellow-500/25',
        dotColor: '#eab308',
      }
    }
    // Default VIX
    return {
      tag: 'VOLATILITY',
      sub: benchmark.name || 'ความกลัวตลาด',
      icon: <Activity className="w-3.5 h-3.5 text-cyan-400" />,
      badgeBg: 'bg-cyan-500/10 border-cyan-500/25',
      dotColor: '#06b6d4',
    }
  }, [benchmark.symbol, benchmark.name])

  // VIX Sentiment Classification
  const vixInfo = useMemo(() => {
    if (!isVix) return null
    const price = benchmark.price
    if (price < 15) {
      return {
        label: 'สงบ / ผ่อนคลาย',
        color: '#10b981',
        pillClass: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30',
      }
    }
    if (price < 20) {
      return {
        label: 'ปกติ / สมดุล',
        color: '#06b6d4',
        pillClass: 'text-cyan-300 bg-cyan-500/15 border-cyan-500/30',
      }
    }
    if (price < 28) {
      return {
        label: 'กังวล / ผันผวน',
        color: '#f59e0b',
        pillClass: 'text-amber-300 bg-amber-500/15 border-amber-500/30',
      }
    }
    return {
      label: 'กลัวจัด / จุดช้อน',
      color: '#f43f5e',
      pillClass: 'text-rose-300 bg-rose-500/20 border-rose-500/40',
    }
  }, [isVix, benchmark.price])

  // Determine line color and gradient
  const strokeColor = useMemo(() => {
    if (isVix) {
      return vixInfo ? vixInfo.color : '#06b6d4'
    }
    return isUp ? '#10b981' : '#f43f5e'
  }, [isVix, isUp, vixInfo])

  // Generate sparkline
  const { linePath, areaPath, endPoint } = useMemo(() => {
    const pts = generateSparklinePoints(
      benchmark.symbol,
      benchmark.price,
      benchmark.changePercent,
      benchmark.high,
      benchmark.low,
      benchmark.previousClose
    )
    return createSmoothSvgPaths(pts, 100, 32)
  }, [benchmark.symbol, benchmark.price, benchmark.changePercent, benchmark.high, benchmark.low, benchmark.previousClose])

  // Price formatting
  const formattedPrice = useMemo(() => {
    const p = benchmark.price
    const decimals = p < 10 ? 3 : 2
    const numStr = p.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
    const prefix = benchmark.currency === 'USD' ? '$' : benchmark.currency === 'THB' ? '฿' : ''
    const suffix = benchmark.currency === 'PTS' ? ' pts' : ''
    return `${prefix}${numStr}${suffix}`
  }, [benchmark.price, benchmark.currency])

  // Absolute change in points / currency
  const formattedChangePoints = useMemo(() => {
    const pts = benchmark.change !== undefined && benchmark.change !== null
      ? benchmark.change
      : (benchmark.price * (benchmark.changePercent / 100))
    const absPts = Math.abs(pts)
    const decimals = absPts < 10 ? 2 : 2
    const sign = pts >= 0 ? '+' : '-'
    const prefix = benchmark.currency === 'USD' ? '$' : benchmark.currency === 'THB' ? '฿' : ''
    const suffix = benchmark.currency === 'PTS' ? ' pts' : ''
    return `${sign}${prefix}${absPts.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}${suffix}`
  }, [benchmark.change, benchmark.price, benchmark.changePercent, benchmark.currency])

  // Day Range Calculation
  const { lowVal, highVal, rangePercent } = useMemo(() => {
    const p = benchmark.price
    const defaultSpread = Math.max(0.004, Math.abs(benchmark.changePercent) / 100 * 0.7)
    const lo = benchmark.low && benchmark.low <= p ? benchmark.low : p * (1 - defaultSpread)
    const hi = benchmark.high && benchmark.high >= p ? benchmark.high : p * (1 + defaultSpread)
    const spread = hi - lo || 1
    const pct = Math.min(100, Math.max(0, ((p - lo) / spread) * 100))

    const formatNum = (v: number) => {
      const dec = v < 10 ? 2 : 2
      const pre = benchmark.currency === 'USD' ? '$' : benchmark.currency === 'THB' ? '฿' : ''
      return `${pre}${v.toLocaleString(undefined, {
        minimumFractionDigits: dec,
        maximumFractionDigits: dec,
      })}`
    }

    return {
      lowVal: formatNum(lo),
      highVal: formatNum(hi),
      rangePercent: pct,
    }
  }, [benchmark.price, benchmark.low, benchmark.high, benchmark.changePercent, benchmark.currency])

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick?.()
        }
      }}
      className={`group relative rounded-2xl p-3.5 sm:p-4 bg-slate-900/85 border ${
        isVix
          ? 'border-amber-500/25 hover:border-amber-500/50'
          : 'border-white/[0.08] hover:border-blue-500/40'
      } hover:bg-slate-900/95 transition-all duration-200 cursor-pointer shadow-md hover:shadow-xl hover:shadow-blue-950/20 flex flex-col justify-between overflow-hidden backdrop-blur-xl focus:outline-none focus:ring-2 focus:ring-blue-500/40`}
    >
      {/* Subtle Ambient Hover Glow */}
      <div
        className="absolute -top-12 -right-12 w-28 h-28 rounded-full blur-2xl pointer-events-none opacity-0 group-hover:opacity-15 transition-opacity duration-300"
        style={{ backgroundColor: strokeColor }}
      />

      {/* Row 1: Asset Header (Icon + Symbol + Tag | Change Badge) */}
      <div>
        <div className="flex items-start justify-between gap-1.5 mb-1">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${meta.badgeBg}`}
            >
              {meta.icon}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-black text-white tracking-tight group-hover:text-blue-400 transition-colors truncate">
                  {benchmark.symbol}
                </span>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/[0.06] text-slate-400 uppercase tracking-wider shrink-0">
                  {meta.tag}
                </span>
              </div>
            </div>
          </div>

          {/* 24h Change Badge */}
          <span
            className={`inline-flex items-center text-xs font-black px-2 py-0.5 rounded-lg border shrink-0 ${
              isVix
                ? isUp
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                  : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                : isUp
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
            }`}
          >
            {isUp ? (
              <ArrowUpRight className="w-3.5 h-3.5 mr-0.5 shrink-0" />
            ) : (
              <ArrowDownRight className="w-3.5 h-3.5 mr-0.5 shrink-0" />
            )}
            <span>
              {isUp ? '+' : ''}
              {benchmark.changePercent.toFixed(2)}%
            </span>
          </span>
        </div>

        {/* Subtitle / Asset Thai Context */}
        <p className="text-[11px] font-medium text-slate-400 truncate pl-9 -mt-0.5">
          {meta.sub}
        </p>

        {/* Row 2: Hero Price & Absolute Change Points */}
        <div className="mt-2.5 flex items-baseline justify-between gap-2">
          <span className="text-lg sm:text-xl font-black text-white font-mono tracking-tight">
            {formattedPrice}
          </span>
          <span
            className={`text-xs font-semibold font-mono tracking-tight ${
              isVix
                ? isUp
                  ? 'text-amber-400'
                  : 'text-emerald-400'
                : isUp
                ? 'text-emerald-400'
                : 'text-rose-400'
            }`}
          >
            {formattedChangePoints}
          </span>
        </div>
      </div>

      {/* Row 3: Visual Smooth SVG Sparkline */}
      <div className="my-2 h-7 w-full relative">
        <svg
          viewBox="0 0 100 32"
          className="w-full h-full overflow-visible"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={strokeColor} stopOpacity="0.28" />
              <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill={`url(#${gradientId})`} />
          <path
            d={linePath}
            fill="none"
            stroke={strokeColor}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Pulsating End-of-Day Dot */}
          <circle
            cx={endPoint.x}
            cy={endPoint.y}
            r="2.5"
            fill={strokeColor}
            className="animate-pulse"
          />
        </svg>
      </div>

      {/* Row 4: Context Footer (Day Range Bar or VIX Regime) */}
      <div className="pt-2 border-t border-white/[0.06]">
        {isVix && vixInfo ? (
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400 font-medium">ระดับความกลัว:</span>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded border ${vixInfo.pillClass}`}
            >
              {vixInfo.label}
            </span>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono mb-1">
              <span className="truncate max-w-[45%]">L: {lowVal}</span>
              <span className="text-slate-500 font-medium text-[9px] uppercase tracking-wider">
                24h Range
              </span>
              <span className="truncate max-w-[45%] text-right">H: {highVal}</span>
            </div>
            {/* Range Progress Track */}
            <div className="w-full h-1 bg-white/[0.08] rounded-full overflow-hidden relative">
              <div
                className="absolute top-0 bottom-0 rounded-full transition-all duration-500"
                style={{
                  left: '0%',
                  width: `${rangePercent}%`,
                  backgroundColor: strokeColor,
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
