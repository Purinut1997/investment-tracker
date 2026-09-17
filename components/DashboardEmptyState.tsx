import React from 'react'
import Link from 'next/link'
import { Wallet, Plus, Target, ArrowRight, CheckCircle2 } from 'lucide-react'
import { AppShell } from '@/components/AppShell'

interface DashboardEmptyStateProps {
  hasAccounts: boolean
  hasHoldings: boolean
  hasPlans: boolean
}

export function DashboardEmptyState({ hasAccounts, hasHoldings, hasPlans }: DashboardEmptyStateProps) {
  // Step 1: Create Account
  const step1Done = hasAccounts
  const step1Active = !hasAccounts

  // Step 2: Add Transaction
  const step2Done = hasHoldings
  const step2Active = hasAccounts && !hasHoldings

  // Step 3: Set Plan
  const step3Done = hasPlans
  const step3Active = hasAccounts && hasHoldings && !hasPlans

  return (
    <AppShell>
      <div className="flex flex-col items-center justify-center min-h-[70vh] w-full max-w-2xl mx-auto px-4">
        
        {/* Header */}
        <div className="text-center mb-10">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-violet-500/20 to-indigo-500/10 border border-violet-500/20 flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(124,58,237,0.15)]">
            <Wallet className="w-8 h-8 text-violet-400" />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight mb-3">เริ่มสร้างพอร์ตของคุณ</h1>
          <p className="text-zinc-400 text-sm max-w-md mx-auto leading-relaxed">
            ยินดีต้อนรับสู่ Investment Pro ระบบจะช่วยคุณติดตาม วิเคราะห์ และจัดการความมั่งคั่งอย่างมืออาชีพ มาเริ่มตั้งค่าพอร์ตของคุณกันเถอะ
          </p>
        </div>

        {/* Steps */}
        <div className="w-full space-y-4">
          
          {/* Step 1 */}
          <div className={`p-5 rounded-2xl border transition-all duration-300 ${
            step1Done ? 'bg-emerald-500/5 border-emerald-500/20' 
            : step1Active ? 'bg-[#151821] border-violet-500/30 shadow-[0_4px_24px_rgba(124,58,237,0.1)] ring-1 ring-violet-500/20'
            : 'bg-[#111319] border-white/5 opacity-50'
          }`}>
            <div className="flex items-start sm:items-center justify-between flex-col sm:flex-row gap-4">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                  step1Done ? 'bg-emerald-500/20 text-emerald-400' 
                  : step1Active ? 'bg-violet-500/20 text-violet-400'
                  : 'bg-white/5 text-zinc-500'
                }`}>
                  {step1Done ? <CheckCircle2 className="w-5 h-5" /> : <span className="font-bold">1</span>}
                </div>
                <div>
                  <h3 className={`font-bold ${step1Done ? 'text-emerald-400' : step1Active ? 'text-white' : 'text-zinc-400'}`}>สร้างบัญชีลงทุน</h3>
                  <p className="text-xs text-zinc-500 mt-1">ตั้งชื่อและระบุประเภทบัญชีที่ใช้ลงทุน เช่น บัญชีหุ้นไทย, คริปโต</p>
                </div>
              </div>
              {!step1Done && step1Active && (
                <Link href="/accounts" className="btn btn-primary text-sm px-5 py-2 w-full sm:w-auto shrink-0 shadow-[0_4px_16px_rgba(124,58,237,0.4)] hover:shadow-[0_4px_24px_rgba(124,58,237,0.6)]">
                  สร้างบัญชี <ArrowRight className="w-4 h-4 ml-1.5 inline" />
                </Link>
              )}
            </div>
          </div>

          {/* Step 2 */}
          <div className={`p-5 rounded-2xl border transition-all duration-300 ${
            step2Done ? 'bg-emerald-500/5 border-emerald-500/20' 
            : step2Active ? 'bg-[#151821] border-violet-500/30 shadow-[0_4px_24px_rgba(124,58,237,0.1)] ring-1 ring-violet-500/20'
            : 'bg-[#111319] border-white/5 opacity-50'
          }`}>
            <div className="flex items-start sm:items-center justify-between flex-col sm:flex-row gap-4">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                  step2Done ? 'bg-emerald-500/20 text-emerald-400' 
                  : step2Active ? 'bg-violet-500/20 text-violet-400'
                  : 'bg-white/5 text-zinc-500'
                }`}>
                  {step2Done ? <CheckCircle2 className="w-5 h-5" /> : <span className="font-bold">2</span>}
                </div>
                <div>
                  <h3 className={`font-bold ${step2Done ? 'text-emerald-400' : step2Active ? 'text-white' : 'text-zinc-400'}`}>เพิ่มธุรกรรมแรก</h3>
                  <p className="text-xs text-zinc-500 mt-1">บันทึกการซื้อขาย หรือโอนสินทรัพย์ เพื่อให้ระบบคำนวณพอร์ต</p>
                </div>
              </div>
              {!step2Done && step2Active && (
                <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                  <Link href="/transactions" className="btn text-sm px-4 py-2 flex-1 sm:flex-none justify-center bg-white/5 text-white hover:bg-white/10 border border-white/10 rounded-xl">
                    Import CSV
                  </Link>
                  <Link href="/transactions" className="btn btn-primary text-sm px-4 py-2 flex-1 sm:flex-none justify-center shadow-[0_4px_16px_rgba(124,58,237,0.4)] hover:shadow-[0_4px_24px_rgba(124,58,237,0.6)]">
                    <Plus className="w-4 h-4 mr-1.5 inline" /> เพิ่มรายการ
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Step 3 */}
          <div className={`p-5 rounded-2xl border transition-all duration-300 ${
            step3Done ? 'bg-emerald-500/5 border-emerald-500/20' 
            : step3Active ? 'bg-[#151821] border-violet-500/30 shadow-[0_4px_24px_rgba(124,58,237,0.1)] ring-1 ring-violet-500/20'
            : 'bg-[#111319] border-white/5 opacity-50'
          }`}>
            <div className="flex items-start sm:items-center justify-between flex-col sm:flex-row gap-4">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                  step3Done ? 'bg-emerald-500/20 text-emerald-400' 
                  : step3Active ? 'bg-violet-500/20 text-violet-400'
                  : 'bg-white/5 text-zinc-500'
                }`}>
                  {step3Done ? <CheckCircle2 className="w-5 h-5" /> : <Target className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className={`font-bold ${step3Done ? 'text-emerald-400' : step3Active ? 'text-white' : 'text-zinc-400'}`}>ตั้งเป้าหมายและสัดส่วน</h3>
                  <p className="text-xs text-zinc-500 mt-1">กำหนดสัดส่วนสินทรัพย์ที่ต้องการ เพื่อดูคำแนะนำ Rebalance</p>
                </div>
              </div>
              {!step3Done && step3Active && (
                <Link href="/plans" className="btn btn-primary text-sm px-5 py-2 w-full sm:w-auto shrink-0 shadow-[0_4px_16px_rgba(124,58,237,0.4)] hover:shadow-[0_4px_24px_rgba(124,58,237,0.6)]">
                  ตั้งแผนการลงทุน <ArrowRight className="w-4 h-4 ml-1.5 inline" />
                </Link>
              )}
            </div>
          </div>

        </div>

      </div>
    </AppShell>
  )
}
