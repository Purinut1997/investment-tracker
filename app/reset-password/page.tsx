'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Lock, TrendingUp, AlertCircle, CheckCircle2, Loader2, ArrowRight, AlertTriangle } from 'lucide-react'

function ResetPasswordForm() {
  const router = useRouter()
  const params = useSearchParams()
  const token = params.get('token') ?? ''

  const [form, setForm] = useState({ password: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  function validatePassword(pw: string): string | null {
    if (pw.length < 8) return 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร'
    if (!/[a-zA-Z]/.test(pw)) return 'รหัสผ่านต้องมีตัวอักษรภาษาอังกฤษ'
    if (!/[0-9]/.test(pw)) return 'รหัสผ่านต้องมีตัวเลขอย่างน้อย 1 ตัว'
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!token) { setError('Token สำหรับรีเซ็ตรหัสผ่านไม่ถูกต้อง กรุณาขอลิงก์ใหม่'); return }

    const pwError = validatePassword(form.password)
    if (pwError) { setError(pwError); return }
    if (form.password !== form.confirm) { setError('รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน'); return }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: form.password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'เกิดข้อผิดพลาดในการรีเซ็ตรหัสผ่าน')
      } else {
        setSuccess(true)
        setTimeout(() => router.push('/login'), 2500)
      }
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-[#090B10] text-slate-200 relative overflow-hidden">
        <div className="w-full max-w-[420px] bg-[#12151C] border border-white/[0.08] rounded-2xl p-8 sm:p-10 shadow-2xl shadow-black/80 text-center animate-fade-in relative z-10">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mx-auto mb-5 text-amber-400">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">
            ลิงก์ไม่ถูกต้องหรือหมดอายุ
          </h2>
          <p className="text-sm text-slate-400 leading-relaxed mb-6">
            ลิงก์สำหรับรีเซ็ตรหัสผ่านนี้หมดอายุหรือไม่ถูกต้อง กรุณาส่งคำขอใหม่อีกครั้ง
          </p>
          <Link
            href="/forgot-password"
            className="inline-flex items-center justify-center gap-2 w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl px-4 py-2.5 text-sm transition-all shadow-lg shadow-indigo-600/25"
          >
            <span>ขอลิงก์รีเซ็ตใหม่</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-[#090B10] text-slate-200 relative overflow-hidden">
        <div className="w-full max-w-[420px] bg-[#12151C] border border-white/[0.08] rounded-2xl p-8 sm:p-10 shadow-2xl shadow-black/80 text-center animate-fade-in relative z-10">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto mb-5 text-emerald-400">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">
            รีเซ็ตรหัสผ่านสำเร็จ
          </h2>
          <p className="text-sm text-slate-400 leading-relaxed mb-6">
            รหัสผ่านใหม่ของคุณได้รับการอัปเดตเรียบร้อยแล้ว กำลังพาคุณไปยังหน้าเข้าสู่ระบบ...
          </p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl px-4 py-2.5 text-sm transition-all shadow-lg shadow-indigo-600/25"
          >
            <span>เข้าสู่ระบบทันที</span>
            <ArrowRight className="w-4 h-4" />
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
          <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/10 p-2.5 flex items-center justify-center mx-auto mb-4 shadow-xl shadow-black/40">
            <img src="/logo.png" alt="Investment Pro Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            ตั้งรหัสผ่านใหม่
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            กรุณาตั้งรหัสผ่านใหม่ที่ปลอดภัยสำหรับบัญชีของคุณ
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
            <label htmlFor="new-password" className="text-xs font-medium text-slate-300">
              รหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร)
            </label>
            <div className="relative flex items-center">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 pointer-events-none" />
              <input
                id="new-password"
                type="password"
                className="w-full bg-[#181C25] border border-white/[0.1] text-slate-100 text-sm rounded-xl pl-10 pr-3.5 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-slate-500"
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                required
                autoComplete="new-password"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="confirm-password" className="text-xs font-medium text-slate-300">
              ยืนยันรหัสผ่านใหม่อีกครั้ง
            </label>
            <div className="relative flex items-center">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 pointer-events-none" />
              <input
                id="confirm-password"
                type="password"
                className="w-full bg-[#181C25] border border-white/[0.1] text-slate-100 text-sm rounded-xl pl-10 pr-3.5 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-slate-500"
                placeholder="••••••••"
                value={form.confirm}
                onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))}
                required
                autoComplete="new-password"
              />
            </div>
          </div>

          <button
            id="btn-reset-submit"
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl px-4 py-2.5 text-sm transition-all duration-150 shadow-lg shadow-indigo-600/25 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 cursor-pointer mt-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            <span>{loading ? 'กำลังบันทึก...' : 'บันทึกรหัสผ่านใหม่'}</span>
          </button>
        </form>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#090B10]"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>}>
      <ResetPasswordForm />
    </Suspense>
  )
}
