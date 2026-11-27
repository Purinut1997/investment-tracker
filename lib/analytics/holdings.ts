/**
 * lib/analytics/holdings.ts
 * Computes portfolio holdings, average cost, live market value, and unrealized P&L.
 */

import { prisma } from '../prisma'
import { getBatchCachedOrFetchPrices } from '../market-data/cache-layer'
import { describeValuationRate, getValuationRates } from '../market-data/frankfurter'
import { syncAssetSplitsFromYahoo } from '../market-data/split-sync'
import {
  AppliedSplitBadge,
  StockSplitEvent,
  getSplitDateKey,
  getSplitMultiplier,
  getUserAssetSplitsMap,
  mergeTxnsAndSplits,
} from './stock-splits'

export interface HoldingItem {
  assetId: string
  ticker: string
  assetName: string
  market: string
  assetType: string
  currency: string
  quantity: number
  avgCost: number
  totalCost: number
  currentPrice: number
  currentValue: number
  currentValueBase: number // converted to user's base currency (THB)
  unrealizedPnL: number // in asset's native currency (e.g. USD)
  unrealizedPnLBase: number // converted to base currency (THB)
  unrealizedPnLPercent: number
  allocationPercent: number
  isStale: boolean
  fxToBase?: number
  priceSource?: string
  priceObservedAt?: string | null
  priceRecordedAt?: string | null
  appliedSplits?: AppliedSplitBadge[]
}

export interface PortfolioHoldingsResult {
  holdings: HoldingItem[]
  totalValueBase: number
  totalCostBase: number
  unrealizedPnLBase: number
  unrealizedPnLPercent: number
  baseCurrency: string
  valuationIssues?: string[]
  fxRates?: Awaited<ReturnType<typeof getValuationRates>>
  txns?: any[]
  splitsByAssetRecord?: Record<string, StockSplitEvent[]>
}

// In-memory cache for computed user holdings (60-second TTL)
// Key: `${userId}_${baseCurrency}`
interface HoldingsCacheEntry {
  result: PortfolioHoldingsResult
  timestamp: number
}

const userHoldingsCache = new Map<string, HoldingsCacheEntry>()
const inFlightHoldings = new Map<string, Promise<PortfolioHoldingsResult>>()
const HOLDINGS_CACHE_TTL_MS = 60 * 1000

// In-memory cache for computed user summary (60-second TTL)
const userSummaryCache = new Map<string, { result: any; timestamp: number }>()
const inFlightSummary = new Map<string, Promise<any>>()
const SUMMARY_CACHE_TTL_MS = 60 * 1000

export function getUserSummaryCache(userId: string, baseCurrency: string) {
  const entry = userSummaryCache.get(`${userId}_${baseCurrency}`)
  if (entry && Date.now() - entry.timestamp < SUMMARY_CACHE_TTL_MS) {
    return entry.result
  }
  return null
}

export function setUserSummaryCache(userId: string, baseCurrency: string, result: any) {
  userSummaryCache.set(`${userId}_${baseCurrency}`, { result, timestamp: Date.now() })
}

export function getInFlightSummary(userId: string, baseCurrency: string) {
  return inFlightSummary.get(`${userId}_${baseCurrency}`) || null
}

export function setInFlightSummary(userId: string, baseCurrency: string, promise: Promise<any>) {
  const key = `${userId}_${baseCurrency}`
  inFlightSummary.set(key, promise)
  promise.finally(() => inFlightSummary.delete(key))
}

import { invalidateAssetPerformanceCache } from './asset-performance'
import { invalidatePortfolioAnalyticsCache } from './analytics-cache'
import { invalidateUnifiedContextCache } from '../ai/unified-context'

export function invalidateUserPortfolioCache(userId?: string) {
  invalidateAssetPerformanceCache(userId)
  invalidatePortfolioAnalyticsCache(userId)
  invalidateUnifiedContextCache(userId)
  if (userId) {
    for (const key of userHoldingsCache.keys()) {
      if (key.startsWith(`${userId}_`)) {
        userHoldingsCache.delete(key)
      }
    }
    for (const key of userSummaryCache.keys()) {
      if (key.startsWith(`${userId}_`)) {
        userSummaryCache.delete(key)
      }
    }
  } else {
    userHoldingsCache.clear()
    userSummaryCache.clear()
  }
}

export const invalidateUserHoldingsCache = invalidateUserPortfolioCache

