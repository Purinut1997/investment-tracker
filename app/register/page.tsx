'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Lock, Mail, User, TrendingUp, AlertCircle, CheckCircle2, Loader2, ArrowRight } from 'lucide-react'

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  function update(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  function validatePassword(pw: string): string | null {
    if (pw.length < 8) return 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร'
    if (!/[a-zA-Z]/.test(pw)) return 'รหัสผ่านต้องมีตัวอักษรภาษาอังกฤษ'
    if (!/[0-9]/.test(pw)) return 'รหัสผ่านต้องมีตัวเลขอย่างน้อย 1 ตัว'
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const pwError = validatePassword(form.password)
    if (pwError) { setError(pwError); return }
    if (form.password !== form.confirm) { setError('รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน'); return }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, email: form.email, password: form.password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'เกิดข้อผิดพลาดในการสมัครสมาชิก')
      } else {
        setSuccess(true)
      }
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-[#090B10] text-slate-200 relative overflow-hidden">
        <div className="w-full max-w-[440px] bg-[#12151C] border border-white/[0.08] rounded-2xl p-8 sm:p-10 shadow-2xl shadow-black/80 text-center animate-fade-in relative z-10">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto mb-5 text-emerald-400">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">
            ตรวจสอบอีเมลของคุณ
          </h2>
          <p className="text-sm text-slate-400 leading-relaxed mb-6">
            เราได้ส่งลิงก์ยืนยันการลงทะเบียนไปที่ <strong className="text-white font-mono">{form.email}</strong> แล้ว กรุณาตรวจสอบกล่องจดหมายเพื่อเปิดใช้งานบัญชี
          </p>
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400 mb-6">
            ไม่พบอีเมล? ลองตรวจสอบในโฟลเดอร์ <span className="text-slate-300 font-semibold">Spam / Junk</span>
          </div>
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl px-4 py-2.5 text-sm transition-all shadow-lg shadow-indigo-600/25"
          >
            <span>ไปหน้าเข้าสู่ระบบ</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-[#090B10] text-slate-200 relative overflow-hidden">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-[440px] bg-[#12151C] border border-white/[0.08] rounded-2xl p-7 sm:p-9 shadow-2xl shadow-black/80 relative z-10 animate-fade-in">
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/10 p-2.5 flex items-center justify-center mx-auto mb-4 shadow-xl shadow-black/40">
            <img src="/logo.png" alt="Investment Pro Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            สร้างบัญชีผู้ใช้ใหม่
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            เริ่มต้นติดตามและบริหารความมั่งคั่งด้วย Investment Pro
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} method="post" className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="name" className="text-xs font-medium text-slate-300">
              ชื่อ-นามสกุล
            </label>
            <div className="relative flex items-center">
              <User className="w-4 h-4 text-slate-500 absolute left-3.5 pointer-events-none" />
              <input
                id="name"
                name="name"
                type="text"
                className="w-full bg-[#181C25] border border-white/[0.1] text-slate-100 text-sm rounded-xl pl-10 pr-3.5 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-slate-500"
                placeholder="สมชาย มั่งคั่ง"
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                required
                autoComplete="name"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="reg-email" className="text-xs font-medium text-slate-300">
              อีเมล
            </label>
            <div className="relative flex items-center">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 pointer-events-none" />
              <input
                id="reg-email"
                name="email"
                type="email"
                className="w-full bg-[#181C25] border border-white/[0.1] text-slate-100 text-sm rounded-xl pl-10 pr-3.5 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-slate-500"
                placeholder="investor@example.com"
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
                required
                autoComplete="username email"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="reg-password" className="text-xs font-medium text-slate-300">
              รหัสผ่าน (อย่างน้อย 8 ตัวอักษร มีตัวอักษรและตัวเลข)
            </label>
            <div className="relative flex items-center">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 pointer-events-none" />
              <input
                id="reg-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                className="w-full bg-[#181C25] border border-white/[0.1] text-slate-100 text-sm rounded-xl pl-10 pr-11 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-slate-500"
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => update('password', e.target.value)}
                required
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 text-slate-500 hover:text-slate-300 transition-colors p-1"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="reg-confirm" className="text-xs font-medium text-slate-300">
              ยืนยันรหัสผ่านอีกครั้ง
            </label>
            <div className="relative flex items-center">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 pointer-events-none" />
              <input
                id="reg-confirm"
                name="confirm"
                type={showConfirm ? 'text' : 'password'}
                className="w-full bg-[#181C25] border border-white/[0.1] text-slate-100 text-sm rounded-xl pl-10 pr-11 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-slate-500"
                placeholder="••••••••"
                value={form.confirm}
                onChange={(e) => update('confirm', e.target.value)}
                required
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 text-slate-500 hover:text-slate-300 transition-colors p-1"
                tabIndex={-1}
              >
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            id="btn-register-submit"
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl px-4 py-2.5 text-sm transition-all duration-150 shadow-lg shadow-indigo-600/25 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 cursor-pointer mt-4"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            <span>{loading ? 'กำลังสร้างบัญชี...' : 'สมัครสมาชิก'}</span>
          </button>
        </form>

        <p className="text-center mt-6 text-xs text-slate-400">
          มีบัญชีอยู่แล้ว?{' '}
          <Link href="/login" className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors">
            เข้าสู่ระบบ
          </Link>
        </p>
      </div>
    </div>
  )
}
