/**
 * lib/analytics/asset-performance.ts
 * Computes lifetime asset performance breakdown:
 * - Realized gains from closed/sold trades (FIFO matching)
 * - Unrealized gains from active holdings
 * - Accumulated dividends
 * - Overall net return and win-rate statistics
 */

import { prisma } from '../prisma'
import { getBatchCachedOrFetchPrices } from '../market-data/cache-layer'
import { getExchangeRate } from '../market-data/frankfurter'
import {
  AppliedSplitBadge,
  getSplitDateKey,
  getSplitMultiplier,
  getUserAssetSplitsMap,
  mergeTxnsAndSplits,
} from './stock-splits'

export interface RealizedTradeRecord {
  tradeId: string
  sellDate: Date | string
  quantity: number
  sellPrice: number
  sellProceeds: number
  costBasis: number
  realizedGain: number
  realizedGainPercent: number
  fee: number
  holdingDays: number
  // Converted to base currency
  sellProceedsBase: number
  costBasisBase: number
  realizedGainBase: number
}

export interface ActiveLotRecord {
  buyDate: Date | string
  quantity: number
  pricePerUnit: number
  totalCost: number
}

export type AssetTradeStatus = 'HOLDING' | 'PARTIALLY_SOLD' | 'CLOSED'

export interface AssetPerformanceItem {
  assetId: string
  ticker: string
  assetName: string
  market: string
  assetType: string
  currency: string
  status: AssetTradeStatus

  // Realized metrics (sold portions)
  soldQuantity: number
  realizedCost: number
  realizedProceeds: number
  realizedGain: number
  realizedGainPercent: number
  realizedCostBase: number
  realizedProceedsBase: number
  realizedGainBase: number
  realizedTrades: RealizedTradeRecord[]

  // Unrealized metrics (currently held portions)
  currentQuantity: number
  avgCost: number
  currentPrice: number
  currentValue: number
  unrealizedPnL: number
  unrealizedPnLPercent: number
  currentValueBase: number
  costBasisBase: number
  unrealizedPnLBase: number
  activeLots: ActiveLotRecord[]
  isStalePrice: boolean
  appliedSplits?: AppliedSplitBadge[]

  // Dividends
  totalDividends: number
  totalDividendsBase: number
  dividendCount: number

  // Lifetime Total Net Metrics
  totalNetPnL: number
  totalNetPnLBase: number
  totalInvestedCapitalBase: number
  overallReturnPercent: number
}

export interface PortfolioPerformanceSummary {
  assets: AssetPerformanceItem[]
  totalNetPnLBase: number
  totalRealizedGainBase: number
  totalUnrealizedPnLBase: number
  totalDividendsBase: number
  totalCurrentValueBase: number
  totalInvestedCostBase: number
  winRatePercent: number
  winnersCount: number
  losersCount: number
  totalAssetsTraded: number
  activeHoldingsCount: number
  closedPositionsCount: number
  topWinner: { ticker: string; assetName: string; netPnLBase: number; returnPercent: number } | null
  topLoser: { ticker: string; assetName: string; netPnLBase: number; returnPercent: number } | null
  baseCurrency: string
}

// In-memory cache for asset performance results (TTL: 60s)
const perfCache = new Map<string, { result: PortfolioPerformanceSummary; timestamp: number }>()
const inFlightPerf = new Map<string, Promise<PortfolioPerformanceSummary>>()
const PERF_CACHE_TTL_MS = 60 * 1000

export function invalidateAssetPerformanceCache(userId?: string) {
  if (userId) {
    for (const key of perfCache.keys()) {
      if (key.startsWith(`${userId}_`)) {
        perfCache.delete(key)
      }
    }
  } else {
    perfCache.clear()
  }
}

interface BuyLotFIFO {
  txnId: string
  date: Date
  remainingQty: number
  pricePerUnit: number
  feePerUnit: number
}

