/**
 * lib/analytics/portfolio-analytics-math.ts
 * Pure TypeScript daily portfolio analytics, benchmark PME, MWR/TWR/SR, drawdown,
 * key risk statistics, and monthly/yearly return matrix engine.
 *
 * IMPORTANT: Zero Prisma or network/fetch imports so both client UI components
 * and Node unit tests can import cleanly.
 */

import { calculatePortfolioXIRR } from './quant-metrics'
import type { StockSplitEvent } from './stock-splits'

export type BenchmarkId = 'SP500' | 'NASDAQ100' | 'SET' | 'GOLD' | 'BTC'
export type ReturnMethod = 'MWR' | 'TWR' | 'SR'
export type ChartMode = 'value' | 'return' | 'gain' | 'cash' | 'drawdown'
export type ZoomRange = '1m' | '3m' | '6m' | 'ytd' | '1y' | '3y' | '5y' | 'all'

export interface BenchmarkMeta {
  id: BenchmarkId
  label: string
  shortLabel: string
  yahooSymbol: string
  currency: 'USD' | 'THB'
}

export const BENCHMARK_OPTIONS: BenchmarkMeta[] = [
  { id: 'SP500', label: 'S&P 500', shortLabel: 'S&P500', yahooSymbol: '^GSPC', currency: 'USD' },
  { id: 'NASDAQ100', label: 'NASDAQ 100', shortLabel: 'NDX', yahooSymbol: '^NDX', currency: 'USD' },
  { id: 'SET', label: 'SET Index', shortLabel: 'SET', yahooSymbol: '^SET.BK', currency: 'THB' },
  { id: 'GOLD', label: 'Gold (XAU)', shortLabel: 'Gold', yahooSymbol: 'GC=F', currency: 'USD' },
  { id: 'BTC', label: 'Bitcoin', shortLabel: 'BTC', yahooSymbol: 'BTC-USD', currency: 'USD' },
]

export function getBenchmarkMeta(id?: string | null): BenchmarkMeta {
  const found = BENCHMARK_OPTIONS.find((b) => b.id === id)
  return found || BENCHMARK_OPTIONS[0]
}

export interface DailyAnalyticsPoint {
  date: string // YYYY-MM-DD
  portfolioValue: number
  holdingsValue: number
  cashBalance: number
  benchmarkValue: number
  cumNetDeposits: number
  netCashFlow: number
  dividendFlow: number
  cumDividends: number
  cumRealizedPnL: number
  unrealizedPnL: number
  cumFees: number
  totalGain: number
  twrIndex: number
  benchTwrIndex: number
  dailyReturnPct: number
  benchDailyReturnPct: number
  usdThbRate: number
}

export interface DeltaMetric {
  amount: number
  percent: number
}

export interface DeltaSummary {
  portfolio: {
    value: number
    today: DeltaMetric
    yesterday: DeltaMetric
  }
  benchmark: {
    value: number
    today: DeltaMetric
    yesterday: DeltaMetric
  }
  notInvesting: {
    value: number
    today: DeltaMetric
    yesterday: DeltaMetric
  }
}

export interface WindowSeriesPoint {
  date: string
  portfolioValue: number
  benchmarkValue: number
  cashDeposits: number
  netCashFlow: number
  portfolioReturnPct: number
  benchmarkReturnPct: number
  portfolioGain: number
  benchmarkGain: number
  portfolioDrawdownPct: number
  benchmarkDrawdownPct: number
  dailyReturnPct: number
  usdThbRate: number
}

export interface WindowSummary {
  startDate: string
  endDate: string
  portfolio: DeltaMetric
  benchmark: DeltaMetric
  notInvesting: DeltaMetric
  alphaPct: number
  endPortfolioValue: number
  endBenchmarkValue: number
  endCashDeposits: number
}

export interface KeyStatsResult {
  daysMeasured: number
  tradingPoints: number
  twrPercent: number
  cagrPercent: number | null
  mwrPercent: number
  xirrPercent: number | null
  srPercent: number
  benchmarkTwrPercent: number
  benchmarkMwrPercent: number
  alphaTwrPercent: number
  alphaMwrPercent: number
  maxDrawdownPercent: number
  maxDrawdownPeakDate: string | null
  maxDrawdownTroughDate: string | null
  maxDrawdownRecoveryDate: string | null
  isRecovered: boolean
  currentDrawdownPercent: number
  benchMaxDrawdownPercent: number
  benchCurrentDrawdownPercent: number
  annualizedVolatilityPercent: number
  benchVolatilityPercent: number
  sharpeRatio: number
  sortinoRatio: number
  beta: number | null
  correlation: number | null
  winDays: number
  lossDays: number
  flatDays: number
  winDaysPercent: number
  bestDay: { date: string; returnPct: number; gainBase: number } | null
  worstDay: { date: string; returnPct: number; gainBase: number } | null
  bestMonth: { monthKey: string; label: string; returnPct: number; gainBase: number } | null
  worstMonth: { monthKey: string; label: string; returnPct: number; gainBase: number } | null
  winMonthsCount: number
  totalMonthsCount: number
  winMonthsPercent: number
  avgMonthlyReturnPercent: number
}

export interface MonthlyCell {
  month: number // 1..12
  monthKey: string // YYYY-MM
  returnPct: number | null
  gainBase: number | null
  benchReturnPct: number | null
  startValue: number
  endValue: number
  netFlow: number
}

export interface YearlyReturnMatrixRow {
  year: number
  months: Record<number, MonthlyCell>
  annualReturnPct: number | null
  annualGainBase: number
  annualBenchReturnPct: number | null
  annualAlphaPct: number | null
}

export interface AssetContributionItem {
  assetId: string
  ticker: string
  assetName: string
  market: string
  realizedPnLBase: number
  unrealizedPnLBase: number
  dividendsBase: number
  feesBase: number
  netPnLBase: number
  currentValueBase: number
  status: 'HOLDING' | 'PARTIALLY_SOLD' | 'CLOSED'
}

export interface PnLBreakdownSummary {
  totalNetPnLBase: number
  unrealizedPnLBase: number
  realizedPnLBase: number
  dividendsBase: number
  feesAndTaxBase: number
  topContributors: AssetContributionItem[]
  topDetractors: AssetContributionItem[]
}

export interface PortfolioAnalyticsPayload {
  valuationIssues?: string[]
  hasData: boolean
  baseCurrency: string
  usdThbRate: number
  benchmark: BenchmarkMeta
  lastUpdated: string
  dataSource: string
  startDate: string | null
  endDate: string | null
  totalCashReserve: number
  netWorthBase: number
  fullHistoryXirrPercent: number
  deltas: DeltaSummary
  series: DailyAnalyticsPoint[]
  pnlBreakdown: PnLBreakdownSummary
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

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

export function toUtcDateKey(input: Date | string | number): string {
  if (typeof input === 'string') {
    const trimmed = input.trim()
    const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})/)
    if (match && !trimmed.includes('T')) {
      return match[1]
    }
    const parsed = new Date(trimmed)
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10)
    }
    if (match) return match[1]
  }
  const d = input instanceof Date ? input : new Date(input)
  if (isNaN(d.getTime())) {
    return new Date().toISOString().slice(0, 10)
  }
  return d.toISOString().slice(0, 10)
}

export function addUtcDays(dateStr: string, deltaDays: number): string {
  const ms = Date.parse(`${dateStr}T00:00:00.000Z`) + deltaDays * MS_PER_DAY
  return new Date(ms).toISOString().slice(0, 10)
}

export function daysBetweenUtc(startStr: string, endStr: string): number {
  const s = Date.parse(`${startStr}T00:00:00.000Z`)
  const e = Date.parse(`${endStr}T00:00:00.000Z`)
  return Math.round((e - s) / MS_PER_DAY)
}

