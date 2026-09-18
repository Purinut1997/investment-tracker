'use client'

import React, { useState, useEffect } from 'react'
import useSWR, { mutate } from 'swr'
import { signOut } from 'next-auth/react'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/PageHeader'
import {
  Sparkles,
  Key,
  Shield,
  LogOut,
  CheckCircle,
  AlertCircle,
  Loader2,
  Check,
  ExternalLink,
  Sliders,
  DollarSign,
  Bell,
  Cpu,
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
      if (!res.ok) throw new Error(resJson.error || 'ไม่สามารถบันทึกการตั้งค่าได้')

      setMsg({ type: 'success', text: 'บันทึกการตั้งค่าระบบเรียบร้อยแล้ว' })
      setApiKey('') // Clear raw input
      mutate('/api/settings')
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'เกิดข้อผิดพลาดในการบันทึก' })
    } finally {
      setSaving(false)
    }
  }

  async function handleInvalidateAllSessions() {
    if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการออกจากระบบในทุกอุปกรณ์พร้อมกัน?')) return
    setInvalidating(true)
    try {
      await fetch('/api/auth/invalidate-sessions', { method: 'POST' })
      signOut({ callbackUrl: '/login' })
    } catch (err) {
      alert('ออกจากระบบในทุกอุปกรณ์ไม่สำเร็จ')
      setInvalidating(false)
    }
  }

  return (
    <AppShell>
      <div className="space-y-8 max-w-4xl mx-auto w-full pb-12">
        <PageHeader
          eyebrow="SETTINGS"
          title="ตั้งค่าระบบ"
          description="จัดการการเชื่อมต่อ AI Gemini, สกุลเงินหลัก, การแจ้งเตือน และความปลอดภัยของบัญชี"
        />

        {/* Feedback Alert */}
        {msg && (
          <div
            className={`p-4 rounded-2xl flex items-center gap-3 text-sm font-medium transition-all ${
              msg.type === 'success'
                ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
            }`}
          >
            {msg.type === 'success' ? (
              <CheckCircle className="w-5 h-5 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0" />
            )}
            <span>{msg.text}</span>
          </div>
        )}

        <form onSubmit={handleSaveSettings} className="space-y-6">
          {/* ─── SECTION 1: GEMINI AI CONFIGURATION ──────────────────── */}
          <div className="bg-[#12151C] border border-white/[0.08] rounded-2xl p-6 sm:p-7 shadow-xl shadow-black/20 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-white/[0.06]">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white">การเชื่อมต่อ AI (Google Gemini)</h2>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    เชื่อมต่อ Google Gemini API เพื่อใช้วิเคราะห์ข่าวสารและพอร์ตการลงทุน
                  </p>
                </div>
              </div>

              {settings?.hasApiKey ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 self-start sm:self-auto">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  เชื่อมต่อแล้ว
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-zinc-800 border border-white/10 text-zinc-400 self-start sm:self-auto">
                  ยังไม่ได้ใส่ API Key
                </span>
              )}
            </div>

            {/* API Key Input */}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-zinc-300">
                GEMINI API KEY <span className="text-zinc-500 font-normal">(เข้ารหัส AES-256-GCM ปลอดภัย)</span>
              </label>
              <div className="relative">
                <Key className="w-4 h-4 text-zinc-500 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  className="w-full bg-[#181C25] border border-white/10 rounded-xl pl-11 pr-4 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors font-mono"
                  placeholder={settings?.hasApiKey ? '•••••••••••••••••••••••••••• (กรอกคีย์ใหม่หากต้องการเปลี่ยน)' : 'AIzaSy...'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
              </div>
              <p className="text-xs text-zinc-500 flex items-center gap-1.5">
                รับ API Key ฟรีได้ที่
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1 font-medium underline underline-offset-2"
                >
                  Google AI Studio <ExternalLink className="w-3 h-3" />
                </a>
              </p>
            </div>

            {/* AI Model Mode: Auto vs Manual */}
            <div className="space-y-3 pt-2">
              <label className="block text-xs font-medium text-zinc-300">โหมดการเลือกโมเดล AI</label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div
                  onClick={() => setAiModelMode('auto')}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    aiModelMode === 'auto'
                      ? 'bg-indigo-500/10 border-indigo-500/40 shadow-sm shadow-indigo-500/10'
                      : 'bg-[#181C25]/60 border-white/[0.06] hover:bg-[#181C25] hover:border-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`font-semibold text-sm ${aiModelMode === 'auto' ? 'text-indigo-400' : 'text-zinc-300'}`}>
                      โหมดอัตโนมัติ (แนะนำ)
                    </span>
                    {aiModelMode === 'auto' && (
                      <div className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    ระบบจะเลือกโมเดลที่ดีที่สุดและมีโควตาฟรีให้โดยอัตโนมัติ พร้อมสลับตัวสำรองหากโควตาเต็ม
                  </p>
                </div>

                <div
                  onClick={() => setAiModelMode('manual')}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    aiModelMode === 'manual'
                      ? 'bg-indigo-500/10 border-indigo-500/40 shadow-sm shadow-indigo-500/10'
                      : 'bg-[#181C25]/60 border-white/[0.06] hover:bg-[#181C25] hover:border-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`font-semibold text-sm ${aiModelMode === 'manual' ? 'text-indigo-400' : 'text-zinc-300'}`}>
                      กำหนดโมเดลเอง
                    </span>
                    {aiModelMode === 'manual' && (
                      <div className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    เจาะจงโมเดลที่ต้องการใช้งานจากรายการโมเดลที่เปิดให้ในระบบ
                  </p>
                </div>
              </div>

              {/* Manual Model Dropdown */}
              {aiModelMode === 'manual' && (
                <div className="pt-2 animate-in fade-in space-y-1.5">
                  <label className="block text-xs font-medium text-zinc-400">เลือกโมเดลที่ต้องการ *</label>
                  <div className="relative">
                    <Cpu className="w-4 h-4 text-zinc-500 absolute left-4 top-1/2 -translate-y-1/2" />
                    <select
                      className="w-full bg-[#181C25] border border-white/10 rounded-xl pl-11 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                      value={selectedAiModelId}
                      onChange={(e) => setSelectedAiModelId(e.target.value)}
                    >
                      {aiModels.map((m: any) => (
                        <option key={m.id} value={m.id}>
                          {m.displayName} ({m.modelId}) - [{m.tier.toUpperCase()}]
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ─── SECTION 2: PORTFOLIO & PREFERENCES ─────────────────── */}
          <div className="bg-[#12151C] border border-white/[0.08] rounded-2xl p-6 sm:p-7 shadow-xl shadow-black/20 space-y-6">
            <div className="flex items-center gap-3.5 pb-5 border-b border-white/[0.06]">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-white">พอร์ตโฟลิโอ & การแจ้งเตือน</h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  ตั้งค่าสกุลเงินแสดงผลและเกณฑ์การแจ้งเตือนสัดส่วนสินทรัพย์เบี่ยงเบน
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="block text-xs font-medium text-zinc-300">
                  สกุลเงินหลัก (Base Currency)
                </label>
                <div className="relative">
                  <DollarSign className="w-4 h-4 text-zinc-500 absolute left-4 top-1/2 -translate-y-1/2" />
                  <select
                    className="w-full bg-[#181C25] border border-white/10 rounded-xl pl-11 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                    value={baseCurrency}
                    onChange={(e) => setBaseCurrency(e.target.value)}
                  >
                    <option value="THB">THB (บาทไทย ฿)</option>
                    <option value="USD">USD (ดอลลาร์สหรัฐ $)</option>
                    <option value="EUR">EUR (ยูโร €)</option>
                    <option value="SGD">SGD (ดอลลาร์สิงคโปร์ S$)</option>
                    <option value="JPY">JPY (เยนญี่ปุ่น ¥)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-medium text-zinc-300">
                    เกณฑ์แจ้งเตือนสัดส่วนหลุดเป้า (Drift Alert)
                  </label>
                  <span className="font-mono font-semibold text-indigo-400 text-xs tabular-nums">
                    ±{alertThreshold}%
                  </span>
                </div>
                <div className="flex items-center gap-3 bg-[#181C25] border border-white/10 rounded-xl px-4 py-2.5">
                  <input
                    type="range"
                    min="1"
                    max="20"
                    step="1"
                    className="flex-1 accent-indigo-500 cursor-pointer"
                    value={alertThreshold}
                    onChange={(e) => setAlertThreshold(parseInt(e.target.value))}
                  />
                </div>
                <p className="text-[11px] text-zinc-500">
                  แจ้งเตือนเมื่อสินทรัพย์เบี่ยงเบนจากเป้าหมายที่กำหนดเกินเกณฑ์นี้
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-white/[0.06] flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-zinc-400" />
                  <p className="font-medium text-white text-sm">
                    AI สรุปรายงานประจำสัปดาห์ (Weekly Digest)
                  </p>
                </div>
                <p className="text-xs text-zinc-400 pl-6">
                  รับบทสรุปภาพรวมพอร์ตและความเคลื่อนไหวของตลาดทุกวันจันทร์
                </p>
              </div>
              <input
                type="checkbox"
                className="w-5 h-5 rounded border-white/20 bg-[#181C25] text-indigo-600 focus:ring-indigo-500/20 cursor-pointer accent-indigo-600"
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
              className="bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white font-medium px-7 py-3 rounded-xl text-sm flex items-center gap-2 shadow-lg shadow-indigo-600/25 transition-all disabled:opacity-50 min-w-[160px] justify-center"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>กำลังบันทึก...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>บันทึกการตั้งค่า</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* ─── SECTION 3: SESSIONS & SECURITY ────────────────────────── */}
        <div className="bg-[#12151C] border border-rose-500/20 rounded-2xl p-6 sm:p-7 shadow-xl shadow-black/20 space-y-4">
          <div className="flex items-center gap-3 text-rose-400">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">ความปลอดภัยของบัญชีผู้ใช้</h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                การจัดการเซสชันและการเข้าสู่ระบบในอุปกรณ์ต่างๆ
              </p>
            </div>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed max-w-xl">
            หากท่านสงสัยว่ามีการเข้าใช้งานบัญชีโดยไม่ได้รับอนุญาต หรือต้องการออกจากระบบในอุปกรณ์อื่นทั้งหมดพร้อมกัน สามารถคลิกเพื่อยกเลิกเซสชันทั้งหมดได้ทันที
          </p>

          <div className="pt-2">
            <button
              onClick={handleInvalidateAllSessions}
              disabled={invalidating}
              className="bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/25 px-5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              <LogOut className="w-4 h-4" />
              <span>{invalidating ? 'กำลังดำเนินการ...' : 'ออกจากระบบในทุกอุปกรณ์ (Sign Out All Devices)'}</span>
            </button>
          </div>
        </div>

        {/* ─── SECTION 4: ABOUT & CREDITS ────────────────────────── */}
        <div className="bg-[#12151C] border border-white/[0.08] rounded-2xl p-6 shadow-xl shadow-black/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide">Investment Pro (Executive Edition)</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              แพลตฟอร์มบริหารจัดการพอร์ตการลงทุน วิเคราะห์สินทรัพย์ และคาดการณ์ผลตอบแทนด้วย AI
            </p>
          </div>
          <div className="text-left sm:text-right shrink-0">
            <span className="text-[10px] text-slate-500 font-medium block">ผู้พัฒนาและออกแบบระบบ</span>
            <span className="text-xs font-mono font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-lg inline-block mt-0.5">
              Created by MIKPURINUT
            </span>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
