'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import useSWR, { mutate } from 'swr'
import {
  X,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Loader2,
  DollarSign,
  Activity,
  Award,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
  ArrowRight,
  Briefcase,
  Layers,
  BarChart3,
  Percent,
  CandlestickChart as CandleIcon,
  LineChart as LineIcon,
  Compass,
  Target,
  ShieldCheck,
  Clock,
  RefreshCw,
  Building2,
  Newspaper,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Maximize2,
} from 'lucide-react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts'
import { StockLogo } from '@/components/StockLogo'
import { CandlestickChart } from '@/components/market-watch/CandlestickChart'
import { FullscreenChartModal } from '@/components/market-watch/FullscreenChartModal'
import { VolumeChartPanel } from '@/components/market-watch/VolumeChartPanel'
import { StockHistoricalStatsTab } from '@/components/market-watch/StockHistoricalStatsTab'
import { StockFourPillarsTab } from '@/components/market-watch/StockFourPillarsTab'
import { StockDailyAdvisorTab } from '@/components/market-watch/StockDailyAdvisorTab'

export interface StructuredAiData {
  summary?: string
  businessOverview?: string
  financialPerformance?: {
    revenue?: string
    eps?: string
    growth?: string
    fcf?: string
  }
  valuationAndDividend?: {
    pe?: string
    pb?: string
    evEbitda?: string
    dividendYield?: string
    payoutRatio?: string
  }
  strengths?: string[]
  risks?: string[]
  scenarioAnalysis?: {
    bull?: string
    base?: string
    bear?: string
  }
  latestNewsCatalyst?: string
}

function renderInsightInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)

  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={index} className="font-semibold text-slate-100">
          {part.slice(2, -2)}
        </strong>
      )
    }

    return <React.Fragment key={index}>{part}</React.Fragment>
  })
}

function AiInsightContent({ content }: { content: string }) {
  const lines = content.replace(/\r/g, '').split('\n')
  const blocks: Array<
    | { type: 'heading'; text: string; number?: string }
    | { type: 'bullet'; text: string }
    | { type: 'paragraph'; text: string }
  > = []
  let paragraph: string[] = []

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push({ type: 'paragraph', text: paragraph.join(' ') })
      paragraph = []
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line || line === '---') {
      flushParagraph()
      continue
    }

    const heading = line.match(/^#{1,3}\s+(.+)$/)
    const numberedHeading = line.match(/^(\d+)\.\s+(.+)$/)
    const bullet = line.match(/^(?:[-*•])\s+(.+)$/)

    if (heading) {
      flushParagraph()
      blocks.push({ type: 'heading', text: heading[1] })
    } else if (numberedHeading) {
      flushParagraph()
      blocks.push({ type: 'heading', number: numberedHeading[1], text: numberedHeading[2] })
    } else if (bullet) {
      flushParagraph()
      blocks.push({ type: 'bullet', text: bullet[1] })
    } else {
      paragraph.push(line)
    }
  }
  flushParagraph()

  return (
    <div className="space-y-4">
      {blocks.map((block, index) => {
        if (block.type === 'heading') {
          return (
            <div key={index} className="flex items-start gap-2 border-b border-white/[0.07] pb-2 pt-1">
              {block.number && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-md bg-amber-500/15 px-1 text-[10px] font-bold text-amber-300">
                  {block.number}
                </span>
              )}
              <h5 className="text-[13px] font-bold leading-5 text-white">
                {renderInsightInline(block.text)}
              </h5>
            </div>
          )
        }

        if (block.type === 'bullet') {
          return (
            <div key={index} className="flex items-start gap-2 pl-1 text-[12px] leading-6 text-slate-300">
              <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
              <p>{renderInsightInline(block.text)}</p>
            </div>
          )
        }

        return (
          <p key={index} className="text-[12px] leading-6 text-slate-300">
            {renderInsightInline(block.text)}
          </p>
        )
      })}
    </div>
  )
}

