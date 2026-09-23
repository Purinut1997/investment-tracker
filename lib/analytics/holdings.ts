/**
 * lib/analytics/holdings.ts
 * Computes portfolio holdings, average cost, live market value, and unrealized P&L.
 */

import { prisma } from '@/lib/prisma'
import { getCachedOrFetchPrice } from '@/lib/market-data/cache-layer'
import { getExchangeRate } from '@/lib/market-data/frankfurter'

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
}

export interface PortfolioHoldingsResult {
  holdings: HoldingItem[]
  totalValueBase: number
  totalCostBase: number
  unrealizedPnLBase: number
  unrealizedPnLPercent: number
  baseCurrency: string
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

import { invalidateAssetPerformanceCache } from '@/lib/analytics/asset-performance'

export function invalidateUserPortfolioCache(userId?: string) {
  invalidateAssetPerformanceCache(userId)
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

export async function calculateUserHoldings(
  userId: string,
  baseCurrency = 'THB',
  forceRefresh = false
): Promise<PortfolioHoldingsResult> {
  const cacheKey = `${userId}_${baseCurrency}`
  const now = Date.now()

  // Return cached result if available and fresh (<60s)
  if (!forceRefresh) {
    const cached = userHoldingsCache.get(cacheKey)
    if (cached && now - cached.timestamp < HOLDINGS_CACHE_TTL_MS) {
      return cached.result
    }
  }

  // Deduplicate concurrent in-flight requests for the same user
  if (inFlightHoldings.has(cacheKey)) {
    return inFlightHoldings.get(cacheKey)!
  }

  const computePromise = (async () => {
    try {
      // 1. Fetch all user transactions ordered chronologically
      const txns = await prisma.transaction.findMany({
        where: { userId },
        orderBy: { txnDate: 'asc' },
        include: {
          asset: true,
          account: true,
        },
      })

  // 2. Aggregate quantity and cost per asset using FIFO (First-In, First-Out) matching
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
    }
  >()

  for (const txn of txns) {
    const assetId = txn.assetId
    if (!assetMap.has(assetId)) {
      assetMap.set(assetId, {
        asset: txn.asset,
        lots: [],
      })
    }

    const state = assetMap.get(assetId)!
    const qty = Number(txn.quantity)
    const price = Number(txn.pricePerUnit)

    if (txn.txnType === 'BUY') {
      state.lots.push({
        quantity: qty,
        pricePerUnit: price,
      })
    } else if (txn.txnType === 'SELL') {
      let qtyToSell = qty
      while (qtyToSell > 0.0000001 && state.lots.length > 0) {
        const lot = state.lots[0]
        if (lot.quantity <= qtyToSell) {
          qtyToSell -= lot.quantity
          state.lots.shift()
        } else {
          lot.quantity -= qtyToSell
          qtyToSell = 0
        }
      }
    }
  }

  // 3. Fetch FX exchange rate if asset currency differs from baseCurrency
  const usdThbRate = (await getExchangeRate('USD', baseCurrency)) ?? 35.5

  // 4. Filter active holdings with remaining quantity > 0
  const activeEntries = Array.from(assetMap.entries()).filter(([_, data]) => {
    const remainingQty = data.lots.reduce((acc, lot) => acc + lot.quantity, 0)
    return remainingQty > 0.00001
  })

  // Parallelize price fetching for all active assets concurrently
  const priceResults = await Promise.all(
    activeEntries.map(([assetId]) => getCachedOrFetchPrice(assetId, undefined, forceRefresh))
  )

  const activeHoldings: HoldingItem[] = []
  let totalValueBase = 0
  let totalCostBase = 0

  activeEntries.forEach(([assetId, data], idx) => {
    const remainingQty = data.lots.reduce((acc, lot) => acc + lot.quantity, 0)
    const totalCost = data.lots.reduce((acc, lot) => acc + lot.quantity * lot.pricePerUnit, 0)
    const avgCost = remainingQty > 0 ? totalCost / remainingQty : 0

    const priceData = priceResults[idx]
    const currentPrice = priceData?.price ?? avgCost
    const currentValue = remainingQty * currentPrice
    const unrealizedPnL = currentValue - totalCost
    const unrealizedPnLPercent = totalCost > 0 ? (unrealizedPnL / totalCost) * 100 : 0

    // Convert to base currency
    const isUsd = data.asset.currency === 'USD' || data.asset.market === 'US'
    const fx = isUsd ? usdThbRate : 1.0
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
      currency: isUsd ? 'USD' : (data.asset.currency || 'THB'),
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
      isStale: priceData?.isStale ?? false,
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

  const result: PortfolioHoldingsResult = {
    holdings: activeHoldings,
    totalValueBase,
    totalCostBase,
    unrealizedPnLBase,
    unrealizedPnLPercent,
    baseCurrency,
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
