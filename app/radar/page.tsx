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
} from 'lucide-react'
import CountUp from 'react-countup'
import Link from 'next/link'
import { QuickAddModal } from '@/components/QuickAddModal'
import {
  RiskSentinelReport,
  OpportunityRadarReport,
  ConcentrationRiskItem,
  DrawdownRiskItem,
  OpportunityItem,
} from '@/lib/analytics/risk-sentinel'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

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
    setScanMessage('กำลังรวบรวมข้อมูลพอร์ต และส่งประมวลผลกลยุทธ์ผ่าน Gemini AI...')
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
    <div className="space-y-8 pb-16">
      {/* ─── Hero Header & Radar Pulse ───────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#131722] via-[#0E1118] to-[#0A0C10] border border-white/[0.08] p-6 sm:p-8 shadow-2xl">
        {/* Glowing Background Orbs */}
        <div className="absolute -top-24 -right-24 w-80 h-80 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
              </span>
              <Radar className="w-3.5 h-3.5 text-indigo-400" />
              <span>AI Autonomous Sentinel & Intelligence Radar</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
              เรดาร์ความเสี่ยง & โอกาสลงทุน
            </h1>
            <p className="text-sm text-slate-400 max-w-2xl leading-relaxed">
              ระบบเรดาร์ควบคู่: เฝ้าระวังจุดเสี่ยงเพื่อปกป้องเงินต้น (Capital Protection) และสแกนหาจังหวะช้อนซื้อของถูกเพื่อเร่งการเติบโตของพอร์ต (Alpha Discovery)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleLiveAiScan}
              disabled={isScanning}
              className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-xs sm:text-sm font-semibold shadow-lg shadow-indigo-600/30 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
            >
              <Sparkles className={`w-4 h-4 ${isScanning ? 'animate-spin' : 'text-indigo-200'}`} />
              <span>{isScanning ? 'กำลังสแกนสดด้วย AI...' : 'สแกนวิเคราะห์สดด้วย AI'}</span>
            </button>
            <button
              onClick={() => mutate()}
              title="รีเฟรชข้อมูล"
              className="p-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-slate-300 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {scanMessage && (
          <div className="mt-4 p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs flex items-center gap-2 animate-fade-in">
            <Sparkles className="w-4 h-4 shrink-0 text-indigo-400" />
            <span>{scanMessage}</span>
          </div>
        )}

        {/* ─── Metric Cockpit Bar ───────────────────────────────── */}
        <div className="mt-6 pt-6 border-t border-white/[0.06] grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-4">
            <span className="text-xs text-slate-400 flex items-center gap-1.5 mb-1">
              <ShieldAlert className="w-3.5 h-3.5 text-slate-500" />
              ระดับความเสี่ยงพอร์ต
            </span>
            <div className="flex items-center gap-2 mt-1">
              <span className={`inline-block w-2.5 h-2.5 rounded-full ${riskInfo.dot}`} />
              <span className="text-sm sm:text-base font-bold text-white">
                {riskReport ? riskReport.overallRiskLevel : 'กำลังคำนวณ...'}
              </span>
            </div>
            <span className="text-[11px] text-slate-500 mt-1 block">
              คะแนนความเสี่ยง: {riskReport ? `${riskReport.overallRiskScore}/100` : '-'}
            </span>
          </div>

          <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-4">
            <span className="text-xs text-slate-400 flex items-center gap-1.5 mb-1">
              <Coins className="w-3.5 h-3.5 text-emerald-400" />
              กระสุนเงินสด (Dry Powder)
            </span>
            <p className="text-sm sm:text-base font-bold text-emerald-400 mt-1">
              ฿<CountUp end={totalCash} decimals={2} separator="," duration={1.2} />
            </p>
            <span className="text-[11px] text-slate-500 mt-1 block">
              คิดเป็น {riskReport?.liquidity.cashRatioPercent.toFixed(1)}% ของพอร์ต
            </span>
          </div>

          <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-4">
            <span className="text-xs text-slate-400 flex items-center gap-1.5 mb-1">
              <Target className="w-3.5 h-3.5 text-indigo-400" />
              โอกาสลงทุนที่ตรวจพบ
            </span>
            <p className="text-sm sm:text-base font-bold text-white mt-1">
              {opportunityReport ? `${opportunityReport.opportunities.length} รายการ` : '-'}
            </p>
            <span className="text-[11px] text-slate-500 mt-1 block">
              คะแนนเฉลี่ย: {opportunityReport?.opportunities[0]?.opportunityScore || 0}/100
            </span>
          </div>

          <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-4">
            <span className="text-xs text-slate-400 flex items-center gap-1.5 mb-1">
              <Activity className="w-3.5 h-3.5 text-blue-400" />
              มูลค่าพอร์ตโฟลิโอรวม
            </span>
            <p className="text-sm sm:text-base font-bold text-white mt-1">
              ฿<CountUp end={totalPortfolioValue} decimals={2} separator="," duration={1.2} />
            </p>
            <span className="text-[11px] text-slate-500 mt-1 block">
              สินทรัพย์ลงทุน: ฿{investedValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
          </div>
        </div>
      </div>

      {/* ─── Gemini AI Strategic Briefing Card ───────────────────── */}
      {aiBriefing && (
        <div className="rounded-2xl bg-gradient-to-r from-indigo-950/40 via-[#121622] to-slate-900/50 border border-indigo-500/20 p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  Gemini AI Strategic Executive Briefing
                </h2>
                <p className="text-xs text-slate-400">
                  สังเคราะห์วิเคราะห์ความเสี่ยงและโอกาสด้วยโมเดล {aiBriefing.modelUsed || 'Gemini'}
                </p>
              </div>
            </div>
            {aiBriefing.updatedAt && (
              <span className="text-[11px] text-slate-500 flex items-center gap-1 self-start sm:self-auto">
                <Clock className="w-3 h-3" />
                อัปเดต: {new Date(aiBriefing.updatedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>

          <div className="prose prose-invert max-w-none text-xs sm:text-sm text-slate-300 whitespace-pre-line leading-relaxed bg-black/30 rounded-xl p-4 sm:p-5 border border-white/[0.05]">
            {aiBriefing.text}
          </div>
        </div>
      )}

      {/* ─── Tab Switcher ────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
        <div className="flex items-center gap-2 bg-[#12151C] p-1 rounded-xl border border-white/[0.06]">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'all'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            ภาพรวมทั้งสองระบบ
          </button>
          <button
            onClick={() => setActiveTab('sentinel')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
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
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'radar'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Target className="w-3.5 h-3.5" />
            <span>Opportunity Radar</span>
          </button>
        </div>

        <span className="text-xs text-slate-400 hidden sm:inline">
          {riskReport?.keyWarnings.length ? `พบการแจ้งเตือนความเสี่ยง ${riskReport.keyWarnings.length} รายการ` : 'พอร์ตอยู่ในสภาวะปลอดภัย'}
        </span>
      </div>

      {/* ─── MAIN GRID CONTENT ───────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* ═══════════════════════════════════════════════════════════
            LEFT COLUMN: 🛡️ RISK SENTINEL
        ═══════════════════════════════════════════════════════════ */}
        {(activeTab === 'all' || activeTab === 'sentinel') && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Risk Sentinel (ด่านตรวจความเสี่ยง)</h3>
                  <p className="text-xs text-slate-400">ควบคุมความเสี่ยงการกระจุกตัวและจำลองสภาวะวิกฤต</p>
                </div>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${riskInfo.bg}`}>
                {riskInfo.label}
              </span>
            </div>

            {/* Stress Test Simulation Card */}
            <div className="rounded-2xl bg-[#12151C] border border-white/[0.08] p-5 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Flame className="w-4 h-4 text-orange-400" />
                    Concentration Stress Test (จำลองผลกระทบเมื่อตลาดตก)
                  </h4>
                  <p className="text-xs text-slate-400">
                    คำนวณการสูญเสียเงินต้นหากสินทรัพย์ที่มีน้ำหนักสูงปรับฐาน
                  </p>
                </div>
                {/* Scenario Selector */}
                <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-lg border border-white/5 self-start">
                  {[-10, -20, -30].map((drop) => (
                    <button
                      key={drop}
                      onClick={() => setSelectedStressDrop(drop as any)}
                      className={`px-2.5 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
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
                <div className="space-y-3">
                  {riskReport.concentrationRisks.map((item) => {
                    const scenario = item.stressTests.find((s) => s.dropPercent === selectedStressDrop)
                    return (
                      <div
                        key={item.ticker}
                        className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-3.5 hover:border-white/10 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white bg-white/10 px-2 py-0.5 rounded">
                              {item.ticker}
                            </span>
                            <span className="text-xs text-slate-400 truncate max-w-[140px] sm:max-w-[200px]">
                              {item.assetName}
                            </span>
                          </div>
                          <span className="text-xs font-semibold text-amber-400">
                            ครองพอร์ต {item.allocationPercent.toFixed(1)}%
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 bg-black/30 rounded-lg p-2.5 text-xs">
                          <div>
                            <span className="text-slate-500 block text-[11px]">ผลกระทบพอร์ตโดยรวม:</span>
                            <span className="font-bold text-rose-400">
                              -{scenario?.portfolioImpactPercent.toFixed(2)}%
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-slate-500 block text-[11px]">
                              เงินต้นที่ลดลง ({selectedStressDrop}%):
                            </span>
                            <span className="font-bold text-rose-400">
                              -฿{scenario?.lossAmountBase.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </span>
                          </div>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1.5">
                          <Info className="w-3 h-3 text-slate-500 shrink-0" />
                          <span>{item.recommendation}</span>
                        </p>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/15 text-emerald-300 text-xs flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span>ไม่มีสินทรัพย์ใดที่ถือครองเกิน 20% ของพอร์ต การกระจายความเสี่ยงอยู่ในเกณฑ์ยอดเยี่ยม</span>
                </div>
              )}
            </div>

            {/* Deep Drawdown / Warning Assets */}
            <div className="rounded-2xl bg-[#12151C] border border-white/[0.08] p-5 shadow-xl space-y-4">
              <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-rose-400" />
                Drawdown & Deep Loss Tracker (จุดตัดขาดทุน & ทบทวนสมมติฐาน)
              </h4>

              {riskReport?.drawdownRisks && riskReport.drawdownRisks.length > 0 ? (
                <div className="space-y-2.5">
                  {riskReport.drawdownRisks.map((draw) => (
                    <div
                      key={draw.ticker}
                      className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] flex flex-col gap-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white bg-rose-500/10 text-rose-300 border border-rose-500/20 px-2 py-0.5 rounded">
                            {draw.ticker}
                          </span>
                          <span className="text-xs text-slate-400 truncate max-w-[150px]">
                            {draw.assetName}
                          </span>
                        </div>
                        <span className="text-xs font-bold text-rose-400">
                          {draw.unrealizedPnLPercent.toFixed(1)}% (ขาดทุน ฿{Math.abs(draw.unrealizedPnLBase).toLocaleString(undefined, { maximumFractionDigits: 0 })})
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 bg-black/20 p-2 rounded">
                        {draw.thesisCheckNote}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/15 text-emerald-300 text-xs flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span>ไม่มีสินทรัพย์ใดในพอร์ตที่มีผลขาดทุนสะสมลึกกว่า -12%</span>
                </div>
              )}
            </div>

            {/* Liquidity Health Meter */}
            <div className="rounded-2xl bg-[#12151C] border border-white/[0.08] p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-white flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-emerald-400" />
                  Liquidity & Dry Powder Meter
                </span>
                <span className="text-xs font-bold text-emerald-400">
                  {riskReport?.liquidity.statusLabel}
                </span>
              </div>

              {/* Progress Bar */}
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

              <div className="flex justify-between text-[11px] text-slate-500">
                <span>0% (เสี่ยงตึงตัว)</span>
                <span className="text-slate-400 font-semibold">10-25% (ระดับแนะนำ)</span>
                <span>40%+ (เงินสดค้างสูง)</span>
              </div>

              <p className="text-xs text-slate-400 mt-2 bg-white/[0.02] p-3 rounded-xl border border-white/[0.04]">
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
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Target className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Opportunity Radar (เรดาร์โอกาสลงทุน)</h3>
                  <p className="text-xs text-slate-400">สแกนหาจังหวะซื้อของดีตอนย่อตัวและจุดเติมเงินตามแผน</p>
                </div>
              </div>
              <button
                onClick={() => setQuickAddOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 text-xs font-semibold transition-all cursor-pointer"
              >
                <span>+ บันทึกซื้อทันที</span>
              </button>
            </div>

            {/* Opportunity Cards List */}
            {opportunityReport?.opportunities && opportunityReport.opportunities.length > 0 ? (
              <div className="space-y-4">
                {opportunityReport.opportunities.map((opp) => {
                  return (
                    <div
                      key={opp.id}
                      className="rounded-2xl bg-[#12151C] border border-white/[0.08] hover:border-emerald-500/30 p-5 shadow-xl transition-all relative overflow-hidden group"
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              {opp.ticker}
                            </span>
                            <span className="text-[11px] font-semibold text-slate-400">
                              {opp.opportunityType === 'DCA_DOWN'
                                ? 'โอกาสเฉลี่ยต้นทุนต่ำลง'
                                : opp.opportunityType === 'REBALANCE_LAG'
                                ? 'สัดส่วนยังขาดจากเป้าหมาย'
                                : 'สินทรัพย์จับตาใน Watchlist'}
                            </span>
                          </div>
                          <h4 className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors">
                            {opp.title}
                          </h4>
                        </div>

                        {/* Opportunity Score Pill */}
                        <div className="text-right shrink-0">
                          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/25 text-indigo-300 text-xs font-extrabold">
                            <span>Score</span>
                            <span>{opp.opportunityScore}</span>
                          </div>
                        </div>
                      </div>

                      <p className="text-xs text-slate-300 leading-relaxed bg-black/20 p-3 rounded-xl border border-white/[0.04]">
                        {opp.description}
                      </p>

                      <div className="mt-3 pt-3 border-t border-white/[0.05] flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400">{opp.metricLabel}:</span>
                          <span className="text-xs font-bold text-emerald-400">{opp.metricValue}</span>
                        </div>

                        <button
                          onClick={() => setQuickAddOpen(true)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/25 transition-all active:scale-95 cursor-pointer"
                        >
                          <span>ซื้อทันที</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="rounded-2xl bg-[#12151C] border border-white/[0.08] p-8 text-center space-y-3">
                <Compass className="w-8 h-8 text-slate-500 mx-auto" />
                <h4 className="text-sm font-bold text-white">พอร์ตของคุณมีสัดส่วนสมดุลดีเยี่ยม</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  ยังไม่พบสินทรัพย์ที่ย่อตัวลงมาผิดปกติ หรือสัดส่วนที่เบี่ยงเบนจากเป้าหมาย แนะนำรักษาวินัยการลงทุนตามแผนปัจจุบัน
                </p>
              </div>
            )}

            {/* Smart DCA Allocation Advice box */}
            <div className="rounded-2xl bg-gradient-to-br from-[#12151C] to-indigo-950/20 border border-indigo-500/20 p-5 shadow-xl">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <h4 className="text-sm font-bold text-white">กลยุทธ์การเติมเงินรอบถัดไป (Capital Allocation)</h4>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {opportunityReport?.topPickSummary}
              </p>
              <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between">
                <span className="text-xs text-slate-400">กระสุนเงินสดพร้อมจัดสรร:</span>
                <span className="text-sm font-bold text-white">
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
  )
}