function AiStructuredDashboardView({
  data: aiData,
  stock,
  rawFallback,
}: {
  data: StructuredAiData | null
  stock: any
  rawFallback: string
}) {
  const isEnglishAnalysis = useMemo(() => {
    const textToCheck = (aiData?.summary || '') + (aiData?.businessOverview || '') + rawFallback
    return textToCheck.length > 50 && !/[ก-๙]/.test(textToCheck)
  }, [aiData, rawFallback])

  if (!aiData) {
    return (
      <div className="space-y-4">
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-center justify-between">
          <span>💡 มีระบบวิเคราะห์โครงสร้าง 8 มิติแล้ว กดปุ่ม "วิเคราะห์ใหม่" ด้านบนเพื่อรับผลวิเคราะห์ฉบับเต็ม</span>
        </div>
        <AiInsightContent content={rawFallback} />
      </div>
    )
  }

  const currencySymbol = stock?.currency === 'THB' ? '฿' : '$'
  const isPositive = (stock?.changePercent ?? 0) >= 0

  return (
    <div className="space-y-5 animate-fade-in text-slate-200">
      {/* Notice if previous analysis was English */}
      {isEnglishAnalysis && (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <span>ตรวจพบบทวิเคราะห์ภาษาอังกฤษเดิม — คลิกปุ่ม <strong>"วิเคราะห์ใหม่"</strong> ด้านบนเพื่อรับผลวิเคราะห์ฉบับภาษาไทย 100%</span>
          </span>
        </div>
      )}

      {/* 1. Header Overview Bar: Ticker — Full Name | Price | Change | Dividend */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-[#171B26] via-[#1A2030] to-[#171B26] border border-amber-500/30 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base sm:text-lg font-black text-white tracking-tight font-mono">
                {stock?.symbol}
              </span>
              <span className="text-slate-400">—</span>
              <span className="text-sm font-semibold text-slate-200 truncate">
                {stock?.name || stock?.symbol}
              </span>
            </div>
            {aiData.summary && (
              <p className="text-xs text-amber-200/90 mt-1.5 leading-relaxed font-medium">
                ✨ {aiData.summary}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3 sm:gap-4 shrink-0 flex-wrap bg-slate-900/60 px-3.5 py-2 rounded-xl border border-white/[0.06]">
            <div>
              <span className="text-[10px] text-slate-400 block font-medium">ราคาล่าสุด</span>
              <span className="text-sm font-extrabold text-white font-mono">
                {currencySymbol}{Number(stock?.currentPrice || 0).toLocaleString()}
              </span>
            </div>
            <div className="w-px h-6 bg-slate-800" />
            <div>
              <span className="text-[10px] text-slate-400 block font-medium">ผลตอบแทนวันนี้</span>
              <span className={`text-xs font-bold font-mono flex items-center gap-0.5 ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                {isPositive ? '+' : ''}{Number(stock?.changePercent || 0).toFixed(2)}%
              </span>
            </div>
            <div className="w-px h-6 bg-slate-800" />
            <div>
              <span className="text-[10px] text-slate-400 block font-medium">Dividend Yield</span>
              <span className="text-xs font-bold font-mono text-emerald-400">
                {stock?.dividendYield !== null && stock?.dividendYield !== undefined ? `${Number(stock.dividendYield).toFixed(2)}%` : '0.00%'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Business Overview (บริษัททำอะไร / รายได้มาจากไหน) */}
      {aiData.businessOverview && (
        <div className="p-4 sm:p-5 rounded-2xl bg-[#121620] border border-white/[0.08] shadow-sm space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
              <Building2 className="w-3.5 h-3.5" />
            </div>
            <h5 className="text-xs font-bold text-white uppercase tracking-wider">
              🏢 ภาพรวมธุรกิจ & ที่มาของรายได้ (Business & Revenue Engine)
            </h5>
          </div>
          <p className="text-xs sm:text-[13px] text-slate-200 leading-relaxed font-normal pl-8">
            {aiData.businessOverview}
          </p>
        </div>
      )}

      {/* 3. Financial Performance (ผลประกอบการ: Revenue, EPS, Growth, FCF) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <BarChart3 className="w-3.5 h-3.5" />
            </div>
            <h5 className="text-xs font-bold text-white uppercase tracking-wider">
              📊 ผลประกอบการสำคัญ (Financial Performance)
            </h5>
          </div>
          <span className="text-[11px] text-slate-400 font-normal hidden sm:inline">
            ตัวเลขงบการเงินล่าสุด & ทิศทางการเติบโต
          </span>
        </div>

        {/* 2-Column Responsive Grid with plenty of reading space */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {/* Revenue */}
          <div className="p-4 rounded-2xl bg-[#121620] border border-white/[0.08] hover:border-indigo-500/30 transition-all space-y-2">
            <div className="flex items-center justify-between gap-2 border-b border-white/[0.04] pb-2">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-indigo-400" />
                รายได้รวม (Revenue)
              </span>
              {stock?.revenue && (
                <span className="text-xs font-mono font-bold text-white px-2.5 py-0.5 rounded-lg bg-white/[0.06] border border-white/10">
                  {currencySymbol}{(stock.revenue / 1e9).toFixed(1)}B
                </span>
              )}
            </div>
            <p className="text-xs sm:text-[13px] text-slate-200 leading-relaxed font-normal">
              {aiData.financialPerformance?.revenue || '—'}
            </p>
          </div>

          {/* EPS */}
          <div className="p-4 rounded-2xl bg-[#121620] border border-white/[0.08] hover:border-emerald-500/30 transition-all space-y-2">
            <div className="flex items-center justify-between gap-2 border-b border-white/[0.04] pb-2">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-emerald-400" />
                กำไรต่อหุ้น (EPS)
              </span>
              {stock?.eps && (
                <span className="text-xs font-mono font-bold text-emerald-400 px-2.5 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  {currencySymbol}{stock.eps}
                </span>
              )}
            </div>
            <p className="text-xs sm:text-[13px] text-slate-200 leading-relaxed font-normal">
              {aiData.financialPerformance?.eps || '—'}
            </p>
          </div>

          {/* Growth YoY */}
          <div className="p-4 rounded-2xl bg-[#121620] border border-white/[0.08] hover:border-cyan-500/30 transition-all space-y-2">
            <div className="flex items-center justify-between gap-2 border-b border-white/[0.04] pb-2">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
                การเติบโตของรายได้ (Growth YoY)
              </span>
              {stock?.revenueGrowth && (
                <span className="text-xs font-mono font-bold text-cyan-300 px-2.5 py-0.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                  +{stock.revenueGrowth}%
                </span>
              )}
            </div>
            <p className="text-xs sm:text-[13px] text-slate-200 leading-relaxed font-normal">
              {aiData.financialPerformance?.growth || '—'}
            </p>
          </div>

          {/* Free Cash Flow */}
          <div className="p-4 rounded-2xl bg-[#121620] border border-white/[0.08] hover:border-teal-500/30 transition-all space-y-2">
            <div className="flex items-center justify-between gap-2 border-b border-white/[0.04] pb-2">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-teal-400" />
                กระแสเงินสดอิสระ (Free Cash Flow)
              </span>
              {stock?.freeCashflow && (
                <span className="text-xs font-mono font-bold text-teal-300 px-2.5 py-0.5 rounded-lg bg-teal-500/10 border border-teal-500/20">
                  {currencySymbol}{(stock.freeCashflow / 1e9).toFixed(1)}B
                </span>
              )}
            </div>
            <p className="text-xs sm:text-[13px] text-slate-200 leading-relaxed font-normal">
              {aiData.financialPerformance?.fcf || '—'}
            </p>
          </div>
        </div>
      </div>

      {/* 4. Valuation & Dividend (P/E, P/B, EV/EBITDA, Dividend Yield, Payout Ratio) */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#121620] border border-white/[0.08] space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <DollarSign className="w-3.5 h-3.5" />
            </div>
            <h5 className="text-xs font-bold text-white uppercase tracking-wider">
              💰 การประเมินมูลค่า & เงินปันผล (Valuation & Dividend Metrics)
            </h5>
          </div>
          <span className="text-[11px] text-slate-400 font-normal hidden sm:inline">
            เปรียบเทียบความถูกแพงและผลตอบแทน
          </span>
        </div>

        {/* Top 5 Metric Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          <div className="p-3 rounded-xl bg-slate-900/80 border border-white/[0.06] text-center">
            <span className="text-[10px] text-slate-400 block font-medium">P/E Ratio</span>
            <span className="text-sm sm:text-base font-bold text-white font-mono mt-0.5 block">
              {stock?.pe ? `${stock.pe}x` : 'N/A'}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-slate-900/80 border border-white/[0.06] text-center">
            <span className="text-[10px] text-slate-400 block font-medium">P/B Ratio</span>
            <span className="text-sm sm:text-base font-bold text-white font-mono mt-0.5 block">
              {stock?.pb ? `${stock.pb}x` : 'N/A'}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-slate-900/80 border border-white/[0.06] text-center">
            <span className="text-[10px] text-slate-400 block font-medium">EV/EBITDA</span>
            <span className="text-sm sm:text-base font-bold text-white font-mono mt-0.5 block">
              {stock?.evEbitda ? `${stock.evEbitda}x` : 'N/A'}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-slate-900/80 border border-white/[0.06] text-center">
            <span className="text-[10px] text-slate-400 block font-medium">Dividend Yield</span>
            <span className="text-sm sm:text-base font-bold text-emerald-400 font-mono mt-0.5 block">
              {stock?.dividendYield !== null && stock?.dividendYield !== undefined ? `${stock.dividendYield}%` : '0.00%'}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-slate-900/80 border border-white/[0.06] text-center col-span-2 sm:col-span-1">
            <span className="text-[10px] text-slate-400 block font-medium">Payout Ratio</span>
            <span className="text-sm sm:text-base font-bold text-indigo-300 font-mono mt-0.5 block">
              {stock?.payoutRatio ? `${stock.payoutRatio}%` : 'N/A'}
            </span>
          </div>
        </div>

        {/* Qualitative AI Valuation & Dividend Breakdown - No Truncation */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          {/* Card 1: Valuation analysis */}
          <div className="p-3.5 rounded-xl bg-[#161B26] border border-white/[0.06] space-y-2">
            <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
              🎯 ความถูกแพงของราคาหุ้น (Valuation Assessment)
            </span>
            <div className="space-y-1.5 text-xs sm:text-[13px] text-slate-200 leading-relaxed font-normal">
              {aiData.valuationAndDividend?.pe && (
                <p>• <strong className="text-white">P/E Context:</strong> {aiData.valuationAndDividend.pe}</p>
              )}
              {aiData.valuationAndDividend?.pb && (
                <p>• <strong className="text-white">P/B Context:</strong> {aiData.valuationAndDividend.pb}</p>
              )}
              {aiData.valuationAndDividend?.evEbitda && (
                <p>• <strong className="text-white">EV/EBITDA:</strong> {aiData.valuationAndDividend.evEbitda}</p>
              )}
              {!aiData.valuationAndDividend?.pe && !aiData.valuationAndDividend?.pb && !aiData.valuationAndDividend?.evEbitda && (
                <p className="text-slate-400">ระดับมูลค่าอยู่ในเกณฑ์ปกติเมื่อเทียบกับหุ้นกลุ่มเดียวกัน</p>
              )}
            </div>
          </div>

          {/* Card 2: Dividend analysis */}
          <div className="p-3.5 rounded-xl bg-[#161B26] border border-white/[0.06] space-y-2">
            <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
              💵 คุณภาพ & ความปลอดภัยเงินปันผล (Dividend Safety)
            </span>
            <div className="space-y-1.5 text-xs sm:text-[13px] text-slate-200 leading-relaxed font-normal">
              {aiData.valuationAndDividend?.dividendYield && (
                <p>• <strong className="text-white">Yield:</strong> {aiData.valuationAndDividend.dividendYield}</p>
              )}
              {aiData.valuationAndDividend?.payoutRatio && (
                <p>• <strong className="text-white">Payout:</strong> {aiData.valuationAndDividend.payoutRatio}</p>
              )}
              {!aiData.valuationAndDividend?.dividendYield && !aiData.valuationAndDividend?.payoutRatio && (
                <p className="text-slate-400">ไม่มีนโยบายการจ่ายเงินปันผล หรือเน้นการนำกำไรไปลงทุนต่อเพื่อการเติบโต (Growth Reinvestment)</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 5. จุดแข็ง vs ความเสี่ยง (Side-by-side 2 Columns) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left: Strengths */}
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-emerald-950/20 to-[#121620] border border-emerald-500/30 space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
              🚀
            </span>
            <h5 className="text-xs font-bold text-white uppercase tracking-wider">
              จุดแข็ง & ปัจจัยขับเคลื่อนการเติบโต (Moats)
            </h5>
          </div>
          <ul className="space-y-2 pl-1">
            {(aiData.strengths || []).map((s, idx) => (
              <li key={idx} className="flex items-start gap-2.5 text-xs sm:text-[13px] text-slate-200 leading-relaxed font-normal">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 mt-2" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Right: Risks */}
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-rose-950/20 to-[#121620] border border-rose-500/30 space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold text-xs">
              ⚠️
            </span>
            <h5 className="text-xs font-bold text-white uppercase tracking-wider">
              ความเสี่ยง & ปัจจัยที่ต้องจับตา (Key Risks)
            </h5>
          </div>
          <ul className="space-y-2 pl-1">
            {(aiData.risks || []).map((r, idx) => (
              <li key={idx} className="flex items-start gap-2.5 text-xs sm:text-[13px] text-slate-200 leading-relaxed font-normal">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0 mt-2" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* 6. Scenario Analysis (Bull / Base / Bear) */}
      {aiData.scenarioAnalysis && (
        <div className="p-4 sm:p-5 rounded-2xl bg-[#121620] border border-white/[0.08] space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm">🔮</span>
            <h5 className="text-xs font-bold text-white uppercase tracking-wider">
              การวิเคราะห์สถานการณ์ (Scenario Analysis)
            </h5>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Bull Case */}
            <div className="p-4 rounded-xl bg-emerald-500/[0.07] border border-emerald-500/25 space-y-2">
              <div className="flex items-center gap-1.5">
                <span className="text-sm">🐂</span>
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wide">
                  Bull Case (กรณีดีสุด)
                </span>
              </div>
              <p className="text-xs sm:text-[13px] text-slate-200 leading-relaxed font-normal">
                {aiData.scenarioAnalysis.bull || 'ปัจจัยเร่งผลักดันราคาทำจุดสูงสุดใหม่'}
              </p>
            </div>

            {/* Base Case */}
            <div className="p-4 rounded-xl bg-indigo-500/[0.07] border border-indigo-500/25 space-y-2">
              <div className="flex items-center gap-1.5">
                <span className="text-sm">⚖️</span>
                <span className="text-xs font-bold text-indigo-300 uppercase tracking-wide">
                  Base Case (กรณีพื้นฐาน)
                </span>
              </div>
              <p className="text-xs sm:text-[13px] text-slate-200 leading-relaxed font-normal">
                {aiData.scenarioAnalysis.base || 'เติบโตตามเป้าหมายของบริษัทและค่าเฉลี่ยอุตสาหกรรม'}
              </p>
            </div>

            {/* Bear Case */}
            <div className="p-4 rounded-xl bg-rose-500/[0.07] border border-rose-500/25 space-y-2">
              <div className="flex items-center gap-1.5">
                <span className="text-sm">🐻</span>
                <span className="text-xs font-bold text-rose-400 uppercase tracking-wide">
                  Bear Case (กรณีแย่สุด)
                </span>
              </div>
              <p className="text-xs sm:text-[13px] text-slate-200 leading-relaxed font-normal">
                {aiData.scenarioAnalysis.bear || 'ปัจจัยกดดันด้านการแข่งขันหรือเศรษฐกิจชะลอตัว'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 7. Recent Catalysts & News Highlights */}
      {aiData.latestNewsCatalyst && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-[#121620] to-[#161C2A] border border-indigo-500/25 flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0 mt-0.5">
            <Newspaper className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-bold text-white block uppercase tracking-wide">
              📰 ข่าวสำคัญ & ปัจจัยเร่งล่าสุด (Catalysts to Watch)
            </span>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              {aiData.latestNewsCatalyst}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

interface StockDetailModalProps {
  isOpen: boolean
  onClose: () => void
  symbol: string | null
  initialName?: string
  market?: string
}

type TimeRange = '1d' | '1w' | '1m' | '1y'

export function StockDetailModal({
  isOpen,
  onClose,
  symbol,
  initialName,
  market = 'US',
}: StockDetailModalProps) {
  const [range, setRange] = useState<TimeRange>('1m')
  const [activeTab, setActiveTab] = useState<'chart' | 'four_pillars' | 'stats' | 'daily_ai'>('chart')
  const [chartType, setChartType] = useState<'area' | 'candle'>('area')
  const [showSR, setShowSR] = useState(true)
  const [showSMA, setShowSMA] = useState(true)
  const [showEMA200, setShowEMA200] = useState(false)
  const [showVolume, setShowVolume] = useState(false)
  const [isFullscreenChartOpen, setIsFullscreenChartOpen] = useState(false)
  const [isAiLoading, setIsAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Lock background body scroll while modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // Reset state when modal opens or symbol changes
  useEffect(() => {
    if (isOpen) {
      setRange('1m')
      setActiveTab('chart')
      setAiError(null)
      setIsAiLoading(false)
    }
  }, [isOpen, symbol])

  // Fetch persistent latest AI Insight for this symbol from database
  const insightKey = isOpen && symbol
    ? `/api/market-watch/ai-insight?symbol=${encodeURIComponent(symbol)}&market=${encodeURIComponent(market)}`
    : null
  const { data: cachedAiData } = useSWR(
    insightKey,
    { revalidateOnFocus: false }
  )

  const activeInsight = cachedAiData?.insight
  const activeStructured = cachedAiData?.structuredInsight
  const activeModelUsed = cachedAiData?.modelUsed
  const activeUpdatedAt = cachedAiData?.updatedAt

  // ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isFullscreenChartOpen) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isFullscreenChartOpen, onClose])

  // Fetch Stock Detail Data with SWR
  const { data, isLoading, error } = useSWR(
    isOpen && symbol
      ? `/api/market-watch/stock-detail?symbol=${encodeURIComponent(
          symbol
        )}&market=${encodeURIComponent(market)}&range=${range}`
      : null,
    {
      revalidateOnFocus: false,
      dedupingInterval: 120000, // 2 minutes deduping to avoid excessive API requests
    }
  )

  // Synchronize live price & daily change back to Watchlist & Market Watch cards so they match 100%
  useEffect(() => {
    if (!data?.symbol || typeof data?.currentPrice !== 'number' || data.currentPrice <= 0) return
    const targetSym = String(data.symbol).trim().toUpperCase()
    const livePrice = data.currentPrice
    const liveChange = data.todayChange ?? data.change ?? 0
    const liveChangePct = data.todayChangePercent ?? data.changePercent ?? 0
    const liveHigh = data.dayHigh
    const liveLow = data.dayLow
    const livePrev = data.previousClose

    mutate(
      '/api/watchlist',
      (current: any) => {
        if (!current || !Array.isArray(current.items)) return current
        return {
          ...current,
          items: current.items.map((item: any) => {
            if (String(item.symbol || '').trim().toUpperCase() !== targetSym) return item
            return {
              ...item,
              quote: {
                ...(item.quote || {}),
                symbol: targetSym,
                price: livePrice,
                change: liveChange,
                changePercent: liveChangePct,
                high: liveHigh ?? item.quote?.high,
                low: liveLow ?? item.quote?.low,
                previousClose: livePrev ?? item.quote?.previousClose,
              },
            }
          }),
        }
      },
      false
    )

    mutate(
      '/api/market-watch',
      (current: any) => {
        if (!current) return current
        const updateList = (list: any[]) =>
          Array.isArray(list)
            ? list.map((q: any) =>
                String(q?.symbol || '').trim().toUpperCase() === targetSym
                  ? {
                      ...q,
                      price: livePrice,
                      change: liveChange,
                      changePercent: liveChangePct,
                      high: liveHigh ?? q.high,
                      low: liveLow ?? q.low,
                      previousClose: livePrev ?? q.previousClose,
                    }
                  : q
              )
            : list
        return {
          ...current,
          crypto: updateList(current.crypto),
          usStocks: updateList(current.usStocks),
          thStocks: updateList(current.thStocks),
          fxAndCommodities: updateList(current.fxAndCommodities),
        }
      },
      false
    )
  }, [
    data?.symbol,
    data?.currentPrice,
    data?.todayChange,
    data?.todayChangePercent,
    data?.change,
    data?.changePercent,
    data?.dayHigh,
    data?.dayLow,
    data?.previousClose,
  ])

  // Price points for Recharts
  const chartPoints = data?.chartPoints ?? []
  const hasChartData = chartPoints.length > 1

  // Determine trend of selected range
  const isRangePositive = useMemo(() => {
    if (range === '1d') {
      return (data?.todayChangePercent ?? data?.changePercent ?? 0) >= 0
    }
    if (chartPoints.length < 2) return (data?.rangeChangePercent ?? data?.changePercent ?? 0) >= 0
    const first = chartPoints[0].price
    const last = chartPoints[chartPoints.length - 1].price
    return last >= first
  }, [range, chartPoints, data?.todayChangePercent, data?.rangeChangePercent, data?.changePercent])

  // Calculate range % change
  const rangeChangePercent = useMemo(() => {
    if (range === '1d') {
      return data?.todayChangePercent ?? data?.changePercent ?? 0
    }
    if (chartPoints.length < 2) return data?.rangeChangePercent ?? data?.changePercent ?? 0
    const first = chartPoints[0].price
    const last = chartPoints[chartPoints.length - 1].price
    return first > 0 ? ((last - first) / first) * 100 : 0
  }, [range, chartPoints, data?.todayChangePercent, data?.rangeChangePercent, data?.changePercent])

  // Min and Max prices for chart domain (auto-fits S/R and SMA levels so lines don't get clipped)
  const { minPrice, maxPrice } = useMemo(() => {
    if (chartPoints.length === 0) return { minPrice: 0, maxPrice: 100 }
    let min = chartPoints[0].price
    let max = chartPoints[0].price
    for (const p of chartPoints) {
      if (p.price < min) min = p.price
      if (p.price > max) max = p.price
      if (showSMA) {
        if (p.sma20 && p.sma20 < min) min = p.sma20
        if (p.sma20 && p.sma20 > max) max = p.sma20
        if (p.sma50 && p.sma50 < min) min = p.sma50
        if (p.sma50 && p.sma50 > max) max = p.sma50
      }
      if (showEMA200) {
        if (p.ema200 && p.ema200 < min) min = p.ema200
        if (p.ema200 && p.ema200 > max) max = p.ema200
      }
    }

    // Auto-fit Support and Resistance levels when enabled so R1, R2, S1, S2 are NEVER clipped off!
    if (showSR && data?.technicalLevels) {
      const { r1, r2, s1, s2 } = data.technicalLevels
      if (r1 && r1 < max * 1.3) max = Math.max(max, r1)
      if (r2 && r2 < max * 1.4) max = Math.max(max, r2)
      if (s1 && s1 > min * 0.7) min = Math.min(min, s1)
      if (s2 && s2 > min * 0.6) min = Math.min(min, s2)
    }

    const padding = (max - min) * 0.08 || min * 0.02
    return {
      minPrice: Math.max(0, Number((min - padding).toFixed(2))),
      maxPrice: Number((max + padding).toFixed(2)),
    }
  }, [chartPoints, showSR, showSMA, data?.technicalLevels])

  // 52-Week Range Percentage calculation
  const fiftyTwoWeekPct = useMemo(() => {
    const cur = data?.currentPrice
    const low = data?.fiftyTwoWeekLow
    const high = data?.fiftyTwoWeekHigh
    if (!cur || !low || !high || high <= low) return null
    const pct = ((cur - low) / (high - low)) * 100
    return Math.min(100, Math.max(0, pct))
  }, [data])

  // Handle Gemini AI Analysis
  const handleGenerateAiInsight = async () => {
    if (!data) return
    setIsAiLoading(true)
    setAiError(null)

    try {
      const res = await fetch('/api/market-watch/ai-insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          market,
          forceRefresh: Boolean(activeInsight),
        }),
      })

      const resData = await res.json()
      if (!res.ok) {
        throw new Error(resData.error || 'ไม่สามารถวิเคราะห์ด้วย AI ได้')
      }

      if (insightKey) await mutate(insightKey, resData, false)
    } catch (err: any) {
      setAiError(err?.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ AI')
    } finally {
      setIsAiLoading(false)
    }
  }

  if (!isOpen || !symbol || !mounted) return null

  const currencySymbol = data?.currency === 'THB' ? '฿' : '$'
  const todayPct = data?.todayChangePercent ?? data?.changePercent ?? 0
  const isPositive = todayPct >= 0

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/85 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog (Center card on all screens with smooth entrance) */}
      <div className="relative w-full max-w-4xl bg-[#0F1218] border border-white/[0.12] rounded-2xl sm:rounded-3xl shadow-2xl shadow-black/95 z-10 flex flex-col max-h-[90vh] sm:max-h-[88vh] overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Glow Accent */}
        <div
          className={`absolute top-0 right-1/4 -translate-y-1/2 w-80 h-36 rounded-full blur-3xl pointer-events-none ${
            isRangePositive ? 'bg-emerald-500/10' : 'bg-rose-500/10'
          }`}
        />

        {/* ============================================================ */}
        {/* MODAL HEADER */}
        {/* ============================================================ */}
        <div className="p-5 sm:p-6 border-b border-white/[0.08] flex items-start justify-between gap-4 bg-[#12151C]/90 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <StockLogo ticker={symbol || ''} name={data?.name || initialName} size={44} />
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl sm:text-2xl font-extrabold text-white font-mono tracking-tight">
                  {symbol}
                </span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-bold">
                  {market === 'TH' ? 'TH' : symbol === 'BTC' || symbol === 'ETH' ? 'CRYPTO' : symbol === 'GOLD' ? 'GOLD' : 'US'}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 truncate max-w-[280px] sm:max-w-md">
                {data?.name || initialName || symbol}
              </p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {data?.userPosition && (
                  <div className="flex items-center gap-2 text-xs text-slate-300 flex-wrap">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 font-semibold text-[11px]">
                      <Briefcase className="w-3 h-3" />
                      ถือในพอร์ต {data.userPosition.shares} หุ้น
                    </span>
                    <span className="text-slate-400 font-mono text-[11px]">
                      ต้นทุน {currencySymbol}{data.userPosition.avgCost}
                    </span>
                    <span className="text-slate-600 hidden sm:inline">•</span>
                    <span
                      className={`font-mono font-bold text-[11px] ${
                        data.userPosition.unrealizedGain >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {data.userPosition.unrealizedGain >= 0 ? 'กำไร +' : 'ขาดทุน -'}
                      {currencySymbol}
                      {Math.abs(data.userPosition.unrealizedGain).toLocaleString()} (
                      {data.userPosition.unrealizedGainPercent >= 0 ? '+' : ''}
                      {data.userPosition.unrealizedGainPercent}%)
                    </span>
                  </div>
                )}
                {data?.upcomingEarnings?.hasUpcomingDate && (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 font-medium text-[11px]">
                    <Calendar className="w-3 h-3 text-amber-400" />
                    <span>งบออก {data.upcomingEarnings.countdownLabel}</span>
                    <span className="text-slate-400 text-[10px] hidden sm:inline">
                      ({data.upcomingEarnings.earningsDateThai} • {data.upcomingEarnings.releaseTimingLabel})
                    </span>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <div className="text-xl sm:text-2xl font-bold text-white font-mono tabular-nums">
                {data?.currentPrice !== undefined ? (
                  <>
                    {currencySymbol}
                    {Number(data.currentPrice).toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: data.currentPrice < 1 ? 4 : 2,
                    })}
                  </>
                ) : (
                  <span className="text-slate-500 text-sm">--</span>
                )}
              </div>
              <span
                className={`inline-flex items-center gap-0.5 text-xs font-mono font-bold mt-0.5 ${
                  isPositive ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {isPositive ? (
                  <ArrowUpRight className="w-3.5 h-3.5" />
                ) : (
                  <ArrowDownRight className="w-3.5 h-3.5" />
                )}
                {isPositive ? '+' : ''}
                {Number(todayPct).toFixed(2)}% วันนี้
              </span>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation: All 4 tabs always visible without horizontal clipping */}
        <div className="px-4 sm:px-6 py-2.5 border-b border-white/[0.08] bg-[#12151C]/90 shrink-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab('chart')}
              className={`min-h-10 px-2.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border ${
                activeTab === 'chart'
                  ? 'bg-indigo-600/20 text-white border-indigo-500/45 shadow-sm'
                  : 'bg-white/[0.02] text-slate-400 border-transparent hover:text-slate-200 hover:bg-white/[0.05]'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span className="truncate">กราฟ &amp; เทคนิคอล</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('four_pillars')}
              className={`min-h-10 px-2.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border ${
                activeTab === 'four_pillars'
                  ? 'bg-amber-500/15 text-white border-amber-500/45 shadow-sm'
                  : 'bg-white/[0.02] text-slate-400 border-transparent hover:text-slate-200 hover:bg-white/[0.05]'
              }`}
            >
              <Target className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="truncate">วิเคราะห์ 4 เสาหลัก</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('stats')}
              className={`min-h-10 px-2.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border ${
                activeTab === 'stats'
                  ? 'bg-emerald-500/15 text-white border-emerald-500/45 shadow-sm'
                  : 'bg-white/[0.02] text-slate-400 border-transparent hover:text-slate-200 hover:bg-white/[0.05]'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="truncate">สถิติ &amp; ปันผล</span>
              {data?.historicalStats?.dividends?.hasDividends && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold shrink-0">
                  {data.historicalStats.dividends.frequency === 'Quarterly'
                    ? '4x'
                    : data.historicalStats.dividends.frequency === 'Semi-Annual'
                    ? '2x'
                    : data.historicalStats.dividends.frequency === 'Monthly'
                    ? '12x'
                    : 'DIV'}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('daily_ai')}
              className={`min-h-10 px-2.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border ${
                activeTab === 'daily_ai'
                  ? 'bg-[#6D5EF7]/25 text-white border-[#6D5EF7]/55 shadow-sm'
                  : 'bg-white/[0.02] text-slate-400 border-transparent hover:text-slate-200 hover:bg-white/[0.05]'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span className="truncate">AI ความเสี่ยงรายวัน</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#6D5EF7]/25 text-indigo-200 border border-[#6D5EF7]/40 shrink-0">
                รายวัน
              </span>
            </button>
          </div>
        </div>

        {/* ============================================================ */}
        {/* MODAL BODY (SCROLLABLE) */}
        {/* ============================================================ */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {isLoading && !data ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-500 text-xs">
              <Loader2 className="w-7 h-7 animate-spin text-indigo-400" />
              <span>กำลังดึงข้อมูลกราฟและสถิติการเงิน...</span>
            </div>
          ) : error ? (
            <div className="py-12 p-6 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-center text-rose-300 text-xs">
              ไม่สามารถดึงข้อมูลรายละเอียดของ {symbol} ได้ในขณะนี้
            </div>
          ) : activeTab === 'four_pillars' ? (
            <StockFourPillarsTab
              symbol={symbol}
              name={data?.name || initialName || symbol}
              currencySymbol={currencySymbol}
              currentPrice={data?.currentPrice ?? 0}
              market={market}
              pe={data?.pe}
              forwardPe={data?.forwardPe}
              pb={data?.pb}
              dividendYield={data?.dividendYield}
              payoutRatio={data?.payoutRatio}
              revenue={data?.revenue}
              revenueGrowth={data?.revenueGrowth}
              eps={data?.eps}
              freeCashflow={data?.freeCashflow}
              marketCap={data?.marketCap}
              roe={data?.roe}
              debtToEquity={data?.debtToEquity}
              structuredAi={activeStructured}
              isAiLoading={isAiLoading}
              onGenerateAi={handleGenerateAiInsight}
            />
          ) : activeTab === 'stats' ? (
            <StockHistoricalStatsTab
              symbol={symbol}
              name={data?.name || initialName || symbol}
              currencySymbol={currencySymbol}
              currentPrice={data?.currentPrice ?? 0}
              stats={data?.historicalStats}
              userPosition={data?.userPosition}
              payoutRatio={data?.payoutRatio}
            />
          ) : activeTab === 'daily_ai' ? (
            <StockDailyAdvisorTab
              symbol={symbol}
              market={market}
              name={data?.name || initialName || symbol}
            />
          ) : (
            <>
              {/* 1. CHART & TIMEFRAME & TECHNICAL CONTROLS */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#141822] border border-white/[0.08] shadow-inner space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-indigo-400" />
                    <span className="text-xs font-semibold text-slate-300">
                      แนวโน้มราคาช่วง {range.toUpperCase()}
                    </span>
                    <span
                      className={`text-[11px] font-mono font-bold ml-1 ${
                        isRangePositive ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      ({isRangePositive ? '+' : ''}
                      {rangeChangePercent.toFixed(2)}%)
                    </span>
                  </div>

                  {/* Right side: Chart Type + Technical Toggles + Timeframe */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {/* Mode: Area vs Candlestick */}
                    <div className="flex items-center bg-[#0F1218] p-0.5 rounded-xl border border-white/[0.08]">
                      <button
                        type="button"
                        onClick={() => setChartType('area')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition-all ${
                          chartType === 'area'
                            ? 'bg-indigo-600 text-white shadow-sm font-bold'
                            : 'text-slate-400 hover:text-white'
                        }`}
                        title="กราฟเส้น Area"
                      >
                        <LineIcon className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">เส้น</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setChartType('candle')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition-all ${
                          chartType === 'candle'
                            ? 'bg-indigo-600 text-white shadow-sm font-bold'
                            : 'text-slate-400 hover:text-white'
                        }`}
                        title="กราฟแท่งเทียน Candlestick"
                      >
                        <CandleIcon className="w-3.5 h-3.5" />
                        <span>แท่งเทียน</span>
                      </button>
                    </div>

                    {/* Timeframe Chips */}
                    <div className="flex items-center gap-0.5 bg-[#0F1218] p-0.5 rounded-xl border border-white/[0.06]">
                      {(['1d', '1w', '1m', '1y'] as TimeRange[]).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setRange(t)}
                          className={`px-2 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                            range === t
                              ? 'bg-indigo-600 text-white shadow-sm'
                              : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
                          }`}
                        >
                          {t.toUpperCase()}
                        </button>
                      ))}
                    </div>

                    {/* Fullscreen Expand Button */}
                    <button
                      type="button"
                      onClick={() => setIsFullscreenChartOpen(true)}
                      className="px-2.5 py-1 rounded-xl bg-indigo-500/15 hover:bg-indigo-600/30 text-indigo-300 hover:text-white border border-indigo-500/30 hover:border-indigo-400/60 transition-all flex items-center gap-1.5 text-xs font-semibold cursor-pointer shadow-sm group active:scale-95 shrink-0"
                      title="เปิดกราฟขนาดใหญ่เต็มจอ (Fullscreen Pro Modal)"
                    >
                      <Maximize2 className="w-3.5 h-3.5 text-indigo-400 group-hover:scale-110 transition-transform" />
                      <span className="font-sans">เต็มจอ</span>
                    </button>
                  </div>
                </div>

                {/* Technical Indicator Filter Toggles */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-white/[0.04] text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setShowSR(!showSR)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all flex items-center gap-1.5 ${
                        showSR
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                          : 'bg-white/[0.03] text-slate-500 border-white/[0.06] hover:text-slate-300'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${showSR ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                      <span>แนวรับ-แนวต้าน (S/R)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowSMA(!showSMA)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all flex items-center gap-1.5 ${
                        showSMA
                          ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                          : 'bg-white/[0.03] text-slate-500 border-white/[0.06] hover:text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${showSMA ? 'bg-amber-400' : 'bg-slate-600'}`} />
                        <span>SMA 20</span>
                        <span className="text-slate-500 font-light">/</span>
                        <span className={`w-1.5 h-1.5 rounded-full ${showSMA ? 'bg-cyan-400' : 'bg-slate-600'}`} />
                        <span>50</span>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowEMA200(!showEMA200)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all flex items-center gap-1.5 ${
                        showEMA200
                          ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                          : 'bg-white/[0.03] text-slate-500 border-white/[0.06] hover:text-slate-300'
                      }`}
                      title="แสดง/ซ่อน เส้นค่าเฉลี่ย EMA 200 วัน (Trend Line หลัก แบ่งกระทิง/หมี)"
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${showEMA200 ? 'bg-purple-400' : 'bg-slate-600'}`} />
                      <span>EMA 200</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowVolume(!showVolume)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all flex items-center gap-1.5 ${
                        showVolume
                          ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                          : 'bg-white/[0.03] text-slate-500 border-white/[0.06] hover:text-slate-300'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${showVolume ? 'bg-indigo-400' : 'bg-slate-600'}`} />
                      <span>Volume</span>
                    </button>
                  </div>

                  {/* RSI (14) Live Meter Badge */}
                  {data?.technicalLevels?.rsi !== undefined && data.technicalLevels.rsi !== null && (
                    <div
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-medium border flex items-center gap-1.5 ${
                        data.technicalLevels.rsiStatus === 'oversold'
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                          : data.technicalLevels.rsiStatus === 'overbought'
                          ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                          : 'bg-white/[0.04] text-slate-300 border-white/[0.08]'
                      }`}
                      title={`RSI (14-Period): ${data.technicalLevels.rsi} (${
                        data.technicalLevels.rsiStatus === 'oversold'
                          ? 'ขายมากเกินไป < 30 มีโอกาสเด้งกลับทางเทคนิค'
                          : data.technicalLevels.rsiStatus === 'overbought'
                          ? 'ซื้อมากเกินไป > 70 ระวังแรงขายทำกำไร'
                          : 'อยู่ในกรอบปกติ 30-70'
                      })`}
                    >
                      <Activity className="w-3.5 h-3.5 text-sky-400" />
                      <span>RSI: <strong>{data.technicalLevels.rsi}</strong></span>
                      <span className="text-[10px] font-sans opacity-90 hidden sm:inline">
                        {data.technicalLevels.rsiStatus === 'oversold'
                          ? '• Oversold 🟢'
                          : data.technicalLevels.rsiStatus === 'overbought'
                          ? '• Overbought 🔴'
                          : '• ปกติ ⚪'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Chart Viewport: Candlestick or Area */}
                <div className="w-full pt-2">
                  {hasChartData ? (
                    chartType === 'candle' ? (
                      <CandlestickChart
                        data={chartPoints}
                        currencySymbol={currencySymbol}
                        showSR={showSR}
                        showSMA={showSMA}
                        showEMA200={showEMA200}
                        showVolume={showVolume}
                        technicalLevels={data?.technicalLevels}
                        height={260}
                        onToggleFullscreen={() => setIsFullscreenChartOpen(true)}
                      />
                    ) : (
                      <>
                        <div className="w-full h-56 sm:h-64 relative">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={chartPoints}>
                            <defs>
                              <linearGradient
                                id="chartGradient"
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="1"
                              >
                                <stop
                                  offset="5%"
                                  stopColor={isRangePositive ? '#10B981' : '#F43F5E'}
                                  stopOpacity={0.35}
                                />
                                <stop
                                  offset="95%"
                                  stopColor={isRangePositive ? '#10B981' : '#F43F5E'}
                                  stopOpacity={0.0}
                                />
                              </linearGradient>
                            </defs>
                            <XAxis
                              dataKey="time"
                              stroke="#64748B"
                              fontSize={10}
                              tickLine={false}
                              axisLine={false}
                              minTickGap={25}
                            />
                            <YAxis
                              domain={[minPrice, maxPrice]}
                              stroke="#64748B"
                              fontSize={10}
                              tickLine={false}
                              axisLine={false}
                              orientation="right"
                              tickFormatter={(val) => `${currencySymbol}${val}`}
                            />
                            <Tooltip
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  const p = payload[0].payload
                                  return (
                                    <div className="p-3 rounded-xl bg-[#12151C] border border-white/[0.12] shadow-xl text-xs font-mono space-y-1">
                                      <span className="text-slate-400 block text-[10px]">{p.time}</span>
                                      <div className="flex items-center justify-between gap-4">
                                        <span className="text-slate-300">ราคา:</span>
                                        <span className="font-bold text-white">{currencySymbol}{Number(p.price).toFixed(2)}</span>
                                      </div>
                                      {p.sma20 && (
                                        <div className="flex items-center justify-between gap-4 text-amber-400 text-[11px]">
                                          <span>SMA 20:</span>
                                          <span>{currencySymbol}{Number(p.sma20).toFixed(2)}</span>
                                        </div>
                                      )}
                                      {p.sma50 && (
                                        <div className="flex items-center justify-between gap-4 text-cyan-400 text-[11px]">
                                          <span>SMA 50:</span>
                                          <span>{currencySymbol}{Number(p.sma50).toFixed(2)}</span>
                                        </div>
                                      )}
                                      {p.ema200 && (
                                        <div className="flex items-center justify-between gap-4 text-purple-400 text-[11px]">
                                          <span>EMA 200:</span>
                                          <span>{currencySymbol}{Number(p.ema200).toFixed(2)}</span>
                                        </div>
                                      )}
                                      {p.rsi !== undefined && p.rsi !== null && (
                                        <div className="flex items-center justify-between gap-4 text-sky-400 text-[11px]">
                                          <span>RSI (14):</span>
                                          <span>{p.rsi}</span>
                                        </div>
                                      )}
                                    </div>
                                  )
                                }
                                return null
                              }}
                            />
                            {/* Support and Resistance Reference Lines */}
                            {showSR && data?.technicalLevels && (
                              <>
                                <ReferenceLine y={data.technicalLevels.r2} stroke="#F43F5E" strokeDasharray="4 4" label={{ value: `R2: ${data.technicalLevels.r2}`, fill: '#F43F5E', fontSize: 9, position: 'insideTopRight' }} />
                                <ReferenceLine y={data.technicalLevels.r1} stroke="#FB7185" strokeDasharray="3 3" label={{ value: `R1: ${data.technicalLevels.r1}`, fill: '#FB7185', fontSize: 9, position: 'insideTopRight' }} />
                                <ReferenceLine y={data.technicalLevels.pivot} stroke="#94A3B8" strokeDasharray="2 2" label={{ value: `P: ${data.technicalLevels.pivot}`, fill: '#94A3B8', fontSize: 8.5, position: 'insideTopRight' }} />
                                <ReferenceLine y={data.technicalLevels.s1} stroke="#34D399" strokeDasharray="3 3" label={{ value: `S1: ${data.technicalLevels.s1}`, fill: '#34D399', fontSize: 9, position: 'insideBottomRight' }} />
                                <ReferenceLine y={data.technicalLevels.s2} stroke="#10B981" strokeDasharray="4 4" label={{ value: `S2: ${data.technicalLevels.s2}`, fill: '#10B981', fontSize: 9, position: 'insideBottomRight' }} />
                              </>
                            )}
                            {/* Moving Average SMA Lines (Full span, smooth) */}
                            {showSMA && (
                              <>
                                <Line
                                  type="monotone"
                                  dataKey="sma20"
                                  name="SMA 20"
                                  stroke="#F59E0B"
                                  strokeWidth={1.75}
                                  dot={false}
                                  connectNulls={true}
                                  isAnimationActive={false}
                                />
                                <Line
                                  type="monotone"
                                  dataKey="sma50"
                                  name="SMA 50"
                                  stroke="#06B6D4"
                                  strokeWidth={1.75}
                                  dot={false}
                                  connectNulls={true}
                                  isAnimationActive={false}
                                />
                              </>
                            )}
                            {showEMA200 && (
                              <Line
                                type="monotone"
                                dataKey="ema200"
                                name="EMA 200"
                                stroke="#A855F7"
                                strokeWidth={1.75}
                                strokeDasharray="4 3"
                                dot={false}
                                connectNulls={true}
                                isAnimationActive={false}
                              />
                            )}
                            <Area
                              type="monotone"
                              dataKey="price"
                              stroke={isRangePositive ? '#10B981' : '#F43F5E'}
                              strokeWidth={2}
                              fillOpacity={1}
                              fill="url(#chartGradient)"
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                      {showVolume && (
                        <div className="w-full pt-2.5">
                          <VolumeChartPanel
                            data={chartPoints}
                            height={90}
                            showSummaryBar={true}
                            isCompact={true}
                          />
                        </div>
                      )}
                    </>
                  )
                  ) : (
                    <div className="h-48 flex items-center justify-center text-slate-500 text-xs">
                      กำลังรวบรวมข้อมูลราคาสำหรับกราฟช่วงเวลานี้...
                    </div>
                  )}
                </div>
              </div>

              {/* TECHNICAL LEVELS CARD: SUPPORT & RESISTANCE (2 LEVELS EACH) */}
              {data?.technicalLevels && (
                <div className="p-4 rounded-2xl bg-gradient-to-br from-[#121622] to-[#151A28] border border-white/[0.08] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Compass className="w-4 h-4 text-indigo-400" />
                      <span className="text-xs font-bold text-white tracking-wide">
                        ระดับเทคนิคสำคัญในการลงทุน (Support & Resistance Pivot)
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">
                      ราคาปัจจุบัน: {currencySymbol}{data.currentPrice}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                    {/* Resistance 2 */}
                    <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
                      <div className="flex items-center justify-between text-[10px] text-rose-300 font-medium">
                        <span>แนวต้าน 2 (R2)</span>
                        <Target className="w-3 h-3" />
                      </div>
                      <div className="text-sm sm:text-base font-bold text-rose-200 font-mono mt-0.5">
                        {currencySymbol}{data.technicalLevels.r2.toFixed(2)}
                      </div>
                      <span className="text-[9px] text-rose-300/70 block mt-0.5">เป้าหมายทำกำไรหลัก</span>
                    </div>

                    {/* Resistance 1 */}
                    <div className="p-2.5 rounded-xl bg-rose-500/5 border border-rose-500/15">
                      <div className="flex items-center justify-between text-[10px] text-rose-300 font-medium">
                        <span>แนวต้าน 1 (R1)</span>
                        <Target className="w-3 h-3" />
                      </div>
                      <div className="text-sm sm:text-base font-bold text-rose-300 font-mono mt-0.5">
                        {currencySymbol}{data.technicalLevels.r1.toFixed(2)}
                      </div>
                      <span className="text-[9px] text-rose-300/70 block mt-0.5">ด่านทดสอบแรก</span>
                    </div>

                    {/* Support 1 */}
                    <div className="p-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
                      <div className="flex items-center justify-between text-[10px] text-emerald-300 font-medium">
                        <span>แนวรับ 1 (S1)</span>
                        <ShieldCheck className="w-3 h-3" />
                      </div>
                      <div className="text-sm sm:text-base font-bold text-emerald-300 font-mono mt-0.5">
                        {currencySymbol}{data.technicalLevels.s1.toFixed(2)}
                      </div>
                      <span className="text-[9px] text-emerald-300/70 block mt-0.5">จุดรับแรก</span>
                    </div>

                    {/* Support 2 */}
                    <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                      <div className="flex items-center justify-between text-[10px] text-emerald-300 font-medium">
                        <span>แนวรับ 2 (S2)</span>
                        <ShieldCheck className="w-3 h-3" />
                      </div>
                      <div className="text-sm sm:text-base font-bold text-emerald-200 font-mono mt-0.5">
                        {currencySymbol}{data.technicalLevels.s2.toFixed(2)}
                      </div>
                      <span className="text-[9px] text-emerald-300/70 block mt-0.5">แนวรับหลัก / จุดคัด</span>
                    </div>
                  </div>

                  {/* Momentum & Trend Summary (RSI 14 & EMA 200) */}
                  {((data.technicalLevels.rsi !== undefined && data.technicalLevels.rsi !== null) || data.technicalLevels.ema200) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-white/[0.06]">
                      {/* RSI (14) Status Card */}
                      {data.technicalLevels.rsi !== undefined && data.technicalLevels.rsi !== null && (
                        <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <Activity className="w-3.5 h-3.5 text-sky-400" />
                            <span className="text-slate-400 text-[11px]">RSI (14 วัน):</span>
                            <span className="font-mono font-bold text-white text-xs">{data.technicalLevels.rsi}</span>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              data.technicalLevels.rsiStatus === 'oversold'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : data.technicalLevels.rsiStatus === 'overbought'
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                : 'bg-slate-700/50 text-slate-300'
                            }`}
                          >
                            {data.technicalLevels.rsiStatus === 'oversold'
                              ? 'Oversold (ลุ้นเด้ง) 🟢'
                              : data.technicalLevels.rsiStatus === 'overbought'
                              ? 'Overbought (ระวังย่อ) 🔴'
                              : 'เป็นกลาง (30-70) ⚪'}
                          </span>
                        </div>
                      )}

                      {/* EMA 200 Trend Status Card */}
                      {data.technicalLevels.ema200 && (
                        <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-purple-400" />
                            <span className="text-slate-400 text-[11px]">EMA 200 วัน:</span>
                            <span className="font-mono font-bold text-purple-300 text-xs">
                              {currencySymbol}{data.technicalLevels.ema200.toFixed(2)}
                            </span>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              data.technicalLevels.trendVsEma200 === 'bullish'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            }`}
                          >
                            {data.technicalLevels.trendVsEma200 === 'bullish'
                              ? 'ยืนเหนือเส้น (Bullish 🐂)'
                              : 'ต่ำกว่าเส้น (Bearish 🐻)'}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* 2. 52-WEEK RANGE SLIDER BAR */}
              {data?.fiftyTwoWeekLow && data?.fiftyTwoWeekHigh ? (
                <div className="p-4 rounded-2xl bg-[#141822] border border-white/[0.08] space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-amber-400" />
                      กรอบราคา 52 สัปดาห์ (52-Week Range)
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {fiftyTwoWeekPct !== null
                        ? fiftyTwoWeekPct > 80
                          ? '🔥 ใกล้จุดสูงสุดของปี'
                          : fiftyTwoWeekPct < 20
                          ? '💎 ใกล้จุดต่ำสุดของปี'
                          : 'ระดับกลางของปี'
                        : ''}
                    </span>
                  </div>

                  {/* Progress Bar with Indicator Pin */}
                  <div className="relative pt-2 pb-1">
                    <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden flex">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 via-amber-400 to-rose-500 rounded-full"
                        style={{ width: '100%' }}
                      />
                    </div>
                    {fiftyTwoWeekPct !== null && (
                      <div
                        className="absolute top-0 -translate-x-1/2 flex flex-col items-center"
                        style={{ left: `${fiftyTwoWeekPct}%` }}
                      >
                        <div className="w-3.5 h-3.5 rounded-full bg-white border-2 border-indigo-600 shadow-md" />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                    <span>
                      ต่ำสุด: {currencySymbol}
                      {data.fiftyTwoWeekLow.toFixed(2)}
                    </span>
                    <span className="text-white font-semibold">
                      ปัจจุบัน: {currencySymbol}
                      {data.currentPrice.toFixed(2)}
                    </span>
                    <span>
                      สูงสุด: {currencySymbol}
                      {data.fiftyTwoWeekHigh.toFixed(2)}
                    </span>
                  </div>
                </div>
              ) : null}

              {/* 3. PRICE RANGE & VALUATION SUMMARY (52-Week & Day Low/High & Cap) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 52-Week Range Card */}
                {data?.fiftyTwoWeekLow && data?.fiftyTwoWeekHigh ? (
                  <div className="p-4 rounded-2xl bg-[#141822] border border-white/[0.08] space-y-2 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5 text-amber-400" />
                        กรอบราคา 52 สัปดาห์ (52W Range)
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {fiftyTwoWeekPct !== null
                          ? fiftyTwoWeekPct > 80
                            ? '🔥 ใกล้จุดสูงสุดของปี'
                            : fiftyTwoWeekPct < 20
                            ? '💎 ใกล้จุดต่ำสุดของปี'
                            : 'ระดับกลางของปี'
                          : ''}
                      </span>
                    </div>

                    <div className="relative pt-2 pb-1">
                      <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden flex">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 via-amber-400 to-rose-500 rounded-full"
                          style={{ width: '100%' }}
                        />
                      </div>
                      {fiftyTwoWeekPct !== null && (
                        <div
                          className="absolute top-0 -translate-x-1/2 flex flex-col items-center"
                          style={{ left: `${fiftyTwoWeekPct}%` }}
                        >
                          <div className="w-3.5 h-3.5 rounded-full bg-white border-2 border-indigo-600 shadow-md" />
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                      <span>ต่ำสุด: {currencySymbol}{data.fiftyTwoWeekLow.toFixed(2)}</span>
                      <span>สูงสุด: {currencySymbol}{data.fiftyTwoWeekHigh.toFixed(2)}</span>
                    </div>
                  </div>
                ) : null}

                {/* Day Range & Market Cap Card */}
                <div className="p-4 rounded-2xl bg-[#141822] border border-white/[0.08] flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-xs text-slate-400 block font-medium">กรอบราคาวันนี้ (Day Range)</span>
                    <p className="text-sm sm:text-base font-bold text-white font-mono">
                      {data?.dayLow && data?.dayHigh
                        ? `${currencySymbol}${data.dayLow.toFixed(2)} - ${currencySymbol}${data.dayHigh.toFixed(2)}`
                        : 'N/A'}
                    </p>
                  </div>
                  <div className="text-right space-y-1 border-l border-white/[0.06] pl-4">
                    <span className="text-xs text-slate-400 block font-medium">มูลค่าตลาด (Market Cap)</span>
                    <p className="text-sm sm:text-base font-bold text-white font-mono">
                      {data?.marketCap
                        ? data.marketCap >= 1e12
                          ? `${currencySymbol}${(data.marketCap / 1e12).toFixed(2)}T`
                          : data.marketCap >= 1e9
                          ? `${currencySymbol}${(data.marketCap / 1e9).toFixed(2)}B`
                          : `${currencySymbol}${(data.marketCap / 1e6).toFixed(1)}M`
                        : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              {/* 4. ANALYST CONSENSUS & TARGET PRICE */}
              {data?.analystTarget && (
                <div className="p-4 rounded-2xl bg-gradient-to-r from-[#141822] to-[#171C28] border border-indigo-500/20 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Award className="w-4 h-4 text-indigo-400" />
                      <span className="text-xs font-bold text-white">
                        มุมมองนักวิเคราะห์ Wall Street (Analyst Consensus)
                      </span>
                    </div>

                    {data.analystTarget.recommendation && (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                        {data.analystTarget.recommendation}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-1 border-t border-white/[0.04]">
                    <div>
                      <span className="text-[10px] text-slate-400 font-medium">
                        ราคาเป้าหมายเฉลี่ย (Mean Target)
                      </span>
                      <p className="text-base sm:text-lg font-bold text-white font-mono">
                        {currencySymbol}{data.analystTarget.targetMean?.toFixed(2)}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 font-medium">
                        โอกาสสร้างผลตอบแทน (Potential Upside)
                      </span>
                      <p
                        className={`text-base sm:text-lg font-bold font-mono ${
                          (data.analystTarget.upsidePercent ?? 0) >= 0
                            ? 'text-emerald-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {(data.analystTarget.upsidePercent ?? 0) >= 0 ? '+' : ''}
                        {data.analystTarget.upsidePercent}%
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* 5. AI EXECUTIVE SUMMARY CARD (เข้าถึงง่าย กระชับ ทันที) */}
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-[#12151C] to-[#191D28] border border-amber-500/25 shadow-xl space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white tracking-wide flex items-center gap-2">
                        <span>สรุปภาพรวมด่วนด้วย AI (Executive Takeaways)</span>
                        {activeModelUsed && (
                          <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-normal">
                            {activeModelUsed}
                          </span>
                        )}
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        สังเคราะห์ใจความสำคัญ 1 นาที พร้อมปัจจัยขับเคลื่อนตลาด
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 self-start sm:self-auto">
                    {activeUpdatedAt && (
                      <span className="text-[10px] text-slate-400 hidden sm:flex items-center gap-1 bg-white/[0.03] px-2.5 py-1 rounded-lg border border-white/[0.06] font-mono">
                        <Clock className="w-3 h-3 text-slate-500" />
                        {new Date(activeUpdatedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={handleGenerateAiInsight}
                      disabled={isAiLoading}
                      className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-amber-500/20 active:scale-95 shrink-0"
                    >
                      {isAiLoading ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>กำลังประมวลผล...</span>
                        </>
                      ) : activeInsight ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>วิเคราะห์ใหม่</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>วิเคราะห์ด้วย AI</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* AI Loading State */}
                {isAiLoading && (
                  <div className="py-6 px-4 rounded-xl bg-white/[0.02] border border-white/[0.06] flex flex-col items-center justify-center text-center space-y-2">
                    <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
                    <p className="text-xs text-slate-300 font-medium">
                      Gemini กำลังสังเคราะห์ข้อมูลปัจจัยพื้นฐานและเทคนิคอลของ {symbol}...
                    </p>
                    <span className="text-[10px] text-slate-500">ใช้เวลาประมาณ 2-3 วินาที</span>
                  </div>
                )}

                {/* AI Error */}
                {aiError && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-center justify-between">
                    <span>{aiError}</span>
                    <button
                      onClick={handleGenerateAiInsight}
                      className="text-amber-400 hover:underline font-semibold ml-2"
                    >
                      ลองใหม่
                    </button>
                  </div>
                )}

                {/* AI Result Content */}
                {activeStructured?.summary ? (
                  <div className="space-y-3 pt-1">
                    <div className="p-3.5 rounded-xl bg-amber-500/[0.06] border border-amber-500/20 text-xs sm:text-sm text-slate-200 leading-relaxed">
                      {activeStructured.summary}
                    </div>

                    {activeStructured.latestNewsCatalyst && (
                      <div className="text-xs text-slate-300 flex items-start gap-2 bg-[#0F1218] p-3 rounded-xl border border-white/[0.06]">
                        <span className="text-amber-400 shrink-0 font-bold">⚡ ปัจจัยเร่ง:</span>
                        <span>{activeStructured.latestNewsCatalyst}</span>
                      </div>
                    )}

                    {/* Button to drill down to 4 Pillars tab */}
                    <button
                      type="button"
                      onClick={() => setActiveTab('four_pillars')}
                      className="w-full py-2.5 px-4 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-300 hover:text-white text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer group"
                    >
                      <Target className="w-3.5 h-3.5 text-indigo-400" />
                      <span>เปิดดูบทวิเคราะห์ 4 ด้านฉบับเต็ม (Business, Valuation, Health, Scenarios)</span>
                      <ArrowRight className="w-3.5 h-3.5 text-indigo-400 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                ) : activeInsight ? (
                  <div className="space-y-3">
                    <div className="p-3.5 rounded-xl bg-[#0F1218] border border-white/[0.06] text-xs text-slate-200 max-h-48 overflow-y-auto">
                      <AiInsightContent content={activeInsight} />
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('four_pillars')}
                      className="w-full py-2 px-3 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-300 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <span>ดูรายละเอียดในแท็บ 4 เสาหลัก</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : !isAiLoading && !aiError ? (
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                      <span className="text-xs text-slate-300">
                        กดปุ่มวิเคราะห์เพื่อรับบทสรุปยุทธศาสตร์และ Scenarios จาก AI ในไม่กี่วินาที
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <>
      {createPortal(modalContent, document.body)}
      <FullscreenChartModal
        isOpen={isFullscreenChartOpen}
        onClose={() => setIsFullscreenChartOpen(false)}
        symbol={symbol}
        name={data?.name || initialName || symbol}
        market={market}
        currencySymbol={currencySymbol}
        currentPrice={data?.currentPrice ?? 0}
        range={range}
        setRange={setRange}
        chartType={chartType}
        setChartType={setChartType}
        showSR={showSR}
        setShowSR={setShowSR}
        showSMA={showSMA}
        setShowSMA={setShowSMA}
        showEMA200={showEMA200}
        setShowEMA200={setShowEMA200}
        showVolume={showVolume}
        setShowVolume={setShowVolume}
        chartPoints={chartPoints}
        technicalLevels={data?.technicalLevels}
        isRangePositive={isRangePositive}
        rangeChangePercent={rangeChangePercent}
        minPrice={minPrice}
        maxPrice={maxPrice}
        hasChartData={hasChartData}
      />
    </>
  )
}
