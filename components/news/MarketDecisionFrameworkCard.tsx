'use client'

import React, { useState } from 'react'
import {
  Compass,
  Target,
  TrendingUp,
  AlertTriangle,
  Clock,
  Layers,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  Activity,
  DollarSign,
  PieChart,
  Flame,
  Globe,
  Landmark,
  Scale,
  Calendar,
  Briefcase,
  Cpu,
  BarChart3,
  FileText,
  HelpCircle,
  Sparkles,
} from 'lucide-react'
import type {
  MarketDecisionFramework,
  MarketDecisionTierItem,
} from '@/lib/news/news-analyzer'

interface MarketDecisionFrameworkCardProps {
  framework?: MarketDecisionFramework | null
}

type TierFilter = 'all' | 'tier1' | 'tier2' | 'tier3' | 'sources'

export function MarketDecisionFrameworkCard({ framework }: MarketDecisionFrameworkCardProps) {
  const [activeTab, setActiveTab] = useState<TierFilter>('all')

  if (!framework) return null

  const isBuy = framework.overallStance === 'BUY'
  const isWait = framework.overallStance === 'WAIT'
  const isHold = framework.overallStance === 'HOLD'

  const stanceBg = isBuy
    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
    : isWait
    ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
    : 'bg-amber-500/10 border-amber-500/30 text-amber-400'

  const getStatusBadge = (status: MarketDecisionTierItem['status'], label: string) => {
    switch (status) {
      case 'bullish':
        return (
          <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>{label}</span>
          </span>
        )
      case 'bearish':
        return (
          <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30 flex items-center gap-1.5 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
            <span>{label}</span>
          </span>
        )
      case 'watch':
        return (
          <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1.5 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span>{label}</span>
          </span>
        )
      default:
        return (
          <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-500/15 text-slate-300 border border-slate-500/30 flex items-center gap-1.5 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            <span>{label}</span>
          </span>
        )
    }
  }

  return (
    <div className="rounded-3xl bg-[#12151C] border border-white/[0.09] shadow-2xl shadow-black/40 relative overflow-hidden transition-all duration-300">
      {/* Background Ambience Glow */}
      <div className="absolute top-0 right-0 w-[550px] h-[350px] bg-gradient-to-bl from-indigo-600/10 via-purple-600/5 to-transparent blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[450px] h-[300px] bg-gradient-to-tr from-emerald-600/5 via-blue-600/5 to-transparent blur-3xl pointer-events-none" />

      {/* 1. TOP HEADER & VERDICT COCKPIT */}
      <div className="p-5 sm:p-6 pb-5 border-b border-white/[0.07] relative z-10">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-inner">
                <Compass className="w-5 h-5 text-indigo-400" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-wide">
                กรอบติดตามตลาด 3 ระดับ & แผนตัดสินใจ (ซื้อ • ถือ • รอ)
              </h2>
              <span className="text-xs font-mono font-medium px-3 py-1 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                Investment Decision Radar
              </span>
            </div>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-4xl">
              ระบบคัดกรองข้อมูลและสัญญาณตลาด 3 ระดับ เพื่อตอบ 3 คำถามหลักก่อนลงเงินจริง ช่วยให้รู้ทันทีว่าควรลงมือทำอะไรต่อ
            </p>
          </div>

          {/* Master Verdict Badge */}
          <div className="shrink-0 self-start lg:self-center">
            <div className={`px-4 py-2.5 rounded-2xl border flex items-center gap-2.5 shadow-lg ${stanceBg}`}>
              <div className="w-2.5 h-2.5 rounded-full bg-current animate-pulse" />
              <div>
                <span className="text-[11px] font-mono uppercase tracking-wider block opacity-80 leading-none">
                  คำวินิจฉัยภาพรวมวันนี้
                </span>
                <span className="text-sm sm:text-base font-bold tracking-wide mt-1 block">
                  {framework.stanceLabel}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 1-Minute Executive Summary Bar */}
        <div className="mt-4 p-3.5 sm:p-4 rounded-xl bg-[#181C25]/80 border border-white/[0.07] flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-300 font-mono">
              บทสรุปด่วน (อ่านจบใน 30 วินาที)
            </span>
            <p className="text-sm sm:text-base text-slate-100 font-medium leading-relaxed">
              {framework.summaryHeadline}
            </p>
          </div>
        </div>
      </div>

      {/* 2. CORE DECISION COCKPIT: THE 3 PRE-INVESTMENT QUESTIONS */}
      <div className="p-5 sm:p-6 bg-gradient-to-r from-[#151924] via-[#131620] to-[#12151C] border-b border-white/[0.07] relative z-10">
        <div className="flex items-center gap-2 mb-4">
          <HelpCircle className="w-4 h-4 text-indigo-400" />
          <h3 className="text-sm sm:text-base font-bold text-white uppercase tracking-wider">
            3 คำถามหลักที่ต้องตอบให้ได้ก่อนตัดสินใจซื้อหุ้น
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Question 1 */}
          <div className="p-4 rounded-2xl bg-[#181C25] border border-white/[0.08] space-y-2 relative group hover:border-indigo-500/40 transition-colors">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center justify-center text-xs font-bold font-mono">
                1
              </span>
              <h4 className="text-sm sm:text-base font-bold text-white">
                ตลาดกำลังเผชิญอะไร?
              </h4>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              {framework.threeCoreQuestions.marketFacing}
            </p>
          </div>

          {/* Question 2 */}
          <div className="p-4 rounded-2xl bg-[#181C25] border border-white/[0.08] space-y-2 relative group hover:border-indigo-500/40 transition-colors">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center justify-center text-xs font-bold font-mono">
                2
              </span>
              <h4 className="text-sm sm:text-base font-bold text-white">
                กำไรของธุรกิจมีแนวโน้มอย่างไร?
              </h4>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              {framework.threeCoreQuestions.earningsTrend}
            </p>
          </div>

          {/* Question 3 */}
          <div className="p-4 rounded-2xl bg-[#181C25] border border-white/[0.08] space-y-2 relative group hover:border-indigo-500/40 transition-colors">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center justify-center text-xs font-bold font-mono">
                3
              </span>
              <h4 className="text-sm sm:text-base font-bold text-white">
                ราคาปัจจุบันคุ้มกับความเสี่ยงหรือไม่?
              </h4>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              {framework.threeCoreQuestions.valuationRiskReward}
            </p>
          </div>
        </div>
      </div>

      {/* 3. TIER NAVIGATION TABS */}
      <div className="p-4 sm:p-5 pb-0 border-b border-white/[0.07] bg-[#12151C] flex items-center gap-2 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
            activeTab === 'all'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-bold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>แสดงทั้ง 3 ระดับ</span>
        </button>

        <button
          onClick={() => setActiveTab('tier1')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
            activeTab === 'tier1'
              ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30 font-bold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-rose-400" />
          <span>ระดับ 1: ต้องติดตามเป็นประจำ ({framework.tier1Regular.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('tier2')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
            activeTab === 'tier2'
              ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30 font-bold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          <span>ระดับ 2: ใช้ประเมินจังหวะซื้อ ({framework.tier2BuyTiming.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('tier3')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
            activeTab === 'tier3'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 font-bold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-blue-400" />
          <span>ระดับ 3: ติดตามเมื่อมีเหตุการณ์ ({framework.tier3EventDriven.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('sources')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
            activeTab === 'sources'
              ? 'bg-slate-700 text-white shadow-md font-bold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
          }`}
        >
          <Globe className="w-4 h-4 text-indigo-400" />
          <span>แหล่งข้อมูลหลัก & วินัย</span>
        </button>
      </div>

      {/* 4. TIERS CONTENT AREA */}
      <div className="p-5 sm:p-6 space-y-8 relative z-10">
        {/* ================= TIER 1 ================= */}
        {(activeTab === 'all' || activeTab === 'tier1') && (
          <div className="space-y-3.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="w-3 h-3 rounded-full bg-rose-500 shadow-sm shadow-rose-500/50" />
                <h3 className="text-base sm:text-lg font-bold text-white tracking-wide">
                  ระดับ 1: ต้องติดตามเป็นประจำ (Core Macro Pulse)
                </h3>
              </div>
              <span className="text-xs font-mono text-slate-400 hidden sm:inline">
                ตรวจเช็กทุกเช้า/ประจำสัปดาห์
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {framework.tier1Regular.map((item) => (
                <div
                  key={item.id}
                  className="p-4 sm:p-4.5 rounded-2xl bg-[#181C25] border border-white/[0.07] hover:border-white/[0.15] transition-all space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-sm sm:text-base font-bold text-white">
                          {item.title}
                        </h4>
                        {item.subTitle && (
                          <p className="text-xs text-slate-400 mt-0.5">{item.subTitle}</p>
                        )}
                      </div>
                      {getStatusBadge(item.status, item.statusLabel)}
                    </div>

                    {item.keyMetric && (
                      <div className="px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.06] text-xs font-mono text-indigo-300 inline-block">
                        {item.keyMetric}
                      </div>
                    )}

                    <p className="text-sm text-slate-300 leading-relaxed pt-1">
                      {item.insight}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-white/[0.06] flex items-center gap-2 text-xs sm:text-sm font-medium text-indigo-300">
                    <ArrowRight className="w-4 h-4 text-indigo-400 shrink-0" />
                    <span>{item.actionGuidance}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================= TIER 2 ================= */}
        {(activeTab === 'all' || activeTab === 'tier2') && (
          <div className="space-y-3.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="w-3 h-3 rounded-full bg-amber-500 shadow-sm shadow-amber-500/50" />
                <h3 className="text-base sm:text-lg font-bold text-white tracking-wide">
                  ระดับ 2: ใช้ประเมินจังหวะซื้อ (Entry Timing & Valuation Radar)
                </h3>
              </div>
              <span className="text-xs font-mono text-slate-400 hidden sm:inline">
                ประเมินความถูกแพงและความคุ้มค่า
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {framework.tier2BuyTiming.map((item) => (
                <div
                  key={item.id}
                  className="p-4 sm:p-4.5 rounded-2xl bg-[#181C25] border border-white/[0.07] hover:border-white/[0.15] transition-all space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-sm sm:text-base font-bold text-white">
                          {item.title}
                        </h4>
                        {item.subTitle && (
                          <p className="text-xs text-slate-400 mt-0.5">{item.subTitle}</p>
                        )}
                      </div>
                      {getStatusBadge(item.status, item.statusLabel)}
                    </div>

                    {item.keyMetric && (
                      <div className="px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.06] text-xs font-mono text-amber-300 inline-block">
                        {item.keyMetric}
                      </div>
                    )}

                    <p className="text-sm text-slate-300 leading-relaxed pt-1">
                      {item.insight}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-white/[0.06] flex items-center gap-2 text-xs sm:text-sm font-medium text-amber-300">
                    <ArrowRight className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>{item.actionGuidance}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================= TIER 3 ================= */}
        {(activeTab === 'all' || activeTab === 'tier3') && (
          <div className="space-y-3.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="w-3 h-3 rounded-full bg-blue-500 shadow-sm shadow-blue-500/50" />
                <h3 className="text-base sm:text-lg font-bold text-white tracking-wide">
                  ระดับ 3: ติดตามเมื่อมีเหตุการณ์ (Event-Driven & Shock Radar)
                </h3>
              </div>
              <span className="text-xs font-mono text-slate-400 hidden sm:inline">
                ประเมินเฉพาะเมื่อเกิดข่าวใหญ่/Tail Risk
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-3.5">
              {framework.tier3EventDriven.map((item) => (
                <div
                  key={item.id}
                  className="p-4 sm:p-4.5 rounded-2xl bg-[#181C25] border border-white/[0.07] hover:border-white/[0.15] transition-all space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-sm sm:text-base font-bold text-white">
                          {item.title}
                        </h4>
                        {item.subTitle && (
                          <p className="text-xs text-slate-400 mt-0.5">{item.subTitle}</p>
                        )}
                      </div>
                      {getStatusBadge(item.status, item.statusLabel)}
                    </div>

                    {item.keyMetric && (
                      <div className="px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.06] text-xs font-mono text-blue-300 inline-block">
                        {item.keyMetric}
                      </div>
                    )}

                    <p className="text-sm text-slate-300 leading-relaxed pt-1">
                      {item.insight}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-white/[0.06] flex items-center gap-2 text-xs sm:text-sm font-medium text-blue-300">
                    <ArrowRight className="w-4 h-4 text-blue-400 shrink-0" />
                    <span>{item.actionGuidance}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================= OFFICIAL SOURCES ================= */}
        {(activeTab === 'all' || activeTab === 'sources') && (
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-2.5">
              <Globe className="w-5 h-5 text-indigo-400" />
              <h3 className="text-base sm:text-lg font-bold text-white tracking-wide">
                แหล่งข้อมูลหลักสำหรับติดตามตัวเลขจริง (Official Data Sources)
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {framework.officialSources.map((source, idx) => (
                <a
                  key={idx}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-4 rounded-2xl bg-[#181C25] hover:bg-[#202532] border border-white/[0.08] hover:border-indigo-500/40 transition-all flex flex-col justify-between space-y-2.5 group cursor-pointer shadow-sm hover:shadow-indigo-500/10"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                        {source.category}
                      </span>
                      <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-indigo-400 transition-colors" />
                    </div>
                    <h4 className="text-sm sm:text-base font-bold text-white group-hover:text-indigo-300 transition-colors">
                      {source.name}
                    </h4>
                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed line-clamp-2">
                      {source.description}
                    </p>
                  </div>

                  <span className="text-xs text-indigo-400 font-semibold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                    <span>เปิดดูแหล่งข้อมูล</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* ================= DISCIPLINE PHILOSOPHY FOOTER ================= */}
        <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-amber-500/10 via-[#181C25] to-[#12151C] border border-amber-500/30 flex flex-col md:flex-row md:items-center gap-4 shadow-lg shadow-black/20">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 shadow-inner">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-300 font-mono">
                หลักคิดสุดท้าย (Discipline Guardrail)
              </span>
            </div>
            <p className="text-sm sm:text-base text-slate-100 font-medium leading-relaxed">
              &ldquo;{framework.disciplineRule}&rdquo;
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
