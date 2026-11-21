'use client'

import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, TrendingUp, TrendingDown } from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts'
import type {
  DailyAnalyticsPoint,
  PnLBreakdownSummary,
  YearlyReturnMatrixRow,
} from '@/lib/analytics/portfolio-analytics-math'

interface PnLBreakdownPanelProps {
  pnlBreakdown: PnLBreakdownSummary
  matrix: YearlyReturnMatrixRow[]
  series: DailyAnalyticsPoint[]
  baseCurrency?: string
  hideAmounts?: boolean
}

const THAI_SHORT_MONTHS = [
  'ม.ค.',
  'ก.พ.',
  'มี.ค.',
  'เม.ย.',
  'พ.ค.',
  'มิ.ย.',
  'ก.ค.',
  'ส.ค.',
  'ก.ย.',
  'ต.ค.',
  'พ.ย.',
  'ธ.ค.',
]

function formatMoney(val: number, sym: string, hide?: boolean, signed = true): string {
  if (hide) return `${sym}••••••`
  const sign = val < 0 ? '-' : signed && val > 0 ? '+' : ''
  return `${sign}${sym}${Math.abs(val).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function PnLBreakdownPanel({
  pnlBreakdown,
  matrix,
  baseCurrency = 'THB',
  hideAmounts = false,
}: PnLBreakdownPanelProps) {
  const [periodScope, setPeriodScope] = useState<'monthly' | 'yearly'>('monthly')
  const sym = baseCurrency.toUpperCase() === 'USD' ? '$' : '฿'

  const chartData = useMemo(() => {
    if (periodScope === 'yearly') {
      return [...matrix]
        .sort((a, b) => a.year - b.year)
        .map((row) => ({
          label: String(row.year),
          gain: Math.round(row.annualGainBase),
          returnPct: row.annualReturnPct ?? 0,
        }))
    }

    const monthlyItems: Array<{ label: string; sortKey: string; gain: number; returnPct: number }> = []
    for (const row of matrix) {
      for (let m = 1; m <= 12; m++) {
        const cell = row.months[m]
        if (cell && cell.gainBase !== null) {
          monthlyItems.push({
            sortKey: cell.monthKey,
            label: `${THAI_SHORT_MONTHS[m - 1]} ${String(row.year).slice(-2)}`,
            gain: Math.round(cell.gainBase),
            returnPct: cell.returnPct ?? 0,
          })
        }
      }
    }
    return monthlyItems.sort((a, b) => a.sortKey.localeCompare(b.sortKey))
  }, [matrix, periodScope])

  const components = [
    {
      label: 'กำไรทางบัญชี (Unrealized)',
      value: pnlBreakdown.unrealizedPnLBase,
      desc: 'ส่วนต่างราคาตลาดของหุ้นที่ยังถืออยู่',
    },
    {
      label: 'กำไรที่ขายแล้ว (Realized)',
      value: pnlBreakdown.realizedPnLBase,
      desc: 'ผลต่างจากการปิดสถานะขายแบบ FIFO',
    },
    {
      label: 'เงินปันผลรับ (Dividends)',
      value: pnlBreakdown.dividendsBase,
      desc: 'กระแสเงินสดปันผลสะสมสุทธิ',
    },
    {
      label: 'ค่าธรรมเนียม & ภาษี (Fees & Tax)',
      value: -Math.abs(pnlBreakdown.feesAndTaxBase),
      desc: 'ค่าคอมมิชชันและภาษีหัก ณ ที่จ่าย',
    },
  ]

  const isNetProfit = pnlBreakdown.totalNetPnLBase >= 0

  return (
    <div className="space-y-5">
      {/* 4-Part P&L Composition Strip */}
      <div className="rounded-2xl bg-[#12151C] border border-white/[0.08] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/[0.08]">
          <div>
            <h3 className="text-sm font-bold text-[#F4F6F8]">
              โครงสร้างกำไร/ขาดทุนสุทธิ (Total Net P&amp;L Breakdown)
            </h3>
            <p className="text-xs text-[#9AA4B2] mt-0.5">
              Unrealized + Realized + Dividends − Fees &amp; Tax = Total Net Gain
            </p>
          </div>
          <div className="text-right">
            <span className="text-[11px] uppercase tracking-wider text-[#9AA4B2] block">
              กำไรสุทธิรวม
            </span>
            <span
              className={`text-xl font-bold font-mono tabular-nums ${
                isNetProfit ? 'text-[#20C997]' : 'text-[#F05D73]'
              }`}
            >
              {formatMoney(pnlBreakdown.totalNetPnLBase, sym, hideAmounts)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {components.map((c) => {
            const positive = c.value >= 0
            return (
              <div
                key={c.label}
                className="rounded-xl bg-[#181C25] border border-white/[0.06] p-3.5 flex flex-col justify-between"
              >
                <span className="text-xs font-medium text-[#9AA4B2]">{c.label}</span>
                <p
                  className={`text-lg font-bold font-mono tabular-nums mt-1.5 ${
                    c.value === 0
                      ? 'text-[#F4F6F8]'
                      : positive
                      ? 'text-[#20C997]'
                      : 'text-[#F05D73]'
                  }`}
                >
                  {formatMoney(c.value, sym, hideAmounts)}
                </p>
                <span className="text-[11px] text-[#9AA4B2] mt-1">{c.desc}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Period Gain / Loss Bar Chart */}
      <div className="rounded-2xl bg-[#12151C] border border-white/[0.08] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-bold text-[#F4F6F8]">
              กำไร/ขาดทุนตามรอบเวลา ({periodScope === 'monthly' ? 'รายเดือน' : 'รายปี'})
            </h3>
            <p className="text-xs text-[#9AA4B2] mt-0.5">
              แสดงส่วนต่างมูลค่าที่เกิดจากผลตอบแทนจริงของพอร์ต (หักเงินฝาก-ถอนแล้ว)
            </p>
          </div>
          <div className="inline-flex p-1 rounded-xl bg-[#090B10] border border-white/[0.08] text-xs font-semibold">
            <button
              type="button"
              onClick={() => setPeriodScope('monthly')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                periodScope === 'monthly'
                  ? 'bg-[#6D5EF7] text-white'
                  : 'text-[#9AA4B2] hover:text-white'
              }`}
            >
              รายเดือน
            </button>
            <button
              type="button"
              onClick={() => setPeriodScope('yearly')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                periodScope === 'yearly'
                  ? 'bg-[#6D5EF7] text-white'
                  : 'text-[#9AA4B2] hover:text-white'
              }`}
            >
              รายปี
            </button>
          </div>
        </div>

        {chartData.length > 0 ? (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 12, left: 6, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke="#9AA4B2"
                  tick={{ fontSize: 11, fill: '#9AA4B2' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#9AA4B2"
                  tick={{ fontSize: 11, fill: '#9AA4B2' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) =>
                    hideAmounts
                      ? `${sym}••`
                      : `${v < 0 ? '-' : ''}${sym}${Math.abs(Number(v)) >= 1000 ? `${(Math.abs(Number(v)) / 1000).toFixed(0)}k` : Math.abs(Number(v))}`
                  }
                />
                <ReferenceLine y={0} stroke="rgba(255,255,255,0.22)" />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null
                    const item = payload[0].payload
                    const pos = item.gain >= 0
                    return (
                      <div className="rounded-xl bg-[#181C25] border border-white/[0.12] px-3.5 py-2.5 text-xs shadow-xl space-y-1">
                        <p className="font-semibold text-[#F4F6F8]">{item.label}</p>
                        <p className={`font-mono font-bold tabular-nums ${pos ? 'text-[#20C997]' : 'text-[#F05D73]'}`}>
                          {formatMoney(item.gain, sym, hideAmounts)} ({item.returnPct >= 0 ? '+' : ''}
                          {item.returnPct.toFixed(2)}%)
                        </p>
                      </div>
                    )
                  }}
                />
                <Bar dataKey="gain" maxBarSize={42} radius={[4, 4, 4, 4]}>
                  {chartData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.gain >= 0 ? '#20C997' : '#F05D73'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="py-12 text-center text-xs text-[#9AA4B2]">
            ยังไม่มีข้อมูลกำไร/ขาดทุนตามช่วงเวลา
          </div>
        )}
      </div>

      {/* Top 5 Contributors & Top 5 Detractors */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Contributors */}
        <div className="rounded-2xl bg-[#12151C] border border-white/[0.08] p-5 space-y-3">
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/[0.08]">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#20C997]" />
              <h4 className="text-sm font-bold text-[#F4F6F8]">5 สินทรัพย์ทำกำไรสูงสุด</h4>
            </div>
            <Link
              href="/performance"
              className="text-xs font-semibold text-[#6D5EF7] hover:underline flex items-center gap-1"
            >
              <span>ดูรายละเอียด FIFO รายหุ้น</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {pnlBreakdown.topContributors.length > 0 ? (
            <div className="space-y-2">
              {pnlBreakdown.topContributors.map((item) => (
                <div
                  key={item.assetId}
                  className="flex items-center justify-between gap-3 rounded-xl bg-[#181C25] border border-white/[0.05] px-3.5 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-[#F4F6F8]">
                        {item.ticker}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] text-[#9AA4B2]">
                        {item.market}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#9AA4B2] truncate mt-0.5">{item.assetName}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold font-mono tabular-nums text-[#20C997]">
                      {formatMoney(item.netPnLBase, sym, hideAmounts)}
                    </p>
                    <p className="text-[10px] font-mono text-[#9AA4B2]">
                      Unreal {formatMoney(item.unrealizedPnLBase, sym, hideAmounts)} • Real{' '}
                      {formatMoney(item.realizedPnLBase, sym, hideAmounts)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-6 text-center text-xs text-[#9AA4B2]">ยังไม่มีสินทรัพย์ที่มีกำไรสุทธิ</p>
          )}
        </div>

        {/* Detractors */}
        <div className="rounded-2xl bg-[#12151C] border border-white/[0.08] p-5 space-y-3">
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/[0.08]">
            <div className="flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-[#F05D73]" />
              <h4 className="text-sm font-bold text-[#F4F6F8]">5 สินทรัพย์ฉุดพอร์ตมากสุด</h4>
            </div>
            <Link
              href="/performance"
              className="text-xs font-semibold text-[#6D5EF7] hover:underline flex items-center gap-1"
            >
              <span>ดูรายละเอียด FIFO รายหุ้น</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {pnlBreakdown.topDetractors.length > 0 ? (
            <div className="space-y-2">
              {pnlBreakdown.topDetractors.map((item) => (
                <div
                  key={item.assetId}
                  className="flex items-center justify-between gap-3 rounded-xl bg-[#181C25] border border-white/[0.05] px-3.5 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-[#F4F6F8]">
                        {item.ticker}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] text-[#9AA4B2]">
                        {item.market}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#9AA4B2] truncate mt-0.5">{item.assetName}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold font-mono tabular-nums text-[#F05D73]">
                      {formatMoney(item.netPnLBase, sym, hideAmounts)}
                    </p>
                    <p className="text-[10px] font-mono text-[#9AA4B2]">
                      Unreal {formatMoney(item.unrealizedPnLBase, sym, hideAmounts)} • Real{' '}
                      {formatMoney(item.realizedPnLBase, sym, hideAmounts)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-6 text-center text-xs text-[#9AA4B2]">
              ยังไม่มีสินทรัพย์ที่ขาดทุนสุทธิในพอร์ต
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