export function isWeekendUtc(dateStr: string): boolean {
  const day = new Date(`${dateStr}T00:00:00.000Z`).getUTCDay()
  return day === 0 || day === 6
}

export function getLastWeekdayUtc(dateStr: string): string {
  let cur = dateStr
  while (isWeekendUtc(cur)) {
    cur = addUtcDays(cur, -1)
  }
  return cur
}

function getSplitMultiplierPure(split: { numerator: number; denominator: number }): number {
  const num = Number(split?.numerator)
  const den = Number(split?.denominator || 1)
  if (!Number.isFinite(num) || !Number.isFinite(den) || num <= 0 || den <= 0) {
    return 1
  }
  const mult = num / den
  return Number.isFinite(mult) && mult > 0 ? mult : 1
}

/**
 * Inverts Yahoo Finance's retroactive split adjustment on historical daily closes
 * so daily close prices match the as-traded share price on each date `d`.
 * For date `d`, close_as_traded(d) = close_yahoo(d) * Π_{splitDate > d} multiplier.
 */
export function unadjustYahooClosePrices(
  bars: Array<{ date: string; close: number }>,
  yahooSplits: Array<{ splitDate: string; multiplier: number }>
): Map<string, number> {
  const out = new Map<string, number>()
  if (!bars || bars.length === 0) return out

  const validSplits = (yahooSplits || [])
    .filter(
      (s) =>
        s &&
        typeof s.splitDate === 'string' &&
        Number.isFinite(s.multiplier) &&
        s.multiplier > 0 &&
        Math.abs(s.multiplier - 1) > 1e-9
    )
    .sort((a, b) => a.splitDate.localeCompare(b.splitDate))

  for (const bar of bars) {
    if (!bar?.date || !Number.isFinite(bar.close) || bar.close <= 0) continue
    let futureMult = 1
    for (const s of validSplits) {
      if (s.splitDate > bar.date) {
        futureMult *= s.multiplier
      }
    }
    out.set(bar.date, Number((bar.close * futureMult).toFixed(6)))
  }

  return out
}

/**
 * Enumerates sorted YYYY-MM-DD dates for weekdays between startDateStr and endDateStr,
 * unioned with any explicit extraDates (e.g. weekend transactions) within range.
 */
export function enumerateDailyDates(
  startDateStr: string,
  endDateStr: string,
  extraDates?: Set<string>
): string[] {
  if (!startDateStr || !endDateStr || startDateStr > endDateStr) return []

  const dateSet = new Set<string>()
  const startMs = Date.parse(`${startDateStr}T00:00:00.000Z`)
  const endMs = Date.parse(`${endDateStr}T00:00:00.000Z`)

  for (let ms = startMs; ms <= endMs; ms += MS_PER_DAY) {
    const d = new Date(ms)
    const day = d.getUTCDay()
    if (day !== 0 && day !== 6) {
      dateSet.add(d.toISOString().slice(0, 10))
    }
  }

  if (extraDates) {
    for (const dStr of extraDates) {
      if (dStr >= startDateStr && dStr <= endDateStr) {
        dateSet.add(dStr)
      }
    }
  }

  dateSet.add(startDateStr)
  dateSet.add(endDateStr)

  return Array.from(dateSet).sort()
}

export interface AnalyticsTxnInput {
  id?: string
  assetId: string
  txnDate: Date | string
  txnType: string
  quantity: number | string | unknown
  pricePerUnit: number | string | unknown
  fee?: number | string | unknown
  taxWithheld?: number | string | unknown
  totalAmount?: number | string | unknown
  asset?: {
    id?: string
    ticker?: string
    assetName?: string
    market?: string
    assetType?: string
    currency?: string
  } | null
}

export interface BuildDailySeriesParams {
  txns: AnalyticsTxnInput[]
  effectiveSplitsByAsset: Map<string, StockSplitEvent[]>
  assetDailyPrices: Map<string, Map<string, number>>
  dailyUsdThb: Map<string, number>
  currentUsdThbRate: number
  baseCurrency?: string
  benchmarkDailyPrices: Map<string, number>
  benchmarkCurrency: 'USD' | 'THB'
  liveAssetPrices: Map<string, number>
  todayStr: string
  liveTodayPnLBase?: number
}

interface TimelineEvent {
  kind: 'SPLIT' | 'TXN'
  dateKey: string
  dateMs: number
  split?: StockSplitEvent
  txn?: AnalyticsTxnInput
}

function isAssetUsd(asset?: AnalyticsTxnInput['asset']): boolean {
  if (!asset) return false
  return asset.currency === 'USD' || asset.market === 'US' || asset.market === 'CRYPTO'
}

