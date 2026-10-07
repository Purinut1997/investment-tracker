'use client'

import React, { useMemo } from 'react'
import {
  Sparkles,
  Compass,
  Target,
  CalendarCheck,
  CheckCircle2,
  FileText,
  Zap,
  Loader2,
  Plus,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  ShieldAlert,
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
            <strong key={index} className="text-white font-bold bg-white/[0.04] px-1 py-0.5 rounded">
              {inner}
            </strong>
          )
        }
        return part
      })}
    </span>
  )
}

function parseAiResponse(rawText: string): ParsedSections {
  if (!rawText) {
    return { intro: '', macro: '', stocks: [], actions: [], isStructured: false }
  }

  try {
    // 1. Check if contains section markers (1., 2., 3. or icons)
    const sec1Index = rawText.search(/(?:1\.|\n1\.)\s*(?:🧭)?\s*\**ทิศทาง/i)
    const sec2Index = rawText.search(/(?:2\.|\n2\.)\s*(?:🎯)?\s*\**วิเคราะห์/i)
    const sec3Index = rawText.search(/(?:3\.|\n3\.)\s*(?:📋)?\s*\**แผนปฏิบัติการ/i)

    if (sec1Index === -1 || sec2Index === -1 || sec3Index === -1) {
      return { intro: '', macro: rawText, stocks: [], actions: [], isStructured: false }
    }

    // Extract Intro
    let intro = rawText.substring(0, sec1Index).trim()
    // Clean trailing horizontal rules
    intro = intro.replace(/---+/g, '').trim()

    // Extract Section 1 (Macro)
    let macro = rawText.substring(sec1Index, sec2Index).trim()
    macro = macro.replace(/^(?:1\.)\s*(?:🧭)?\s*\*\*[^*]+\*\*/, '').trim()

    // Extract Section 2 (Stocks)
    let stocksRaw = rawText.substring(sec2Index, sec3Index).trim()
    stocksRaw = stocksRaw.replace(/^(?:2\.)\s*(?:🎯)?\s*\*\*[^*]+\*\*/, '').trim()

    // Parse individual stock bullets
    const stockLines = stocksRaw
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('-') || l.startsWith('•') || l.startsWith('*'))

    const parsedStocks: ParsedStockItem[] = []

    for (const line of stockLines) {
      // E.g. - **SCHD ($33.02 | RSI: 31.1 | S1: $32.22):** ส่งสัญญาณ...
      // or - **VOO:** ...
      const match = line.match(/^[-•*]\s*\*\*([A-Za-z0-9_.\-]+)(?:\s*\(([^)]+)\))?:\*\*\s*(.+)$/)
      if (match) {
        parsedStocks.push({
          ticker: match[1].trim().toUpperCase(),
          metricsText: match[2]?.trim() || '',
          detailsText: match[3]?.trim() || '',
        })
      } else {
        // Fallback for differently formatted bullets
        const cleanLine = line.replace(/^[-•*]\s*/, '')
        parsedStocks.push({
          ticker: 'INFO',
          metricsText: '',
          detailsText: cleanLine,
        })
      }
    }

    // Extract Section 3 (Actions)
    let actionsRaw = rawText.substring(sec3Index).trim()
    actionsRaw = actionsRaw.replace(/^(?:3\.)\s*(?:📋)?\s*\*\*[^*]+\*\*/, '').trim()

    const parsedActions: ParsedActionStep[] = []
    const actionLines = actionsRaw
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => /^\d+\./.test(l))

    let stepNum = 1
    for (const line of actionLines) {
      // E.g. 1. **ตั้งรับ SCHD ที่แนวรับ $32.22:** พิจารณาใช้เงินสด...
      const match = line.match(/^\d+\.\s*\*\*([^*]+):\*\*\s*(.+)$/)
      if (match) {
        parsedActions.push({
          number: stepNum++,
          headline: match[1].trim(),
          details: match[2].trim(),
        })
      } else {
        // Fallback without colon inside bold
        const clean = line.replace(/^\d+\.\s*/, '')
        parsedActions.push({
          number: stepNum++,
          headline: clean,
          details: '',
        })
      }
    }

    return {
      intro,
      macro,
      stocks: parsedStocks,
      actions: parsedActions,
      isStructured: true,
    }
  } catch (err) {
    console.error('Error parsing AI brief:', err)
    return { intro: '', macro: rawText, stocks: [], actions: [], isStructured: false }
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

  return (
    <div className="bg-gradient-to-br from-indigo-950/60 via-slate-900/90 to-purple-950/50 border-2 border-indigo-500/40 rounded-3xl p-6 md:p-8 shadow-2xl backdrop-blur-2xl relative overflow-hidden space-y-6">
      <div className="absolute top-0 right-0 -mt-16 -mr-16 w-80 h-80 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-white/[0.08]">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border-2 border-indigo-500/40 flex items-center justify-center text-indigo-300 shadow-lg shadow-indigo-950/60">
            <Sparkles className="w-6 h-6 text-indigo-300 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="text-xl md:text-2xl font-black text-white tracking-tight">
                AI Market Strategist
              </h3>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 tracking-wide uppercase">
                สรุปทิศทาง & แผนพอร์ตเฉพาะคุณ
              </span>
            </div>
            <p className="text-sm text-slate-300 mt-0.5">
              {updatedAt
                ? `วิเคราะห์ล่าสุดเมื่อ: ${new Date(updatedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น. (ระบบ AI: ${modelUsed || 'Gemini'})`
                : 'วิเคราะห์สภาวะตลาดโลกผสานสัญญาณแนวรับ-แนวต้านของหุ้นในพอร์ตคุณ'}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 self-start md:self-auto flex-wrap">
          {text && (
            <button
              onClick={onCopyNotes}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-white/[0.08] hover:bg-white/[0.14] text-slate-100 border border-white/[0.15] transition-all flex items-center gap-2 shadow-xs"
              title="คัดลอกบทวิเคราะห์ลงในสมุดบันทึกประจำวัน"
            >
              <FileText className="w-4 h-4 text-indigo-400" />
              <span>คัดลอกลงบันทึก</span>
            </button>
          )}

          <button
            onClick={onRegenerate}
            disabled={isGenerating}
            className="px-5 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-600 hover:from-indigo-500 hover:to-blue-500 text-white shadow-xl shadow-indigo-600/40 transition-all flex items-center gap-2.5 disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>กำลังวิเคราะห์...</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 text-yellow-300 fill-yellow-300" />
                <span>{text ? 'ขอคำแนะนำ AI ใหม่' : 'เริ่มให้ AI วางแผน'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-rose-500/15 border-2 border-rose-500/40 rounded-2xl text-sm text-rose-200 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      {/* Content Display */}
      {text ? (
        <div className="space-y-6">
          {/* Intro Greeting Banner */}
          {parsed.intro && (
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-white/[0.08] text-sm text-slate-300 leading-relaxed italic">
              <RenderMarkdownText text={parsed.intro} />
            </div>
          )}

          {parsed.isStructured ? (
            <div className="space-y-5">
              {/* SECTION 1: MACRO & MARKET PULSE */}
              <div className="bg-slate-950/80 border-2 border-sky-500/30 rounded-2xl p-5 md:p-6 shadow-xl">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-xl bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-300">
                    <Compass className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-sky-400 uppercase tracking-wider block">
                      ส่วนที่ 1 • MACRO PULSE
                    </span>
                    <h4 className="text-lg font-bold text-white">
                      ทิศทางตลาดและบรรยากาศมหภาควันนี้
                    </h4>
                  </div>
                </div>

                <div className="text-base text-slate-200 leading-relaxed font-sans mt-2 pl-1 border-l-2 border-sky-500/40 ml-2 py-1">
                  <RenderMarkdownText text={parsed.macro} />
                </div>
              </div>

              {/* SECTION 2: PORTFOLIO KEY WATCHLIST */}
              <div className="bg-slate-950/80 border-2 border-indigo-500/30 rounded-2xl p-5 md:p-6 shadow-xl">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-300">
                    <Target className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider block">
                      ส่วนที่ 2 • PORTFOLIO SCAN
                    </span>
                    <h4 className="text-lg font-bold text-white">
                      วิเคราะห์เจาะจงสินทรัพย์ในพอร์ตของคุณ
                    </h4>
                  </div>
                </div>

                {parsed.stocks.length > 0 ? (
                  <div className="grid grid-cols-1 gap-3.5 mt-3">
                    {parsed.stocks.map((item, idx) => (
                      <div
                        key={idx}
                        className="bg-slate-900/80 hover:bg-slate-900 border border-white/[0.08] hover:border-indigo-500/40 rounded-2xl p-4 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1.5 flex-1">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <span className="px-3 py-1 rounded-xl text-sm font-black bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 font-mono tracking-wide">
                              {item.ticker}
                            </span>
                            {item.metricsText && (
                              <span className="px-2.5 py-0.5 rounded-lg text-xs font-mono font-semibold bg-white/[0.06] text-slate-300 border border-white/[0.06]">
                                {item.metricsText}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-slate-200 leading-relaxed font-sans">
                            <RenderMarkdownText text={item.detailsText} />
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-slate-300 leading-relaxed">
                    <RenderMarkdownText text={parsed.macro} />
                  </div>
                )}
              </div>

              {/* SECTION 3: TODAY'S EXECUTION CHECKLIST */}
              <div className="bg-slate-950/80 border-2 border-emerald-500/30 rounded-2xl p-5 md:p-6 shadow-xl">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-300">
                    <CalendarCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block">
                      ส่วนที่ 3 • DAILY GAME PLAN
                    </span>
                    <h4 className="text-lg font-bold text-white">
                      แผนปฏิบัติการ 3 ข้อที่ควรทำวันนี้
                    </h4>
                  </div>
                </div>

                {parsed.actions.length > 0 ? (
                  <div className="space-y-3 mt-3">
                    {parsed.actions.map((act) => (
                      <div
                        key={act.number}
                        className="bg-slate-900/90 border border-emerald-500/20 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 hover:border-emerald-500/40 transition-all"
                      >
                        <div className="flex items-start gap-3.5 flex-1">
                          <span className="w-8 h-8 rounded-full bg-emerald-500/20 border-2 border-emerald-500/40 text-emerald-300 flex items-center justify-center font-bold text-sm shrink-0 mt-0.5">
                            {act.number}
                          </span>
                          <div>
                            <h5 className="text-base font-bold text-white mb-1">
                              {act.headline}
                            </h5>
                            {act.details && (
                              <p className="text-sm text-slate-300 leading-relaxed">
                                <RenderMarkdownText text={act.details} />
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Interactive Add to Checklist Button */}
                        <button
                          onClick={() =>
                            onAddToChecklist(
                              `${act.headline}${act.details ? `: ${act.details}` : ''}`
                            )
                          }
                          className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 transition-all flex items-center gap-1.5 self-start sm:self-auto shrink-0 shadow-xs"
                          title="นำคำแนะนำข้อนี้ไปเพิ่มในเช็กลิสต์ประจำวันด้านล่าง"
                        >
                          <Plus className="w-4 h-4" />
                          <span>ใส่ในเช็กลิสต์</span>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-slate-200">
                    <RenderMarkdownText text={text} />
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Fallback Clean Markdown Card if unstructured */
            <div className="bg-slate-950/70 border border-white/[0.08] rounded-2xl p-6 text-sm text-slate-200 leading-relaxed space-y-4">
              <RenderMarkdownText text={text} />
            </div>
          )}
        </div>
      ) : (
        /* Empty State */
        <div className="bg-slate-950/50 border-2 border-dashed border-white/[0.08] rounded-2xl p-10 text-center space-y-3">
          <Sparkles className="w-12 h-12 text-indigo-400/70 mx-auto" />
          <h4 className="text-lg font-bold text-white">ยังไม่มีบทวิเคราะห์สำหรับวันนี้</h4>
          <p className="text-sm text-slate-400 max-w-lg mx-auto leading-relaxed">
            กดปุ่ม <strong className="text-indigo-300 font-semibold">&quot;เริ่มให้ AI วางแผน&quot;</strong>{' '}
            เพื่อประมวลผลดัชนีตลาดโลก สัญญาณแนวรับ-แนวต้าน (S1/R1) และระดับ RSI ของหุ้นในพอร์ตคุณ
          </p>
        </div>
      )}
    </div>
  )
}
