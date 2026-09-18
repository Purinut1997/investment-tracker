'use client'

import { useState, useEffect, Suspense } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, Lock, Mail, TrendingUp, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'

const ERROR_MESSAGES: Record<string, string> = {
  OAuthAccountNotLinked: 'อีเมลนี้ลงทะเบียนด้วยวิธีอื่นไว้แล้ว กรุณาใช้วิธีเดิมในการเข้าสู่ระบบ',
  CredentialsSignin: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง',
  ACCOUNT_SUSPENDED: 'บัญชีถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ',
  default: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ กรุณาลองใหม่อีกครั้ง',
}

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    try {
      const savedEmail = localStorage.getItem('inv_remembered_email')
      if (savedEmail) {
        setEmail(savedEmail)
        setRememberMe(true)
      }
    } catch {}

    const errorParam = params.get('error')
    const verifiedParam = params.get('verified')
    if (errorParam) {
      setError(ERROR_MESSAGES[errorParam] ?? ERROR_MESSAGES.default)
    }
    if (verifiedParam === '1') {
      setSuccess('ยืนยันอีเมลสำเร็จเรียบร้อยแล้ว กรุณาเข้าสู่ระบบ')
    }
  }, [params])

  async function handleCredentialsLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (rememberMe && email.trim()) {
        localStorage.setItem('inv_remembered_email', email.trim())
      } else {
        localStorage.removeItem('inv_remembered_email')
      }
    } catch {}

    const result = await signIn('credentials', {
      email,
      password,
      ipAddress: 'client',
      redirect: false,
    })

    setLoading(false)

    if (!result?.ok) {
      const msg = result?.error ?? 'default'
      if (msg.startsWith('TOO_MANY_ATTEMPTS:')) {
        const until = new Date(msg.split(':')[1])
        setError(
          `ล็อกอินผิดเกินกำหนด กรุณารอถึง ${until.toLocaleTimeString('th-TH')} แล้วลองใหม่อีกครั้ง`
        )
      } else {
        setError(ERROR_MESSAGES[msg] ?? ERROR_MESSAGES.default)
      }
      return
    }

    window.location.href = params.get('callbackUrl') ?? '/dashboard'
  }

  async function handleGoogleLogin() {
    setGoogleLoading(true)
    await signIn('google', {
      callbackUrl: params.get('callbackUrl') ?? '/dashboard',
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-[#090B10] text-slate-200 relative overflow-hidden">
      {/* Subtle Background Glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-[420px] bg-[#12151C] border border-white/[0.08] rounded-2xl p-7 sm:p-9 shadow-2xl shadow-black/80 relative z-10 animate-fade-in">
        {/* Brand Header */}
        <div className="text-center mb-7">
          <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/10 p-2.5 flex items-center justify-center mx-auto mb-4 shadow-xl shadow-black/40">
            <img src="/logo.png" alt="Investment Pro Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            Investment Pro
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            เข้าสู่ระบบเพื่อจัดการพอร์ตการลงทุนของคุณ
          </p>
        </div>

        {/* Feedback Alerts */}
        {success && (
          <div className="mb-5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {error && (
          <div className="mb-5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Google OAuth Button */}
        <button
          id="btn-google-login"
          type="button"
          onClick={handleGoogleLogin}
          disabled={googleLoading || loading}
          className="w-full bg-[#181C25] hover:bg-[#202532] border border-white/[0.1] text-slate-200 hover:text-white rounded-xl px-4 py-2.5 flex items-center justify-center gap-3 text-xs sm:text-sm font-semibold transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none mb-5"
        >
          {googleLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
          )}
          <span>{googleLoading ? 'กำลังเชื่อมต่อ...' : 'เข้าสู่ระบบด้วย Google'}</span>
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-5 text-[11px] font-medium text-slate-500 uppercase tracking-widest">
          <div className="flex-1 h-px bg-white/[0.08]" />
          <span>หรือเข้าด้วยอีเมล</span>
          <div className="flex-1 h-px bg-white/[0.08]" />
        </div>

        {/* Credentials Form */}
        <form onSubmit={handleCredentialsLogin} method="post" className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-xs font-medium text-slate-300">
              อีเมล
            </label>
            <div className="relative flex items-center">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 pointer-events-none" />
              <input
                id="email"
                name="email"
                type="email"
                className="w-full bg-[#181C25] border border-white/[0.1] text-slate-100 text-sm rounded-xl pl-10 pr-3.5 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-slate-500"
                placeholder="investor@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="username email"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label htmlFor="password" className="text-xs font-medium text-slate-300">
                รหัสผ่าน
              </label>
              <Link
                href="/forgot-password"
                className="text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                ลืมรหัสผ่าน?
              </Link>
            </div>
            <div className="relative flex items-center">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 pointer-events-none" />
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                className="w-full bg-[#181C25] border border-white/[0.1] text-slate-100 text-sm rounded-xl pl-10 pr-11 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-slate-500"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 text-slate-500 hover:text-slate-300 transition-colors p-1"
                tabIndex={-1}
                aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Remember Me */}
          <div className="flex items-center pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                name="remember"
                id="remember-me"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500/30 focus:ring-offset-0 cursor-pointer"
              />
              <span className="text-xs text-slate-400">จดจำฉันไว้ในอุปกรณ์นี้</span>
            </label>
          </div>

          <button
            id="btn-email-login"
            type="submit"
            disabled={loading || googleLoading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl px-4 py-2.5 text-sm transition-all duration-150 shadow-lg shadow-indigo-600/25 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 cursor-pointer mt-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            <span>{loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}</span>
          </button>
        </form>

        {/* Register Link */}
        <p className="text-center mt-6 text-xs text-slate-400">
          ยังไม่มีบัญชีใช้งาน?{' '}
          <Link href="/register" className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors">
            สมัครสมาชิก
          </Link>
        </p>

        {/* Creator Credit */}
        <div className="mt-8 pt-4 border-t border-white/[0.06] text-center">
          <p className="text-[11px] text-slate-500 font-mono">
            Created by <span className="text-slate-300 font-semibold">MIKPURINUT</span>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#090B10]"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>}>
      <LoginForm />
    </Suspense>
  )
}