function findLatestPriceOnOrBefore(
  sortedDates: string[],
  priceMap: Map<string, number>,
  targetDate: string
): number | undefined {
  if (sortedDates.length === 0) return undefined
  let lo = 0
  let hi = sortedDates.length - 1
  let best = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (sortedDates[mid] <= targetDate) {
      best = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return best >= 0 ? priceMap.get(sortedDates[best]) : undefined
}

export function buildDailyAnalyticsSeries(params: BuildDailySeriesParams): {
  series: DailyAnalyticsPoint[]
  deltas: DeltaSummary
  xirrCashFlows: Array<{ amount: number; date: Date }>
} {
  const {
    txns,
    effectiveSplitsByAsset,
    assetDailyPrices,
    dailyUsdThb,
    currentUsdThbRate,
    baseCurrency = 'THB',
    benchmarkDailyPrices,
    benchmarkCurrency,
    liveAssetPrices,
    todayStr,
    liveTodayPnLBase,
  } = params

  const emptyMetric: DeltaMetric = { amount: 0, percent: 0 }
  const emptyDeltas: DeltaSummary = {
    portfolio: { value: 0, today: { ...emptyMetric }, yesterday: { ...emptyMetric } },
    benchmark: { value: 0, today: { ...emptyMetric }, yesterday: { ...emptyMetric } },
    notInvesting: { value: 0, today: { ...emptyMetric }, yesterday: { ...emptyMetric } },
  }

  if (!txns || txns.length === 0) {
    return { series: [], deltas: emptyDeltas, xirrCashFlows: [] }
  }

  // Sort transactions chronologically
  const sortedTxns = [...txns].sort(
    (a, b) => new Date(a.txnDate).getTime() - new Date(b.txnDate).getTime()
  )

  const hasExplicitCashLedger = sortedTxns.some((t) => {
    const type = String(t.txnType || '').toUpperCase()
    return type === 'DEPOSIT' || type === 'WITHDRAW'
  })

  const extraDates = new Set<string>()
  let hasCrypto = false
  for (const t of sortedTxns) {
    extraDates.add(toUtcDateKey(t.txnDate))
    if (t.asset?.market === 'CRYPTO' || t.asset?.assetType === 'crypto') {
      hasCrypto = true
    }
  }

  const startDateStr = toUtcDateKey(sortedTxns[0].txnDate)
  const lastTxnDateStr = toUtcDateKey(sortedTxns[sortedTxns.length - 1].txnDate)
  const rawEnd = lastTxnDateStr > todayStr ? lastTxnDateStr : todayStr
  const effectiveEndStr =
    isWeekendUtc(rawEnd) && !hasCrypto && !extraDates.has(rawEnd)
      ? getLastWeekdayUtc(rawEnd)
      : rawEnd

  const dates = enumerateDailyDates(
    startDateStr,
    effectiveEndStr < startDateStr ? startDateStr : effectiveEndStr,
    extraDates
  )

  if (dates.length === 0) {
    return { series: [], deltas: emptyDeltas, xirrCashFlows: [] }
  }

  // Merge transactions & splits chronologically (SPLIT runs before same-day TXN)
  const timeline: TimelineEvent[] = []
  for (const t of sortedTxns) {
    const dk = toUtcDateKey(t.txnDate)
    timeline.push({
      kind: 'TXN',
      dateKey: dk,
      dateMs: new Date(t.txnDate).getTime(),
      txn: t,
    })
  }
  for (const list of effectiveSplitsByAsset.values()) {
    for (const s of list) {
      const dk = toUtcDateKey(s.splitDate)
      timeline.push({
        kind: 'SPLIT',
        dateKey: dk,
        dateMs: Date.parse(`${dk}T00:00:00.000Z`),
        split: s,
      })
    }
  }
  timeline.sort((a, b) => {
    if (a.dateMs !== b.dateMs) return a.dateMs - b.dateMs
    const pA = a.kind === 'SPLIT' ? 0 : 1
    const pB = b.kind === 'SPLIT' ? 0 : 1
    return pA - pB
  })

  const eventsByDay = new Map<string, TimelineEvent[]>()
  for (const ev of timeline) {
    if (!eventsByDay.has(ev.dateKey)) eventsByDay.set(ev.dateKey, [])
    eventsByDay.get(ev.dateKey)!.push(ev)
  }

  // Pre-sort daily price keys for fast forward-fill & prior close seeding
  const sortedAssetPriceDates = new Map<string, string[]>()
  for (const [assetId, priceMap] of assetDailyPrices.entries()) {
    sortedAssetPriceDates.set(assetId, Array.from(priceMap.keys()).sort())
  }
  const sortedFxDates = Array.from(dailyUsdThb.keys()).sort()
  const sortedBenchDates = Array.from(benchmarkDailyPrices.keys()).sort()

  // Seed FX & Benchmark before day 0
  const fallbackFx = currentUsdThbRate > 0 ? currentUsdThbRate : 35.5
  let lastKnownFx =
    findLatestPriceOnOrBefore(sortedFxDates, dailyUsdThb, dates[0]) ??
    (sortedFxDates.length > 0 ? dailyUsdThb.get(sortedFxDates[0])! : fallbackFx)

  let lastKnownBenchNative =
    findLatestPriceOnOrBefore(sortedBenchDates, benchmarkDailyPrices, dates[0]) ??
    (sortedBenchDates.length > 0 ? benchmarkDailyPrices.get(sortedBenchDates[0])! : 0)

  // Replay state
  const fifoLots = new Map<
    string,
    Array<{ qty: number; unitPriceNative: number; unitCostBase: number }>
  >()
  const assetMetaMap = new Map<string, AnalyticsTxnInput['asset']>()
  const lastKnownNativePrice = new Map<string, number>()

  let cashBalance = 0
  let cumNetDeposits = 0
  let cumDividends = 0
  let cumRealizedPnL = 0
  let cumFees = 0

  let benchUnits = 0
  let firstValidBenchPriceBase = 0
  let prevPortfolioValue = 0
  let prevTwrIndex = 1.0
  let prevBenchTwrIndex = 1.0

  const xirrCashFlows: Array<{ amount: number; date: Date }> = []
  const series: DailyAnalyticsPoint[] = []
  const lastIdx = dates.length - 1

  // Process any pre-window events (shouldn't normally happen since startDateStr = first txn)
  for (const ev of timeline) {
    if (ev.dateKey < dates[0] && ev.kind === 'SPLIT' && ev.split) {
      // No-op since no open lots yet
    }
  }

  for (let idx = 0; idx < dates.length; idx++) {
    const d = dates[idx]
    const isFinalDay = idx === lastIdx

    // 1. Resolve USD/THB FX rate for day d
    if (isFinalDay && currentUsdThbRate > 0) {
      lastKnownFx = currentUsdThbRate
    } else {
      const dayFx = dailyUsdThb.get(d)
      if (dayFx && dayFx > 0) {
        lastKnownFx = dayFx
      }
    }
    const dayUsdThb = baseCurrency.toUpperCase() === 'USD' ? 1.0 : lastKnownFx

    const getFxForAsset = (asset?: AnalyticsTxnInput['asset']): number => {
      const target = baseCurrency.toUpperCase()
      const assetIsUsd = isAssetUsd(asset)
      if (target === 'USD') {
        return assetIsUsd ? 1.0 : 1 / Math.max(1, lastKnownFx)
      }
      return assetIsUsd ? lastKnownFx : 1.0
    }

    // 2. Apply day d events (SPLITs before TXNs)
    let netCashFlow = 0
    let dividendFlow = 0
    const dayEvents = eventsByDay.get(d) || []

    for (const ev of dayEvents) {
      if (ev.kind === 'SPLIT' && ev.split) {
        const s = ev.split
        const mult = getSplitMultiplierPure(s)
        if (mult !== 1) {
          const lots = fifoLots.get(s.assetId)
          if (lots && lots.length > 0) {
            for (const lot of lots) {
              lot.qty *= mult
              lot.unitPriceNative /= mult
              lot.unitCostBase /= mult
            }
          }
          const prevNative = lastKnownNativePrice.get(s.assetId)
          if (prevNative && prevNative > 0) {
            lastKnownNativePrice.set(s.assetId, prevNative / mult)
          }
        }
        continue
      }

      const t = ev.txn
      if (!t || !t.assetId) continue
      if (t.asset) assetMetaMap.set(t.assetId, t.asset)
      if (!fifoLots.has(t.assetId)) fifoLots.set(t.assetId, [])
      const lots = fifoLots.get(t.assetId)!

      const fx = getFxForAsset(t.asset ?? assetMetaMap.get(t.assetId))
      const txnType = String(t.txnType || '').toUpperCase()
      const qty = Number(t.quantity || 0)
      const price = Number(t.pricePerUnit || 0)
      const fee = Number(t.fee || 0)
      const tax = Number(t.taxWithheld || 0)
      const totalAmt = Number(t.totalAmount || 0)
      const txnDateObj = new Date(t.txnDate)

      if (txnType === 'DEPOSIT') {
        const amtBase = Math.abs((totalAmt > 0 ? totalAmt : qty * price) * fx)
        if (amtBase > 0) {
          cashBalance += amtBase
          netCashFlow += amtBase
          xirrCashFlows.push({ amount: -amtBase, date: txnDateObj })
        }
      } else if (txnType === 'WITHDRAW') {
        const amtBase = Math.abs((totalAmt > 0 ? totalAmt : qty * price) * fx)
        if (amtBase > 0) {
          cashBalance = Math.max(0, cashBalance - amtBase)
          netCashFlow -= amtBase
          xirrCashFlows.push({ amount: amtBase, date: txnDateObj })
        }
      } else if (txnType === 'FEE') {
        const feeBase = Math.abs((totalAmt > 0 ? totalAmt : fee || qty * price) * fx)
        if (feeBase > 0) {
          cumFees += feeBase
          if (hasExplicitCashLedger) {
            cashBalance = Math.max(0, cashBalance - feeBase)
          }
        }
      } else if (txnType === 'BUY' && qty > 0) {
        const grossCostBase = qty * price * fx
        const feeBase = fee * fx
        const outflowBase = (totalAmt > 0 ? totalAmt : qty * price + fee) * fx

        lots.push({
          qty,
          unitPriceNative: price,
          unitCostBase: (qty * price * fx) / qty,
        })
        cumFees += feeBase
        if (price > 0) {
          lastKnownNativePrice.set(t.assetId, price)
        }

        if (hasExplicitCashLedger) {
          if (cashBalance >= outflowBase) {
            cashBalance -= outflowBase
          } else {
            const shortfall = outflowBase - cashBalance
            cashBalance = 0
            netCashFlow += shortfall
            xirrCashFlows.push({ amount: -shortfall, date: txnDateObj })
          }
        } else {
          const actualFlow = outflowBase > 0 ? outflowBase : grossCostBase + feeBase
          netCashFlow += actualFlow
          if (actualFlow > 0) {
            xirrCashFlows.push({ amount: -actualFlow, date: txnDateObj })
          }
        }
      } else if (txnType === 'SELL' && qty > 0) {
        let rem = qty
        let soldCostBase = 0
        while (rem > 0.0000001 && lots.length > 0) {
          const lot = lots[0]
          const take = Math.min(lot.qty, rem)
          soldCostBase += take * lot.unitCostBase
          lot.qty -= take
          rem -= take
          if (lot.qty <= 0.0000001) {
            lots.shift()
          }
        }

        const grossProceedsBase = qty * price * fx
        const sellFeeAndTaxBase = (fee + tax) * fx
        const netProceedsBase =
          totalAmt > 0
            ? totalAmt * fx
            : Math.max(0, grossProceedsBase - sellFeeAndTaxBase)

        // Track gross realized gain separately from cumFees so:
        // holdingsValue - cumNetDeposits + cumDividends === unrealized + realizedGross + dividends - cumFees
        cumRealizedPnL += grossProceedsBase - soldCostBase
        cumFees += sellFeeAndTaxBase
        if (price > 0) {
          lastKnownNativePrice.set(t.assetId, price)
        }

        if (hasExplicitCashLedger) {
          cashBalance += netProceedsBase
        } else {
          netCashFlow -= netProceedsBase
          if (netProceedsBase > 0) {
            xirrCashFlows.push({ amount: netProceedsBase, date: txnDateObj })
          }
        }
      } else if (txnType === 'DIVIDEND') {
        const divNetBase = Math.max(0, (totalAmt > 0 ? totalAmt : qty * price - tax) * fx)
        dividendFlow += divNetBase
        cumDividends += divNetBase
        if (hasExplicitCashLedger) {
          cashBalance += divNetBase
        } else if (divNetBase > 0) {
          xirrCashFlows.push({ amount: divNetBase, date: txnDateObj })
        }
      }
    }

    // 3. Value open holdings on day d using market daily closes (anchored on final day to live quote)
    let holdingsValue = 0
    let openCostBase = 0

    for (const [assetId, lots] of fifoLots.entries()) {
      const openQty = lots.reduce((s, l) => s + l.qty, 0)
      if (openQty <= 0.0000001) continue

      const assetCostBase = lots.reduce((s, l) => s + l.qty * l.unitCostBase, 0)
      openCostBase += assetCostBase

      const priceMap = assetDailyPrices.get(assetId)
      let dayNativePrice = priceMap?.get(d)

      if (isFinalDay) {
        const liveP = liveAssetPrices.get(assetId)
        if (liveP && liveP > 0) {
          dayNativePrice = liveP
        }
      }

      if ((!dayNativePrice || dayNativePrice <= 0) && !lastKnownNativePrice.has(assetId) && priceMap) {
        const sortedD = sortedAssetPriceDates.get(assetId) || []
        const seeded = findLatestPriceOnOrBefore(sortedD, priceMap, d)
        if (seeded && seeded > 0) {
          dayNativePrice = seeded
        }
      }

      if (dayNativePrice && dayNativePrice > 0) {
        lastKnownNativePrice.set(assetId, dayNativePrice)
      }

      const effectiveNative = lastKnownNativePrice.get(assetId)
      const fx = getFxForAsset(assetMetaMap.get(assetId))
      const assetValBase =
        effectiveNative && effectiveNative > 0 ? openQty * effectiveNative * fx : assetCostBase
      holdingsValue += assetValBase
    }

    const portfolioValue = hasExplicitCashLedger ? holdingsValue + cashBalance : holdingsValue
    cumNetDeposits += netCashFlow

    // 4. Counterfactual Benchmark PME Valuation
    const dayBenchNative = benchmarkDailyPrices.get(d)
    if (dayBenchNative && dayBenchNative > 0) {
      lastKnownBenchNative = dayBenchNative
    }
    const benchFx =
      benchmarkCurrency === baseCurrency.toUpperCase()
        ? 1.0
        : benchmarkCurrency === 'USD'
        ? lastKnownFx
        : 1 / Math.max(1, lastKnownFx)

    const benchPriceBase = lastKnownBenchNative > 0 ? lastKnownBenchNative * benchFx : 0
    if (benchPriceBase > 0 && firstValidBenchPriceBase <= 0) {
      firstValidBenchPriceBase = benchPriceBase
    }

    const prevBenchPriceBase =
      series.length > 0 && series[series.length - 1].benchTwrIndex > 0 && firstValidBenchPriceBase > 0
        ? series[series.length - 1].benchTwrIndex * firstValidBenchPriceBase
        : benchPriceBase

    if (benchPriceBase > 0 && netCashFlow !== 0) {
      benchUnits = Math.max(0, benchUnits + netCashFlow / benchPriceBase)
    }

    const benchmarkValue = benchUnits * benchPriceBase
    const benchTwrIndex =
      firstValidBenchPriceBase > 0 && benchPriceBase > 0
        ? benchPriceBase / firstValidBenchPriceBase
        : prevBenchTwrIndex

    const benchDailyReturnPct =
      idx > 0 && prevBenchPriceBase > 0 && benchPriceBase > 0
        ? ((benchPriceBase - prevBenchPriceBase) / prevBenchPriceBase) * 100
        : 0

    // 5. Daily TWR sub-period return (Modified Dietz daily linking)
    const effectiveDivOutflow = hasExplicitCashLedger ? 0 : dividendFlow
    const denom = prevPortfolioValue + Math.max(0, netCashFlow)
    let dailyRet = 0
    if (denom >= 1) {
      const dayGain = portfolioValue + effectiveDivOutflow - netCashFlow - prevPortfolioValue
      dailyRet = Math.max(-0.9999, Math.min(5, dayGain / denom))
    }
    const twrIndex = prevTwrIndex * (1 + dailyRet)

    const unrealizedPnL = holdingsValue - openCostBase
    const totalGain = hasExplicitCashLedger
      ? portfolioValue - cumNetDeposits
      : portfolioValue - cumNetDeposits + cumDividends

    series.push({
      date: d,
      portfolioValue: Number(portfolioValue.toFixed(2)),
      holdingsValue: Number(holdingsValue.toFixed(2)),
      cashBalance: Number(cashBalance.toFixed(2)),
      benchmarkValue: Number(benchmarkValue.toFixed(2)),
      cumNetDeposits: Number(cumNetDeposits.toFixed(2)),
      netCashFlow: Number(netCashFlow.toFixed(2)),
      dividendFlow: Number(dividendFlow.toFixed(2)),
      cumDividends: Number(cumDividends.toFixed(2)),
      cumRealizedPnL: Number(cumRealizedPnL.toFixed(2)),
      unrealizedPnL: Number(unrealizedPnL.toFixed(2)),
      cumFees: Number(cumFees.toFixed(2)),
      totalGain: Number(totalGain.toFixed(2)),
      twrIndex: Number(twrIndex.toFixed(8)),
      benchTwrIndex: Number(benchTwrIndex.toFixed(8)),
      dailyReturnPct: Number((dailyRet * 100).toFixed(4)),
      benchDailyReturnPct: Number(benchDailyReturnPct.toFixed(4)),
      usdThbRate: Number(dayUsdThb.toFixed(4)),
    })

    prevPortfolioValue = portfolioValue
    prevTwrIndex = twrIndex
    prevBenchTwrIndex = benchTwrIndex
  }

  // Final XIRR terminal inflow
  const lastPoint = series[series.length - 1]
  if (lastPoint && lastPoint.portfolioValue > 0 && xirrCashFlows.length > 0) {
    xirrCashFlows.push({
      amount: lastPoint.portfolioValue,
      date: new Date(`${lastPoint.date}T23:59:59.000Z`),
    })
  }

  // Compute TODAY & YESTERDAY delta summaries
  const calcDayDelta = (idx: number, overrideAmount?: number): DeltaMetric => {
    if (idx < 0 || idx >= series.length) return { amount: 0, percent: 0 }
    const curr = series[idx]
    const prev = idx > 0 ? series[idx - 1] : null
    const prevVal = prev ? prev.portfolioValue : 0
    const divAdd = hasExplicitCashLedger ? 0 : curr.dividendFlow
    const computedGain = curr.portfolioValue + divAdd - curr.netCashFlow - prevVal
    const amount = overrideAmount !== undefined && Number.isFinite(overrideAmount) ? overrideAmount : computedGain
    const denom = prevVal + Math.max(0, curr.netCashFlow)
    const percent = denom >= 1 ? (amount / denom) * 100 : 0
    return {
      amount: Number(amount.toFixed(2)),
      percent: Number(percent.toFixed(2)),
    }
  }

  const calcBenchDayDelta = (idx: number): DeltaMetric => {
    if (idx < 0 || idx >= series.length) return { amount: 0, percent: 0 }
    const curr = series[idx]
    const prev = idx > 0 ? series[idx - 1] : null
    const prevVal = prev ? prev.benchmarkValue : 0
    const gain = curr.benchmarkValue - curr.netCashFlow - prevVal
    const denom = prevVal + Math.max(0, curr.netCashFlow)
    const percent = denom >= 1 ? (gain / denom) * 100 : 0
    return {
      amount: Number(gain.toFixed(2)),
      percent: Number(percent.toFixed(2)),
    }
  }

  const n = series.length
  const useLiveToday =
    liveTodayPnLBase !== undefined &&
    Number.isFinite(liveTodayPnLBase) &&
    n >= 1 &&
    series[n - 1].netCashFlow === 0

  const deltas: DeltaSummary = {
    portfolio: {
      value: lastPoint ? lastPoint.portfolioValue : 0,
      today: n >= 1 ? calcDayDelta(n - 1, useLiveToday ? liveTodayPnLBase : undefined) : { ...emptyMetric },
      yesterday: n >= 2 ? calcDayDelta(n - 2) : { ...emptyMetric },
    },
    benchmark: {
      value: lastPoint ? lastPoint.benchmarkValue : 0,
      today: n >= 1 ? calcBenchDayDelta(n - 1) : { ...emptyMetric },
      yesterday: n >= 2 ? calcBenchDayDelta(n - 2) : { ...emptyMetric },
    },
    notInvesting: {
      value: lastPoint ? lastPoint.cumNetDeposits : 0,
      today: { amount: 0, percent: 0 },
      yesterday: { amount: 0, percent: 0 },
    },
  }

  return { series, deltas, xirrCashFlows }
}

/**
 * Resolves [startIdx, endIdx] for a ZoomRange preset over daily analytics series.
 */
export function resolveZoomIndices(
  series: DailyAnalyticsPoint[],
  zoom: ZoomRange
): { startIdx: number; endIdx: number } {
  if (!series || series.length === 0) return { startIdx: 0, endIdx: 0 }
  const endIdx = series.length - 1
  if (zoom === 'all') return { startIdx: 0, endIdx }

  const endDate = series[endIdx].date
  let targetStartDate = series[0].date

  const [y, m, d] = endDate.split('-').map(Number)
  if (zoom === 'ytd') {
    targetStartDate = `${y}-01-01`
  } else {
    const dt = new Date(Date.UTC(y, m - 1, d))
    if (zoom === '1m') dt.setUTCMonth(dt.getUTCMonth() - 1)
    else if (zoom === '3m') dt.setUTCMonth(dt.getUTCMonth() - 3)
    else if (zoom === '6m') dt.setUTCMonth(dt.getUTCMonth() - 6)
    else if (zoom === '1y') dt.setUTCFullYear(dt.getUTCFullYear() - 1)
    else if (zoom === '3y') dt.setUTCFullYear(dt.getUTCFullYear() - 3)
    else if (zoom === '5y') dt.setUTCFullYear(dt.getUTCFullYear() - 5)
    targetStartDate = dt.toISOString().slice(0, 10)
  }

  if (targetStartDate <= series[0].date) {
    return { startIdx: 0, endIdx }
  }

  // Binary search first index >= targetStartDate
  let lo = 0
  let hi = endIdx
  let found = endIdx
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (series[mid].date >= targetStartDate) {
      found = mid
      hi = mid - 1
    } else {
      lo = mid + 1
    }
  }

  return { startIdx: Math.min(found, Math.max(0, endIdx - 1)), endIdx }
}

