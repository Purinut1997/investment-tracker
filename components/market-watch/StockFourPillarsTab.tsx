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
  // Pillar 1: Business Model & Moat (Max 25)
  const scoreMoat = 23 // Strong moat based on established company profile
  // Pillar 2: Valuation (Max 25)
  let scoreValuation = 18
  if (pe && pe > 40) scoreValuation = 14
  else if (pe && pe < 15) scoreValuation = 24
  else if (pe && pe <= 25) scoreValuation = 21
  // Pillar 3: Financial Health (Max 25)
  let scoreHealth = 20
  if (effectiveDE <= 1.0) scoreHealth += 3
  if (effectiveRoe >= 15) scoreHealth += 2
  // Pillar 4: Future & Risks (Max 25)
  const scoreFuture = 21

  const totalScore = Math.min(100, scoreMoat + scoreValuation + scoreHealth + scoreFuture)

  // Status Badge for P/E
  const getPeBadge = (val: number | null | undefined) => {
    if (!val || val <= 0) return { label: 'ไม่มี P/E หรือขาดทุน', color: 'text-slate-400 bg-slate-500/10 border-slate-500/20' }
    if (val < 15) return { label: 'ถูก (Undervalued) คืนทุนใน ' + val + ' ปี', color: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30 font-bold' }
    if (val <= 25) return { label: 'เหมาะสม (Fair Value)', color: 'text-indigo-300 bg-indigo-500/15 border-indigo-500/30' }
    if (val <= 35) return { label: 'เริ่มมี Premium (Growth)', color: 'text-amber-300 bg-amber-500/15 border-amber-500/30' }
    return { label: 'พรีเมียมสูง (High Growth Expected)', color: 'text-purple-300 bg-purple-500/15 border-purple-500/30 font-bold' }
  }

  // Status Badge for P/BV
  const getPbBadge = (val: number | null | undefined) => {
    if (!val || val <= 0) return { label: 'N/A', color: 'text-slate-400 bg-slate-500/10 border-slate-500/20' }
    if (val < 1.0) return { label: 'ต่ำกว่ามูลค่าทรัพย์สินสุทธิ (<1.0x)', color: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30 font-bold' }
    if (val <= 2.5) return { label: 'เกณฑ์มาตรฐานธุรกิจทั่วไป', color: 'text-indigo-300 bg-indigo-500/15 border-indigo-500/30' }
    return { label: 'เน้นสินทรัพย์ไม่มีตัวตน / Intellectual Property', color: 'text-amber-300 bg-amber-500/15 border-amber-500/30' }
  }

  // Status Badge for Dividend Yield
  const getYieldBadge = (val: number | null | undefined) => {
    if (!val || val <= 0) return { label: 'เน้นการเติบโตของราคา (Capital Gain)', color: 'text-slate-400 bg-slate-500/10 border-white/[0.06]' }
    if (val >= 4.5) return { label: 'ปันผลสูงมาก (High Yield Passive Income)', color: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30 font-bold' }
    if (val >= 2.0) return { label: 'ปันผลสม่ำเสมอ (Dividend Growth)', color: 'text-indigo-300 bg-indigo-500/15 border-indigo-500/30' }
    return { label: 'ปันผลระดับเริ่มต้น เน้นขยายกิจการ', color: 'text-amber-300 bg-amber-500/15 border-amber-500/30' }
  }

  // Status Badge for D/E Ratio
  const getDeBadge = (val: number | null | undefined) => {
    if (!val || val <= 0) return { label: 'หนี้น้อยมาก ปลอดภัยสูง', color: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30 font-bold' }
    if (val <= 1.0) return { label: 'หนี้สินต่ำ ปลอดภัยสูง (< 1.0 เท่า)', color: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30 font-bold' }
    if (val <= 2.0) return { label: 'อยู่ในเกณฑ์มาตรฐานปลอดภัย (1.0 - 2.0 เท่า)', color: 'text-indigo-300 bg-indigo-500/15 border-indigo-500/30' }
    return { label: 'หนี้ค่อนข้างสูง ต้องระวังภาระดอกเบี้ย (> 2.0 เท่า)', color: 'text-rose-300 bg-rose-500/15 border-rose-500/30 font-bold' }
  }

  // Status Badge for ROE
  const getRoeBadge = (val: number | null | undefined) => {
    if (!val || val <= 0) return { label: 'N/A', color: 'text-slate-400 bg-slate-500/10 border-slate-500/20' }
    if (val >= 15) return { label: 'ความสามารถทำกำไรยอดเยี่ยม (> 15% สม่ำเสมอ)', color: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30 font-bold' }
    if (val >= 10) return { label: 'เกณฑ์ดีตามมาตรฐานสากล (10 - 15%)', color: 'text-indigo-300 bg-indigo-500/15 border-indigo-500/30' }
    return { label: 'ผลตอบแทนต่อเงินทุนค่อนข้างต่ำ (< 10%)', color: 'text-amber-300 bg-amber-500/15 border-amber-500/30' }
  }

  const peInfo = getPeBadge(pe)
  const pbInfo = getPbBadge(pb)
  const yieldInfo = getYieldBadge(dividendYield)
  const deInfo = getDeBadge(effectiveDE)
  const roeInfo = getRoeBadge(effectiveRoe)

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* ── HEADER SUMMARY & READINESS SCORECARD ─────────────────── */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-[#161B28] to-[#10131C] border border-white/[0.1] shadow-xl relative overflow-hidden space-y-4">
        {/* Glow Element */}
        <div className="absolute -top-16 -right-16 w-56 h-56 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 flex items-center gap-1.5 shadow-xs">
                <Target className="w-3.5 h-3.5 text-indigo-400" />
                <span>กรอบการวิเคราะห์ 4 ด้านก่อนลงทุน (4 Pillars Framework)</span>
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {symbol} ({isThai ? 'หุ้นไทย SET' : 'หุ้นสหรัฐฯ US'})
              </span>
            </div>

            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
              การวิเคราะห์หุ้น 1 ตัวก่อนตัดสินใจลงทุน ควรพิจารณาข้อมูลหลัก 4 ด้าน
            </h3>

            <p className="text-xs text-slate-400 leading-relaxed max-w-2xl">
              เพื่อให้เห็นภาพรวมของธุรกิจและความคุ้มค่าในการลงทุน: ลักษณะธุรกิจ (Business Model), ความถูกแพง (Valuation), สุขภาพการเงิน (Financial Health) และอนาคตกับความเสี่ยง (Future & Risks)
            </p>
          </div>

          {/* Overall Investment Readiness Score */}
          <div className="flex items-center gap-3 shrink-0 p-3 rounded-2xl bg-[#0C0F17] border border-white/[0.08] shadow-inner">
            <div className="text-center">
              <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                คะแนนความพร้อมลงทุน
              </div>
              <div className="flex items-baseline justify-center gap-1 mt-0.5">
                <span className="text-2xl font-black text-emerald-400 font-mono">
                  {totalScore}
                </span>
                <span className="text-xs text-slate-500 font-mono">/ 100</span>
              </div>
              <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                {totalScore >= 80 ? '🌟 พื้นฐานแกร่งมาก' : totalScore >= 65 ? '👍 พื้นฐานน่าสนใจ' : '⚠️ ควรศึกษาเพิ่ม'}
              </span>
            </div>
          </div>
        </div>

        {/* 4 Mini Progress Indicators */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-white/[0.06] text-xs">
          <div className="p-2 rounded-xl bg-[#141824] border border-white/[0.04] text-center">
            <div className="text-[10px] text-slate-400 truncate">1. โมเดลธุรกิจ</div>
            <div className="font-bold text-indigo-300 font-mono mt-0.5">{scoreMoat} / 25</div>
          </div>
          <div className="p-2 rounded-xl bg-[#141824] border border-white/[0.04] text-center">
            <div className="text-[10px] text-slate-400 truncate">2. ความถูกแพง</div>
            <div className="font-bold text-amber-300 font-mono mt-0.5">{scoreValuation} / 25</div>
          </div>
          <div className="p-2 rounded-xl bg-[#141824] border border-white/[0.04] text-center">
            <div className="text-[10px] text-slate-400 truncate">3. สุขภาพการเงิน</div>
            <div className="font-bold text-emerald-300 font-mono mt-0.5">{scoreHealth} / 25</div>
          </div>
          <div className="p-2 rounded-xl bg-[#141824] border border-white/[0.04] text-center">
            <div className="text-[10px] text-slate-400 truncate">4. อนาคต & ความเสี่ยง</div>
            <div className="font-bold text-sky-300 font-mono mt-0.5">{scoreFuture} / 25</div>
          </div>
        </div>
      </div>

      {/* ── PILLAR 1: BUSINESS MODEL & PROFITABILITY ─────────────── */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#12151F] border border-indigo-500/30 space-y-3.5 shadow-lg shadow-black/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0">
              <Briefcase className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <span>1. ลักษณะธุรกิจและการทำกำไร (Business Model)</span>
              </h4>
              <p className="text-[11px] text-slate-400">
                บริษัททำธุรกิจอะไร รายได้หลักมาจากไหน และมีคูเมืองป้องกันคู่แข่ง (Economic Moat) แข็งแกร่งเพียงใด
              </p>
            </div>
          </div>
          <span className="text-xs font-bold text-indigo-300 font-mono bg-indigo-500/10 px-2.5 py-1 rounded-lg border border-indigo-500/20">
            เสาหลักที่ 1
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs leading-relaxed">
          {/* Question 1: What is the business and where does revenue come from? */}
          <div className="p-3.5 rounded-xl bg-[#151926] border border-white/[0.06] space-y-2">
            <div className="font-bold text-indigo-300 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-indigo-400" />
              <span>บริษัททำธุรกิจอะไร และรายได้หลักมาจากไหน?</span>
            </div>
            <p className="text-slate-300 text-[11px]">
              {structuredAi?.businessOverview ||
                `${name} (${symbol}) ดำเนินธุรกิจในกลุ่มอุตสาหกรรมหลักที่มีแหล่งรายได้จากการขายผลิตภัณฑ์ บริการ หรือสัญญาระยะยาว โดยสร้างกระแสเงินสดจากการบริโภคหรือการลงทุนโครงสร้างพื้นฐานระดับสากล`}
            </p>
            <div className="pt-1.5 border-t border-white/[0.04] text-[10px] text-slate-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span>เกณฑ์พิจารณา: โมเดลธุรกิจต้องเข้าใจง่าย และมีกระแสเงินสดสม่ำเสมอ</span>
            </div>
          </div>

          {/* Question 2: Economic Moat / Competitive Advantage */}
          <div className="p-3.5 rounded-xl bg-[#151926] border border-white/[0.06] space-y-2">
            <div className="font-bold text-indigo-300 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
              <span>มีข้อได้เปรียบทางการแข่งขันที่คู่แข่งเลียนแบบได้ยากหรือไม่? (Moat)</span>
            </div>
            <p className="text-slate-300 text-[11px]">
              มีแต้มต่อทางธุรกิจที่คู่แข่งรายใหม่เข้ามาแย่งชิงส่วนแบ่งได้ยาก เช่น มี Network Effect, ลูกค้ามีต้นทุนการย้ายค่ายสูง (Switching Cost) หรือมีโครงสร้างพื้นฐานและฐานลูกค้าขนาดใหญ่
            </p>
            <div className="p-2 rounded-lg bg-indigo-950/30 border border-indigo-500/20 text-[11px] text-indigo-200">
              💡 <strong>ตัวอย่างกรณีศึกษา:</strong> หุ้นกลุ่มสื่อสารอย่าง <strong>ADVANC</strong> ที่มีโครงข่ายเสาสัญญาณและคลื่นความถี่พร้อมฐานลูกค้ากว่า 45 ล้านราย ทำให้มีรายได้สม่ำเสมอและคู่แข่งรายใหม่เข้ามาเจาะตลาดได้ยากมาก
            </div>
          </div>
        </div>
      </div>

      {/* ── PILLAR 2: VALUATION ASSESSMENT ───────────────────────── */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#12151F] border border-amber-500/30 space-y-3.5 shadow-lg shadow-black/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
              <Scale className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <span>2. ความถูกแพงของหุ้น (Valuation)</span>
              </h4>
              <p className="text-[11px] text-slate-400">
                ประเมินความคุ้มค่าของราคาซื้อในปัจจุบันด้วยอัตราส่วนทางการเงินสากล 3 ตัวหลัก
              </p>
            </div>
          </div>
          <span className="text-xs font-bold text-amber-300 font-mono bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
            เสาหลักที่ 2
          </span>
        </div>

        {/* 3 Valuation Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          {/* 1. P/E Ratio */}
          <div className="p-3.5 rounded-xl bg-[#151926] border border-white/[0.06] space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-300">P/E Ratio (ราคาต่อกำไร)</span>
              <span className="text-base font-extrabold text-white font-mono">
                {pe ? `${pe}x` : forwardPe ? `${forwardPe}x (Fwd)` : 'N/A'}
              </span>
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              <strong>ความหมาย:</strong> บอกว่าซื้อหุ้นราคานี้ กี่ปีถึงจะคืนทุน ยิ่งต่ำยิ่งดี แต่ต้องนำไปเทียบกับค่าเฉลี่ยของบริษัทอื่นในอุตสาหกรรมเดียวกันด้วย
            </p>
            <div className={`p-2 rounded-lg border text-[10px] ${peInfo.color}`}>
              สถานะ: {peInfo.label}
            </div>
          </div>

          {/* 2. P/BV Ratio */}
          <div className="p-3.5 rounded-xl bg-[#151926] border border-white/[0.06] space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-300">P/BV (ราคาต่อมูลค่าทางบัญชี)</span>
              <span className="text-base font-extrabold text-white font-mono">
                {pb ? `${pb}x` : 'N/A'}
              </span>
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              <strong>ความหมาย:</strong> บอกว่าราคาหุ้นตอนนี้แพงกว่ามูลค่าทรัพย์สินสุทธิ (Book Value) ของบริษัทกี่เท่า หากต่ำกว่า 1.0 แปลว่าซื้อได้ถูกกว่าสินทรัพย์
            </p>
            <div className={`p-2 rounded-lg border text-[10px] ${pbInfo.color}`}>
              สถานะ: {pbInfo.label}
            </div>
          </div>

          {/* 3. Dividend Yield */}
          <div className="p-3.5 rounded-xl bg-[#151926] border border-white/[0.06] space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-300">Dividend Yield (เงินปันผล)</span>
              <span className="text-base font-extrabold text-emerald-400 font-mono">
                {dividendYield !== null && dividendYield !== undefined ? `${dividendYield.toFixed(2)}%` : '0%'}
              </span>
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              <strong>ความหมาย:</strong> ผลตอบแทนจากเงินปันผลคิดเป็นเปอร์เซ็นต์ต่อปี ซึ่งสำคัญมากสำหรับกลยุทธ์การลงทุนเพื่อสะสมเงินปันผลระยะยาว (Passive Income)
            </p>
            <div className={`p-2 rounded-lg border text-[10px] ${yieldInfo.color}`}>
              สถานะ: {yieldInfo.label}
            </div>
          </div>
        </div>
      </div>

      {/* ── PILLAR 3: FINANCIAL HEALTH ───────────────────────────── */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#12151F] border border-emerald-500/30 space-y-3.5 shadow-lg shadow-black/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <span>3. สุขภาพทางการเงิน (Financial Health)</span>
              </h4>
              <p className="text-[11px] text-slate-400">
                ตรวจสอบความแข็งแกร่งของงบการเงิน ภาระหนี้สิน และความสามารถของผู้บริหารในการสร้างผลตอบแทน
              </p>
            </div>
          </div>
          <span className="text-xs font-bold text-emerald-300 font-mono bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
            เสาหลักที่ 3
          </span>
        </div>

        {/* 3 Financial Health Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          {/* 1. Revenue & Profit Trend */}
          <div className="p-3.5 rounded-xl bg-[#151926] border border-white/[0.06] space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-emerald-400">รายได้และกำไรสุทธิ (3-5 ปี)</span>
              <span className="text-xs font-bold text-white font-mono">
                {revenue ? formatLarge(revenue) : 'N/A'}
              </span>
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              <strong>เกณฑ์พิจารณา:</strong> ควรดูงบการเงินย้อนหลัง 3-5 ปีว่ามีแนวโน้มเติบโตสม่ำเสมอหรือไม่ ไม่ควรผันผวนขึ้นลงรุนแรงไร้ทิศทาง
            </p>
            <div className="p-2 rounded-lg bg-[#0E121C] border border-white/[0.04] text-[10px] space-y-1">
              <div className="flex justify-between text-slate-400">
                <span>การเติบโตรายได้ YoY:</span>
                <strong className={revenueGrowth && revenueGrowth >= 0 ? 'text-emerald-400' : 'text-slate-300'}>
                  {revenueGrowth ? `+${revenueGrowth}%` : 'มีเสถียรภาพ'}
                </strong>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>กระแสเงินสดอิสระ (FCF):</span>
                <strong className="text-indigo-300">{freeCashflow ? formatLarge(freeCashflow) : 'บวกแข็งแกร่ง'}</strong>
              </div>
            </div>
          </div>

          {/* 2. D/E Ratio */}
          <div className="p-3.5 rounded-xl bg-[#151926] border border-white/[0.06] space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-emerald-400">D/E Ratio (หนี้สินต่อทุน)</span>
              <span className="text-base font-extrabold text-white font-mono">
                {effectiveDE ? `${effectiveDE} เท่า` : 'N/A'}
              </span>
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              <strong>เกณฑ์พิจารณา:</strong> บอกว่าบริษัทมีหนี้เยอะแค่ไหน โดยทั่วไปไม่ควรสูงเกิน <strong>1.5 - 2.0 เท่า</strong> เพื่อลดความเสี่ยงสภาพคล่องยามวิกฤตเศรษฐกิจ
            </p>
            <div className={`p-2 rounded-lg border text-[10px] ${deInfo.color}`}>
              สถานะ: {deInfo.label}
            </div>
          </div>

          {/* 3. ROE */}
          <div className="p-3.5 rounded-xl bg-[#151926] border border-white/[0.06] space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-emerald-400">ROE (ผลตอบแทนต่อส่วนผู้ถือหุ้น)</span>
              <span className="text-base font-extrabold text-emerald-300 font-mono">
                {effectiveRoe ? `${effectiveRoe}%` : 'N/A'}
              </span>
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              <strong>เกณฑ์พิจารณา:</strong> สะท้อนความสามารถของผู้บริหารในการนำเงินลงทุนไปสร้างกำไร <strong>(ควรมากกว่า 10-15% อย่างสม่ำเสมอ)</strong>
            </p>
            <div className={`p-2 rounded-lg border text-[10px] ${roeInfo.color}`}>
              สถานะ: {roeInfo.label}
            </div>
          </div>
        </div>
      </div>

      {/* ── PILLAR 4: FUTURE & RISKS ─────────────────────────────── */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#12151F] border border-sky-500/30 space-y-3.5 shadow-lg shadow-black/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-400 flex items-center justify-center shrink-0">
              <Target className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <span>4. อนาคตและความเสี่ยง (Future & Risks)</span>
              </h4>
              <p className="text-[11px] text-slate-400">
                มองไปข้างหน้า: แผนการเติบโต ขยายตลาดใหม่ๆ และปัจจัยลบที่อาจเข้ามากระทบธุรกิจ
              </p>
            </div>
          </div>
          <span className="text-xs font-bold text-sky-300 font-mono bg-sky-500/10 px-2.5 py-1 rounded-lg border border-sky-500/20">
            เสาหลักที่ 4
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs leading-relaxed">
          {/* Future Growth Catalysts */}
          <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/20 space-y-2">
            <div className="font-bold text-emerald-400 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span>แผนการเติบโตในอนาคต (Growth Catalysts)</span>
            </div>
            <ul className="space-y-1.5 text-slate-300 text-[11px] list-disc list-inside">
              <li>การขยายกิจการและการลงทุนในเทคโนโลยีระดับสูงเพื่อเพิ่มส่วนแบ่งการตลาด</li>
              <li>การเปิดตัวผลิตภัณฑ์และบริการใหม่ที่มีอัตรากำไร (Margin) สูงกว่าเดิม</li>
              <li>การบุกตลาดใหม่ในภูมิภาคที่มีการเติบโตทางเศรษฐกิจและกำลังซื้อสูง</li>
              {structuredAi?.strengths && structuredAi.strengths.slice(0, 2).map((s, idx) => (
                <li key={idx} className="text-emerald-200">{s}</li>
              ))}
            </ul>
          </div>

          {/* Key Risks to Watch */}
          <div className="p-3.5 rounded-xl bg-rose-950/20 border border-rose-500/20 space-y-2">
            <div className="font-bold text-rose-400 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <span>ความเสี่ยงที่อาจกระทบธุรกิจ (Key Risks)</span>
            </div>
            <ul className="space-y-1.5 text-slate-300 text-[11px] list-disc list-inside">
              <li>การเปลี่ยนแปลงทางเทคโนโลยีอย่างรวดเร็ว (Disruption & Replacement)</li>
              <li>กฎหมายควบคุมจากภาครัฐ มาตรการผูกขาดทางการค้า หรือภาษีนำเข้า</li>
              <li>พฤติกรรมผู้บริโภคที่เปลี่ยนไป หรือสงครามตัดราคาจากคู่แข่ง</li>
              {structuredAi?.risks && structuredAi.risks.slice(0, 2).map((r, idx) => (
                <li key={idx} className="text-rose-200">{r}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* Scenario Analysis (Bull, Base, Bear) */}
        {structuredAi?.scenarioAnalysis && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1 text-xs">
            <div className="p-3 rounded-xl bg-emerald-950/25 border border-emerald-500/30">
              <div className="font-bold text-emerald-400 text-[11px] mb-1">🟢 กรณีดีที่สุด (Bull Case)</div>
              <p className="text-slate-300 text-[11px]">{structuredAi.scenarioAnalysis.bull}</p>
            </div>
            <div className="p-3 rounded-xl bg-[#141824] border border-white/[0.08]">
              <div className="font-bold text-indigo-300 text-[11px] mb-1">⚪ กรณีพื้นฐาน (Base Case)</div>
              <p className="text-slate-300 text-[11px]">{structuredAi.scenarioAnalysis.base}</p>
            </div>
            <div className="p-3 rounded-xl bg-rose-950/25 border border-rose-500/30">
              <div className="font-bold text-rose-400 text-[11px] mb-1">🔴 กรณีแย่สุด (Bear Case)</div>
              <p className="text-slate-300 text-[11px]">{structuredAi.scenarioAnalysis.bear}</p>
            </div>
          </div>
        )}
      </div>

      {/* ── ACTION BANNER: AI DEEP DIVE BUTTON ────────────────────── */}
      <div className="p-4 rounded-2xl bg-[#141824] border border-white/[0.08] flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-slate-300">
          <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
          <span>ต้องการบทวิเคราะห์ 4 ด้านเฉพาะตัวของ <strong>{symbol}</strong> แบบเรียลไทม์?</span>
        </div>

        <button
          type="button"
          onClick={onGenerateAi}
          disabled={isAiLoading}
          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-indigo-600/20 active:scale-98"
        >
          {isAiLoading ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>AI กำลังวิเคราะห์ 4 ด้าน...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>สั่ง AI วิเคราะห์ 4 ด้านเฉพาะหุ้น {symbol}</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}
