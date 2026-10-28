'use client'

import React, { useMemo } from 'react'
import { Compass, Gauge, TrendingUp, ShieldAlert, Sparkles, AlertTriangle } from 'lucide-react'

export interface MarketRegimeData {
  type: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'VOLATILE'
  title: string
  description: string
  color: string
  bg: string
  score?: number
  tierLabel?: string
  drivers?: {
    equityMomentum: number
    vixPrice: number
    btcChange: number
  }
  fearGreed?: {
    score: number
    rating: string
    ratingLabelTh: string
    previousClose: number
    previous1Week?: number
    source: string
  }
  playbook?: {
    donts: string[]
    dos: string[]
  }
}

interface MarketBenchmark {
  symbol: string
  name: string
  price: number
  changePercent: number
  currency: string
  category: string
}

interface MarketRegimeGaugeProps {
  regime?: MarketRegimeData
  benchmarks?: MarketBenchmark[]
  totalCash: number
  totalPortfolioValue: number
  usdThbRate?: number
}

// 5 Gauge Zones: from 0 to 100
// Arc geometry: center (140, 132), radius 100
const GAUGE_ZONES = [
  {
    id: 'EXTREME_FEAR',
    label: 'กลัวจัด',
    sub: 'Risk-Off',
    color: '#f43f5e',
    glow: 'rgba(244, 63, 94, 0.45)',
    fromPct: 0.01,
    toPct: 0.19,
    min: 0,
    max: 25,
  },
  {
    id: 'CAUTION',
    label: 'ระวัง',
    sub: 'Caution',
    color: '#f97316',
    glow: 'rgba(249, 115, 22, 0.45)',
    fromPct: 0.21,
    toPct: 0.39,
    min: 26,
    max: 45,
  },
  {
    id: 'NEUTRAL',
    label: 'สมดุล',
    sub: 'Neutral',
    color: '#eab308',
    glow: 'rgba(234, 179, 8, 0.45)',
    fromPct: 0.41,
    toPct: 0.59,
    min: 46,
    max: 55,
  },
  {
    id: 'BULLISH',
    label: 'เปิดรับเสี่ยง',
    sub: 'Risk-On',
    color: '#10b981',
    glow: 'rgba(16, 185, 129, 0.45)',
    fromPct: 0.61,
    toPct: 0.79,
    min: 56,
    max: 75,
  },
  {
    id: 'GREED',
    label: 'ร้อนแรงจัด',
    sub: 'Overbought',
    color: '#06b6d4',
    glow: 'rgba(6, 182, 212, 0.45)',
    fromPct: 0.81,
    toPct: 0.99,
    min: 76,
    max: 100,
  },
]

// Helper: describe an SVG arc segment
function describeArc(cx: number, cy: number, r: number, startPercent: number, endPercent: number): string {
  const startAngle = Math.PI - startPercent * Math.PI
  const endAngle = Math.PI - endPercent * Math.PI

  const startX = cx + r * Math.cos(startAngle)
  const startY = cy - r * Math.sin(startAngle)
  const endX = cx + r * Math.cos(endAngle)
  const endY = cy - r * Math.sin(endAngle)

  const largeArcFlag = endPercent - startPercent > 0.5 ? 1 : 0
  return `M ${startX.toFixed(1)} ${startY.toFixed(1)} A ${r} ${r} 0 ${largeArcFlag} 1 ${endX.toFixed(1)} ${endY.toFixed(1)}`
}

