'use client'

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'

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

const MIN_SPAN = 5 // minimum visible candles when zoomed in
const DRAG_THRESHOLD = 4 // px before a pointer move counts as a pan

export function CandlestickChart(props: CandlestickChartProps) {
  const { data } = props

  if (data.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-xs text-slate-500">
        ไม่มีข้อมูลแท่งเทียนสำหรับช่วงเวลานี้
      </div>
    )
  }

  // A changed time range is a fresh viewport, while price updates for the same
  // range keep the investor's current zoom and pan position intact.
  const viewportKey = `${data.length}:${data[0]?.timestamp ?? ''}:${data[data.length - 1]?.timestamp ?? ''}`
  return <CandlestickChartViewport key={viewportKey} {...props} />
}

function CandlestickChartViewport({
  data,
  currencySymbol = '$',
  showSR = true,
  showSMA = true,
  technicalLevels,
  height = 280,
}: CandlestickChartProps) {
  const [hoveredPoint, setHoveredPoint] = useState<CandlePoint | null>(null)
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  // Zoom viewport: visible range in candle-index space [viewStart, viewEnd]
  const [viewStart, setViewStart] = useState(0)
  const [viewEnd, setViewEnd] = useState(() => Math.max(data.length - 1, 0))

  const svgRef = useRef<SVGSVGElement>(null)
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map())
  const panRef = useRef<{ startClientX: number; startViewStart: number; startViewEnd: number; moved: boolean } | null>(null)
  const pinchRef = useRef<{ dist: number; ratio: number } | null>(null)

  const count = data.length
  const maxIndex = Math.max(count - 1, 0)
  const minSpan = Math.min(MIN_SPAN, maxIndex)
  const span = maxIndex === 0 ? 0 : Math.min(Math.max(viewEnd - viewStart, minSpan), maxIndex)
  const safeSpan = Math.max(span, 1)
  const isFullView = maxIndex === 0 || (viewStart <= 0.0001 && viewEnd >= maxIndex - 0.0001)

  const clampView = useCallback(
    (ns: number, ne: number) => {
      if (maxIndex === 0) {
        setViewStart(0)
        setViewEnd(0)
        return
      }
      const newSpan = Math.min(Math.max(ne - ns, minSpan), maxIndex)
      let start = ns
      let end = ns + newSpan
      if (start < 0) {
        start = 0
        end = newSpan
      } else if (end > maxIndex) {
        end = maxIndex
        start = maxIndex - newSpan
      }
      setViewStart(Math.max(0, start))
      setViewEnd(Math.min(maxIndex, end))
    },
    [maxIndex, minSpan]
  )

  const applyZoom = useCallback(
    (anchorRatio: number, factor: number) => {
      if (maxIndex <= minSpan) return
      const anchor = viewStart + anchorRatio * span
      const newSpan = Math.min(Math.max(span * factor, minSpan), maxIndex)
      clampView(anchor - anchorRatio * newSpan, anchor - anchorRatio * newSpan + newSpan)
    },
    [viewStart, span, maxIndex, minSpan, clampView]
  )

  const resetView = useCallback(() => {
    clampView(0, maxIndex)
  }, [maxIndex, clampView])

  // Dimensions & Margins
  const paddingLeft = 10
  const paddingRight = 65
  const paddingTop = 20
  const paddingBottom = 25
  const svgWidth = 800 // base viewBox width
  const svgHeight = height
  const plotWidth = svgWidth - paddingLeft - paddingRight
  const plotHeight = svgHeight - paddingTop - paddingBottom

  // Scalers (viewport-aware)
  const scaleY = (val: number) => {
    if (maxPrice <= minPrice) return paddingTop + plotHeight / 2
    const ratio = (val - minPrice) / (maxPrice - minPrice)
    return paddingTop + plotHeight - ratio * plotHeight
  }

  const scaleX = (index: number) => {
    return paddingLeft + ((index - viewStart) / safeSpan) * plotWidth
  }

  // Y-domain: auto-scale to the candles actually visible.
  // In full view, keep the original behavior of fitting S/R levels too.
  const { minPrice, maxPrice } = useMemo(() => {
    if (data.length === 0) return { minPrice: 0, maxPrice: 100 }
    const i0 = Math.max(0, Math.floor(viewStart))
    const i1 = Math.min(data.length - 1, Math.ceil(viewEnd))
    let min = Infinity
    let max = -Infinity
    for (let i = i0; i <= i1; i++) {
      const d = data[i]
      if (!d) continue
      if (d.low < min) min = d.low
      if (d.high > max) max = d.high
    }
    if (!isFinite(min)) {
      min = 0
      max = 100
    }
    if (isFullView && showSR && technicalLevels) {
      if (technicalLevels.s2 < min) min = technicalLevels.s2
      if (technicalLevels.r2 > max) max = technicalLevels.r2
    }
    const pad = (max - min) * 0.08 || 1
    return { minPrice: Math.max(0, min - pad), maxPrice: max + pad }
  }, [data, viewStart, viewEnd, isFullView, showSR, technicalLevels])

  // Non-passive wheel listener: zoom around cursor X
  useEffect(() => {
    const el = svgRef.current
    if (!el || maxIndex <= minSpan) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const svgX = ((e.clientX - rect.left) / rect.width) * svgWidth
      const ratio = Math.min(1, Math.max(0, (svgX - paddingLeft) / plotWidth))
      applyZoom(ratio, e.deltaY > 0 ? 1.2 : 1 / 1.2)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [applyZoom, maxIndex, minSpan, svgWidth, plotWidth])

  const clientToSvgX = (clientX: number) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return paddingLeft
    return ((clientX - rect.left) / rect.width) * svgWidth
  }

  const indexAtSvgX = (svgX: number) => {
    const ratio = (svgX - paddingLeft) / plotWidth
    return Math.min(Math.max(viewStart + ratio * span, 0), maxIndex)
  }

  const updateHover = (clientX: number) => {
    const index = Math.round(indexAtSvgX(clientToSvgX(clientX)))
    const point = data[index]
    if (point) {
      setHoveredPoint(point)
      setMousePos({ x: scaleX(index), y: scaleY(point.close) })
    }
  }

  // --- Pointer handling: single-pointer pan, two-pointer pinch, hover crosshair ---
  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    const rect = e.currentTarget.getBoundingClientRect()
    pointersRef.current.set(e.pointerId, { x: e.clientX - rect.left, y: e.clientY - rect.top })
    if (pointersRef.current.size === 1) {
      panRef.current = { startClientX: e.clientX, startViewStart: viewStart, startViewEnd: viewEnd, moved: false }
    } else if (pointersRef.current.size === 2) {
      const pts = Array.from(pointersRef.current.values())
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      const midX = (pts[0].x + pts[1].x) / 2
      const ratio = Math.min(1, Math.max(0, (midX / rect.width) * svgWidth - paddingLeft) / plotWidth)
      pinchRef.current = { dist, ratio }
      panRef.current = null
      setIsDragging(true)
    }
  }

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    if (pointersRef.current.has(e.pointerId)) {
      pointersRef.current.set(e.pointerId, { x: e.clientX - rect.left, y: e.clientY - rect.top })
    }

    // Pinch zoom
    if (pinchRef.current && pointersRef.current.size === 2) {
      const pts = Array.from(pointersRef.current.values())
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      if (pinchRef.current.dist > 0 && dist > 0) {
        applyZoom(pinchRef.current.ratio, pinchRef.current.dist / dist)
      }
      pinchRef.current.dist = dist
      return
    }

    // Pan with one pointer
    if (panRef.current && pointersRef.current.size === 1) {
      const pan = panRef.current
      const dx = e.clientX - pan.startClientX
      if (!pan.moved && Math.abs(dx) > DRAG_THRESHOLD) {
        pan.moved = true
        setIsDragging(true)
        setHoveredPoint(null)
        setMousePos(null)
      }
      if (pan.moved) {
        const rectW = rect.width || 1
        const indexShift = (-dx / rectW) * svgWidth * (span / plotWidth)
        clampView(pan.startViewStart + indexShift, pan.startViewEnd + indexShift)
        return
      }
    }

    // Hover crosshair
    if (!isDragging) updateHover(e.clientX)
  }

  const endPointer = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    pointersRef.current.delete(e.pointerId)
    if (pointersRef.current.size < 2) pinchRef.current = null
    if (pointersRef.current.size === 0) {
      panRef.current = null
      setIsDragging(false)
    }
  }

  const candleWidth = Math.max(2.5, Math.min(12, (plotWidth / safeSpan) * 0.65))

  // Only draw candles inside (or near) the visible window
  const firstVisible = Math.max(0, Math.floor(viewStart) - 1)
  const lastVisible = Math.min(count - 1, Math.ceil(viewEnd) + 1)

  // Generate SMA paths
  const sma20Path = useMemo(() => {
    if (!showSMA) return ''
    let p = ''
    for (let i = firstVisible; i <= lastVisible; i++) {
      const d = data[i]
      if (d && d.sma20 !== null && d.sma20 !== undefined) {
        const x = scaleX(i)
        const y = scaleY(d.sma20)
        p += p === '' ? `M ${x} ${y}` : ` L ${x} ${y}`
      }
    }
    return p
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, showSMA, firstVisible, lastVisible, minPrice, maxPrice, viewStart, safeSpan])

  const sma50Path = useMemo(() => {
    if (!showSMA) return ''
    let p = ''
    for (let i = firstVisible; i <= lastVisible; i++) {
      const d = data[i]
      if (d && d.sma50 !== null && d.sma50 !== undefined) {
        const x = scaleX(i)
        const y = scaleY(d.sma50)
        p += p === '' ? `M ${x} ${y}` : ` L ${x} ${y}`
      }
    }
    return p
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, showSMA, firstVisible, lastVisible, minPrice, maxPrice, viewStart, safeSpan])

  // Horizontal price grid lines (4 steps)
  const priceGrid = useMemo(() => {
    const steps = 4
    const res = []
    for (let i = 0; i <= steps; i++) {
      const val = minPrice + ((maxPrice - minPrice) / steps) * i
      res.push({ val, y: scaleY(val) })
    }
    return res
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minPrice, maxPrice])

  // S/R levels are only drawn when they fall inside the visible price range
  const visibleLevels = useMemo(() => {
    if (!showSR || !technicalLevels) return []
    const levels = [
      { key: 'R2', val: technicalLevels.r2, stroke: '#F43F5E', dash: '4 4', bold: true },
      { key: 'R1', val: technicalLevels.r1, stroke: '#FB7185', dash: '3 3', bold: false },
      { key: 'P', val: technicalLevels.pivot, stroke: '#94A3B8', dash: '2 2', bold: false },
      { key: 'S1', val: technicalLevels.s1, stroke: '#34D399', dash: '3 3', bold: false },
      { key: 'S2', val: technicalLevels.s2, stroke: '#10B981', dash: '4 4', bold: true },
    ]
    return levels.filter((l) => l.val > minPrice && l.val < maxPrice)
  }, [showSR, technicalLevels, minPrice, maxPrice])

  const activePoint = hoveredPoint || data[data.length - 1]
  const isUp = activePoint ? activePoint.close >= activePoint.open : true
  const changeVal = activePoint ? activePoint.close - activePoint.open : 0
  const changePct = activePoint && activePoint.open > 0 ? (changeVal / activePoint.open) * 100 : 0

  const zoomBtnClass =
    'w-7 h-7 flex items-center justify-center rounded-lg border border-white/[0.08] bg-slate-900/80 text-slate-400 hover:text-white hover:border-white/20 backdrop-blur transition-all disabled:opacity-40 disabled:pointer-events-none'

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
          ref={svgRef}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className={`w-full h-auto block touch-none ${isDragging ? 'cursor-grabbing' : 'cursor-crosshair'}`}
          aria-label="กราฟแท่งเทียน: ใช้ล้อเมาส์หรือบีบนิ้วเพื่อซูม ลากเพื่อเลื่อน และดับเบิลคลิกเพื่อรีเซ็ต"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endPointer}
          onPointerCancel={endPointer}
          onPointerLeave={() => {
            if (pointersRef.current.size === 0) {
              setHoveredPoint(null)
              setMousePos(null)
            }
          }}
          onDoubleClick={resetView}
        >
          <title>ซูมด้วยล้อเมาส์หรือบีบนิ้ว ลากเพื่อเลื่อน และดับเบิลคลิกเพื่อรีเซ็ต</title>
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
          {visibleLevels.map((l) => (
            <g key={l.key}>
              <line
                x1={paddingLeft}
                y1={scaleY(l.val)}
                x2={paddingLeft + plotWidth}
                y2={scaleY(l.val)}
                stroke={l.stroke}
                strokeDasharray={l.dash}
                strokeWidth={1.2}
              />
              <text
                x={paddingLeft + plotWidth + 6}
                y={scaleY(l.val) + 3}
                fill={l.stroke}
                fontSize={l.key.length < 3 ? 8.5 : 9}
                fontFamily="monospace"
                fontWeight={l.bold ? 'bold' : 'normal'}
              >
                {l.key === 'P' ? `P: ${currencySymbol}${l.val.toFixed(1)}` : `${l.key}: ${currencySymbol}${l.val.toFixed(1)}`}
              </text>
            </g>
          ))}

          {/* Moving Average SMA Lines */}
          {showSMA && sma20Path && (
            <path d={sma20Path} fill="none" stroke="#F59E0B" strokeWidth={1.6} opacity={0.9} />
          )}
          {showSMA && sma50Path && (
            <path d={sma50Path} fill="none" stroke="#06B6D4" strokeWidth={1.6} opacity={0.9} />
          )}

          {/* Candlestick Glyphs (visible window only) */}
          {data.slice(firstVisible, lastVisible + 1).map((d, idx) => {
            const i = firstVisible + idx
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
              {/* Hover price tag on the right axis */}
              <g>
                <rect
                  x={paddingLeft + plotWidth + 2}
                  y={mousePos.y - 8}
                  width={60}
                  height={16}
                  rx={3}
                  fill={isUp ? '#10B981' : '#F43F5E'}
                />
                <text
                  x={paddingLeft + plotWidth + 32}
                  y={mousePos.y + 3}
                  fill="#0E121A"
                  fontSize={9}
                  fontFamily="monospace"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {currencySymbol}{activePoint?.close.toFixed(2)}
                </text>
              </g>
            </g>
          )}
        </svg>

        {/* Zoom Controls */}
        <div className="absolute bottom-2 right-[70px] flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => applyZoom(0.5, 1 / 1.5)}
            disabled={maxIndex <= minSpan}
            className={zoomBtnClass}
            title="ซูมเข้า"
            aria-label="ซูมเข้า"
          >
            <ZoomIn size={13} />
          </button>
          <button
            type="button"
            onClick={() => applyZoom(0.5, 1.5)}
            disabled={maxIndex <= minSpan || isFullView}
            className={zoomBtnClass}
            title="ซูมออก"
            aria-label="ซูมออก"
          >
            <ZoomOut size={13} />
          </button>
          <button
            type="button"
            onClick={resetView}
            disabled={isFullView}
            className={zoomBtnClass}
            title="รีเซ็ตมุมมอง (ดับเบิลคลิกที่กราฟ)"
            aria-label="รีเซ็ตมุมมอง"
          >
            <Maximize2 size={13} />
          </button>
        </div>

        {/* Zoom hint */}
        <div className="absolute bottom-2 left-2.5 text-[10px] text-slate-600 pointer-events-none">
          <span className="sm:hidden">บีบนิ้ว: ซูม • ลาก: เลื่อน</span>
          <span className="hidden sm:inline">ล้อเมาส์: ซูม • ลาก: เลื่อน • ดับเบิลคลิก: รีเซ็ต</span>
        </div>
      </div>
    </div>
  )
}
