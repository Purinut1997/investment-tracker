'use client'

import Link from 'next/link'
import useSWR from 'swr'
import { dailyPriority } from '@/lib/ai/daily-priority'
import { buildCopilotDeepLink } from '@/lib/ai/quick-questions'

type Brief = { text: string; createdAt: string; isToday: boolean }

async function fetchBrief(url: string): Promise<{ brief: Brief | null }> {
  const response = await fetch(url)
  if (!response.ok) throw new Error('โหลดสรุปไม่สำเร็จ')
  return response.json()
}

export function MorningBriefBanner() {
  const { data, error, isLoading, mutate } = useSWR('/api/daily-plan/latest-brief', fetchBrief, {
    dedupingInterval: 30000,
  })
  const brief = data?.brief
  const today = brief?.isToday && new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date(brief.createdAt)) === new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date())
  const { action, context } = dailyPriority(today && brief ? brief.text : '')
  const question = action && 'จากสรุปวันนี้ «' + action.slice(0, 450) + '» ช่วยตรวจว่าข้อมูลพอร์ตล่าสุดยังสนับสนุนเรื่องนี้ไหม และควรทำอะไรต่อหรือรอเงื่อนไขใด'
  return <section aria-labelledby="daily-priority" className="space-y-2 rounded-2xl border border-amber-400/25 bg-[#151923] p-4">
    <h2 id="daily-priority" className="font-semibold text-amber-200">วันนี้ต้องทำอะไร</h2>
    <p aria-live="polite" className="text-sm leading-relaxed text-white">{error ? 'โหลดสรุปวันนี้ไม่สำเร็จ' : isLoading ? 'กำลังอ่านสรุปวันนี้…' : action || (today ? 'เปิดแผนประจำวันเพื่อทบทวนสรุปและเช็กลิสต์' : 'ยังไม่มีสรุปของวันนี้ เปิดแผนประจำวันเพื่อสร้างสรุปจากข้อมูลล่าสุด')}</p>
    {context && !error && <p className="text-xs leading-relaxed text-slate-300">ภาพรวมที่ใช้ประกอบ · {context}</p>}
    <div className="flex flex-wrap gap-2 text-sm">
      <Link href="/daily-plan" className="inline-flex min-h-11 items-center rounded-lg bg-amber-300 px-3 font-semibold text-slate-950">เปิดแผนประจำวัน</Link>
      {question && !error && <Link href={buildCopilotDeepLink(question)} className="inline-flex min-h-11 items-center px-3 text-indigo-200">ถามต่อเรื่องนี้</Link>}
      {error && <button type="button" onClick={() => void mutate()} className="min-h-11 px-3">ลองโหลดอีกครั้ง</button>}
    </div>
  </section>
}
