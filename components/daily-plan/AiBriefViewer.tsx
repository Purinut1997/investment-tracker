'use client'

import React, { useMemo, useState } from 'react'
import {
  Sparkles,
  Compass,
  Target,
  CalendarCheck,
  FileText,
  Zap,
  Loader2,
  Plus,
  AlertTriangle,
  Check,
  Clock,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  Flame,
  CheckCircle2,
  Layers,
} from 'lucide-react'

interface AiBriefViewerProps {
  text: string
  modelUsed?: string
  updatedAt?: string
  isGenerating?: boolean
  error?: string | null
  onRegenerate: () => void
  onCopyNotes: () => void
  onAddToChecklist: (actionText: string) => void
}

export type StockCategoryType = 'BUY_DIP' | 'PAUSE_OVERBOUGHT' | 'RISK_ALERT' | 'CORE_HOLD'

interface ParsedStockItem {
  ticker: string
  metricsText: string
  price?: string
  rsi?: number | null
  s1?: string
  detailsText: string
  category: StockCategoryType
  actionTag: {
    label: string
    badgeClass: string
  }
}

interface ParsedActionStep {
  number: number
  headline: string
  details: string
}

interface CategorizedGroup {
  id: StockCategoryType
  title: string
  subtitle: string
  icon: React.ComponentType<{ className?: string }>
  borderClass: string
  bgClass: string
  badgeClass: string
  iconColor: string
  items: ParsedStockItem[]
}

interface ParsedSections {
  intro: string
  macro: string
  groups: CategorizedGroup[]
  actions: ParsedActionStep[]
  isStructured: boolean
  executiveSummary: string
  focusPills: Array<{ ticker: string; label: string; badgeClass: string }>
}

// Clean helper to format **bold** into real strong elements
export function RenderMarkdownText({ text, className = '' }: { text: string; className?: string }) {
  if (!text) return null
  const parts = text.split(/(\*\*.*?\*\*)/g)

  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          const inner = part.slice(2, -2)
          return (
            <strong key={index} className="text-white font-bold bg-white/[0.08] px-1.5 py-0.5 rounded text-inherit">
              {inner}
            </strong>
          )
        }
        return part
      })}
    </span>
  )
}

function classifyStock(detailsText: string, rsiVal?: number | null): {
  category: StockCategoryType
  actionTag: { label: string; badgeClass: string }
} {
  const text = detailsText.toLowerCase()

  // 1. Check Risk Alert first (so phrases like "ห้ามถัวเฉลี่ย" or "ตัดขาดทุน" take absolute priority)
  if (
    text.includes('ตัดขาดทุน') ||
    text.includes('หลุดแนวรับ') ||
    text.includes('เชิงลบ') ||
    text.includes('ห้ามถัว') ||
    text.includes('อ่อนแอ') ||
    text.includes('เฝ้าระวังและประเมิน') ||
    text.includes('ลดความเสี่ยง') ||
    text.includes('เสี่ยงหลุด') ||
    text.includes('คัตลอส') ||
    text.includes('cut loss')
  ) {
    return {
      category: 'RISK_ALERT',
      actionTag: {
        label: '⚠️ เฝ้าระวัง / ระวังหลุดแนวรับ',
        badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
      },
    }
  }

  // 2. Check Overbought / Pause (check "ชะลอ", "overbought", "งดซื้อ", "ต้าน" before general buy terms)
  if (
    text.includes('overbought') ||
    text.includes('ชะลอการเข้าซื้อ') ||
    text.includes('ชะลอการซื้อ') ||
    text.includes('ชะลอซื้อ') ||
    (text.includes('ชะลอ') && !text.includes('ชะลอตัว')) ||
    text.includes('ใกล้แนวต้าน') ||
    text.includes('งดไล่ราคา') ||
    text.includes('ไม่ไล่ราคา') ||
    text.includes('งดซื้อ') ||
    text.includes('แนวต้าน') ||
    (rsiVal !== undefined && rsiVal !== null && rsiVal >= 66)
  ) {
    return {
      category: 'PAUSE_OVERBOUGHT',
      actionTag: {
        label: '⏸️ ชะลอ / ไม่ไล่ราคาที่แนวต้าน',
        badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
      },
    }
  }

  // 3. Check Buy Dip / Accumulate
  if (
    text.includes('oversold') ||
    text.includes('ช้อนซื้อ') ||
    text.includes('น่าสะสม') ||
    text.includes('จุดช้อน') ||
    text.includes('ได้เปรียบ') ||
    text.includes('สะสมเพิ่ม') ||
    text.includes('ย่อทดสอบ s1') ||
    text.includes('รอจังหวะสะสม') ||
    text.includes('ทยอยซื้อ') ||
    text.includes('ทยอยสะสม') ||
    text.includes('ซื้อสะสม') ||
    text.includes('แบ่งไม้') ||
    text.includes('เข้าซื้อ') ||
    (rsiVal !== undefined && rsiVal !== null && rsiVal <= 38)
  ) {
    return {
      category: 'BUY_DIP',
      actionTag: {
        label: '🟢 จุดน่าช้อนซื้อ / ทยอยสะสม',
        badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
      },
    }
  }

  // 4. Default: Core Trend & Hold
  return {
    category: 'CORE_HOLD',
    actionTag: {
      label: '⚡ ถือครองตามรอบ / รันเทรนด์',
      badgeClass: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    },
  }
}

