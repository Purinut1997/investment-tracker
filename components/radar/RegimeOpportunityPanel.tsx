'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Sparkles,
  ShieldCheck,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  ArrowRight,
  ExternalLink,
  LineChart,
  Clock,
  Layers,
} from 'lucide-react'
import type {
  OpportunityRole,
  RegimeOpportunitiesReport,
  RegimeOpportunityCandidate,
} from '@/lib/analytics/regime-opportunities'
import type { RegimeAlphaAiReport } from '@/app/api/radar/regime-alpha/route'
import { buildCopilotDeepLink } from '@/lib/ai/quick-questions'

interface RegimeOpportunityPanelProps {
  report: RegimeOpportunitiesReport | null
  initialAiState?: {
    report: RegimeAlphaAiReport
    modelUsed?: string
    updatedAt?: string
  } | null
  onSelectStock: (stock: { symbol: string; name?: string; market?: 'US' | 'TH' }) => void
  onQuickBuy: (data: {
    ticker: string
    action: 'BUY'
    price?: number
    market?: 'US' | 'TH' | 'CRYPTO'
  }) => void
  onRefreshRadar?: () => void
}

const ROLE_FILTERS: Array<{ id: 'ALL' | OpportunityRole; label: string }> = [
  { id: 'ALL', label: 'ทั้งหมด' },
  { id: 'DEFENSIVE_HEDGE', label: '🛡️ กันกระแทก' },
  { id: 'SECTOR_ROTATION', label: '🔄 หมุนทำกำไร' },
  { id: 'INCOME_BUFFER', label: '💰 ปันผลรอ' },
  { id: 'CONTRARIAN_DIP', label: '🎯 ช้อนย่อ/Watchlist' },
]