/**
 * Returns whether a zoom preset covers a strictly distinct historical span (used to dim unavailable 3y/5y buttons).
 */
export function isZoomAvailable(series: DailyAnalyticsPoint[], zoom: ZoomRange): boolean {
  if (!series || series.length < 2) return zoom === 'all'
  if (zoom === 'all' || zoom === 'ytd') return true

  const totalDays = daysBetweenUtc(series[0].date, series[series.length - 1].date)
  const requiredMinDays: Record<Exclude<ZoomRange, 'all' | 'ytd'>, number> = {
    '1m': 14,
    '3m': 45,
    '6m': 120,
    '1y': 240,
    '3y': 750,
    '5y': 1400,
  }
  return totalDays >= requiredMinDays[zoom]
}

/**
 * Computes windowed Return (MWR / TWR / SR), Gain, Value, Cash Deposits, and %Off High Drawdown
 * in strict O(N) linear time over [startIdx .. endIdx].
 */
export function computeWindowSeries(
  series: DailyAnalyticsPoint[],
  startIdx: number,
  endIdx: number,
  method: ReturnMethod
): { points: WindowSeriesPoint[]; summary: WindowSummary } {
  const emptySummary: WindowSummary = {
    startDate: '',
    endDate: '',
    portfolio: { amount: 0, percent: 0 },
    benchmark: { amount: 0, percent: 0 },
    notInvesting: { amount: 0, percent: 0 },
    alphaPct: 0,
    endPortfolioValue: 0,
    endBenchmarkValue: 0,
    endCashDeposits: 0,
  }

  if (!series || series.length === 0) {
    return { points: [], summary: emptySummary }
  }

  const s = Math.max(0, Math.min(startIdx, series.length - 1))
  const e = Math.max(s, Math.min(endIdx, series.length - 1))

  const prevPoint = s > 0 ? series[s - 1] : null
  const vStart = prevPoint ? prevPoint.portfolioValue : 0
  const bStart = prevPoint ? prevPoint.benchmarkValue : 0
  const twrBase = prevPoint && prevPoint.twrIndex > 0 ? prevPoint.twrIndex : 1.0
  const benchTwrBase = prevPoint && prevPoint.benchTwrIndex > 0 ? prevPoint.benchTwrIndex : 1.0
  const divBase = prevPoint ? prevPoint.cumDividends : 0
  const depositBase = prevPoint ? prevPoint.cumNetDeposits : 0

  const startDate = series[s].date
  let cumFlow = 0
  let cumOffsetFlow = 0
  let sumPositiveFlow = 0

  let runningTwrPeak = 0
  let runningBenchTwrPeak = 0

  const points: WindowSeriesPoint[] = []

  for (let i = s; i <= e; i++) {
    const p = series[i]
    const offsetDays = daysBetweenUtc(startDate, p.date)

    cumFlow += p.netCashFlow
    cumOffsetFlow += offsetDays * p.netCashFlow
    if (p.netCashFlow > 0) {
      sumPositiveFlow += p.netCashFlow
    }

    const cumDivSinceS = p.cumDividends - divBase
    const portfolioGain = p.portfolioValue - vStart - cumFlow + cumDivSinceS
    const benchmarkGain = p.benchmarkValue - bStart - cumFlow

    // 1. TWR %
    const portTwrPct = (p.twrIndex / twrBase - 1) * 100
    const benchTwrPct = (p.benchTwrIndex / benchTwrBase - 1) * 100

    // 2. MWR % (Incremental O(1) Modified Dietz)
    const weightedFlow =
      i === s ? cumFlow : cumFlow - cumOffsetFlow / Math.max(1, offsetDays)
    const portWeightedCap = vStart + weightedFlow
    const portFallbackCap = vStart + sumPositiveFlow
    const portDietzDenom =
      portWeightedCap > 1 ? portWeightedCap : portFallbackCap > 1 ? portFallbackCap : 0
    const portMwrPct = portDietzDenom > 0 ? (portfolioGain / portDietzDenom) * 100 : 0

    const benchWeightedCap = bStart + weightedFlow
    const benchFallbackCap = bStart + sumPositiveFlow
    const benchDietzDenom =
      benchWeightedCap > 1 ? benchWeightedCap : benchFallbackCap > 1 ? benchFallbackCap : 0
    const benchMwrPct = benchDietzDenom > 0 ? (benchmarkGain / benchDietzDenom) * 100 : 0

    // 3. SR % (Simple Return over invested capital base)
    const srCapBase =
      s === 0
        ? p.cumNetDeposits > 1
          ? p.cumNetDeposits
          : sumPositiveFlow
        : vStart + sumPositiveFlow
    const benchSrCapBase =
      s === 0
        ? p.cumNetDeposits > 1
          ? p.cumNetDeposits
          : sumPositiveFlow
        : bStart + sumPositiveFlow

    const portSrPct = srCapBase > 1 ? (portfolioGain / srCapBase) * 100 : 0
    const benchSrPct = benchSrCapBase > 1 ? (benchmarkGain / benchSrCapBase) * 100 : 0

    const portfolioReturnPct =
      method === 'TWR' ? portTwrPct : method === 'SR' ? portSrPct : portMwrPct
    const benchmarkReturnPct =
      method === 'TWR' ? benchTwrPct : method === 'SR' ? benchSrPct : benchMwrPct

    // 4. %Off High Drawdown (on TWR index so external deposits/withdrawals never fake drawdowns)
    const relTwr = p.twrIndex / twrBase
    if (relTwr > runningTwrPeak) runningTwrPeak = relTwr
    const portfolioDrawdownPct =
      runningTwrPeak > 0 ? ((relTwr - runningTwrPeak) / runningTwrPeak) * 100 : 0

    const relBenchTwr = p.benchTwrIndex / benchTwrBase
    if (relBenchTwr > runningBenchTwrPeak) runningBenchTwrPeak = relBenchTwr
    const benchmarkDrawdownPct =
      runningBenchTwrPeak > 0 ? ((relBenchTwr - runningBenchTwrPeak) / runningBenchTwrPeak) * 100 : 0

    points.push({
      date: p.date,
      portfolioValue: p.portfolioValue,
      benchmarkValue: p.benchmarkValue,
      cashDeposits: s === 0 ? p.cumNetDeposits : p.cumNetDeposits - depositBase + vStart,
      netCashFlow: p.netCashFlow,
      portfolioReturnPct: Number(portfolioReturnPct.toFixed(2)),
      benchmarkReturnPct: Number(benchmarkReturnPct.toFixed(2)),
      portfolioGain: Number(portfolioGain.toFixed(2)),
      benchmarkGain: Number(benchmarkGain.toFixed(2)),
      portfolioDrawdownPct: Number(portfolioDrawdownPct.toFixed(2)),
      benchmarkDrawdownPct: Number(benchmarkDrawdownPct.toFixed(2)),
      dailyReturnPct: p.dailyReturnPct,
      usdThbRate: p.usdThbRate,
    })
  }

  const last = points[points.length - 1]
  const rawLast = series[e]

  return {
    points,
    summary: {
      startDate: series[s].date,
      endDate: rawLast.date,
      portfolio: {
        amount: last.portfolioGain,
        percent: last.portfolioReturnPct,
      },
      benchmark: {
        amount: last.benchmarkGain,
        percent: last.benchmarkReturnPct,
      },
      notInvesting: {
        amount: 0,
        percent: 0,
      },
      alphaPct: Number((last.portfolioReturnPct - last.benchmarkReturnPct).toFixed(2)),
      endPortfolioValue: rawLast.portfolioValue,
      endBenchmarkValue: rawLast.benchmarkValue,
      endCashDeposits: rawLast.cumNetDeposits,
    },
  }
}

