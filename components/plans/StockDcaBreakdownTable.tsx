'use client'

import React from 'react'
import { StockLogo } from '@/components/StockLogo'
import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Zap,
  ShieldCheck,
  TrendingUp,
  DollarSign,
  Plus,
  Coins,
} from 'lucide-react'
import { StockDcaAllocationItem, StockDcaBreakdownResult } from '@/lib/analytics/rebalancing'

interface StockDcaBreakdownTableProps {
  planResult: StockDcaBreakdownResult
  onQuickBuy: (ticker: string, amount: number, market?: string) => void
  baseCurrency?: string
}

export function StockDcaBreakdownTable({
  planResult,
  onQuickBuy,
  baseCurrency = 'THB',
}: StockDcaBreakdownTableProps) {
  const { totalInflow, totalAllocated, unallocatedCash, allocatedCount, items } = planResult

  return (
    <div className="space-y-4">
      {/* ── KPI HIGHLIGHTS FOR STOCK DCA ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-2xl bg-[#0F131C] border border-white/[0.08] flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              งบเติม DCA งวดนี้
            </span>
            <p className="text-xl font-black text-white font-mono mt-0.5">
              ฿{totalInflow.toLocaleString()}
            </p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold">
            <Zap className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-[#0F131C] border border-emerald-500/20 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">
              จัดสรรซื้อหุ้นแล้ว ({allocatedCount} ตัว)
            </span>
            <p className="text-xl font-black text-emerald-400 font-mono mt-0.5">
              ฿{totalAllocated.toLocaleString()}
            </p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold">
            <Coins className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-[#0F131C] border border-white/[0.08] flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              เงินสดคงเหลือพักไว้
            </span>
            <p className="text-xl font-black text-cyan-300 font-mono mt-0.5">
              ฿{unallocatedCash.toLocaleString()}
            </p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold">
            <ShieldCheck className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* ── RESPONSIVE TABLE ── */}
      <div className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-[#0C0F14] shadow-2xl">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="border-b-2 border-white/[0.08] text-slate-300 font-bold uppercase text-xs tracking-wider bg-white/[0.03]">
              <th className="py-3.5 px-4 min-w-[200px]">หุ้น / สินทรัพย์</th>
              <th className="py-3.5 px-3 min-w-[140px]">สังกัดตะกร้า</th>
              <th className="py-3.5 px-3 text-right min-w-[110px]">สัดส่วนเดิม</th>
              <th className="py-3.5 px-3 text-right min-w-[100px]">เป้าหมาย</th>
              <th className="py-3.5 px-3 text-center min-w-[120px]">สถานะ</th>
              <th className="py-3.5 px-4 text-right min-w-[160px] bg-emerald-950/20 border-x border-emerald-500/20 text-emerald-300">
                ⭐ เงิน DCA ที่จัดสรร (฿)
              </th>
              <th className="py-3.5 px-3 text-right min-w-[110px]">จำนวนหุ้นที่ได้</th>
              <th className="py-3.5 px-3 text-right min-w-[110px]">สัดส่วนใหม่</th>
              <th className="py-3.5 px-4 text-center min-w-[120px]">ดำเนินการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.05] font-mono text-xs">
            {items.map((item) => {
              const isFunded = item.allocatedAmountBase > 0
              const isUsd = item.currency === 'USD'

              return (
                <tr
                  key={item.id}
                  className={`transition-colors ${
                    isFunded
                      ? 'bg-emerald-500/[0.04] hover:bg-emerald-500/[0.08]'
                      : 'hover:bg-white/[0.02]'
                  }`}
                >
                  {/* Ticker & Logo */}
                  <td className="py-3 px-4 font-sans">
                    <div className="flex items-center gap-2.5">
                      <StockLogo ticker={item.ticker} name={item.assetName} size={32} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-extrabold text-white text-sm font-mono">
                            {item.ticker}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/[0.06] text-slate-400 font-mono">
                            {item.market}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 truncate max-w-[140px]">
                          {item.assetName}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Strategy Bucket */}
                  <td className="py-3 px-3 font-sans">
                    {item.bucketName ? (
                      <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-lg bg-white/[0.04] text-slate-300 border border-white/[0.06]">
                        <span>{item.bucketEmoji}</span>
                        <span className="truncate max-w-[110px]">{item.bucketName}</span>
                      </span>
                    ) : (
                      <span className="text-slate-500 text-[11px]">—</span>
                    )}
                  </td>

                  {/* Current Weight */}
                  <td className="py-3 px-3 text-right text-slate-300 font-bold">
                    <div>{item.currentWeight.toFixed(1)}%</div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      ฿{Math.round(item.currentValueBase).toLocaleString()}
                    </div>
                  </td>

                  {/* Target Weight */}
                  <td className="py-3 px-3 text-right font-black text-white">
                    {item.targetWeight.toFixed(1)}%
                  </td>

                  {/* Status Badge */}
                  <td className="py-3 px-3 text-center font-sans">
                    {item.status === 'UNDERWEIGHT' ? (
                      <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        <ArrowDownRight className="w-3 h-3" /> ขาดเป้า ({item.driftPercent}%)
                      </span>
                    ) : item.status === 'OVERWEIGHT' ? (
                      <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-bold bg-amber-500/15 text-amber-300 border border-amber-500/25">
                        <ArrowUpRight className="w-3 h-3" /> เกินเป้า (+{item.driftPercent}%)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/25">
                        <CheckCircle2 className="w-3 h-3" /> สมดุล
                      </span>
                    )}
                  </td>

                  {/* Allocated Amount (Highlighted) */}
                  <td className="py-3 px-4 text-right bg-emerald-950/10 border-x border-emerald-500/15">
                    {item.allocatedAmountBase > 0 ? (
                      <div>
                        <span className="font-black text-emerald-400 text-base">
                          ฿{item.allocatedAmountBase.toLocaleString()}
                        </span>
                        {isUsd && (
                          <div className="text-[10px] text-emerald-300/80 font-mono">
                            ~${(item.allocatedAmountBase / (item.currentPriceBase / item.currentPrice || 33.5)).toFixed(2)}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-500 font-sans text-xs">ชะลอเติมงวดนี้</span>
                    )}
                  </td>

                  {/* Estimated Shares */}
                  <td className="py-3 px-3 text-right">
                    {item.estimatedShares > 0 ? (
                      <div>
                        <span className="text-white font-bold">
                          ~{item.estimatedShares.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span className="text-[10px] text-slate-400 block font-sans">หุ้น</span>
                      </div>
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </td>

                  {/* Post Weight */}
                  <td className="py-3 px-3 text-right font-black text-indigo-300">
                    {item.postWeight.toFixed(1)}%
                  </td>

                  {/* Quick Action Button */}
                  <td className="py-3 px-4 text-center font-sans">
                    {item.allocatedAmountBase > 0 ? (
                      <button
                        type="button"
                        onClick={() => onQuickBuy(item.ticker, item.allocatedAmountBase, item.market)}
                        className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs transition-all cursor-pointer shadow-md shadow-emerald-900/30 active:scale-95 flex items-center justify-center gap-1 mx-auto"
                      >
                        <Plus className="w-3 h-3" />
                        <span>ซื้อ {item.ticker}</span>
                      </button>
                    ) : (
                      <span className="text-slate-500 text-xs">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0" />
        <span>
          💡 <strong>หลักการคำนวณ:</strong> ระบบจะนำเงินออม DCA ประจำเดือนไปเติมให้กับหุ้นที่สัดส่วนปัจจุบันต่ำกว่าเป้าหมาย (Underweight) ก่อนเป็นอันดับแรก เพื่อดึงพอร์ตให้กลับสู่สมดุลโดยไม่ต้องขายหุ้นตัวอื่นออก
        </span>
      </div>
    </div>
  )
}
