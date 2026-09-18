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
  const usdThbRate = await getExchangeRate('USD', baseCurrency) ?? 35.5

  // 4. Enrich active holdings with live market prices
  const activeHoldings: HoldingItem[] = []
  let totalValueBase = 0
  let totalCostBase = 0

  for (const [assetId, data] of assetMap.entries()) {
    const remainingQty = data.lots.reduce((acc, lot) => acc + lot.quantity, 0)
    if (remainingQty <= 0.00001) continue

    const totalCost = data.lots.reduce((acc, lot) => acc + lot.quantity * lot.pricePerUnit, 0)
    const avgCost = remainingQty > 0 ? totalCost / remainingQty : 0

    const priceData = await getCachedOrFetchPrice(assetId)
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
