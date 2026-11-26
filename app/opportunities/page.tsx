'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import {
  Target,
  RefreshCw,
  Bot,
  AlertTriangle,
  Wallet,
  TrendingUp,
  ShieldCheck,
  Award,
  ArrowRight,
} from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/PageHeader'
import { RegimeOpportunityPanel } from '@/components/radar/RegimeOpportunityPanel'
import { QuickAddModal } from '@/components/QuickAddModal'
import { StockDetailModal } from '@/components/market-watch/StockDetailModal'
import type { RegimeOpportunitiesReport } from '@/lib/analytics/regime-opportunities'
import type { RegimeAlphaAiReport } from '@/app/api/radar/regime-alpha/route'

const fetcher = (url: string) =>
  fetch(url).then(async (res) => {
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(json?.error || 'Failed to load opportunities')
    return json
  })

interface RegimeAlphaApiResponse {
  quantReport: RegimeOpportunitiesReport | null
  aiReport: RegimeAlphaAiReport | null
  modelUsed: string | null
  updatedAt: string | null
  cached: boolean
}

export default function OpportunitiesPage() {
  const { data, error, isLoading, mutate } = useSWR<RegimeAlphaApiResponse>(
    '/api/radar/regime-alpha',
    fetcher,
    { revalidateOnFocus: false }
  )

  const [isRefreshingMarket, setIsRefreshingMarket] = useState(false)
  const [selectedStock, setSelectedStock] = useState<{
    symbol: string
    name?: string
    market?: 'US' | 'TH'
  } | null>(null)
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [quickAddInitialData, setQuickAddInitialData] = useState<
    | {
        ticker?: string
        action?: 'BUY' | 'SELL' | 'DIVIDEND' | 'DEPOSIT' | 'WITHDRAW' | 'FEE'
        price?: number
        market?: 'US' | 'TH' | 'CRYPTO'
      }
    | undefined
  >(undefined)

  const handleRefreshMarket = async () => {
    if (isRefreshingMarket) return
    setIsRefreshingMarket(true)
    try {
      const refreshed = await fetcher('/api/radar/regime-alpha?refresh=true')
      await mutate(refreshed, false)
    } catch {
      await mutate()
    } finally {
      setIsRefreshingMarket(false)
    }
  }

  const quantReport = data?.quantReport ?? null
  const topCandidate = quantReport?.candidates?.[0] ?? null

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <PageHeader
          eyebrow="LONG-ONLY ALPHA & DOWNSIDE HEDGE"
          title="โอกาสทำกำไร & กันกระแทกตามสภาวะตลาด"
          description="สแกน ETF กลุ่ม Value/ปันผล, ทองคำ, พันธบัตร, Defensive และ Watchlist ของคุณที่กำลังชนะตลาดเมื่อหุ้นเทคผันผวน พร้อมจำลองลดแรงกระแทกให้พอร์ตจริง"
          action={
            <>
              <button
                type="button"
                onClick={handleRefreshMarket}
                disabled={isRefreshingMarket || isLoading}
                className="px-3.5 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.1] text-xs sm:text-sm font-semibold text-slate-200 flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshingMarket ? 'animate-spin' : ''}`} />
                <span>{isRefreshingMarket ? 'กำลังอัปเดตราคา...' : 'รีเฟรชข้อมูลตลาด'}</span>
              </button>

              <Link
                href="/ai-advisor"
                className="px-3.5 py-2 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/35 text-xs sm:text-sm font-semibold text-indigo-200 flex items-center gap-2 transition-colors"
              >
                <Bot className="w-4 h-4 text-indigo-300" />
                <span>คุยต่อยอดใน Copilot 360°</span>
              </Link>
            </>
          }
        />

        {isLoading && (
          <div className="space-y-4" aria-busy="true">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-28 rounded-2xl bg-slate-900/70 border border-white/[0.06] animate-pulse"
                />
              ))}
            </div>
            <div className="h-96 rounded-3xl bg-slate-900/70 border border-white/[0.06] animate-pulse" />
          </div>
        )}

        {error && !isLoading && (
          <div className="rounded-3xl glass-panel border border-rose-500/25 p-8 text-center space-y-4">
            <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto" />
            <div>
              <h2 className="text-base font-bold text-white">โหลดข้อมูลสภาวะตลาดไม่สำเร็จ</h2>
              <p className="text-xs text-slate-400 mt-1">{error.message}</p>
            </div>
            <button
              type="button"
              onClick={() => mutate()}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white cursor-pointer"
            >
              ลองใหม่อีกครั้ง
            </button>
          </div>
        )}

        {!isLoading && !error && quantReport && (
          <>
            {/* 4-Card KPI Overview Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 sm:p-5 rounded-2xl bg-[#0E131E] border border-white/[0.08] space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                  สภาวะตลาดวันนี้
                </span>
                <p className="text-sm font-bold text-white leading-snug">
                  {quantReport.regime.labelTh}
                </p>
                <p className="text-[11px] font-mono text-slate-400">
                  QQQ 1M {quantReport.regime.qqqReturn21D >= 0 ? '+' : ''}
                  {quantReport.regime.qqqReturn21D}% vs SPY{' '}
                  {quantReport.regime.spyReturn21D >= 0 ? '+' : ''}
                  {quantReport.regime.spyReturn21D}%
                </p>
              </div>

              <div className="p-4 sm:p-5 rounded-2xl bg-[#0E131E] border border-white/[0.08] space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                  น้ำหนัก Tech / Gold ในพอร์ต
                </span>
                <p className="text-lg font-bold font-mono text-white">
                  Tech {quantReport.techExposurePercent}% · Gold {quantReport.goldExposurePercent}%
                </p>
                <p className="text-[11px] text-slate-400">
                  {quantReport.techExposurePercent >= 40
                    ? 'Tech สูง ควรมีตัวกันกระแทก Correlation ต่ำ'
                    : 'สัดส่วน Tech อยู่ในระดับควบคุมได้'}
                </p>
              </div>

              <div className="p-4 sm:p-5 rounded-2xl bg-[#0E131E] border border-white/[0.08] space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5 text-indigo-400" />
                  เงินสดพร้อมจัดสรร (Dry Powder)
                </span>
                <p className="text-lg font-bold font-mono text-emerald-400">
                  {quantReport.cashPercent.toFixed(1)}% ของพอร์ต
                </p>
                <Link
                  href="/radar"
                  className="text-[11px] text-indigo-300 hover:text-white inline-flex items-center gap-1"
                >
                  <span>เช็กความเสี่ยงพอร์ตเต็มใน Radar</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              <div className="p-4 sm:p-5 rounded-2xl bg-[#0E131E] border border-emerald-500/25 space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-emerald-400" />
                  ตัวเด่นอันดับ 1 วันนี้
                </span>
                {topCandidate ? (
                  <>
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-lg font-bold font-mono text-white">
                        {topCandidate.ticker}
                      </p>
                      <span className="text-xs font-mono font-bold text-emerald-300">
                        {topCandidate.totalScore}/100
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 truncate">
                      {topCandidate.roleLabelTh} · Corr {topCandidate.corr60DWithQqq.toFixed(2)}
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-slate-400">ยังไม่มีข้อมูล</p>
                )}
              </div>
            </div>

            {/* Full-Width Regime Opportunity Scanner & AI Playbook */}
            <RegimeOpportunityPanel
              report={quantReport}
              initialAiState={
                data?.aiReport
                  ? {
                      report: data.aiReport,
                      modelUsed: data.modelUsed ?? undefined,
                      updatedAt: data.updatedAt ?? undefined,
                    }
                  : null
              }
              onSelectStock={(stock) => setSelectedStock(stock)}
              onQuickBuy={(buyData) => {
                setQuickAddInitialData(buyData)
                setQuickAddOpen(true)
              }}
              onRefreshRadar={() => mutate()}
            />
          </>
        )}

        {!isLoading && !error && !quantReport && (
          <div className="rounded-3xl glass-panel p-10 text-center space-y-3">
            <Target className="w-8 h-8 text-slate-400 mx-auto" />
            <h2 className="text-base font-bold text-white">ยังไม่ได้รับข้อมูลตลาดล่าสุด</h2>
            <p className="text-xs text-slate-400">
              กดปุ่มรีเฟรชข้อมูลตลาดด้านบนเพื่อสแกนหาโอกาสทำกำไรและตัวกันกระแทก
            </p>
          </div>
        )}

        {quickAddOpen && (
          <QuickAddModal
            initialTab="manual"
            initialData={quickAddInitialData}
            onClose={() => {
              setQuickAddOpen(false)
              setQuickAddInitialData(undefined)
            }}
            onSuccess={() => {
              setQuickAddOpen(false)
              setQuickAddInitialData(undefined)
              mutate()
            }}
          />
        )}

        <StockDetailModal
          isOpen={Boolean(selectedStock)}
          onClose={() => setSelectedStock(null)}
          symbol={selectedStock?.symbol ?? null}
          initialName={selectedStock?.name}
          market={selectedStock?.market}
        />
      </div>
    </AppShell>
  )
}
