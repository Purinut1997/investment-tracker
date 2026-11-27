/**
 * lib/analytics/performance.ts
 * Computes real historical portfolio valuation from FIFO holdings + PriceHistory,
 * real S&P 500 Public Market Equivalent (PME) benchmark comparison, and XIRR.
 */

import { prisma } from '@/lib/prisma'
import { getExchangeRate } from '../market-data/frankfurter'
import {
  StockSplitEvent,
  getSplitMultiplier,
  getUserAssetSplitsMap,
  mergeTxnsAndSplits,
  normalizeSplitDate,
  toSplitsMap,
} from './stock-splits'
import type { PerformancePoint } from './quant-metrics'

export * from './quant-metrics'

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
  preloadedTxns?: any[],
  preloadedSplitsByAsset?: Map<string, StockSplitEvent[]> | Record<string, StockSplitEvent[]>
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

  const [usdThbRateRaw, priceHistoryRows, spxCloses, loadedSplitsMap] = await Promise.all([
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
    preloadedSplitsByAsset
      ? Promise.resolve(toSplitsMap(preloadedSplitsByAsset))
      : getUserAssetSplitsMap(userId, distinctAssetIds),
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

  // Group PriceHistory by assetId -> monthKey -> latest { priceDate, priceBase } in baseCurrency
  const assetMonthlyPrices = new Map<string, Map<string, { priceDate: Date; priceBase: number }>>()
  for (const row of priceHistoryRows) {
    const rowDate = new Date(row.priceDate)
    const mKey = getMonthKey(rowDate)
    const isUsd = assetIsUsdMap.get(row.assetId) ?? false
    const fx = isUsd ? usdThbRate : 1.0
    if (!assetMonthlyPrices.has(row.assetId)) {
      assetMonthlyPrices.set(row.assetId, new Map())
    }
    assetMonthlyPrices.get(row.assetId)!.set(mKey, {
      priceDate: rowDate,
      priceBase: Number(row.closePrice) * fx,
    })
  }

  const allSplits: StockSplitEvent[] = []
  for (const list of loadedSplitsMap.values()) {
    allSplits.push(...list)
  }

  // Merge all transactions and split events chronologically (SPLIT before same-day TXN)
  const timeline = mergeTxnsAndSplits(txns, allSplits)

  const eventsByMonth = new Map<string, typeof timeline>()
  for (const ev of timeline) {
    const mKey = getMonthKey(new Date(ev.dateMs))
    if (!eventsByMonth.has(mKey)) eventsByMonth.set(mKey, [])
    eventsByMonth.get(mKey)!.push(ev)
  }

  const firstTxnMonth = getMonthKey(new Date(txns[0].txnDate))
  const lastTxnMonth = getMonthKey(new Date(txns[txns.length - 1].txnDate))
  const currentMonth = getMonthKey(new Date())
  const endMonth = lastTxnMonth > currentMonth ? lastTxnMonth : currentMonth
  const allMonthKeys = enumerateMonthKeys(firstTxnMonth, endMonth, 60)

  if (allMonthKeys.length === 0) return []

  // Replay pre-window transactions & splits if user has >60 months of history
  const firstWindowKey = allMonthKeys[0]
  const fifoLots = new Map<string, Array<{ qty: number; unitCostBase: number }>>()
  const lastKnownPriceBase = new Map<string, number>()

  const applySplitToState = (split: StockSplitEvent): number => {
    const mult = getSplitMultiplier(split)
    if (mult === 1) return 0
    const lots = fifoLots.get(split.assetId)
    if (lots && lots.length > 0) {
      for (const lot of lots) {
        lot.qty *= mult
        lot.unitCostBase /= mult
      }
    }
    const prevPrice = lastKnownPriceBase.get(split.assetId)
    if (prevPrice && prevPrice > 0) {
      lastKnownPriceBase.set(split.assetId, prevPrice / mult)
    }
    return 0
  }

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

  for (const ev of timeline) {
    const mKey = getMonthKey(new Date(ev.dateMs))
    if (mKey < firstWindowKey) {
      if (ev.kind === 'SPLIT') {
        applySplitToState(ev.split)
      } else {
        applyTxnToState(ev.txn)
      }
    } else {
      break
    }
  }

  const monthFormatter = new Intl.DateTimeFormat('th-TH', {
    month: 'short',
    year: '2-digit',
  })

  // Initialize S&P 500 PME benchmark tracking
  let benchmarkHasAllCashFlows = true
  let benchmarkUnits = 0
  const result: PerformancePoint[] = []

  allMonthKeys.forEach((key, index) => {
    const monthEvents = eventsByMonth.get(key) || []
    let monthNetFlowBase = 0
    for (const ev of monthEvents) {
      if (ev.kind === 'SPLIT') {
        monthNetFlowBase += applySplitToState(ev.split)
      } else {
        monthNetFlowBase += applyTxnToState(ev.txn)
      }
    }

    // Update last known market prices from PriceHistory for this month, adjusting pre-split prices if a split happened after priceDate
    for (const [assetId, monthMap] of assetMonthlyPrices.entries()) {
      const entry = monthMap.get(key)
      if (entry && entry.priceBase > 0) {
        let adjustedPriceBase = entry.priceBase
        const assetSplits = loadedSplitsMap.get(assetId) ?? []
        for (const s of assetSplits) {
          const splitDt = normalizeSplitDate(s.splitDate)
          const splitMonthKey = getMonthKey(splitDt)
          if (splitDt.getTime() > entry.priceDate.getTime() && splitMonthKey <= key) {
            const mult = getSplitMultiplier(s)
            if (mult !== 1) adjustedPriceBase /= mult
          }
        }
        lastKnownPriceBase.set(assetId, adjustedPriceBase)
      }
    }

    // Compute portfolio valuation at end of month
    let monthVal = 0
    for (const [assetId, lots] of fifoLots.entries()) {
      const remQty = lots.reduce((sum, l) => sum + l.qty, 0)
      if (remQty <= 0.0000001) continue
      const costSum = lots.reduce((sum, l) => sum + l.qty * l.unitCostBase, 0)
      const knownPrice = lastKnownPriceBase.get(assetId)
      monthVal += knownPrice && knownPrice > 0 ? remQty * knownPrice : costSum
    }

    // Update S&P 500 PME index & units
    const currentSpx = spxCloses.get(key)
    if (monthNetFlowBase !== 0) {
      if (currentSpx && currentSpx > 0) {
        benchmarkUnits = Math.max(0, benchmarkUnits + monthNetFlowBase / currentSpx)
      } else {
        benchmarkHasAllCashFlows = false
      }
    }

    const isLatest = index === allMonthKeys.length - 1
    const val =
      isLatest && currentPortfolioValue > 0
        ? Math.round(currentPortfolioValue)
        : Math.round(monthVal)
    const benchmarkVal = benchmarkHasAllCashFlows && currentSpx && currentSpx > 0 ? Math.round(benchmarkUnits * currentSpx) : null

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
