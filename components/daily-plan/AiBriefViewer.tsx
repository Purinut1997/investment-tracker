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

interface ParsedStockItem {
  ticker: string
  metricsText: string
  detailsText: string
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

interface ParsedSections {
  intro: string
  macro: string
  stocks: ParsedStockItem[]
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
            <strong key={index} className="text-white font-semibold">
              {inner}
            </strong>
          )
        }
        return part
      })}
    </span>
  )
}

function detectActionTag(detailsText: string): { label: string; badgeClass: string } {
  const text = detailsText.toLowerCase()
  if (
    text.includes('ช้อนซื้อ') ||
    text.includes('oversold') ||
    text.includes('ได้เปรียบสูง') ||
    text.includes('ทยอยสะสม') ||
    text.includes('จุดช้อน') ||
    text.includes('น่าสะสม') ||
    text.includes('เข้าซื้อ')
  ) {
    return {
      label: 'ช้อนซื้อ / สะสม',
      badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    }
  }
  if (
    text.includes('ชะลอ') ||
    text.includes('overbought') ||
    text.includes('งดซื้อ') ||
    text.includes('แนวต้าน') ||
    text.includes('ต้าน') ||
    text.includes('ระวัง') ||
    text.includes('ไม่ไล่ราคา') ||
    text.includes('ชะลอการซื้อ')
  ) {
    return {
      label: 'ชะลอ / ไม่ไล่ราคา',
      badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    }
  }
  return {
    label: 'ถือรอตามแผน',
    badgeClass: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  }
}

