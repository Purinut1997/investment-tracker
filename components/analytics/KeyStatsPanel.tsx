'use client'

import React from 'react'
import { TrendingUp, ShieldAlert, CalendarCheck, HelpCircle } from 'lucide-react'
import type { KeyStatsResult } from '@/lib/analytics/portfolio-analytics-math'

interface KeyStatsPanelProps {
  stats: KeyStatsResult
  benchmarkLabel: string
  baseCurrency?: string
  hideAmounts?: boolean
  startDate: string
  endDate: string
}

function formatMoney(val: number, symbol: string, hide?: boolean): string {
  if (hide) return `${symbol}••••••`
  const sign = val < 0 ? '-' : val > 0 ? '+' : ''
  return `${sign}${symbol}${Math.abs(val).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function formatSignedPct(val: number | null): string {
  if (val === null || !Number.isFinite(val)) return 'N/A'
  return `${val > 0 ? '+' : ''}${val.toFixed(2)}%`
}

function MetricRow({
  label,
  subLabel,
  value,
  tone = 'neutral',
  tooltip,
}: {
  label: string
  subLabel?: string
  value: string
  tone?: 'positive' | 'negative' | 'neutral'
  tooltip?: string
}) {
  const colorClass =
    tone === 'positive'
      ? 'text-[#20C997]'
      : tone === 'negative'
      ? 'text-[#F05D73]'
      : 'text-[#F4F6F8]'

  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-white/[0.06] last:border-b-0">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-[#F4F6F8]">{label}</span>
          {tooltip && (
            <span title={tooltip} className="text-[#9AA4B2] hover:text-white cursor-help">
              <HelpCircle className="w-3 h-3" />
            </span>
          )}
        </div>
        {subLabel && <p className="text-[11px] text-[#9AA4B2] mt-0.5 truncate">{subLabel}</p>}
      </div>
      <span className={`text-xs sm:text-sm font-bold font-mono tabular-nums shrink-0 ${colorClass}`}>
        {value}
      </span>
    </div>
  )
}

export function KeyStatsPanel({
  stats,
  benchmarkLabel,
  baseCurrency = 'THB',
  hideAmounts = false,
  startDate,
  endDate,
}: KeyStatsPanelProps) {
  const sym = baseCurrency.toUpperCase() === 'USD' ? '$' : '฿'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#9AA4B2]">
        <span>
          สถิติเชิงลึกคำนวณจากข้อมูลรายวันช่วง{' '}
          <strong className="text-[#F4F6F8] font-mono">
            {startDate} → {endDate}
          </strong>{' '}
          ({stats.daysMeasured.toLocaleString()} วัน)
        </span>
        <span className="font-mono text-[11px]">
          Benchmark: <strong className="text-[#F4F6F8]">{benchmarkLabel}</strong>
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Panel 1: Returns */}
        <section className="rounded-2xl bg-[#12151C] border border-white/[0.08] p-5">
          <div className="flex items-center gap-2 pb-3 mb-2 border-b border-white/[0.08]">
            <div className="w-7 h-7 rounded-lg bg-[#6D5EF7]/15 text-[#6D5EF7] flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#F4F6F8]">ผลตอบแทน (Returns)</h3>
              <p className="text-[11px] text-[#9AA4B2]">วัดฝีมือและกระแสเงินสดเทียบตลาด</p>
            </div>
          </div>

          <MetricRow
            label="Time-Weighted Return (TWR)"
            subLabel="ผลตอบแทนไม่รวมผลของการเติม-ถอนเงิน"
            value={formatSignedPct(stats.twrPercent)}
            tone={stats.twrPercent >= 0 ? 'positive' : 'negative'}
            tooltip="วัดฝีมือการจัดพอร์ตโดยตัดผลกระทบจากการฝาก-ถอนเงินระหว่างทาง"
          />
          <MetricRow
            label="CAGR (ทบต้นเฉลี่ยต่อปี)"
            subLabel={stats.cagrPercent === null ? 'ต้องมีข้อมูลอย่างน้อย 30 วัน' : 'Annualized TWR'}
            value={stats.cagrPercent === null ? 'N/A (<30 วัน)' : formatSignedPct(stats.cagrPercent)}
            tone={
              stats.cagrPercent === null
                ? 'neutral'
                : stats.cagrPercent >= 0
                ? 'positive'
                : 'negative'
            }
          />
          <MetricRow
            label="Money-Weighted (MWR)"
            subLabel="Modified Dietz ตามจังหวะเงินเข้าออก"
            value={formatSignedPct(stats.mwrPercent)}
            tone={stats.mwrPercent >= 0 ? 'positive' : 'negative'}
          />
          <MetricRow
            label="XIRR (Annualized MWR)"
            subLabel="ผลตอบแทนทบต้นต่อปีของเงินจริง"
            value={stats.xirrPercent === null ? 'N/A' : formatSignedPct(stats.xirrPercent)}
            tone={
              stats.xirrPercent === null
                ? 'neutral'
                : stats.xirrPercent >= 0
                ? 'positive'
                : 'negative'
            }
          />
          <MetricRow
            label="Simple Return (SR)"
            subLabel="กำไรสุทธิเทียบต้นทุนรวมในช่วงเวลา"
            value={formatSignedPct(stats.srPercent)}
            tone={stats.srPercent >= 0 ? 'positive' : 'negative'}
          />
          <MetricRow
            label={`${benchmarkLabel} (TWR)`}
            subLabel={`MWR เทียบ: ${formatSignedPct(stats.benchmarkMwrPercent)}`}
            value={formatSignedPct(stats.benchmarkTwrPercent)}
            tone={stats.benchmarkTwrPercent >= 0 ? 'positive' : 'negative'}
          />
          <MetricRow
            label="Active Alpha vs Benchmark"
            subLabel={`TWR Alpha (MWR Alpha: ${formatSignedPct(stats.alphaMwrPercent)})`}
            value={formatSignedPct(stats.alphaTwrPercent)}
            tone={stats.alphaTwrPercent >= 0 ? 'positive' : 'negative'}
          />
        </section>

        {/* Panel 2: Risk & Efficiency */}
        <section className="rounded-2xl bg-[#12151C] border border-white/[0.08] p-5">
          <div className="flex items-center gap-2 pb-3 mb-2 border-b border-white/[0.08]">
            <div className="w-7 h-7 rounded-lg bg-[#F05D73]/15 text-[#F05D73] flex items-center justify-center">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#F4F6F8]">ความเสี่ยง (Risk & Efficiency)</h3>
              <p className="text-[11px] text-[#9AA4B2]">การเหวี่ยงตัว จุดตกหนักสุด และคุ้มค่าเสี่ยง</p>
            </div>
          </div>

          <MetricRow
            label="Max Drawdown (พอร์ต)"
            subLabel={
              stats.maxDrawdownPeakDate && stats.maxDrawdownTroughDate
                ? `${stats.maxDrawdownPeakDate} → ${stats.maxDrawdownTroughDate} ${
                    stats.maxDrawdownRecoveryDate
                      ? `(ฟื้น ${stats.maxDrawdownRecoveryDate})`
                      : '(ยังไม่ทำนิวไฮ)'
                  }`
                : 'วัดจากยอดพอร์ตสูงสุด (TWR)'
            }
            value={`${stats.maxDrawdownPercent.toFixed(2)}%`}
            tone={stats.maxDrawdownPercent < 0 ? 'negative' : 'neutral'}
          />
          <MetricRow
            label="Current %Off High"
            subLabel={`${benchmarkLabel}: ${stats.benchCurrentDrawdownPercent.toFixed(2)}%`}
            value={`${stats.currentDrawdownPercent.toFixed(2)}%`}
            tone={stats.currentDrawdownPercent < -0.5 ? 'negative' : 'positive'}
          />
          <MetricRow
            label={`Max Drawdown (${benchmarkLabel})`}
            value={`${stats.benchMaxDrawdownPercent.toFixed(2)}%`}
            tone={stats.benchMaxDrawdownPercent < 0 ? 'negative' : 'neutral'}
          />
          <MetricRow
            label="Annualized Volatility"
            subLabel={`${benchmarkLabel}: ${stats.benchVolatilityPercent.toFixed(2)}% ต่อปี`}
            value={`${stats.annualizedVolatilityPercent.toFixed(2)}%`}
          />
          <MetricRow
            label="Sharpe Ratio"
            subLabel="ผลตอบแทนส่วนเกินต่อความเสี่ยงรวม"
            value={stats.sharpeRatio.toFixed(2)}
            tone={stats.sharpeRatio >= 1 ? 'positive' : stats.sharpeRatio < 0 ? 'negative' : 'neutral'}
          />
          <MetricRow
            label="Sortino Ratio"
            subLabel="คิดเฉพาะความผันผวนขาลง (Downside)"
            value={stats.sortinoRatio.toFixed(2)}
            tone={stats.sortinoRatio >= 1 ? 'positive' : stats.sortinoRatio < 0 ? 'negative' : 'neutral'}
          />
          <MetricRow
            label={`Beta / Correlation vs ${benchmarkLabel}`}
            subLabel="ความไวและความสัมพันธ์ต่อดัชนีอ้างอิง"
            value={
              stats.beta !== null && stats.correlation !== null
                ? `β ${stats.beta.toFixed(2)}  •  r ${stats.correlation.toFixed(2)}`
                : 'ข้อมูลไม่พอ'
            }
          />
        </section>

        {/* Panel 3: Consistency & Extremes */}
        <section className="rounded-2xl bg-[#12151C] border border-white/[0.08] p-5">
          <div className="flex items-center gap-2 pb-3 mb-2 border-b border-white/[0.08]">
            <div className="w-7 h-7 rounded-lg bg-[#20C997]/15 text-[#20C997] flex items-center justify-center">
              <CalendarCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#F4F6F8]">ความสม่ำเสมอ (Consistency)</h3>
              <p className="text-[11px] text-[#9AA4B2]">สถิติรายวันและรายเดือนในช่วงเวลา</p>
            </div>
          </div>

          <MetricRow
            label="Win Days Ratio"
            subLabel={`${stats.winDays} วันบวก / ${stats.lossDays} วันลบ`}
            value={`${stats.winDaysPercent.toFixed(1)}%`}
            tone={stats.winDaysPercent >= 50 ? 'positive' : 'negative'}
          />
          <MetricRow
            label="Win Months Ratio"
            subLabel={`${stats.winMonthsCount} เดือนบวก จาก ${stats.totalMonthsCount} เดือน`}
            value={`${stats.winMonthsPercent.toFixed(1)}%`}
            tone={stats.winMonthsPercent >= 50 ? 'positive' : 'negative'}
          />
          <MetricRow
            label="Average Monthly Return"
            subLabel="ค่าเฉลี่ยผลตอบแทนรายเดือน (TWR)"
            value={formatSignedPct(stats.avgMonthlyReturnPercent)}
            tone={stats.avgMonthlyReturnPercent >= 0 ? 'positive' : 'negative'}
          />
          <MetricRow
            label="Best Day (วันบวกสูงสุด)"
            subLabel={
              stats.bestDay
                ? `${stats.bestDay.date} • ${formatMoney(stats.bestDay.gainBase, sym, hideAmounts)}`
                : '—'
            }
            value={stats.bestDay ? formatSignedPct(stats.bestDay.returnPct) : '—'}
            tone={stats.bestDay && stats.bestDay.returnPct >= 0 ? 'positive' : 'neutral'}
          />
          <MetricRow
            label="Worst Day (วันลบหนักสุด)"
            subLabel={
              stats.worstDay
                ? `${stats.worstDay.date} • ${formatMoney(stats.worstDay.gainBase, sym, hideAmounts)}`
                : '—'
            }
            value={stats.worstDay ? formatSignedPct(stats.worstDay.returnPct) : '—'}
            tone={stats.worstDay && stats.worstDay.returnPct < 0 ? 'negative' : 'neutral'}
          />
          <MetricRow
            label="Best Month (เดือนดีที่สุด)"
            subLabel={
              stats.bestMonth
                ? `${stats.bestMonth.label} • ${formatMoney(stats.bestMonth.gainBase, sym, hideAmounts)}`
                : '—'
            }
            value={stats.bestMonth ? formatSignedPct(stats.bestMonth.returnPct) : '—'}
            tone={stats.bestMonth && stats.bestMonth.returnPct >= 0 ? 'positive' : 'neutral'}
          />
          <MetricRow
            label="Worst Month (เดือนหนักสุด)"
            subLabel={
              stats.worstMonth
                ? `${stats.worstMonth.label} • ${formatMoney(stats.worstMonth.gainBase, sym, hideAmounts)}`
                : '—'
            }
            value={stats.worstMonth ? formatSignedPct(stats.worstMonth.returnPct) : '—'}
            tone={stats.worstMonth && stats.worstMonth.returnPct < 0 ? 'negative' : 'neutral'}
          />
        </section>
      </div>
    </div>
  )
}
