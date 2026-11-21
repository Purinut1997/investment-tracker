'use client'

import React, { useMemo, useState } from 'react'
import type { YearlyReturnMatrixRow } from '@/lib/analytics/portfolio-analytics-math'

interface GainsReturnsPanelProps {
  matrix: YearlyReturnMatrixRow[]
  benchmarkLabel: string
  baseCurrency?: string
  hideAmounts?: boolean
}

const MONTH_LABELS = [
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

function getHeatmapBg(pct: number | null): string {
  if (pct === null || Math.abs(pct) < 0.05) return 'transparent'
  const intensity = Math.min(0.32, Math.max(0.08, Math.abs(pct) / 22))
  return pct > 0
    ? `rgba(32, 201, 151, ${intensity.toFixed(2)})`
    : `rgba(240, 93, 115, ${intensity.toFixed(2)})`
}

function formatCompactGain(val: number | null, sym: string, hide?: boolean): string {
  if (val === null) return '—'
  if (hide) return `${sym}•••`
  const sign = val > 0 ? '+' : val < 0 ? '-' : ''
  const abs = Math.abs(val)
  if (abs >= 1_000_000) return `${sign}${sym}${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 10_000) return `${sign}${sym}${(abs / 1_000).toFixed(1)}k`
  return `${sign}${sym}${abs.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

export function GainsReturnsPanel({
  matrix,
  benchmarkLabel,
  baseCurrency = 'THB',
  hideAmounts = false,
}: GainsReturnsPanelProps) {
  const [unit, setUnit] = useState<'pct' | 'amount'>('pct')
  const sym = baseCurrency.toUpperCase() === 'USD' ? '$' : '฿'

  const monthAverages = useMemo(() => {
    const out: Record<number, number | null> = {}
    for (let m = 1; m <= 12; m++) {
      let sum = 0
      let count = 0
      for (const row of matrix) {
        const c = row.months[m]
        if (c && c.returnPct !== null) {
          sum += c.returnPct
          count++
        }
      }
      out[m] = count > 0 ? Number((sum / count).toFixed(2)) : null
    }
    return out
  }, [matrix])

  return (
    <div className="rounded-2xl bg-[#12151C] border border-white/[0.08] p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-[#F4F6F8]">
            ตารางผลตอบแทนรายเดือนและรายปี (Monthly &amp; Annual Returns Matrix)
          </h3>
          <p className="text-xs text-[#9AA4B2] mt-0.5">
            คำนวณผลตอบแทนรายเดือนแบบ Time-Weighted (TWR) เทียบกับ {benchmarkLabel}
          </p>
        </div>

        <div className="inline-flex p-1 rounded-xl bg-[#090B10] border border-white/[0.08] text-xs font-semibold">
          <button
            type="button"
            onClick={() => setUnit('pct')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              unit === 'pct' ? 'bg-[#6D5EF7] text-white' : 'text-[#9AA4B2] hover:text-white'
            }`}
          >
            เปอร์เซ็นต์ (%)
          </button>
          <button
            type="button"
            onClick={() => setUnit('amount')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              unit === 'amount' ? 'bg-[#6D5EF7] text-white' : 'text-[#9AA4B2] hover:text-white'
            }`}
          >
            จำนวนเงิน ({sym})
          </button>
        </div>
      </div>

      {matrix.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-white/[0.08]">
          <table className="w-full border-collapse text-xs font-mono tabular-nums">
            <thead>
              <tr className="bg-[#090B10] text-[#9AA4B2] border-b border-white/[0.08]">
                <th className="sticky left-0 z-10 bg-[#090B10] px-3 py-2.5 text-left font-semibold">
                  ปี
                </th>
                {MONTH_LABELS.map((lbl) => (
                  <th key={lbl} className="px-2.5 py-2.5 text-right font-semibold min-w-[66px]">
                    {lbl}
                  </th>
                ))}
                <th className="px-3 py-2.5 text-right font-semibold text-[#F4F6F8] border-l border-white/[0.08] min-w-[78px]">
                  พอร์ตทั้งปี
                </th>
                <th className="px-3 py-2.5 text-right font-semibold min-w-[78px]">
                  {benchmarkLabel}
                </th>
                <th className="px-3 py-2.5 text-right font-semibold min-w-[72px]">Alpha</th>
              </tr>
            </thead>
            <tbody>
              {matrix.map((row) => (
                <tr key={row.year} className="border-b border-white/[0.05] hover:bg-white/[0.02]">
                  <td className="sticky left-0 z-10 bg-[#12151C] px-3 py-2.5 font-bold text-[#F4F6F8]">
                    {row.year}
                  </td>

                  {MONTH_LABELS.map((_, idx) => {
                    const m = idx + 1
                    const cell = row.months[m]
                    if (!cell || cell.returnPct === null) {
                      return (
                        <td key={m} className="px-2.5 py-2.5 text-right text-[#64748B]">
                          —
                        </td>
                      )
                    }
                    const isPos = cell.returnPct >= 0
                    const textVal =
                      unit === 'pct'
                        ? `${cell.returnPct > 0 ? '+' : ''}${cell.returnPct.toFixed(1)}%`
                        : formatCompactGain(cell.gainBase, sym, hideAmounts)

                    const tooltipText = `${cell.monthKey}: TWR ${
                      cell.returnPct > 0 ? '+' : ''
                    }${cell.returnPct.toFixed(2)}% | กำไร ${formatCompactGain(
                      cell.gainBase,
                      sym,
                      hideAmounts
                    )}${
                      cell.benchReturnPct !== null
                        ? ` | ${benchmarkLabel} ${
                            cell.benchReturnPct > 0 ? '+' : ''
                          }${cell.benchReturnPct.toFixed(2)}%`
                        : ''
                    }`

                    return (
                      <td
                        key={m}
                        title={tooltipText}
                        style={{ backgroundColor: getHeatmapBg(cell.returnPct) }}
                        className={`px-2.5 py-2.5 text-right font-semibold transition-colors ${
                          Math.abs(cell.returnPct) < 0.05
                            ? 'text-[#9AA4B2]'
                            : isPos
                            ? 'text-[#20C997]'
                            : 'text-[#F05D73]'
                        }`}
                      >
                        {textVal}
                      </td>
                    )
                  })}

                  {/* Annual Portfolio */}
                  <td
                    className={`px-3 py-2.5 text-right font-bold border-l border-white/[0.08] ${
                      (row.annualReturnPct ?? 0) >= 0 ? 'text-[#20C997]' : 'text-[#F05D73]'
                    }`}
                  >
                    {unit === 'pct'
                      ? row.annualReturnPct !== null
                        ? `${row.annualReturnPct > 0 ? '+' : ''}${row.annualReturnPct.toFixed(2)}%`
                        : '—'
                      : formatCompactGain(row.annualGainBase, sym, hideAmounts)}
                  </td>

                  {/* Annual Benchmark */}
                  <td
                    className={`px-3 py-2.5 text-right font-semibold ${
                      (row.annualBenchReturnPct ?? 0) >= 0 ? 'text-[#20C997]' : 'text-[#F05D73]'
                    }`}
                  >
                    {row.annualBenchReturnPct !== null
                      ? `${row.annualBenchReturnPct > 0 ? '+' : ''}${row.annualBenchReturnPct.toFixed(2)}%`
                      : '—'}
                  </td>

                  {/* Annual Alpha */}
                  <td
                    className={`px-3 py-2.5 text-right font-bold ${
                      (row.annualAlphaPct ?? 0) >= 0 ? 'text-[#20C997]' : 'text-[#F05D73]'
                    }`}
                  >
                    {row.annualAlphaPct !== null
                      ? `${row.annualAlphaPct > 0 ? '+' : ''}${row.annualAlphaPct.toFixed(2)}%`
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>

            <tfoot>
              <tr className="bg-[#090B10]/80 border-t border-white/[0.08] text-[11px]">
                <td className="sticky left-0 z-10 bg-[#090B10] px-3 py-2 font-semibold text-[#9AA4B2]">
                  เฉลี่ย
                </td>
                {MONTH_LABELS.map((_, idx) => {
                  const avg = monthAverages[idx + 1]
                  return (
                    <td
                      key={idx}
                      className={`px-2.5 py-2 text-right font-semibold ${
                        avg === null
                          ? 'text-[#64748B]'
                          : avg >= 0
                          ? 'text-[#20C997]'
                          : 'text-[#F05D73]'
                      }`}
                    >
                      {avg === null ? '—' : `${avg > 0 ? '+' : ''}${avg.toFixed(1)}%`}
                    </td>
                  )
                })}
                <td colSpan={3} className="px-3 py-2 text-right text-[#9AA4B2]">
                  อัตราผลตอบแทนทบต้นตามเดือนปฏิทิน
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className="py-12 text-center text-xs text-[#9AA4B2]">
          ยังไม่มีข้อมูลสำหรับตารางผลตอบแทนรายเดือน
        </div>
      )}
    </div>
  )
}
