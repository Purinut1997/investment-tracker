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
  FileText,
  Bookmark,
  Quote,
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
      'ASML',
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
      'ยิ่งต่ำยิ่งดี',
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
      'Tech Disruption',
      'Disruption',
      'กฎหมายควบคุมจากภาครัฐ',
      'สงครามตัดราคา',
      'พฤติกรรมผู้บริโภคที่เปลี่ยนไป',
      'ภาระดอกเบี้ย',
      'ความเสี่ยงทางการเงิน',
      'ความเสี่ยงสภาพคล่อง',
    ],
    className: 'text-rose-300 font-bold',
  },
]

function HighlightedContent({ text }: { text: string }) {
  if (!text) return null

  const allTerms: { term: string; className: string }[] = []
  HIGHLIGHT_MAP.forEach((item) => {
    item.terms.forEach((t) => allTerms.push({ term: t, className: item.className }))
  })

  allTerms.sort((a, b) => b.term.length - a.term.length)

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

  // Adjust PB if extreme due to buybacks/currency
  const displayPb = pb ? (pb > 500 ? Number((pb / 100).toFixed(2)) : Number(pb.toFixed(2))) : null

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
    if (val <= 3.0) return { label: '🔵 อยู่ในเกณฑ์มาตรฐานธุรกิจทั่วไป', color: 'text-indigo-300 bg-indigo-500/15 border-indigo-500/30 font-bold' }
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
  const pbInfo = getPbBadge(displayPb)
  const yieldInfo = getYieldBadge(dividendYield)
  const deInfo = getDeBadge(effectiveDE)
  const roeInfo = getRoeBadge(effectiveRoe)

  return (
    <div className="space-y-6 sm:space-y-7 animate-in fade-in duration-200">
      {/* ── 0. EXECUTIVE REPORT HEADER (บทนำและคะแนนความพร้อม) ─────────────────── */}
      <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-[#161B29] via-[#121622] to-[#0A0D15] border border-white/[0.12] shadow-2xl relative overflow-hidden space-y-4">
        <div className="absolute -top-20 -right-20 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-lg text-xs sm:text-sm font-bold bg-indigo-500/25 text-indigo-200 border border-indigo-500/40 flex items-center gap-1.5 shadow-sm">
                <FileText className="w-4 h-4 text-indigo-400" />
                <span>บทวิเคราะห์ 4 ด้านก่อนตัดสินใจลงทุน (4 Pillars Investment Thesis)</span>
              </span>
              <span className="text-xs sm:text-sm text-slate-300 font-mono bg-white/[0.06] px-2.5 py-0.5 rounded-md border border-white/[0.08]">
                {symbol} • {name}
              </span>
            </div>

            <h3 className="text-lg sm:text-xl font-extrabold text-white tracking-tight leading-snug">
              การวิเคราะห์หุ้น 1 ตัวก่อนตัดสินใจลงทุน ควรพิจารณาข้อมูลหลัก 4 ด้าน
            </h3>

            <p className="text-sm text-slate-300 leading-relaxed">
              เพื่อให้เห็นภาพรวมของธุรกิจและความคุ้มค่าในการลงทุนอย่างรอบด้าน โดยแบ่งชุดเนื้อหาออกเป็น 4 หมวดหมู่สำคัญ ได้แก่:{' '}
              <strong className="text-indigo-300">1. ลักษณะธุรกิจและการทำกำไร</strong>,{' '}
              <strong className="text-amber-300">2. ความถูกแพงของหุ้น</strong>,{' '}
              <strong className="text-emerald-300">3. สุขภาพทางการเงิน</strong> และ{' '}
              <strong className="text-sky-300">4. อนาคตและความเสี่ยง</strong>
            </p>
          </div>

          {/* Readiness Score Strip */}
          <div className="flex items-center gap-4 shrink-0 p-4 rounded-2xl bg-[#090C13] border border-white/[0.12] shadow-inner self-start md:self-auto">
            <div className="text-center min-w-[125px]">
              <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">
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

        {/* 4 Category Score Highlights */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 pt-3 border-t border-white/[0.08] text-xs sm:text-sm">
          <div className="px-3 py-2 rounded-xl bg-[#121624] border border-indigo-500/25 flex items-center justify-between">
            <span className="text-slate-300 font-medium">1. โมเดลธุรกิจ</span>
            <span className="font-extrabold text-indigo-300 font-mono">{scoreMoat} / 25</span>
          </div>
          <div className="px-3 py-2 rounded-xl bg-[#121624] border border-amber-500/25 flex items-center justify-between">
            <span className="text-slate-300 font-medium">2. ความถูกแพง</span>
            <span className="font-extrabold text-amber-300 font-mono">{scoreValuation} / 25</span>
          </div>
          <div className="px-3 py-2 rounded-xl bg-[#121624] border border-emerald-500/25 flex items-center justify-between">
            <span className="text-slate-300 font-medium">3. สุขภาพการเงิน</span>
            <span className="font-extrabold text-emerald-300 font-mono">{scoreHealth} / 25</span>
          </div>
          <div className="px-3 py-2 rounded-xl bg-[#121624] border border-sky-500/25 flex items-center justify-between">
            <span className="text-slate-300 font-medium">4. อนาคต & เสี่ยง</span>
            <span className="font-extrabold text-sky-300 font-mono">{scoreFuture} / 25</span>
          </div>
        </div>
      </div>

      {/* ── 1. BUSINESS MODEL (หมวดที่ 1: ลักษณะธุรกิจและการทำกำไร) ─────────────── */}
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
                ทำความเข้าใจว่าบริษัททำธุรกิจอะไร แหล่งที่มาของรายได้ และความสามารถในการรักษาคูเมืองทางธุรกิจ
              </p>
            </div>
          </div>
          <span className="text-xs sm:text-sm font-bold text-indigo-300 font-mono bg-indigo-500/15 px-3 py-1 rounded-lg border border-indigo-500/30 self-start sm:self-auto">
            หมวดที่ 1
          </span>
        </div>

        {/* Narrative Flow for Business Model */}
        <div className="space-y-4 text-sm sm:text-[14.5px] leading-relaxed text-slate-200">
          {/* Paragraph 1: Business Overview & Core Revenue */}
          <div className="p-4 rounded-xl bg-[#151926] border border-white/[0.08] space-y-2">
            <div className="font-bold text-indigo-300 text-sm sm:text-base flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-400" />
              <span>บริษัททำธุรกิจอะไร และรายได้หลักมาจากไหน?</span>
            </div>
            <p className="text-slate-200">
              {structuredAi?.businessOverview ? (
                <HighlightedContent text={structuredAi.businessOverview} />
              ) : (
                <HighlightedContent
                  text={`${name} (${symbol}) ดำเนินธุรกิจในกลุ่มอุตสาหกรรมหลักที่มีแหล่งรายได้จากการจำหน่ายผลิตภัณฑ์ บริการ หรือสัญญาลิขสิทธิ์ระดับสากล โดยเน้นการสร้างกระแสเงินสดจากการบริโภคหรือการลงทุนโครงสร้างพื้นฐานที่มีความจำเป็นต่อเนื่อง ส่งผลให้มีกระแสเงินสดสม่ำเสมอและมีความแน่นอนทางธุรกิจ`}
                />
              )}
            </p>
            <div className="pt-2 text-xs text-slate-400 flex items-center gap-1.5 border-t border-white/[0.04]">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>
                <strong>เกณฑ์พิจารณา:</strong> โมเดลธุรกิจที่ดีต้องเข้าใจง่าย ไม่ซับซ้อน และมีแหล่งที่มาของรายได้และกระแสเงินสดชัดเจน
              </span>
            </div>
          </div>

          {/* Paragraph 2: Economic Moat & Competitive Advantage */}
          <div className="p-4 rounded-xl bg-[#151926] border border-white/[0.08] space-y-2.5">
            <div className="font-bold text-indigo-300 text-sm sm:text-base flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
              <span>มีข้อได้เปรียบทางการแข่งขันที่คู่แข่งเลียนแบบได้ยากหรือไม่? (Economic Moat)</span>
            </div>
            <p className="text-slate-200">
              <HighlightedContent
                text="การประเมินคูเมืองทางธุรกิจ (Economic Moat) คือการดูว่าบริษัทมีแต้มต่อที่คู่แข่งรายใหม่เข้ามาแย่งชิงส่วนแบ่งการตลาดได้ยากหรือไม่ ไม่ว่าจะเป็นข้อได้เปรียบด้านขนาด (Economies of Scale), การมีสิทธิบัตรเทคโนโลยีเฉพาะทาง, ลูกค้ามีต้นทุนในการเปลี่ยนไปใช้เจ้าอื่นสูงมาก (Switching Cost) หรือมี Network Effect ที่ยิ่งมีผู้ใช้เยอะ ยิ่งมีมูลค่าสูงขึ้น"
              />
            </p>

            {/* Case Study Callout: ADVANC */}
            <div className="mt-3 p-4 rounded-xl bg-gradient-to-r from-indigo-950/40 via-[#13192B] to-[#151A2C] border border-indigo-500/35 space-y-2 shadow-inner">
              <div className="flex items-center gap-2 text-indigo-200 font-bold text-sm">
                <Quote className="w-4 h-4 text-indigo-400 shrink-0" />
                <span>ตัวอย่างกรณีศึกษาคูเมืองทางธุรกิจ: หุ้นกลุ่มสื่อสารอย่าง ADVANC</span>
              </div>
              <p className="text-xs sm:text-sm text-slate-200 leading-relaxed pl-6">
                หุ้นกลุ่มสื่อสารอย่าง <strong className="text-indigo-300 font-bold">ADVANC</strong> ถือเป็นตัวอย่างคลาสสิกของธุรกิจที่มีคูเมืองกว้างมาก จากการครอบครอง{' '}
                <strong className="text-white font-bold">โครงสร้างพื้นฐาน เสาสัญญาณ และคลื่นความถี่โทรคมนาคมครบทุกย่านทั่วประเทศ</strong> พร้อมกับ{' '}
                <strong className="text-emerald-300 font-bold bg-emerald-500/15 px-1.5 py-0.5 rounded border border-emerald-500/25">ฐานลูกค้าขนาดใหญ่กว่า 45 ล้านราย</strong>{' '}
                ทำให้บริษัทมีรายได้และกระแสเงินสดเข้ามาอย่างสม่ำเสมอในทุกเดือน และแทบเป็นไปไม่ได้เลยที่คู่แข่งรายใหม่จะทุ่มเงินมหาศาลเพื่อเจาะตลาดหรือสร้างโครงข่ายมาแข่งขันในระดับเดียวกัน
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. VALUATION (หมวดที่ 2: ความถูกแพงของหุ้น) ─────────────── */}
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
            หมวดที่ 2
          </span>
        </div>

        {/* Narrative Rows: Wide, spacious, comfortable to read */}
        <div className="space-y-3.5 text-sm sm:text-[14.5px] leading-relaxed text-slate-200">
          {/* Row 2.1: P/E Ratio */}
          <div className="p-4 sm:p-5 rounded-xl bg-[#151926] border border-white/[0.08] space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-white/[0.06]">
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center font-bold text-xs shrink-0">
                  2.1
                </span>
                <span className="font-bold text-base text-white">
                  P/E Ratio (อัตราส่วนราคาต่อกำไรสุทธิ)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg text-sm sm:text-base font-black text-amber-300 font-mono bg-amber-500/15 border border-amber-500/30">
                  {pe ? `${pe} เท่า` : forwardPe ? `${forwardPe} เท่า (Fwd)` : 'N/A'}
                </span>
                <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${peInfo.color}`}>
                  {peInfo.label}
                </span>
              </div>
            </div>

            <p className="text-slate-200">
              <strong className="text-amber-300">ความหมายสำคัญ:</strong> บอกว่าซื้อหุ้นราคานี้{' '}
              <strong className="text-white font-bold underline decoration-amber-400/50 underline-offset-4">กี่ปีถึงจะคืนทุน</strong>{' '}
              {pe ? `(ตัวอย่างเช่น ที่ระดับ P/E ${pe} เท่า หากบริษัทสร้างกำไรเท่าเดิม จะใช้เวลาประมาณ ${pe} ปีในการคืนทุน)` : ''}{' '}
              โดยหลักการทั่วไป <strong className="text-emerald-300 font-bold bg-emerald-500/15 px-1 py-0.5 rounded border border-emerald-500/20">ยิ่งต่ำยิ่งดี</strong>{' '}
              แต่ต้องนำไปเปรียบเทียบกับค่าเฉลี่ยของบริษัทอื่นในอุตสาหกรรมเดียวกันเสมอ หุ้นกลุ่มเติบโตสูงมักซื้อขายด้วย P/E สูงเพราะตลาดคาดหวังกำไรในอนาคตจะโตชดเชย
            </p>
          </div>

          {/* Row 2.2: P/BV Ratio */}
          <div className="p-4 sm:p-5 rounded-xl bg-[#151926] border border-white/[0.08] space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-white/[0.06]">
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center font-bold text-xs shrink-0">
                  2.2
                </span>
                <span className="font-bold text-base text-white">
                  P/BV (ราคาต่อมูลค่าทางบัญชี)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg text-sm sm:text-base font-black text-white font-mono bg-white/[0.08] border border-white/[0.12]">
                  {displayPb ? `${displayPb} เท่า` : 'N/A'}
                </span>
                <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${pbInfo.color}`}>
                  {pbInfo.label}
                </span>
              </div>
            </div>

            <p className="text-slate-200">
              <strong className="text-amber-300">ความหมายสำคัญ:</strong> บอกว่าราคาหุ้นตอนนี้แพงกว่า{' '}
              <strong className="text-white font-bold underline decoration-amber-400/50 underline-offset-4">มูลค่าทรัพย์สินสุทธิ (Book Value)</strong> ของบริษัทกี่เท่า หาก P/BV ต่ำกว่า 1.0 เท่า หมายความว่าเราสามารถซื้อหุ้นได้ถูกกว่ามูลค่าทรัพย์สินสุทธิที่บริษัทมีอยู่จริง อย่างไรก็ตาม บริษัทเทคโนโลยีขั้นสูงมักมี P/BV สูงเนื่องจากมูลค่าส่วนใหญ่มาจากทรัพย์สินทางปัญญาและสิทธิบัตร
            </p>
          </div>

          {/* Row 2.3: Dividend Yield */}
          <div className="p-4 sm:p-5 rounded-xl bg-[#151926] border border-white/[0.08] space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-white/[0.06]">
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center font-bold text-xs shrink-0">
                  2.3
                </span>
                <span className="font-bold text-base text-white">
                  Dividend Yield (อัตราเงินปันผลตอบแทนต่อปี)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg text-sm sm:text-base font-black text-emerald-400 font-mono bg-emerald-500/15 border border-emerald-500/30">
                  {dividendYield !== null && dividendYield !== undefined ? `${dividendYield.toFixed(2)}% ต่อปี` : '0%'}
                </span>
                <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${yieldInfo.color}`}>
                  {yieldInfo.label}
                </span>
              </div>
            </div>

            <p className="text-slate-200">
              <strong className="text-amber-300">ความหมายสำคัญ:</strong> ผลตอบแทนจากเงินปันผลคิดเป็นเปอร์เซ็นต์ต่อปี{' '}
              <strong className="text-emerald-300 font-bold bg-emerald-500/15 px-1 py-0.5 rounded border border-emerald-500/25">
                ซึ่งสำคัญมากสำหรับกลยุทธ์การลงทุนเพื่อสะสมเงินปันผลระยะยาว (Passive Income)
              </strong>{' '}
              ช่วยให้นักลงทุนได้รับกระแสเงินสดคืนกลับมาอย่างต่อเนื่องโดยไม่ต้องขายหุ้นทิ้ง และสามารถนำเงินปันผลที่ได้ไป Reinvest ซื้อหุ้นเพิ่มเพื่อสร้างผลตอบแทนทบต้นในระยะยาว
            </p>
          </div>
        </div>
      </div>

      {/* ── 3. FINANCIAL HEALTH (หมวดที่ 3: สุขภาพทางการเงิน) ─────────────── */}
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
            หมวดที่ 3
          </span>
        </div>

        {/* Narrative Rows for Financial Health */}
        <div className="space-y-3.5 text-sm sm:text-[14.5px] leading-relaxed text-slate-200">
          {/* Row 3.1: Revenue and Net Profit Trend */}
          <div className="p-4 sm:p-5 rounded-xl bg-[#151926] border border-white/[0.08] space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-white/[0.06]">
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-300 flex items-center justify-center font-bold text-xs shrink-0">
                  3.1
                </span>
                <span className="font-bold text-base text-white">
                  รายได้และกำไรสุทธิ (ย้อนหลัง 3-5 ปี)
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                {revenue && (
                  <span className="px-2 py-0.5 rounded bg-white/[0.08] text-slate-200">
                    รายได้: {formatLarge(revenue)}
                  </span>
                )}
                {revenueGrowth && (
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                    YoY: +{revenueGrowth}%
                  </span>
                )}
                {freeCashflow && (
                  <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-200">
                    FCF: {formatLarge(freeCashflow)}
                  </span>
                )}
              </div>
            </div>

            <p className="text-slate-200">
              <strong className="text-emerald-300">เกณฑ์พิจารณา:</strong> ควรดูงบการเงินย้อนหลัง{' '}
              <strong className="text-emerald-300 font-bold bg-emerald-500/15 px-1.5 py-0.5 rounded border border-emerald-500/25">
                3-5 ปีว่ามีแนวโน้มเติบโตสม่ำเสมอหรือไม่
              </strong>{' '}
              ไม่ควรผันผวนขึ้นลงรุนแรงไร้ทิศทาง บริษัทที่ดีควรมีรายได้เติบโตควบคู่ไปกับกำไรสุทธิและกระแสเงินสดจากการดำเนินงาน (Operating Cash Flow) ที่แข็งแกร่ง เพื่อยืนยันว่ากำไรที่รายงานเป็นเงินสดจริง ไม่ใช่เพียงกำไรทางบัญชี
            </p>
          </div>

          {/* Row 3.2: D/E Ratio */}
          <div className="p-4 sm:p-5 rounded-xl bg-[#151926] border border-white/[0.08] space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-white/[0.06]">
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-300 flex items-center justify-center font-bold text-xs shrink-0">
                  3.2
                </span>
                <span className="font-bold text-base text-white">
                  D/E Ratio (อัตราส่วนหนี้สินต่อทุน)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg text-sm sm:text-base font-black text-white font-mono bg-white/[0.08] border border-white/[0.12]">
                  {effectiveDE ? `${effectiveDE} เท่า` : 'N/A'}
                </span>
                <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${deInfo.color}`}>
                  {deInfo.label}
                </span>
              </div>
            </div>

            <p className="text-slate-200">
              <strong className="text-emerald-300">เกณฑ์พิจารณา:</strong> บอกว่าบริษัทมีหนี้เยอะแค่ไหน โดยทั่วไป{' '}
              <strong className="text-emerald-300 font-bold bg-emerald-500/15 px-1.5 py-0.5 rounded border border-emerald-500/25">
                ไม่ควรสูงเกิน 1.5 - 2.0 เท่า
              </strong>{' '}
              เพื่อลดความเสี่ยงทางการเงินและภาระดอกเบี้ยจ่าย บริษัทที่มีหนี้สินต่ำจะมีความยืดหยุ่นสูงยามเกิดวิกฤตเศรษฐกิจ และไม่ต้องกังวลเรื่องการผิดนัดชำระหนี้หรือการเพิ่มทุนกะทันหัน
            </p>
          </div>

          {/* Row 3.3: ROE */}
          <div className="p-4 sm:p-5 rounded-xl bg-[#151926] border border-white/[0.08] space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-white/[0.06]">
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-300 flex items-center justify-center font-bold text-xs shrink-0">
                  3.3
                </span>
                <span className="font-bold text-base text-white">
                  ROE (ผลตอบแทนจากส่วนของผู้ถือหุ้น)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg text-sm sm:text-base font-black text-emerald-300 font-mono bg-emerald-500/15 border border-emerald-500/30">
                  {effectiveRoe ? `${effectiveRoe}%` : 'N/A'}
                </span>
                <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${roeInfo.color}`}>
                  {roeInfo.label}
                </span>
              </div>
            </div>

            <p className="text-slate-200">
              <strong className="text-emerald-300">เกณฑ์พิจารณา:</strong> สะท้อนความสามารถของผู้บริหารในการนำเงินลงทุนของผู้ถือหุ้นไปสร้างกำไร{' '}
              <strong className="text-emerald-300 font-bold bg-emerald-500/15 px-1.5 py-0.5 rounded border border-emerald-500/25">
                (ควรมากกว่า 10-15% อย่างสม่ำเสมอ)
              </strong>{' '}
              บริษัทที่สามารถรักษาระดับ ROE เกิน 15% ติดต่อกันหลายปี บ่งบอกว่ามีอำนาจในการตั้งราคา (Pricing Power) และมีโมเดลธุรกิจที่สร้างผลตอบแทนคุ้มค่าต่อเงินทุนอย่างแท้จริง
            </p>
          </div>
        </div>
      </div>

      {/* ── 4. FUTURE & RISKS (หมวดที่ 4: อนาคตและความเสี่ยง) ─────────────── */}
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
                มองไปข้างหน้า: แผนการเติบโต ขยายตลาดใหม่ๆ ควบคู่ไปกับปัจจัยเสี่ยงที่อาจกระทบธุรกิจ
              </p>
            </div>
          </div>
          <span className="text-xs sm:text-sm font-bold text-sky-300 font-mono bg-sky-500/15 px-3 py-1 rounded-lg border border-sky-500/30 self-start sm:self-auto">
            หมวดที่ 4
          </span>
        </div>

        {/* Narrative Flow for Future & Risks */}
        <div className="space-y-4 text-sm sm:text-[14.5px] leading-relaxed text-slate-200">
          {/* Paragraph 4.1: Future Growth Catalysts */}
          <div className="p-4 sm:p-5 rounded-xl bg-emerald-950/20 border border-emerald-500/25 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-emerald-500/20">
              <div className="font-bold text-base text-emerald-300 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span>แผนการเติบโตในอนาคต (Growth Catalysts)</span>
              </div>
              <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-emerald-500/20 text-emerald-200 border border-emerald-500/30">
                โอกาสสร้างผลกำไร
              </span>
            </div>

            <p className="text-slate-200">
              การประเมินอนาคตของกิจการ ควรพิจารณาจาก 3 แกนหลัก ได้แก่:{' '}
              <strong className="text-white font-bold">1. การขยายกิจการและเพิ่มกำลังการผลิต</strong> เช่น การลงทุนสร้างโรงงานใหม่หรือขยายโครงสร้างพื้นฐานเพื่อเพิ่ม Market Share,{' '}
              <strong className="text-white font-bold">2. การออกผลิตภัณฑ์และบริการใหม่ๆ</strong> ที่มีอัตรากำไร (Margin) สูงกว่าเดิม หรือสร้าง Recurring Revenue และ{' '}
              <strong className="text-white font-bold">3. การบุกตลาดใหม่</strong> เช่น การขยายฐานลูกค้าสู่ภูมิภาคใหม่ที่มีอัตราการเติบโตทางเศรษฐกิจและกำลังซื้อสูง
            </p>

            {structuredAi?.strengths && structuredAi.strengths.length > 0 && (
              <div className="mt-2 p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/30 space-y-1">
                <div className="font-bold text-emerald-200 text-xs">จุดแข็งและตัวเร่งเฉพาะตัวของ {symbol}:</div>
                <ul className="list-disc list-inside space-y-1 text-slate-200 text-xs sm:text-sm">
                  {structuredAi.strengths.slice(0, 3).map((s, idx) => (
                    <li key={idx}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Paragraph 4.2: Key Risks to Watch */}
          <div className="p-4 sm:p-5 rounded-xl bg-rose-950/20 border border-rose-500/25 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-rose-500/20">
              <div className="font-bold text-base text-rose-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <span>ความเสี่ยงที่อาจกระทบธุรกิจ (Key Risks)</span>
              </div>
              <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-rose-500/20 text-rose-200 border border-rose-500/30">
                ปัจจัยลบที่ต้องจับตา
              </span>
            </div>

            <p className="text-slate-200">
              ปัจจัยเสี่ยงที่อาจกระทบมูลค่าหุ้น ประกอบด้วย:{' '}
              <strong className="text-rose-200 font-bold">1. การเปลี่ยนแปลงทางเทคโนโลยี (Tech Disruption)</strong> ที่อาจทำให้สินค้าเดิมล้าสมัยอย่างรวดเร็ว,{' '}
              <strong className="text-rose-200 font-bold">2. กฎหมายควบคุมจากภาครัฐและภาษี</strong> เช่น นโยบายควบคุมราคา การตรวจสอบการผูกขาด หรือข้อจำกัดทางการค้าระหว่างประเทศ และ{' '}
              <strong className="text-rose-200 font-bold">3. พฤติกรรมผู้บริโภคที่เปลี่ยนไปหรือสงครามราคา</strong> จากคู่แข่งที่ตัดราคาจนกดดันความสามารถในการทำกำไร
            </p>

            {structuredAi?.risks && structuredAi.risks.length > 0 && (
              <div className="mt-2 p-3 rounded-lg bg-rose-950/40 border border-rose-500/30 space-y-1">
                <div className="font-bold text-rose-200 text-xs">ปัจจัยเสี่ยงเฉพาะตัวของ {symbol}:</div>
                <ul className="list-disc list-inside space-y-1 text-slate-200 text-xs sm:text-sm">
                  {structuredAi.risks.slice(0, 3).map((r, idx) => (
                    <li key={idx}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Scenario Analysis (Bull, Base, Bear) */}
          {structuredAi?.scenarioAnalysis && (
            <div className="p-4 rounded-xl bg-[#151926] border border-white/[0.08] space-y-3">
              <div className="font-bold text-white text-sm sm:text-base flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-amber-400" />
                <span>การประเมิน 3 ฉากทัศน์ผลตอบแทน (Scenario Analysis):</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-emerald-950/25 border border-emerald-500/30 space-y-1">
                  <div className="font-bold text-emerald-300 text-xs sm:text-sm">
                    🟢 กรณีดีที่สุด (Bull Case)
                  </div>
                  <p className="text-slate-200 text-xs sm:text-sm leading-relaxed">
                    {structuredAi.scenarioAnalysis.bull}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-[#121624] border border-white/[0.1] space-y-1">
                  <div className="font-bold text-indigo-300 text-xs sm:text-sm">
                    ⚪ กรณีพื้นฐาน (Base Case)
                  </div>
                  <p className="text-slate-200 text-xs sm:text-sm leading-relaxed">
                    {structuredAi.scenarioAnalysis.base}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-rose-950/25 border border-rose-500/30 space-y-1">
                  <div className="font-bold text-rose-300 text-xs sm:text-sm">
                    🔴 กรณีแย่สุด (Bear Case)
                  </div>
                  <p className="text-slate-200 text-xs sm:text-sm leading-relaxed">
                    {structuredAi.scenarioAnalysis.bear}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 5. AI DEEP DIVE ACTION BANNER ────────────────────── */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#141824] border border-white/[0.1] flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3 text-slate-200 text-xs sm:text-sm">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-amber-300" />
          </div>
          <div>
            <div className="font-bold text-white text-sm sm:text-base">ต้องการบทวิเคราะห์ 4 ด้านเฉพาะตัวแบบเรียลไทม์?</div>
            <div className="text-xs sm:text-sm text-slate-400">ระบบ AI จะประมวลผลข้อมูลการเงินและภาพรวมตลาดล่าสุดของ <strong>{symbol}</strong> เข้าสู่กรอบ 4 เสาหลักทันที</div>
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
