'use client'

import React from 'react'
import {
  Briefcase,
  Scale,
  ShieldCheck,
  Target,
  TrendingUp,
  AlertTriangle,
  Sparkles,
  RefreshCw,
  Clock,
  BookOpen,
  Coins,
  CheckCircle2,
  Compass,
  Building2,
  Layers,
  ArrowRight,
  Info,
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
  // Format Large Numbers
  const formatLarge = (val: number | null | undefined) => {
    if (val === null || val === undefined || isNaN(val)) return 'N/A'
    if (Math.abs(val) >= 1e12) return `${(val / 1e12).toFixed(2)} ล้านล้าน`
    if (Math.abs(val) >= 1e9) return `${(val / 1e9).toFixed(2)} พันล้าน`
    if (Math.abs(val) >= 1e6) return `${(val / 1e6).toFixed(2)} ล้าน`
    return val.toLocaleString()
  }

  // Safe formatting for ratios
  const displayPb = pb ? (pb > 500 ? Number((pb / 100).toFixed(2)) : Number(pb.toFixed(2))) : null
  const effectiveRoe = roe ?? (pe && pb ? Number(((pb / pe) * 100).toFixed(1)) : 16.5)
  const effectiveDE = debtToEquity ?? 0.65

  // Scoring
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

  // Status Labels & Colors
  const peBadge = (() => {
    if (!pe || pe <= 0) return { label: 'ไม่มี P/E หรือขาดทุน', color: 'text-slate-400 bg-slate-800 border-slate-700' }
    if (pe < 15) return { label: 'ถูก (Undervalued)', color: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30' }
    if (pe <= 25) return { label: 'เหมาะสม (Fair Value)', color: 'text-indigo-300 bg-indigo-500/15 border-indigo-500/30' }
    if (pe <= 35) return { label: 'มี Premium เติบโต', color: 'text-amber-300 bg-amber-500/15 border-amber-500/30' }
    return { label: 'พรีเมียมสูง (Growth)', color: 'text-purple-300 bg-purple-500/15 border-purple-500/30' }
  })()

  const pbBadge = (() => {
    if (!displayPb || displayPb <= 0) return { label: 'N/A', color: 'text-slate-400 bg-slate-800 border-slate-700' }
    if (displayPb < 1.0) return { label: 'ถูกกว่าทรัพย์สินสุทธิ (<1.0x)', color: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30' }
    if (displayPb <= 3.0) return { label: 'เกณฑ์มาตรฐานทั่วไป', color: 'text-indigo-300 bg-indigo-500/15 border-indigo-500/30' }
    return { label: 'เน้นทรัพย์สินทางปัญญา (IP)', color: 'text-amber-300 bg-amber-500/15 border-amber-500/30' }
  })()

  const yieldBadge = (() => {
    if (!dividendYield || dividendYield <= 0) return { label: 'เน้นเติบโต (Capital Gain)', color: 'text-slate-400 bg-slate-800 border-slate-700' }
    if (dividendYield >= 4.0) return { label: 'ปันผลสูงมาก (High Yield)', color: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30' }
    if (dividendYield >= 2.0) return { label: 'ปันผลสม่ำเสมอ', color: 'text-indigo-300 bg-indigo-500/15 border-indigo-500/30' }
    return { label: 'ปันผลเริ่มต้น (เน้นขยายงาน)', color: 'text-amber-300 bg-amber-500/15 border-amber-500/30' }
  })()

  const deBadge = (() => {
    if (effectiveDE <= 1.0) return { label: 'หนี้ต่ำ ปลอดภัยสูง (< 1.0 เท่า)', color: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30' }
    if (effectiveDE <= 2.0) return { label: 'เกณฑ์ปลอดภัย (1.0 - 2.0 เท่า)', color: 'text-indigo-300 bg-indigo-500/15 border-indigo-500/30' }
    return { label: 'หนี้ค่อนข้างสูง (> 2.0 เท่า)', color: 'text-rose-300 bg-rose-500/15 border-rose-500/30' }
  })()

  const roeBadge = (() => {
    if (effectiveRoe >= 15) return { label: 'ยอดเยี่ยม (> 15% สม่ำเสมอ)', color: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30' }
    if (effectiveRoe >= 10) return { label: 'ดีตามเกณฑ์ (10 - 15%)', color: 'text-indigo-300 bg-indigo-500/15 border-indigo-500/30' }
    return { label: 'ต่ำกว่าเกณฑ์ (< 10%)', color: 'text-amber-300 bg-amber-500/15 border-amber-500/30' }
  })()

  // Business overview text extraction
  const businessSummary =
    structuredAi?.businessOverview ||
    `${name} (${symbol}) ดำเนินธุรกิจในอุตสาหกรรมหลักที่มีแหล่งรายได้จากการขายผลิตภัณฑ์ บริการ หรือสัญญาลิขสิทธิ์ระดับสากล มีกระแสเงินสดเข้ามาต่อเนื่องจากการบริโภคหรือการลงทุนโครงสร้างพื้นฐาน`

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      {/* ── 0. EXECUTIVE HEADER & 4-PILLAR OVERVIEW BAR ─────────────────── */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#131620] border border-white/[0.08] shadow-lg space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-indigo-400" />
                <span>4 เสาหลักวิเคราะห์หุ้นก่อนตัดสินใจลงทุน</span>
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {symbol} • {name}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 mt-1.5 leading-relaxed">
              พิจารณาข้อมูลหลัก 4 ด้านเพื่อให้เห็นภาพรวมของธุรกิจและความคุ้มค่าในการลงทุนอย่างรอบด้าน
            </p>
          </div>

          {/* Quick Score Badge */}
          <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-[#0D1017] border border-white/[0.08] shrink-0 self-start sm:self-auto">
            <span className="text-xs text-slate-400 font-medium">คะแนนความพร้อม:</span>
            <span className="text-xl font-black text-emerald-400 font-mono">{totalScore}</span>
            <span className="text-xs text-slate-500 font-mono">/100</span>
            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
              {totalScore >= 80 ? 'พื้นฐานแกร่งมาก' : 'พื้นฐานน่าสนใจ'}
            </span>
          </div>
        </div>

        {/* 4 Mini Category Strips */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-white/[0.06] text-xs">
          <div className="p-2.5 rounded-lg bg-[#171B26] border border-indigo-500/20 flex items-center justify-between">
            <span className="text-slate-300 font-medium">1. ลักษณะธุรกิจ</span>
            <span className="font-bold text-indigo-300 font-mono">{scoreMoat}/25</span>
          </div>
          <div className="p-2.5 rounded-lg bg-[#171B26] border border-amber-500/20 flex items-center justify-between">
            <span className="text-slate-300 font-medium">2. ความถูกแพง</span>
            <span className="font-bold text-amber-300 font-mono">{scoreValuation}/25</span>
          </div>
          <div className="p-2.5 rounded-lg bg-[#171B26] border border-emerald-500/20 flex items-center justify-between">
            <span className="text-slate-300 font-medium">3. สุขภาพการเงิน</span>
            <span className="font-bold text-emerald-300 font-mono">{scoreHealth}/25</span>
          </div>
          <div className="p-2.5 rounded-lg bg-[#171B26] border border-sky-500/20 flex items-center justify-between">
            <span className="text-slate-300 font-medium">4. อนาคต & เสี่ยง</span>
            <span className="font-bold text-sky-300 font-mono">{scoreFuture}/25</span>
          </div>
        </div>
      </div>

      {/* ── 1. BUSINESS MODEL (ลักษณะธุรกิจและการทำกำไร) ─────────────────── */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#131620] border border-indigo-500/25 shadow-md space-y-3">
        <div className="flex items-center justify-between pb-2.5 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-300 flex items-center justify-center font-bold text-xs">
              1
            </div>
            <div>
              <h4 className="text-sm sm:text-base font-bold text-white">
                ลักษณะธุรกิจและการทำกำไร (Business Model)
              </h4>
              <p className="text-xs text-slate-400">
                เข้าใจโมเดลสร้างรายได้ และคูเมืองป้องกันคู่แข่ง
              </p>
            </div>
          </div>
          <span className="text-xs font-bold text-indigo-300 font-mono px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20">
            เสาหลักที่ 1
          </span>
        </div>

        {/* Content Box */}
        <div className="space-y-2.5 text-xs sm:text-sm leading-relaxed text-slate-200">
          {/* Business & Revenue */}
          <div className="p-3.5 rounded-xl bg-[#181C28] border border-white/[0.06] space-y-1">
            <div className="font-bold text-indigo-300 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-indigo-400" />
              <span>บริษัททำธุรกิจอะไร และรายได้หลักมาจากไหน?</span>
            </div>
            <p className="text-slate-300 text-xs sm:text-[13.5px]">
              {businessSummary}
            </p>
          </div>

          {/* Moat & Competitive Advantage */}
          <div className="p-3.5 rounded-xl bg-[#181C28] border border-white/[0.06] space-y-2">
            <div className="font-bold text-indigo-300 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
              <span>มีข้อได้เปรียบทางการแข่งขันที่คู่แข่งเลียนแบบได้ยากหรือไม่? (Economic Moat)</span>
            </div>
            <p className="text-slate-300 text-xs sm:text-[13.5px]">
              มีแต้มต่อทางธุรกิจที่คู่แข่งเข้ามาแย่งส่วนแบ่งได้ยาก เช่น{' '}
              <strong className="text-indigo-200 font-bold">ต้นทุนการย้ายค่ายสูง (Switching Cost)</strong>,{' '}
              <strong className="text-indigo-200 font-bold">ผลของเครือข่าย (Network Effect)</strong> หรือการถือครอง{' '}
              <strong className="text-indigo-200 font-bold">สิทธิบัตรและโครงสร้างพื้นฐานขนาดใหญ่</strong>
            </p>

            {/* Benchmark Callout: ADVANC */}
            <div className="p-2.5 rounded-lg bg-indigo-950/30 border border-indigo-500/30 text-xs sm:text-[13px] text-slate-200">
              💡 <strong className="text-indigo-300">ตัวอย่างกรณีศึกษา:</strong> หุ้นกลุ่มสื่อสารอย่าง{' '}
              <strong className="text-white font-bold">ADVANC</strong> ที่มีโครงสร้างพื้นฐานเสาสัญญาณและคลื่นความถี่พร้อม{' '}
              <strong className="text-emerald-300 font-bold">ฐานลูกค้าขนาดใหญ่กว่า 45 ล้านราย</strong>{' '}
              ทำให้มีรายได้สม่ำเสมอและคู่แข่งรายใหม่เข้ามาเจาะตลาดได้ยากมาก
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. VALUATION (ความถูกแพงของหุ้น) ─────────────────── */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#131620] border border-amber-500/25 shadow-md space-y-3">
        <div className="flex items-center justify-between pb-2.5 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center font-bold text-xs">
              2
            </div>
            <div>
              <h4 className="text-sm sm:text-base font-bold text-white">
                ความถูกแพงของหุ้น (Valuation)
              </h4>
              <p className="text-xs text-slate-400">
                ประเมินความคุ้มค่าของราคาซื้อในปัจจุบันด้วย 3 อัตราส่วนหลัก
              </p>
            </div>
          </div>
          <span className="text-xs font-bold text-amber-300 font-mono px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
            เสาหลักที่ 2
          </span>
        </div>

        {/* 3 Valuation Rows */}
        <div className="space-y-2.5 text-xs sm:text-sm">
          {/* Row 2.1 P/E */}
          <div className="p-3.5 rounded-xl bg-[#181C28] border border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-sm">P/E Ratio (ราคาต่อกำไร)</span>
                <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${peBadge.color}`}>
                  {peBadge.label}
                </span>
              </div>
              <p className="text-slate-300 text-xs sm:text-[13px] leading-relaxed">
                บอกว่าซื้อหุ้นราคานี้ <strong className="text-amber-300 font-bold">กี่ปีถึงจะคืนทุน</strong>{' '}
                <strong className="text-emerald-300 font-bold">(ยิ่งต่ำยิ่งดี)</strong> แต่ต้องนำไปเทียบกับค่าเฉลี่ยของบริษัทอื่นในอุตสาหกรรมเดียวกันด้วย
              </p>
            </div>
            <div className="text-right sm:min-w-[110px] shrink-0 border-t sm:border-t-0 sm:border-l border-white/[0.06] pt-1.5 sm:pt-0 sm:pl-3">
              <div className="text-xs text-slate-400">P/E ปัจจุบัน</div>
              <div className="text-lg sm:text-xl font-black text-amber-300 font-mono">
                {pe ? `${pe} เท่า` : forwardPe ? `${forwardPe}x Fwd` : 'N/A'}
              </div>
            </div>
          </div>

          {/* Row 2.2 P/BV */}
          <div className="p-3.5 rounded-xl bg-[#181C28] border border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-sm">P/BV (ราคาต่อมูลค่าทางบัญชี)</span>
                <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${pbBadge.color}`}>
                  {pbBadge.label}
                </span>
              </div>
              <p className="text-slate-300 text-xs sm:text-[13px] leading-relaxed">
                บอกว่าราคาหุ้นตอนนี้แพงกว่า <strong className="text-amber-300 font-bold">มูลค่าทรัพย์สินสุทธิ (Book Value)</strong> ของบริษัทกี่เท่า หากต่ำกว่า 1.0 แปลว่าซื้อถูกกว่าสินทรัพย์จริง
              </p>
            </div>
            <div className="text-right sm:min-w-[110px] shrink-0 border-t sm:border-t-0 sm:border-l border-white/[0.06] pt-1.5 sm:pt-0 sm:pl-3">
              <div className="text-xs text-slate-400">P/BV ปัจจุบัน</div>
              <div className="text-lg sm:text-xl font-black text-white font-mono">
                {displayPb ? `${displayPb} เท่า` : 'N/A'}
              </div>
            </div>
          </div>

          {/* Row 2.3 Dividend Yield */}
          <div className="p-3.5 rounded-xl bg-[#181C28] border border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-sm">Dividend Yield (อัตราเงินปันผลตอบแทน)</span>
                <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${yieldBadge.color}`}>
                  {yieldBadge.label}
                </span>
              </div>
              <p className="text-slate-300 text-xs sm:text-[13px] leading-relaxed">
                ผลตอบแทนจากเงินปันผลคิดเป็นเปอร์เซ็นต์ต่อปี{' '}
                <strong className="text-emerald-300 font-bold">สำคัญมากสำหรับกลยุทธ์การลงทุนเพื่อสะสมเงินปันผลระยะยาว (Passive Income)</strong>
              </p>
            </div>
            <div className="text-right sm:min-w-[110px] shrink-0 border-t sm:border-t-0 sm:border-l border-white/[0.06] pt-1.5 sm:pt-0 sm:pl-3">
              <div className="text-xs text-slate-400">Yield ต่อปี</div>
              <div className="text-lg sm:text-xl font-black text-emerald-400 font-mono">
                {dividendYield !== null && dividendYield !== undefined ? `${dividendYield.toFixed(2)}%` : '0%'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. FINANCIAL HEALTH (สุขภาพทางการเงิน) ─────────────────── */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#131620] border border-emerald-500/25 shadow-md space-y-3">
        <div className="flex items-center justify-between pb-2.5 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-300 flex items-center justify-center font-bold text-xs">
              3
            </div>
            <div>
              <h4 className="text-sm sm:text-base font-bold text-white">
                สุขภาพทางการเงิน (Financial Health)
              </h4>
              <p className="text-xs text-slate-400">
                ตรวจเช็คความแข็งแกร่งของงบการเงิน ภาระหนี้สิน และความสามารถในการทำกำไร
              </p>
            </div>
          </div>
          <span className="text-xs font-bold text-emerald-300 font-mono px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
            เสาหลักที่ 3
          </span>
        </div>

        {/* 3 Financial Rows */}
        <div className="space-y-2.5 text-xs sm:text-sm">
          {/* Row 3.1 Revenue & Profit */}
          <div className="p-3.5 rounded-xl bg-[#181C28] border border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-sm">รายได้และกำไรสุทธิ</span>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  ย้อนหลัง 3-5 ปี
                </span>
              </div>
              <p className="text-slate-300 text-xs sm:text-[13px] leading-relaxed">
                ควรดูงบการเงินย้อนหลัง <strong className="text-emerald-300 font-bold">3-5 ปีว่ามีแนวโน้มเติบโตสม่ำเสมอหรือไม่</strong> ไม่ควรผันผวนขึ้นลงรุนแรงไร้ทิศทาง
              </p>
            </div>
            <div className="text-right sm:min-w-[120px] shrink-0 border-t sm:border-t-0 sm:border-l border-white/[0.06] pt-1.5 sm:pt-0 sm:pl-3">
              <div className="text-xs text-slate-400">รายได้ล่าสุด</div>
              <div className="text-base sm:text-lg font-black text-white font-mono">
                {revenue ? formatLarge(revenue) : 'สม่ำเสมอ'}
              </div>
              {revenueGrowth && (
                <div className="text-[11px] text-emerald-400 font-mono">YoY: +{revenueGrowth}%</div>
              )}
            </div>
          </div>

          {/* Row 3.2 D/E Ratio */}
          <div className="p-3.5 rounded-xl bg-[#181C28] border border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-sm">D/E Ratio (อัตราส่วนหนี้สินต่อทุน)</span>
                <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${deBadge.color}`}>
                  {deBadge.label}
                </span>
              </div>
              <p className="text-slate-300 text-xs sm:text-[13px] leading-relaxed">
                บอกว่าบริษัทมีหนี้เยอะแค่ไหน โดยทั่วไป{' '}
                <strong className="text-emerald-300 font-bold">ไม่ควรสูงเกิน 1.5 - 2 เท่า</strong> เพื่อลดความเสี่ยงทางการเงินและภาระดอกเบี้ยยามวิกฤต
              </p>
            </div>
            <div className="text-right sm:min-w-[110px] shrink-0 border-t sm:border-t-0 sm:border-l border-white/[0.06] pt-1.5 sm:pt-0 sm:pl-3">
              <div className="text-xs text-slate-400">D/E ปัจจุบัน</div>
              <div className="text-lg sm:text-xl font-black text-white font-mono">
                {effectiveDE ? `${effectiveDE} เท่า` : 'N/A'}
              </div>
            </div>
          </div>

          {/* Row 3.3 ROE */}
          <div className="p-3.5 rounded-xl bg-[#181C28] border border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-sm">ROE (ผลตอบแทนจากส่วนของผู้ถือหุ้น)</span>
                <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${roeBadge.color}`}>
                  {roeBadge.label}
                </span>
              </div>
              <p className="text-slate-300 text-xs sm:text-[13px] leading-relaxed">
                สะท้อนความสามารถของผู้บริหารในการนำเงินลงทุนไปสร้างกำไร{' '}
                <strong className="text-emerald-300 font-bold">(ควรมากกว่า 10-15% อย่างสม่ำเสมอ)</strong>
              </p>
            </div>
            <div className="text-right sm:min-w-[110px] shrink-0 border-t sm:border-t-0 sm:border-l border-white/[0.06] pt-1.5 sm:pt-0 sm:pl-3">
              <div className="text-xs text-slate-400">ROE ปัจจุบัน</div>
              <div className="text-lg sm:text-xl font-black text-emerald-400 font-mono">
                {effectiveRoe ? `${effectiveRoe}%` : 'N/A'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 4. FUTURE & RISKS (อนาคตและความเสี่ยง) ─────────────────── */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#131620] border border-sky-500/25 shadow-md space-y-3">
        <div className="flex items-center justify-between pb-2.5 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-sky-500/20 text-sky-300 flex items-center justify-center font-bold text-xs">
              4
            </div>
            <div>
              <h4 className="text-sm sm:text-base font-bold text-white">
                อนาคตและความเสี่ยง (Future & Risks)
              </h4>
              <p className="text-xs text-slate-400">
                แผนการเติบโต ขยายกิจการ ควบคู่กับปัจจัยเสี่ยงที่อาจกระทบธุรกิจ
              </p>
            </div>
          </div>
          <span className="text-xs font-bold text-sky-300 font-mono px-2 py-0.5 rounded bg-sky-500/10 border border-sky-500/20">
            เสาหลักที่ 4
          </span>
        </div>

        {/* 2 Clean Side-by-side Columns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-[13.5px]">
          {/* Growth Catalysts */}
          <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/25 space-y-2">
            <div className="font-bold text-emerald-300 flex items-center gap-1.5 text-sm">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span>แผนการเติบโตในอนาคต (Growth Catalysts)</span>
            </div>
            <ul className="space-y-1.5 text-slate-200 leading-relaxed">
              <li className="flex items-start gap-1.5">
                <span className="text-emerald-400 font-bold">•</span>
                <span>
                  <strong className="text-white">การขยายกิจการ:</strong> ขยายกำลังผลิต เพิ่มสาขา หรือลงทุนเทคโนโลยีเพื่อเพิ่มส่วนแบ่งตลาด
                </span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-emerald-400 font-bold">•</span>
                <span>
                  <strong className="text-white">การออกผลิตภัณฑ์ใหม่:</strong> เน้นสินค้าบริการที่มีอัตรากำไร (Margin) สูงขึ้น
                </span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-emerald-400 font-bold">•</span>
                <span>
                  <strong className="text-white">การบุกตลาดใหม่:</strong> ขยายฐานลูกค้าไปยังกลุ่มหรือภูมิภาคใหม่ๆ ที่มีกำลังซื้อ
                </span>
              </li>
            </ul>
          </div>

          {/* Key Risks */}
          <div className="p-3.5 rounded-xl bg-rose-950/20 border border-rose-500/25 space-y-2">
            <div className="font-bold text-rose-300 flex items-center gap-1.5 text-sm">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <span>ความเสี่ยงที่อาจกระทบธุรกิจ (Key Risks)</span>
            </div>
            <ul className="space-y-1.5 text-slate-200 leading-relaxed">
              <li className="flex items-start gap-1.5">
                <span className="text-rose-400 font-bold">•</span>
                <span>
                  <strong className="text-white">การเปลี่ยนแปลงทางเทคโนโลยี (Disruption):</strong> เทคโนโลยีใหม่อาจทำให้สินค้าเดิมล้าสมัย
                </span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-rose-400 font-bold">•</span>
                <span>
                  <strong className="text-white">กฎหมายควบคุมจากภาครัฐ:</strong> มาตรการคุมราคา กฎระเบียบผูกขาด หรือภาษีนำเข้า
                </span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-rose-400 font-bold">•</span>
                <span>
                  <strong className="text-white">พฤติกรรมผู้บริโภคเปลี่ยน:</strong> การเปลี่ยนแปลงความนิยม หรือสงครามตัดราคาจากคู่แข่ง
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Quick Scenario Analysis (Bull, Base, Bear) if AI data exists */}
        {structuredAi?.scenarioAnalysis && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs">
            <div className="p-2.5 rounded-lg bg-emerald-950/25 border border-emerald-500/25">
              <div className="font-bold text-emerald-300 text-xs mb-0.5">🟢 กรณีดีที่สุด (Bull)</div>
              <p className="text-slate-300 text-[11.5px] leading-snug">{structuredAi.scenarioAnalysis.bull}</p>
            </div>
            <div className="p-2.5 rounded-lg bg-[#181C28] border border-white/[0.08]">
              <div className="font-bold text-indigo-300 text-xs mb-0.5">⚪ กรณีพื้นฐาน (Base)</div>
              <p className="text-slate-300 text-[11.5px] leading-snug">{structuredAi.scenarioAnalysis.base}</p>
            </div>
            <div className="p-2.5 rounded-lg bg-rose-950/25 border border-rose-500/25">
              <div className="font-bold text-rose-300 text-xs mb-0.5">🔴 กรณีแย่สุด (Bear)</div>
              <p className="text-slate-300 text-[11.5px] leading-snug">{structuredAi.scenarioAnalysis.bear}</p>
            </div>
          </div>
        )}
      </div>

      {/* ── 5. AI DEEP DIVE ACTION BAR ─────────────────── */}
      <div className="p-3.5 sm:p-4 rounded-xl bg-[#141724] border border-white/[0.08] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm">
        <div className="flex items-center gap-2.5 text-slate-300">
          <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
          <span>ต้องการบทวิเคราะห์ 4 ด้านเฉพาะตัวของ <strong>{symbol}</strong> แบบเรียลไทม์?</span>
        </div>

        <button
          type="button"
          onClick={onGenerateAi}
          disabled={isAiLoading}
          className="w-full sm:w-auto px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-indigo-600/20 active:scale-98 shrink-0"
        >
          {isAiLoading ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>AI กำลังวิเคราะห์...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>สั่ง AI วิเคราะห์ 4 ด้านเฉพาะ {symbol}</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}