function parseAiResponse(rawText: string): ParsedSections {
  if (!rawText) {
    return {
      intro: '',
      macro: '',
      groups: [],
      actions: [],
      isStructured: false,
      executiveSummary: '',
      focusPills: [],
    }
  }

  try {
    // 1. Separate sections flexibly (handles single-line text and multi-line markdown)
    let sec1 = ''
    let sec2 = ''
    let sec3 = ''

    const m1 = rawText.match(
      /(?:1\.\s*(?:🧭)?\s*[\*]*ทิศทางตลาด[^\n:]*[:\)]?)\s*([\s\S]*?)(?=(?:2\.\s*(?:🎯)?\s*[\*]*วิเคราะห์))/i
    )
    if (m1) sec1 = m1[1].trim()

    const m2 = rawText.match(
      /(?:2\.\s*(?:🎯)?\s*[\*]*วิเคราะห์[^\n:]*[:\)]?)\s*([\s\S]*?)(?=(?:3\.\s*(?:📋)?\s*[\*]*แผนปฏิบัติการ))/i
    )
    if (m2) sec2 = m2[1].trim()

    const m3 = rawText.match(
      /(?:3\.\s*(?:📋)?\s*[\*]*แผนปฏิบัติการ[^\n:]*[:\)]?)\s*([\s\S]*)$/i
    )
    if (m3) sec3 = m3[1].trim()

    // Fallback if not matched by structured headers
    if (!sec1 && !sec2 && !sec3) {
      return {
        intro: '',
        macro: rawText,
        groups: [],
        actions: [],
        isStructured: false,
        executiveSummary: '',
        focusPills: [],
      }
    }

    // 2. Parse Stocks (Split by newline OR ' - ' separator for single-line output)
    const rawStockItems = sec2.split(/(?:[\r\n]+|\s+-\s+)(?=[A-Za-z0-9_.\-]+\s*[\(\:])/).map((s) => s.trim()).filter((s) => s && s !== '-')
    const parsedStocks: ParsedStockItem[] = []

    for (const item of rawStockItems) {
      // Regex matches: - GOOGL ($320.58 | RSI: 34 | S1: $303.4): รายละเอียด
      // Or: **GOOGL ($320.58 | RSI: 34 | S1: $303.4):** รายละเอียด
      const match = item.match(
        /^[-•*]?\s*(?:\*\*)?([A-Za-z0-9_.\-]+)(?:\*\*)?(?:\s*\(([^)]+)\))?:?\s*(?:\*\*)?:?\s*(.+)$/
      )
      if (match) {
        const ticker = match[1].trim().toUpperCase()
        const metrics = match[2]?.trim() || ''
        const details = match[3]?.trim() || ''

        // Parse individual metrics
        const priceMatch = metrics.match(/[$฿][\d,]+(?:\.\d+)?/)
        const rsiMatch = metrics.match(/RSI:\s*([\d.]+)/i)
        const s1Match = metrics.match(/S1:\s*([$฿]?[\d,]+(?:\.\d+)?)/i)

        const rsiVal = rsiMatch ? parseFloat(rsiMatch[1]) : null
        const { category, actionTag } = classifyStock(details, rsiVal)

        parsedStocks.push({
          ticker,
          metricsText: metrics,
          price: priceMatch ? priceMatch[0] : undefined,
          rsi: rsiVal,
          s1: s1Match ? s1Match[1] : undefined,
          detailsText: details,
          category,
          actionTag,
        })
      }
    }

    // 3. Organize stocks into 4 clear investment tactical groups
    const groupTemplates: Record<
      StockCategoryType,
      {
        title: string
        subtitle: string
        icon: React.ComponentType<{ className?: string }>
        borderClass: string
        bgClass: string
        badgeClass: string
        iconColor: string
      }
    > = {
      BUY_DIP: {
        title: 'หมวดจุดน่าช้อนซื้อ & ทยอยสะสม (Buy on Dip & Accumulate)',
        subtitle: 'ราคาแตะแนวรับสำคัญ หรือ RSI เข้าสู่โซน Oversold ได้เปรียบต้นทุน',
        icon: Sparkles,
        borderClass: 'border-emerald-500/30',
        bgClass: 'bg-emerald-950/15',
        badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
        iconColor: 'text-emerald-400',
      },
      PAUSE_OVERBOUGHT: {
        title: 'หมวดชะลอการซื้อ & ใกล้แนวต้าน (Overbought / Pause)',
        subtitle: 'ราคาปรับขึ้นแรงใกล้แนวต้าน แนะนำงดไล่ราคาและถือรอรับปันผล',
        icon: Clock,
        borderClass: 'border-amber-500/30',
        bgClass: 'bg-amber-950/15',
        badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
        iconColor: 'text-amber-400',
      },
      RISK_ALERT: {
        title: 'หมวดเฝ้าระวังความเสี่ยง & ระวังหลุดแนวรับ (Risk Sentinel / Stop Loss Alert)',
        subtitle: 'แนวโน้มอ่อนแอผิดปกติหรือมีความเสี่ยงหลุดแนวรับ ห้ามถัวเฉลี่ยและเตรียมจุดตัดขาดทุน',
        icon: AlertTriangle,
        borderClass: 'border-rose-500/30',
        bgClass: 'bg-rose-950/15',
        badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
        iconColor: 'text-rose-400',
      },
      CORE_HOLD: {
        title: 'หมวดถือครองตามรอบ & รันเทรนด์ (Core Trend & Hold)',
        subtitle: 'ดัชนีและหุ้นหลักเคลื่อนไหวในกรอบปกติ ตลาดยังหนุนดัชนีให้ถือครองตามแผน',
        icon: Layers,
        borderClass: 'border-blue-500/30',
        bgClass: 'bg-blue-950/15',
        badgeClass: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
        iconColor: 'text-blue-400',
      },
    }

    const categoriesOrder: StockCategoryType[] = ['BUY_DIP', 'RISK_ALERT', 'PAUSE_OVERBOUGHT', 'CORE_HOLD']
    const groups: CategorizedGroup[] = []

    for (const cat of categoriesOrder) {
      const itemsInCat = parsedStocks.filter((s) => s.category === cat)
      if (itemsInCat.length > 0) {
        const tmpl = groupTemplates[cat]
        groups.push({
          id: cat,
          title: tmpl.title,
          subtitle: tmpl.subtitle,
          icon: tmpl.icon,
          borderClass: tmpl.borderClass,
          bgClass: tmpl.bgClass,
          badgeClass: tmpl.badgeClass,
          iconColor: tmpl.iconColor,
          items: itemsInCat,
        })
      }
    }

    // 4. Parse Action Steps (Handles single-line ' - 1. ' or multi-line '1. ')
    const rawActionItems = sec3
      .split(/(?:[\r\n]+|(?:\s+-\s+|\s+)?)(?=\d+\.\s+)/)
      .map((a) => a.trim())
      .filter((a) => a && a !== '-')

    const parsedActions: ParsedActionStep[] = []
    let stepNum = 1

    for (const act of rawActionItems) {
      // Regex matches: 1. **ทยอยสะสม GOOGL:** รายละเอียด หรือ 1. ทยอยสะสม GOOGL: รายละเอียด
      const match = act.match(/^(?:[-•*]\s*)?(\d+)\.\s*(?:\*\*)?([^:\*\n]+)(?:\*\*)?:?\s*(.*)$/)
      if (match) {
        const parsedNum = parseInt(match[1]) || stepNum++
        const headline = match[2].trim()
        const details = match[3].trim()
        parsedActions.push({
          number: parsedNum,
          headline,
          details,
        })
      }
    }

    // 5. Build Executive Summary & Focus Pills
    let executiveSummary = ''
    if (parsedActions.length > 0) {
      executiveSummary = `${parsedActions[0].headline}: ${parsedActions[0].details || ''}`
    } else if (sec1) {
      executiveSummary = sec1.split(/[.!?\n]/)[0]?.trim() || ''
    }

    const focusPills = parsedStocks.map((s) => ({
      ticker: s.ticker,
      label: s.actionTag.label,
      badgeClass: s.actionTag.badgeClass,
    }))

    return {
      intro: '',
      macro: sec1,
      groups,
      actions: parsedActions,
      isStructured: true,
      executiveSummary,
      focusPills,
    }
  } catch (err) {
    console.error('Error parsing AI brief:', err)
    return {
      intro: '',
      macro: rawText,
      groups: [],
      actions: [],
      isStructured: false,
      executiveSummary: '',
      focusPills: [],
    }
  }
}

