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
      description: 'เช่น บัญชีหุ้นไทย บัญชีกองทุน หรือกระเป๋าคริปโต',
      icon: Wallet,
      action: (
        <Link
          href="/accounts"
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 min-h-11 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition-all w-full sm:w-auto shrink-0"
        >
          สร้างบัญชี <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      ),
    },
    {
      done: hasHoldings,
      title: 'บันทึกธุรกรรมแรก',
      description: 'บันทึกการซื้อขายหรือนำเข้าพอร์ตจากไฟล์ CSV',
      icon: Plus,
      action: (
        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
          <Link
            href="/transactions"
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 min-h-11 rounded-xl text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 transition-all flex-1 sm:flex-none"
          >
            <Upload className="w-3.5 h-3.5" /> Import CSV
          </Link>
          <Link
            href="/transactions"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 min-h-11 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition-all flex-1 sm:flex-none"
          >
            <Plus className="w-3.5 h-3.5" /> เพิ่มรายการ
          </Link>
        </div>
      ),
    },
    {
      done: hasPlans,
      title: 'ตั้งเป้าหมายสัดส่วนพอร์ต',
      description: 'กำหนดสัดส่วน Asset Allocation เพื่อรับคำแนะนำปรับพอร์ตจาก AI',
      icon: Target,
      action: (
        <Link
          href="/plans"
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 min-h-11 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition-all w-full sm:w-auto shrink-0"
        >
          ตั้งแผนการลงทุน <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      ),
    },
  ]

  const activeIndex = steps.findIndex((step) => !step.done)
  const completedCount = steps.filter((step) => step.done).length

  return (
    <AppShell>
      <div className="w-full max-w-[1080px] mx-auto min-h-[calc(100dvh-10rem)] flex items-center py-6 sm:py-10">
        <div className="grid xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-8 xl:gap-12 items-start w-full">
          {/* Left Hero Card */}
          <div className="p-8 rounded-2xl glass-panel">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center mb-6">
              <Wallet className="w-6 h-6 text-indigo-400" />
            </div>
            <p className="text-xs font-semibold tracking-wide text-indigo-400 mb-2">เริ่มต้นใช้งาน</p>
            <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight leading-tight mb-4">
              เริ่มต้นจัดการพอร์ตการลงทุนของคุณ
            </h1>
            <p className="text-sm text-slate-400 leading-relaxed mb-6">
              จัดเก็บบัญชีและธุรกรรมไว้ในที่เดียว เพื่อให้มูลค่าพอร์ตและสัดส่วนสินทรัพย์ของคุณถูกคำนวณจากข้อมูลจริง
            </p>
            <div className="pt-5 border-t border-slate-800 text-xs text-slate-400 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>ข้อมูลทางการเงินถูกเข้ารหัสและปกป้องอย่างปลอดภัย</span>
            </div>
          </div>

          {/* Right Setup Steps */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <div>
                <p className="text-base font-bold text-white">ขั้นตอนการตั้งค่าเริ่มต้น</p>
                <p className="text-xs text-slate-400 mt-0.5">ทำตาม 3 ขั้นตอนนี้เพื่อเริ่มใช้งานแดชบอร์ดเต็มรูปแบบ</p>
              </div>
              <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                {completedCount}/3 เสร็จสิ้น
              </span>
            </div>

            {steps.map((step, index) => {
              const isActive = index === activeIndex
              const isLocked = activeIndex !== -1 && index > activeIndex
              const Icon = step.icon
              return (
                <div
                  key={step.title}
                  className={`p-5 rounded-2xl border transition-all duration-200 ${
                    step.done
                      ? 'bg-emerald-500/[0.06] border-emerald-500/30'
                      : isActive
                      ? 'glass-panel border-indigo-500/40 shadow-lg shadow-indigo-500/5'
                      : 'bg-slate-900/40 border-slate-800/80 opacity-60'
                  }`}
                >
                  <div className="flex items-start sm:items-center justify-between flex-col sm:flex-row gap-4">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          step.done
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : isActive
                            ? 'bg-indigo-500/20 text-indigo-400'
                            : 'bg-slate-800/80 text-slate-500'
                        }`}
                      >
                        {step.done ? (
                          <CheckCircle2 className="w-5 h-5" />
                        ) : isLocked ? (
                          <LockKeyhole className="w-4 h-4" />
                        ) : (
                          <Icon className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <h3 className={`text-sm font-bold ${step.done ? 'text-emerald-300' : isActive ? 'text-white' : 'text-slate-400'}`}>
                          {step.title}
                        </h3>
                        <p className="text-xs text-slate-400 mt-1 leading-normal">
                          {step.description}
                        </p>
                      </div>
                    </div>
                    {!step.done && isActive && step.action}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </AppShell>
  )
}