function parseAiResponse(rawText: string): ParsedSections {
  if (!rawText) {
    return {
      intro: '',
      macro: '',
      stocks: [],
      actions: [],
      isStructured: false,
      executiveSummary: '',
      focusPills: [],
    }
  }

  try {
    // 1. Check if contains section markers (1., 2., 3. or icons)
    const sec1Index = rawText.search(/(?:1\.|\n1\.)\s*(?:🧭)?\s*\**ทิศทาง/i)
    const sec2Index = rawText.search(/(?:2\.|\n2\.)\s*(?:🎯)?\s*\**วิเคราะห์/i)
    const sec3Index = rawText.search(/(?:3\.|\n3\.)\s*(?:📋)?\s*\**แผนปฏิบัติการ/i)

    if (sec1Index === -1 || sec2Index === -1 || sec3Index === -1) {
      return {
        intro: '',
        macro: rawText,
        stocks: [],
        actions: [],
        isStructured: false,
        executiveSummary: '',
        focusPills: [],
      }
    }

    // Extract Intro & filter out formal salutations
    let intro = rawText.substring(0, sec1Index).trim().replace(/---+/g, '').trim()
    if (
      intro.includes('เรียน') ||
      intro.includes('Chief Investment Strategist') ||
      intro.includes('สวัสดี')
    ) {
      intro = '' // Discard bureaucratic greetings
    }

    // Extract Section 1 (Macro)
    let macro = rawText.substring(sec1Index, sec2Index).trim()
    macro = macro.replace(/^(?:1\.)\s*(?:🧭)?\s*\*\*[^*]+\*\*:?/, '').trim()

    // Extract Section 2 (Stocks)
    let stocksRaw = rawText.substring(sec2Index, sec3Index).trim()
    stocksRaw = stocksRaw.replace(/^(?:2\.)\s*(?:🎯)?\s*\*\*[^*]+\*\*:?/, '').trim()

    // Parse individual stock bullets
    const stockLines = stocksRaw
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('-') || l.startsWith('•') || l.startsWith('*'))

    const parsedStocks: ParsedStockItem[] = []

    for (const line of stockLines) {
      // E.g. - **SCHD ($33.02 | RSI: 31.1 | S1: $32.22):** ส่งสัญญาณ...
      const match = line.match(/^[-•*]?\s*\*\*?([A-Za-z0-9_.\-]+)(?:\s*\(([^)]+)\))?:?\*\*?:?\s*(.+)$/)
      if (match) {
        const details = match[3]?.trim() || ''
        parsedStocks.push({
          ticker: match[1].trim().toUpperCase(),
          metricsText: match[2]?.trim() || '',
          detailsText: details,
          actionTag: detectActionTag(details),
        })
      } else {
        const cleanLine = line.replace(/^[-•*]\s*/, '')
        parsedStocks.push({
          ticker: 'INFO',
          metricsText: '',
          detailsText: cleanLine,
          actionTag: detectActionTag(cleanLine),
        })
      }
    }

    // Extract Section 3 (Actions)
    let actionsRaw = rawText.substring(sec3Index).trim()
    actionsRaw = actionsRaw.replace(/^(?:3\.)\s*(?:📋)?\s*\*\*[^*]+\*\*:?/, '').trim()

    const parsedActions: ParsedActionStep[] = []
    const actionLines = actionsRaw
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => /^\d+\./.test(l))

    let stepNum = 1
    for (const line of actionLines) {
      const match = line.match(/^\d+\.\s*\*\*([^*]+):\*\*\s*(.+)$/)
      if (match) {
        parsedActions.push({
          number: stepNum++,
          headline: match[1].trim(),
          details: match[2].trim(),
        })
      } else {
        const clean = line.replace(/^\d+\.\s*/, '')
        parsedActions.push({
          number: stepNum++,
          headline: clean,
          details: '',
        })
      }
    }

    // Build Executive Summary
    let executiveSummary = ''
    if (parsedActions.length > 0) {
      executiveSummary = parsedActions[0].headline
    } else if (macro) {
      executiveSummary = macro.split(/[.!?\n]/)[0]?.trim() || ''
    }

    const focusPills = parsedStocks.map((s) => ({
      ticker: s.ticker,
      label: s.actionTag.label,
      badgeClass: s.actionTag.badgeClass,
    }))

    return {
      intro,
      macro,
      stocks: parsedStocks,
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
      stocks: [],
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
    <div className="bg-[#10131A] border border-white/[0.08] rounded-2xl p-5 sm:p-7 shadow-xl relative overflow-hidden">
      {/* ── Top Header ─────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-300 shrink-0">
            <Sparkles className="w-5 h-5 text-indigo-300" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg font-bold text-white tracking-tight">
                AI Market Strategist
              </h3>
              <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/25">
                สรุปเช้าประจำวัน
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5 font-mono">
              <Clock className="w-3 h-3 text-slate-500" />
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
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white border border-white/[0.08] transition-colors flex items-center gap-1.5"
              title="คัดลอกลงบันทึกประจำวัน"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <FileText className="w-3.5 h-3.5 text-indigo-400" />}
              <span>{copied ? 'คัดลอกแล้ว' : 'คัดลอก'}</span>
            </button>
          )}

          <button
            onClick={onRegenerate}
            disabled={isGenerating}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-600/30 transition-all flex items-center gap-1.5 disabled:opacity-50"
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
        <div className="mt-5 space-y-6">
          {/* ⚡ 5-Second Executive Takeaway Banner (แก้ปัญหาจับใจความนาน) */}
          {parsed.isStructured && (
            <div className="bg-indigo-950/30 border border-indigo-500/25 rounded-xl p-3.5 sm:p-4">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-amber-400 fill-amber-400 shrink-0" />
                <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                  สรุปใจความสำคัญใน 5 วินาที
                </span>
              </div>

              {parsed.executiveSummary && (
                <p className="text-sm font-semibold text-white mb-3 leading-snug">
                  🎯 {parsed.executiveSummary}
                </p>
              )}

              {parsed.focusPills.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-indigo-500/15">
                  <span className="text-[11px] text-slate-400 font-medium">จุดโฟกัส:</span>
                  {parsed.focusPills.map((pill, idx) => (
                    <span
                      key={idx}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-medium border ${pill.badgeClass}`}
                    >
                      <strong className="font-mono text-white font-bold">{pill.ticker}</strong>
                      <span className="text-[10px] opacity-90">{pill.label}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Unified Editorial Article (ผืนเดียวกัน ไร้กล่องซ้อน) */}
          {parsed.isStructured ? (
            <div className="space-y-6">
              {/* SECTION 1: MACRO & MARKET PULSE */}
              <div>
                <div className="flex items-center gap-2 text-sky-400 text-xs font-bold uppercase tracking-wider mb-2">
                  <Compass className="w-3.5 h-3.5" />
                  <span>01 • สภาวะตลาดและทิศทางมหภาค</span>
                </div>
                <div className="text-sm sm:text-base text-slate-200 leading-relaxed pl-1">
                  <RenderMarkdownText text={parsed.macro} />
                </div>
              </div>

              {/* Clean Subtle Divider */}
              <div className="h-px bg-white/[0.06]" />

              {/* SECTION 2: PORTFOLIO KEY SIGNALS */}
              <div>
                <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider mb-3">
                  <Target className="w-3.5 h-3.5" />
                  <span>02 • สัญญาณเจาะจงหุ้นในพอร์ต</span>
                </div>

                {parsed.stocks.length > 0 ? (
                  <div className="divide-y divide-white/[0.05]">
                    {parsed.stocks.map((item, idx) => (
                      <div
                        key={idx}
                        className="py-3 sm:py-3.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-start justify-between gap-2 sm:gap-4"
                      >
                        <div className="flex items-center gap-2 shrink-0 sm:w-64">
                          <span className="font-mono font-bold text-xs text-white bg-white/[0.06] border border-white/[0.08] px-2 py-0.5 rounded">
                            {item.ticker}
                          </span>
                          {item.metricsText && (
                            <span className="font-mono text-[11px] text-slate-400">
                              {item.metricsText}
                            </span>
                          )}
                          <span
                            className={`ml-auto sm:ml-0 text-[10px] px-2 py-0.5 rounded-full font-bold border shrink-0 ${item.actionTag.badgeClass}`}
                          >
                            {item.actionTag.label}
                          </span>
                        </div>

                        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed flex-1">
                          <RenderMarkdownText text={item.detailsText} />
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-300">
                    <RenderMarkdownText text={parsed.macro} />
                  </p>
                )}
              </div>

              {/* Clean Subtle Divider */}
              <div className="h-px bg-white/[0.06]" />

              {/* SECTION 3: TODAY'S ACTION GAME PLAN */}
              <div>
                <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-3">
                  <CalendarCheck className="w-3.5 h-3.5" />
                  <span>03 • แผนปฏิบัติการ 3 ข้อที่ควรทำวันนี้</span>
                </div>

                {parsed.actions.length > 0 ? (
                  <div className="space-y-2.5">
                    {parsed.actions.map((act) => {
                      const isAdded = addedStep === act.number
                      return (
                        <div
                          key={act.number}
                          className="flex items-start justify-between gap-3 p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.05] transition-colors"
                        >
                          <div className="flex items-start gap-3 flex-1">
                            <span className="w-5 h-5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                              {act.number}
                            </span>
                            <div className="min-w-0">
                              <span className="text-sm font-semibold text-white block">
                                {act.headline}
                              </span>
                              {act.details && (
                                <p className="text-xs sm:text-sm text-slate-400 mt-0.5 leading-relaxed">
                                  <RenderMarkdownText text={act.details} />
                                </p>
                              )}
                            </div>
                          </div>

                          <button
                            onClick={() => handleAdd(act)}
                            disabled={isAdded}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all flex items-center gap-1 shrink-0 ${
                              isAdded
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                : 'bg-white/[0.03] hover:bg-emerald-500/15 text-slate-300 hover:text-emerald-300 border-white/[0.08] hover:border-emerald-500/30'
                            }`}
                            title="นำข้อนี้ไปใส่ในเช็กลิสต์ด้านล่าง"
                          >
                            {isAdded ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-400" />
                                <span className="hidden sm:inline">เพิ่มแล้ว</span>
                              </>
                            ) : (
                              <>
                                <Plus className="w-3 h-3" />
                                <span className="hidden sm:inline">ใส่เช็กลิสต์</span>
                              </>
                            )}
                          </button>
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
        <div className="mt-5 border border-dashed border-white/[0.08] rounded-xl p-8 text-center space-y-2">
          <Sparkles className="w-8 h-8 text-indigo-400/60 mx-auto" />
          <h4 className="text-sm font-semibold text-white">ยังไม่มีบทวิเคราะห์สำหรับวันนี้</h4>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            กดปุ่ม <span className="text-indigo-300 font-semibold">&quot;ขอคำแนะนำใหม่&quot;</span> ด้านบน
            เพื่อประมวลผลดัชนีตลาดโลก สัญญาณแนวรับ-แนวต้าน และระดับ RSI ของหุ้นในพอร์ตคุณ
          </p>
        </div>
      )}
    </div>
  )
}