export async function calculateAssetPerformance(
  userId: string,
  baseCurrency = 'THB',
  forceRefresh = false
): Promise<PortfolioPerformanceSummary> {
  const cacheKey = `${userId}_${baseCurrency}`
  const now = Date.now()

  if (!forceRefresh) {
    const cached = perfCache.get(cacheKey)
    if (cached && now - cached.timestamp < PERF_CACHE_TTL_MS) {
      return cached.result
    }
  }

  if (inFlightPerf.has(cacheKey)) {
    return inFlightPerf.get(cacheKey)!
  }

  const computePromise = (async () => {
    try {
      // 1. Fetch all user transactions chronologically
      const txns = await prisma.transaction.findMany({
        where: { userId },
        orderBy: { txnDate: 'asc' },
        include: {
          asset: true,
          account: true,
        },
      })

      const distinctAssetIds = Array.from(
        new Set(txns.map((t) => t.assetId).filter(Boolean))
      )
      const [usdThbRateRaw, splitsByAsset] = await Promise.all([
        getExchangeRate('USD', baseCurrency),
        getUserAssetSplitsMap(userId, distinctAssetIds),
      ])
      const usdThbRate = usdThbRateRaw ?? 35.5

      // Group raw transactions per asset first
      const rawTxnsByAsset = new Map<string, { asset: any; txns: typeof txns }>()
      for (const txn of txns) {
        if (!txn.assetId) continue
        if (!rawTxnsByAsset.has(txn.assetId)) {
          rawTxnsByAsset.set(txn.assetId, { asset: txn.asset, txns: [] })
        }
        rawTxnsByAsset.get(txn.assetId)!.txns.push(txn)
      }

      // 2. Replay chronological transaction + split timeline per asset
      interface AssetAccumulator {
        asset: any
        buyLots: BuyLotFIFO[]
        realizedTrades: RealizedTradeRecord[]
        totalDividends: number
        totalDividendsBase: number
        dividendCount: number
        appliedSplits: AppliedSplitBadge[]
      }

      const assetMap = new Map<string, AssetAccumulator>()

      for (const [assetId, group] of rawTxnsByAsset.entries()) {
        const state: AssetAccumulator = {
          asset: group.asset,
          buyLots: [],
          realizedTrades: [],
          totalDividends: 0,
          totalDividendsBase: 0,
          dividendCount: 0,
          appliedSplits: [],
        }
        assetMap.set(assetId, state)

        const isUsd =
          state.asset.currency === 'USD' ||
          state.asset.market === 'US' ||
          state.asset.market === 'CRYPTO'
        const fx = isUsd ? usdThbRate : 1.0

        const assetSplits = splitsByAsset.get(assetId) ?? []
        const timeline = mergeTxnsAndSplits(group.txns, assetSplits)

        for (const event of timeline) {
          if (event.kind === 'SPLIT') {
            const mult = getSplitMultiplier(event.split)
            const openQty = state.buyLots.reduce((sum, lot) => sum + lot.remainingQty, 0)
            if (mult !== 1 && openQty > 0.0000001) {
              for (const lot of state.buyLots) {
                lot.remainingQty *= mult
                lot.pricePerUnit /= mult
                lot.feePerUnit /= mult
              }
              state.appliedSplits.push({
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
          const fee = Number(txn.fee || 0)
          const totalAmount = Number(txn.totalAmount)

          if (txn.txnType === 'BUY') {
            const feePerUnit = qty > 0 ? fee / qty : 0
            state.buyLots.push({
              txnId: txn.id,
              date: new Date(txn.txnDate),
              remainingQty: qty,
              pricePerUnit: price,
              feePerUnit,
            })
          } else if (txn.txnType === 'SELL') {
            let qtyToSell = qty
            let costBasisForTrade = 0
            let matchedWeightedDays = 0
            let totalMatchedQty = 0

            const sellDate = new Date(txn.txnDate)

            while (qtyToSell > 0.0000001 && state.buyLots.length > 0) {
              const oldestLot = state.buyLots[0]
              const takeQty = Math.min(oldestLot.remainingQty, qtyToSell)

              costBasisForTrade += takeQty * oldestLot.pricePerUnit
              const diffDays = Math.max(
                1,
                Math.round((sellDate.getTime() - oldestLot.date.getTime()) / (1000 * 60 * 60 * 24))
              )
              matchedWeightedDays += diffDays * takeQty
              totalMatchedQty += takeQty

              oldestLot.remainingQty -= takeQty
              qtyToSell -= takeQty

              if (oldestLot.remainingQty <= 0.0000001) {
                state.buyLots.shift()
              }
            }

            const sellProceeds = totalAmount > 0 ? totalAmount : qty * price - fee
            const realizedGain = sellProceeds - costBasisForTrade
            const realizedGainPercent = costBasisForTrade > 0 ? (realizedGain / costBasisForTrade) * 100 : 0
            const avgHoldingDays = totalMatchedQty > 0 ? Math.round(matchedWeightedDays / totalMatchedQty) : 1

            state.realizedTrades.push({
              tradeId: txn.id,
              sellDate: txn.txnDate,
              quantity: qty,
              sellPrice: price,
              sellProceeds,
              costBasis: costBasisForTrade,
              realizedGain,
              realizedGainPercent,
              fee,
              holdingDays: avgHoldingDays,
              sellProceedsBase: sellProceeds * fx,
              costBasisBase: costBasisForTrade * fx,
              realizedGainBase: realizedGain * fx,
            })
          } else if (txn.txnType === 'DIVIDEND') {
            const divAmount = totalAmount > 0 ? totalAmount : qty * price
            state.totalDividends += divAmount
            state.totalDividendsBase += divAmount * fx
            state.dividendCount += 1
          }
        }
      }

      // 3. For all assets that have active remaining lots, fetch latest market prices
      const assetEntries = Array.from(assetMap.entries())
      const activeEntries = assetEntries.filter(([_, data]) => {
        const remainingQty = data.buyLots.reduce((acc, lot) => acc + lot.remainingQty, 0)
        return remainingQty > 0.0000001
      })

      const activeAssetIds = activeEntries.map(([assetId]) => assetId)
      const priceMap = await getBatchCachedOrFetchPrices(activeAssetIds, forceRefresh)

      // 4. Assemble each asset's comprehensive performance item
      const assetPerformanceList: AssetPerformanceItem[] = []

      let portfolioTotalNetPnLBase = 0
      let portfolioTotalRealizedGainBase = 0
      let portfolioTotalUnrealizedPnLBase = 0
      let portfolioTotalDividendsBase = 0
      let portfolioTotalCurrentValueBase = 0
      let portfolioTotalInvestedCostBase = 0

      for (const [assetId, data] of assetEntries) {
        const isUsd =
          data.asset.currency === 'USD' ||
          data.asset.market === 'US' ||
          data.asset.market === 'CRYPTO'
        const fx = isUsd ? usdThbRate : 1.0

        // Realized breakdown
        const soldQty = data.realizedTrades.reduce((acc, t) => acc + t.quantity, 0)
        const realizedCost = data.realizedTrades.reduce((acc, t) => acc + t.costBasis, 0)
        const realizedProceeds = data.realizedTrades.reduce((acc, t) => acc + t.sellProceeds, 0)
        const realizedGain = realizedProceeds - realizedCost
        const realizedGainPercent = realizedCost > 0 ? (realizedGain / realizedCost) * 100 : 0

        const realizedCostBase = realizedCost * fx
        const realizedProceedsBase = realizedProceeds * fx
        const realizedGainBase = realizedGain * fx

        // Unrealized breakdown
        const remainingQty = data.buyLots.reduce((acc, lot) => acc + lot.remainingQty, 0)
        const activeCost = data.buyLots.reduce(
          (acc, lot) => acc + lot.remainingQty * lot.pricePerUnit,
          0
        )
        const avgCost = remainingQty > 0.0000001 ? activeCost / remainingQty : 0

        const priceObj = priceMap.get(assetId)
        const currentPrice = priceObj?.price ?? avgCost
        const isStalePrice = priceObj?.isStale ?? false

        const currentValue = remainingQty * currentPrice
        const unrealizedPnL = currentValue - activeCost
        const unrealizedPnLPercent = activeCost > 0 ? (unrealizedPnL / activeCost) * 100 : 0

        const currentValueBase = currentValue * fx
        const costBasisBase = activeCost * fx
        const unrealizedPnLBase = unrealizedPnL * fx

        // Active lots list
        const activeLots: ActiveLotRecord[] = data.buyLots.map((lot) => ({
          buyDate: lot.date,
          quantity: lot.remainingQty,
          pricePerUnit: lot.pricePerUnit,
          totalCost: lot.remainingQty * lot.pricePerUnit,
        }))

        // Status determination
        let status: AssetTradeStatus = 'HOLDING'
        if (remainingQty <= 0.0000001 && data.realizedTrades.length > 0) {
          status = 'CLOSED'
        } else if (remainingQty > 0.0000001 && data.realizedTrades.length > 0) {
          status = 'PARTIALLY_SOLD'
        } else {
          status = 'HOLDING'
        }

        // Net P&L for this asset
        const totalNetPnL = realizedGain + unrealizedPnL + data.totalDividends
        const totalNetPnLBase = realizedGainBase + unrealizedPnLBase + data.totalDividendsBase
        const totalInvestedCapitalBase = realizedCostBase + costBasisBase
        const overallReturnPercent =
          totalInvestedCapitalBase > 0
            ? (totalNetPnLBase / totalInvestedCapitalBase) * 100
            : 0

        // Accumulate portfolio totals
        portfolioTotalNetPnLBase += totalNetPnLBase
        portfolioTotalRealizedGainBase += realizedGainBase
        portfolioTotalUnrealizedPnLBase += unrealizedPnLBase
        portfolioTotalDividendsBase += data.totalDividendsBase
        portfolioTotalCurrentValueBase += currentValueBase
        portfolioTotalInvestedCostBase += costBasisBase

        assetPerformanceList.push({
          assetId,
          ticker: data.asset.ticker,
          assetName: data.asset.assetName,
          market: data.asset.market,
          assetType: data.asset.assetType,
          currency: isUsd ? 'USD' : data.asset.currency || 'THB',
          status,
          soldQuantity: soldQty,
          realizedCost,
          realizedProceeds,
          realizedGain,
          realizedGainPercent,
          realizedCostBase,
          realizedProceedsBase,
          realizedGainBase,
          realizedTrades: data.realizedTrades,
          currentQuantity: remainingQty,
          avgCost,
          currentPrice,
          currentValue,
          unrealizedPnL,
          unrealizedPnLPercent,
          currentValueBase,
          costBasisBase,
          unrealizedPnLBase,
          activeLots,
          isStalePrice,
          ...(data.appliedSplits.length > 0 ? { appliedSplits: data.appliedSplits } : {}),
          totalDividends: data.totalDividends,
          totalDividendsBase: data.totalDividendsBase,
          dividendCount: data.dividendCount,
          totalNetPnL,
          totalNetPnLBase,
          totalInvestedCapitalBase,
          overallReturnPercent,
        })
      }

      // Sort by totalNetPnLBase descending by default
      assetPerformanceList.sort((a, b) => b.totalNetPnLBase - a.totalNetPnLBase)

      // Calculate Win Rate & Top Winner / Loser
      const winners = assetPerformanceList.filter((a) => a.totalNetPnLBase > 0)
      const losers = assetPerformanceList.filter((a) => a.totalNetPnLBase < 0)
      const totalTraded = assetPerformanceList.length
      const winRatePercent = totalTraded > 0 ? (winners.length / totalTraded) * 100 : 0

      const topWinner =
        winners.length > 0
          ? {
              ticker: winners[0].ticker,
              assetName: winners[0].assetName,
              netPnLBase: winners[0].totalNetPnLBase,
              returnPercent: winners[0].overallReturnPercent,
            }
          : null

      const sortedLosers = [...losers].sort((a, b) => a.totalNetPnLBase - b.totalNetPnLBase)
      const topLoser =
        sortedLosers.length > 0
          ? {
              ticker: sortedLosers[0].ticker,
              assetName: sortedLosers[0].assetName,
              netPnLBase: sortedLosers[0].totalNetPnLBase,
              returnPercent: sortedLosers[0].overallReturnPercent,
            }
          : null

      const activeCount = assetPerformanceList.filter((a) => a.currentQuantity > 0.0000001).length
      const closedCount = assetPerformanceList.filter((a) => a.status === 'CLOSED').length

      const summaryResult: PortfolioPerformanceSummary = {
        assets: assetPerformanceList,
        totalNetPnLBase: portfolioTotalNetPnLBase,
        totalRealizedGainBase: portfolioTotalRealizedGainBase,
        totalUnrealizedPnLBase: portfolioTotalUnrealizedPnLBase,
        totalDividendsBase: portfolioTotalDividendsBase,
        totalCurrentValueBase: portfolioTotalCurrentValueBase,
        totalInvestedCostBase: portfolioTotalInvestedCostBase,
        winRatePercent,
        winnersCount: winners.length,
        losersCount: losers.length,
        totalAssetsTraded: totalTraded,
        activeHoldingsCount: activeCount,
        closedPositionsCount: closedCount,
        topWinner,
        topLoser,
        baseCurrency,
      }

      perfCache.set(cacheKey, { result: summaryResult, timestamp: Date.now() })
      return summaryResult
    } finally {
      inFlightPerf.delete(cacheKey)
    }
  })()

  inFlightPerf.set(cacheKey, computePromise)
  return computePromise
}
