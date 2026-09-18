'use client'

import React, { useState } from 'react'
import useSWR, { mutate } from 'swr'
import {
  Wallet,
  RefreshCw,
  Info,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Plus,
  Minus,
  Edit3,
  Sparkles,
  Loader2,
  Check,
  X,
  AlertCircle,
  Coins,
} from 'lucide-react'

const CURRENCY_FLAGS: Record<string, string> = {
  THB: '🇹🇭',
  USD: '🇺🇸',
  EUR: '🇪🇺',
  SGD: '🇸🇬',
  JPY: '🇯🇵',
  GBP: '🇬🇧',
  HKD: '🇭🇰',
  AUD: '🇦🇺',
  CHF: '🇨🇭',
  CNY: '🇨🇳',
}

interface CashAccount {
  id: string
  accountName: string
  accountType: string
  currency: string
  cashBalance: number
  balanceBase: number
  accruedInterest: number
  accruedInterestBase: number
  interestDays: number
  exchangeRateToBase: number
  transactionCount: number
}

interface CashWalletData {
  baseCurrency: string
  totalCashBase: number
  totalAccruedInterestBase: number
  minInterestDays: number
  accounts: CashAccount[]
  rates: Record<string, number>
  timestamp: number
}

interface CashWalletCardProps {
  onOpenAiScan?: () => void
}

