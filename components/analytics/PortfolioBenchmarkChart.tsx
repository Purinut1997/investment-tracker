'use client'

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import {
  ChartMode,
  DailyAnalyticsPoint,
  ReturnMethod,
  WindowSeriesPoint,
} from '@/lib/analytics/portfolio-analytics-math'

interface PortfolioBenchmarkChartProps {
  series: DailyAnalyticsPoint[]
  windowPoints: WindowSeriesPoint[]
  startIdx: number
  endIdx: number
  onRangeChange?: (startIdx: number, endIdx: number) => void
  chartMode: ChartMode
  returnMethod: ReturnMethod
  benchmarkLabel: string
  baseCurrency?: string
  hideAmounts?: boolean
  showPortfolio?: boolean
  showBenchmark?: boolean
  showCashDeposits?: boolean
  showNavigator?: boolean
  height?: number
}

const MONTH_SHORT_EN = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

function formatAxisDate(dateStr: string): string {
  if (!dateStr || dateStr.length < 7) return dateStr
  const yr = dateStr.slice(0, 4)
  const mo = Number(dateStr.slice(5, 7))
  if (mo >= 1 && mo <= 12) {
    return `${MONTH_SHORT_EN[mo - 1]} ${yr}`
  }
  return dateStr
}

function formatFullDate(dateStr: string): string {
  if (!dateStr || dateStr.length < 10) return dateStr
  const yr = dateStr.slice(0, 4)
  const mo = Number(dateStr.slice(5, 7))
  const day = Number(dateStr.slice(8, 10))
  if (mo >= 1 && mo <= 12) {
    return `${day} ${MONTH_SHORT_EN[mo - 1]} ${yr}`
  }
  return dateStr
}

function formatCompactMoney(val: number, symbol: string, hideAmounts?: boolean): string {
  if (hideAmounts) return `${symbol}•••`
  const abs = Math.abs(val)
  const sign = val < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}${symbol}${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `${sign}${symbol}${(abs / 1_000).toFixed(0)}k`
  return `${sign}${symbol}${abs.toFixed(0)}`
}

function formatExactMoney(val: number, symbol: string, hideAmounts?: boolean, signed = false): string {
  if (hideAmounts) return `${symbol}••••••`
  const sign = val < 0 ? '-' : signed && val > 0 ? '+' : ''
  const abs = Math.abs(val)
  return `${sign}${symbol}${abs.toLocaleString('en-US', {
    minimumFractionDigits: abs >= 1000 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`
}

function buildPolylinePath(coords: Array<{ x: number; y: number }>): string {
  if (coords.length === 0) return ''
  let d = `M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)}`
  for (let i = 1; i < coords.length; i++) {
    d += ` L ${coords[i].x.toFixed(1)} ${coords[i].y.toFixed(1)}`
  }
  return d
}

