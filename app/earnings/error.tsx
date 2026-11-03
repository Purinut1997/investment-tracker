'use client'

import React, { useEffect } from 'react'
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { AppShell } from '@/components/AppShell'

export default function EarningsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Earnings Error Boundary]', error)
  }, [error])

  return (
    <AppShell>
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full p-8 rounded-3xl bg-[#12151C] border border-white/[0.08] text-center space-y-4 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-white">เกิดข้อผิดพลาดในการโหลดข้อมูลปฏิทินงบ</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            {error.message || 'ระบบไม่สามารถประมวลผลข้อมูลผลประกอบการได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง'}
          </p>
          <div className="pt-3 flex items-center justify-center gap-3">
            <button
              onClick={() => reset()}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-2 cursor-pointer transition-all shadow-md active:scale-98"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>ลองใหม่อีกครั้ง</span>
            </button>
            <Link
              href="/market-watch"
              className="px-4 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 font-semibold text-xs flex items-center gap-1.5 transition-all"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>กลับสู่หน้าตลาด</span>
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
