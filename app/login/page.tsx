'use client'

import { useState, useEffect, Suspense } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff } from 'lucide-react'

const ERROR_MESSAGES: Record<string, string> = {
  OAuthAccountNotLinked: 'อีเมลนี้ลงทะเบียนด้วยวิธีอื่นไว้แล้ว กรุณาใช้วิธีเดิม',
  CredentialsSignin: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
  ACCOUNT_SUSPENDED: 'บัญชีถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแล',
  default: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง',
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
    // Load remembered email from localStorage
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
      setSuccess('ยืนยันอีเมลสำเร็จ! กรุณาเข้าสู่ระบบ')
    }
  }, [params])

  async function handleCredentialsLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    // Remember or forget email
    try {
      if (rememberMe && email.trim()) {
        localStorage.setItem('inv_remembered_email', email.trim())
      } else {
        localStorage.removeItem('inv_remembered_email')
      }
    } catch {}

    // Get client IP for rate limiting (sent as credential)
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
          `ล็อกอินผิดเกินกำหนด กรุณารอถึง ${until.toLocaleTimeString('th-TH')} แล้วลองใหม่`
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
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden py-12 px-4 sm:px-6 lg:px-8">
      {/* Background Orbs */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none"></div>
      
      <div className="bg-slate-900/60 backdrop-blur-2xl border border-slate-800/80 rounded-3xl p-8 sm:p-10 w-full max-w-[440px] shadow-2xl relative z-10 animate-fade-in">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-slate-950 border border-slate-800/80 p-2 flex items-center justify-center mx-auto mb-5 shadow-[0_0_20px_rgba(168,85,247,0.15)]">
            <img
              src="https://raw.githubusercontent.com/Purinut1997/web-images/main/LOGO%20SYSTEM.png"
              alt="Investment PRO Logo"
              className="w-full h-full object-contain"
            />
          </div>
          <h2 className="text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-cyan-400 mb-2">
            Investment PRO
          </h2>
          <p className="text-slate-400 text-sm">
            เข้าสู่ระบบเพื่อดูพอร์ตการลงทุนของคุณ
          </p>
        </div>

        {/* Success Message */}
        {success && (
          <div className="mb-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3 rounded-xl text-sm flex items-center gap-2">
            <span className="font-bold">✓</span> {success}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3 rounded-xl text-sm flex items-center gap-2">
            <span className="font-bold">✕</span> {error}
          </div>
        )}

        {/* Google Sign In */}
        <button
          id="btn-google-login"
          type="button"
          onClick={handleGoogleLogin}
          disabled={googleLoading || loading}
          className="w-full bg-slate-800/50 hover:bg-slate-800 border border-slate-700 text-slate-200 rounded-xl px-4 py-3 flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none mb-6 shadow-sm"
        >
          {googleLoading ? (
            <span className="spinner w-5 h-5 border-2 border-slate-600 border-t-slate-200 rounded-full animate-spin"></span>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
          )}
          <span className="font-medium">{googleLoading ? 'กำลังเชื่อมต่อ...' : 'เข้าสู่ระบบด้วย Google'}</span>
        </button>

        <div className="flex items-center gap-3 mb-6 text-xs font-medium text-slate-500 uppercase tracking-widest">
          <div className="flex-1 h-px bg-slate-800"></div>
          หรือ
          <div className="flex-1 h-px bg-slate-800"></div>
        </div>

        {/* Email + Password Form */}
        <form
          onSubmit={handleCredentialsLogin}
          method="post"
          autoComplete="on"
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-xs font-medium text-slate-400 px-1">อีเมล</label>
            <input
              id="email"
              name="email"
              type="email"
              className="bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
              placeholder="example@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username email"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center px-1">
              <label htmlFor="password" className="text-xs font-medium text-slate-400">รหัสผ่าน</label>
              <Link
                href="/forgot-password"
                className="text-xs font-medium text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                ลืมรหัสผ่าน?
              </Link>
            </div>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all pr-12"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors p-1"
                tabIndex={-1}
                aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Remember Me Checkbox */}
          <div className="flex items-center mt-1 px-1">
            <label className="flex items-center gap-2 cursor-pointer group">
              <div className="relative flex items-center justify-center">
                <input
                  type="checkbox"
                  name="remember"
                  id="remember-me"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="peer appearance-none w-4 h-4 rounded border border-slate-600 bg-slate-950/50 checked:bg-cyan-500 checked:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 transition-all cursor-pointer"
                />
                <svg className="absolute w-3 h-3 text-slate-900 opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M2.5 7.5L5.5 10.5L11.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <span className="text-xs font-medium text-slate-400 group-hover:text-slate-300 transition-colors">
                จดจำฉันไว้ในอุปกรณ์นี้
              </span>
            </label>
          </div>

          <button
            id="btn-email-login"
            type="submit"
            disabled={loading || googleLoading}
            className="w-full bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 text-white font-semibold rounded-xl px-4 py-3 mt-4 transition-all shadow-[0_0_15px_rgba(168,85,247,0.4)] active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
          >
            {loading ? <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></span> : null}
            <span>{loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}</span>
          </button>
        </form>

        {/* Register Link */}
        <p className="text-center mt-6 text-sm text-slate-400">
          ยังไม่มีบัญชี?{' '}
          <Link href="/register" className="text-cyan-400 hover:text-cyan-300 font-semibold transition-colors">
            สมัครสมาชิก
          </Link>
        </p>

        {/* Footer Credit */}
        <p className="text-center mt-8 text-[10px] font-medium text-slate-600 tracking-wider">
          CREATED BY MIKPURINUT
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="auth-page"><div className="spinner" /></div>}>
      <LoginForm />
    </Suspense>
  )
}
