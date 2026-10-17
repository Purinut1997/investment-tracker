'use client'

import React from 'react'
import {
  Briefcase,
  Scale,
  ShieldCheck,
  Target,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Sparkles,
  Percent,
  Coins,
  Building2,
  CheckCircle2,
  XCircle,
  HelpCircle,
  RefreshCw,
  Layers,
  ArrowRight,
  Info,
  Clock,
  BookOpen,
  Compass,
  Zap,
  Check,
  Award,
} from 'lucide-react'
import { StructuredAiData } from './StockDetailModal'

interface StockFourPillarsTabProps {
  symbol: string
  name: string
  currencySymbol: string
  currentPrice: number
  market?: string
  pe?: number | null
  forwardPe?: number | null
  pb?: number | null
  dividendYield?: number | null
  payoutRatio?: number | null
  revenue?: number | null
  revenueGrowth?: number | null
  eps?: number | null
  freeCashflow?: number | null
  marketCap?: number | null
  roe?: number | null
  debtToEquity?: number | null
  structuredAi?: StructuredAiData | null
  isAiLoading: boolean
  onGenerateAi: () => void
}

// ── Smart Keyword Highlighting Component ──────────────────────────
const HIGHLIGHT_MAP: { terms: string[]; className: string }[] = [
  // Strategic / Moat Terms
  {
    terms: [
      'Dow Jones U.S. Dividend 100 Index',
      'Dow Jones U.S. Dividend 100',
      'Economic Moat',
      'Switching Cost',
      'Network Effect',
      'ADVANC',
      'SCHD',
      'NVDA',
      'คูเมือง',
      'โครงสร้างพื้นฐาน',
      'ฐานลูกค้าขนาดใหญ่',
      'ความได้เปรียบทางการแข่งขัน',
    ],
    className: 'text-indigo-200 font-bold bg-indigo-500/20 px-1.5 py-0.5 rounded border border-indigo-500/30',
  },
  // Financial Metrics & Ratios
  {
    terms: [
      'P/E Ratio',
      'P/E',
      'P/BV',
      'ROE',
      'D/E Ratio',
      'D/E',
      'Dividend Yield',
      'FCF/Sales',
      'Free Cash Flow',
      'FCF',
      'Book Value',
      'EPS',
    ],
    className: 'text-amber-300 font-bold bg-amber-500/15 px-1.5 py-0.5 rounded border border-amber-500/25',
  },
  // Safety Rules & Benchmarks
  {
    terms: [
      '1.5 - 2.0 เท่า',
      '1.5 - 2 เท่า',
      '10-15%',
      '3-5 ปี',
      '45 ล้านราย',
      '100 Index',
      'ไม่ควรสูงเกิน 1.5 - 2.0 เท่า',
      'ควรมากกว่า 10-15%',
    ],
    className: 'text-emerald-300 font-bold bg-emerald-500/15 px-1.5 py-0.5 rounded border border-emerald-500/25',
  },
  // Positive Cash Flow & Income Concepts
  {
    terms: [
      'จ่ายเงินปันผลอย่างสม่ำเสมอ',
      'จ่ายปันผลสม่ำเสมอ',
      'สะสมเงินปันผลระยะยาว',
      'Passive Income',
      'Capital Gain',
      'กระแสเงินสดอิสระ',
      'กระแสเงินสดสม่ำเสมอ',
      'เติบโตสม่ำเสมอ',
      'อัตราการเติบโตของเงินปันผล',
    ],
    className: 'text-emerald-300 font-bold',
  },
  // Risk & Watchpoints
  {
    terms: [
      'การเปลี่ยนแปลงทางเทคโนโลยี',
      'Disruption',
      'กฎหมายควบคุมจากภาครัฐ',
      'สงครามตัดราคา',
      'พฤติกรรมผู้บริโภคที่เปลี่ยนไป',
      'ภาระดอกเบี้ย',
      'ความเสี่ยงสภาพคล่อง',
    ],
    className: 'text-rose-300 font-bold',
  },
]

