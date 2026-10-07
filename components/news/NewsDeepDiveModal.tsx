'use client'

import React, { useState, useEffect } from 'react'
import { X, Sparkles, TrendingUp, Minus, TrendingDown, Target, Loader2, AlertCircle } from 'lucide-react'
import type { EnrichedNewsItem } from './ActionableNewsCard'
import type { NewsDeepDiveResult } from '@/lib/news/news-analyzer'

interface NewsDeepDiveModalProps {
  item: EnrichedNewsItem | null
  onClose: () => void
}

export function NewsDeepDiveModal({ item, onClose }: NewsDeepDiveModalProps) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<NewsDeepDiveResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!item) {
      setData(null)
      setError(null)
      return
    }

    let isMounted = true
    setLoading(true)
    setError(null)

    fetch('/api/news/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        headline: item.headline,
        summary: item.summary,
        symbol: item.symbol,
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error('ไม่สามารถวิเคราะห์ข้อมูลได้')
        return res.json()
      })
      .then((res) => {
        if (isMounted) {
          setData(res.deepDive)
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || 'เกิดข้อผิดพลาดในการวิเคราะห์ AI')
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [item])

  if (!item) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#12151C] border border-white/[0.1] rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl shadow-black/80 p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-white/[0.08]">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                {item.symbol || 'ภาพรวมตลาด'}
              </span>
              <span className="text-xs text-slate-400 font-medium">
                AI Scenario & Fundamental Analysis
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-white leading-snug">
              {item.headline}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-400">
            <Loader2 className="w-7 h-7 animate-spin text-indigo-400" />
            <p className="text-xs font-medium">กำลังประเมินผลกระทบเชิงลึกด้วย AI...</p>
          </div>
        ) : error ? (
          <div className="p-6 rounded-xl bg-rose-500/10 border border-rose-500/20 text-center space-y-2">
            <AlertCircle className="w-6 h-6 text-rose-400 mx-auto" />
            <p className="text-xs text-rose-300">{error}</p>
          </div>
        ) : data ? (
          <div className="space-y-5 text-xs text-slate-300">
            {/* Why it matters */}
            <div className="p-4 rounded-xl bg-[#181C25] border border-white/[0.06] space-y-1.5">
              <div className="flex items-center gap-2 text-indigo-400 font-bold">
                <Sparkles className="w-4 h-4" />
                <span>ทำไมข่าวนี้ถึงสำคัญกับพอร์ตของคุณ?</span>
              </div>
              <p className="leading-relaxed text-slate-200">{data.whyItMatters}</p>
            </div>

            {/* Fundamental Impact */}
            <div className="p-4 rounded-xl bg-[#181C25] border border-white/[0.06] space-y-1.5">
              <span className="text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                ผลกระทบต่อพื้นฐานกิจการและมูลค่า (Fundamentals & Valuation)
              </span>
              <p className="leading-relaxed text-slate-200">{data.fundamentalImpact}</p>
            </div>

            {/* Scenarios: Bull / Base / Bear */}
            <div className="space-y-2.5">
              <span className="text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                การประเมินสถานการณ์ 3 รูปแบบ (Scenario Analysis)
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Bull */}
                <div className="p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-1">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-xs">
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>Bull Case (ปัจจัยบวก)</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">{data.scenarios.bull}</p>
                </div>

                {/* Base */}
                <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-1">
                  <div className="flex items-center gap-1.5 text-slate-300 font-bold text-xs">
                    <Minus className="w-3.5 h-3.5" />
                    <span>Base Case (คาดการณ์หลัก)</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">{data.scenarios.base}</p>
                </div>

                {/* Bear */}
                <div className="p-3.5 rounded-xl bg-rose-500/5 border border-rose-500/20 space-y-1">
                  <div className="flex items-center gap-1.5 text-rose-400 font-bold text-xs">
                    <TrendingDown className="w-3.5 h-3.5" />
                    <span>Bear Case (ความเสี่ยง)</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">{data.scenarios.bear}</p>
                </div>
              </div>
            </div>

            {/* Action Plan */}
            <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/30 space-y-1.5">
              <div className="flex items-center gap-2 text-indigo-300 font-bold">
                <Target className="w-4 h-4" />
                <span>คำแนะนำเชิงกลยุทธ์สำหรับนักลงทุน (Action Plan)</span>
              </div>
              <p className="leading-relaxed text-indigo-100 font-medium">{data.actionPlan}</p>
            </div>
          </div>
        ) : null}

        {/* Footer */}
        <div className="pt-4 border-t border-white/[0.08] flex items-center justify-between">
          <span className="text-[11px] text-slate-500 font-mono">
            {data?.modelUsed ? `ประมวลผลด้วย ${data.modelUsed}` : 'Investment Intelligence Engine'}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition-colors cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  )
}