export function RegimeOpportunityPanel({
  report,
  initialAiState,
  onSelectStock,
  onQuickBuy,
  onRefreshRadar,
}: RegimeOpportunityPanelProps) {
  const [roleFilter, setRoleFilter] = useState<'ALL' | OpportunityRole>('ALL')
  const [aiReport, setAiReport] = useState<RegimeAlphaAiReport | null>(
    initialAiState?.report ?? null
  )
  const [modelUsed, setModelUsed] = useState<string | null>(initialAiState?.modelUsed ?? null)
  const [updatedAt, setUpdatedAt] = useState<string | null>(initialAiState?.updatedAt ?? null)
  const [isScanningAi, setIsScanningAi] = useState(false)
  const [errorText, setErrorText] = useState<string | null>(null)

  useEffect(() => {
    if (initialAiState?.report) {
      setAiReport(initialAiState.report)
      setModelUsed(initialAiState.modelUsed ?? null)
      setUpdatedAt(initialAiState.updatedAt ?? null)
    }
  }, [initialAiState])

  if (!report || !report.candidates || report.candidates.length === 0) {
    return null
  }

  const handleRunRegimeAi = async (forceRefresh = true) => {
    if (isScanningAi) return
    setIsScanningAi(true)
    setErrorText(null)
    try {
      const res = await fetch('/api/radar/regime-alpha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceRefresh }),
      })
      const json = await res.json()
      if (!res.ok) {
        setErrorText(json?.error || 'ไม่สามารถวิเคราะห์โอกาสทำกำไรด้วย AI ได้')
        return
      }
      if (json.aiReport) {
        setAiReport(json.aiReport)
        setModelUsed(json.modelUsed ?? null)
        setUpdatedAt(json.updatedAt ?? null)
      }
      onRefreshRadar?.()
    } catch {
      setErrorText('เกิดข้อผิดพลาดในการเชื่อมต่อ AI Regime Alpha')
    } finally {
      setIsScanningAi(false)
    }
  }

  const filteredCandidates =
    roleFilter === 'ALL'
      ? report.candidates
      : report.candidates.filter((c) => c.role === roleFilter)

  const aiPickMap = new Map(
    (aiReport?.picks || []).map((p) => [p.ticker.toUpperCase(), p])
  )

  const toneClass =
    report.regime.badgeTone === 'rose'
      ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
      : report.regime.badgeTone === 'amber'
      ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
      : report.regime.badgeTone === 'indigo'
      ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
      : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'

  return (
    <div className="rounded-3xl glass-panel border border-emerald-500/25 p-5 sm:p-6 space-y-5 shadow-xl">
      {/* Header & Regime Telemetry */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-white/[0.07]">
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              <TrendingUp className="w-3.5 h-3.5" />
              Regime Alpha Scanner (Long-Only)
            </span>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${toneClass}`}>
              {report.regime.labelTh}
            </span>
          </div>

          <p className="text-xs sm:text-[13px] text-slate-300 leading-relaxed">
            {report.regime.summaryTh}
          </p>

          <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-slate-300">
            <span className="px-2 py-1 rounded-lg bg-black/35 border border-white/[0.06]">
              QQQ 1M: {report.regime.qqqReturn21D >= 0 ? '+' : ''}
              {report.regime.qqqReturn21D}%
            </span>
            <span className="px-2 py-1 rounded-lg bg-black/35 border border-white/[0.06]">
              SPY 1M: {report.regime.spyReturn21D >= 0 ? '+' : ''}
              {report.regime.spyReturn21D}%
            </span>
            {report.regime.vixPrice !== null && (
              <span className="px-2 py-1 rounded-lg bg-black/35 border border-white/[0.06]">
                VIX: {report.regime.vixPrice.toFixed(1)}
              </span>
            )}
            {report.regime.us10yYield !== null && (
              <span className="px-2 py-1 rounded-lg bg-black/35 border border-white/[0.06]">
                US10Y: {report.regime.us10yYield.toFixed(2)}%
              </span>
            )}
            <span className="px-2 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">
              พอร์ต: Tech {report.techExposurePercent}% · Gold {report.goldExposurePercent}% · Cash{' '}
              {report.cashPercent}%
            </span>
          </div>
        </div>

        <div className="flex flex-col items-start sm:items-end gap-2 shrink-0">
          <button
            type="button"
            onClick={() => handleRunRegimeAi(Boolean(aiReport))}
            disabled={isScanningAi}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/25 transition-all cursor-pointer disabled:opacity-50"
          >
            {isScanningAi ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>กำลังให้ AI คัดโอกาสทำกำไร...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>{aiReport ? 'อัปเดตแผน AI Alpha' : 'ให้ AI คัดโอกาสทำกำไรวันนี้'}</span>
              </>
            )}
          </button>

          {updatedAt && (
            <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
              <Clock className="w-3 h-3" />
              อัปเดต {new Date(updatedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
              {modelUsed ? ` · ${modelUsed}` : ''}
            </span>
          )}
        </div>
      </div>

      {errorText && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-xs text-rose-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorText}</span>
        </div>
      )}

      {/* AI Executive Regime Defense Summary */}
      {aiReport && (
        <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/40 via-[#101622] to-indigo-950/30 border border-emerald-500/25 space-y-2.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              กลยุทธ์ทำกำไร & ลดแรงกระแทกพอร์ตจาก AI
            </span>
            <Link
              href={buildCopilotDeepLink(
                `ต่อยอดจาก Regime Alpha วันนี้ (${aiReport.regimeHeadline}) ช่วยเทียบตัวเด่น ${aiReport.picks.map((p) => p.ticker).join(', ')} ว่าจะแบ่งเงินเข้าซื้อตัวไหนก่อน-หลังโดยไม่ขัดกฎส่วนตัว?`
              )}
              className="text-[11px] font-semibold text-indigo-300 hover:text-white inline-flex items-center gap-1"
            >
              <span>ถามต่อยอดใน Copilot</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
          <p className="text-sm font-semibold text-white leading-relaxed">{aiReport.regimeHeadline}</p>
          <p className="text-xs text-slate-300 leading-relaxed">{aiReport.portfolioDefenseStrategy}</p>
          <p className="text-[11px] text-amber-300/90 bg-amber-500/10 border border-amber-500/20 px-3 py-2 rounded-xl flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>{aiReport.watchoutTh}</span>
          </p>
        </div>
      )}

      {/* Role Filter Pills */}
      <div className="flex items-center gap-2 flex-wrap">
        {ROLE_FILTERS.map((f) => {
          const count =
            f.id === 'ALL'
              ? report.candidates.length
              : report.candidates.filter((c) => c.role === f.id).length
          if (f.id !== 'ALL' && count === 0) return null
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setRoleFilter(f.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                roleFilter === f.id
                  ? 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40'
                  : 'bg-white/[0.03] text-slate-400 hover:text-white border-white/[0.07]'
              }`}
            >
              {f.label} ({count})
            </button>
          )
        })}
      </div>

      {/* Candidate Cards */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {filteredCandidates.map((cand: RegimeOpportunityCandidate, idx: number) => {
          const aiPick = aiPickMap.get(cand.ticker.toUpperCase())
          const currSym = cand.currency === 'THB' ? '฿' : '$'
          const isTopPick = report.candidates[0]?.ticker === cand.ticker

          return (
            <div
              key={cand.ticker}
              className={`p-4 sm:p-5 rounded-2xl bg-[#0D1119]/90 border transition-all space-y-3.5 ${
                isTopPick
                  ? 'border-emerald-500/45 shadow-lg shadow-emerald-950/30'
                  : 'border-white/[0.08] hover:border-emerald-500/35'
              }`}
            >
              {/* Top Row */}
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {isTopPick && (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500 text-black">
                        #{idx + 1} ตัวเด่นวันนี้
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        onSelectStock({
                          symbol: cand.ticker,
                          name: cand.name,
                          market: cand.market === 'TH' ? 'TH' : 'US',
                        })
                      }
                      className="text-sm font-bold px-3 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 font-mono cursor-pointer transition-colors"
                    >
                      {cand.ticker}
                    </button>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-white/[0.05] text-slate-200 border border-white/[0.08]">
                      {aiPick?.roleLabelTh || cand.roleLabelTh}
                    </span>
                    {cand.isWatchlist && (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/25">
                        Watchlist ของคุณ
                      </span>
                    )}
                    {cand.alreadyHeldPct > 0 && (
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                        ถืออยู่ {cand.alreadyHeldPct}%
                      </span>
                    )}
                    {aiPick && (
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                        AI แนะนำ ~{aiPick.suggestedAllocationPct}%
                      </span>
                    )}
                  </div>

                  <h4 className="text-sm font-bold text-white truncate">{cand.name}</h4>
                </div>

                {/* Quant Score Badge */}
                <div className="text-right shrink-0">
                  <div className="inline-flex flex-col items-center px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-400/30 font-mono text-emerald-300">
                    <span className="text-[10px] uppercase opacity-80">Alpha Score</span>
                    <span className="text-lg font-bold leading-5">{cand.totalScore}</span>
                  </div>
                </div>
              </div>

              {/* Entry Caution Banner */}
              {cand.entryCaution && (
                <div className="px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-200 flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>{cand.entryCaution}</span>
                </div>
              )}

              {/* 4 Proof Metrics Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                <div className="p-2.5 rounded-xl bg-black/40 border border-white/[0.05]">
                  <span className="text-[10px] text-slate-400 block font-sans">ราคาล่าสุด</span>
                  <strong className="text-white">
                    {currSym}
                    {cand.currentPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </strong>
                  <span
                    className={`block text-[10px] ${
                      cand.changePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {cand.changePercent >= 0 ? '+' : ''}
                    {cand.changePercent}% วันนี้
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-black/40 border border-white/[0.05]">
                  <span className="text-[10px] text-slate-400 block font-sans">RS 1M เทียบ QQQ</span>
                  <strong
                    className={cand.rsVsQqq21D >= 0 ? 'text-emerald-300' : 'text-amber-300'}
                  >
                    {cand.rsVsQqq21D >= 0 ? '+' : ''}
                    {cand.rsVsQqq21D.toFixed(1)}%
                  </strong>
                  <span className="block text-[10px] text-slate-400">
                    5D: {cand.rsVsQqq5D >= 0 ? '+' : ''}
                    {cand.rsVsQqq5D.toFixed(1)}%
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-black/40 border border-white/[0.05]">
                  <span className="text-[10px] text-slate-400 block font-sans">Corr 60D กับ Tech</span>
                  <strong
                    className={
                      cand.corr60DWithQqq <= 0.25 ? 'text-cyan-300' : 'text-slate-200'
                    }
                  >
                    {cand.corr60DWithQqq.toFixed(2)}
                  </strong>
                  <span className="block text-[10px] text-slate-400">
                    {cand.corr60DWithQqq <= 0.25 ? 'กันกระแทกดีมาก' : 'กระจายเสี่ยง'}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-black/40 border border-white/[0.05]">
                  <span className="text-[10px] text-slate-400 block font-sans">RSI(14) / แนวรับ S1</span>
                  <strong className="text-white">
                    {cand.rsi14 !== null ? cand.rsi14.toFixed(1) : '—'}
                  </strong>
                  <span className="block text-[10px] text-indigo-300">
                    S1: {cand.supportS1 ? `${currSym}${cand.supportS1.toFixed(2)}` : '—'}
                  </span>
                </div>
              </div>

              {/* Hedge Impact Preview */}
              {cand.hedgeImpact && (
                <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/25 text-xs text-cyan-200 flex items-start gap-2 leading-relaxed">
                  <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <span>{cand.hedgeImpact.summaryTh}</span>
                </div>
              )}

              {/* AI Playbook or Quant Summary */}
              {aiPick ? (
                <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2 text-xs text-slate-200 leading-relaxed">
                  <p>
                    <strong className="text-emerald-300">ทำไมเด่นตอนนี้:</strong> {aiPick.whyNowTh}
                  </p>
                  <p>
                    <strong className="text-indigo-300">แผนเข้าซื้อ:</strong> {aiPick.entryPlanTh}
                  </p>
                  <p>
                    <strong className="text-rose-300">จุดหนีไฟ:</strong> {aiPick.invalidationTh}
                  </p>
                  <p>
                    <strong className="text-amber-300">เงื่อนไขสลับกลับเข้า Tech:</strong>{' '}
                    {aiPick.exitTriggerTh}
                  </p>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1.5 text-xs text-slate-300 leading-relaxed">
                  {cand.quantReasons.map((r, rIdx) => (
                    <div key={rIdx} className="flex items-start gap-2">
                      <Layers className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{r}</span>
                    </div>
                  ))}
                  <p className="pt-1 text-[11px] text-indigo-300">
                    <strong>โซนรับ & จุดหนีไฟ:</strong> {cand.entryZoneTh} · {cand.stopLossRefTh}
                  </p>
                </div>
              )}

              {/* Action Footer */}
              <div className="pt-2 border-t border-white/[0.05] flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() =>
                      onSelectStock({
                        symbol: cand.ticker,
                        name: cand.name,
                        market: cand.market === 'TH' ? 'TH' : 'US',
                      })
                    }
                    className="px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-semibold text-slate-200 flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <LineChart className="w-3.5 h-3.5 text-indigo-400" />
                    <span>ดูกราฟ</span>
                  </button>

                  <Link
                    href={buildCopilotDeepLink(
                      `วิเคราะห์ ${cand.ticker} (${cand.roleLabelTh}, RS 1M vs QQQ ${cand.rsVsQqq21D >= 0 ? '+' : ''}${cand.rsVsQqq21D}%, Corr ${cand.corr60DWithQqq}, RSI ${cand.rsi14 ?? 'N/A'}) ว่าควรแบ่งเงินซื้อกี่ไม้เพื่อลดความเสี่ยงพอร์ต Tech ตอนนี้?`
                    )}
                    className="px-3 py-1.5 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-xs font-semibold text-indigo-300 hover:text-white flex items-center gap-1.5 transition-colors"
                  >
                    <span>ถามต่อยอดใน Copilot</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    onQuickBuy({
                      ticker: cand.ticker,
                      action: 'BUY',
                      price: cand.currentPrice,
                      market: cand.market === 'TH' ? 'TH' : 'US',
                    })
                  }
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/25 cursor-pointer transition-all"
                >
                  <span>ซื้อทันที</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
