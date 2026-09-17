'use client'

import { useState } from 'react'
import Link from 'next/link'

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
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔐</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>ตรวจสอบอีเมลของคุณ</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.7 }}>
            ถ้าอีเมลนี้มีบัญชีในระบบ เราจะส่งลิงก์รีเซ็ตรหัสผ่านให้ภายในไม่กี่นาที
          </p>
          <Link href="/login" className="btn btn-secondary" style={{ marginTop: 24, display: 'inline-flex' }}>
            ← กลับหน้าเข้าสู่ระบบ
          </Link>
          <p style={{ marginTop: 20, fontSize: 11, color: 'var(--text-muted)' }}>Created by MIKPURINUT</p>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div style={{ marginBottom: 24, textAlign: 'center' }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: '#ffffff',
            padding: 4,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 14px',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            
          }}>
            <img
              src="/logo.png?v=2"
              alt="Investment Pro Logo"
              className="w-full h-full object-contain brightness-0 invert drop-shadow-md"
            />
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-white mb-2">ลืมรหัสผ่าน</h2>
          <p className="text-[var(--text-muted)] text-sm">
            กรอกอีเมลของคุณเพื่อรับลิงก์สำหรับรีเซ็ตรหัสผ่าน
          </p>
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: 16 }}>
            <span>✕</span> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label htmlFor="forgot-email" className="form-label">อีเมล</label>
            <input
              id="forgot-email" type="email" className="input"
              placeholder="example@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required autoComplete="email"
            />
          </div>
          <button id="btn-forgot-submit" type="submit" disabled={loading} className="btn btn-primary btn-full">
            {loading ? <span className="spinner" /> : null}
            {loading ? 'กำลังส่ง...' : 'ส่งลิงก์รีเซ็ต'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: 'var(--text-secondary)' }}>
          <Link href="/login" style={{ color: 'var(--cyan-400)', textDecoration: 'none' }}>
            ← กลับหน้าเข้าสู่ระบบ
          </Link>
        </p>
        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: 'var(--text-muted)' }}>
          Created by MIKPURINUT
        </p>
      </div>
    </div>
  )
}
