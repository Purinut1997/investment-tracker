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
    <div className="auth-page">
      <div className="auth-card">
        {/* Logo / Brand */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 64, height: 64,
            borderRadius: '16px',
            overflow: 'hidden',
            backgroundColor: '#ffffff',
            padding: 4,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 14px',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            boxShadow: '0 0 25px rgba(34, 211, 238, 0.3)',
          }}>
            <img
              src="/logo.png"
              alt="Mix The Architect System Logo"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
            Investment Tracker
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            เข้าสู่ระบบเพื่อดูพอร์ตการลงทุนของคุณ
          </p>
        </div>

        {/* Success Message */}
        {success && (
          <div className="alert alert-success" style={{ marginBottom: 16 }}>
            <span>✓</span> {success}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="alert alert-error" style={{ marginBottom: 16 }}>
            <span>✕</span> {error}
          </div>
        )}

        {/* Google Sign In */}
        <button
          id="btn-google-login"
          type="button"
          onClick={handleGoogleLogin}
          disabled={googleLoading || loading}
          className="btn btn-secondary btn-full"
          style={{ marginBottom: 4 }}
        >
          {googleLoading ? (
            <span className="spinner" />
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
          )}
          {googleLoading ? 'กำลังเชื่อมต่อ...' : 'เข้าสู่ระบบด้วย Google'}
        </button>

        <div className="divider">หรือ</div>

        {/* Email + Password Form */}
        <form
          onSubmit={handleCredentialsLogin}
          method="post"
          autoComplete="on"
          style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          <div className="form-group">
            <label htmlFor="email" className="form-label">อีเมล</label>
            <input
              id="email"
              name="email"
              type="email"
              className="input"
              placeholder="example@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username email"
            />
          </div>

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <label htmlFor="password" className="form-label" style={{ marginBottom: 0 }}>รหัสผ่าน</label>
              <Link
                href="/forgot-password"
                style={{ fontSize: 12, color: 'var(--cyan-400)', textDecoration: 'none' }}
              >
                ลืมรหัสผ่าน?
              </Link>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                className="input"
                style={{ paddingRight: 40 }}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                tabIndex={-1}
                aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Remember Me Checkbox */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, marginTop: -2 }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                color: 'var(--text-secondary)',
                userSelect: 'none',
              }}
            >
              <input
                type="checkbox"
                name="remember"
                id="remember-me"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                style={{
                  accentColor: 'var(--cyan-500)',
                  width: 16,
                  height: 16,
                  borderRadius: 4,
                  cursor: 'pointer',
                }}
              />
              จดจำฉันไว้ในอุปกรณ์นี้
            </label>
          </div>

          <button
            id="btn-email-login"
            type="submit"
            disabled={loading || googleLoading}
            className="btn btn-primary btn-full"
            style={{ marginTop: 6 }}
          >
            {loading ? <span className="spinner" /> : null}
            {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </button>
        </form>

        {/* Register Link */}
        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: 'var(--text-secondary)' }}>
          ยังไม่มีบัญชี?{' '}
          <Link href="/register" style={{ color: 'var(--cyan-400)', textDecoration: 'none', fontWeight: 600 }}>
            สมัครสมาชิก
          </Link>
        </p>

        {/* Footer Credit */}
        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 11, color: 'var(--text-muted)' }}>
          Created by MIKPURINUT
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