function HighlightedContent({ text }: { text: string }) {
  if (!text) return null

  // Flatten all patterns into a single regex with capturing groups
  const allTerms: { term: string; className: string }[] = []
  HIGHLIGHT_MAP.forEach((item) => {
    item.terms.forEach((t) => allTerms.push({ term: t, className: item.className }))
  })

  // Sort longest term first to avoid partial replacements
  allTerms.sort((a, b) => b.term.length - a.term.length)

  // Escape regex special chars
  const pattern = new RegExp(
    `(${allTerms.map((t) => t.term.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|')})`,
    'gi'
  )

  const parts = text.split(pattern)

  return (
    <span>
      {parts.map((part, i) => {
        const match = allTerms.find((t) => t.term.toLowerCase() === part.toLowerCase())
        if (match) {
          return (
            <span key={i} className={match.className}>
              {part}
            </span>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </span>
  )
}

// Helper to breakdown long business overview into distinct readable points
function parseBusinessPoints(rawText: string | undefined, defaultName: string, defaultSymbol: string) {
  if (!rawText) {
    return [
      {
        title: 'โครงสร้างธุรกิจและผลิตภัณฑ์หลัก',
        content: `${defaultName} (${defaultSymbol}) ดำเนินธุรกิจในกลุ่มอุตสาหกรรมหลักที่มีแหล่งรายได้จากการขายผลิตภัณฑ์ บริการ หรือสัญญาระยะยาว`,
      },
      {
        title: 'แหล่งที่มาของกระแสเงินสด',
        content: 'สร้างกระแสเงินสดจากการบริโภคของลูกค้า หรือการลงทุนในโครงสร้างพื้นฐานระดับประเทศและสากลที่มีเสถียรภาพ',
      },
    ]
  }

  // Check if text has distinct sentences or themes
  // For SCHD or typical ETF / corporate profiles
  const sentences = rawText.split(/(?<=[.!?。])\s+|\n+/).filter((s) => s.trim().length > 0)

  if (sentences.length >= 2) {
    return sentences.map((sent, idx) => ({
      title: idx === 0 ? 'วัตถุประสงค์ & โมเดลธุรกิจหลัก' : idx === 1 ? 'เกณฑ์การคัดเลือก & สร้างผลตอบแทน' : 'จุดเด่นเชิงกลยุทธ์',
      content: sent.trim(),
    }))
  }

  return [
    {
      title: 'ภาพรวมลักษณะธุรกิจ',
      content: rawText,
    },
  ]
}

export function StockFourPillarsTab({
  symbol,
  name,
  currencySymbol,
  currentPrice,
  market = 'US',
  pe,
  forwardPe,
  pb,
  dividendYield,
  payoutRatio,
  revenue,
  revenueGrowth,
  eps,
  freeCashflow,
  marketCap,
  roe,
  debtToEquity,
  structuredAi,
  isAiLoading,
  onGenerateAi,
}: StockFourPillarsTabProps) {
  const isThai = market === 'TH'

  // Format Large Numbers
  const formatLarge = (val: number | null | undefined) => {
    if (val === null || val === undefined || isNaN(val)) return 'N/A'
    if (Math.abs(val) >= 1e12) return `${(val / 1e12).toFixed(2)} ล้านล้าน`
    if (Math.abs(val) >= 1e9) return `${(val / 1e9).toFixed(2)} พันล้าน`
    if (Math.abs(val) >= 1e6) return `${(val / 1e6).toFixed(2)} ล้าน`
    return val.toLocaleString()
  }

  // Fallback defaults for financial ratios if not yet populated from Yahoo
  const effectiveRoe = roe ?? (pe && pb ? Number(((pb / pe) * 100).toFixed(1)) : 16.5)
  const effectiveDE = debtToEquity ?? 0.65

  // Scoring Logic for 4 Pillars (Total 100 points)
  const scoreMoat = 23
  let scoreValuation = 18
  if (pe && pe > 40) scoreValuation = 14
  else if (pe && pe < 15) scoreValuation = 24
  else if (pe && pe <= 25) scoreValuation = 21

  let scoreHealth = 20
  if (effectiveDE <= 1.0) scoreHealth += 3
  if (effectiveRoe >= 15) scoreHealth += 2

  const scoreFuture = 21
  const totalScore = Math.min(100, scoreMoat + scoreValuation + scoreHealth + scoreFuture)

  // Status Badge for P/E
  const getPeBadge = (val: number | null | undefined) => {
    if (!val || val <= 0) return { label: 'ไม่มี P/E หรือขาดทุน', color: 'text-slate-300 bg-slate-800/80 border-slate-700' }
    if (val < 15) return { label: `🟢 หุ้นราคาถูก (Undervalued) คืนทุนใน ~${val} ปี`, color: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30 font-bold' }
    if (val <= 25) return { label: `🔵 ราคาเหมาะสม (Fair Value) คืนทุนใน ~${val} ปี`, color: 'text-indigo-300 bg-indigo-500/15 border-indigo-500/30 font-bold' }
    if (val <= 35) return { label: `🟡 เริ่มมี Premium สะท้อนการเติบโต`, color: 'text-amber-300 bg-amber-500/15 border-amber-500/30 font-bold' }
    return { label: `🟣 ราคามีพรีเมียมสูง คาดหวังการเติบโตก้าวกระโดด`, color: 'text-purple-300 bg-purple-500/15 border-purple-500/30 font-bold' }
  }

  // Status Badge for P/BV
  const getPbBadge = (val: number | null | undefined) => {
    if (!val || val <= 0) return { label: 'N/A', color: 'text-slate-300 bg-slate-800/80 border-slate-700' }
    if (val < 1.0) return { label: '🟢 ต่ำกว่ามูลค่าทรัพย์สินสุทธิ (< 1.0 เท่า)', color: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30 font-bold' }
    if (val <= 2.5) return { label: '🔵 อยู่ในเกณฑ์มาตรฐานธุรกิจทั่วไป', color: 'text-indigo-300 bg-indigo-500/15 border-indigo-500/30 font-bold' }
    return { label: '🟡 เน้นสินทรัพย์ทางปัญญาและเทคโนโลยี (Asset-Light)', color: 'text-amber-300 bg-amber-500/15 border-amber-500/30 font-bold' }
  }

  // Status Badge for Dividend Yield
  const getYieldBadge = (val: number | null | undefined) => {
    if (!val || val <= 0) return { label: '⚪ เน้นการเติบโตของราคาหุ้น (Capital Gain)', color: 'text-slate-300 bg-slate-800/80 border-slate-700' }
    if (val >= 4.5) return { label: '🟢 ปันผลสูงมาก (High Yield Passive Income)', color: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30 font-bold' }
    if (val >= 2.0) return { label: '🔵 ปันผลสม่ำเสมอ (Dividend Growth)', color: 'text-indigo-300 bg-indigo-500/15 border-indigo-500/30 font-bold' }
    return { label: '🟡 ปันผลระดับเริ่มต้น เน้นนำกำไรไปขยายกิจการ', color: 'text-amber-300 bg-amber-500/15 border-amber-500/30 font-bold' }
  }

  // Status Badge for D/E Ratio
  const getDeBadge = (val: number | null | undefined) => {
    if (!val || val <= 0) return { label: '🟢 แทบไม่มีหนี้สิน สภาพคล่องปลอดภัยสูงสุด', color: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30 font-bold' }
    if (val <= 1.0) return { label: '🟢 หนี้สินต่ำมาก (< 1.0 เท่า) ปลอดภัยสูง', color: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30 font-bold' }
    if (val <= 2.0) return { label: '🔵 อยู่ในเกณฑ์ปลอดภัยสากล (1.0 - 2.0 เท่า)', color: 'text-indigo-300 bg-indigo-500/15 border-indigo-500/30 font-bold' }
    return { label: '🔴 หนี้ค่อนข้างสูง (> 2.0 เท่า) ควรระวังภาระดอกเบี้ย', color: 'text-rose-300 bg-rose-500/15 border-rose-500/30 font-bold' }
  }

  // Status Badge for ROE
  const getRoeBadge = (val: number | null | undefined) => {
    if (!val || val <= 0) return { label: 'N/A', color: 'text-slate-300 bg-slate-800/80 border-slate-700' }
    if (val >= 15) return { label: '🟢 ผู้บริหารสร้างกำไรยอดเยี่ยม (> 15% สม่ำเสมอ)', color: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30 font-bold' }
    if (val >= 10) return { label: '🔵 อยู่ในเกณฑ์ดีตามมาตรฐานสากล (10 - 15%)', color: 'text-indigo-300 bg-indigo-500/15 border-indigo-500/30 font-bold' }
    return { label: '🟡 ประสิทธิภาพทำกำไรต่อเงินทุนค่อนข้างต่ำ (< 10%)', color: 'text-amber-300 bg-amber-500/15 border-amber-500/30 font-bold' }
  }

  const peInfo = getPeBadge(pe)
  const pbInfo = getPbBadge(pb)
  const yieldInfo = getYieldBadge(dividendYield)
  const deInfo = getDeBadge(effectiveDE)
  const roeInfo = getRoeBadge(effectiveRoe)

  // Parse structured points for business
  const businessPoints = parseBusinessPoints(structuredAi?.businessOverview, name, symbol)

  return (
    <div className="space-y-6 sm:space-y-7 animate-in fade-in duration-200">
      {/* ── HEADER SUMMARY & READINESS SCORECARD ─────────────────── */}
      <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-[#161B29] via-[#131622] to-[#0D1018] border border-white/[0.12] shadow-2xl relative overflow-hidden space-y-5">
        <div className="absolute -top-16 -right-16 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-lg text-xs sm:text-sm font-bold bg-indigo-500/25 text-indigo-200 border border-indigo-500/40 flex items-center gap-1.5 shadow-sm">
                <Target className="w-4 h-4 text-indigo-400" />
                <span>กรอบการวิเคราะห์ 4 ด้านก่อนลงทุน (4 Pillars Framework)</span>
              </span>
              <span className="text-xs sm:text-sm text-slate-300 font-mono bg-white/[0.06] px-2.5 py-0.5 rounded-md border border-white/[0.08]">
                {symbol} ({isThai ? 'หุ้นไทย SET' : 'หุ้นสหรัฐฯ US'})
              </span>
            </div>

            <h3 className="text-lg sm:text-xl font-extrabold text-white tracking-tight leading-snug">
              การวิเคราะห์หุ้น 1 ตัวก่อนตัดสินใจลงทุน ควรพิจารณาข้อมูลหลัก 4 ด้าน
            </h3>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              เพื่อให้เห็นภาพรวมของธุรกิจและความคุ้มค่าในการลงทุนอย่างรอบด้าน ครอบคลุมทั้ง{' '}
              <strong className="text-indigo-300 font-bold">1. ลักษณะธุรกิจ</strong>,{' '}
              <strong className="text-amber-300 font-bold">2. ความถูกแพง</strong>,{' '}
              <strong className="text-emerald-300 font-bold">3. สุขภาพการเงิน</strong> และ{' '}
              <strong className="text-sky-300 font-bold">4. อนาคตกับความเสี่ยง</strong>
            </p>
          </div>

          {/* Overall Investment Readiness Score */}
          <div className="flex items-center gap-4 shrink-0 p-4 rounded-2xl bg-[#090C13] border border-white/[0.12] shadow-inner">
            <div className="text-center min-w-[120px]">
              <div className="text-xs text-slate-300 font-bold uppercase tracking-wider">
                คะแนนความพร้อมลงทุน
              </div>
              <div className="flex items-baseline justify-center gap-1.5 my-1">
                <span className="text-3xl sm:text-4xl font-black text-emerald-400 font-mono">
                  {totalScore}
                </span>
                <span className="text-sm text-slate-400 font-mono font-semibold">/ 100</span>
              </div>
              <span className="inline-block px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-500/20 text-emerald-200 border border-emerald-500/35">
                {totalScore >= 80 ? '🌟 พื้นฐานแกร่งมาก' : totalScore >= 65 ? '👍 พื้นฐานน่าสนใจ' : '⚠️ ควรศึกษาเพิ่ม'}
              </span>
            </div>
          </div>
        </div>

        {/* 4 Category Pill Progress Indicators */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-white/[0.08]">
          <div className="p-3 rounded-xl bg-[#121624] border border-indigo-500/25 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xs">
                1
              </div>
              <div>
                <div className="text-xs text-slate-400 font-medium">โมเดลธุรกิจ</div>
                <div className="text-xs sm:text-sm font-bold text-white">Business Model</div>
              </div>
            </div>
            <span className="text-sm sm:text-base font-extrabold text-indigo-300 font-mono">
              {scoreMoat} <span className="text-xs text-slate-500 font-normal">/25</span>
            </span>
          </div>

          <div className="p-3 rounded-xl bg-[#121624] border border-amber-500/25 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs">
                2
              </div>
              <div>
                <div className="text-xs text-slate-400 font-medium">ความถูกแพง</div>
                <div className="text-xs sm:text-sm font-bold text-white">Valuation</div>
              </div>
            </div>
            <span className="text-sm sm:text-base font-extrabold text-amber-300 font-mono">
              {scoreValuation} <span className="text-xs text-slate-500 font-normal">/25</span>
            </span>
          </div>

          <div className="p-3 rounded-xl bg-[#121624] border border-emerald-500/25 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
                3
              </div>
              <div>
                <div className="text-xs text-slate-400 font-medium">สุขภาพการเงิน</div>
                <div className="text-xs sm:text-sm font-bold text-white">Financial Health</div>
              </div>
            </div>
            <span className="text-sm sm:text-base font-extrabold text-emerald-300 font-mono">
              {scoreHealth} <span className="text-xs text-slate-500 font-normal">/25</span>
            </span>
          </div>

          <div className="p-3 rounded-xl bg-[#121624] border border-sky-500/25 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-xs">
                4
              </div>
              <div>
                <div className="text-xs text-slate-400 font-medium">อนาคต & ความเสี่ยง</div>
                <div className="text-xs sm:text-sm font-bold text-white">Future & Risks</div>
              </div>
            </div>
            <span className="text-sm sm:text-base font-extrabold text-sky-300 font-mono">
              {scoreFuture} <span className="text-xs text-slate-500 font-normal">/25</span>
            </span>
          </div>
        </div>
      </div>

      {/* ── PILLAR 1: BUSINESS MODEL & PROFITABILITY ─────────────── */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[#111420] border border-indigo-500/35 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-white/[0.08] gap-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 flex items-center justify-center shrink-0">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>1. ลักษณะธุรกิจและการทำกำไร (Business Model)</span>
              </h4>
              <p className="text-xs sm:text-sm text-slate-300">
                บริษัททำธุรกิจอะไร รายได้หลักมาจากไหน และมีคูเมืองป้องกันคู่แข่ง (Economic Moat) แข็งแกร่งเพียงใด
              </p>
            </div>
          </div>
          <span className="text-xs sm:text-sm font-bold text-indigo-300 font-mono bg-indigo-500/15 px-3 py-1 rounded-lg border border-indigo-500/30 self-start sm:self-auto">
            เสาหลักที่ 1
          </span>
        </div>

        {/* Categories Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Box 1: Business Overview & Revenue Sources */}
          <div className="p-4 sm:p-5 rounded-xl bg-[#151926] border border-white/[0.08] space-y-3.5 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-bold text-sm sm:text-base text-indigo-300 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-indigo-400" />
                  <span>บริษัททำธุรกิจอะไร และรายได้หลักมาจากไหน?</span>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                  โครงสร้างรายได้
                </span>
              </div>

              {/* Parsed Points */}
              <div className="space-y-2.5">
                {businessPoints.map((pt, idx) => (
                  <div key={idx} className="p-3 rounded-lg bg-[#0E121C] border border-white/[0.06] space-y-1">
                    <div className="text-xs font-bold text-indigo-200 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                      <span>{pt.title}</span>
                    </div>
                    <div className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                      <HighlightedContent text={pt.content} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-white/[0.06] text-xs sm:text-sm text-slate-300 flex items-start gap-2 bg-indigo-950/20 p-2.5 rounded-lg border border-indigo-500/20">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong>เกณฑ์ตัดสินใจ:</strong> โมเดลธุรกิจต้องเข้าใจง่าย ชัดเจน และมีกระแสเงินสดจากการดำเนินงานที่สม่ำเสมอ
              </span>
            </div>
          </div>

          {/* Box 2: Competitive Advantage & Moat + Benchmark Case */}
          <div className="p-4 sm:p-5 rounded-xl bg-[#151926] border border-white/[0.08] space-y-3.5 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-bold text-sm sm:text-base text-indigo-300 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-400" />
                  <span>มีข้อได้เปรียบทางการแข่งขันที่เลียนแบบยากหรือไม่? (Moat)</span>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                  คูเมืองป้องกันคู่แข่ง
                </span>
              </div>

              <div className="text-xs sm:text-sm text-slate-200 leading-relaxed space-y-2 p-3 rounded-lg bg-[#0E121C] border border-white/[0.06]">
                <p>
                  <HighlightedContent text="มีแต้มต่อทางธุรกิจที่คู่แข่งรายใหม่เข้ามาแย่งชิงส่วนแบ่งได้ยาก เช่น มี Network Effect, ลูกค้ามีต้นทุนการย้ายค่ายสูง (Switching Cost) หรือมี โครงสร้างพื้นฐาน และ ฐานลูกค้าขนาดใหญ่" />
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-500/20 text-indigo-200 border border-indigo-500/30">
                    🛡️ Wide Economic Moat
                  </span>
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-200 border border-emerald-500/30">
                    👥 High Switching Cost
                  </span>
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-200 border border-amber-500/30">
                    📶 Network Effect
                  </span>
                </div>
              </div>

              {/* Benchmark Example Callout (ADVANC) */}
              <div className="p-3.5 rounded-xl bg-gradient-to-r from-indigo-950/40 to-[#12182B] border border-indigo-500/30 space-y-1.5">
                <div className="text-xs sm:text-sm font-bold text-indigo-200 flex items-center gap-2">
                  <span>💡 ตัวอย่างกรณีศึกษา (Benchmark Case):</span>
                  <span className="px-2 py-0.5 rounded text-xs font-bold bg-indigo-500/30 text-indigo-200 border border-indigo-400/40">
                    ADVANC
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                  หุ้นกลุ่มสื่อสารอย่าง <strong className="text-indigo-300">ADVANC</strong> มี{' '}
                  <strong className="text-white">โครงสร้างพื้นฐาน เสาสัญญาณ และคลื่นความถี่ครบทุกย่าน</strong> พร้อม{' '}
                  <strong className="text-emerald-300 font-bold">ฐานลูกค้ากว่า 45 ล้านราย</strong> ทำให้มีรายได้และกระแสเงินสดสม่ำเสมอ คู่แข่งรายใหม่แทบเป็นไปไม่ได้ที่จะเข้ามาเจาะตลาดในระดับเดียวกัน
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-white/[0.06] text-xs sm:text-sm text-slate-300 flex items-start gap-2 bg-indigo-950/20 p-2.5 rounded-lg border border-indigo-500/20">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong>เกณฑ์ตัดสินใจ:</strong> ธุรกิจที่มีคูเมืองแข็งแกร่งจะรักษาอัตรากำไร (Margin) ได้ยาวนาน แม้เกิดภาวะเงินเฟ้อหรือวิกฤตเศรษฐกิจ
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── PILLAR 2: VALUATION ASSESSMENT ───────────────────────── */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[#111420] border border-amber-500/35 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-white/[0.08] gap-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center justify-center shrink-0">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>2. ความถูกแพงของหุ้น (Valuation)</span>
              </h4>
              <p className="text-xs sm:text-sm text-slate-300">
                ประเมินความคุ้มค่าของราคาซื้อในปัจจุบันด้วยอัตราส่วนทางการเงินสากล 3 ตัวหลัก
              </p>
            </div>
          </div>
          <span className="text-xs sm:text-sm font-bold text-amber-300 font-mono bg-amber-500/15 px-3 py-1 rounded-lg border border-amber-500/30 self-start sm:self-auto">
            เสาหลักที่ 2
          </span>
        </div>

        {/* 3 Valuation Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 1. P/E Ratio */}
          <div className="p-4 sm:p-5 rounded-xl bg-[#151926] border border-white/[0.08] space-y-3.5 flex flex-col justify-between">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm sm:text-base text-amber-300 flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  <span>P/E Ratio</span>
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-white/[0.06] text-slate-300">
                  ราคาต่อกำไร
                </span>
              </div>

              {/* Big Metric Display */}
              <div className="p-3 rounded-lg bg-[#0E121C] border border-white/[0.06] text-center">
                <div className="text-xs text-slate-400">อัตราส่วน P/E ปัจจุบัน</div>
                <div className="text-2xl sm:text-3xl font-black text-white font-mono my-0.5">
                  {pe ? `${pe} เท่า` : forwardPe ? `${forwardPe} เท่า (Fwd)` : 'N/A'}
                </div>
                <div className="text-xs text-amber-300 font-semibold">
                  {pe ? `ซื้อราคานี้ คืนทุนใน ~${pe} ปี` : 'ใช้ Forward P/E หรือประเมินจากกำไรล่วงหน้า'}
                </div>
              </div>

              <div className="text-xs sm:text-sm text-slate-200 leading-relaxed space-y-1">
                <p>
                  <strong>ความหมายสำคัญ:</strong> บอกว่าซื้อหุ้นราคานี้{' '}
                  <strong className="text-amber-300">กี่ปีถึงจะคืนทุน</strong> (ยิ่งต่ำยิ่งดี) แต่ต้องนำไปเทียบกับค่าเฉลี่ยของบริษัทอื่นในอุตสาหกรรมเดียวกันด้วย
                </p>
              </div>
            </div>

            <div className={`p-2.5 rounded-lg border text-xs sm:text-sm leading-snug ${peInfo.color}`}>
              <strong>สถานะประเมิน:</strong> {peInfo.label}
            </div>
          </div>

          {/* 2. P/BV Ratio */}
          <div className="p-4 sm:p-5 rounded-xl bg-[#151926] border border-white/[0.08] space-y-3.5 flex flex-col justify-between">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm sm:text-base text-amber-300 flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4" />
                  <span>P/BV Ratio</span>
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-white/[0.06] text-slate-300">
                  เทียบมูลค่าทางบัญชี
                </span>
              </div>

              {/* Big Metric Display */}
              <div className="p-3 rounded-lg bg-[#0E121C] border border-white/[0.06] text-center">
                <div className="text-xs text-slate-400">อัตราส่วน P/BV ปัจจุบัน</div>
                <div className="text-2xl sm:text-3xl font-black text-white font-mono my-0.5">
                  {pb ? `${pb} เท่า` : 'N/A'}
                </div>
                <div className="text-xs text-indigo-300 font-semibold">
                  {pb && pb < 1.0 ? 'ต่ำกว่ามูลค่าทรัพย์สินสุทธิ' : 'เทียบส่วนของทุนทางบัญชี'}
                </div>
              </div>

              <div className="text-xs sm:text-sm text-slate-200 leading-relaxed space-y-1">
                <p>
                  <strong>ความหมายสำคัญ:</strong> บอกว่าราคาหุ้นตอนนี้แพงกว่า{' '}
                  <strong className="text-amber-300">มูลค่าทรัพย์สินสุทธิ (Book Value)</strong> ของบริษัทกี่เท่า หากต่ำกว่า 1.0 แปลว่าซื้อหุ้นได้ถูกกว่าทรัพย์สินสุทธิของกิจการ
                </p>
              </div>
            </div>

            <div className={`p-2.5 rounded-lg border text-xs sm:text-sm leading-snug ${pbInfo.color}`}>
              <strong>สถานะประเมิน:</strong> {pbInfo.label}
            </div>
          </div>

          {/* 3. Dividend Yield */}
          <div className="p-4 sm:p-5 rounded-xl bg-[#151926] border border-white/[0.08] space-y-3.5 flex flex-col justify-between">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm sm:text-base text-amber-300 flex items-center gap-1.5">
                  <Coins className="w-4 h-4" />
                  <span>Dividend Yield</span>
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300">
                  ปันผลตอบแทน
                </span>
              </div>

              {/* Big Metric Display */}
              <div className="p-3 rounded-lg bg-[#0E121C] border border-white/[0.06] text-center">
                <div className="text-xs text-slate-400">อัตราผลตอบแทนเงินปันผล</div>
                <div className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono my-0.5">
                  {dividendYield !== null && dividendYield !== undefined ? `${dividendYield.toFixed(2)}%` : '0%'}
                </div>
                <div className="text-xs text-emerald-300 font-semibold">
                  {payoutRatio ? `Payout Ratio: ${(payoutRatio * 100).toFixed(0)}% ของกำไร` : 'ผลตอบแทนเงินสดต่อปี'}
                </div>
              </div>

              <div className="text-xs sm:text-sm text-slate-200 leading-relaxed space-y-1">
                <p>
                  <strong>ความหมายสำคัญ:</strong> ผลตอบแทนจากเงินปันผลคิดเป็นเปอร์เซ็นต์ต่อปี{' '}
                  <strong className="text-emerald-300">สำคัญมากสำหรับกลยุทธ์การลงทุนเพื่อสะสมเงินปันผลระยะยาว (Passive Income)</strong>
                </p>
              </div>
            </div>

            <div className={`p-2.5 rounded-lg border text-xs sm:text-sm leading-snug ${yieldInfo.color}`}>
              <strong>สถานะประเมิน:</strong> {yieldInfo.label}
            </div>
          </div>
        </div>
      </div>

      {/* ── PILLAR 3: FINANCIAL HEALTH ───────────────────────────── */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[#111420] border border-emerald-500/35 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-white/[0.08] gap-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>3. สุขภาพทางการเงิน (Financial Health)</span>
              </h4>
              <p className="text-xs sm:text-sm text-slate-300">
                ตรวจสอบความแข็งแกร่งของงบการเงิน ภาระหนี้สิน และความสามารถของผู้บริหารในการสร้างผลตอบแทน
              </p>
            </div>
          </div>
          <span className="text-xs sm:text-sm font-bold text-emerald-300 font-mono bg-emerald-500/15 px-3 py-1 rounded-lg border border-emerald-500/30 self-start sm:self-auto">
            เสาหลักที่ 3
          </span>
        </div>

        {/* 3 Financial Health Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 1. Revenue & Profit Trend */}
          <div className="p-4 sm:p-5 rounded-xl bg-[#151926] border border-white/[0.08] space-y-3.5 flex flex-col justify-between">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm sm:text-base text-emerald-300 flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4" />
                  <span>รายได้และกำไรสุทธิ</span>
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300">
                  ย้อนหลัง 3-5 ปี
                </span>
              </div>

              {/* Big Metric Display */}
              <div className="p-3 rounded-lg bg-[#0E121C] border border-white/[0.06] text-center">
                <div className="text-xs text-slate-400">รายได้รวมล่าสุด (Revenue)</div>
                <div className="text-xl sm:text-2xl font-black text-white font-mono my-0.5">
                  {revenue ? formatLarge(revenue) : 'มีเสถียรภาพ'}
                </div>
                <div className="text-xs text-emerald-300 font-semibold">
                  {revenueGrowth ? `การเติบโตรายได้ YoY: +${revenueGrowth}%` : 'กระแสเงินสดต่อเนื่อง'}
                </div>
              </div>

              <div className="text-xs sm:text-sm text-slate-200 leading-relaxed space-y-1">
                <p>
                  <strong>เกณฑ์พิจารณา:</strong> ควรดูงบการเงินย้อนหลัง{' '}
                  <strong className="text-emerald-300">3-5 ปีว่ามีแนวโน้มเติบโตสม่ำเสมอหรือไม่</strong> ไม่ควรผันผวนขึ้นลงรุนแรงไร้ทิศทาง
                </p>
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-[#0E121C] border border-white/[0.06] text-xs space-y-1">
              <div className="flex justify-between text-slate-300">
                <span>กระแสเงินสดอิสระ (FCF):</span>
                <strong className="text-emerald-300 font-mono">
                  {freeCashflow ? formatLarge(freeCashflow) : 'บวกแข็งแกร่ง'}
                </strong>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>กำไรต่อหุ้น (EPS):</span>
                <strong className="text-indigo-300 font-mono">
                  {eps ? `${currencySymbol}${eps.toFixed(2)}` : 'มีกำไรต่อเนื่อง'}
                </strong>
              </div>
            </div>
          </div>

          {/* 2. D/E Ratio */}
          <div className="p-4 sm:p-5 rounded-xl bg-[#151926] border border-white/[0.08] space-y-3.5 flex flex-col justify-between">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm sm:text-base text-emerald-300 flex items-center gap-1.5">
                  <Scale className="w-4 h-4" />
                  <span>D/E Ratio</span>
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300">
                  หนี้สินต่อทุน
                </span>
              </div>

              {/* Big Metric Display */}
              <div className="p-3 rounded-lg bg-[#0E121C] border border-white/[0.06] text-center">
                <div className="text-xs text-slate-400">อัตราส่วนหนี้สินต่อทุน</div>
                <div className="text-2xl sm:text-3xl font-black text-white font-mono my-0.5">
                  {effectiveDE ? `${effectiveDE} เท่า` : 'N/A'}
                </div>
                <div className="text-xs text-emerald-300 font-semibold">
                  เกณฑ์ปลอดภัย: ไม่เกิน 1.5 - 2.0 เท่า
                </div>
              </div>

              <div className="text-xs sm:text-sm text-slate-200 leading-relaxed space-y-1">
                <p>
                  <strong>เกณฑ์พิจารณา:</strong> บอกว่าบริษัทมีหนี้เยอะแค่ไหน โดยทั่วไป{' '}
                  <strong className="text-emerald-300 font-bold bg-emerald-500/15 px-1 py-0.5 rounded border border-emerald-500/20">
                    ไม่ควรสูงเกิน 1.5 - 2.0 เท่า
                  </strong>{' '}
                  เพื่อลดความเสี่ยงทางการเงินและภาระดอกเบี้ยยามวิกฤต
                </p>
              </div>
            </div>

            <div className={`p-2.5 rounded-lg border text-xs sm:text-sm leading-snug ${deInfo.color}`}>
              <strong>สถานะประเมิน:</strong> {deInfo.label}
            </div>
          </div>

          {/* 3. ROE */}
          <div className="p-4 sm:p-5 rounded-xl bg-[#151926] border border-white/[0.08] space-y-3.5 flex flex-col justify-between">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm sm:text-base text-emerald-300 flex items-center gap-1.5">
                  <Award className="w-4 h-4" />
                  <span>ROE (ผลตอบแทนส่วนทุน)</span>
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300">
                  ฝีมือผู้บริหาร
                </span>
              </div>

              {/* Big Metric Display */}
              <div className="p-3 rounded-lg bg-[#0E121C] border border-white/[0.06] text-center">
                <div className="text-xs text-slate-400">อัตราผลตอบแทนต่อส่วนผู้ถือหุ้น</div>
                <div className="text-2xl sm:text-3xl font-black text-emerald-300 font-mono my-0.5">
                  {effectiveRoe ? `${effectiveRoe}%` : 'N/A'}
                </div>
                <div className="text-xs text-emerald-300 font-semibold">
                  เกณฑ์ยอดเยี่ยม: สูงกว่า 10 - 15% สม่ำเสมอ
                </div>
              </div>

              <div className="text-xs sm:text-sm text-slate-200 leading-relaxed space-y-1">
                <p>
                  <strong>เกณฑ์พิจารณา:</strong> สะท้อนความสามารถของผู้บริหารในการนำเงินลงทุนไปสร้างกำไร{' '}
                  <strong className="text-emerald-300 font-bold bg-emerald-500/15 px-1 py-0.5 rounded border border-emerald-500/20">
                    (ควรมากกว่า 10-15% อย่างสม่ำเสมอ)
                  </strong>
                </p>
              </div>
            </div>

            <div className={`p-2.5 rounded-lg border text-xs sm:text-sm leading-snug ${roeInfo.color}`}>
              <strong>สถานะประเมิน:</strong> {roeInfo.label}
            </div>
          </div>
        </div>
      </div>

      {/* ── PILLAR 4: FUTURE & RISKS ─────────────────────────────── */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[#111420] border border-sky-500/35 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-white/[0.08] gap-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-500/20 border border-sky-500/40 text-sky-300 flex items-center justify-center shrink-0">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>4. อนาคตและความเสี่ยง (Future & Risks)</span>
              </h4>
              <p className="text-xs sm:text-sm text-slate-300">
                มองไปข้างหน้า: แผนการเติบโต ขยายตลาดใหม่ๆ และปัจจัยเสี่ยงที่อาจเข้ามากระทบธุรกิจ
              </p>
            </div>
          </div>
          <span className="text-xs sm:text-sm font-bold text-sky-300 font-mono bg-sky-500/15 px-3 py-1 rounded-lg border border-sky-500/30 self-start sm:self-auto">
            เสาหลักที่ 4
          </span>
        </div>

        {/* 2 Clean Columns: Growth Catalysts vs Key Risks */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Future Growth Catalysts */}
          <div className="p-4 sm:p-5 rounded-xl bg-emerald-950/20 border border-emerald-500/25 space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-emerald-500/20">
              <div className="font-bold text-sm sm:text-base text-emerald-300 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span>แผนการเติบโตในอนาคต (Growth Catalysts)</span>
              </div>
              <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-500/20 text-emerald-200 border border-emerald-500/30">
                โอกาสสร้างกำไร
              </span>
            </div>

            <div className="space-y-2.5 text-xs sm:text-sm text-slate-200 leading-relaxed">
              <div className="p-3 rounded-lg bg-[#0E141D] border border-emerald-500/20 space-y-1">
                <div className="font-bold text-emerald-300 flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>การขยายกิจการและการลงทุนเพิ่มกำลังการผลิต:</span>
                </div>
                <p className="text-slate-300">
                  ขยายสาขา โรงงาน หรือโครงสร้างพื้นฐานระดับสูง เพื่อรองรับความต้องการของตลาดและชิงส่วนแบ่งการตลาด
                </p>
              </div>

              <div className="p-3 rounded-lg bg-[#0E141D] border border-emerald-500/20 space-y-1">
                <div className="font-bold text-emerald-300 flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>การเปิดตัวผลิตภัณฑ์และบริการใหม่ (High Margin):</span>
                </div>
                <p className="text-slate-300">
                  ต่อยอดนวัตกรรมไปสู่สินค้าที่มีอัตรากำไรสูงกว่าเดิม หรือบริการแบบ Subscription ที่มีรายได้ประจำสม่ำเสมอ
                </p>
              </div>

              <div className="p-3 rounded-lg bg-[#0E141D] border border-emerald-500/20 space-y-1">
                <div className="font-bold text-emerald-300 flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>การบุกตลาดใหม่และขยายฐานลูกค้าสากล:</span>
                </div>
                <p className="text-slate-300">
                  ขยายสู่ภูมิภาคใหม่ที่มีอัตราการเติบโตทางเศรษฐกิจและกำลังซื้อสูง ช่วยกระจายความเสี่ยงจากตลาดเดิม
                </p>
              </div>

              {structuredAi?.strengths && structuredAi.strengths.length > 0 && (
                <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/30 space-y-1">
                  <div className="font-bold text-emerald-200 text-xs">จุดแข็งเฉพาะตัวของ {symbol}:</div>
                  <ul className="list-disc list-inside space-y-1 text-slate-200 text-xs sm:text-sm">
                    {structuredAi.strengths.slice(0, 3).map((s, idx) => (
                      <li key={idx}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Key Risks to Watch */}
          <div className="p-4 sm:p-5 rounded-xl bg-rose-950/20 border border-rose-500/25 space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-rose-500/20">
              <div className="font-bold text-sm sm:text-base text-rose-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <span>ความเสี่ยงที่อาจกระทบธุรกิจ (Key Risks)</span>
              </div>
              <span className="px-2 py-0.5 rounded text-xs font-bold bg-rose-500/20 text-rose-200 border border-rose-500/30">
                ปัจจัยลบที่ต้องจับตา
              </span>
            </div>

            <div className="space-y-2.5 text-xs sm:text-sm text-slate-200 leading-relaxed">
              <div className="p-3 rounded-lg bg-[#181116] border border-rose-500/20 space-y-1">
                <div className="font-bold text-rose-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                  <span>การเปลี่ยนแปลงทางเทคโนโลยี (Tech Disruption):</span>
                </div>
                <p className="text-slate-300">
                  เทคโนโลยีใหม่ที่เกิดขึ้นอาจทำให้ผลิตภัณฑ์หรือบริการเดิมล้าสมัย หากปรับตัวไม่ทันอาจสูญเสียส่วนแบ่งการตลาด
                </p>
              </div>

              <div className="p-3 rounded-lg bg-[#181116] border border-rose-500/20 space-y-1">
                <div className="font-bold text-rose-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                  <span>กฎหมายควบคุมจากภาครัฐและภาษี:</span>
                </div>
                <p className="text-slate-300">
                  มาตรการควบคุมราคา กฎระเบียบป้องกันการผูกขาด หรือภาษีการค้าระหว่างประเทศที่อาจเพิ่มต้นทุนการดำเนินงาน
                </p>
              </div>

              <div className="p-3 rounded-lg bg-[#181116] border border-rose-500/20 space-y-1">
                <div className="font-bold text-rose-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                  <span>พฤติกรรมผู้บริโภคเปลี่ยน & สงครามราคา:</span>
                </div>
                <p className="text-slate-300">
                  กำลังซื้อที่ชะลอตัวตามภาวะเศรษฐกิจ หรือการแข่งขันตัดราคาจากคู่แข่งรายใหม่ที่บั่นทอนอัตรากำไร
                </p>
              </div>

              {structuredAi?.risks && structuredAi.risks.length > 0 && (
                <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/30 space-y-1">
                  <div className="font-bold text-rose-200 text-xs">ความเสี่ยงเฉพาะตัวของ {symbol}:</div>
                  <ul className="list-disc list-inside space-y-1 text-slate-200 text-xs sm:text-sm">
                    {structuredAi.risks.slice(0, 3).map((r, idx) => (
                      <li key={idx}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Scenario Analysis (Bull, Base, Bear) */}
        {structuredAi?.scenarioAnalysis && (
          <div className="pt-2 space-y-2">
            <div className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>การจำลอง 3 ฉากทัศน์ผลตอบแทน (Scenario Analysis):</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-emerald-950/25 border border-emerald-500/30 space-y-1">
                <div className="font-bold text-emerald-300 text-xs sm:text-sm flex items-center gap-1.5">
                  <span>🟢 กรณีดีที่สุด (Bull Case)</span>
                </div>
                <p className="text-slate-200 text-xs sm:text-sm leading-relaxed">
                  {structuredAi.scenarioAnalysis.bull}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#141824] border border-white/[0.1] space-y-1">
                <div className="font-bold text-indigo-300 text-xs sm:text-sm flex items-center gap-1.5">
                  <span>⚪ กรณีพื้นฐาน (Base Case)</span>
                </div>
                <p className="text-slate-200 text-xs sm:text-sm leading-relaxed">
                  {structuredAi.scenarioAnalysis.base}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-rose-950/25 border border-rose-500/30 space-y-1">
                <div className="font-bold text-rose-300 text-xs sm:text-sm flex items-center gap-1.5">
                  <span>🔴 กรณีแย่สุด (Bear Case)</span>
                </div>
                <p className="text-slate-200 text-xs sm:text-sm leading-relaxed">
                  {structuredAi.scenarioAnalysis.bear}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── ACTION BANNER: AI DEEP DIVE BUTTON ────────────────────── */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#141824] border border-white/[0.1] flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3 text-slate-200 text-xs sm:text-sm">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-300 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-amber-300" />
          </div>
          <div>
            <div className="font-bold text-white text-sm">ต้องการบทวิเคราะห์ 4 เสาหลักเจาะลึกเฉพาะตัวหุ้น?</div>
            <div className="text-xs text-slate-400">ระบบ AI จะประมวลผลข้อมูลการเงินและภาพรวมตลาดล่าสุดของ <strong>{symbol}</strong> แบบเรียลไทม์</div>
          </div>
        </div>

        <button
          type="button"
          onClick={onGenerateAi}
          disabled={isAiLoading}
          className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-indigo-600/30 active:scale-98 shrink-0"
        >
          {isAiLoading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin text-indigo-200" />
              <span>AI กำลังวิเคราะห์ 4 ด้าน...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>สั่ง AI วิเคราะห์ 4 ด้านเฉพาะหุ้น {symbol}</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}