export function CashWalletCard({ onOpenAiScan }: CashWalletCardProps) {
  const { data, isLoading, isValidating } = useSWR<CashWalletData>('/api/cash-wallet', {
    revalidateOnFocus: true,
  })

  const [expandedInterest, setExpandedInterest] = useState(true)
  const [showAllCurrencies, setShowAllCurrencies] = useState(false)
  const [adjustModalOpen, setAdjustModalOpen] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState<CashAccount | null>(null)
  const [adjustAmount, setAdjustAmount] = useState('')
  const [adjustInterest, setAdjustInterest] = useState('')
  const [adjustDays, setAdjustDays] = useState('')
  const [adjustAction, setAdjustAction] = useState<'adjust' | 'deposit' | 'withdraw'>('adjust')
  const [submitting, setSubmitting] = useState(false)
  const [modalError, setModalError] = useState('')

  const accounts = data?.accounts || []
  const totalCashBase = data?.totalCashBase || 0
  const totalAccruedInterest = data?.totalAccruedInterestBase || 0
  const nextPayoutDays = data?.minInterestDays ?? 104
  const baseCurrency = data?.baseCurrency || 'THB'

  function openAdjust(account: CashAccount, action: 'adjust' | 'deposit' | 'withdraw' = 'adjust') {
    setSelectedAccount(account)
    setAdjustAction(action)
    setAdjustAmount(action === 'adjust' ? account.cashBalance.toString() : '')
    setAdjustInterest(account.accruedInterest.toString())
    setAdjustDays(account.interestDays.toString())
    setModalError('')
    setAdjustModalOpen(true)
  }

  async function handleAdjustSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedAccount) return

    setSubmitting(true)
    setModalError('')

    try {
      const numAmount = parseFloat(adjustAmount)
      const numInterest = parseFloat(adjustInterest)
      const numDays = parseInt(adjustDays, 10)

      const res = await fetch('/api/cash-wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: selectedAccount.id,
          action: adjustAction,
          amount: isNaN(numAmount) ? undefined : numAmount,
          accruedInterest: isNaN(numInterest) ? undefined : numInterest,
          interestDays: isNaN(numDays) ? undefined : numDays,
        }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'บันทึกยอดเงินสดไม่สำเร็จ')

      mutate('/api/cash-wallet')
      mutate('/api/accounts')
      mutate('/api/portfolio/summary')
      setAdjustModalOpen(false)
    } catch (err: any) {
      setModalError(err.message || 'เกิดข้อผิดพลาด')
    } finally {
      setSubmitting(false)
    }
  }

  // Format currency helpers
  const formatMoney = (val: number, decimals = 2) =>
    val.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })

  return (
    <div className="space-y-4 w-full">
      {/* Top Header / Cash Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Coins className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <span>เงินสด (Cash Wallet)</span>
              <span className="text-xs font-mono font-normal text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                รวม ≈ ฿{formatMoney(totalCashBase)}
              </span>
            </h2>
            <p className="text-[11px] text-zinc-400">
              ยอดเงินสดคงเหลือและดอกเบี้ยสะสมในบัญชีต่างๆ
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onOpenAiScan && (
            <button
              onClick={onOpenAiScan}
              className="bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all shadow-sm active:scale-[0.98] cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>สแกนหน้าเงินสดด้วย AI</span>
            </button>
          )}

          <button
            onClick={() => mutate('/api/cash-wallet')}
            disabled={isValidating}
            className="p-2 rounded-xl bg-white/[0.04] border border-white/10 text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors"
            title="รีเฟรชยอดเงินสด"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isValidating ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="p-8 rounded-2xl bg-[#12151C] border border-white/[0.08] flex items-center justify-center gap-3 text-zinc-400 text-xs">
          <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
          <span>กำลังโหลดยอดเงินสดและอัตราแลกเปลี่ยน...</span>
        </div>
      ) : accounts.length === 0 ? (
        <div className="p-8 rounded-2xl bg-[#12151C] border border-white/[0.08] text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center mx-auto text-zinc-400">
            <Wallet className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-white">ยังไม่มียอดเงินสดในบัญชี</p>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto">
            สร้างบัญชีธนาคาร/โบรกเกอร์ หรือกดสแกนภาพหน้าจอเงินสดเพื่ออัปเดตยอดคงเหลืออัตโนมัติ
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          
          {/* ── CARD 1: บัญชีของฉัน (My Cash Balances) ── */}
          <div className="lg:col-span-2 rounded-2xl bg-[#12151C] border border-white/[0.08] p-5 shadow-xl shadow-black/30 flex flex-col justify-between">
            <div>
              {/* Header */}
              <div className="flex items-center justify-between pb-3.5 border-b border-white/[0.06] mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white tracking-tight">บัญชีของฉัน</span>
                  <span className="text-[10px] text-zinc-400 font-mono">
                    ข้อมูลล่าสุด
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                  <span>อัตราแลกเปลี่ยนสด</span>
                  <Info className="w-3.5 h-3.5 text-zinc-500" />
                </div>
              </div>

              {/* Account Rows */}
              <div className="space-y-2.5">
                {accounts.map((acc) => {
                  const flag = CURRENCY_FLAGS[acc.currency.toUpperCase()] || '🌐'
                  const isTHB = acc.currency.toUpperCase() === 'THB'
                  const isUSD = acc.currency.toUpperCase() === 'USD'

                  // Distinct badge color for Dime Save, Dime USD, Dime FCD
                  let pillStyle = 'bg-white/[0.06] text-zinc-300 border-white/10'
                  if (acc.accountName.toLowerCase().includes('usd')) {
                    pillStyle = 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                  } else if (acc.accountName.toLowerCase().includes('fcd')) {
                    pillStyle = 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  } else if (acc.accountName.toLowerCase().includes('save')) {
                    pillStyle = 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                  }

                  return (
                    <div
                      key={acc.id}
                      onClick={() => openAdjust(acc, 'adjust')}
                      className="group p-3.5 rounded-xl bg-[#171A23] hover:bg-[#1C202C] border border-white/[0.06] hover:border-white/[0.12] transition-all flex items-center justify-between cursor-pointer"
                    >
                      {/* Left: Flag, Currency, Account Tag */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-lg shrink-0 shadow-inner">
                          {flag}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white font-mono">
                              {acc.currency.toUpperCase()}
                            </span>
                            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${pillStyle} truncate`}>
                              {acc.accountName}
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-400 mt-0.5 truncate">
                            {acc.accountType === 'brokerage' ? 'พอร์ตลงทุน' : 'บัญชีออมทรัพย์/เงินสด'}
                          </p>
                        </div>
                      </div>

                      {/* Right: Amount, THB Equivalent & Action Arrow */}
                      <div className="flex items-center gap-3 shrink-0 text-right">
                        <div>
                          <p className="text-sm font-bold text-white font-mono tabular-nums">
                            {formatMoney(acc.cashBalance)} {acc.currency.toUpperCase()}
                          </p>
                          {!isTHB && (
                            <p className="text-[11px] text-zinc-400 font-mono tabular-nums mt-0.5">
                              ≈ ฿{formatMoney(acc.balanceBase)}
                            </p>
                          )}
                        </div>
                        <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors" />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Bottom Multi-currency flags row */}
            <div className="pt-4 mt-4 border-t border-white/[0.06] flex items-center justify-between text-xs text-zinc-400">
              <div className="flex items-center gap-1.5 text-base">
                {['🇦🇺', '🇨🇭', '🇨🇳', '🇪🇺', '🇬🇧', '🇭🇰', '🇯🇵', '🇸🇬'].map((flag, idx) => (
                  <span key={idx} className="cursor-default hover:scale-110 transition-transform">
                    {flag}
                  </span>
                ))}
              </div>
              <button
                onClick={() => setShowAllCurrencies(!showAllCurrencies)}
                className="text-[11px] text-zinc-400 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
              >
                <span>{showAllCurrencies ? 'ซ่อนสกุลเงิน' : 'รองรับ 10+ สกุลเงิน'}</span>
                {showAllCurrencies ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            </div>
          </div>

          {/* ── CARD 2: ดอกเบี้ยสะสม (Accrued Interest) ── */}
          <div className="rounded-2xl bg-[#12151C] border border-white/[0.08] p-5 shadow-xl shadow-black/30 flex flex-col justify-between">
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/10">
                    <span className="text-xl">💰</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-white">ดอกเบี้ยสะสม</span>
                      <Info className="w-3 h-3 text-zinc-500" />
                    </div>
                    <p className="text-[11px] text-emerald-400/90 font-medium">
                      จ่ายครั้งถัดไปในอีก {nextPayoutDays} วัน
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setExpandedInterest(!expandedInterest)}
                  className="p-1 rounded-lg text-zinc-400 hover:text-white"
                >
                  {expandedInterest ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>

              {/* Big Total Accrued Interest */}
              <div className="p-4 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/20 text-center">
                <span className="text-[11px] text-zinc-400 uppercase tracking-wider font-semibold">
                  ยอดรวมดอกเบี้ยสะสมทั้งหมด
                </span>
                <p className="text-2xl font-black text-emerald-400 font-mono tracking-tight tabular-nums mt-1">
                  ≈ ฿{formatMoney(totalAccruedInterest)}
                </p>
              </div>

              {/* Sub Breakdown */}
              {expandedInterest && (
                <div className="space-y-2 pt-1">
                  <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                    แยกตามสกุลเงิน
                  </p>
                  {accounts
                    .filter((a) => a.accruedInterest > 0)
                    .map((acc) => {
                      const flag = CURRENCY_FLAGS[acc.currency.toUpperCase()] || '🌐'
                      const isTHB = acc.currency.toUpperCase() === 'THB'
                      return (
                        <div
                          key={acc.id}
                          className="flex items-center justify-between p-2.5 rounded-lg bg-[#171A23] border border-white/[0.04] text-xs font-mono"
                        >
                          <div className="flex items-center gap-2">
                            <span>{flag}</span>
                            <span className="font-semibold text-white">{acc.currency.toUpperCase()}</span>
                            <span className="text-[10px] text-zinc-400 font-sans truncate max-w-[90px]">
                              ({acc.accountName})
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-emerald-300 font-bold">
                              {formatMoney(acc.accruedInterest)} {acc.currency.toUpperCase()}
                            </span>
                            {!isTHB && (
                              <p className="text-[10px] text-zinc-400">
                                ≈ ฿{formatMoney(acc.accruedInterestBase)}
                              </p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  {accounts.filter((a) => a.accruedInterest > 0).length === 0 && (
                    <p className="text-xs text-zinc-400 text-center py-2">
                      ยังไม่มีรายการดอกเบี้ยสะสมที่บันทึก
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="pt-4 mt-4 border-t border-white/[0.06] flex items-center gap-2">
              <button
                onClick={() => accounts[0] && openAdjust(accounts[0], 'deposit')}
                className="flex-1 py-2 px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-all"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-400" />
                <span>ฝากเงิน</span>
              </button>
              <button
                onClick={() => accounts[0] && openAdjust(accounts[0], 'withdraw')}
                className="flex-1 py-2 px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-all"
              >
                <Minus className="w-3.5 h-3.5 text-rose-400" />
                <span>ถอนเงิน</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Adjust / Deposit / Withdraw Modal */}
      {adjustModalOpen && selectedAccount && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setAdjustModalOpen(false)
          }}
        >
          <div className="bg-[#12151C] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
            <div className="px-6 py-4.5 border-b border-white/[0.08] flex items-center justify-between bg-white/[0.02]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {adjustAction === 'adjust' ? 'ปรับปรุงยอดเงินสด' : adjustAction === 'deposit' ? 'ฝากเงินเข้าบัญชี' : 'ถอนเงินออกจากบัญชี'}
                  </h3>
                  <p className="text-xs text-zinc-400">
                    {selectedAccount.accountName} ({selectedAccount.currency.toUpperCase()})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAdjustModalOpen(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAdjustSubmit} className="p-6 space-y-4">
              {modalError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-2 text-xs text-rose-300">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              {/* Action Tabs */}
              <div className="grid grid-cols-3 gap-1.5 bg-[#171A23] p-1 rounded-xl border border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setAdjustAction('adjust')}
                  className={`py-1.5 text-xs font-medium rounded-lg transition-all ${
                    adjustAction === 'adjust' ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  กำหนดตรง
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustAction('deposit')}
                  className={`py-1.5 text-xs font-medium rounded-lg transition-all ${
                    adjustAction === 'deposit' ? 'bg-emerald-600 text-white' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  + ฝากเงิน
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustAction('withdraw')}
                  className={`py-1.5 text-xs font-medium rounded-lg transition-all ${
                    adjustAction === 'withdraw' ? 'bg-rose-600 text-white' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  - ถอนเงิน
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  {adjustAction === 'adjust' ? 'ยอดเงินสดคงเหลือปัจจุบัน' : 'จำนวนเงินที่ต้องการทำรายการ'} ({selectedAccount.currency.toUpperCase()}) *
                </label>
                <input
                  type="number"
                  step="any"
                  className="w-full bg-[#171A23] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-indigo-500"
                  placeholder="0.00"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              {adjustAction === 'adjust' && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                      ดอกเบี้ยสะสม ({selectedAccount.currency.toUpperCase()})
                    </label>
                    <input
                      type="number"
                      step="any"
                      className="w-full bg-[#171A23] border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono"
                      placeholder="0.00"
                      value={adjustInterest}
                      onChange={(e) => setAdjustInterest(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                      วันที่เหลือจ่ายดอกเบี้ย (วัน)
                    </label>
                    <input
                      type="number"
                      className="w-full bg-[#171A23] border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono"
                      placeholder="104"
                      value={adjustDays}
                      onChange={(e) => setAdjustDays(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div className="pt-3 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setAdjustModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs text-zinc-400 hover:text-white"
                  disabled={submitting}
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-indigo-600/25"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>กำลังบันทึก...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>บันทึกยอดเงินสด</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
