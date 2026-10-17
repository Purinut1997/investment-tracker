'use client'

import React from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from 'recharts'
import { YearDividendSummary } from '@/lib/dividends/dividend-analyzer'

interface DividendHistoryChartProps {
  years: YearDividendSummary[]
  currency: string
  height?: number
}

export function DividendHistoryChart({
  years,
  currency,
  height = 180,
}: DividendHistoryChartProps) {
  if (!years || years.length === 0) {
    return (
      <div className="h-32 flex items-center justify-center text-xs text-slate-500 bg-[#0E121B] rounded-xl border border-white/[0.06]">
        ไม่มีข้อมูลประวัติปันผลย้อนหลัง
      </div>
    )
  }

  const chartData = years.map((y) => ({
    year: String(y.year),
    total: y.totalAmount,
    payoutCount: y.payoutCount,
    growth: y.growthRatePercent,
  }))

  const maxTotal = Math.max(...chartData.map((d) => d.total), 1)

  return (
    <div className="w-full space-y-2">
      <div className="h-[180px] w-full">
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={chartData} margin={{ top: 12, right: 10, left: -20, bottom: 0 }}>
            <XAxis
              dataKey="year"
              stroke="#64748b"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
            />
            <YAxis
              stroke="#64748b"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}`}
              domain={[0, Math.ceil(maxTotal * 1.15)]}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload
                  return (
                    <div className="bg-[#121622] border border-white/10 rounded-xl p-2.5 shadow-xl text-xs space-y-1">
                      <div className="font-bold text-white flex items-center justify-between gap-3">
                        <span>ปี {data.year}</span>
                        <span className="text-[10px] text-indigo-300 font-normal">
                          {data.payoutCount} ครั้ง
                        </span>
                      </div>
                      <div className="text-emerald-400 font-mono font-bold text-sm">
                        {data.total.toFixed(2)} {currency}
                      </div>
                      {data.growth !== undefined && (
                        <div
                          className={`text-[10px] font-semibold flex items-center gap-1 ${
                            data.growth >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          <span>{data.growth >= 0 ? '▲ +' : '▼ '}</span>
                          <span>{data.growth}% เทียบปีก่อนหน้า</span>
                        </div>
                      )}
                    </div>
                  )
                }
                return null
              }}
            />
            <Bar dataKey="total" radius={[6, 6, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={index === chartData.length - 1 ? '#10b981' : '#6366f1'}
                  fillOpacity={0.85}
                  className="hover:opacity-100 transition-opacity"
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Year-by-year summary pills below the chart */}
      <div className="grid grid-cols-5 gap-1.5 pt-1">
        {chartData.map((d) => (
          <div
            key={d.year}
            className="p-1.5 rounded-lg bg-[#0E121B] border border-white/[0.04] text-center"
          >
            <div className="text-[10px] text-slate-400 font-mono">{d.year}</div>
            <div className="text-xs font-bold text-white font-mono mt-0.5 truncate">
              {d.total > 0 ? d.total.toFixed(2) : '-'}
            </div>
            {d.growth !== undefined && (
              <div
                className={`text-[9px] font-bold ${
                  d.growth >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {d.growth >= 0 ? `+${d.growth}%` : `${d.growth}%`}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
