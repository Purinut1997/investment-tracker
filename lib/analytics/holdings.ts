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

export async function calculateUserHoldings(
  userId: string,
  baseCurrency = 'THB'
): Promise<PortfolioHoldingsResult> {
  // 1. Fetch all user transactions ordered chronologically
  const txns = await prisma.transaction.findMany({
    where: { userId },
    orderBy: { txnDate: 'asc' },
    include: {
      asset: true,
      account: true,
    },
  })

  // 2. Aggregate quantity and cost per asset using average cost basis
  const assetMap = new Map<
    string,
    {
      asset: any
      quantity: number
      totalCost: number
    }
  >()

  for (const txn of txns) {
    const assetId = txn.assetId
    if (!assetMap.has(assetId)) {
      assetMap.set(assetId, {
        asset: txn.asset,
        quantity: 0,
        totalCost: 0,
      })
    }

    const state = assetMap.get(assetId)!
    const qty = Number(txn.quantity)
    const price = Number(txn.pricePerUnit)
    const fee = Number(txn.fee || 0)

    if (txn.txnType === 'BUY') {
      state.quantity += qty
      state.totalCost += qty * price + fee
    } else if (txn.txnType === 'SELL') {
      if (state.quantity > 0) {
        const avg = state.totalCost / state.quantity
        state.quantity -= qty
        state.totalCost -= qty * avg
        if (state.quantity <= 0.000001) {
          state.quantity = 0
          state.totalCost = 0
        }
      }
    }
  }

  // 3. Fetch FX exchange rate if asset currency differs from baseCurrency
  const usdThbRate = await getExchangeRate('USD', baseCurrency) ?? 35.5

  // 4. Enrich active holdings with live market prices
  const activeHoldings: HoldingItem[] = []
  let totalValueBase = 0
  let totalCostBase = 0

  for (const [assetId, data] of assetMap.entries()) {
    if (data.quantity <= 0.00001) continue

    const priceData = await getCachedOrFetchPrice(assetId)
    const currentPrice = priceData?.price ?? (data.totalCost / data.quantity)
    const avgCost = data.quantity > 0 ? data.totalCost / data.quantity : 0
    const currentValue = data.quantity * currentPrice
    const unrealizedPnL = currentValue - data.totalCost
    const unrealizedPnLPercent = data.totalCost > 0 ? (unrealizedPnL / data.totalCost) * 100 : 0

    // Convert to base currency
    const isUsd = data.asset.currency === 'USD' || data.asset.market === 'US'
    const fx = isUsd ? usdThbRate : 1.0
    const currentValueBase = currentValue * fx
    const costBase = data.totalCost * fx
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
      quantity: data.quantity,
      avgCost,
      totalCost: data.totalCost,
      currentPrice,
      currentValue,
      currentValueBase,
      unrealizedPnL,
      unrealizedPnLBase,
      unrealizedPnLPercent,
      allocationPercent: 0, // calculated below
      isStale: priceData?.isStale ?? false,
    })
  }

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

  return {
    holdings: activeHoldings,
    totalValueBase,
    totalCostBase,
    unrealizedPnLBase,
    unrealizedPnLPercent,
    baseCurrency,
  }
}
