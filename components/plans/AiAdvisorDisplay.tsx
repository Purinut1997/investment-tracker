'use client'

import React, { useState, useMemo } from 'react'
import {
  Sparkles,
  Target,
  TrendingUp,
  AlertTriangle,
  PauseCircle,
  Coins,
  ShieldAlert,
  Copy,
  Check,
  ChevronRight,
  Info,
  CheckCircle2,
} from 'lucide-react'

interface AiAdvisorDisplayProps {
  advice: string
  disclaimer?: string
  modelUsed?: string
  updatedAt?: string
  onRefresh?: () => void
  isRefreshing?: boolean
}

interface ParsedSection {
  id: string
  type: 'takeaway' | 'buy' | 'pause' | 'allocation' | 'risk' | 'general'
  title: string
  icon: React.ReactNode
  color: {
    border: string
    bg: string
    badgeBg: string
    badgeText: string
    accent: string
  }
  content: string[]
}

export function AiAdvisorDisplay({
  advice,
  disclaimer,
  modelUsed,
  updatedAt,
  onRefresh,
  isRefreshing,
}: AiAdvisorDisplayProps) {
  const [copied, setCopied] = useState(false)

  // Copy to clipboard
  function handleCopy() {
    navigator.clipboard.writeText(advice)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Parse text into structured executive cards
  const parsedSections = useMemo<ParsedSection[]>(() => {
    if (!advice) return []

    // Split by markdown headers (### or ## or 1. / 2. / 3.)
    const rawLines = advice.split('\n')
    const sections: ParsedSection[] = []
    let currentTitle = ''
    let currentLines: string[] = []

    function flushSection() {
      if (currentLines.length === 0 && !currentTitle) return

      const cleanTitle = currentTitle.replace(/^#+\s*/, '').replace(/\*+/g, '').trim()
      const lower = cleanTitle.toLowerCase()

      let type: ParsedSection['type'] = 'general'
      let icon = <Info className="w-4 h-4" />
      let color = {
        border: 'border-white/[0.08]',
        bg: 'bg-white/[0.02]',
        badgeBg: 'bg-white/[0.06]',
        badgeText: 'text-slate-300',
        accent: 'text-white',
      }

      if (lower.includes('สรุป') || lower.includes('takeaway') || lower.includes('ยุทธศาสตร์')) {
        type = 'takeaway'
        icon = <Target className="w-4 h-4 text-indigo-400" />
        color = {
          border: 'border-indigo-500/30',
          bg: 'bg-indigo-950/20',
          badgeBg: 'bg-indigo-500/15',
          badgeText: 'text-indigo-300',
          accent: 'text-indigo-400',
        }
      } else if (
        lower.includes('ช้อน') ||
        lower.includes('เติมเงิน') ||
        lower.includes('ซื้อ') ||
        lower.includes('accumulate') ||
        lower.includes('buy')
      ) {
        type = 'buy'
        icon = <TrendingUp className="w-4 h-4 text-emerald-400" />
        color = {
          border: 'border-emerald-500/30',
          bg: 'bg-emerald-950/20',
          badgeBg: 'bg-emerald-500/15',
          badgeText: 'text-emerald-300',
          accent: 'text-emerald-400',
        }
      } else if (
        lower.includes('งดซื้อ') ||
        lower.includes('ชะลอ') ||
        lower.includes('pause') ||
        lower.includes('hold')
      ) {
        type = 'pause'
        icon = <PauseCircle className="w-4 h-4 text-amber-400" />
        color = {
          border: 'border-amber-500/30',
          bg: 'bg-amber-950/20',
          badgeBg: 'bg-amber-500/15',
          badgeText: 'text-amber-300',
          accent: 'text-amber-400',
        }
      } else if (
        lower.includes('จัดสรร') ||
        lower.includes('เดือนหน้า') ||
        lower.includes('dca') ||
        lower.includes('งบ') ||
        lower.includes('เงินลงทุน')
      ) {
        type = 'allocation'
        icon = <Coins className="w-4 h-4 text-cyan-400" />
        color = {
          border: 'border-cyan-500/30',
          bg: 'bg-cyan-950/20',
          badgeBg: 'bg-cyan-500/15',
          badgeText: 'text-cyan-300',
          accent: 'text-cyan-400',
        }
      } else if (
        lower.includes('เสี่ยง') ||
        lower.includes('กระจุกตัว') ||
        lower.includes('risk') ||
        lower.includes('เตือน')
      ) {
        type = 'risk'
        icon = <ShieldAlert className="w-4 h-4 text-rose-400" />
        color = {
          border: 'border-rose-500/30',
          bg: 'bg-rose-950/20',
          badgeBg: 'bg-rose-500/15',
          badgeText: 'text-rose-300',
          accent: 'text-rose-400',
        }
      }

      sections.push({
        id: `section_${sections.length}`,
        type,
        title: cleanTitle || 'สรุปคำแนะนำเพิ่มเติม',
        icon,
        color,
        content: currentLines.filter((l) => l.trim().length > 0),
      })

      currentTitle = ''
      currentLines = []
    }

    for (const line of rawLines) {
      const trimmed = line.trim()
      // Skip polite greeting boilerplate if it slips in
      if (
        trimmed.startsWith('เรียน') ||
        trimmed.startsWith('สวัสดี') ||
        trimmed.includes('Investment Advisor AI') ||
        trimmed.includes('ยินดีที่ได้วิเคราะห์')
      ) {
        continue
      }

      if (
        trimmed.startsWith('###') ||
        trimmed.startsWith('##') ||
        /^[1-5]\.\s+\*{1,2}/.test(trimmed)
      ) {
        flushSection()
        currentTitle = trimmed
      } else {
        currentLines.push(trimmed)
      }
    }
    flushSection()

    // If parsing produced no distinct sections, fall back to 1 section
    if (sections.length === 0 && rawLines.length > 0) {
      sections.push({
        id: 'fallback_1',
        type: 'general',
        title: 'สรุปบทวิเคราะห์พอร์ตการลงทุน',
        icon: <Sparkles className="w-4 h-4 text-indigo-400" />,
        color: {
          border: 'border-indigo-500/20',
          bg: 'bg-black/30',
          badgeBg: 'bg-indigo-500/10',
          badgeText: 'text-indigo-300',
          accent: 'text-indigo-400',
        },
        content: rawLines.filter((l) => l.trim().length > 0),
      })
    }

    return sections
  }, [advice])

  // Helper to highlight Tickers and bold key phrases
  function formatLineContent(text: string) {
    // Remove leading bullet asterisks or dashes
    const clean = text.replace(/^[\*\-\•]\s*/, '').trim()

    // Split text by markdown bold **...**
    const parts = clean.split(/(\*\*[^*]+\*\*)/g)

    return (
      <span>
        {parts.map((part, idx) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            const inner = part.slice(2, -2)
            // If it's a known stock ticker or financial term
            const isTicker = /^[A-Z0-9]{2,6}(\.BK)?$/.test(inner.trim())
            if (isTicker) {
              return (
                <span
                  key={idx}
                  className="inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded-md text-[11px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shadow-xs"
                >
                  {inner}
                </span>
              )
            }
            return (
              <strong key={idx} className="text-white font-bold bg-white/[0.04] px-1 py-0.5 rounded">
                {inner}
              </strong>
            )
          }
          return <span key={idx}>{part}</span>
        })}
      </span>
    )
  }

  return (
    <div className="space-y-4">
      {/* Action Bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            บทสรุปยุทธศาสตร์ระดับสถาบัน
          </span>
          {modelUsed && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white/[0.05] border border-white/[0.08] text-slate-400">
              {modelUsed}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className="text-xs text-slate-400 hover:text-white px-2.5 py-1 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] transition-all flex items-center gap-1.5 cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-medium">คัดลอกแล้ว</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-slate-400" />
              <span>คัดลอกบทสรุป</span>
            </>
          )}
        </button>
      </div>

      {/* Structured Executive Cards Grid */}
      <div className="grid grid-cols-1 gap-3.5">
        {parsedSections.map((sec) => (
          <div
            key={sec.id}
            className={`p-4 sm:p-5 rounded-2xl ${sec.color.bg} border ${sec.color.border} shadow-lg transition-all duration-300 hover:border-white/[0.15] space-y-3 relative overflow-hidden`}
          >
            {/* Header Badge */}
            <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] pb-2.5">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${sec.color.badgeBg}`}>
                  {sec.icon}
                </div>
                <h4 className="text-sm font-bold text-white tracking-wide">
                  {sec.title}
                </h4>
              </div>
              <span
                className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full ${sec.color.badgeBg} ${sec.color.badgeText} border border-white/[0.06]`}
              >
                {sec.type === 'takeaway' && 'ยุทธศาสตร์หลัก'}
                {sec.type === 'buy' && 'เร่งสะสม / จุดช้อน'}
                {sec.type === 'pause' && 'งดซื้อชั่วคราว'}
                {sec.type === 'allocation' && 'แผนจัดสรรงบ'}
                {sec.type === 'risk' && 'แจ้งเตือนความเสี่ยง'}
                {sec.type === 'general' && 'ข้อเสนอแนะ'}
              </span>
            </div>

            {/* Bullet List Content */}
            <div className="space-y-2 text-xs sm:text-sm text-slate-300 leading-relaxed font-sans">
              {sec.content.map((line, lIdx) => {
                // If the line looks like a sub-heading or divider
                if (line.startsWith('---') || line.startsWith('___')) {
                  return <hr key={lIdx} className="border-white/[0.06] my-2" />
                }

                return (
                  <div key={lIdx} className="flex items-start gap-2.5">
                    <span className="text-indigo-400 mt-1 shrink-0">
                      <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                    </span>
                    <div className="flex-1">
                      {formatLineContent(line)}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {disclaimer && (
        <p className="text-[11px] text-slate-500 flex items-center gap-1.5 pt-1">
          <Info className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <span>{disclaimer}</span>
        </p>
      )}
    </div>
  )
}