/**
 * Computes institutional Key Stats over [startIdx .. endIdx].
 */
export function computeKeyStats(
  series: DailyAnalyticsPoint[],
  startIdx: number,
  endIdx: number,
  fullHistoryXirrPercent?: number,
  baseCurrency = 'THB'
): KeyStatsResult {
  const empty: KeyStatsResult = {
    daysMeasured: 0,
    tradingPoints: 0,
    twrPercent: 0,
    cagrPercent: null,
    mwrPercent: 0,
    xirrPercent: null,
    srPercent: 0,
    benchmarkTwrPercent: 0,
    benchmarkMwrPercent: 0,
    alphaTwrPercent: 0,
    alphaMwrPercent: 0,
    maxDrawdownPercent: 0,
    maxDrawdownPeakDate: null,
    maxDrawdownTroughDate: null,
    maxDrawdownRecoveryDate: null,
    isRecovered: true,
    currentDrawdownPercent: 0,
    benchMaxDrawdownPercent: 0,
    benchCurrentDrawdownPercent: 0,
    annualizedVolatilityPercent: 0,
    benchVolatilityPercent: 0,
    sharpeRatio: 0,
    sortinoRatio: 0,
    beta: null,
    correlation: null,
    winDays: 0,
    lossDays: 0,
    flatDays: 0,
    winDaysPercent: 0,
    bestDay: null,
    worstDay: null,
    bestMonth: null,
    worstMonth: null,
    winMonthsCount: 0,
    totalMonthsCount: 0,
    winMonthsPercent: 0,
    avgMonthlyReturnPercent: 0,
  }

  if (!series || series.length === 0) return empty

  const s = Math.max(0, Math.min(startIdx, series.length - 1))
  const e = Math.max(s, Math.min(endIdx, series.length - 1))

  const twrRes = computeWindowSeries(series, s, e, 'TWR')
  const mwrRes = computeWindowSeries(series, s, e, 'MWR')
  const srRes = computeWindowSeries(series, s, e, 'SR')

  const daysMeasured = Math.max(1, daysBetweenUtc(series[s].date, series[e].date))
  const twrPct = twrRes.summary.portfolio.percent
  const benchTwrPct = twrRes.summary.benchmark.percent
  const mwrPct = mwrRes.summary.portfolio.percent
  const benchMwrPct = mwrRes.summary.benchmark.percent
  const srPct = srRes.summary.portfolio.percent

  const prevPoint = s > 0 ? series[s - 1] : null
  const twrStart = prevPoint && prevPoint.twrIndex > 0 ? prevPoint.twrIndex : 1.0
  const twrEnd = series[e].twrIndex
  const cagrPercent =
    daysMeasured >= 30 && twrStart > 0 && twrEnd > 0
      ? Number(((Math.pow(twrEnd / twrStart, 365.25 / daysMeasured) - 1) * 100).toFixed(2))
      : null

  // Window XIRR
  let xirrPercent: number | null = null
  if (s === 0 && e === series.length - 1 && fullHistoryXirrPercent !== undefined) {
    xirrPercent = Number(fullHistoryXirrPercent.toFixed(2))
  } else if (daysMeasured >= 14) {
    const cfs: Array<{ amount: number; date: Date }> = []
    if (prevPoint && prevPoint.portfolioValue > 0) {
      cfs.push({
        amount: -prevPoint.portfolioValue,
        date: new Date(`${prevPoint.date}T23:59:59.000Z`),
      })
    }
    for (let i = s; i <= e; i++) {
      const p = series[i]
      if (p.netCashFlow !== 0) {
        cfs.push({ amount: -p.netCashFlow, date: new Date(`${p.date}T12:00:00.000Z`) })
      }
      if (p.dividendFlow > 0 && p.cashBalance === 0) {
        cfs.push({ amount: p.dividendFlow, date: new Date(`${p.date}T12:00:00.000Z`) })
      }
    }
    if (series[e].portfolioValue > 0) {
      cfs.push({
        amount: series[e].portfolioValue,
        date: new Date(`${series[e].date}T23:59:59.000Z`),
      })
    }
    const calc = calculatePortfolioXIRR(cfs)
    xirrPercent = Number.isFinite(calc) ? Number(calc.toFixed(2)) : null
  }

  // Max Drawdown with Peak, Trough, and Recovery dates
  let peakVal = 0
  let peakDate: string | null = null
  let maxDd = 0
  let ddPeakDate: string | null = null
  let ddTroughDate: string | null = null
  let ddRecoveryDate: string | null = null
  let trackingRecovery = false

  let benchPeak = 0
  let benchMaxDd = 0

  for (let i = s; i <= e; i++) {
    const p = series[i]
    const rel = p.twrIndex / twrStart
    if (rel > peakVal) {
      peakVal = rel
      peakDate = p.date
      if (trackingRecovery && !ddRecoveryDate) {
        ddRecoveryDate = p.date
        trackingRecovery = false
      }
    }
    if (peakVal > 0) {
      const dd = ((rel - peakVal) / peakVal) * 100
      if (dd < maxDd) {
        maxDd = dd
        ddPeakDate = peakDate
        ddTroughDate = p.date
        ddRecoveryDate = null
        trackingRecovery = true
      }
    }

    const bStartIdx = prevPoint && prevPoint.benchTwrIndex > 0 ? prevPoint.benchTwrIndex : 1.0
    const bRel = p.benchTwrIndex / bStartIdx
    if (bRel > benchPeak) benchPeak = bRel
    if (benchPeak > 0) {
      const bdd = ((bRel - benchPeak) / benchPeak) * 100
      if (bdd < benchMaxDd) benchMaxDd = bdd
    }
  }

  const lastWindowPt = twrRes.points[twrRes.points.length - 1]
  const currentDrawdownPercent = lastWindowPt ? lastWindowPt.portfolioDrawdownPct : 0
  const benchCurrentDrawdownPercent = lastWindowPt ? lastWindowPt.benchmarkDrawdownPct : 0

  // Daily return series for Volatility, Sharpe, Sortino, Beta, Correlation, Win/Loss days
  const portDaily: number[] = []
  const benchDaily: number[] = []
  let winDays = 0
  let lossDays = 0
  let flatDays = 0
  let bestDay: KeyStatsResult['bestDay'] = null
  let worstDay: KeyStatsResult['worstDay'] = null

  for (let i = s; i <= e; i++) {
    const p = series[i]
    const prev = i > 0 ? series[i - 1] : null
    const dayGain = p.portfolioValue + (p.cashBalance > 0 ? 0 : p.dividendFlow) - p.netCashFlow - (prev ? prev.portfolioValue : 0)

    // Exclude zero-value idle days where portfolio was completely empty
    if (p.portfolioValue > 1 || (prev && prev.portfolioValue > 1)) {
      const r = p.dailyReturnPct / 100
      const br = p.benchDailyReturnPct / 100
      portDaily.push(r)
      benchDaily.push(br)

      if (p.dailyReturnPct > 0.005) winDays++
      else if (p.dailyReturnPct < -0.005) lossDays++
      else flatDays++

      if (!bestDay || p.dailyReturnPct > bestDay.returnPct) {
        bestDay = {
          date: p.date,
          returnPct: Number(p.dailyReturnPct.toFixed(2)),
          gainBase: Number(dayGain.toFixed(2)),
        }
      }
      if (!worstDay || p.dailyReturnPct < worstDay.returnPct) {
        worstDay = {
          date: p.date,
          returnPct: Number(p.dailyReturnPct.toFixed(2)),
          gainBase: Number(dayGain.toFixed(2)),
        }
      }
    }
  }

  let annualizedVolatilityPercent = 0
  let benchVolatilityPercent = 0
  let sharpeRatio = 0
  let sortinoRatio = 0
  let beta: number | null = null
  let correlation: number | null = null

  if (portDaily.length >= 2) {
    const nDays = portDaily.length
    const meanP = portDaily.reduce((a, b) => a + b, 0) / nDays
    const varP = portDaily.reduce((a, b) => a + (b - meanP) ** 2, 0) / (nDays - 1)
    const stdP = Math.sqrt(varP)
    annualizedVolatilityPercent = Number((stdP * Math.sqrt(252) * 100).toFixed(2))

    const meanB = benchDaily.reduce((a, b) => a + b, 0) / nDays
    const varB = benchDaily.reduce((a, b) => a + (b - meanB) ** 2, 0) / (nDays - 1)
    const stdB = Math.sqrt(varB)
    benchVolatilityPercent = Number((stdB * Math.sqrt(252) * 100).toFixed(2))

    const rfPercent = baseCurrency.toUpperCase() === 'USD' ? 4.2 : 2.5
    const annRetPct = cagrPercent !== null ? cagrPercent : meanP * 252 * 100

    if (annualizedVolatilityPercent > 0.25) {
      sharpeRatio = Number(((annRetPct - rfPercent) / annualizedVolatilityPercent).toFixed(2))
    }

    const downsideSq =
      portDaily.reduce((acc, r) => acc + (r < 0 ? r * r : 0), 0) / nDays
    const downsideDevPct = Math.sqrt(downsideSq) * Math.sqrt(252) * 100
    if (downsideDevPct > 0.25) {
      sortinoRatio = Number(((annRetPct - rfPercent) / downsideDevPct).toFixed(2))
    }

    if (nDays >= 5 && varB > 1e-10 && stdP > 1e-8) {
      const cov =
        portDaily.reduce((acc, r, idx) => acc + (r - meanP) * (benchDaily[idx] - meanB), 0) /
        (nDays - 1)
      beta = Number((cov / varB).toFixed(2))
      correlation = Number(Math.max(-1, Math.min(1, cov / (stdP * stdB))).toFixed(2))
    }
  }

  // Monthly statistics inside window
  const windowSlice = series.slice(s, e + 1)
  const matrix = computeMonthlyReturnMatrix(windowSlice, s > 0 ? series[s - 1] : undefined)
  const allMonthCells: MonthlyCell[] = []
  for (const row of matrix) {
    for (let m = 1; m <= 12; m++) {
      const cell = row.months[m]
      if (cell && cell.returnPct !== null) {
        allMonthCells.push(cell)
      }
    }
  }

  let bestMonth: KeyStatsResult['bestMonth'] = null
  let worstMonth: KeyStatsResult['worstMonth'] = null
  let winMonthsCount = 0
  let sumMonthlyRet = 0

  for (const cell of allMonthCells) {
    const ret = cell.returnPct!
    const gain = cell.gainBase ?? 0
    sumMonthlyRet += ret
    if (ret > 0) winMonthsCount++

    const [yr, mo] = cell.monthKey.split('-').map(Number)
    const label = `${THAI_SHORT_MONTHS[mo - 1]} ${yr}`

    if (!bestMonth || ret > bestMonth.returnPct) {
      bestMonth = { monthKey: cell.monthKey, label, returnPct: ret, gainBase: gain }
    }
    if (!worstMonth || ret < worstMonth.returnPct) {
      worstMonth = { monthKey: cell.monthKey, label, returnPct: ret, gainBase: gain }
    }
  }

  const totalDaysActive = winDays + lossDays + flatDays
  const winDaysPercent =
    totalDaysActive > 0 ? Number(((winDays / totalDaysActive) * 100).toFixed(1)) : 0
  const totalMonthsCount = allMonthCells.length
  const winMonthsPercent =
    totalMonthsCount > 0 ? Number(((winMonthsCount / totalMonthsCount) * 100).toFixed(1)) : 0
  const avgMonthlyReturnPercent =
    totalMonthsCount > 0 ? Number((sumMonthlyRet / totalMonthsCount).toFixed(2)) : 0

  return {
    daysMeasured,
    tradingPoints: e - s + 1,
    twrPercent: Number(twrPct.toFixed(2)),
    cagrPercent,
    mwrPercent: Number(mwrPct.toFixed(2)),
    xirrPercent,
    srPercent: Number(srPct.toFixed(2)),
    benchmarkTwrPercent: Number(benchTwrPct.toFixed(2)),
    benchmarkMwrPercent: Number(benchMwrPct.toFixed(2)),
    alphaTwrPercent: Number((twrPct - benchTwrPct).toFixed(2)),
    alphaMwrPercent: Number((mwrPct - benchMwrPct).toFixed(2)),
    maxDrawdownPercent: Number(maxDd.toFixed(2)),
    maxDrawdownPeakDate: ddPeakDate,
    maxDrawdownTroughDate: ddTroughDate,
    maxDrawdownRecoveryDate: ddRecoveryDate,
    isRecovered: !trackingRecovery && currentDrawdownPercent > -0.05,
    currentDrawdownPercent: Number(currentDrawdownPercent.toFixed(2)),
    benchMaxDrawdownPercent: Number(benchMaxDd.toFixed(2)),
    benchCurrentDrawdownPercent: Number(benchCurrentDrawdownPercent.toFixed(2)),
    annualizedVolatilityPercent,
    benchVolatilityPercent,
    sharpeRatio,
    sortinoRatio,
    beta,
    correlation,
    winDays,
    lossDays,
    flatDays,
    winDaysPercent,
    bestDay,
    worstDay,
    bestMonth,
    worstMonth,
    winMonthsCount,
    totalMonthsCount,
    winMonthsPercent,
    avgMonthlyReturnPercent,
  }
}

