/**
 * lib/analytics/performance.ts
 * Computes real historical portfolio valuation from FIFO holdings + PriceHistory,
 * real S&P 500 Public Market Equivalent (PME) benchmark comparison, and XIRR.
 */

import { prisma } from '@/lib/prisma'
import { getExchangeRate } from '../market-data/frankfurter'

export interface PerformancePoint {
  month: string
  value: number
  benchmark: number
}

const spxMonthlyCache = new Map<string, { closes: Map<string, number>; timestamp: number }>()
const SPX_CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes

async function fetchSpxMonthlyCloses(): Promise<Map<string, number>> {
  const cached = spxMonthlyCache.get('SPX_2Y')
  if (cached && Date.now() - cached.timestamp < SPX_CACHE_TTL_MS) {
    return cached.closes
  }

  const closesMap = new Map<string, number>()
  try {
    const url = 'https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC?range=2y&interval=1mo'
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(3500),
      next: { revalidate: 1800 },
    } as RequestInit)

    if (res.ok) {
      const json = await res.json()
      const result = json?.chart?.result?.[0]
      const timestamps: number[] = result?.timestamp || []
      const closes: Array<number | null> = result?.indicators?.quote?.[0]?.close || []

      for (let i = 0; i < timestamps.length; i++) {
        const ts = timestamps[i]
        const close = closes[i]
        if (ts && close !== null && close !== undefined && !isNaN(close) && close > 0) {
          const d = new Date(ts * 1000)
          const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
          closesMap.set(key, Number(close))
        }
      }

      if (closesMap.size > 0) {
        spxMonthlyCache.set('SPX_2Y', { closes: closesMap, timestamp: Date.now() })
      }
    }
  } catch {
    // Gracefully fall back if offline / rate-limited
  }

  return closesMap
}

/**
 * Calculates Money-Weighted Annualized Return (XIRR) using Newton-Raphson with bisection fallback.
 * Cash flows: negative for outflows (investments/buys), positive for inflows (sells/dividends/ending value).
 */
export function calculatePortfolioXIRR(
  cashFlows: Array<{ amount: number; date: Date }>
): number {
  if (!cashFlows || cashFlows.length < 2) return 0

  const valid = cashFlows
    .filter((cf) => Number.isFinite(cf.amount) && cf.amount !== 0 && !isNaN(cf.date.getTime()))
    .sort((a, b) => a.date.getTime() - b.date.getTime())

  if (valid.length < 2) return 0
  const hasPos = valid.some((c) => c.amount > 0)
  const hasNeg = valid.some((c) => c.amount < 0)
  if (!hasPos || !hasNeg) return 0

  const t0 = valid[0].date.getTime()
  const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000
  const points = valid.map((cf) => ({
    amount: cf.amount,
    years: (cf.date.getTime() - t0) / MS_PER_YEAR,
  }))

  const npv = (rate: number) => {
    const base = 1 + rate
    if (base <= 0) return Number.POSITIVE_INFINITY
    let sum = 0
    for (const p of points) {
      sum += p.amount / Math.pow(base, p.years)
    }
    return sum
  }

  const dnpv = (rate: number) => {
    const base = 1 + rate
    if (base <= 0) return 0
    let sum = 0
    for (const p of points) {
      if (p.years !== 0) {
        sum -= (p.years * p.amount) / Math.pow(base, p.years + 1)
      }
    }
    return sum
  }

  let rate = 0.1
  for (let i = 0; i < 50; i++) {
    const f = npv(rate)
    if (Math.abs(f) < 1e-6) {
      return Number((rate * 100).toFixed(2))
    }
    const df = dnpv(rate)
    if (!Number.isFinite(df) || Math.abs(df) < 1e-10) break
    const nextRate = rate - f / df
    if (!Number.isFinite(nextRate) || nextRate <= -0.95 || nextRate > 10) break
    if (Math.abs(nextRate - rate) < 1e-7) {
      return Number((nextRate * 100).toFixed(2))
    }
    rate = nextRate
  }

  // Bisection fallback over [-0.95, 5.0]
  let low = -0.95
  let high = 5.0
  let fLow = npv(low)
  const fHigh = npv(high)
  if (!Number.isFinite(fLow) || !Number.isFinite(fHigh) || fLow * fHigh > 0) {
    return 0
  }

  for (let i = 0; i < 60; i++) {
    const mid = (low + high) / 2
    const fMid = npv(mid)
    if (Math.abs(fMid) < 1e-5 || (high - low) < 1e-6) {
      return Number((mid * 100).toFixed(2))
    }
    if (fLow * fMid <= 0) {
      high = mid
    } else {
      low = mid
      fLow = fMid
    }
  }

  return Number((((low + high) / 2) * 100).toFixed(2))
}

function getMonthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

function enumerateMonthKeys(startKey: string, endKey: string, maxMonths = 60): string[] {
  const [sY, sM] = startKey.split('-').map(Number)
  const [eY, eM] = endKey.split('-').map(Number)
  const totalDiff = (eY - sY) * 12 + (eM - sM)
  const startOffset = totalDiff >= maxMonths ? totalDiff - (maxMonths - 1) : 0

  const result: string[] = []
  let y = sY + Math.floor((sM - 1 + startOffset) / 12)
  let m = ((sM - 1 + startOffset) % 12) + 1

  while (y < eY || (y === eY && m <= eM)) {
    result.push(`${y}-${String(m).padStart(2, '0')}`)
    m++
    if (m > 12) {
      m = 1
      y++
    }
  }
  return result
}

export async function calculatePortfolioPerformance(
  userId: string,
  currentPortfolioValue: number,
  baseCurrency = 'THB',
  preloadedTxns?: any[]
): Promise<PerformancePoint[]> {
  const rawTxns =
    preloadedTxns ??
    (await prisma.transaction.findMany({
      where: { userId },
      orderBy: { txnDate: 'asc' },
      include: { asset: true },
    }))

  if (!rawTxns || rawTxns.length === 0) {
    return []
  }

  const txns = [...rawTxns].sort(
    (a: any, b: any) => new Date(a.txnDate).getTime() - new Date(b.txnDate).getTime()
  )

  const distinctAssetIds = Array.from(
    new Set(txns.map((t: any) => t.assetId).filter(Boolean))
  ) as string[]

  const [usdThbRateRaw, priceHistoryRows, spxCloses] = await Promise.all([
    getExchangeRate('USD', baseCurrency).catch(() => null),
    distinctAssetIds.length > 0
      ? prisma.priceHistory.findMany({
          where: {
            assetId: { in: distinctAssetIds },
            closePrice: { gt: 0 },
          },
          orderBy: { priceDate: 'asc' },
          select: { assetId: true, priceDate: true, closePrice: true },
        })
      : Promise.resolve([]),
    fetchSpxMonthlyCloses(),
  ])

  const usdThbRate = usdThbRateRaw ?? 35.5
  const assetIsUsdMap = new Map<string, boolean>()
  for (const t of txns) {
    if (t.assetId && !assetIsUsdMap.has(t.assetId)) {
      const isUsd =
        t.asset?.currency === 'USD' ||
        t.asset?.market === 'US' ||
        t.asset?.market === 'CRYPTO'
      assetIsUsdMap.set(t.assetId, Boolean(isUsd))
    }
  }

  // Group PriceHistory by assetId -> monthKey -> closePrice in baseCurrency
  const assetMonthlyPrices = new Map<string, Map<string, number>>()
  for (const row of priceHistoryRows) {
    const mKey = getMonthKey(new Date(row.priceDate))
    const isUsd = assetIsUsdMap.get(row.assetId) ?? false
    const fx = isUsd ? usdThbRate : 1.0
    if (!assetMonthlyPrices.has(row.assetId)) {
      assetMonthlyPrices.set(row.assetId, new Map())
    }
    assetMonthlyPrices.get(row.assetId)!.set(mKey, Number(row.closePrice) * fx)
  }

  // Group transactions by monthKey
  const txnsByMonth = new Map<string, any[]>()
  for (const t of txns) {
    const mKey = getMonthKey(new Date(t.txnDate))
    if (!txnsByMonth.has(mKey)) txnsByMonth.set(mKey, [])
    txnsByMonth.get(mKey)!.push(t)
  }

  const firstTxnMonth = getMonthKey(new Date(txns[0].txnDate))
  const lastTxnMonth = getMonthKey(new Date(txns[txns.length - 1].txnDate))
  const currentMonth = getMonthKey(new Date())
  const endMonth = lastTxnMonth > currentMonth ? lastTxnMonth : currentMonth
  const allMonthKeys = enumerateMonthKeys(firstTxnMonth, endMonth, 60)

  if (allMonthKeys.length === 0) return []

  // Replay pre-window transactions if user has >60 months of history
  const firstWindowKey = allMonthKeys[0]
  const fifoLots = new Map<string, Array<{ qty: number; unitCostBase: number }>>()
  const lastKnownPriceBase = new Map<string, number>()

  const applyTxnToState = (t: any) => {
    const assetId = t.assetId
    if (!assetId) return 0
    if (!fifoLots.has(assetId)) fifoLots.set(assetId, [])
    const lots = fifoLots.get(assetId)!

    const isUsd =
      t.asset?.currency === 'USD' ||
      t.asset?.market === 'US' ||
      t.asset?.market === 'CRYPTO'
    const fx = isUsd ? usdThbRate : 1.0
    const qty = Number(t.quantity || 0)
    const price = Number(t.pricePerUnit || 0)
    const fee = Number(t.fee || 0)

    if (t.txnType === 'BUY' && qty > 0) {
      const totalBuyCostBase = (qty * price + fee) * fx
      lots.push({ qty, unitCostBase: totalBuyCostBase / qty })
      lastKnownPriceBase.set(assetId, price * fx)
      return totalBuyCostBase
    }

    if (t.txnType === 'SELL' && qty > 0) {
      let rem = qty
      while (rem > 0.0000001 && lots.length > 0) {
        const lot = lots[0]
        if (lot.qty <= rem) {
          rem -= lot.qty
          lots.shift()
        } else {
          lot.qty -= rem
          rem = 0
        }
      }
      const proceedsBase = Number(t.totalAmount || qty * price - fee) * fx
      if (price > 0) lastKnownPriceBase.set(assetId, price * fx)
      return -proceedsBase
    }

    return 0
  }

  for (const t of txns) {
    const mKey = getMonthKey(new Date(t.txnDate))
    if (mKey < firstWindowKey) {
      applyTxnToState(t)
    } else {
      break
    }
  }

  const monthFormatter = new Intl.DateTimeFormat('th-TH', {
    month: 'short',
    year: '2-digit',
  })

  // Initialize S&P 500 PME benchmark tracking
  const sortedSpxKeys = Array.from(spxCloses.keys()).sort()
  let lastKnownSpx = sortedSpxKeys.length > 0 ? spxCloses.get(sortedSpxKeys[0])! : 100
  let benchmarkUnits = 0
  const result: PerformancePoint[] = []

  allMonthKeys.forEach((key, index) => {
    const monthTxns = txnsByMonth.get(key) || []
    let monthNetFlowBase = 0
    for (const t of monthTxns) {
      monthNetFlowBase += applyTxnToState(t)
    }

    // Update last known market prices from PriceHistory for this month
    for (const [assetId, monthMap] of assetMonthlyPrices.entries()) {
      const histClose = monthMap.get(key)
      if (histClose && histClose > 0) {
        lastKnownPriceBase.set(assetId, histClose)
      }
    }

    // Compute portfolio valuation at end of month
    let monthVal = 0
    for (const [assetId, lots] of fifoLots.entries()) {
      const remQty = lots.reduce((sum, l) => sum + l.qty, 0)
      if (remQty <= 0.00001) continue
      const costSum = lots.reduce((sum, l) => sum + l.qty * l.unitCostBase, 0)
      const knownPrice = lastKnownPriceBase.get(assetId)
      monthVal += knownPrice && knownPrice > 0 ? remQty * knownPrice : costSum
    }

    // Update S&P 500 PME index & units
    const realSpx = spxCloses.get(key)
    const currentSpx = realSpx && realSpx > 0 ? realSpx : lastKnownSpx * (spxCloses.size === 0 ? 1.0075 : 1.0)
    lastKnownSpx = currentSpx

    if (currentSpx > 0 && monthNetFlowBase !== 0) {
      benchmarkUnits = Math.max(0, benchmarkUnits + monthNetFlowBase / currentSpx)
    }

    const isLatest = index === allMonthKeys.length - 1
    const val =
      isLatest && currentPortfolioValue > 0
        ? Math.round(currentPortfolioValue)
        : Math.round(monthVal)
    const benchmarkVal = Math.round(benchmarkUnits * currentSpx)

    const [year, month] = key.split('-').map(Number)
    const label = monthFormatter.format(new Date(year, month - 1, 15))

    result.push({
      month: label,
      value: val,
      benchmark: benchmarkVal,
    })
  })

  return result
}
