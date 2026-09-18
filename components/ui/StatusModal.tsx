'use client'

import React, { useEffect } from 'react'
import { Check, AlertTriangle, XCircle, Sparkles, ArrowRight, Loader2 } from 'lucide-react'

export interface StatusDetailItem {
  label: string
  value: string | number
  color?: string
}

export interface StatusModalProps {
  isOpen: boolean
  type: 'loading' | 'success' | 'error' | 'warning'
  title: string
  description?: string
  progressStep?: string
  details?: StatusDetailItem[]
  primaryAction?: {
    label: string
    onClick: () => void
    icon?: React.ReactNode
  }
  secondaryAction?: {
    label: string
    onClick: () => void
  }
  onClose?: () => void
  autoCloseMs?: number
}

export function StatusModal({
  isOpen,
  type,
  title,
  description,
  progressStep,
  details = [],
  primaryAction,
  secondaryAction,
  onClose,
  autoCloseMs,
}: StatusModalProps) {
  useEffect(() => {
    if (!isOpen || !autoCloseMs || type === 'loading') return
    const timer = setTimeout(() => {
      if (onClose) onClose()
    }, autoCloseMs)
    return () => clearTimeout(timer)
  }, [isOpen, autoCloseMs, type, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div
        className={`relative w-full max-w-md rounded-3xl p-6 sm:p-8 bg-[#12151C] border border-white/10 shadow-2xl text-center overflow-hidden animate-success-pop ${
          type === 'success'
            ? 'animate-glow-emerald border-emerald-500/30'
            : type === 'loading'
            ? 'animate-glow-indigo border-indigo-500/30'
            : type === 'error'
            ? 'border-rose-500/40'
            : 'border-amber-500/40'
        }`}
      >
        {/* Background ambient lighting aura */}
        <div
          className={`absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full blur-3xl pointer-events-none opacity-25 ${
            type === 'success'
              ? 'bg-emerald-500'
              : type === 'loading'
              ? 'bg-indigo-500'
              : type === 'error'
              ? 'bg-rose-500'
              : 'bg-amber-500'
          }`}
        />

        {/* Animated Icon Container */}
        <div className="relative mx-auto mb-6 flex items-center justify-center">
          {type === 'success' && (
            <div className="relative flex items-center justify-center">
              <div className="absolute w-20 h-20 rounded-full bg-emerald-500/20 animate-pulse-ring" />
              <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-400 p-[2px] shadow-lg shadow-emerald-500/30 flex items-center justify-center">
                <div className="w-full h-full rounded-full bg-[#0E1218] flex items-center justify-center">
                  <svg className="w-8 h-8 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline className="animate-stroke" points="20 6 9 17 4 12" />
                  </svg>
                </div>
              </div>
            </div>
          )}

          {type === 'loading' && (
            <div className="relative flex items-center justify-center">
              <div className="absolute w-20 h-20 rounded-full bg-indigo-500/25 animate-pulse-ring" />
              <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-indigo-600 via-purple-500 to-cyan-400 p-[2px] shadow-lg shadow-indigo-500/30 flex items-center justify-center animate-spin">
                <div className="w-full h-full rounded-full bg-[#0E1218] flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-indigo-400 animate-pulse" />
                </div>
              </div>
            </div>
          )}

          {type === 'error' && (
            <div className="w-16 h-16 rounded-full bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto shadow-lg shadow-rose-500/20">
              <XCircle className="w-9 h-9" />
            </div>
          )}

          {type === 'warning' && (
            <div className="w-16 h-16 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto shadow-lg shadow-amber-500/20">
              <AlertTriangle className="w-9 h-9" />
            </div>
          )}
        </div>

        {/* Title & Description */}
        <h3 className="text-xl font-bold text-white tracking-tight mb-2 flex items-center justify-center gap-2">
          {title}
        </h3>

        {description && (
          <p className="text-sm text-zinc-300 max-w-sm mx-auto leading-relaxed mb-4 font-normal">
            {description}
          </p>
        )}

        {/* Progress Step Badge for Loading */}
        {type === 'loading' && progressStep && (
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.06] border border-white/10 text-xs font-mono text-indigo-300 mb-4 animate-pulse">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>{progressStep}</span>
          </div>
        )}

        {/* Details Grid (e.g. Summary Chips) */}
        {details.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 rounded-2xl bg-[#181C25] border border-white/[0.08] mb-6 text-left">
            {details.map((item, idx) => (
              <div key={idx} className="p-2 rounded-xl bg-white/[0.02]">
                <span className="text-[10px] text-zinc-400 block uppercase tracking-wider font-semibold">
                  {item.label}
                </span>
                <span className={`text-xs font-bold font-mono truncate block ${item.color || 'text-white'}`}>
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Action Buttons */}
        {(primaryAction || secondaryAction || onClose) && (
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 mt-2">
            {secondaryAction && (
              <button
                type="button"
                onClick={secondaryAction.onClick}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-xs font-semibold text-zinc-300 hover:text-white transition-all cursor-pointer"
              >
                {secondaryAction.label}
              </button>
            )}

            {primaryAction && (
              <button
                type="button"
                onClick={primaryAction.onClick}
                className={`w-full sm:w-auto flex-1 inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold text-white shadow-lg transition-all active:scale-[0.98] cursor-pointer ${
                  type === 'success'
                    ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30'
                    : type === 'error'
                    ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/30'
                    : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/30'
                }`}
              >
                <span>{primaryAction.label}</span>
                {primaryAction.icon || <ArrowRight className="w-3.5 h-3.5" />}
              </button>
            )}

            {!primaryAction && !secondaryAction && onClose && type !== 'loading' && (
              <button
                type="button"
                onClick={onClose}
                className="w-full px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white transition-all cursor-pointer shadow-lg shadow-indigo-600/25"
              >
                ตกลง
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
