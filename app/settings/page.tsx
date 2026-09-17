'use client'

import React, { useState, useEffect } from 'react'
import useSWR, { mutate } from 'swr'
import { signOut } from 'next-auth/react'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/PageHeader'
import {
  Settings,
  Sparkles,
  Key,
  Shield,
  LogOut,
  CheckCircle,
  AlertCircle,
  Loader2,
  Check,
  ExternalLink,
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
      if (!res.ok) throw new Error(resJson.error || 'Failed to save settings')

      setMsg({ type: 'success', text: 'Settings saved successfully.' })
      setApiKey('') // Clear raw input
      mutate('/api/settings')
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'An error occurred' })
    } finally {
      setSaving(false)
    }
  }

  async function handleInvalidateAllSessions() {
    if (!confirm('Are you sure you want to sign out of all devices?')) return
    setInvalidating(true)
    try {
      await fetch('/api/auth/invalidate-sessions', { method: 'POST' })
      signOut({ callbackUrl: '/login' })
    } catch (err) {
      alert('Failed to sign out of all devices')
      setInvalidating(false)
    }
  }
  
  const inputClass = "w-full bg-[#050505] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-zinc-500 transition-colors font-mono"
  const labelClass = "block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2"

  return (
    <AppShell>
      <div className="space-y-8 max-w-[1200px] mx-auto w-full">
        <PageHeader
          eyebrow="SYSTEM"
          title="ตั้งค่าระบบ"
          description="ปรับแต่ง AI, สกุลเงินหลัก, การแจ้งเตือน และการรักษาความปลอดภัย"
        />

        {/* Feedback Alert */}
        {msg && (
          <div
            className={`p-4 rounded-2xl flex items-center gap-3 text-xs font-mono tracking-widest uppercase ${
              msg.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
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
          <div className="p-6 md:p-8 rounded-3xl bg-[#0a0a0a] border border-white/5 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/5">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-zinc-400">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white tracking-wide">AI CONFIGURATION</h2>
                  <p className="text-[10px] text-zinc-500 mt-1 uppercase tracking-widest font-mono">
                    Connect Google Gemini Developer API
                  </p>
                </div>
              </div>

              {settings?.hasApiKey ? (
                <span className="text-[9px] font-bold px-3 py-1.5 rounded-sm bg-emerald-500/10 text-emerald-400 uppercase tracking-widest font-mono flex items-center gap-1.5 self-start sm:self-auto">
                  <Check className="w-3.5 h-3.5" />
                  CONNECTED
                </span>
              ) : (
                <span className="text-[9px] font-bold px-3 py-1.5 rounded-sm bg-white/5 text-zinc-500 uppercase tracking-widest font-mono self-start sm:self-auto">
                  NO API KEY
                </span>
              )}
            </div>

            {/* API Key Input */}
            <div className="space-y-3">
              <label className={labelClass}>
                GEMINI API KEY (AES-256-GCM ENCRYPTED)
              </label>
              <div className="relative">
                <Key className="w-4 h-4 text-zinc-600 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  className={`${inputClass} pl-11`}
                  placeholder={settings?.hasApiKey ? '•••••••••••••••••••••••••••• (Enter new key to update)' : 'AIzaSy...'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
              </div>
              <p className="text-[10px] text-zinc-500 font-mono tracking-widest uppercase">
                Get a free API Key from{' '}
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white hover:underline inline-flex items-center gap-1 font-bold"
                >
                  Google AI Studio <ExternalLink className="w-3 h-3" />
                </a>
              </p>
            </div>

            {/* AI Model Mode: Auto vs Manual */}
            <div className="space-y-4 pt-4 border-t border-white/5">
              <label className={labelClass}>MODEL SELECTION MODE</label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div
                  onClick={() => setAiModelMode('auto')}
                  className={`p-5 rounded-2xl border cursor-pointer transition-all ${
                    aiModelMode === 'auto'
                      ? 'bg-white/10 border-white/20'
                      : 'bg-transparent border-white/5 hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`font-bold text-sm tracking-wide ${aiModelMode === 'auto' ? 'text-white' : 'text-zinc-400'}`}>AUTO MODE (RECOMMENDED)</span>
                    {aiModelMode === 'auto' && <Check className="w-4 h-4 text-white" />}
                  </div>
                  <p className="text-[10px] font-mono tracking-widest uppercase text-zinc-500 leading-relaxed">
                    Automatically select the best free model. Fallback to alternatives if quota exceeded.
                  </p>
                </div>

                <div
                  onClick={() => setAiModelMode('manual')}
                  className={`p-5 rounded-2xl border cursor-pointer transition-all ${
                    aiModelMode === 'manual'
                      ? 'bg-white/10 border-white/20'
                      : 'bg-transparent border-white/5 hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`font-bold text-sm tracking-wide ${aiModelMode === 'manual' ? 'text-white' : 'text-zinc-400'}`}>MANUAL MODE</span>
                    {aiModelMode === 'manual' && <Check className="w-4 h-4 text-white" />}
                  </div>
                  <p className="text-[10px] font-mono tracking-widest uppercase text-zinc-500 leading-relaxed">
                    Specify an exact model to use from the available models list.
                  </p>
                </div>
              </div>

              {/* Manual Model Dropdown */}
              {aiModelMode === 'manual' && (
                <div className="pt-4 animate-in fade-in">
                  <label className={labelClass}>SELECT MODEL *</label>
                  <select
                    className={inputClass}
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
              )}
            </div>
          </div>

          {/* ─── SECTION 2: PORTFOLIO & PREFERENCES ─────────────────── */}
          <div className="p-6 md:p-8 rounded-3xl bg-[#0a0a0a] border border-white/5 space-y-6">
            <h2 className="text-sm font-bold text-white tracking-widest uppercase pb-4 border-b border-white/5">
              PREFERENCES
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className={labelClass}>BASE CURRENCY</label>
                <select
                  className={inputClass}
                  value={baseCurrency}
                  onChange={(e) => setBaseCurrency(e.target.value)}
                >
                  <option value="THB">THB</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="SGD">SGD</option>
                  <option value="JPY">JPY</option>
                </select>
              </div>

              <div>
                <label className={labelClass}>ALERT THRESHOLD</label>
                <div className="flex items-center gap-4 bg-[#050505] border border-white/10 rounded-xl px-4 py-3">
                  <input
                    type="range"
                    min="1"
                    max="20"
                    step="1"
                    className="flex-1 accent-white"
                    value={alertThreshold}
                    onChange={(e) => setAlertThreshold(parseInt(e.target.value))}
                  />
                  <span className="font-bold text-white text-sm tabular-nums w-12 text-right font-mono">
                    ±{alertThreshold}%
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-white/5 flex items-center justify-between">
              <div>
                <p className="font-bold text-white text-sm tracking-wide">
                  AI WEEKLY DIGEST
                </p>
                <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mt-1">
                  Receive portfolio analysis and market news every Monday
                </p>
              </div>
              <input
                type="checkbox"
                className="w-5 h-5 rounded border-white/20 bg-[#050505] text-white cursor-pointer"
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
              className="bg-white text-black hover:bg-zinc-200 px-8 py-3 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors disabled:opacity-50 min-w-[150px] justify-center"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>SAVING...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>SAVE SETTINGS</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* ─── SECTION 3: SESSIONS & SECURITY ────────────────────────── */}
        <div className="p-6 md:p-8 rounded-3xl bg-[#0a0a0a] border border-rose-500/20 space-y-4">
          <div className="flex items-center gap-3 text-rose-400">
            <Shield className="w-5 h-5" />
            <span className="font-bold tracking-widest uppercase text-sm">SECURITY</span>
          </div>
          <p className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase leading-relaxed max-w-xl">
            If you suspect unauthorized access or want to sign out from all browsers simultaneously, invalidate all active sessions.
          </p>

          <button
            onClick={handleInvalidateAllSessions}
            disabled={invalidating}
            className="bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 px-6 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors mt-4"
          >
            <LogOut className="w-4 h-4" />
            <span>SIGN OUT ALL DEVICES</span>
          </button>
        </div>
      </div>
    </AppShell>
  )
}
