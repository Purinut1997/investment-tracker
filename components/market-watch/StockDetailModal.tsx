'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import useSWR from 'swr'
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

  const isEnglishAnalysis = useMemo(() => {
    const textToCheck = (aiData?.summary || '') + (aiData?.businessOverview || '') + rawFallback
    return textToCheck.length > 50 && !/[ก-๙]/.test(textToCheck)
  }, [aiData, rawFallback])

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
        <div className="p-4 rounded-2xl bg-[#121620] border border-white/[0.07] shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="w-4 h-4 text-indigo-400" />
            <h5 className="text-xs font-bold text-white uppercase tracking-wider">
              🏢 ภาพรวมธุรกิจ & ที่มาของรายได้ (Business & Revenue Engine)
            </h5>
          </div>
          <p className="text-xs sm:text-[13px] text-slate-300 leading-relaxed font-normal">
            {aiData.businessOverview}
          </p>
        </div>
      )}

      {/* 3. Financial Performance (ผลประกอบการ: Revenue, EPS, Growth, FCF) */}
      <div>
        <div className="flex items-center gap-2 mb-2.5">
          <BarChart3 className="w-4 h-4 text-emerald-400" />
          <h5 className="text-xs font-bold text-white uppercase tracking-wider">
            📊 ผลประกอบการสำคัญ (Financial Performance)
          </h5>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {/* Revenue */}
          <div className="p-3.5 rounded-xl bg-[#121620] border border-white/[0.06] hover:border-indigo-500/30 transition-all">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
              รายได้รวม (Revenue)
            </span>
            <span className="text-sm sm:text-base font-bold text-white font-mono mt-1 block">
              {aiData.financialPerformance?.revenue || (stock?.revenue ? `${currencySymbol}${(stock.revenue / 1e9).toFixed(1)}B` : '—')}
            </span>
            <span className="text-[10px] text-slate-500 mt-0.5 block">ยอดขายรอบ 12 เดือน</span>
          </div>

          {/* EPS */}
          <div className="p-3.5 rounded-xl bg-[#121620] border border-white/[0.06] hover:border-indigo-500/30 transition-all">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
              กำไรต่อหุ้น (EPS)
            </span>
            <span className="text-sm sm:text-base font-bold text-emerald-400 font-mono mt-1 block">
              {aiData.financialPerformance?.eps || (stock?.eps ? `${currencySymbol}${stock.eps}` : '—')}
            </span>
            <span className="text-[10px] text-slate-500 mt-0.5 block">คุณภาพกำไรสุทธิ</span>
          </div>

          {/* Growth */}
          <div className="p-3.5 rounded-xl bg-[#121620] border border-white/[0.06] hover:border-indigo-500/30 transition-all">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
              การเติบโต (Growth YoY)
            </span>
            <span className="text-sm sm:text-base font-bold text-white font-mono mt-1 block">
              {aiData.financialPerformance?.growth || (stock?.revenueGrowth ? `+${stock.revenueGrowth}%` : '—')}
            </span>
            <span className="text-[10px] text-slate-500 mt-0.5 block">ทิศทางการขยายตัว</span>
          </div>

          {/* FCF */}
          <div className="p-3.5 rounded-xl bg-[#121620] border border-white/[0.06] hover:border-indigo-500/30 transition-all">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
              กระแสเงินสด (FCF)
            </span>
            <span className="text-sm sm:text-base font-bold text-cyan-400 font-mono mt-1 block">
              {aiData.financialPerformance?.fcf || (stock?.freeCashflow ? `${currencySymbol}${(stock.freeCashflow / 1e9).toFixed(1)}B` : '—')}
            </span>
            <span className="text-[10px] text-slate-500 mt-0.5 block">Free Cash Flow</span>
          </div>
        </div>
      </div>

      {/* 4. Valuation & Dividend (P/E, P/B, EV/EBITDA, Dividend Yield, Payout Ratio) */}
      <div className="p-4 rounded-2xl bg-[#121620] border border-white/[0.07] space-y-3">
        <div className="flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-amber-400" />
          <h5 className="text-xs font-bold text-white uppercase tracking-wider">
            💰 การประเมินมูลค่า & เงินปันผล (Valuation & Dividend Metrics)
          </h5>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          <div className="p-3 rounded-xl bg-slate-900/70 border border-white/[0.04]">
            <span className="text-[10px] text-slate-400 block font-medium">P/E Ratio</span>
            <span className="text-sm font-bold text-white font-mono mt-0.5 block">
              {stock?.pe ? `${stock.pe}x` : 'N/A'}
            </span>
            <span className="text-[10px] text-slate-400 truncate block mt-0.5">
              {aiData.valuationAndDividend?.pe || 'ระดับความถูกแพง'}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-slate-900/70 border border-white/[0.04]">
            <span className="text-[10px] text-slate-400 block font-medium">P/B Ratio</span>
            <span className="text-sm font-bold text-white font-mono mt-0.5 block">
              {stock?.pb ? `${stock.pb}x` : 'N/A'}
            </span>
            <span className="text-[10px] text-slate-400 truncate block mt-0.5">
              {aiData.valuationAndDividend?.pb || 'เทียบมูลค่าทางบัญชี'}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-slate-900/70 border border-white/[0.04]">
            <span className="text-[10px] text-slate-400 block font-medium">EV/EBITDA</span>
            <span className="text-sm font-bold text-white font-mono mt-0.5 block">
              {stock?.evEbitda ? `${stock.evEbitda}x` : 'N/A'}
            </span>
            <span className="text-[10px] text-slate-400 truncate block mt-0.5">
              {aiData.valuationAndDividend?.evEbitda || 'มูลค่ากิจการต่อกำไร'}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-slate-900/70 border border-white/[0.04]">
            <span className="text-[10px] text-slate-400 block font-medium">Dividend Yield</span>
            <span className="text-sm font-bold text-emerald-400 font-mono mt-0.5 block">
              {stock?.dividendYield !== null && stock?.dividendYield !== undefined ? `${stock.dividendYield}%` : '0.00%'}
            </span>
            <span className="text-[10px] text-slate-400 truncate block mt-0.5">
              {aiData.valuationAndDividend?.dividendYield || 'อัตราผลตอบแทน'}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-slate-900/70 border border-white/[0.04]">
            <span className="text-[10px] text-slate-400 block font-medium">Payout Ratio</span>
            <span className="text-sm font-bold text-indigo-300 font-mono mt-0.5 block">
              {stock?.payoutRatio ? `${stock.payoutRatio}%` : 'N/A'}
            </span>
            <span className="text-[10px] text-slate-400 truncate block mt-0.5">
              {aiData.valuationAndDividend?.payoutRatio || 'ความปลอดภัยปันผล'}
            </span>
          </div>
        </div>
      </div>

      {/* 5. จุดแข็ง vs ความเสี่ยง (Side-by-side 2 Columns) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left: Strengths */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/25 to-[#121620] border border-emerald-500/30 space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
              🚀
            </span>
            <h5 className="text-xs font-bold text-white uppercase tracking-wider">
              จุดแข็ง & ปัจจัยขับเคลื่อนการเติบโต (Moats)
            </h5>
          </div>
          <ul className="space-y-2.5">
            {(aiData.strengths || []).map((s, idx) => (
              <li key={idx} className="flex items-start gap-2 text-xs text-slate-300 leading-relaxed">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 mt-1.5" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Right: Risks */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-rose-950/25 to-[#121620] border border-rose-500/30 space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold text-xs">
              ⚠️
            </span>
            <h5 className="text-xs font-bold text-white uppercase tracking-wider">
              ความเสี่ยง & ปัจจัยที่ต้องจับตา (Key Risks)
            </h5>
          </div>
          <ul className="space-y-2.5">
            {(aiData.risks || []).map((r, idx) => (
              <li key={idx} className="flex items-start gap-2 text-xs text-slate-300 leading-relaxed">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0 mt-1.5" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* 6. Scenario Analysis (Bull / Base / Bear) */}
      {aiData.scenarioAnalysis && (
        <div className="p-4 sm:p-5 rounded-2xl bg-[#121620] border border-white/[0.07] space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm">🔮</span>
            <h5 className="text-xs font-bold text-white uppercase tracking-wider">
              การวิเคราะห์สถานการณ์ (Scenario Analysis)
            </h5>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Bull Case */}
            <div className="p-3.5 rounded-xl bg-emerald-500/[0.07] border border-emerald-500/25 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-xs">🐂</span>
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wide">
                  Bull Case (กรณีดีสุด)
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {aiData.scenarioAnalysis.bull || 'ปัจจัยเร่งผลักดันราคาทำจุดสูงสุดใหม่'}
              </p>
            </div>

            {/* Base Case */}
            <div className="p-3.5 rounded-xl bg-indigo-500/[0.07] border border-indigo-500/25 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-xs">⚖️</span>
                <span className="text-xs font-bold text-indigo-300 uppercase tracking-wide">
                  Base Case (กรณีพื้นฐาน)
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {aiData.scenarioAnalysis.base || 'เติบโตตามเป้าหมายของบริษัทและค่าเฉลี่ยอุตสาหกรรม'}
              </p>
            </div>

            {/* Bear Case */}
            <div className="p-3.5 rounded-xl bg-rose-500/[0.07] border border-rose-500/25 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-xs">🐻</span>
                <span className="text-xs font-bold text-rose-400 uppercase tracking-wide">
                  Bear Case (กรณีแย่สุด)
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
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
  const [chartType, setChartType] = useState<'area' | 'candle'>('area')
  const [showSR, setShowSR] = useState(true)
  const [showSMA, setShowSMA] = useState(true)
  const [isAiLoading, setIsAiLoading] = useState(false)
  const [aiInsight, setAiInsight] = useState<string | null>(null)
  const [structuredAi, setStructuredAi] = useState<StructuredAiData | null>(null)
  const [aiModelUsed, setAiModelUsed] = useState<string | null>(null)
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
      setAiInsight(null)
      setStructuredAi(null)
      setAiModelUsed(null)
      setAiError(null)
      setIsAiLoading(false)
    }
  }, [isOpen, symbol])

  // Fetch persistent latest AI Insight for this symbol from database
  const { data: cachedAiData, mutate: mutateCachedAi } = useSWR(
    isOpen && symbol ? `/api/market-watch/ai-insight?symbol=${encodeURIComponent(symbol)}` : null,
    { revalidateOnFocus: false }
  )

  const activeInsight = aiInsight || cachedAiData?.insight
  const activeStructured = structuredAi || cachedAiData?.structuredInsight
  const activeModelUsed = aiModelUsed || cachedAiData?.modelUsed
  const activeUpdatedAt = cachedAiData?.updatedAt

  // ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Fetch Stock Detail Data with SWR
  const { data, isLoading, error } = useSWR(
    isOpen && symbol
      ? `/api/market-watch/stock-detail?symbol=${encodeURIComponent(
          symbol
        )}&market=${encodeURIComponent(market)}&range=${range}`
      : null,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
    }
  )

  // Price points for Recharts
  const chartPoints = data?.chartPoints ?? []
  const hasChartData = chartPoints.length > 1

  // Determine trend of selected range (first point vs last point)
  const isRangePositive = useMemo(() => {
    if (chartPoints.length < 2) return (data?.changePercent ?? 0) >= 0
    const first = chartPoints[0].price
    const last = chartPoints[chartPoints.length - 1].price
    return last >= first
  }, [chartPoints, data?.changePercent])

  // Calculate range % change
  const rangeChangePercent = useMemo(() => {
    if (chartPoints.length < 2) return data?.changePercent ?? 0
    const first = chartPoints[0].price
    const last = chartPoints[chartPoints.length - 1].price
    return first > 0 ? ((last - first) / first) * 100 : 0
  }, [chartPoints, data?.changePercent])

  // Min and Max prices for chart domain
  const { minPrice, maxPrice } = useMemo(() => {
    if (chartPoints.length === 0) return { minPrice: 0, maxPrice: 100 }
    let min = chartPoints[0].price
    let max = chartPoints[0].price
    for (const p of chartPoints) {
      if (p.price < min) min = p.price
      if (p.price > max) max = p.price
    }
    const padding = (max - min) * 0.08 || min * 0.02
    return {
      minPrice: Math.max(0, Number((min - padding).toFixed(2))),
      maxPrice: Number((max + padding).toFixed(2)),
    }
  }, [chartPoints])

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
          symbol: data.symbol,
          name: data.name || initialName,
          currentPrice: data.currentPrice,
          currency: data.currency,
          changePercent: data.changePercent,
          pe: data.pe,
          pb: data.pb,
          evEbitda: data.evEbitda,
          dividendYield: data.dividendYield,
          payoutRatio: data.payoutRatio,
          fiftyTwoWeekHigh: data.fiftyTwoWeekHigh,
          fiftyTwoWeekLow: data.fiftyTwoWeekLow,
          marketCap: data.marketCap,
          revenue: data.revenue,
          revenueGrowth: data.revenueGrowth,
          eps: data.eps,
          freeCashflow: data.freeCashflow,
          analystTarget: data.analystTarget,
        }),
      })

      const resData = await res.json()
      if (!res.ok) {
        throw new Error(resData.error || 'ไม่สามารถวิเคราะห์ด้วย AI ได้')
      }

      setAiInsight(resData.insight)
      setStructuredAi(resData.structuredInsight)
      setAiModelUsed(resData.modelUsed)
      await mutateCachedAi(resData, false)
    } catch (err: any) {
      setAiError(err?.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ AI')
    } finally {
      setIsAiLoading(false)
    }
  }

  if (!isOpen || !symbol || !mounted) return null

  const currencySymbol = data?.currency === 'THB' ? '฿' : '$'
  const isPositive = (data?.changePercent ?? 0) >= 0

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/85 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog (Center card on all screens with smooth entrance) */}
      <div className="relative w-full max-w-2xl bg-[#0F1218] border border-white/[0.12] rounded-2xl sm:rounded-3xl shadow-2xl shadow-black/95 z-10 flex flex-col max-h-[90vh] sm:max-h-[88vh] overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Glow Accent */}
        <div
          className={`absolute top-0 right-1/4 -translate-y-1/2 w-80 h-36 rounded-full blur-3xl pointer-events-none ${
            isRangePositive ? 'bg-emerald-500/10' : 'bg-rose-500/10'
          }`}
        />

        {/* ============================================================ */}
        {/* MODAL HEADER */}
        {/* ============================================================ */}
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
                {Number(data?.changePercent ?? 0).toFixed(2)}% วันนี้
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
                  </div>
                </div>

                {/* Technical Indicator Filter Toggles */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-white/[0.04] text-xs">
                  <div className="flex items-center gap-2">
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
                      <span className={`w-1.5 h-1.5 rounded-full ${showSMA ? 'bg-amber-400' : 'bg-slate-600'}`} />
                      <span>เส้นเฉลี่ย SMA 20/50</span>
                    </button>
                  </div>

                  {data?.technicalLevels && (
                    <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400 hidden sm:flex">
                      <span className="text-rose-400">R1: {currencySymbol}{data.technicalLevels.r1}</span>
                      <span className="text-emerald-400">S1: {currencySymbol}{data.technicalLevels.s1}</span>
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
                        technicalLevels={data?.technicalLevels}
                        height={260}
                      />
                    ) : (
                      <div className="w-full h-56 sm:h-64">
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
                            {/* Moving Average SMA Lines */}
                            {showSMA && (
                              <>
                                <Line type="monotone" dataKey="sma20" stroke="#F59E0B" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                                <Line type="monotone" dataKey="sma50" stroke="#06B6D4" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                              </>
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

              {/* 3. KEY METRICS & VALUATION */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* P/E */}
                <div className="p-3.5 rounded-xl bg-[#141822] border border-white/[0.06]">
                  <span className="text-[10px] text-slate-400 block font-medium">
                    อัตราส่วน P/E
                  </span>
                  <span className="text-base sm:text-lg font-bold text-white font-mono mt-0.5 block">
                    {data?.pe ? `${data.pe}x` : 'N/A'}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {data?.pe
                      ? data.pe < 20
                        ? 'ราคาไม่แพง'
                        : 'สะท้อนการเติบโต'
                      : 'สินทรัพย์ไม่มี P/E'}
                  </span>
                </div>

                {/* Dividend Yield */}
                <div className="p-3.5 rounded-xl bg-[#141822] border border-white/[0.06]">
                  <span className="text-[10px] text-slate-400 block font-medium">
                    เงินปันผล (Dividend)
                  </span>
                  <span className="text-base sm:text-lg font-bold text-emerald-400 font-mono mt-0.5 block">
                    {data?.dividendYield !== null && data?.dividendYield !== undefined
                      ? `${data.dividendYield.toFixed(2)}%`
                      : '0.00%'}
                  </span>
                  <span className="text-[10px] text-slate-500">อัตราผลตอบแทนต่อปี</span>
                </div>

                {/* Market Cap */}
                <div className="p-3.5 rounded-xl bg-[#141822] border border-white/[0.06]">
                  <span className="text-[10px] text-slate-400 block font-medium">
                    มูลค่าตลาด (Cap)
                  </span>
                  <span className="text-base sm:text-lg font-bold text-white font-mono mt-0.5 block truncate">
                    {data?.marketCap
                      ? data.marketCap >= 1e12
                        ? `${currencySymbol}${(data.marketCap / 1e12).toFixed(2)}T`
                        : data.marketCap >= 1e9
                        ? `${currencySymbol}${(data.marketCap / 1e9).toFixed(2)}B`
                        : data.marketCap >= 1e6
                        ? `${currencySymbol}${(data.marketCap / 1e6).toFixed(1)}M`
                        : `${currencySymbol}${Number(data.marketCap).toLocaleString()}`
                      : 'N/A'}
                  </span>
                  <span className="text-[10px] text-slate-500">Market Cap</span>
                </div>

                {/* Day Range */}
                <div className="p-3.5 rounded-xl bg-[#141822] border border-white/[0.06]">
                  <span className="text-[10px] text-slate-400 block font-medium">
                    กรอบราคาวันนี้
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-white font-mono mt-1 block truncate">
                    {data?.dayLow && data?.dayHigh
                      ? `${currencySymbol}${data.dayLow.toFixed(1)} - ${currencySymbol}${data.dayHigh.toFixed(1)}`
                      : 'N/A'}
                  </span>
                  <span className="text-[10px] text-slate-500">Day Low - High</span>
                </div>
              </div>

              {/* 4. ANALYST CONSENSUS & TARGET PRICE */}
              {data?.analystTarget && (
                <div className="p-4 rounded-2xl bg-gradient-to-r from-[#141822] to-[#171C28] border border-indigo-500/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Award className="w-4 h-4 text-indigo-400" />
                      <span className="text-xs font-bold text-white">
                        มุมมองนักวิเคราะห์ (Wall St. Consensus)
                      </span>
                    </div>

                    {data.analystTarget.recommendation && (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                        {data.analystTarget.recommendation}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-white/[0.04]">
                    <div>
                      <span className="text-[10px] text-slate-400 font-medium">
                        ราคาเป้าหมายเฉลี่ย (Mean Target)
                      </span>
                      <p className="text-lg font-bold text-white font-mono">
                        {currencySymbol}
                        {data.analystTarget.targetMean?.toFixed(2)}
                      </p>
                    </div>

                    <div className="text-left sm:text-right">
                      <span className="text-[10px] text-slate-400 font-medium">
                        โอกาสสร้างผลตอบแทน (Potential Upside)
                      </span>
                      <p
                        className={`text-lg font-bold font-mono ${
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

              {/* 5. USER'S HOLDINGS IN PORTFOLIO (IF OWNED) */}
              {data?.userPosition && (
                <div className="p-4 rounded-2xl bg-emerald-500/[0.06] border border-emerald-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                      <Briefcase className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        คุณถือสินทรัพย์นี้ในพอร์ตโฟลิโอ
                      </span>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        จำนวน {data.userPosition.shares} หน่วย • ต้นทุนเฉลี่ย{' '}
                        {currencySymbol}
                        {data.userPosition.avgCost}
                      </p>
                    </div>
                  </div>

                  <div className="text-left sm:text-right">
                    <span className="text-[10px] text-slate-400">กำไร/ขาดทุนสะสม</span>
                    <p
                      className={`text-sm font-bold font-mono ${
                        data.userPosition.unrealizedGain >= 0
                          ? 'text-emerald-400'
                          : 'text-rose-400'
                      }`}
                    >
                      {data.userPosition.unrealizedGain >= 0 ? '+' : ''}
                      {currencySymbol}
                      {data.userPosition.unrealizedGain.toLocaleString()} (
                      {data.userPosition.unrealizedGainPercent}%)
                    </p>
                  </div>
                </div>
              )}

              {/* 6. GEMINI AI STOCK INSIGHTS */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-[#12151C] to-[#191D28] border border-amber-500/25 shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white tracking-wide flex items-center gap-2">
                        <span>วิเคราะห์หุ้นเชิงลึกด้วย AI (Gemini Insights)</span>
                        {activeModelUsed && (
                          <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-normal">
                            {activeModelUsed}
                          </span>
                        )}
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        สังเคราะห์จุดแข็ง ความเสี่ยง และคำแนะนำการลงทุนเป็นภาษาไทย
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 self-start sm:self-auto">
                    {activeUpdatedAt && (
                      <span className="text-[10px] text-slate-400 flex items-center gap-1 bg-white/[0.03] px-2.5 py-1 rounded-lg border border-white/[0.06] font-mono">
                        <Clock className="w-3 h-3 text-slate-500" />
                        {new Date(activeUpdatedAt).toLocaleDateString('th-TH')} {new Date(activeUpdatedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
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
                          <span>วิเคราะห์ทันที</span>
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
                      Gemini กำลังวิเคราะห์งบการเงิน ตัวเลข P/E และความเสี่ยงของ {symbol}...
                    </p>
                    <span className="text-[10px] text-slate-500">
                      ใช้เวลาประมาณ 3-5 วินาที
                    </span>
                  </div>
                )}

                {/* AI Error */}
                {aiError && (
                  <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-center justify-between">
                    <span>{aiError}</span>
                    <button
                      onClick={handleGenerateAiInsight}
                      className="text-amber-400 hover:underline font-semibold ml-2"
                    >
                      ลองใหม่
                    </button>
                  </div>
                )}

                {/* AI Result View */}
                {activeInsight && (
                  <div className="space-y-3">
                    <div className="max-h-[65vh] overflow-y-auto rounded-xl border border-white/[0.06] bg-[#0F1218] p-4 sm:p-5 pr-3 text-slate-200">
                      <AiStructuredDashboardView
                        data={activeStructured}
                        stock={data}
                        rawFallback={activeInsight}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                      <span>*ข้อมูลการวิเคราะห์ใช้เพื่อประกอบการตัดสินใจเบื้องต้นเท่านั้น</span>
                      <button
                        type="button"
                        onClick={handleGenerateAiInsight}
                        disabled={isAiLoading}
                        className="text-amber-400 hover:underline flex items-center gap-1 font-medium cursor-pointer"
                      >
                        <Sparkles className="w-2.5 h-2.5" />
                        วิเคราะห์ซ้ำ
                      </button>
                    </div>
                  </div>
                )}

                {/* AI Empty State (when no insight yet or invalidated non-Thai) */}
                {!activeInsight && !isAiLoading && !aiError && (
                  <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06] text-center space-y-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div className="max-w-md mx-auto space-y-1">
                      <h5 className="text-xs font-bold text-white">พร้อมวิเคราะห์เชิงลึกด้วย AI (ภาษาไทย 100%)</h5>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        คลิกปุ่ม <span className="text-amber-400 font-semibold">"วิเคราะห์ทันที"</span> ด้านบน เพื่อสังเคราะห์โมเดลธุรกิจ, ผลประกอบการ, จุดแข็ง, ความเสี่ยง และ Bull/Bear Scenarios ฉบับภาษาไทย
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
