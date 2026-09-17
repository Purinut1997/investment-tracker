'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  function update(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  function validatePassword(pw: string): string | null {
    if (pw.length < 8) return 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร'
    if (!/[a-zA-Z]/.test(pw)) return 'ต้องมีตัวอักษรภาษาอังกฤษ'
    if (!/[0-9]/.test(pw)) return 'ต้องมีตัวเลข'
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const pwError = validatePassword(form.password)
    if (pwError) { setError(pwError); return }
    if (form.password !== form.confirm) { setError('รหัสผ่านไม่ตรงกัน'); return }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, email: form.email, password: form.password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'เกิดข้อผิดพลาด')
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
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📧</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>ตรวจสอบอีเมลของคุณ</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.7 }}>
            เราส่งลิงก์ยืนยันอีเมลไปที่ <strong style={{ color: 'var(--text-primary)' }}>{form.email}</strong> แล้ว
            <br />กรุณากดลิงก์ในอีเมลเพื่อเริ่มใช้งาน
          </p>
          <Link href="/login" className="btn btn-primary" style={{ marginTop: 24, display: 'inline-flex' }}>
            ไปหน้าเข้าสู่ระบบ
          </Link>
          <p style={{ marginTop: 16, fontSize: 12, color: 'var(--text-muted)' }}>
            ไม่พบอีเมล? ตรวจสอบโฟลเดอร์ Spam
          </p>
          <p style={{ marginTop: 20, fontSize: 11, color: 'var(--text-muted)' }}>
            Created by MIKPURINUT
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 52, height: 52,
            background: 'linear-gradient(135deg, #06b6d4, #818cf8)',
            borderRadius: '14px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 12px',
            fontSize: 24,
            boxShadow: '0 0 24px rgba(34, 211, 238, 0.3)',
          }}>
            📈
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>สมัครสมาชิก</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            Investment Tracker — บันทึกการลงทุนส่วนตัว
          </p>
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: 16 }}>
            <span>✕</span> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label htmlFor="name" className="form-label">ชื่อ-นามสกุล</label>
            <input
              id="name" type="text" className="input"
              placeholder="ชื่อของคุณ"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              required autoComplete="name"
            />
          </div>

          <div className="form-group">
            <label htmlFor="reg-email" className="form-label">อีเมล</label>
            <input
              id="reg-email" type="email" className="input"
              placeholder="example@email.com"
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
              required autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="reg-password" className="form-label">รหัสผ่าน</label>
            <input
              id="reg-password" type="password" className="input"
              placeholder="อย่างน้อย 8 ตัว (ตัวอักษร + ตัวเลข)"
              value={form.password}
              onChange={(e) => update('password', e.target.value)}
              required autoComplete="new-password"
            />
            <span className="form-hint">ต้องมีตัวอักษรและตัวเลขอย่างน้อย 1 ตัว</span>
          </div>

          <div className="form-group">
            <label htmlFor="reg-confirm" className="form-label">ยืนยันรหัสผ่าน</label>
            <input
              id="reg-confirm" type="password" className="input"
              placeholder="พิมพ์รหัสผ่านอีกครั้ง"
              value={form.confirm}
              onChange={(e) => update('confirm', e.target.value)}
              required autoComplete="new-password"
            />
          </div>

          <button
            id="btn-register"
            type="submit"
            disabled={loading}
            className="btn btn-primary btn-full"
            style={{ marginTop: 4 }}
          >
            {loading ? <span className="spinner" /> : null}
            {loading ? 'กำลังสมัคร...' : 'สมัครสมาชิก'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: 'var(--text-secondary)' }}>
          มีบัญชีอยู่แล้ว?{' '}
          <Link href="/login" style={{ color: 'var(--cyan-400)', textDecoration: 'none', fontWeight: 600 }}>
            เข้าสู่ระบบ
          </Link>
        </p>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: 'var(--text-muted)' }}>
          Created by MIKPURINUT
        </p>
      </div>
    </div>
  )
}
