'use client'

import React from 'react'

interface SparklineProps {
  data?: number[]
  seed?: string
  trend?: 'up' | 'down' | 'neutral'
  width?: number
  height?: number
  strokeWidth?: number
  className?: string
}

export function Sparkline({
  data,
  seed = 'stock',
  trend = 'up',
  width = 72,
  height = 24,
  strokeWidth = 1.75,
  className = '',
}: SparklineProps) {
  // Generate 7 deterministic points if data not provided
  const points: number[] = React.useMemo(() => {
    if (data && data.length >= 2) return data

    // Deterministic pseudo-random sequence using seed string
    let hash = 0
    for (let i = 0; i < seed.length; i++) {
      hash = (hash << 5) - hash + seed.charCodeAt(i)
      hash |= 0
    }
    const pseudo = (n: number) => {
      const x = Math.sin(hash + n) * 10000
      return x - Math.floor(x)
    }

    const pts: number[] = [50]
    for (let i = 1; i < 7; i++) {
      const delta = (pseudo(i) - 0.48) * 18
      const bias = trend === 'up' ? 3 : trend === 'down' ? -3 : 0
      pts.push(Math.max(10, Math.min(90, pts[i - 1] + delta + bias)))
    }
    // Guarantee ending matches trend
    if (trend === 'up' && pts[pts.length - 1] <= pts[0]) {
      pts[pts.length - 1] = pts[0] + 12
    } else if (trend === 'down' && pts[pts.length - 1] >= pts[0]) {
      pts[pts.length - 1] = pts[0] - 12
    }
    return pts
  }, [data, seed, trend])

  const isUp = trend === 'up' || (points[points.length - 1] >= points[0])
  const strokeColor = isUp ? '#34d399' : '#fb7185' // Emerald or Rose
  const glowColor = isUp ? 'rgba(16, 185, 129, 0.4)' : 'rgba(244, 63, 94, 0.4)'
  const gradientId = React.useId()

  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min === 0 ? 1 : max - min

  // Padding to prevent edge clipping
  const padX = 2
  const padY = 3
  const usableW = width - padX * 2
  const usableH = height - padY * 2

  const coords = points.map((val, idx) => {
    const x = Number((padX + (idx / (points.length - 1)) * usableW).toFixed(3))
    const y = Number((padY + usableH - ((val - min) / range) * usableH).toFixed(3))
    return { x, y }
  })

  // Generate smooth cubic bezier SVG path
  let pathD = `M ${coords[0].x},${coords[0].y}`
  for (let i = 0; i < coords.length - 1; i++) {
    const current = coords[i]
    const next = coords[i + 1]
    const controlX = Number(((current.x + next.x) / 2).toFixed(3))
    pathD += ` C ${controlX},${current.y} ${controlX},${next.y} ${next.x},${next.y}`
  }

  // Area under curve path
  const areaD = `${pathD} L ${coords[coords.length - 1].x},${height} L ${coords[0].x},${height} Z`

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={`overflow-visible ${className}`}
      style={{ filter: `drop-shadow(0 0 4px ${glowColor})` }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity={0.35} />
          <stop offset="100%" stopColor={strokeColor} stopOpacity={0.0} />
        </linearGradient>
      </defs>

      {/* Subtle Area gradient fill */}
      <path d={areaD} fill={`url(#${gradientId})`} />

      {/* Smooth Sparkline stroke */}
      <path
        d={pathD}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Pulsing latest-point dot */}
      <circle
        cx={coords[coords.length - 1].x}
        cy={coords[coords.length - 1].y}
        r={2}
        fill={strokeColor}
      />
    </svg>
  )
}