export function AiBriefViewer({
  text,
  modelUsed,
  updatedAt,
  isGenerating,
  error,
  onRegenerate,
  onCopyNotes,
  onAddToChecklist,
}: AiBriefViewerProps) {
  const parsed = useMemo(() => parseAiResponse(text), [text])
  const [copied, setCopied] = useState(false)
  const [addedStep, setAddedStep] = useState<number | null>(null)

  const handleCopy = () => {
    onCopyNotes()
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleAdd = (act: ParsedActionStep) => {
    onAddToChecklist(`${act.headline}${act.details ? `: ${act.details}` : ''}`)
    setAddedStep(act.number)
    setTimeout(() => setAddedStep(null), 2000)
  }

  return (
    <div className="bg-[#10131A] border-2 border-white/[0.08] rounded-3xl p-5 sm:p-7 shadow-2xl relative overflow-hidden">
      {/* ── Top Header ─────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-300 shrink-0 shadow-md">
            <Sparkles className="w-5 h-5 text-indigo-300" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg font-black text-white tracking-tight">
                AI Market Strategist
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                สรุปเช้า & ยุทธศาสตร์พอร์ต
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5 font-mono">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              {updatedAt
                ? `อัปเดตเมื่อ: ${new Date(updatedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น. (${modelUsed || 'Gemini'})`
                : 'วิเคราะห์สภาวะตลาดและสัญญาณพอร์ตประจำวัน'}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {text && (
            <button
              onClick={handleCopy}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white border border-white/[0.08] transition-colors flex items-center gap-1.5"
              title="คัดลอกลงบันทึกประจำวัน"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <FileText className="w-3.5 h-3.5 text-indigo-400" />}
              <span>{copied ? 'คัดลอกแล้ว' : 'คัดลอก'}</span>
            </button>
          )}

          <button
            onClick={onRegenerate}
            disabled={isGenerating}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>กำลังวิเคราะห์...</span>
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                <span>ขอคำแนะนำใหม่</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mt-4 p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Main Content ─────────────────────────────────────── */}
      {text ? (
        <div className="mt-6 space-y-7">
          {/* ⚡ 5-Second Executive Summary Bar */}
          {parsed.isStructured && parsed.executiveSummary && (
            <div className="bg-gradient-to-r from-indigo-950/40 via-slate-900/60 to-indigo-950/30 border border-indigo-500/30 rounded-2xl p-4 sm:p-5 shadow-lg">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-amber-400 fill-amber-400 shrink-0" />
                <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                  ⚡ สรุปใจความสำคัญใน 5 วินาที
                </span>
              </div>

              <p className="text-sm sm:text-base font-bold text-white mb-3.5 leading-snug">
                🎯 {parsed.executiveSummary}
              </p>

              {parsed.focusPills.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap pt-3 border-t border-indigo-500/20">
                  <span className="text-xs text-slate-400 font-semibold">โฟกัสเร่งด่วน:</span>
                  {parsed.focusPills.map((pill, idx) => (
                    <span
                      key={idx}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold border ${pill.badgeClass}`}
                    >
                      <strong className="font-mono text-white font-bold">{pill.ticker}</strong>
                      <span className="opacity-90">{pill.label}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {parsed.isStructured ? (
            <div className="space-y-7">
              {/* SECTION 1: MACRO & MARKET PULSE (เน้นเนื้อหาชัดเจน) */}
              <div className="bg-slate-900/50 border border-white/[0.08] rounded-2xl p-4 sm:p-5">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 text-sky-400 text-xs font-bold uppercase tracking-wider">
                    <Compass className="w-4 h-4" />
                    <span>01 • สภาวะตลาดและทิศทางมหภาค</span>
                  </div>
                  <span className="text-[11px] font-bold text-sky-300 bg-sky-500/15 border border-sky-500/30 px-2.5 py-0.5 rounded-full">
                    Macro Regime
                  </span>
                </div>

                <div className="text-sm sm:text-base text-slate-100 leading-relaxed font-medium">
                  <RenderMarkdownText text={parsed.macro} />
                </div>
              </div>

              {/* SECTION 2: PORTFOLIO KEY SIGNALS (จัดหมวดหมู่ชัดเจน 100%) */}
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider">
                    <Target className="w-4 h-4" />
                    <span>02 • สัญญาณเจาะจงสินทรัพย์ในพอร์ต (จัด 4 หมวดหมู่ยุทธศาสตร์)</span>
                  </div>
                  <span className="text-xs text-slate-400">
                    รวม {parsed.groups.reduce((acc, g) => acc + g.items.length, 0)} สินทรัพย์
                  </span>
                </div>

                {parsed.groups.length > 0 ? (
                  <div className="space-y-4">
                    {parsed.groups.map((group) => {
                      const Icon = group.icon
                      return (
                        <div
                          key={group.id}
                          className={`rounded-2xl border-2 ${group.borderClass} ${group.bgClass} p-4 sm:p-5 shadow-md`}
                        >
                          {/* Group Header */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pb-3 mb-3 border-b border-white/[0.08]">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-lg bg-white/[0.06] flex items-center justify-center">
                                <Icon className={`w-4 h-4 ${group.iconColor}`} />
                              </div>
                              <h5 className="text-sm font-bold text-white tracking-tight">
                                {group.title}
                              </h5>
                              <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-white/[0.08] text-white">
                                {group.items.length} สินทรัพย์
                              </span>
                            </div>
                            <span className="text-xs text-slate-400 sm:text-right">
                              {group.subtitle}
                            </span>
                          </div>

                          {/* Stock Items inside this Category */}
                          <div className="divide-y divide-white/[0.06]">
                            {group.items.map((item, idx) => (
                              <div
                                key={idx}
                                className="py-3.5 first:pt-1 last:pb-1 flex flex-col md:flex-row md:items-start justify-between gap-2.5 md:gap-5"
                              >
                                {/* Left Badges & Metrics */}
                                <div className="flex items-center gap-2 flex-wrap shrink-0 md:w-80">
                                  <span className="font-mono font-black text-sm text-white bg-slate-950 px-3 py-1 rounded-xl border border-white/[0.15] shadow-xs">
                                    {item.ticker}
                                  </span>

                                  {item.price && (
                                    <span className="font-mono text-xs font-bold text-white bg-white/[0.06] px-2.5 py-1 rounded-lg">
                                      {item.price}
                                    </span>
                                  )}

                                  {item.rsi !== null && item.rsi !== undefined && (
                                    <span
                                      className={`font-mono text-xs font-bold px-2 py-0.5 rounded-lg border ${
                                        item.rsi <= 35
                                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                          : item.rsi >= 66
                                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                          : 'bg-white/[0.06] text-slate-300 border-white/[0.1]'
                                      }`}
                                    >
                                      RSI {item.rsi}
                                    </span>
                                  )}

                                  {item.s1 && (
                                    <span className="font-mono text-[11px] text-slate-400 bg-white/[0.03] px-2 py-0.5 rounded border border-white/[0.06]">
                                      S1: {item.s1}
                                    </span>
                                  )}

                                  <span
                                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${item.actionTag.badgeClass}`}
                                  >
                                    {item.actionTag.label}
                                  </span>
                                </div>

                                {/* Right: Detailed Actionable Insight with emphasis */}
                                <div className="text-sm text-slate-200 leading-relaxed flex-1 font-medium pl-1">
                                  <RenderMarkdownText text={item.detailsText} />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-slate-300">
                    <RenderMarkdownText text={parsed.macro} />
                  </p>
                )}
              </div>

              {/* SECTION 3: TODAY'S ACTION GAME PLAN (การ์ดลงมือทำ 3 ข้อ) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                    <CalendarCheck className="w-4 h-4" />
                    <span>03 • แผนปฏิบัติการ 3 ข้อที่ควรทำวันนี้</span>
                  </div>
                  <span className="text-xs text-slate-400">
                    คลิกปุ่มเพื่อเพิ่มลงเช็กลิสต์ประจำวันทันที
                  </span>
                </div>

                {parsed.actions.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                    {parsed.actions.map((act) => {
                      const isAdded = addedStep === act.number
                      return (
                        <div
                          key={act.number}
                          className="bg-slate-900/80 border-2 border-emerald-500/20 hover:border-emerald-500/40 rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-3.5 transition-all shadow-md hover:scale-[1.01]"
                        >
                          <div>
                            <div className="flex items-center justify-between mb-2.5">
                              <span className="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-black flex items-center justify-center shadow-xs">
                                {act.number}
                              </span>

                              <button
                                onClick={() => handleAdd(act)}
                                disabled={isAdded}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all flex items-center gap-1 shrink-0 ${
                                  isAdded
                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                    : 'bg-emerald-500/10 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/30'
                                }`}
                                title="นำข้อนี้ไปใส่ในเช็กลิสต์ด้านล่าง"
                              >
                                {isAdded ? (
                                  <>
                                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                                    <span>เพิ่มแล้ว</span>
                                  </>
                                ) : (
                                  <>
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>ใส่เช็กลิสต์</span>
                                  </>
                                )}
                              </button>
                            </div>

                            <h6 className="text-sm font-bold text-white mb-2 leading-snug">
                              {act.headline}
                            </h6>

                            {act.details && (
                              <p className="text-xs text-slate-300 leading-relaxed font-normal">
                                <RenderMarkdownText text={act.details} />
                              </p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-sm text-slate-300">
                    <RenderMarkdownText text={text} />
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Unstructured Fallback */
            <div className="text-sm text-slate-200 leading-relaxed space-y-3">
              <RenderMarkdownText text={text} />
            </div>
          )}
        </div>
      ) : (
        /* Empty State */
        <div className="mt-6 border-2 border-dashed border-white/[0.08] rounded-2xl p-10 text-center space-y-2.5">
          <Sparkles className="w-10 h-10 text-indigo-400/60 mx-auto" />
          <h4 className="text-sm font-bold text-white">ยังไม่มีบทวิเคราะห์สำหรับวันนี้</h4>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            กดปุ่ม <span className="text-indigo-300 font-semibold">&quot;ขอคำแนะนำใหม่&quot;</span> ด้านบน
            เพื่อประมวลผลดัชนีตลาดโลก สัญญาณแนวรับ-แนวต้าน และระดับ RSI ของหุ้นในพอร์ตคุณ
          </p>
        </div>
      )}
    </div>
  )
}
