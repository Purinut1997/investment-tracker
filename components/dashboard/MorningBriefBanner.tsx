'use client'

import React, { useState, useMemo } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import {
  Sunrise,
  Sparkles,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Clock,
  Compass,
  Target,
  ExternalLink,
} from 'lucide-react'

interface LatestBriefResponse {
  brief: {
    id: string
    text: string
    modelUsed: string
    createdAt: string
    isToday: boolean
  } | null
}

const fetcher = (url: string) => fetch(url).then((res) => res.json())

function formatBangkokTime(dateString: string): string {
  try {
    const d = new Date(dateString)
    return d.toLocaleTimeString('th-TH', {
      timeZone: 'Asia/Bangkok',
      hour: '2-digit',
      minute: '2-digit',
    }) + ' น.'
  } catch {
    return ''
  }
}

function formatBangkokDate(dateString: string): string {
  try {
    const d = new Date(dateString)
    return d.toLocaleDateString('th-TH', {
      timeZone: 'Asia/Bangkok',
      day: 'numeric',
      month: 'short',
    })
  } catch {
    return ''
  }
}

export function MorningBriefBanner() {
  const [isExpanded, setIsExpanded] = useState(false)

  const { data, isLoading } = useSWR<LatestBriefResponse>(
    '/api/daily-plan/latest-brief',
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
    }
  )

  const brief = data?.brief

  // Extract a clean preview snippet
  const { previewSnippet, actionSteps } = useMemo(() => {
    if (!brief?.text) return { previewSnippet: '', actionSteps: [] }

    const raw = brief.text

    // Find section 1 (macro)
    const sec1Index = raw.search(/(?:1\.|\n1\.)\s*(?:🧭)?\s*\**ทิศทาง/i)
    const sec2Index = raw.search(/(?:2\.|\n2\.)\s*(?:🎯)?\s*\**วิเคราะห์/i)
    const sec3Index = raw.search(/(?:3\.|\n3\.)\s*(?:📋)?\s*\**แผนปฏิบัติการ/i)

    let snippet = ''
    if (sec1Index !== -1 && sec2Index !== -1) {
      snippet = raw.substring(sec1Index, sec2Index)
        .replace(/^(?:1\.)\s*(?:🧭)?\s*\*\*[^*]+\*\*/, '')
        .replace(/\*\*/g, '')
        .trim()
    } else {
      snippet = raw.slice(0, 180).replace(/\*\*/g, '')
    }

    // Truncate snippet to ~140 chars for clean single/double-line layout
    if (snippet.length > 150) {
      snippet = snippet.substring(0, 147) + '...'
    }

    // Extract 3 action steps for the quick drawer
    const steps: string[] = []
    if (sec3Index !== -1) {
      const sec3Text = raw.substring(sec3Index)
      const lines = sec3Text.split('\n')
      for (const line of lines) {
        const trimmed = line.trim()
        if (/^(?:[-*]|\d+\.)/.test(trimmed) && !trimmed.includes('แผนปฏิบัติการ')) {
          steps.push(trimmed.replace(/^(?:[-*]|\d+\.)\s*/, ''))
          if (steps.length >= 3) break
        }
      }
    }

    return { previewSnippet: snippet, actionSteps: steps }
  }, [brief?.text])

  if (isLoading) {
    return (
      <div className="rounded-2xl bg-[#121622]/80 border border-white/[0.07] p-4 animate-pulse flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-800" />
          <div className="space-y-1.5">
            <div className="h-3 w-40 bg-slate-800 rounded" />
            <div className="h-4 w-72 bg-slate-850 rounded" />
          </div>
        </div>
        <div className="h-8 w-28 bg-slate-800 rounded-xl" />
      </div>
    )
  }

  // If no brief exists at all yet
  if (!brief) {
    return (
      <div className="rounded-2xl bg-gradient-to-r from-amber-500/10 via-slate-900/60 to-indigo-950/40 border border-amber-500/20 p-4 sm:p-4.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5 shadow-lg backdrop-blur-md">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400/20 to-orange-500/20 border border-amber-400/30 flex items-center justify-center text-amber-300 shrink-0">
            <Sunrise className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300">
                ☀️ Daily Morning AI Briefing
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06] text-slate-400 font-mono">
                06:30 น. ทุกวัน
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              ระบบพร้อมวิเคราะห์สรุปสภาวะตลาดเช้า และจุดรับ S1 ในพอร์ตอัตโนมัติ
            </p>
          </div>
        </div>
        <Link
          href="/daily-plan"
          className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 transition-all flex items-center gap-1.5 shadow-md shadow-amber-500/20 shrink-0"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>เปิดแผนประจำวัน</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-gradient-to-r from-amber-500/[0.12] via-[#141926]/95 to-indigo-950/40 border border-amber-500/30 p-4 sm:p-4.5 shadow-xl shadow-amber-950/10 backdrop-blur-md transition-all">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left column: Icon & Title & Snippet */}
        <div className="flex items-start gap-3.5 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-amber-500/25 shrink-0 mt-0.5 md:mt-0">
            <Sunrise className="w-5 h-5 text-slate-950" />
          </div>

          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-400/20 text-amber-300 border border-amber-400/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                สรุปเช้า AI (06:30 น.)
              </span>

              <span className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                <Clock className="w-3 h-3 text-slate-400" />
                {brief.isToday ? 'วันนี้' : formatBangkokDate(brief.createdAt)}{' '}
                {formatBangkokTime(brief.createdAt)}
              </span>

              {brief.modelUsed && (
                <span className="hidden sm:inline text-[10px] text-slate-400 font-mono bg-white/[0.04] px-2 py-0.5 rounded border border-white/[0.06]">
                  {brief.modelUsed.replace('gemini-', '')}
                </span>
              )}
            </div>

            <p className="text-xs sm:text-sm text-slate-200 line-clamp-2 leading-relaxed">
              {previewSnippet || 'สรุปภาพรวมดัชนีตลาดโลก สัญญาณเทคนิคอลแนวรับ S1 และ 3 สิ่งที่ควรโฟกัสวันนี้'}
            </p>
          </div>
        </div>

        {/* Right column: Action buttons */}
        <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
          {actionSteps.length > 0 && (
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span>{isExpanded ? 'ย่อสรุป' : 'ดู 3 แผนด่วน'}</span>
              {isExpanded ? (
                <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              )}
            </button>
          )}

          <Link
            href="/daily-plan"
            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-400 transition-all flex items-center gap-1.5 shadow-lg shadow-amber-500/25 group cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-200" />
            <span>อ่านฉบับเต็ม & เช็คลิสต์</span>
            <ArrowRight className="w-3.5 h-3.5 text-white group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </div>

      {/* Expandable Quick Drawer: 3 Action Steps */}
      {isExpanded && actionSteps.length > 0 && (
        <div className="mt-3.5 pt-3.5 border-t border-amber-500/20 grid grid-cols-1 md:grid-cols-3 gap-2.5 animate-in fade-in slide-in-from-top-2 duration-200">
          {actionSteps.map((step, idx) => (
            <div
              key={idx}
              className="p-2.5 rounded-xl bg-slate-900/80 border border-white/[0.07] flex items-start gap-2.5 text-xs text-slate-200"
            >
              <div className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold font-mono text-[11px] shrink-0 mt-0.5">
                {idx + 1}
              </div>
              <p className="line-clamp-2 leading-relaxed">{step}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
