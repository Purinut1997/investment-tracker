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
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>ลืมรหัสผ่าน</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            กรอกอีเมลที่ใช้สมัคร เราจะส่งลิงก์รีเซ็ตให้คุณ
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