/**
 * Reconciles a HoldingItem with an updated market price so that
 * currentPrice, currentValue, currentValueBase, unrealizedPnL, unrealizedPnLBase,
 * and unrealizedPnLPercent are always mathematically consistent across all views.
 */
export function reconcileHoldingPrice(
  holding: HoldingItem,
  newPrice: number,
  usdThbRate = 35.5
): HoldingItem {
  if (!newPrice || newPrice <= 0 || isNaN(newPrice)) {
    return holding
  }

  const quantity = Number(holding.quantity) || 0
  const totalCost = Number(holding.totalCost) || quantity * (Number(holding.avgCost) || 0)
  const currentValue = quantity * newPrice
  const unrealizedPnL = currentValue - totalCost
  const unrealizedPnLPercent = totalCost > 0 ? (unrealizedPnL / totalCost) * 100 : 0

  const isUsd = holding.currency === 'USD' || holding.market === 'US' || holding.market === 'CRYPTO'
  const fx = holding.fxToBase ?? (isUsd ? usdThbRate : 1.0)
  const currentValueBase = currentValue * fx
  const costBase = totalCost * fx
  const unrealizedPnLBase = currentValueBase - costBase

  return {
    ...holding,
    currentPrice: newPrice,
    currentValue,
    currentValueBase,
    unrealizedPnL,
    unrealizedPnLBase,
    unrealizedPnLPercent,
    isStale: false,
  }
}

export function calculateSingleAssetFifoPosition(
  txns: Array<{
    txnType: string
    quantity: unknown
    pricePerUnit: unknown
    txnDate?: Date | string
    assetId?: string
  }>,
  currentPrice: number,
  splits: StockSplitEvent[] = []
): {
  shares: number
  avgCost: number
  totalCost: number
  currentValue: number
  unrealizedGain: number
  unrealizedGainPercent: number
} | null {
  const lots: Array<{ qty: number; price: number }> = []
  const normalizedTxns = txns.map((t, idx) => ({
    ...t,
    txnDate: t.txnDate ?? new Date(idx),
  }))
  const timeline = mergeTxnsAndSplits(normalizedTxns, splits)

  for (const event of timeline) {
    if (event.kind === 'SPLIT') {
      const mult = getSplitMultiplier(event.split)
      if (mult !== 1 && lots.length > 0) {
        for (const lot of lots) {
          lot.qty *= mult
          lot.price /= mult
        }
      }
      continue
    }

    const t = event.txn
    const qty = Number(t.quantity || 0)
    const price = Number(t.pricePerUnit || 0)
    if (t.txnType === 'BUY' && qty > 0) {
      lots.push({ qty, price })
    } else if (t.txnType === 'SELL' && qty > 0) {
      let rem = qty
      while (rem > 0.000001 && lots.length > 0) {
        if (lots[0].qty <= rem) {
          rem -= lots[0].qty
          lots.shift()
        } else {
          lots[0].qty -= rem
          rem = 0
        }
      }
    }
  }
  const totalShares = lots.reduce((acc, l) => acc + l.qty, 0)
  const totalCostBasis = lots.reduce((acc, l) => acc + l.qty * l.price, 0)
  if (totalShares <= 0.0000001) return null
  const avg = totalCostBasis / totalShares
  const curVal = totalShares * currentPrice
  const gain = curVal - totalCostBasis
  const gainPct = totalCostBasis > 0 ? (gain / totalCostBasis) * 100 : 0
  return {
    shares: Number(totalShares.toFixed(6)),
    avgCost: Number(avg.toFixed(2)),
    totalCost: Number(totalCostBasis.toFixed(2)),
    currentValue: Number(curVal.toFixed(2)),
    unrealizedGain: Number(gain.toFixed(2)),
    unrealizedGainPercent: Number(gainPct.toFixed(2)),
  }
}

