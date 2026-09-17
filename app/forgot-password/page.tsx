'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Mail, TrendingUp, AlertCircle, CheckCircle2, Loader2, ArrowLeft, KeyRound } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (res.ok) {
        setSent(true)
      } else {
        setError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
      }
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-[#090B10] text-slate-200 relative overflow-hidden">
        <div className="w-full max-w-[420px] bg-[#12151C] border border-white/[0.08] rounded-2xl p-8 sm:p-10 shadow-2xl shadow-black/80 text-center animate-fade-in relative z-10">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center mx-auto mb-5 text-indigo-400">
            <KeyRound className="w-8 h-8" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">
            ตรวจสอบอีเมลของคุณ
          </h2>
          <p className="text-sm text-slate-400 leading-relaxed mb-6">
            หากอีเมลนี้ลงทะเบียนไว้ในระบบ เราได้จัดส่งลิงก์สำหรับรีเซ็ตรหัสผ่านให้แล้ว กรุณาตรวจสอบอีเมลภายในไม่กี่นาที
          </p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 w-full bg-[#181C25] hover:bg-[#202532] border border-white/[0.1] text-slate-200 hover:text-white font-semibold rounded-xl px-4 py-2.5 text-sm transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>กลับสู่หน้าเข้าสู่ระบบ</span>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-[#090B10] text-slate-200 relative overflow-hidden">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-[420px] bg-[#12151C] border border-white/[0.08] rounded-2xl p-7 sm:p-9 shadow-2xl shadow-black/80 relative z-10 animate-fade-in">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center mx-auto mb-4 text-indigo-400">
            <TrendingUp className="w-6 h-6" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            ลืมรหัสผ่าน
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            กรอกอีเมลของคุณเพื่อรับลิงก์สำหรับตั้งรหัสผ่านใหม่
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="forgot-email" className="text-xs font-medium text-slate-300">
              อีเมล
            </label>
            <div className="relative flex items-center">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 pointer-events-none" />
              <input
                id="forgot-email"
                type="email"
                className="w-full bg-[#181C25] border border-white/[0.1] text-slate-100 text-sm rounded-xl pl-10 pr-3.5 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-slate-500"
                placeholder="investor@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
          </div>

          <button
            id="btn-forgot-submit"
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl px-4 py-2.5 text-sm transition-all duration-150 shadow-lg shadow-indigo-600/25 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 cursor-pointer mt-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            <span>{loading ? 'กำลังส่งข้อมูล...' : 'ส่งลิงก์รีเซ็ตรหัสผ่าน'}</span>
          </button>
        </form>

        <p className="text-center mt-6 text-xs text-slate-400">
          <Link href="/login" className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors inline-flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>กลับสู่หน้าเข้าสู่ระบบ</span>
          </Link>
        </p>
      </div>
    </div>
  )
}