export function MarketRegimeGauge({
  regime,
  benchmarks = [],
  totalCash,
  totalPortfolioValue,
  usdThbRate = 33.5,
}: MarketRegimeGaugeProps) {
  // Extract or calculate real quantifiable score
  const { score, activeZone, drivers } = useMemo(() => {
    const spxChg = benchmarks.find((b) => b.symbol === 'S&P 500')?.changePercent || 0
    const ndxChg = benchmarks.find((b) => b.symbol === 'NASDAQ')?.changePercent || 0
    const btcChg = benchmarks.find((b) => b.symbol === 'BTC')?.changePercent || 0
    const vixBenchmark = benchmarks.find((b) => b.symbol === 'VIX')
    const vixPrice = vixBenchmark?.price || 17.5
    const avgEquities = (spxChg + ndxChg) / 2

    let calculatedScore = regime?.score

    if (calculatedScore === undefined || calculatedScore === null) {
      // Fallback calculation:
      // 1. Equities Momentum (40% weight): baseline 20 pts
      const equityScore = Math.max(0, Math.min(40, 20 + avgEquities * 7.5))
      // 2. VIX Volatility (40% weight, inverted): baseline 20 pts at VIX 16.5
      const vixScore = Math.max(0, Math.min(40, 20 - (vixPrice - 16.5) * 2.5))
      // 3. BTC / Risk Appetite (20% weight): baseline 10 pts
      const btcScore = Math.max(0, Math.min(20, 10 + btcChg * 1.5))
      calculatedScore = Math.round(equityScore + vixScore + btcScore)

      // VIX safety cap
      if (vixPrice >= 18.0 && calculatedScore > 54) calculatedScore = 54
      else if (vixPrice >= 17.0 && calculatedScore > 58) calculatedScore = 58
    }

    const safeScore = Math.max(5, Math.min(95, calculatedScore))

    // Determine active zone
    let foundZone = GAUGE_ZONES[2] // default neutral
    if (safeScore <= 25) foundZone = GAUGE_ZONES[0]
    else if (safeScore <= 45) foundZone = GAUGE_ZONES[1]
    else if (safeScore <= 58) foundZone = GAUGE_ZONES[2]
    else if (safeScore <= 78) foundZone = GAUGE_ZONES[3]
    else foundZone = GAUGE_ZONES[4]

    return {
      score: safeScore,
      activeZone: foundZone,
      drivers: {
        equityMomentum: regime?.drivers?.equityMomentum ?? avgEquities,
        vixPrice: regime?.drivers?.vixPrice ?? vixPrice,
        btcChange: regime?.drivers?.btcChange ?? btcChg,
      },
    }
  }, [regime, benchmarks])

  // Center & Radius for the SVG gauge
  const cx = 140
  const cy = 132
  const r = 98

  // Rotation angle for needle:
  // 0 -> -90 deg (left)
  // 50 -> 0 deg (top)
  // 100 -> +90 deg (right)
  const needleAngle = (score / 100) * 180 - 90

  // 11 Tick marks (0%, 10%, 20%, ..., 100%)
  const ticks = useMemo(() => {
    return Array.from({ length: 11 }, (_, i) => {
      const pct = i / 10
      const angle = Math.PI - pct * Math.PI
      const isMajor = i === 0 || i === 5 || i === 10
      const rInner = isMajor ? r - 12 : r - 7
      const rOuter = r + 2

      const x1 = cx + rInner * Math.cos(angle)
      const y1 = cy - rInner * Math.sin(angle)
      const x2 = cx + rOuter * Math.cos(angle)
      const y2 = cy - rOuter * Math.sin(angle)

      return {
        key: i,
        x1: Number(x1.toFixed(1)),
        y1: Number(y1.toFixed(1)),
        x2: Number(x2.toFixed(1)),
        y2: Number(y2.toFixed(1)),
        isMajor,
        val: i * 10,
      }
    })
  }, [cx, cy, r])

  return (
    <div className="bg-gradient-to-br from-slate-900/95 via-slate-900/85 to-slate-950/95 border-2 border-white/[0.1] rounded-3xl p-6 shadow-2xl relative overflow-hidden backdrop-blur-2xl flex flex-col justify-between">
      {/* Background Ambient Radial Glow matching active zone */}
      <div
        className="absolute top-0 right-0 -mt-12 -mr-12 w-64 h-64 rounded-full blur-3xl pointer-events-none transition-all duration-700 opacity-25"
        style={{ backgroundColor: activeZone.color }}
      />

      <div>
        {/* Card Header */}
        <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shrink-0">
              <Compass className="w-5 h-5 animate-[spin_12s_linear_infinite]" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-blue-400 tracking-wider uppercase block">
                Market Sentiment Compass
              </span>
              <h3 className="text-xl font-black text-white flex items-center gap-2">
                <span>สภาวะตลาดวันนี้</span>
              </h3>
            </div>
          </div>

          {/* Active Regime Badge with pulsating indicator */}
          <div
            className={`px-3.5 py-1.5 rounded-full text-xs font-black border tracking-wide uppercase shadow-sm flex items-center gap-1.5 ${
              regime?.bg || 'bg-cyan-500/15 border-cyan-500/40'
            } ${regime?.color || 'text-cyan-300'}`}
          >
            <span
              className="w-2 h-2 rounded-full animate-ping shrink-0"
              style={{ backgroundColor: activeZone.color }}
            />
            <span>{regime?.title || 'กำลังประมวลผล...'}</span>
          </div>
        </div>

        {/* Real Human Sentiment Source Live Badge */}
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/25 text-[11px] font-semibold text-blue-300">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            <span>ดัชนีอารมณ์มนุษย์จริง: CNN Fear & Greed Index</span>
          </span>
          {regime?.fearGreed && (
            <span className="text-[11px] font-medium text-slate-400">
              (เมื่อวาน: {regime.fearGreed.previousClose} • สัปดาห์ก่อน: {regime.fearGreed.previous1Week ?? '-'})
            </span>
          )}
        </div>

        {/* ================= GAUGE METER SPEEDOMETER ================= */}
        <div className="relative flex flex-col items-center justify-center pt-2 pb-1">
          <div className="w-full max-w-[310px] mx-auto relative select-none">
            <svg
              viewBox="0 0 280 155"
              className="w-full h-auto overflow-visible filter drop-shadow-[0_8px_20px_rgba(0,0,0,0.6)]"
            >
              <defs>
                {/* Glow Filter for Active Arc Segment */}
                <filter id="needleGlow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <linearGradient id="needleBodyGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#ffffff" />
                  <stop offset="50%" stopColor="#cbd5e1" />
                  <stop offset="100%" stopColor="#64748b" />
                </linearGradient>
                <radialGradient id="centerCapGradient" cx="35%" cy="35%" r="65%">
                  <stop offset="0%" stopColor="#475569" />
                  <stop offset="50%" stopColor="#1e293b" />
                  <stop offset="100%" stopColor="#090d16" />
                </radialGradient>
              </defs>

              {/* Background Reference Track (Outer Dark Track) */}
              <path
                d={describeArc(cx, cy, r, 0.005, 0.995)}
                fill="none"
                stroke="rgba(255, 255, 255, 0.05)"
                strokeWidth="14"
                strokeLinecap="round"
              />

              {/* Inner Decorative Technical Dashed Line (Radar / Avionics Styling) */}
              <path
                d={describeArc(cx, cy, r - 15, 0.02, 0.98)}
                fill="none"
                stroke="rgba(255, 255, 255, 0.12)"
                strokeWidth="1.5"
                strokeDasharray="2 5"
              />

              {/* 5 Distinct Laser-Cut Colored Segments */}
              {GAUGE_ZONES.map((zone) => {
                const isActive = zone.id === activeZone.id
                return (
                  <path
                    key={zone.id}
                    d={describeArc(cx, cy, r, zone.fromPct, zone.toPct)}
                    fill="none"
                    stroke={zone.color}
                    strokeWidth={isActive ? 14 : 9}
                    strokeLinecap="round"
                    className="transition-all duration-500 cursor-pointer"
                    style={{
                      opacity: isActive ? 1 : 0.45,
                      filter: isActive ? 'url(#needleGlow)' : 'none',
                    }}
                  />
                )
              })}

              {/* Radial Ticks */}
              {ticks.map((t) => (
                <line
                  key={t.key}
                  x1={t.x1}
                  y1={t.y1}
                  x2={t.x2}
                  y2={t.y2}
                  stroke={t.isMajor ? 'rgba(255, 255, 255, 0.6)' : 'rgba(255, 255, 255, 0.2)'}
                  strokeWidth={t.isMajor ? 2 : 1}
                />
              ))}

              {/* Scale Numbers (0, 50, 100) */}
              <text x="24" y="148" fill="#f43f5e" fontSize="10" fontWeight="800" textAnchor="middle">
                0
              </text>
              <text x="140" y="24" fill="#eab308" fontSize="10" fontWeight="800" textAnchor="middle">
                50
              </text>
              <text x="256" y="148" fill="#06b6d4" fontSize="10" fontWeight="800" textAnchor="middle">
                100
              </text>

              {/* Scale Labels: Fear / Neutral / Greed */}
              <text
                x="56"
                y="148"
                fill="rgba(244, 63, 94, 0.8)"
                fontSize="8"
                fontWeight="700"
                textAnchor="middle"
                letterSpacing="0.5"
              >
                RISK-OFF
              </text>
              <text
                x="224"
                y="148"
                fill="rgba(16, 185, 129, 0.8)"
                fontSize="8"
                fontWeight="700"
                textAnchor="middle"
                letterSpacing="0.5"
              >
                RISK-ON
              </text>

              {/* ================= PRECISION NEEDLE (เข็มหน้าปัด) ================= */}
              <g
                style={{
                  transform: `rotate(${needleAngle}deg)`,
                  transformOrigin: `${cx}px ${cy}px`,
                  transition: 'transform 1.2s cubic-bezier(0.34, 1.4, 0.64, 1)',
                }}
              >
                {/* Needle Shadow */}
                <polygon
                  points={`${cx - 3},${cy} ${cx},${cy - 82} ${cx + 3},${cy} ${cx},${cy + 12}`}
                  fill="rgba(0, 0, 0, 0.5)"
                  filter="url(#needleGlow)"
                  transform="translate(2, 4)"
                />

                {/* Needle Faceted Body */}
                <polygon
                  points={`${cx - 3.5},${cy} ${cx},${cy - 84} ${cx + 3.5},${cy} ${cx},${cy + 14}`}
                  fill="url(#needleBodyGradient)"
                  stroke="rgba(255, 255, 255, 0.4)"
                  strokeWidth="0.5"
                />

                {/* Center Spine highlight of the needle */}
                <line
                  x1={cx}
                  y1={cy - 84}
                  x2={cx}
                  y2={cy + 10}
                  stroke="#ffffff"
                  strokeWidth="1"
                  strokeOpacity="0.8"
                />

                {/* Glowing Needle Tip Pointer */}
                <circle
                  cx={cx}
                  cy={cy - 84}
                  r="3.5"
                  fill={activeZone.color}
                  filter="url(#needleGlow)"
                  stroke="#ffffff"
                  strokeWidth="1"
                />
              </g>

              {/* Center Pivot Metallic Hub Cap */}
              <circle
                cx={cx}
                cy={cy}
                r="13"
                fill="url(#centerCapGradient)"
                stroke="rgba(255, 255, 255, 0.3)"
                strokeWidth="1.5"
              />
              <circle cx={cx} cy={cy} r="8" fill="#0f172a" stroke="rgba(255, 255, 255, 0.15)" strokeWidth="1" />
              {/* Inner Jeweled LED Indicator in Center */}
              <circle
                cx={cx}
                cy={cy}
                r="4"
                fill={activeZone.color}
                filter="url(#needleGlow)"
                className="animate-pulse"
              />
            </svg>

            {/* Glowing Digital Score Readout Right Under Pivot */}
            <div className="text-center -mt-3">
              <div className="inline-flex items-baseline gap-1 bg-slate-950/80 px-4 py-1.5 rounded-full border border-white/[0.08] shadow-inner">
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Human Sentiment:</span>
                <span
                  className="text-2xl font-black font-mono tracking-tight"
                  style={{ color: activeZone.color }}
                >
                  {score}
                </span>
                <span className="text-xs text-slate-500 font-bold">/ 100</span>
                <span className="text-[11px] font-bold text-slate-300 ml-1">
                  ({activeZone.label} • {regime?.fearGreed?.ratingLabelTh || activeZone.sub})
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Real Quantifiable Drivers (3 ปัจจัยคำนวณจริง: หุ้นโลก, VIX, คริปโต) */}
        <div className="mt-3.5 grid grid-cols-3 gap-2 text-center">
          {/* Factor 1: Equities Momentum */}
          <div className="bg-slate-950/60 p-2 rounded-xl border border-white/[0.06] flex flex-col justify-center">
            <span className="text-[10px] font-medium text-slate-400 flex items-center justify-center gap-1">
              <TrendingUp className="w-3 h-3 text-blue-400" />
              <span>SPX/NDX</span>
            </span>
            <span
              className={`text-xs font-black font-mono mt-0.5 ${
                drivers.equityMomentum >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {drivers.equityMomentum >= 0 ? '+' : ''}
              {drivers.equityMomentum.toFixed(2)}%
            </span>
          </div>

          {/* Factor 2: VIX Fear Level */}
          <div className="bg-slate-950/60 p-2 rounded-xl border border-white/[0.06] flex flex-col justify-center">
            <span className="text-[10px] font-medium text-slate-400 flex items-center justify-center gap-1">
              <ShieldAlert className="w-3 h-3 text-amber-400" />
              <span>VIX Fear</span>
            </span>
            <span
              className={`text-xs font-black font-mono mt-0.5 ${
                drivers.vixPrice < 17
                  ? 'text-emerald-400'
                  : drivers.vixPrice < 24
                  ? 'text-cyan-300'
                  : 'text-rose-400'
              }`}
            >
              {drivers.vixPrice.toFixed(2)}
            </span>
          </div>

          {/* Factor 3: BTC Risk Appetite */}
          <div className="bg-slate-950/60 p-2 rounded-xl border border-white/[0.06] flex flex-col justify-center">
            <span className="text-[10px] font-medium text-slate-400 flex items-center justify-center gap-1">
              <Sparkles className="w-3 h-3 text-purple-400" />
              <span>BTC Appetite</span>
            </span>
            <span
              className={`text-xs font-black font-mono mt-0.5 ${
                drivers.btcChange >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {drivers.btcChange >= 0 ? '+' : ''}
              {drivers.btcChange.toFixed(2)}%
            </span>
          </div>
        </div>

        {/* Guidance Text Box */}
        <div className="text-xs md:text-sm text-slate-200 leading-relaxed mt-3 bg-white/[0.03] border border-white/[0.06] p-3.5 rounded-2xl flex items-start gap-2.5">
          <span className="text-blue-400 font-bold shrink-0 mt-0.5">🧭 กลยุทธ์:</span>
          <span>
            {regime?.description ||
              'ตลาดอยู่ในโหมดกังวลและระมัดระวัง แนะนำเกาะวินัยการลงทุนและสำรองเงินสด'}
          </span>
        </div>

        {/* Action Playbook (วันนี้ควรเดินยังไง: สิ่งที่ห้ามทำ vs สิ่งที่ควรทำ) */}
        {regime?.playbook && (
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
            {/* Don'ts */}
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-2.5">
              <div className="flex items-center gap-1.5 text-rose-400 font-bold text-[11px] mb-1">
                <span>🛑 สิ่งที่ห้ามทำเด็ดขาด (Don&apos;ts)</span>
              </div>
              <ul className="space-y-1 text-slate-300 text-[11px]">
                {regime.playbook.donts.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-1">
                    <span className="text-rose-400 leading-tight shrink-0">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Dos */}
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-2.5">
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-[11px] mb-1">
                <span>🎯 สิ่งที่ควรทำวันนี้ (Dos)</span>
              </div>
              <ul className="space-y-1 text-slate-300 text-[11px]">
                {regime.playbook.dos.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-1">
                    <span className="text-emerald-400 leading-tight shrink-0">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Dry Powder & Currency Info (Bottom Row) */}
      <div className="pt-4 mt-4 border-t border-white/[0.08] grid grid-cols-2 gap-4">
        <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-white/[0.06]">
          <span className="text-xs font-semibold text-slate-400 block mb-1">เงินสดสำรอง (Dry Powder)</span>
          <span className="text-lg md:text-xl font-black text-emerald-400 font-mono">
            ฿{(totalCash ?? 0).toLocaleString()}
          </span>
          <span className="text-xs font-bold text-slate-400 ml-1.5">
            ({totalPortfolioValue ? ((totalCash / totalPortfolioValue) * 100).toFixed(1) : 0}%)
          </span>
        </div>
        <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-white/[0.06]">
          <span className="text-xs font-semibold text-slate-400 block mb-1">อัตราแลกเปลี่ยน USD/THB</span>
          <span className="text-lg md:text-xl font-black text-cyan-300 font-mono">
            ฿{usdThbRate ? usdThbRate.toFixed(2) : '33.30'}
          </span>
          <span className="text-xs text-slate-400 ml-1.5">บาท/ดอลลาร์</span>
        </div>
      </div>
    </div>
  )
}