export async function calculateUserHoldings(
  userId: string,
  baseCurrency = 'THB',
  forceRefresh = false,
  preloadedTxns?: any[]
): Promise<PortfolioHoldingsResult> {
  const cacheKey = `${userId}_${baseCurrency}`
  const now = Date.now()

  // Return cached result if available and fresh (<60s)
  if (!forceRefresh && !preloadedTxns) {
    const cached = userHoldingsCache.get(cacheKey)
    if (cached && now - cached.timestamp < HOLDINGS_CACHE_TTL_MS) {
      return cached.result
    }
  }

  // Deduplicate concurrent in-flight requests for the same user
  if (!forceRefresh && !preloadedTxns && inFlightHoldings.has(cacheKey)) {
    return inFlightHoldings.get(cacheKey)!
  }

  const computePromise = (async () => {
    try {
      // 1. Fetch all user transactions ordered chronologically (or reuse preloaded)
      const txns = preloadedTxns ?? (await prisma.transaction.findMany({
        where: { userId },
        orderBy: { txnDate: 'asc' },
        include: {
          asset: true,
          account: true,
        },
      }))

      // Collect distinct assets & sync Yahoo corporate splits
      const uniqueAssetsMap = new Map<string, { id: string; ticker: string; market: string; assetType?: string }>()
      const txnsByAsset = new Map<string, { asset: any; txns: any[] }>()

      for (const txn of txns) {
        const assetId = txn.assetId
        if (!assetId) continue
        if (!txnsByAsset.has(assetId)) {
          txnsByAsset.set(assetId, { asset: txn.asset, txns: [] })
        }
        txnsByAsset.get(assetId)!.txns.push(txn)

        if (!uniqueAssetsMap.has(assetId) && txn.asset) {
          uniqueAssetsMap.set(assetId, {
            id: assetId,
            ticker: txn.asset.ticker,
            market: txn.asset.market,
            assetType: txn.asset.assetType,
          })
        }
      }

      const uniqueAssets = Array.from(uniqueAssetsMap.values())
      const distinctAssetIds = Array.from(txnsByAsset.keys())

      if (forceRefresh && uniqueAssets.length > 0) {
        await syncAssetSplitsFromYahoo(uniqueAssets, true).catch((err) =>
          console.warn('[holdings split sync warning]', err)
        )
      } else if (uniqueAssets.length > 0) {
        // Non-blocking background auto-discovery so normal page loads stay sub-second
        syncAssetSplitsFromYahoo(uniqueAssets, false)
          .then((res) => {
            if (res.newlyAddedSplits.length > 0) {
              invalidateUserPortfolioCache(userId)
            }
          })
          .catch(() => {})
      }

      const splitsByAsset = await getUserAssetSplitsMap(userId, distinctAssetIds)

  // 2. Aggregate quantity and cost per asset using chronological FIFO + Split timeline
  // Matches Dime and US brokerage cost-basis standard (without fee mixing)
  interface BuyLot {
    quantity: number
    pricePerUnit: number
  }

  const assetMap = new Map<
    string,
    {
      asset: any
      lots: BuyLot[]
      appliedSplits: AppliedSplitBadge[]
    }
  >()

  for (const [assetId, group] of txnsByAsset.entries()) {
    const lots: BuyLot[] = []
    const appliedSplits: AppliedSplitBadge[] = []
    const assetSplits = splitsByAsset.get(assetId) ?? []
    const timeline = mergeTxnsAndSplits(group.txns, assetSplits)

    for (const event of timeline) {
      if (event.kind === 'SPLIT') {
        const mult = getSplitMultiplier(event.split)
        const openQty = lots.reduce((sum, l) => sum + l.quantity, 0)
        if (mult !== 1 && openQty > 0.0000001) {
          for (const lot of lots) {
            lot.quantity *= mult
            lot.pricePerUnit /= mult
          }
          appliedSplits.push({
            splitDate: getSplitDateKey(event.split.splitDate),
            splitRatio: event.split.splitRatio,
            multiplier: mult,
            source: event.split.source || 'auto_yahoo',
          })
        }
        continue
      }

      const txn = event.txn
      const qty = Number(txn.quantity)
      const price = Number(txn.pricePerUnit)

      if (txn.txnType === 'BUY') {
        lots.push({
          quantity: qty,
          pricePerUnit: price,
        })
      } else if (txn.txnType === 'SELL') {
        let qtyToSell = qty
        while (qtyToSell > 0.0000001 && lots.length > 0) {
          const lot = lots[0]
          if (lot.quantity <= qtyToSell) {
            qtyToSell -= lot.quantity
            lots.shift()
          } else {
            lot.quantity -= qtyToSell
            qtyToSell = 0
          }
        }
      }
    }

    assetMap.set(assetId, {
      asset: group.asset,
      lots,
      appliedSplits,
    })
  }

  // 4. Filter active holdings with remaining quantity > 0 (micro-precision for gold/crypto)
  const activeEntries = Array.from(assetMap.entries()).filter(([_, data]) => {
    const remainingQty = data.lots.reduce((acc, lot) => acc + lot.quantity, 0)
    return remainingQty > 0.0000001
  })

  // Batch price lookup: 1 DB query instead of N individual queries (<5ms)
  const activeAssetIds = activeEntries.map(([assetId]) => assetId)
  const assetCurrency = (asset: { currency?: string | null; market: string }) =>
    asset.market === 'US' || asset.market === 'CRYPTO' ? 'USD' : (asset.currency || 'THB').toUpperCase()
  const [priceMap, fxRates] = await Promise.all([
    getBatchCachedOrFetchPrices(activeAssetIds, forceRefresh),
    getValuationRates([...assetMap.values()].map(data => assetCurrency(data.asset)), baseCurrency),
  ])
  const valuationIssues = new Set<string>()

  const activeHoldings: HoldingItem[] = []
  let totalValueBase = 0
  let totalCostBase = 0

  activeEntries.forEach(([assetId, data]) => {
    const remainingQty = data.lots.reduce((acc, lot) => acc + lot.quantity, 0)
    const totalCost = data.lots.reduce((acc, lot) => acc + lot.quantity * lot.pricePerUnit, 0)
    const avgCost = remainingQty > 0 ? totalCost / remainingQty : 0

    const priceData = priceMap.get(assetId)
    const currentPrice = priceData?.price ?? avgCost
    const currentValue = remainingQty * currentPrice
    const unrealizedPnL = currentValue - totalCost
    const unrealizedPnLPercent = totalCost > 0 ? (unrealizedPnL / totalCost) * 100 : 0

    const currency = assetCurrency(data.asset)
    const fxObservation = fxRates[currency] ?? null
    const fx = fxObservation?.rate ?? 0
    const fxIssue = describeValuationRate(currency, baseCurrency, fxObservation)
    if (fxIssue) valuationIssues.add(fxIssue)
    if (!priceData) valuationIssues.add(`${data.asset.ticker} ใช้ต้นทุนแทนราคาตลาด`)
    else if (priceData.isStale || !priceData.observedAt || now - Date.parse(priceData.observedAt) > 4 * 86400_000) valuationIssues.add(`${data.asset.ticker} ใช้ราคาที่เก่าหรือไม่ทราบเวลาสังเกต`)
    const currentValueBase = currentValue * fx
    const costBase = totalCost * fx
    const unrealizedPnLBase = currentValueBase - costBase

    totalValueBase += currentValueBase
    totalCostBase += costBase

    activeHoldings.push({
      assetId,
      ticker: data.asset.ticker,
      assetName: data.asset.assetName,
      market: data.asset.market,
      assetType: data.asset.assetType,
      currency,
      fxToBase: fx,
      priceSource: priceData?.sourceProvider ?? 'ต้นทุนเฉลี่ย',
      priceObservedAt: priceData?.observedAt,
      priceRecordedAt: priceData?.recordedAt,
      quantity: remainingQty,
      avgCost,
      totalCost,
      currentPrice,
      currentValue,
      currentValueBase,
      unrealizedPnL,
      unrealizedPnLBase,
      unrealizedPnLPercent,
      allocationPercent: 0, // calculated below
      isStale: priceData?.isStale ?? true,
      ...(data.appliedSplits.length > 0 ? { appliedSplits: data.appliedSplits } : {}),
    })
  })

  // 5. Calculate % allocation
  if (totalValueBase > 0) {
    for (const h of activeHoldings) {
      h.allocationPercent = (h.currentValueBase / totalValueBase) * 100
    }
  }

  // Sort by highest value
  activeHoldings.sort((a, b) => b.currentValueBase - a.currentValueBase)

  const unrealizedPnLBase = totalValueBase - totalCostBase
  const unrealizedPnLPercent = totalCostBase > 0 ? (unrealizedPnLBase / totalCostBase) * 100 : 0

  const splitsByAssetRecord: Record<string, StockSplitEvent[]> = {}
  for (const [aid, list] of splitsByAsset.entries()) {
    splitsByAssetRecord[aid] = list
  }

  const result: PortfolioHoldingsResult = {
    holdings: activeHoldings,
    totalValueBase,
    totalCostBase,
    unrealizedPnLBase,
    unrealizedPnLPercent,
    baseCurrency,
    txns,
    fxRates,
    valuationIssues: [...valuationIssues],
    splitsByAssetRecord,
  }

    // Cache computed result
    userHoldingsCache.set(cacheKey, { result, timestamp: now })

    return result
  } finally {
    inFlightHoldings.delete(cacheKey)
  }
})()

inFlightHoldings.set(cacheKey, computePromise)
return computePromise
}