export function PortfolioBenchmarkChart({
  series,
  windowPoints,
  startIdx,
  endIdx,
  onRangeChange,
  chartMode,
  returnMethod,
  benchmarkLabel,
  baseCurrency = 'THB',
  hideAmounts = false,
  showPortfolio = true,
  showBenchmark = true,
  showCashDeposits = true,
  showNavigator = true,
  height = 320,
}: PortfolioBenchmarkChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const navRef = useRef<SVGSVGElement>(null)
  const [width, setWidth] = useState(760)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const [dragState, setDragState] = useState<{
    mode: 'left' | 'right' | 'pan'
    startClientX: number
    origStart: number
    origEnd: number
  } | null>(null)

  const sym = baseCurrency.toUpperCase() === 'USD' ? '$' : '฿'

  // Observe container pixel width cleanly for zero-blur crisp SVG lines
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const updateWidth = () => {
      const rect = el.getBoundingClientRect()
      if (rect.width > 80) {
        setWidth(Math.round(rect.width))
      }
    }
    updateWidth()
    if (typeof ResizeObserver !== 'undefined') {
      const obs = new ResizeObserver(() => updateWidth())
      obs.observe(el)
      return () => obs.disconnect()
    }
    window.addEventListener('resize', updateWidth)
    return () => window.removeEventListener('resize', updateWidth)
  }, [])

  const padLeft = 10
  const padRight = width < 520 ? 52 : 66
  const padTop = 16
  const padBottom = 26
  const plotW = Math.max(100, width - padLeft - padRight)
  const plotH = Math.max(120, height - padTop - padBottom)

  const getPortVal = useCallback(
    (p: WindowSeriesPoint) => {
      if (chartMode === 'value') return p.portfolioValue
      if (chartMode === 'return') return p.portfolioReturnPct
      if (chartMode === 'gain') return p.portfolioGain
      if (chartMode === 'cash') return p.cashDeposits
      return p.portfolioDrawdownPct
    },
    [chartMode]
  )

  const getBenchVal = useCallback(
    (p: WindowSeriesPoint) => {
      if (chartMode === 'value') return p.benchmarkValue
      if (chartMode === 'return') return p.benchmarkReturnPct
      if (chartMode === 'gain') return p.benchmarkGain
      if (chartMode === 'drawdown') return p.benchmarkDrawdownPct
      return p.cashDeposits
    },
    [chartMode]
  )

  // Compute Y domain across active visible series
  const { yMin, yMax, yTicks } = useMemo(() => {
    if (windowPoints.length === 0) {
      return { yMin: 0, yMax: 100, yTicks: [0, 25, 50, 75, 100] }
    }

    let minV = Infinity
    let maxV = -Infinity

    for (const p of windowPoints) {
      if (showPortfolio) {
        const pv = getPortVal(p)
        if (pv < minV) minV = pv
        if (pv > maxV) maxV = pv
      }
      if (showBenchmark && chartMode !== 'cash') {
        const bv = getBenchVal(p)
        if (bv < minV) minV = bv
        if (bv > maxV) maxV = bv
      }
      if (showCashDeposits && chartMode === 'value') {
        if (p.cashDeposits < minV) minV = p.cashDeposits
        if (p.cashDeposits > maxV) maxV = p.cashDeposits
      }
    }

    if (!Number.isFinite(minV) || !Number.isFinite(maxV)) {
      minV = 0
      maxV = 100
    }

    // Anchor 0 baseline inside return, gain, drawdown, and cash modes
    if (chartMode === 'return' || chartMode === 'gain') {
      minV = Math.min(minV, 0)
      maxV = Math.max(maxV, 0)
    } else if (chartMode === 'drawdown') {
      maxV = 0
      minV = Math.min(minV, -2)
    } else if (chartMode === 'cash' || chartMode === 'value') {
      minV = Math.min(minV, 0)
    }

    const span = maxV - minV
    const pad = span > 0.0001 ? span * 0.1 : chartMode === 'return' ? 5 : 1000
    const adjMin = chartMode === 'drawdown' ? minV - pad * 0.8 : chartMode === 'value' || chartMode === 'cash' ? Math.max(0, minV - pad * 0.15) : minV - pad
    const adjMax = chartMode === 'drawdown' ? 0 : maxV + pad

    const steps = 4
    const ticks: number[] = []
    for (let i = 0; i <= steps; i++) {
      ticks.push(adjMin + ((adjMax - adjMin) / steps) * i)
    }

    return { yMin: adjMin, yMax: adjMax, yTicks: ticks }
  }, [windowPoints, showPortfolio, showBenchmark, showCashDeposits, chartMode, getPortVal, getBenchVal])

  const scaleX = useCallback(
    (idx: number) => {
      if (windowPoints.length <= 1) return padLeft + plotW / 2
      return padLeft + (idx / (windowPoints.length - 1)) * plotW
    },
    [windowPoints.length, padLeft, plotW]
  )

  const scaleY = useCallback(
    (val: number) => {
      if (yMax <= yMin) return padTop + plotH / 2
      const ratio = (val - yMin) / (yMax - yMin)
      return padTop + plotH - ratio * plotH
    },
    [yMin, yMax, padTop, plotH]
  )

  const zeroY = useMemo(() => {
    if (0 < yMin || 0 > yMax) return null
    return scaleY(0)
  }, [yMin, yMax, scaleY])

  // Build paths for Portfolio, Benchmark, Cash Deposits, and Shaded Area
  const {
    portPath,
    benchPath,
    cashPath,
    cashAreaPath,
    drawdownAreaPath,
    xTicks,
    flowBars,
  } = useMemo(() => {
    const n = windowPoints.length
    if (n === 0) {
      return {
        portPath: '',
        benchPath: '',
        cashPath: '',
        cashAreaPath: '',
        drawdownAreaPath: '',
        xTicks: [] as Array<{ idx: number; x: number; label: string }>,
        flowBars: [] as Array<{ x: number; y: number; h: number; positive: boolean }>,
      }
    }

    const pCoords: Array<{ x: number; y: number }> = []
    const bCoords: Array<{ x: number; y: number }> = []
    const cCoords: Array<{ x: number; y: number }> = []

    let maxAbsFlow = 1
    if (chartMode === 'cash') {
      for (const p of windowPoints) {
        const a = Math.abs(p.netCashFlow)
        if (a > maxAbsFlow) maxAbsFlow = a
      }
    }

    const bars: Array<{ x: number; y: number; h: number; positive: boolean }> = []
    const barMaxH = plotH * 0.24
    const baseBottomY = padTop + plotH

    for (let i = 0; i < n; i++) {
      const pt = windowPoints[i]
      const x = scaleX(i)
      pCoords.push({ x, y: scaleY(getPortVal(pt)) })
      bCoords.push({ x, y: scaleY(getBenchVal(pt)) })
      cCoords.push({ x, y: scaleY(pt.cashDeposits) })

      if (chartMode === 'cash' && Math.abs(pt.netCashFlow) > 1) {
        const bh = Math.max(2, (Math.abs(pt.netCashFlow) / maxAbsFlow) * barMaxH)
        bars.push({
          x,
          y: baseBottomY - bh,
          h: bh,
          positive: pt.netCashFlow >= 0,
        })
      }
    }

    const pPath = buildPolylinePath(pCoords)
    const bPath = buildPolylinePath(bCoords)
    const cPath = buildPolylinePath(cCoords)

    const cashArea =
      cCoords.length > 1
        ? `${cPath} L ${cCoords[cCoords.length - 1].x.toFixed(1)} ${baseBottomY.toFixed(1)} L ${cCoords[0].x.toFixed(1)} ${baseBottomY.toFixed(1)} Z`
        : ''

    const ddArea =
      pCoords.length > 1
        ? `${pPath} L ${pCoords[pCoords.length - 1].x.toFixed(1)} ${padTop.toFixed(1)} L ${pCoords[0].x.toFixed(1)} ${padTop.toFixed(1)} Z`
        : ''

    // Select 5-8 evenly spaced non-overlapping X ticks
    const desiredTicks = width < 480 ? 4 : width < 760 ? 6 : 8
    const tickStep = Math.max(1, Math.floor((n - 1) / Math.max(1, desiredTicks - 1)))
    const ticks: Array<{ idx: number; x: number; label: string }> = []
    let lastLabel = ''
    for (let i = 0; i < n; i += tickStep) {
      const lbl = formatAxisDate(windowPoints[i].date)
      if (lbl !== lastLabel || ticks.length === 0) {
        ticks.push({ idx: i, x: scaleX(i), label: lbl })
        lastLabel = lbl
      }
    }

    return {
      portPath: pPath,
      benchPath: bPath,
      cashPath: cPath,
      cashAreaPath: cashArea,
      drawdownAreaPath: ddArea,
      xTicks: ticks,
      flowBars: bars,
    }
  }, [windowPoints, chartMode, width, plotH, padTop, scaleX, scaleY, getPortVal, getBenchVal])

  // Hover interaction on main chart
  const handleChartPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (windowPoints.length === 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    const relX = e.clientX - rect.left
    const clampedRatio = Math.min(1, Math.max(0, (relX - padLeft) / plotW))
    const idx = Math.round(clampedRatio * Math.max(0, windowPoints.length - 1))
    setHoverIdx(idx)
  }

  // Range Navigator mini-map paths & pointer handlers
  const navHeight = 52
  const navPlotW = Math.max(100, width - padLeft - padRight)
  const navPadY = 7
  const navPlotH = navHeight - navPadY * 2

  const { navLinePath, navAreaPath, navTicks } = useMemo(() => {
    if (!showNavigator || series.length < 2) {
      return { navLinePath: '', navAreaPath: '', navTicks: [] as Array<{ x: number; label: string }> }
    }
    let minV = Infinity
    let maxV = -Infinity
    for (const p of series) {
      if (p.portfolioValue < minV) minV = p.portfolioValue
      if (p.portfolioValue > maxV) maxV = p.portfolioValue
    }
    if (!Number.isFinite(minV) || maxV <= minV) {
      minV = 0
      maxV = Math.max(100, minV + 100)
    }
    const coords = series.map((p, idx) => {
      const x = padLeft + (idx / (series.length - 1)) * navPlotW
      const y = navPadY + navPlotH - ((p.portfolioValue - minV) / (maxV - minV)) * navPlotH
      return { x, y }
    })
    const line = buildPolylinePath(coords)
    const area = `${line} L ${coords[coords.length - 1].x.toFixed(1)} ${(navPadY + navPlotH).toFixed(1)} L ${coords[0].x.toFixed(1)} ${(navPadY + navPlotH).toFixed(1)} Z`

    const desired = width < 520 ? 4 : 6
    const step = Math.max(1, Math.floor((series.length - 1) / Math.max(1, desired - 1)))
    const ticks: Array<{ x: number; label: string }> = []
    let prevLbl = ''
    for (let i = 0; i < series.length; i += step) {
      const lbl = formatAxisDate(series[i].date)
      if (lbl !== prevLbl) {
        ticks.push({ x: padLeft + (i / (series.length - 1)) * navPlotW, label: lbl })
        prevLbl = lbl
      }
    }
    return { navLinePath: line, navAreaPath: area, navTicks: ticks }
  }, [series, showNavigator, navPlotW, navPlotH, padLeft, width])

  const maxSeriesIdx = Math.max(0, series.length - 1)
  const navStartX = maxSeriesIdx > 0 ? padLeft + (startIdx / maxSeriesIdx) * navPlotW : padLeft
  const navEndX = maxSeriesIdx > 0 ? padLeft + (endIdx / maxSeriesIdx) * navPlotW : padLeft + navPlotW

  const handleNavPointerDown = (mode: 'left' | 'right' | 'pan', e: React.PointerEvent) => {
    if (!onRangeChange || maxSeriesIdx < 2) return
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragState({
      mode,
      startClientX: e.clientX,
      origStart: startIdx,
      origEnd: endIdx,
    })
  }

  const handleNavPointerMove = (e: React.PointerEvent) => {
    if (!dragState || !onRangeChange || maxSeriesIdx < 2) return
    const dx = e.clientX - dragState.startClientX
    const idxDelta = Math.round((dx / navPlotW) * maxSeriesIdx)
    const minSpan = Math.min(2, maxSeriesIdx)

    if (dragState.mode === 'left') {
      const nextStart = Math.max(0, Math.min(dragState.origEnd - minSpan, dragState.origStart + idxDelta))
      onRangeChange(nextStart, dragState.origEnd)
    } else if (dragState.mode === 'right') {
      const nextEnd = Math.min(maxSeriesIdx, Math.max(dragState.origStart + minSpan, dragState.origEnd + idxDelta))
      onRangeChange(dragState.origStart, nextEnd)
    } else {
      const span = dragState.origEnd - dragState.origStart
      let nextStart = dragState.origStart + idxDelta
      let nextEnd = nextStart + span
      if (nextStart < 0) {
        nextStart = 0
        nextEnd = span
      }
      if (nextEnd > maxSeriesIdx) {
        nextEnd = maxSeriesIdx
        nextStart = maxSeriesIdx - span
      }
      onRangeChange(Math.max(0, nextStart), Math.min(maxSeriesIdx, nextEnd))
    }
  }

  const handleNavPointerUp = (e: React.PointerEvent) => {
    if (dragState) {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId)
      }
      setDragState(null)
    }
  }

  const activeHoverPt =
    hoverIdx !== null && windowPoints[hoverIdx] ? windowPoints[hoverIdx] : null
  const activeHoverX = hoverIdx !== null ? scaleX(hoverIdx) : null
  const activeHoverPortY = activeHoverPt ? scaleY(getPortVal(activeHoverPt)) : null
  const activeHoverBenchY = activeHoverPt ? scaleY(getBenchVal(activeHoverPt)) : null

  const formatYLabel = (v: number) => {
    if (chartMode === 'return' || chartMode === 'drawdown') {
      return `${v >= 0 && chartMode === 'return' && v > 0 ? '+' : ''}${v.toFixed(1)}%`
    }
    return formatCompactMoney(v, sym, hideAmounts)
  }

  return (
    <div ref={containerRef} className="w-full select-none space-y-2">
      {/* Main Interactive SVG Chart */}
      <div className="relative w-full rounded-xl bg-[#0B0E15] border border-white/[0.06] overflow-hidden">
        <svg
          width={width}
          height={height}
          className="block w-full touch-none cursor-crosshair"
          onPointerMove={handleChartPointerMove}
          onPointerLeave={() => setHoverIdx(null)}
        >
          <defs>
            <linearGradient id="cashAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#94A3B8" stopOpacity="0.16" />
              <stop offset="100%" stopColor="#94A3B8" stopOpacity="0.03" />
            </linearGradient>
            <linearGradient id="ddAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F05D73" stopOpacity="0.04" />
              <stop offset="100%" stopColor="#F05D73" stopOpacity="0.22" />
            </linearGradient>
          </defs>

          {/* Horizontal Grid Lines + Right Y-Axis */}
          {yTicks.map((tickVal, idx) => {
            const y = scaleY(tickVal)
            return (
              <g key={idx}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={padLeft + plotW}
                  y2={y}
                  stroke="rgba(255,255,255,0.05)"
                  strokeWidth={1}
                />
                <text
                  x={padLeft + plotW + 8}
                  y={y + 3.5}
                  fill="#64748B"
                  fontSize={10}
                  fontFamily="ui-monospace, SFMono-Regular, monospace"
                >
                  {formatYLabel(tickVal)}
                </text>
              </g>
            )
          })}

          {/* Shaded Under-Zero Zone matching reference screenshot for Return / Gain */}
          {(chartMode === 'return' || chartMode === 'gain') && zeroY !== null && (
            <rect
              x={padLeft}
              y={zeroY}
              width={plotW}
              height={Math.max(0, padTop + plotH - zeroY)}
              fill="rgba(148, 163, 184, 0.08)"
            />
          )}

          {/* Value Mode: Translucent Cash Deposits Area */}
          {chartMode === 'value' && showCashDeposits && cashAreaPath && (
            <>
              <path d={cashAreaPath} fill="url(#cashAreaGrad)" />
              <path
                d={cashPath}
                fill="none"
                stroke="#64748B"
                strokeWidth={1.25}
                strokeDasharray="3 3"
              />
            </>
          )}

          {/* Cash Mode: Cumulative Deposits Area + Daily Flow Bars */}
          {chartMode === 'cash' && (
            <>
              {cashAreaPath && <path d={cashAreaPath} fill="url(#cashAreaGrad)" />}
              {cashPath && (
                <path d={cashPath} fill="none" stroke="#F8FAFC" strokeWidth={2} />
              )}
              {flowBars.map((b, i) => (
                <rect
                  key={i}
                  x={b.x - 1.5}
                  y={b.y}
                  width={3}
                  height={b.h}
                  rx={1}
                  fill={b.positive ? '#20C997' : '#F05D73'}
                  opacity={0.85}
                />
              ))}
            </>
          )}

          {/* Drawdown Underwater Fill */}
          {chartMode === 'drawdown' && showPortfolio && drawdownAreaPath && (
            <path d={drawdownAreaPath} fill="url(#ddAreaGrad)" />
          )}

          {/* Zero Baseline */}
          {zeroY !== null && (
            <line
              x1={padLeft}
              y1={zeroY}
              x2={padLeft + plotW}
              y2={zeroY}
              stroke="rgba(255,255,255,0.22)"
              strokeWidth={1}
            />
          )}

          {/* Benchmark Curve (Silver-Slate Line) */}
          {chartMode !== 'cash' && showBenchmark && benchPath && (
            <path
              d={benchPath}
              fill="none"
              stroke="#848E9F"
              strokeWidth={1.6}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}

          {/* Portfolio Curve (Crisp White Anchor Line) */}
          {chartMode !== 'cash' && showPortfolio && portPath && (
            <path
              d={portPath}
              fill="none"
              stroke="#F8FAFC"
              strokeWidth={2.1}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}

          {/* X-Axis Date Labels */}
          {xTicks.map((t) => (
            <text
              key={t.idx}
              x={t.x}
              y={height - 8}
              textAnchor={t.idx === 0 ? 'start' : 'middle'}
              fill="#64748B"
              fontSize={10.5}
              fontFamily="ui-sans-serif, system-ui, sans-serif"
            >
              {t.label}
            </text>
          ))}

          {/* Interactive Crosshair */}
          {activeHoverPt && activeHoverX !== null && (
            <g pointerEvents="none">
              <line
                x1={activeHoverX}
                y1={padTop}
                x2={activeHoverX}
                y2={padTop + plotH}
                stroke="rgba(255,255,255,0.28)"
                strokeDasharray="3 3"
                strokeWidth={1}
              />
              {chartMode !== 'cash' && showBenchmark && activeHoverBenchY !== null && (
                <circle
                  cx={activeHoverX}
                  cy={activeHoverBenchY}
                  r={3.5}
                  fill="#848E9F"
                  stroke="#0B0E15"
                  strokeWidth={1.5}
                />
              )}
              {showPortfolio && activeHoverPortY !== null && (
                <circle
                  cx={activeHoverX}
                  cy={activeHoverPortY}
                  r={4.5}
                  fill="#F8FAFC"
                  stroke="#6D5EF7"
                  strokeWidth={2}
                />
              )}
            </g>
          )}
        </svg>

        {/* Smart Auto-Flipped Floating Tooltip */}
        {activeHoverPt && activeHoverX !== null && (
          <div
            className="pointer-events-none absolute top-3 z-20 w-56 rounded-xl bg-[#12151C]/95 backdrop-blur-md border border-white/[0.12] p-3 shadow-2xl text-xs space-y-1.5"
            style={{
              left:
                activeHoverX > width * 0.58
                  ? Math.max(8, activeHoverX - 236)
                  : Math.min(width - 232, activeHoverX + 14),
            }}
          >
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-1.5">
              <span className="font-semibold text-slate-200">{formatFullDate(activeHoverPt.date)}</span>
              <span className="text-[10px] font-mono text-slate-400">
                FX {activeHoverPt.usdThbRate.toFixed(2)}
              </span>
            </div>

            {showPortfolio && (
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-slate-300">
                  <span className="w-2.5 h-0.5 bg-white rounded-full" />
                  <span>พอร์ตของฉัน</span>
                </span>
                <span className="font-mono font-bold text-white tabular-nums">
                  {chartMode === 'return'
                    ? `${activeHoverPt.portfolioReturnPct >= 0 ? '+' : ''}${activeHoverPt.portfolioReturnPct.toFixed(2)}%`
                    : chartMode === 'drawdown'
                    ? `${activeHoverPt.portfolioDrawdownPct.toFixed(2)}%`
                    : chartMode === 'gain'
                    ? formatExactMoney(activeHoverPt.portfolioGain, sym, hideAmounts, true)
                    : formatExactMoney(activeHoverPt.portfolioValue, sym, hideAmounts)}
                </span>
              </div>
            )}

            {chartMode !== 'cash' && showBenchmark && (
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-slate-400">
                  <span className="w-2.5 h-0.5 bg-[#848E9F] rounded-full" />
                  <span>{benchmarkLabel}</span>
                </span>
                <span className="font-mono font-semibold text-slate-300 tabular-nums">
                  {chartMode === 'return'
                    ? `${activeHoverPt.benchmarkReturnPct >= 0 ? '+' : ''}${activeHoverPt.benchmarkReturnPct.toFixed(2)}%`
                    : chartMode === 'drawdown'
                    ? `${activeHoverPt.benchmarkDrawdownPct.toFixed(2)}%`
                    : chartMode === 'gain'
                    ? formatExactMoney(activeHoverPt.benchmarkGain, sym, hideAmounts, true)
                    : formatExactMoney(activeHoverPt.benchmarkValue, sym, hideAmounts)}
                </span>
              </div>
            )}

            {showCashDeposits && (
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-slate-400">
                  <span className="w-2 h-2 bg-slate-500/70 rounded-xs" />
                  <span>เงินลงทุนสะสม</span>
                </span>
                <span className="font-mono text-slate-300 tabular-nums">
                  {formatExactMoney(activeHoverPt.cashDeposits, sym, hideAmounts)}
                </span>
              </div>
            )}

            <div className="pt-1 border-t border-white/[0.06] flex items-center justify-between text-[11px]">
              <span className="text-slate-400">
                {chartMode === 'return'
                  ? `Alpha (${returnMethod})`
                  : chartMode === 'drawdown'
                  ? 'เปลี่ยนรายวัน'
                  : 'กำไร/ขาดทุนรวม'}
              </span>
              {chartMode === 'return' ? (
                <span
                  className={`font-mono font-bold tabular-nums ${
                    activeHoverPt.portfolioReturnPct - activeHoverPt.benchmarkReturnPct >= 0
                      ? 'text-[#20C997]'
                      : 'text-[#F05D73]'
                  }`}
                >
                  {activeHoverPt.portfolioReturnPct - activeHoverPt.benchmarkReturnPct >= 0 ? '+' : ''}
                  {(activeHoverPt.portfolioReturnPct - activeHoverPt.benchmarkReturnPct).toFixed(2)}%
                </span>
              ) : chartMode === 'drawdown' ? (
                <span
                  className={`font-mono font-bold tabular-nums ${
                    activeHoverPt.dailyReturnPct >= 0 ? 'text-[#20C997]' : 'text-[#F05D73]'
                  }`}
                >
                  {activeHoverPt.dailyReturnPct >= 0 ? '+' : ''}
                  {activeHoverPt.dailyReturnPct.toFixed(2)}%
                </span>
              ) : (
                <span
                  className={`font-mono font-bold tabular-nums ${
                    activeHoverPt.portfolioGain >= 0 ? 'text-[#20C997]' : 'text-[#F05D73]'
                  }`}
                >
                  {formatExactMoney(activeHoverPt.portfolioGain, sym, hideAmounts, true)} (
                  {activeHoverPt.portfolioReturnPct >= 0 ? '+' : ''}
                  {activeHoverPt.portfolioReturnPct.toFixed(2)}%)
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Interactive Bottom Range Navigator Mini-Map Brush */}
      {showNavigator && series.length > 2 && (
        <div className="w-full rounded-lg bg-[#0D111A] border border-white/[0.07] overflow-hidden">
          <svg
            ref={navRef}
            width={width}
            height={navHeight}
            className="block w-full touch-none"
          >
            {/* Full history sparkline */}
            {navAreaPath && <path d={navAreaPath} fill="rgba(100,116,139,0.14)" />}
            {navLinePath && (
              <path d={navLinePath} fill="none" stroke="#64748B" strokeWidth={1.2} />
            )}

            {/* Left outside dim mask */}
            <rect
              x={padLeft}
              y={0}
              width={Math.max(0, navStartX - padLeft)}
              height={navHeight}
              fill="rgba(5,7,11,0.68)"
            />

            {/* Right outside dim mask */}
            <rect
              x={navEndX}
              y={0}
              width={Math.max(0, padLeft + navPlotW - navEndX)}
              height={navHeight}
              fill="rgba(5,7,11,0.68)"
            />

            {/* Selected active viewport band */}
            <rect
              x={navStartX}
              y={0}
              width={Math.max(8, navEndX - navStartX)}
              height={navHeight}
              fill="rgba(109,94,247,0.16)"
              className="cursor-grab active:cursor-grabbing"
              onPointerDown={(e) => handleNavPointerDown('pan', e)}
              onPointerMove={handleNavPointerMove}
              onPointerUp={handleNavPointerUp}
              onPointerCancel={handleNavPointerUp}
            />

            {/* Top accent bar across active window */}
            <line
              x1={navStartX}
              y1={1}
              x2={navEndX}
              y2={1}
              stroke="#6D5EF7"
              strokeWidth={2}
              pointerEvents="none"
            />

            {/* Date ticks along bottom of navigator */}
            {navTicks.map((t, idx) => (
              <text
                key={idx}
                x={t.x}
                y={navHeight - 5}
                textAnchor={idx === 0 ? 'start' : 'middle'}
                fill="#64748B"
                fontSize={9.5}
                pointerEvents="none"
              >
                {t.label}
              </text>
            ))}

            {/* Left Drag Handle */}
            <g
              className="cursor-ew-resize"
              onPointerDown={(e) => handleNavPointerDown('left', e)}
              onPointerMove={handleNavPointerMove}
              onPointerUp={handleNavPointerUp}
              onPointerCancel={handleNavPointerUp}
            >
              <rect
                x={navStartX - 7}
                y={0}
                width={14}
                height={navHeight}
                fill="transparent"
              />
              <line
                x1={navStartX}
                y1={0}
                x2={navStartX}
                y2={navHeight}
                stroke="#6D5EF7"
                strokeWidth={1.5}
              />
              <rect
                x={navStartX - 4}
                y={navHeight / 2 - 9}
                width={8}
                height={18}
                rx={3}
                fill="#1E2433"
                stroke="#6D5EF7"
                strokeWidth={1.2}
              />
            </g>

            {/* Right Drag Handle */}
            <g
              className="cursor-ew-resize"
              onPointerDown={(e) => handleNavPointerDown('right', e)}
              onPointerMove={handleNavPointerMove}
              onPointerUp={handleNavPointerUp}
              onPointerCancel={handleNavPointerUp}
            >
              <rect
                x={navEndX - 7}
                y={0}
                width={14}
                height={navHeight}
                fill="transparent"
              />
              <line
                x1={navEndX}
                y1={0}
                x2={navEndX}
                y2={navHeight}
                stroke="#6D5EF7"
                strokeWidth={1.5}
              />
              <rect
                x={navEndX - 4}
                y={navHeight / 2 - 9}
                width={8}
                height={18}
                rx={3}
                fill="#1E2433"
                stroke="#6D5EF7"
                strokeWidth={1.2}
              />
            </g>
          </svg>
        </div>
      )}
    </div>
  )
}
