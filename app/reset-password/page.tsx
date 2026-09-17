'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

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
    if (!/[a-zA-Z]/.test(pw)) return 'ต้องมีตัวอักษรภาษาอังกฤษ'
    if (!/[0-9]/.test(pw)) return 'ต้องมีตัวเลข'
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!token) { setError('Token ไม่ถูกต้อง กรุณาขอลิงก์ใหม่'); return }

    const pwError = validatePassword(form.password)
    if (pwError) { setError(pwError); return }
    if (form.password !== form.confirm) { setError('รหัสผ่านไม่ตรงกัน'); return }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: form.password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'เกิดข้อผิดพลาด')
      } else {
        setSuccess(true)
        setTimeout(() => router.push('/login'), 3000)
      }
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>ลิงก์ไม่ถูกต้อง</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            กรุณาขอลิงก์รีเซ็ตรหัสผ่านใหม่
          </p>
          <Link href="/forgot-password" className="btn btn-primary" style={{ marginTop: 24, display: 'inline-flex' }}>
            ขอลิงก์ใหม่
          </Link>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>รีเซ็ตรหัสผ่านสำเร็จ</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            กำลังพาคุณไปหน้าเข้าสู่ระบบ...
          </p>
          <Link href="/login" className="btn btn-primary" style={{ marginTop: 24, display: 'inline-flex' }}>
            เข้าสู่ระบบ
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
            boxShadow: '0 0 25px rgba(34, 211, 238, 0.3)',
          }}>
            <img
              src="/logo.png?v=2"
              alt="Mix The Architect System Logo"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>ตั้งรหัสผ่านใหม่</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            รหัสผ่านใหม่จะใช้แทนรหัสผ่านเดิมและจะออกจากระบบทุกอุปกรณ์
          </p>
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: 16 }}>
            <span>✕</span> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label htmlFor="new-password" className="form-label">รหัสผ่านใหม่</label>
            <input
              id="new-password" type="password" className="input"
              placeholder="อย่างน้อย 8 ตัว (ตัวอักษร + ตัวเลข)"
              value={form.password}
              onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
              required autoComplete="new-password"
            />
          </div>
          <div className="form-group">
            <label htmlFor="confirm-password" className="form-label">ยืนยันรหัสผ่านใหม่</label>
            <input
              id="confirm-password" type="password" className="input"
              placeholder="พิมพ์รหัสผ่านอีกครั้ง"
              value={form.confirm}
              onChange={(e) => setForm(f => ({ ...f, confirm: e.target.value }))}
              required autoComplete="new-password"
            />
          </div>
          <button id="btn-reset-submit" type="submit" disabled={loading} className="btn btn-primary btn-full">
            {loading ? <span className="spinner" /> : null}
            {loading ? 'กำลังบันทึก...' : 'บันทึกรหัสผ่านใหม่'}
          </button>
        </form>
        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: 'var(--text-muted)' }}>
          Created by MIKPURINUT
        </p>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="auth-page"><div className="spinner" /></div>}>
      <ResetPasswordForm />
    </Suspense>
  )
}
