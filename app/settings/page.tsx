'use client'

import React, { useState, useEffect } from 'react'
import useSWR, { mutate } from 'swr'
import { signOut } from 'next-auth/react'
import { AppShell } from '@/components/AppShell'
import {
  Settings,
  Sparkles,
  Key,
  Shield,
  Coins,
  Bell,
  LogOut,
  CheckCircle,
  AlertCircle,
  Loader2,
  Check,
  Cpu,
  Info,
  ExternalLink
} from 'lucide-react'

export default function SettingsPage() {
  const { data, isLoading } = useSWR('/api/settings')
  const settings = data?.settings
  const aiModels: any[] = data?.aiModels ?? []

  const [apiKey, setApiKey] = useState('')
  const [baseCurrency, setBaseCurrency] = useState('THB')
  const [aiModelMode, setAiModelMode] = useState<'auto' | 'manual'>('auto')
  const [selectedAiModelId, setSelectedAiModelId] = useState<string>('')
  const [alertThreshold, setAlertThreshold] = useState(5)
  const [weeklyDigest, setWeeklyDigest] = useState(true)

  const [saving, setSaving] = useState(false)
  const [testingKey, setTestingKey] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [invalidating, setInvalidating] = useState(false)

  // Populate from API
  useEffect(() => {
    if (settings) {
      setBaseCurrency(settings.baseCurrency ?? 'THB')
      setAiModelMode(settings.aiModelMode ?? 'auto')
      setSelectedAiModelId(settings.selectedAiModelId ?? (aiModels[0]?.id || ''))
      setAlertThreshold(settings.allocationAlertThresholdPercent ?? 5)
      setWeeklyDigest(settings.weeklyDigestEnabled ?? true)
    }
  }, [settings, aiModels])

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMsg(null)

    try {
      const payload: any = {
        baseCurrency,
        aiModelMode,
        selectedAiModelId: aiModelMode === 'manual' ? selectedAiModelId : null,
        allocationAlertThresholdPercent: alertThreshold,
        weeklyDigestEnabled: weeklyDigest,
      }

      if (apiKey.trim()) {
        payload.geminiApiKey = apiKey.trim()
      }

      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const resJson = await res.json()
      if (!res.ok) throw new Error(resJson.error || 'บันทึกการตั้งค่าไม่สำเร็จ')

      setMsg({ type: 'success', text: 'บันทึกการตั้งค่าเรียบร้อยแล้ว' })
      setApiKey('') // Clear raw input
      mutate('/api/settings')
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'เกิดข้อผิดพลาด' })
    } finally {
      setSaving(false)
    }
  }

  async function handleInvalidateAllSessions() {
    if (!confirm('คุณต้องการออกจากระบบทุกอุปกรณ์จริงหรือไม่? (คุณจะต้องเข้าสู่ระบบใหม่)')) return
    setInvalidating(true)
    try {
      await fetch('/api/auth/invalidate-sessions', { method: 'POST' })
      signOut({ callbackUrl: '/login' })
    } catch (err) {
      alert('ออกจากระบบไม่สำเร็จ')
      setInvalidating(false)
    }
  }

  return (
    <AppShell>
      <div className="space-y-6 max-w-4xl">
        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Settings className="w-7 h-7 text-[var(--cyan-400)]" />
            <span>ตั้งค่าระบบ (Settings)</span>
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
            ปรับแต่งโมเดล AI (Gemini), สกุลเงินหลัก, การแจ้งเตือน และการรักษาความปลอดภัย
          </p>
        </div>

        {/* Feedback Alert */}
        {msg && (
          <div
            className={`alert ${
              msg.type === 'success' ? 'alert-success' : 'alert-danger'
            } flex items-center gap-2 text-xs`}
          >
            {msg.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-[var(--green-400)] shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            )}
            <span>{msg.text}</span>
          </div>
        )}

        <form onSubmit={handleSaveSettings} className="space-y-6">
          {/* ─── SECTION 1: GEMINI AI CONFIGURATION ──────────────────── */}
          <div className="card p-5 sm:p-6 space-y-5 border-cyan-500/25">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-[var(--cyan-400)]">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">การตั้งค่า AI (Gemini Developer API)</h2>
                  <p className="text-xs text-[var(--text-muted)]">
                    เชื่อมต่อ Google Gemini เพื่อใช้ฟังก์ชัน AI Advisor, Weekly Digest, และ Quick Add
                  </p>
                </div>
              </div>

              {settings?.hasApiKey ? (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-500/10 text-[var(--green-400)] border border-green-500/20 flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5" />
                  <span>เชื่อมต่อคีย์แล้ว</span>
                </span>
              ) : (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  ยังไม่ได้ใส่ API Key
                </span>
              )}
            </div>

            {/* API Key Input */}
            <div className="space-y-2">
              <label className="label">
                Gemini API Key (เข้ารหัสด้วย AES-256-GCM ในฐานข้อมูล)
              </label>
              <div className="relative">
                <Key className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  className="input pl-9 text-xs sm:text-sm font-mono"
                  placeholder={settings?.hasApiKey ? '•••••••••••••••••••••••••••• (ใส่ใหม่เพื่อเปลี่ยน)' : 'AIzaSy...'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
              </div>
              <p className="text-[11px] text-[var(--text-muted)]">
                รับ API Key ฟรีได้จาก{' '}
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--cyan-400)] hover:underline inline-flex items-center gap-0.5"
                >
                  Google AI Studio <ExternalLink className="w-3 h-3" />
                </a>{' '}
                (รุ่น Flash ฟรี ไม่เสียค่าใช้จ่าย)
              </p>
            </div>

            {/* AI Model Mode: Auto vs Manual */}
            <div className="space-y-3 pt-3 border-t border-[var(--border)]">
              <label className="label">โหมดการเลือกโมเดล AI (Model Selection Mode)</label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div
                  onClick={() => setAiModelMode('auto')}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    aiModelMode === 'auto'
                      ? 'bg-cyan-500/10 border-cyan-500/40 text-white'
                      : 'bg-[var(--bg-elevated)]/40 border-[var(--border)] text-[var(--text-secondary)] hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-sm text-white">⚡ โหมดอัตโนมัติ (Auto Mode) — แนะนำ</span>
                    {aiModelMode === 'auto' && <Check className="w-4 h-4 text-[var(--cyan-400)]" />}
                  </div>
                  <p className="text-xs text-[var(--text-secondary)]">
                    ระบบจะเลือกโมเดลฟรีที่เร็วและดีที่สุดให้เอง หากโควตาเต็มจะสลับไปยังโมเดลสำรองอัตโนมัติ (Fallback Chain)
                  </p>
                </div>

                <div
                  onClick={() => setAiModelMode('manual')}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    aiModelMode === 'manual'
                      ? 'bg-cyan-500/10 border-cyan-500/40 text-white'
                      : 'bg-[var(--bg-elevated)]/40 border-[var(--border)] text-[var(--text-secondary)] hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-sm text-white">🛠️ โหมดเลือกเอง (Manual Mode)</span>
                    {aiModelMode === 'manual' && <Check className="w-4 h-4 text-[var(--cyan-400)]" />}
                  </div>
                  <p className="text-xs text-[var(--text-secondary)]">
                    ระบุโมเดลเฉพาะเจาะจงที่ต้องการใช้งานจากรายการโมเดลที่เปิดใช้งานในระบบ
                  </p>
                </div>
              </div>

              {/* Manual Model Dropdown */}
              {aiModelMode === 'manual' && (
                <div className="pt-2 animate-in fade-in">
                  <label className="label">เลือกโมเดล Gemini *</label>
                  <select
                    className="select text-xs sm:text-sm"
                    value={selectedAiModelId}
                    onChange={(e) => setSelectedAiModelId(e.target.value)}
                  >
                    {aiModels.map((m: any) => (
                      <option key={m.id} value={m.id}>
                        {m.displayName} ({m.modelId}) — [{m.tier === 'free' ? 'ฟรี' : 'Requires Billing'}]
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* ─── SECTION 2: PORTFOLIO & PREFERENCES ─────────────────── */}
          <div className="card p-5 sm:p-6 space-y-4">
            <h2 className="text-base font-bold text-white pb-3 border-b border-[var(--border)]">
              การคำนวณและการแจ้งเตือน (Preferences)
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">สกุลเงินหลักสำหรับแสดงผลพอร์ต (Base Currency)</label>
                <select
                  className="select text-xs sm:text-sm"
                  value={baseCurrency}
                  onChange={(e) => setBaseCurrency(e.target.value)}
                >
                  <option value="THB">THB — บาทไทย (฿)</option>
                  <option value="USD">USD — ดอลลาร์สหรัฐ ($)</option>
                  <option value="EUR">EUR — ยูโร (€)</option>
                  <option value="SGD">SGD — ดอลลาร์สิงคโปร์ (S$)</option>
                  <option value="JPY">JPY — เยนญี่ปุ่น (¥)</option>
                </select>
                <p className="text-[11px] text-[var(--text-muted)] mt-1">
                  ระบบจะแปลงมูลค่าสินทรัพย์ทุกสกุลเงินเป็นสกุลเงินหลักนี้โดยอัตโนมัติ
                </p>
              </div>

              <div>
                <label className="label">เกณฑ์การแจ้งเตือนพอร์ตเบี่ยงเบน (Alert Threshold)</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="1"
                    max="20"
                    step="1"
                    className="flex-1 accent-cyan-400"
                    value={alertThreshold}
                    onChange={(e) => setAlertThreshold(parseInt(e.target.value))}
                  />
                  <span className="font-bold text-white text-sm tabular-nums w-12 text-right">
                    ±{alertThreshold}%
                  </span>
                </div>
                <p className="text-[11px] text-[var(--text-muted)] mt-1">
                  แจ้งเตือนเมื่อสัดส่วนสินทรัพย์เบี่ยงเบนจากเป้าหมายเกินเกณฑ์นี้
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-[var(--border)] flex items-center justify-between">
              <div>
                <p className="font-semibold text-white text-xs sm:text-sm">
                  สรุปพอร์ตประจำสัปดาห์ (AI Weekly Digest)
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  รับบทวิเคราะห์ภาพรวมพอร์ตและข่าวสารสำคัญสรุปส่งทุกวันจันทร์
                </p>
              </div>
              <input
                type="checkbox"
                className="w-5 h-5 accent-cyan-400 rounded cursor-pointer"
                checked={weeklyDigest}
                onChange={(e) => setWeeklyDigest(e.target.checked)}
              />
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary text-xs sm:text-sm py-2.5 px-6 flex items-center gap-2 shadow-[0_0_20px_rgba(34,211,238,0.25)]"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>กำลังบันทึกการตั้งค่า...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>บันทึกการตั้งค่าทั้งหมด</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* ─── SECTION 3: SESSIONS & SECURITY ────────────────────────── */}
        <div className="card p-5 sm:p-6 space-y-4 border-red-500/20 bg-red-950/5">
          <div className="flex items-center gap-2 text-red-400 font-bold text-sm">
            <Shield className="w-4 h-4" />
            <span>ความปลอดภัยของเซสชัน (Session Security)</span>
          </div>
          <p className="text-xs text-[var(--text-secondary)]">
            หากคุณสงสัยว่ามีการเข้าถึงบัญชีจากอุปกรณ์อื่น หรือต้องการออกจากระบบในทุกเบราว์เซอร์พร้อมกัน
          </p>

          <button
            onClick={handleInvalidateAllSessions}
            disabled={invalidating}
            className="btn btn-danger text-xs py-2 px-4 flex items-center gap-2"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>ออกจากระบบทุกอุปกรณ์ (Sign Out All Devices)</span>
          </button>
        </div>
      </div>
    </AppShell>
  )
}