/**
 * Groups daily analytics series into a Years × Months (1..12) return & gain matrix (newest year first).
 */
export function computeMonthlyReturnMatrix(
  series: DailyAnalyticsPoint[],
  seedPrevPoint?: DailyAnalyticsPoint
): YearlyReturnMatrixRow[] {
  if (!series || series.length === 0) return []

  const monthBuckets = new Map<
    string,
    {
      year: number
      month: number
      firstIdx: number
      lastIdx: number
      netFlow: number
      divFlow: number
    }
  >()

  for (let i = 0; i < series.length; i++) {
    const p = series[i]
    const monthKey = p.date.slice(0, 7)
    const year = Number(p.date.slice(0, 4))
    const month = Number(p.date.slice(5, 7))
    const existing = monthBuckets.get(monthKey)
    if (!existing) {
      monthBuckets.set(monthKey, {
        year,
        month,
        firstIdx: i,
        lastIdx: i,
        netFlow: p.netCashFlow,
        divFlow: p.cashBalance > 0 ? 0 : p.dividendFlow,
      })
    } else {
      existing.lastIdx = i
      existing.netFlow += p.netCashFlow
      existing.divFlow += p.cashBalance > 0 ? 0 : p.dividendFlow
    }
  }

  const byYear = new Map<number, YearlyReturnMatrixRow>()

  for (const [monthKey, bucket] of monthBuckets.entries()) {
    const prevPt =
      bucket.firstIdx > 0 ? series[bucket.firstIdx - 1] : seedPrevPoint ?? null
    const endPt = series[bucket.lastIdx]

    const startVal = prevPt ? prevPt.portfolioValue : 0
    const endVal = endPt.portfolioValue
    const gainBase = endVal - startVal - bucket.netFlow + bucket.divFlow

    const startTwr = prevPt && prevPt.twrIndex > 0 ? prevPt.twrIndex : 1.0
    const startBenchTwr = prevPt && prevPt.benchTwrIndex > 0 ? prevPt.benchTwrIndex : 1.0

    const hasActivity = startVal > 1 || endVal > 1 || Math.abs(bucket.netFlow) > 1
    const returnPct = hasActivity
      ? Number(((endPt.twrIndex / startTwr - 1) * 100).toFixed(2))
      : null
    const benchReturnPct = hasActivity
      ? Number(((endPt.benchTwrIndex / startBenchTwr - 1) * 100).toFixed(2))
      : null

    if (!byYear.has(bucket.year)) {
      byYear.set(bucket.year, {
        year: bucket.year,
        months: {},
        annualReturnPct: null,
        annualGainBase: 0,
        annualBenchReturnPct: null,
        annualAlphaPct: null,
      })
    }

    byYear.get(bucket.year)!.months[bucket.month] = {
      month: bucket.month,
      monthKey,
      returnPct,
      gainBase: Number(gainBase.toFixed(2)),
      benchReturnPct,
      startValue: Number(startVal.toFixed(2)),
      endValue: Number(endVal.toFixed(2)),
      netFlow: Number(bucket.netFlow.toFixed(2)),
    }
  }

  // Compute annual totals per year
  const yearBuckets = new Map<
    number,
    { firstIdx: number; lastIdx: number; netFlow: number; divFlow: number }
  >()
  for (let i = 0; i < series.length; i++) {
    const p = series[i]
    const yr = Number(p.date.slice(0, 4))
    const existing = yearBuckets.get(yr)
    if (!existing) {
      yearBuckets.set(yr, {
        firstIdx: i,
        lastIdx: i,
        netFlow: p.netCashFlow,
        divFlow: p.cashBalance > 0 ? 0 : p.dividendFlow,
      })
    } else {
      existing.lastIdx = i
      existing.netFlow += p.netCashFlow
      existing.divFlow += p.cashBalance > 0 ? 0 : p.dividendFlow
    }
  }

  for (const [yr, row] of byYear.entries()) {
    const yb = yearBuckets.get(yr)
    if (!yb) continue
    const prevPt = yb.firstIdx > 0 ? series[yb.firstIdx - 1] : seedPrevPoint ?? null
    const endPt = series[yb.lastIdx]

    const startVal = prevPt ? prevPt.portfolioValue : 0
    const endVal = endPt.portfolioValue
    row.annualGainBase = Number((endVal - startVal - yb.netFlow + yb.divFlow).toFixed(2))

    const startTwr = prevPt && prevPt.twrIndex > 0 ? prevPt.twrIndex : 1.0
    const startBenchTwr = prevPt && prevPt.benchTwrIndex > 0 ? prevPt.benchTwrIndex : 1.0

    const annRet = (endPt.twrIndex / startTwr - 1) * 100
    const annBench = (endPt.benchTwrIndex / startBenchTwr - 1) * 100
    row.annualReturnPct = Number(annRet.toFixed(2))
    row.annualBenchReturnPct = Number(annBench.toFixed(2))
    row.annualAlphaPct = Number((annRet - annBench).toFixed(2))
  }

  return Array.from(byYear.values()).sort((a, b) => b.year - a.year)
}
