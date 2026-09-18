'use client'

import React, { useState, useMemo } from 'react'

export interface CandlePoint {
  time: string
  open: number
  high: number
  low: number
  close: number
  volume: number
  timestamp: number
  sma20?: number | null
  sma50?: number | null
}

export interface TechnicalLevels {
  pivot: number
  r1: number
  r2: number
  s1: number
  s2: number
  periodHigh: number
  periodLow: number
  currentPrice: number
}

interface CandlestickChartProps {
  data: CandlePoint[]
  currencySymbol?: string
  showSR?: boolean
  showSMA?: boolean
  technicalLevels?: TechnicalLevels | null
  height?: number
}

export function CandlestickChart({
  data,
  currencySymbol = '$',
  showSR = true,
  showSMA = true,
  technicalLevels,
  height = 280,
}: CandlestickChartProps) {
  const [hoveredPoint, setHoveredPoint] = useState<CandlePoint | null>(null)
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null)

  const { minPrice, maxPrice, count } = useMemo(() => {
    if (!data || data.length === 0) return { minPrice: 0, maxPrice: 100, count: 0 }
    let min = data[0].low
    let max = data[0].high

    for (const d of data) {
      if (d.low < min) min = d.low
      if (d.high > max) max = d.high
    }

    // Also factor in S&R levels if enabled
    if (showSR && technicalLevels) {
      if (technicalLevels.s2 < min) min = technicalLevels.s2
      if (technicalLevels.r2 > max) max = technicalLevels.r2
    }

    const pad = (max - min) * 0.08 || 1
    return {
      minPrice: Math.max(0, min - pad),
      maxPrice: max + pad,
      count: data.length,
    }
  }, [data, showSR, technicalLevels])

  if (!data || data.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-xs text-slate-500">
        ไม่มีข้อมูลแท่งเทียนสำหรับช่วงเวลานี้
      </div>
    )
  }

  // Dimensions & Margins
  const paddingLeft = 10
  const paddingRight = 65
  const paddingTop = 20
  const paddingBottom = 25
  const svgWidth = 800 // base viewBox width
  const svgHeight = height
  const plotWidth = svgWidth - paddingLeft - paddingRight
  const plotHeight = svgHeight - paddingTop - paddingBottom

  // Scalers
  const scaleY = (val: number) => {
    if (maxPrice <= minPrice) return paddingTop + plotHeight / 2
    const ratio = (val - minPrice) / (maxPrice - minPrice)
    return paddingTop + plotHeight - ratio * plotHeight
  }

  const scaleX = (index: number) => {
    if (count <= 1) return paddingLeft + plotWidth / 2
    return paddingLeft + (index / (count - 1)) * plotWidth
  }

  const candleWidth = Math.max(2.5, Math.min(12, (plotWidth / count) * 0.65))

  // Generate SMA paths
  const sma20Path = useMemo(() => {
    if (!showSMA) return ''
    let p = ''
    data.forEach((d, i) => {
      if (d.sma20 !== null && d.sma20 !== undefined) {
        const x = scaleX(i)
        const y = scaleY(d.sma20)
        p += p === '' ? `M ${x} ${y}` : ` L ${x} ${y}`
      }
    })
    return p
  }, [data, showSMA, minPrice, maxPrice])

  const sma50Path = useMemo(() => {
    if (!showSMA) return ''
    let p = ''
    data.forEach((d, i) => {
      if (d.sma50 !== null && d.sma50 !== undefined) {
        const x = scaleX(i)
        const y = scaleY(d.sma50)
        p += p === '' ? `M ${x} ${y}` : ` L ${x} ${y}`
      }
    })
    return p
  }, [data, showSMA, minPrice, maxPrice])

  // Horizontal price grid lines (4 steps)
  const priceGrid = useMemo(() => {
    const steps = 4
    const res = []
    for (let i = 0; i <= steps; i++) {
      const val = minPrice + ((maxPrice - minPrice) / steps) * i
      res.push({
        val,
        y: scaleY(val),
      })
    }
    return res
  }, [minPrice, maxPrice])

  // Mouse move handler for interactive crosshair
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const mouseXRatio = (e.clientX - rect.left) / rect.width
    const svgX = mouseXRatio * svgWidth

    // Find closest candle index
    const clampedSvgX = Math.max(paddingLeft, Math.min(paddingLeft + plotWidth, svgX))
    const index = Math.round(((clampedSvgX - paddingLeft) / plotWidth) * (count - 1))
    const point = data[index]
    if (point) {
      setHoveredPoint(point)
      setMousePos({ x: scaleX(index), y: scaleY(point.close) })
    }
  }

  const handleMouseLeave = () => {
    setHoveredPoint(null)
    setMousePos(null)
  }

  const activePoint = hoveredPoint || data[data.length - 1]
  const isUp = activePoint ? activePoint.close >= activePoint.open : true
  const changeVal = activePoint ? activePoint.close - activePoint.open : 0
  const changePct = activePoint && activePoint.open > 0 ? (changeVal / activePoint.open) * 100 : 0

  return (
    <div className="w-full flex flex-col space-y-2 select-none">
      {/* Dynamic OHLC Bar on Hover */}
      <div className="flex flex-wrap items-center justify-between text-[11px] font-mono px-1 gap-2 text-slate-400 bg-slate-900/60 p-2 rounded-xl border border-white/[0.04]">
        <div className="flex items-center gap-3">
          <span className="text-slate-300 font-medium">{activePoint?.time}</span>
          <span>
            O: <strong className="text-white">{currencySymbol}{activePoint?.open.toFixed(2)}</strong>
          </span>
          <span>
            H: <strong className="text-emerald-400">{currencySymbol}{activePoint?.high.toFixed(2)}</strong>
          </span>
          <span>
            L: <strong className="text-rose-400">{currencySymbol}{activePoint?.low.toFixed(2)}</strong>
          </span>
          <span>
            C: <strong className={isUp ? 'text-emerald-400' : 'text-rose-400'}>{currencySymbol}{activePoint?.close.toFixed(2)}</strong>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`font-bold ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
            {isUp ? '+' : ''}{changeVal.toFixed(2)} ({isUp ? '+' : ''}{changePct.toFixed(2)}%)
          </span>
          {activePoint?.volume ? (
            <span className="text-slate-500 hidden sm:inline">
              Vol: {Number(activePoint.volume).toLocaleString()}
            </span>
          ) : null}
        </div>
      </div>

      {/* SVG Candlestick Viewport */}
      <div className="relative w-full overflow-hidden rounded-xl bg-[#0E121A] border border-white/[0.04]">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto cursor-crosshair block"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          {/* Background Grid Lines */}
          {priceGrid.map((g, idx) => (
            <g key={idx}>
              <line
                x1={paddingLeft}
                y1={g.y}
                x2={paddingLeft + plotWidth}
                y2={g.y}
                stroke="#1E293B"
                strokeDasharray="3 3"
                strokeWidth={1}
              />
              <text
                x={paddingLeft + plotWidth + 6}
                y={g.y + 3}
                fill="#64748B"
                fontSize={9}
                fontFamily="monospace"
              >
                {currencySymbol}{g.val.toFixed(2)}
              </text>
            </g>
          ))}

          {/* Technical Levels: Support & Resistance Reference Lines */}
          {showSR && technicalLevels && (
            <g>
              {/* Resistance 2 (R2) */}
              <line
                x1={paddingLeft}
                y1={scaleY(technicalLevels.r2)}
                x2={paddingLeft + plotWidth}
                y2={scaleY(technicalLevels.r2)}
                stroke="#F43F5E"
                strokeDasharray="4 4"
                strokeWidth={1.2}
              />
              <text
                x={paddingLeft + plotWidth + 6}
                y={scaleY(technicalLevels.r2) + 3}
                fill="#F43F5E"
                fontSize={9}
                fontFamily="monospace"
                fontWeight="bold"
              >
                R2: {currencySymbol}{technicalLevels.r2.toFixed(1)}
              </text>

              {/* Resistance 1 (R1) */}
              <line
                x1={paddingLeft}
                y1={scaleY(technicalLevels.r1)}
                x2={paddingLeft + plotWidth}
                y2={scaleY(technicalLevels.r1)}
                stroke="#FB7185"
                strokeDasharray="3 3"
                strokeWidth={1.2}
              />
              <text
                x={paddingLeft + plotWidth + 6}
                y={scaleY(technicalLevels.r1) + 3}
                fill="#FB7185"
                fontSize={9}
                fontFamily="monospace"
              >
                R1: {currencySymbol}{technicalLevels.r1.toFixed(1)}
              </text>

              {/* Pivot Point (P) */}
              <line
                x1={paddingLeft}
                y1={scaleY(technicalLevels.pivot)}
                x2={paddingLeft + plotWidth}
                y2={scaleY(technicalLevels.pivot)}
                stroke="#94A3B8"
                strokeDasharray="2 2"
                strokeWidth={1}
              />
              <text
                x={paddingLeft + plotWidth + 6}
                y={scaleY(technicalLevels.pivot) + 3}
                fill="#94A3B8"
                fontSize={8.5}
                fontFamily="monospace"
              >
                P: {currencySymbol}{technicalLevels.pivot.toFixed(1)}
              </text>

              {/* Support 1 (S1) */}
              <line
                x1={paddingLeft}
                y1={scaleY(technicalLevels.s1)}
                x2={paddingLeft + plotWidth}
                y2={scaleY(technicalLevels.s1)}
                stroke="#34D399"
                strokeDasharray="3 3"
                strokeWidth={1.2}
              />
              <text
                x={paddingLeft + plotWidth + 6}
                y={scaleY(technicalLevels.s1) + 3}
                fill="#34D399"
                fontSize={9}
                fontFamily="monospace"
              >
                S1: {currencySymbol}{technicalLevels.s1.toFixed(1)}
              </text>

              {/* Support 2 (S2) */}
              <line
                x1={paddingLeft}
                y1={scaleY(technicalLevels.s2)}
                x2={paddingLeft + plotWidth}
                y2={scaleY(technicalLevels.s2)}
                stroke="#10B981"
                strokeDasharray="4 4"
                strokeWidth={1.2}
              />
              <text
                x={paddingLeft + plotWidth + 6}
                y={scaleY(technicalLevels.s2) + 3}
                fill="#10B981"
                fontSize={9}
                fontFamily="monospace"
                fontWeight="bold"
              >
                S2: {currencySymbol}{technicalLevels.s2.toFixed(1)}
              </text>
            </g>
          )}

          {/* Moving Average SMA Lines */}
          {showSMA && sma20Path && (
            <path d={sma20Path} fill="none" stroke="#F59E0B" strokeWidth={1.6} opacity={0.9} />
          )}
          {showSMA && sma50Path && (
            <path d={sma50Path} fill="none" stroke="#06B6D4" strokeWidth={1.6} opacity={0.9} />
          )}

          {/* Candlestick Glyphs */}
          {data.map((d, i) => {
            const x = scaleX(i)
            const yHigh = scaleY(d.high)
            const yLow = scaleY(d.low)
            const yOpen = scaleY(d.open)
            const yClose = scaleY(d.close)
            const candleUp = d.close >= d.open
            const color = candleUp ? '#10B981' : '#F43F5E'
            const bodyTop = Math.min(yOpen, yClose)
            const bodyHeight = Math.max(1.5, Math.abs(yClose - yOpen))

            return (
              <g key={d.timestamp || i}>
                {/* Wick */}
                <line
                  x1={x}
                  y1={yHigh}
                  x2={x}
                  y2={yLow}
                  stroke={color}
                  strokeWidth={1}
                />
                {/* Body */}
                <rect
                  x={x - candleWidth / 2}
                  y={bodyTop}
                  width={candleWidth}
                  height={bodyHeight}
                  fill={color}
                  rx={0.5}
                />
              </g>
            )
          })}

          {/* Crosshair Cursor on Mouse Move */}
          {mousePos && (
            <g>
              <line
                x1={mousePos.x}
                y1={paddingTop}
                x2={mousePos.x}
                y2={paddingTop + plotHeight}
                stroke="#94A3B8"
                strokeDasharray="2 2"
                strokeWidth={0.8}
                opacity={0.7}
              />
              <line
                x1={paddingLeft}
                y1={mousePos.y}
                x2={paddingLeft + plotWidth}
                y2={mousePos.y}
                stroke="#94A3B8"
                strokeDasharray="2 2"
                strokeWidth={0.8}
                opacity={0.7}
              />
              <circle
                cx={mousePos.x}
                cy={mousePos.y}
                r={3.5}
                fill={isUp ? '#10B981' : '#F43F5E'}
                stroke="#FFFFFF"
                strokeWidth={1.5}
              />
            </g>
          )}
        </svg>
      </div>
    </div>
  )
}
