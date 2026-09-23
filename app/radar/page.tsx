'use client'

import React, { useState } from 'react'
import useSWR from 'swr'
import {
  Radar,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Target,
  Sparkles,
  RefreshCw,
  ArrowRight,
  Coins,
  DollarSign,
  Activity,
  Layers,
  ChevronRight,
  Flame,
  CheckCircle2,
  Wallet,
  Compass,
  AlertCircle,
  Clock,
  ExternalLink,
  Info,
  SlidersHorizontal,
  PieChart,
} from 'lucide-react'
import CountUp from 'react-countup'
import Link from 'next/link'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/PageHeader'
import { QuickAddModal } from '@/components/QuickAddModal'
import {
  RiskSentinelReport,
  OpportunityRadarReport,
  ConcentrationRiskItem,
  DrawdownRiskItem,
  OpportunityItem,
  SectorBreakdownItem,
} from '@/lib/analytics/risk-sentinel'

const SECTOR_COLORS: Record<string, { bar: string; text: string; bg: string; border: string }> = {
  Technology: { bar: 'bg-blue-500', text: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
  'Defensive & Dividend': { bar: 'bg-emerald-500', text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  Healthcare: { bar: 'bg-teal-500', text: 'text-teal-400', bg: 'bg-teal-500/10', border: 'border-teal-500/30' },
  'Broad Market Index': { bar: 'bg-indigo-500', text: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/30' },
  Financials: { bar: 'bg-amber-500', text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
  'Consumer Staples': { bar: 'bg-purple-500', text: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30' },
  'Gold & Commodities': { bar: 'bg-yellow-500', text: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' },
  'Fixed Income & Bonds': { bar: 'bg-sky-500', text: 'text-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-500/30' },
  Energy: { bar: 'bg-orange-500', text: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30' },
  'Cash & Reserves': { bar: 'bg-slate-500', text: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/30' },
  Other: { bar: 'bg-slate-600', text: 'text-slate-400', bg: 'bg-slate-600/10', border: 'border-slate-600/30' },
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

function renderBoldText(str: string) {
  const parts = str.split(/(\*\*.*?\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="text-white font-semibold">
          {part.slice(2, -2)}
        </strong>
      )
    }
    return part
  })
}

const tickerExclusions = new Set(['AI', 'DCA', 'CASH', 'DRY', 'POWDER', 'RISK', 'TOP'])

function renderBriefingText(str: string) {
  const parts = str.split(/(\*\*.*?\*\*|\b[A-Z]{2,5}\b)/g)

  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold text-white">
          {renderBriefingText(part.slice(2, -2))}
        </strong>
      )
    }

    if (/^[A-Z]{2,5}$/.test(part) && !tickerExclusions.has(part)) {
      return (
        <span key={i} className="mx-0.5 inline-flex items-center rounded-md border border-sky-400/30 bg-sky-400/10 px-1.5 py-0.5 align-baseline font-mono text-[11px] font-bold tracking-wide text-sky-200">
          {part}
        </span>
      )
    }

    return <React.Fragment key={i}>{part}</React.Fragment>
  })
}

function FormattedAiBriefing({ text }: { text: string }) {
  const lines = text.split('\n')
  const sections: { title: string; content: string[] }[] = []
  let currentSection: { title: string; content: string[] } | null = null

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed === '---') continue

    // Detect section headers e.g. "1. 🛡️ **บทสรุป...", "### 🛡️...", "2. 🎯 **3 ยุทธศาสตร์...", etc.
    const isHeader =
      /^(?:#+\s*|\d+\.\s*)([🛡🎯💡🚀⚠️]\s*)?\*\*(.*?)\*\*/i.test(trimmed) ||
      /^(?:#+\s*)?(บทสรุป|ยุทธศาสตร์|คำแนะนำ|Executive|Actionable|Dry Powder)/i.test(trimmed)

    if (isHeader) {
      const cleanTitle = trimmed
        .replace(/^[#\s\d.]+/g, '')
        .replace(/\*\*/g, '')
        .replace(/---/g, '')
        .trim()
      currentSection = { title: cleanTitle, content: [] }
      sections.push(currentSection)
    } else if (currentSection) {
      currentSection.content.push(trimmed)
    } else {
      if (sections.length === 0) {
        sections.push({ title: 'ภาพรวมยุทธศาสตร์พอร์ต', content: [trimmed] })
        currentSection = sections[0]
      } else {
        currentSection = sections[sections.length - 1]
        currentSection.content.push(trimmed)
      }
    }
  }

  if (sections.length === 0) {
    return (
      <div className="text-xs sm:text-sm text-slate-300 leading-relaxed space-y-2">
        {lines
          .filter((l) => l.trim() && l.trim() !== '---')
          .map((l, i) => (
            <p key={i} className="leading-relaxed">
              {renderBoldText(l.replace(/^[#\s]+/g, ''))}
            </p>
          ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
      {sections.map((sec, idx) => (
        <div
          key={idx}
          className="rounded-2xl bg-white/[0.02] border border-white/[0.07] p-5 sm:p-6 flex flex-col justify-between hover:border-white/10 transition-colors"
        >
          <div>
            <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-white/[0.06]">
              <span className="w-2 h-2 rounded-full bg-indigo-400" />
              <h4 className="text-sm font-bold text-white tracking-wide leading-6">{renderBriefingText(sec.title)}</h4>
            </div>
            <div className="space-y-3 text-[13px] text-slate-300 leading-7">
              {sec.content.map((c, ci) => {
                const isBullet = c.startsWith('-') || c.startsWith('*') || c.startsWith('•')
                const isPositive = /(ซื้อ|เพิ่ม|สะสม|เข้าช้อน|DCA|ทยอย)/i.test(`${sec.title} ${c}`)
                return (
                  <div key={ci} className={`flex items-start gap-2 rounded-lg ${isPositive ? 'border-l-2 border-emerald-400/70 bg-emerald-400/[0.06] px-3 py-1.5' : ''}`}>
                    {isBullet && (
                      <span className={`w-1.5 h-1.5 rounded-full mt-2.5 shrink-0 ${isPositive ? 'bg-emerald-400' : 'bg-indigo-400/80'}`} />
                    )}
                    <p className={`flex-1 leading-7 ${isPositive ? 'text-emerald-50' : 'text-slate-300'}`}>
                      {renderBriefingText(c.replace(/^[-*•]\s*/, ''))}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function RadarLoadingState() {
  return (
    <AppShell>
      <div className="w-full max-w-[1600px] mx-auto min-h-[60vh] flex flex-col justify-center gap-6 animate-fade-in" aria-busy="true">
        <div className="h-8 w-64 rounded-lg bg-slate-800/80 animate-pulse" />
        <div className="h-4 w-96 max-w-full rounded bg-slate-800/60 animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="h-32 rounded-2xl bg-slate-900/70 border border-slate-800 animate-pulse" />
          ))}
        </div>
      </div>
    </AppShell>
  )
}

function RadarErrorState() {
  return (
    <AppShell>
      <div className="w-full max-w-xl mx-auto min-h-[60vh] flex flex-col justify-center items-center text-center px-6">
        <AlertTriangle className="w-8 h-8 text-amber-400 mb-4" />
        <h1 className="text-xl font-semibold text-white">โหลดข้อมูลเรดาร์ไม่สำเร็จ</h1>
        <p className="text-sm text-slate-400 mt-2 mb-6">ลองโหลดหน้านี้อีกครั้งเพื่อดึงข้อมูลล่าสุด</p>
        <button onClick={() => window.location.reload()} className="min-h-11 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold text-white">
          ลองอีกครั้ง
        </button>
      </div>
    </AppShell>
  )
}

export default function RadarPage() {
  const { data, error, isLoading, mutate } = useSWR('/api/radar', fetcher, {
    revalidateOnFocus: false,
  })

  const [activeTab, setActiveTab] = useState<'all' | 'sentinel' | 'radar'>('all')
  const [selectedStressDrop, setSelectedStressDrop] = useState<-10 | -20 | -30>(-20)
  const [isScanning, setIsScanning] = useState(false)
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [scanMessage, setScanMessage] = useState<string | null>(null)

  const handleLiveAiScan = async () => {
    if (isScanning) return
    setIsScanning(true)
    setScanMessage('กำลังรวบรวมข้อมูลพอร์ต และส่งประมวลผลยุทธศาสตร์ผ่าน Gemini AI...')
    try {
      const res = await fetch('/api/radar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const result = await res.json()
      if (!res.ok) {
        throw new Error(result.error || 'การสแกนล้มเหลว')
      }
      await mutate(result, false)
      setScanMessage('✨ สแกนวิเคราะห์สดและอัปเดตยุทธศาสตร์พอร์ตสำเร็จ!')
      setTimeout(() => setScanMessage(null), 5000)
    } catch (err: any) {
      setScanMessage(`เกิดข้อผิดพลาด: ${err.message}`)
      setTimeout(() => setScanMessage(null), 6000)
    } finally {
      setIsScanning(false)
    }
  }

  if (isLoading) {
    return <RadarLoadingState />
  }

  if (error && !data) {
    return <RadarErrorState />
  }

  const riskReport: RiskSentinelReport | undefined = data?.riskReport
  const opportunityReport: OpportunityRadarReport | undefined = data?.opportunityReport
  const aiBriefing = data?.aiBriefing
  const baseCurrency: string = data?.baseCurrency || 'THB'
  const totalPortfolioValue: number = data?.totalPortfolioValue || 0
  const totalCash: number = data?.totalCash || 0
  const investedValue: number = data?.investedValue || 0

  const getRiskBadge = (level?: string) => {
    switch (level) {
      case 'CRITICAL':
        return {
          label: 'ความเสี่ยงวิกฤต (Critical)',
          bg: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
          dot: 'bg-rose-500',
          desc: 'พอร์ตมีจุดกระจุกตัวสูงมากหรือติดลบหนัก ควรรีบปรับพอร์ต',
        }
      case 'ELEVATED':
        return {
          label: 'ความเสี่ยงสูง (Elevated)',
          bg: 'bg-orange-500/10 border-orange-500/30 text-orange-400',
          dot: 'bg-orange-500',
          desc: 'มีสินทรัพย์บางตัวครองสัดส่วนสูง ควรชะลอการเติมเงินในกลุ่มเดิม',
        }
      case 'MODERATE':
        return {
          label: 'ความเสี่ยงปานกลาง (Moderate)',
          bg: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
          dot: 'bg-amber-500',
          desc: 'พอร์ตอยู่ในเกณฑ์ปกติ มีจุดที่ปรับปรุงเพื่อประสิทธิภาพได้',
        }
      default:
        return {
          label: 'ความเสี่ยงต่ำ (Low / Safe)',
          bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
          dot: 'bg-emerald-500',
          desc: 'พอร์ตมีการกระจายความเสี่ยงและสภาพคล่องที่ดีเยี่ยม',
        }
    }
  }

  const riskInfo = getRiskBadge(riskReport?.overallRiskLevel)

  return (
    <AppShell>
      <div className="flex flex-col gap-6 sm:gap-8 w-full max-w-[1600px] mx-auto animate-fade-in pb-16">
        {/* Top Header matching Dashboard */}
        <PageHeader
          eyebrow="RISK SENTINEL & ALPHA DISCOVERY"
          title="เรดาร์ความเสี่ยง & โอกาสลงทุน"
          description="ระบบเรดาร์ควบคู่: เฝ้าระวังจุดเสี่ยงเพื่อปกป้องเงินต้น (Capital Protection) และสแกนหาจังหวะช้อนซื้อของถูกเพื่อเร่งการเติบโตของพอร์ต (Alpha Discovery)"
          action={
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleLiveAiScan}
                disabled={isScanning}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 shadow-md shadow-indigo-600/25 transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <Sparkles className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : 'text-indigo-200'}`} />
                <span>{isScanning ? 'กำลังสแกนสดด้วย AI...' : 'สแกนวิเคราะห์สดด้วย AI'}</span>
              </button>
              <button
                type="button"
                onClick={() => mutate()}
                title="รีเฟรชข้อมูลเรดาร์"
                className="p-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-[#181C25] hover:bg-[#202532] border border-white/[0.1] transition-all flex items-center justify-center cursor-pointer shadow-sm"
              >
                <RefreshCw className="w-4 h-4 text-slate-300" />
              </button>
            </div>
          }
        />

        {scanMessage && (
          <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs flex items-center gap-2.5 animate-fade-in shadow-lg shadow-indigo-500/5">
            <Sparkles className="w-4 h-4 shrink-0 text-indigo-400 animate-pulse" />
            <span>{scanMessage}</span>
          </div>
        )}

        {/* ─── TOP KPI CARDS (Matching Dashboard Luxury Design) ─────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
          {/* 1. Risk Level */}
          <div className="glass-panel p-6 rounded-2xl flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400">ระดับความเสี่ยงพอร์ต</span>
                <p className="text-xs text-slate-400 mt-0.5">Overall Risk Sentinel</p>
              </div>
              <span className={`text-xs px-2.5 py-1 rounded-full font-bold border flex items-center gap-1.5 ${riskInfo.bg}`}>
                <span className={`w-2 h-2 rounded-full ${riskInfo.dot}`} />
                {riskReport?.overallRiskLevel || 'NORMAL'}
              </span>
            </div>

            <div className="my-4">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl font-bold text-white tabular-nums tracking-tight font-mono">
                  {riskReport?.overallRiskScore ?? 0}
                </span>
                <span className="text-xs text-slate-500 font-mono">/ 100 คะแนนความเสี่ยง</span>
              </div>
              <p className="text-xs text-slate-400 mt-2">{riskInfo.desc}</p>
            </div>

            <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
              <span>สถานะการกระจุกตัว:</span>
              <span className="font-semibold text-white">
                {riskReport?.concentrationRisks.length ? `${riskReport.concentrationRisks.length} รายการเตือน` : 'ปกติ'}
              </span>
            </div>
          </div>

          {/* 2. Dry Powder Cash */}
          <div className="glass-panel p-6 rounded-2xl flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400">กระสุนเงินสดสำรอง</span>
                <p className="text-xs text-slate-400 mt-0.5">Dry Powder Liquidity</p>
              </div>
              <span className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                <Coins className="w-4 h-4" />
              </span>
            </div>

            <div className="my-4">
              <p className="text-3xl sm:text-4xl font-bold text-emerald-400 tabular-nums tracking-tight leading-none font-mono">
                ฿<CountUp end={totalCash} decimals={2} separator="," duration={1.2} />
              </p>
              <p className="text-xs text-slate-400 mt-2">
                คิดเป็น <span className="text-emerald-400 font-semibold">{riskReport?.liquidity.cashRatioPercent.toFixed(1)}%</span> ของมูลค่าพอร์ตรวม
              </p>
            </div>

            <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
              <span>ความพร้อมช้อนซื้อ:</span>
              <span className="font-semibold text-emerald-400">{riskReport?.liquidity.statusLabel}</span>
            </div>
          </div>

          {/* 3. Opportunities Detected */}
          <div className="glass-panel p-6 rounded-2xl flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400">โอกาสลงทุนที่ตรวจพบ</span>
                <p className="text-xs text-slate-400 mt-0.5">Alpha Discovery Radar</p>
              </div>
              <span className="w-8 h-8 rounded-xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center">
                <Target className="w-4 h-4" />
              </span>
            </div>

            <div className="my-4">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl font-bold text-white tabular-nums tracking-tight font-mono">
                  {opportunityReport?.opportunities.length ?? 0}
                </span>
                <span className="text-xs text-slate-500 font-mono">รายการน่าจับตา</span>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                คะแนนความน่าสนใจสูงสุด: <span className="text-indigo-300 font-semibold">{opportunityReport?.opportunities[0]?.opportunityScore ?? 0}/100</span>
              </p>
            </div>

            <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
              <span>สแกน DCA / Rebalance:</span>
              <span className="font-semibold text-indigo-400">พร้อมดำเนินการ</span>
            </div>
          </div>

          {/* 4. Total Portfolio Value */}
          <div className="glass-panel p-6 rounded-2xl flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400">มูลค่าพอร์ตลงทุนรวม</span>
                <p className="text-xs text-slate-400 mt-0.5">Total Portfolio Net Worth</p>
              </div>
              <span className="w-8 h-8 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center">
                <Activity className="w-4 h-4" />
              </span>
            </div>

            <div className="my-4">
              <p className="text-3xl sm:text-4xl font-bold text-white tabular-nums tracking-tight leading-none font-mono">
                ฿<CountUp end={totalPortfolioValue} decimals={2} separator="," duration={1.2} />
              </p>
              <p className="text-xs text-slate-400 mt-2">
                สินทรัพย์ลงทุน: ฿{investedValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>

            <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
              <span>สกุลเงินหลัก:</span>
              <span className="font-mono text-slate-300">{baseCurrency}</span>
            </div>
          </div>
        </div>

        {/* ─── Sector Allocation & Cross-Sector Rotation Health ─────────── */}
        {riskReport?.sectorBreakdown && riskReport.sectorBreakdown.length > 0 && (
          <div className="rounded-3xl glass-panel p-6 sm:p-7 relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400">
                  <PieChart className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    การกระจายตัวตามกลุ่มอุตสาหกรรม (Sector Allocation & Rotation Health)
                  </h3>
                  <p className="text-xs text-slate-400">
                    ตรวจจับการกระจุกตัวเชิงกลุ่มธุรกิจ (Cluster Risk) และประเมินจุด Overweight เพื่อวางแผนหมุนเวียนข้ามกลุ่มสินทรัพย์
                  </p>
                </div>
              </div>

              {riskReport.sectorBreakdown.some((s) => s.isOverweight) ? (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span>ตรวจพบกลุ่มที่ Overweight เกินเกณฑ์</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>สัดส่วนกลุ่มธุรกิจกระจายตัวสมดุลดี</span>
                </div>
              )}
            </div>

            {/* Visual Multi-segment Progress Bar */}
            <div className="space-y-2 mb-6">
              <div className="w-full h-3.5 bg-black/40 rounded-full overflow-hidden border border-white/10 flex p-0.5 gap-0.5">
                {riskReport.sectorBreakdown.map((item, idx) => {
                  const color = SECTOR_COLORS[item.sector]?.bar || 'bg-indigo-500'
                  return (
                    <div
                      key={idx}
                      className={`h-full rounded-sm transition-all duration-500 ${color}`}
                      style={{ width: `${Math.max(1.5, item.percent)}%` }}
                      title={`${item.sector}: ${item.percent.toFixed(1)}%`}
                    />
                  )
                })}
              </div>
            </div>

            {/* Sector Breakdown Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
              {riskReport.sectorBreakdown.map((item, idx) => {
                const colors = SECTOR_COLORS[item.sector] || {
                  bar: 'bg-indigo-500',
                  text: 'text-indigo-400',
                  bg: 'bg-indigo-500/10',
                  border: 'border-indigo-500/30',
                }
                return (
                  <div
                    key={idx}
                    className={`p-4 rounded-2xl border transition-all ${
                      item.isOverweight
                        ? 'bg-rose-500/[0.06] border-rose-500/30'
                        : 'bg-white/[0.02] border-white/[0.06] hover:border-white/[0.12]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${colors.bar}`} />
                        <span className="text-xs font-semibold text-white truncate max-w-[130px]" title={item.sector}>
                          {item.sector}
                        </span>
                      </div>
                      {item.isOverweight ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 shrink-0">
                          Overweight ⚠️
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-white/[0.05] text-slate-400 shrink-0">
                          Normal
                        </span>
                      )}
                    </div>
                    <div className="flex items-baseline justify-between mt-2 pt-2 border-t border-white/[0.04]">
                      <span className="text-lg font-bold font-mono text-white">
                        {item.percent.toFixed(1)}%
                      </span>
                      <span className="text-xs font-mono text-slate-400">
                        ฿{item.valueBase.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ─── Gemini AI Strategic Briefing ─────────────────────────── */}
        <div className="rounded-3xl glass-panel p-6 sm:p-7 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-4 border-b border-white/[0.06]">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  Gemini AI Strategic Executive Briefing
                </h3>
                <p className="text-xs text-slate-400">
                  สังเคราะห์และเจาะลึกยุทธศาสตร์พอร์ตด้วยโมเดล {aiBriefing?.modelUsed || 'Gemini 2.5'}
                </p>
              </div>
            </div>
            {aiBriefing?.updatedAt && (
              <span className="text-xs text-slate-400 flex items-center gap-1.5 self-start sm:self-auto bg-white/[0.03] px-3 py-1.5 rounded-xl border border-white/[0.06]">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                อัปเดตล่าสุด: {new Date(aiBriefing.updatedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
              </span>
            )}
          </div>

          {aiBriefing?.text ? (
            <FormattedAiBriefing text={aiBriefing.text} />
          ) : (
            <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/[0.06] text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center mx-auto">
                <Sparkles className="w-6 h-6" />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h4 className="text-sm font-bold text-white">ยังไม่มีบทวิเคราะห์ยุทธศาสตร์สดของพอร์ต</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  คลิกปุ่มด้านล่างเพื่อให้ Gemini AI ประมวลผลจุดเสี่ยง สภาพคล่อง และคำนวณ 3 ยุทธศาสตร์สำคัญที่ควรลงมือทำทันที
                </p>
              </div>
              <button
                type="button"
                onClick={handleLiveAiScan}
                disabled={isScanning}
                className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-all inline-flex items-center gap-2 cursor-pointer shadow-lg shadow-indigo-600/25"
              >
                <Sparkles className="w-4 h-4" />
                <span>{isScanning ? 'กำลังสแกนสดด้วย AI...' : 'เริ่มสแกนวิเคราะห์สดด้วย Gemini AI'}</span>
              </button>
            </div>
          )}
        </div>

        {/* ─── Tab Switcher ────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
          <div className="flex items-center gap-1.5 bg-[#12151C] p-1.5 rounded-2xl border border-white/[0.08]">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              ภาพรวมทั้งสองระบบ
            </button>
            <button
              onClick={() => setActiveTab('sentinel')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'sentinel'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Risk Sentinel</span>
            </button>
            <button
              onClick={() => setActiveTab('radar')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'radar'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Target className="w-3.5 h-3.5" />
              <span>Opportunity Radar</span>
            </button>
          </div>

          <span className="text-xs text-slate-400">
            {riskReport?.keyWarnings.length
              ? `ตรวจพบข้อสังเกตความเสี่ยง ${riskReport.keyWarnings.length} รายการ`
              : 'พอร์ตมีโครงสร้างความปลอดภัยระดับมาตรฐาน'}
          </span>
        </div>

        {/* ─── MAIN DUAL RADAR GRID ────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* ═══════════════════════════════════════════════════════════
              LEFT COLUMN: 🛡️ RISK SENTINEL
          ═══════════════════════════════════════════════════════════ */}
          {(activeTab === 'all' || activeTab === 'sentinel') && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Risk Sentinel (ด่านตรวจความเสี่ยง)</h3>
                    <p className="text-xs text-slate-400">ควบคุมความเสี่ยงการกระจุกตัวและจำลองสภาวะวิกฤต</p>
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${riskInfo.bg}`}>
                  {riskInfo.label}
                </span>
              </div>

              {/* Stress Test Simulation Card */}
              <div className="rounded-3xl glass-panel p-6 shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                      <Flame className="w-4 h-4 text-orange-400" />
                      Concentration Stress Test (จำลองผลกระทบเมื่อตลาดตก)
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      คำนวณการสูญเสียเงินต้นหากสินทรัพย์ที่มีน้ำหนักสูงปรับฐาน
                    </p>
                  </div>
                  {/* Scenario Selector */}
                  <div className="flex items-center gap-1.5 bg-black/40 p-1.5 rounded-xl border border-white/5 self-start">
                    {[-10, -20, -30].map((drop) => (
                      <button
                        key={drop}
                        onClick={() => setSelectedStressDrop(drop as any)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          selectedStressDrop === drop
                            ? 'bg-rose-600 text-white shadow-sm'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {drop}%
                      </button>
                    ))}
                  </div>
                </div>

                {riskReport?.concentrationRisks && riskReport.concentrationRisks.length > 0 ? (
                  <div className="space-y-3 pt-2">
                    {riskReport.concentrationRisks.map((item) => {
                      const scenario = item.stressTests.find((s) => s.dropPercent === selectedStressDrop)
                      return (
                        <div
                          key={item.ticker}
                          className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-4 hover:border-white/10 transition-colors"
                        >
                          <div className="flex items-center justify-between mb-2.5">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-white bg-white/10 px-2.5 py-1 rounded-lg">
                                {item.ticker}
                              </span>
                              <span className="text-xs text-slate-300 truncate max-w-[140px] sm:max-w-[200px] font-medium">
                                {item.assetName}
                              </span>
                            </div>
                            <span className="text-xs font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                              ครองพอร์ต {item.allocationPercent.toFixed(1)}%
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-3 bg-black/30 rounded-xl p-3 text-xs">
                            <div>
                              <span className="text-slate-500 block text-[11px]">ผลกระทบพอร์ตโดยรวม:</span>
                              <span className="font-bold text-rose-400 text-sm">
                                -{scenario?.portfolioImpactPercent.toFixed(2)}%
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="text-slate-500 block text-[11px]">
                                เงินต้นที่ลดลง ({selectedStressDrop}%):
                              </span>
                              <span className="font-bold text-rose-400 text-sm font-mono">
                                -฿{scenario?.lossAmountBase.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                              </span>
                            </div>
                          </div>
                          <p className="text-xs text-slate-400 mt-2.5 flex items-center gap-1.5">
                            <Info className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <span>{item.recommendation}</span>
                          </p>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/15 text-emerald-300 text-xs flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    <span>ไม่มีสินทรัพย์ใดที่ถือครองเกิน 20% ของพอร์ต การกระจายความเสี่ยงอยู่ในเกณฑ์ยอดเยี่ยม</span>
                  </div>
                )}
              </div>

              {/* Drawdown Tracker */}
              <div className="rounded-3xl glass-panel p-6 shadow-xl space-y-4">
                <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-rose-400" />
                  Drawdown & Deep Loss Tracker (จุดตัดขาดทุน & ทบทวนสมมติฐาน)
                </h4>

                {riskReport?.drawdownRisks && riskReport.drawdownRisks.length > 0 ? (
                  <div className="space-y-3">
                    {riskReport.drawdownRisks.map((draw) => (
                      <div
                        key={draw.ticker}
                        className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] flex flex-col gap-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white bg-rose-500/10 text-rose-300 border border-rose-500/20 px-2.5 py-1 rounded-lg">
                              {draw.ticker}
                            </span>
                            <span className="text-xs text-slate-300 truncate max-w-[150px] font-medium">
                              {draw.assetName}
                            </span>
                          </div>
                          <span className="text-xs font-bold text-rose-400 font-mono">
                            {draw.unrealizedPnLPercent.toFixed(1)}% (ขาดทุน ฿{Math.abs(draw.unrealizedPnLBase).toLocaleString(undefined, { maximumFractionDigits: 0 })})
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 bg-black/20 p-2.5 rounded-xl">
                          {draw.thesisCheckNote}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/15 text-emerald-300 text-xs flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    <span>ไม่มีสินทรัพย์ใดในพอร์ตที่มีผลขาดทุนสะสมลึกกว่า -12%</span>
                  </div>
                )}
              </div>

              {/* Liquidity Health Meter */}
              <div className="rounded-3xl glass-panel p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-white flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-emerald-400" />
                    Liquidity & Dry Powder Meter
                  </span>
                  <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                    {riskReport?.liquidity.statusLabel}
                  </span>
                </div>

                <div className="w-full h-3 bg-black/40 rounded-full overflow-hidden border border-white/10 p-0.5">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      riskReport?.liquidity.status === 'LOW'
                        ? 'bg-rose-500'
                        : riskReport?.liquidity.status === 'HIGH'
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(5, riskReport?.liquidity.cashRatioPercent || 0))}%` }}
                  />
                </div>

                <div className="flex justify-between text-xs text-slate-500">
                  <span>0% (เสี่ยงตึงตัว)</span>
                  <span className="text-slate-400 font-semibold">10-25% (ระดับแนะนำ)</span>
                  <span>40%+ (เงินสดค้างสูง)</span>
                </div>

                <p className="text-xs text-slate-300 bg-white/[0.02] p-3.5 rounded-2xl border border-white/[0.04] leading-relaxed">
                  {riskReport?.liquidity.recommendation}
                </p>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════
              RIGHT COLUMN: 🎯 OPPORTUNITY RADAR
          ═══════════════════════════════════════════════════════════ */}
          {(activeTab === 'all' || activeTab === 'radar') && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <Target className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Opportunity Radar (เรดาร์โอกาสลงทุน)</h3>
                    <p className="text-xs text-slate-400">สแกนหาจังหวะซื้อของดีตอนย่อตัวและจุดเติมเงินตามแผน</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setQuickAddOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 text-xs font-semibold transition-all cursor-pointer"
                >
                  <span>+ บันทึกซื้อทันที</span>
                </button>
              </div>

              {/* Opportunity Cards List */}
              {opportunityReport?.opportunities && opportunityReport.opportunities.length > 0 ? (
                <div className="space-y-4">
                  {opportunityReport.opportunities.map((opp) => (
                    <div
                      key={opp.id}
                      className={`rounded-3xl glass-panel p-6 shadow-xl transition-all relative overflow-hidden group ${
                        opp.opportunityScore >= 70
                          ? 'border-emerald-500/40 shadow-emerald-950/30'
                          : 'hover:border-emerald-500/30'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className={`text-sm font-bold px-3 py-1.5 rounded-lg font-mono tracking-wide shadow-sm ${
                              opp.opportunityType === 'SECTOR_ROTATION'
                                ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30 shadow-purple-500/10'
                                : opp.opportunityType === 'DEFENSIVE_HEDGE'
                                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-amber-500/10'
                                : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-emerald-500/10'
                            }`}>
                              {opp.ticker}
                            </span>
                            <span className="text-[13px] font-semibold text-slate-400">
                              {opp.opportunityType === 'SECTOR_ROTATION'
                                ? 'หมุนเวียนกลุ่มอุตสาหกรรม (Sector Rotation)'
                                : opp.opportunityType === 'DEFENSIVE_HEDGE'
                                ? 'สินทรัพย์ป้องกันความเสี่ยง (Defensive Hedge)'
                                : opp.opportunityType === 'DCA_DOWN'
                                ? 'โอกาสเฉลี่ยต้นทุนต่ำลง'
                                : opp.opportunityType === 'REBALANCE_LAG'
                                ? 'สัดส่วนยังขาดจากเป้าหมาย'
                                : 'สินทรัพย์จับตาใน Watchlist'}
                            </span>
                          </div>
                          <h4 className="text-base font-bold text-white leading-6 group-hover:text-emerald-300 transition-colors">
                            {opp.title}
                          </h4>
                        </div>

                        <div className="text-right shrink-0">
                          <div className={`inline-flex flex-col items-center min-w-[58px] px-2.5 py-1.5 rounded-xl border font-mono ${
                            opp.opportunityScore >= 70
                              ? 'bg-emerald-500/15 border-emerald-400/30 text-emerald-300'
                              : 'bg-indigo-500/10 border-indigo-500/25 text-indigo-300'
                          }`}>
                            <span className="text-[10px] uppercase tracking-wider opacity-80">Score</span>
                            <span className="text-lg font-bold leading-5">{opp.opportunityScore}</span>
                          </div>
                        </div>
                      </div>

                      <p className="text-[13px] text-slate-300 leading-7 bg-black/20 p-3.5 rounded-2xl border border-white/[0.04]">
                        {opp.description}
                      </p>

                      <div className="mt-4 pt-3.5 border-t border-white/[0.05] flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] text-slate-400">{opp.metricLabel}:</span>
                          <span className="text-sm font-bold text-emerald-400 font-mono">{opp.metricValue}</span>
                        </div>

                        <button
                          type="button"
                          onClick={() => setQuickAddOpen(true)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold shadow-md shadow-emerald-600/25 transition-all active:scale-95 cursor-pointer"
                        >
                          <span>ซื้อทันที</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-3xl glass-panel p-8 text-center space-y-3">
                  <Compass className="w-8 h-8 text-slate-500 mx-auto" />
                  <h4 className="text-sm font-bold text-white">พอร์ตของคุณมีสัดส่วนสมดุลดีเยี่ยม</h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                    ยังไม่พบสินทรัพย์ที่ย่อตัวลงมาผิดปกติ หรือสัดส่วนที่เบี่ยงเบนจากเป้าหมาย แนะนำรักษาวินัยการลงทุนตามแผนปัจจุบัน
                  </p>
                </div>
              )}

              {/* Smart DCA Allocation Advice box */}
              <div className="rounded-3xl glass-panel p-6 shadow-xl relative overflow-hidden border-indigo-500/20">
                <div className="flex items-center gap-2 mb-2.5">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  <h4 className="text-sm font-bold text-white">กลยุทธ์การเติมเงินรอบถัดไป (Capital Allocation)</h4>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {opportunityReport?.topPickSummary}
                </p>
                <div className="mt-4 pt-3.5 border-t border-white/[0.06] flex items-center justify-between">
                  <span className="text-xs text-slate-400">กระสุนเงินสดพร้อมจัดสรร:</span>
                  <span className="text-sm font-bold text-white font-mono">
                    ฿{totalCash.toLocaleString(undefined, { maximumFractionDigits: 0 })} {baseCurrency}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Quick Add Modal */}
        {quickAddOpen && (
          <QuickAddModal
            initialTab="manual"
            onClose={() => setQuickAddOpen(false)}
            onSuccess={() => {
              setQuickAddOpen(false)
              mutate()
            }}
          />
        )}
      </div>
    </AppShell>
  )
}
