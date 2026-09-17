import React from 'react'
import Link from 'next/link'
import { Wallet, Plus, Target, ArrowRight, CheckCircle2, Upload, LockKeyhole } from 'lucide-react'
import { AppShell } from '@/components/AppShell'

interface DashboardEmptyStateProps {
  hasAccounts: boolean
  hasHoldings: boolean
  hasPlans: boolean
}

export function DashboardEmptyState({ hasAccounts, hasHoldings, hasPlans }: DashboardEmptyStateProps) {
  const steps = [
    {
      done: hasAccounts,
      title: 'สร้างบัญชีลงทุน',
      description: 'เช่น บัญชีหุ้นไทย กองทุน หรือคริปโต',
      icon: Wallet,
      action: <Link href="/accounts" className="btn btn-primary text-sm px-5 py-2 w-full sm:w-auto">สร้างบัญชี <ArrowRight className="w-4 h-4" /></Link>,
    },
    {
      done: hasHoldings,
      title: 'เพิ่มรายการแรก',
      description: 'บันทึกการซื้อขายหรือโอนสินทรัพย์',
      icon: Plus,
      action: (
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Link href="/transactions" className="btn text-sm px-4 py-2 flex-1 sm:flex-none justify-center bg-transparent text-[var(--text-secondary)] hover:text-white border border-white/10 rounded-xl"><Upload className="w-4 h-4" /> Import CSV</Link>
          <Link href="/transactions" className="btn btn-primary text-sm px-4 py-2 flex-1 sm:flex-none justify-center"><Plus className="w-4 h-4" /> เพิ่มรายการ</Link>
        </div>
      ),
    },
    {
      done: hasPlans,
      title: 'ตั้งเป้าหมายและสัดส่วน',
      description: 'กำหนดสัดส่วนเพื่อดูคำแนะนำการปรับพอร์ต',
      icon: Target,
      action: <Link href="/plans" className="btn btn-primary text-sm px-5 py-2 w-full sm:w-auto">ตั้งแผนการลงทุน <ArrowRight className="w-4 h-4" /></Link>,
    },
  ]

  const activeIndex = steps.findIndex((step) => !step.done)
  const completedCount = steps.filter((step) => step.done).length

  return (
    <AppShell>
      <div className="w-full max-w-5xl mx-auto py-2 sm:py-6">
        <div className="grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-10 lg:gap-16 items-start">
          <div className="pt-2 lg:pt-8">
            <div className="w-11 h-11 rounded-xl bg-[var(--accent-soft)] border border-[var(--border-accent)] flex items-center justify-center mb-5">
              <Wallet className="w-6 h-6 text-[var(--accent)]" />
            </div>
            <p className="text-xs font-semibold tracking-[0.16em] uppercase text-[var(--accent)] mb-3">Investment Pro</p>
            <h1 className="text-3xl sm:text-[2.15rem] font-semibold text-white tracking-tight leading-[1.2] mb-4">เริ่มจัดการพอร์ตของคุณ</h1>
            <p className="text-[15px] text-[var(--text-secondary)] max-w-lg leading-[1.65]">ตั้งค่าครั้งเดียว แล้วใช้พื้นที่นี้ติดตามมูลค่า ผลตอบแทน และแผนการลงทุนของคุณในมุมมองเดียว</p>
            <div className="mt-7 pt-5 border-t border-white/[0.08] text-xs text-[var(--text-muted)] flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[var(--positive)]" /> ข้อมูลของคุณจะถูกใช้เพื่อคำนวณพอร์ตส่วนตัว
            </div>
          </div>

          <div className="w-full space-y-3">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[15px] font-semibold text-white">ตั้งค่าเริ่มต้น</p>
                <p className="text-[13px] text-[var(--text-muted)] mt-1">ทำตาม 3 ขั้นตอนเพื่อปลดล็อก dashboard</p>
              </div>
              <span className="text-xs tabular-nums text-[var(--text-muted)]">{completedCount}/3</span>
            </div>

            {steps.map((step, index) => {
              const isActive = index === activeIndex
              const isLocked = activeIndex !== -1 && index > activeIndex
              const Icon = step.icon
              return (
                <div key={step.title} className={`p-4 sm:p-5 rounded-2xl border transition-colors duration-200 ${step.done ? 'bg-emerald-500/[0.04] border-emerald-500/20' : isActive ? 'bg-[var(--bg-elevated)] border-[var(--border-accent)]' : 'bg-[var(--bg-surface)] border-white/[0.06] opacity-55'}`}>
                  <div className="flex items-start sm:items-center justify-between flex-col sm:flex-row gap-3">
                    <div className="flex items-center gap-4">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${step.done ? 'bg-emerald-500/15 text-emerald-400' : isActive ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'bg-white/5 text-zinc-500'}`}>
                        {step.done ? <CheckCircle2 className="w-5 h-5" /> : isLocked ? <LockKeyhole className="w-4 h-4" /> : <Icon className="w-5 h-5" />}
                      </div>
                      <div>
                        <h3 className={`font-semibold ${step.done ? 'text-emerald-400' : isActive ? 'text-white' : 'text-zinc-400'}`}>{step.title}</h3>
                        <p className="text-[13px] text-zinc-500 mt-1 leading-[1.45]">{step.description}</p>
                      </div>
                    </div>
                    {!step.done && isActive && step.action}
                  </div>
                </div>
              )
            })}

            <div className="flex items-center gap-2 pt-3 text-[11px] text-[var(--text-muted)]"><LockKeyhole className="w-3.5 h-3.5" /> ขั้นตอนถัดไปจะเปิดใช้งานเมื่อข้อมูลพร้อม</div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
