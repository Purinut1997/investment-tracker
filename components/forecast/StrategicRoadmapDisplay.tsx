'use client'

import React, { useState, useMemo } from 'react'
import {
  Sparkles,
  Target,
  TrendingUp,
  Coins,
  ShieldCheck,
  Copy,
  Check,
  ChevronRight,
  Info,
  Zap,
  Compass,
  CheckCircle2,
  Calendar,
  Percent,
} from 'lucide-react'

interface StrategicRoadmapDisplayProps {
  explanation: string
  modelUsed?: string
  updatedAt?: string
  probabilityOfSuccess?: number | null
  p50Value?: number | null
  realP50Value?: number | null
  monthlyRetirementIncome?: number | null
}

interface ParsedCard {
  id: string
  category: 'overview' | 'interpretation' | 'milestones' | 'blueprint' | 'conclusion' | 'general'
  title: string
  badgeLabel: string
  icon: React.ReactNode
  color: {
    border: string
    bg: string
    badgeBg: string
    badgeText: string
    accent: string
    stepBadge?: string
  }
  introText?: string
  bullets: string[]
}

export function StrategicRoadmapDisplay({
  explanation,
  modelUsed,
  updatedAt,
  probabilityOfSuccess,
  p50Value,
  realP50Value,
  monthlyRetirementIncome,
}: StrategicRoadmapDisplayProps) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(explanation)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Parse markdown into distinct executive category cards
  const cards = useMemo<ParsedCard[]>(() => {
    if (!explanation) return []

    const lines = explanation.split('\n')
    const result: ParsedCard[] = []

    let currentTitle = ''
    let currentLines: string[] = []
    let overviewLines: string[] = []
    let hasEncounteredSection = false

    function flushCard() {
      if (currentLines.length === 0 && !currentTitle) return

      const cleanTitle = currentTitle
        .replace(/^#+\s*/, '')
        .replace(/^[📈🎯💡🚀📌📊]\s*/, '')
        .replace(/\*+/g, '')
        .trim()

      const lower = cleanTitle.toLowerCase()

      let category: ParsedCard['category'] = 'general'
      let badgeLabel = 'หมวดหมู่ทั่วไป'
      let icon = <Info className="w-4 h-4 text-slate-400" />
      let color: ParsedCard['color'] = {
        border: 'border-white/[0.08]',
        bg: 'bg-white/[0.02]',
        badgeBg: 'bg-white/[0.06]',
        badgeText: 'text-slate-300',
        accent: 'text-white',
        stepBadge: 'bg-white/[0.08] text-slate-300',
      }

      if (lower.includes('สรุปภาพรวม') || lower.includes('overview') || lower.includes('executive summary')) {
        category = 'overview'
        badgeLabel = 'ภาพรวมผู้บริหาร'
        icon = <Sparkles className="w-4 h-4 text-indigo-400" />
        color = {
          border: 'border-indigo-500/35',
          bg: 'bg-gradient-to-br from-indigo-950/40 via-[#12162a] to-purple-950/20',
          badgeBg: 'bg-indigo-500/20',
          badgeText: 'text-indigo-300',
          accent: 'text-indigo-400',
        }
      } else if (
        lower.includes('ตีความ') ||
        lower.includes('มั่นคง') ||
        lower.includes('interpretation') ||
        lower.includes('อำนาจซื้อ')
      ) {
        category = 'interpretation'
        badgeLabel = 'การตีความ & อำนาจซื้อแท้จริง'
        icon = <TrendingUp className="w-4 h-4 text-blue-400" />
        color = {
          border: 'border-blue-500/30',
          bg: 'bg-gradient-to-br from-blue-950/30 via-[#101928] to-cyan-950/20',
          badgeBg: 'bg-blue-500/20',
          badgeText: 'text-blue-300',
          accent: 'text-blue-400',
        }
      } else if (
        lower.includes('ไทม์ไลน์') ||
        lower.includes('หลักไมล์') ||
        lower.includes('milestone') ||
        lower.includes('ทบต้น')
      ) {
        category = 'milestones'
        badgeLabel = 'ไทม์ไลน์ & จุดเร่งทบต้น'
        icon = <Target className="w-4 h-4 text-cyan-400" />
        color = {
          border: 'border-cyan-500/30',
          bg: 'bg-gradient-to-br from-cyan-950/30 via-[#0e1d24] to-teal-950/20',
          badgeBg: 'bg-cyan-500/20',
          badgeText: 'text-cyan-300',
          accent: 'text-cyan-400',
        }
      } else if (
        lower.includes('พิมพ์เขียว') ||
        lower.includes('กลยุทธ์') ||
        lower.includes('blueprint') ||
        lower.includes('ปฏิบัติ') ||
        lower.includes('action')
      ) {
        category = 'blueprint'
        badgeLabel = 'แผนปฏิบัติการ (Action Plan)'
        icon = <Zap className="w-4 h-4 text-emerald-400" />
        color = {
          border: 'border-emerald-500/35',
          bg: 'bg-gradient-to-br from-emerald-950/35 via-[#0e2118] to-teal-950/20',
          badgeBg: 'bg-emerald-500/20',
          badgeText: 'text-emerald-300',
          accent: 'text-emerald-400',
          stepBadge: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
        }
      } else if (
        lower.includes('คำแนะนำ') ||
        lower.includes('ข้อสรุป') ||
        lower.includes('conclusion') ||
        lower.includes('recommendation')
      ) {
        category = 'conclusion'
        badgeLabel = 'คำแนะนำสรุปฟันธง'
        icon = <Compass className="w-4 h-4 text-amber-400" />
        color = {
          border: 'border-amber-500/30',
          bg: 'bg-gradient-to-br from-amber-950/30 via-[#1c1810] to-orange-950/20',
          badgeBg: 'bg-amber-500/20',
          badgeText: 'text-amber-300',
          accent: 'text-amber-400',
        }
      }

      // Filter meaningful content lines
      const cleanBullets = currentLines.filter((l) => l.trim().length > 0)

      if (cleanTitle || cleanBullets.length > 0) {
        result.push({
          id: `card_${result.length}`,
          category,
          title: cleanTitle || 'ประเด็นสำคัญ',
          badgeLabel,
          icon,
          color,
          bullets: cleanBullets,
        })
      }

      currentTitle = ''
      currentLines = []
    }

    // Pattern matching section headers:
    // e.g. "### 1. ...", "📈 **1. ...**", "**1. ...**", "## ...", "1. **...**"
    const headerRegex = /^(#{1,4}\s*|[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}]\s*)?(\*{0,2}[1-5]\.\s*|\*{2}[^:]+:\*{2}|\*{2}ข้อ[1-5])/u

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      // Skip greeting boilerplate
      if (
        line.startsWith('สวัสดี') ||
        line.startsWith('เรียน') ||
        line.includes('Investment Advisor AI')
      ) {
        continue
      }

      const isHeader =
        line.startsWith('###') ||
        line.startsWith('##') ||
        headerRegex.test(line) ||
        (line.startsWith('**') && line.endsWith('**') && line.length < 80)

      if (isHeader) {
        hasEncounteredSection = true
        flushCard()
        currentTitle = line
      } else {
        if (!hasEncounteredSection) {
          overviewLines.push(line)
        } else {
          currentLines.push(line)
        }
      }
    }
    flushCard()

    // If there were overview lead-in lines before Section 1, make it an Executive Summary card
    if (overviewLines.length > 0) {
      result.unshift({
        id: 'card_overview',
        category: 'overview',
        title: 'บทสรุปภาพรวมผู้บริหาร (Executive Overview)',
        badgeLabel: 'สรุปผลลัพธ์หลัก',
        icon: <Sparkles className="w-4 h-4 text-indigo-400" />,
        color: {
          border: 'border-indigo-500/35',
          bg: 'bg-gradient-to-br from-indigo-950/40 via-[#12162a] to-purple-950/20',
          badgeBg: 'bg-indigo-500/20',
          badgeText: 'text-indigo-300',
          accent: 'text-indigo-400',
        },
        bullets: overviewLines,
      })
    }

    // If nothing was parsed into cards, fallback
    if (result.length === 0 && lines.length > 0) {
      result.push({
        id: 'card_single',
        category: 'general',
        title: 'บทวิเคราะห์ยุทธศาสตร์ความมั่งคั่ง',
        badgeLabel: 'บทสรุป AI',
        icon: <Sparkles className="w-4 h-4 text-indigo-400" />,
        color: {
          border: 'border-indigo-500/25',
          bg: 'bg-black/30',
          badgeBg: 'bg-indigo-500/15',
          badgeText: 'text-indigo-300',
          accent: 'text-indigo-400',
        },
        bullets: lines.filter((l) => l.trim().length > 0),
      })
    }

    return result
  }, [explanation])

  // Helper to format line content with high-contrast styling for money and bold tags
  function renderFormattedContent(text: string) {
    // Strip leading list symbols
    const clean = text.replace(/^[\*\-\•]\s*/, '').trim()

    // Match markdown bold **...**
    const parts = clean.split(/(\*\*[^*]+\*\*)/g)

    return (
      <span className="leading-relaxed">
        {parts.map((part, idx) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            const inner = part.slice(2, -2).trim()

            // Check if it's monetary amount like ฿1,000,000
            const isMoney = /^฿[\d,]+(\.\d+)?(\/เดือน|\/ปี)?$/.test(inner)
            // Check if percentage like 72%
            const isPercent = /^\d+(\.\d+)?%$/.test(inner)

            if (isMoney) {
              return (
                <span
                  key={idx}
                  className="inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded-md font-mono font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-500/25 text-xs shadow-xs"
                >
                  {inner}
                </span>
              )
            }

            if (isPercent) {
              return (
                <span
                  key={idx}
                  className="inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded-md font-mono font-bold text-cyan-300 bg-cyan-500/15 border border-cyan-500/25 text-xs shadow-xs"
                >
                  {inner}
                </span>
              )
            }

            return (
              <strong
                key={idx}
                className="text-white font-semibold bg-white/[0.07] px-1 py-0.5 rounded mx-0.5 border border-white/[0.08]"
              >
                {inner}
              </strong>
            )
          }

          // Plain text chunk
          return <span key={idx}>{part}</span>
        })}
      </span>
    )
  }

  return (
    <div className="space-y-4">
      {/* ── Top Executive Action & Meta Ribbon ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-white/[0.06]">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px] font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            รายงานสังเคราะห์ยุทธศาสตร์ความมั่งคั่งแบบเป็นทางการ
          </span>
          {modelUsed && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.08] text-slate-400">
              {modelUsed}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] transition-all flex items-center gap-1.5 cursor-pointer self-start sm:self-auto shadow-xs active:scale-95"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-medium">คัดลอกรายงานแล้ว</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-slate-400" />
              <span>คัดลอกบทวิเคราะห์</span>
            </>
          )}
        </button>
      </div>

      {/* ── Optional KPI Ribbon (If figures provided) ── */}
      {(probabilityOfSuccess !== undefined && probabilityOfSuccess !== null) ||
      (p50Value && p50Value > 0) ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          {probabilityOfSuccess !== undefined && probabilityOfSuccess !== null && (
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/15 text-indigo-400 flex items-center justify-center shrink-0">
                <Percent className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-sans">โอกาสบรรลุเป้าหมาย</span>
                <span className="text-sm font-bold font-mono text-white">
                  {probabilityOfSuccess.toFixed(0)}%
                </span>
              </div>
            </div>
          )}

          {p50Value && p50Value > 0 && (
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-sans">คาดการณ์มัธยฐาน (P50)</span>
                <span className="text-sm font-bold font-mono text-emerald-300">
                  ฿{Math.round(p50Value).toLocaleString()}
                </span>
              </div>
            </div>
          )}

          {realP50Value && realP50Value > 0 && (
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/15 text-cyan-400 flex items-center justify-center shrink-0">
                <Coins className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-sans">อำนาจซื้อแท้จริง (หลังเงินเฟ้อ)</span>
                <span className="text-sm font-bold font-mono text-cyan-300">
                  ฿{Math.round(realP50Value).toLocaleString()}
                </span>
              </div>
            </div>
          )}

          {monthlyRetirementIncome && monthlyRetirementIncome > 0 && (
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-sans">เงินเดือนเกษียณ (กฎ 4%)</span>
                <span className="text-sm font-bold font-mono text-amber-300">
                  ฿{Math.round(monthlyRetirementIncome).toLocaleString()}/ด.
                </span>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* ── Executive Cards Layout ── */}
      <div className="space-y-4">
        {cards.map((card, cIdx) => (
          <div
            key={card.id}
            className={`p-5 sm:p-6 rounded-2xl ${card.color.bg} border ${card.color.border} shadow-xl transition-all duration-300 hover:border-white/[0.2] space-y-4 relative overflow-hidden`}
          >
            {/* Header Badge */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-xl ${card.color.badgeBg} border border-white/[0.06]`}>
                  {card.icon}
                </div>
                <h4 className="text-sm sm:text-base font-bold text-white tracking-wide flex items-center gap-2">
                  {card.title}
                </h4>
              </div>

              <span
                className={`text-[11px] font-semibold px-3 py-1 rounded-full ${card.color.badgeBg} ${card.color.badgeText} border border-white/[0.08] self-start sm:self-auto font-sans`}
              >
                {card.badgeLabel}
              </span>
            </div>

            {/* Bullets / Paragraphs */}
            <div className="space-y-3 text-xs sm:text-sm text-slate-300 font-sans leading-relaxed">
              {card.bullets.map((paragraph, pIdx) => {
                // If it's a step-by-step recommendation in the blueprint
                const stepMatch = paragraph.match(/^(\d+\.|\-|\*)\s*(.*)/)

                if (card.category === 'blueprint') {
                  return (
                    <div
                      key={pIdx}
                      className="p-3.5 rounded-xl bg-black/25 border border-white/[0.06] flex items-start gap-3 transition-all hover:bg-black/35"
                    >
                      <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold font-mono">
                        {pIdx + 1}
                      </div>
                      <div className="flex-1">
                        {renderFormattedContent(paragraph)}
                      </div>
                    </div>
                  )
                }

                return (
                  <div key={pIdx} className="flex items-start gap-2.5">
                    <span className="text-indigo-400 mt-1 shrink-0">
                      <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                    </span>
                    <div className="flex-1 leading-relaxed">
                      {renderFormattedContent(paragraph)}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-slate-500 flex items-center gap-1.5 pt-1">
        <Info className="w-3.5 h-3.5 text-slate-500 shrink-0" />
        <span>
          แบบจำลองสถิติ Monte Carlo และบทวิเคราะห์ AI จัดทำขึ้นเพื่อเป็นเข็มทิศวางแผนความมั่งคั่งส่วนบุคคล ไม่ถือเป็นการการันตีผลตอบแทนการลงทุน
        </span>
      </p>
    </div>
  )
}
