/**
 * POST /api/portfolio/refresh-prices
 * Force refreshes live market closing prices from Yahoo Finance for all active assets in user's portfolio.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import {
  fetchLiveAssetQuote,
  invalidatePriceCache,
  syncAssetLivePrice,
} from '@/lib/market-data/cache-layer'
import { syncAssetSplitsFromYahoo } from '@/lib/market-data/split-sync'
import { invalidateUserHoldingsCache } from '@/lib/analytics/holdings'
import {
  StockSplitEvent,
  getSplitMultiplier,
  getUserAssetSplitsMap,
  mergeTxnsAndSplits,
} from '@/lib/analytics/stock-splits'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // 1. Fetch user's active assets from transactions
    const txns = await prisma.transaction.findMany({
      where: { userId: session.user.id },
      orderBy: { txnDate: 'asc' },
      include: { asset: true },
    })

    if (txns.length === 0) {
      return NextResponse.json({
        success: true,
        updatedCount: 0,
        prices: [],
        detectedSplits: [],
        syncedSplitsCount: 0,
      })
    }

    const distinctAssetIds = Array.from(new Set(txns.map((t) => t.assetId).filter(Boolean)))
    const splitsByAsset = await getUserAssetSplitsMap(session.user.id, distinctAssetIds)
    const allSplits: StockSplitEvent[] = Array.from(splitsByAsset.values()).flat()
    const timeline = mergeTxnsAndSplits(txns, allSplits)

    // Determine assets that have active quantity after accounting for stock splits
    const quantityMap = new Map<string, { asset: any; qty: number }>()
    for (const ev of timeline) {
      if (ev.kind === 'SPLIT') {
        const entry = quantityMap.get(ev.split.assetId)
        if (entry && entry.qty > 0.0000001) {
          entry.qty *= getSplitMultiplier(ev.split)
        }
        continue
      }

      const t = ev.txn
      const aid = t.assetId
      if (!quantityMap.has(aid)) {
        quantityMap.set(aid, { asset: t.asset, qty: 0 })
      }
      const item = quantityMap.get(aid)!
      const q = Number(t.quantity)
      if (t.txnType === 'BUY') item.qty += q
      else if (t.txnType === 'SELL') item.qty = Math.max(0, item.qty - q)
    }

    const activeAssets = Array.from(quantityMap.values())
      .filter((i) => i.qty > 0.00001)
      .map((i) => i.asset)

    // Parallelize external fetches for all active assets
    const updatedPrices: Array<{
      ticker: string
      market: string
      currency: string
      price: number
      change: number
      changePercent: number
      source: string
    }> = []

    // Clear all provider and analyzer caches first so we fetch genuinely fresh live quotes
    invalidatePriceCache()

    const [splitSyncRes] = await Promise.all([
      syncAssetSplitsFromYahoo(activeAssets, true).catch(() => ({
        syncedAssetsCount: 0,
        totalSplitsFound: 0,
        newlyAddedSplits: [],
      })),
      Promise.all(
        activeAssets.map(async (asset) => {
          try {
            const quote = await fetchLiveAssetQuote(asset, true)

            if (quote && quote.price > 0) {
              await syncAssetLivePrice(asset.id, quote.price, quote.provider || 'yahoo')

              // Ensure asset has correct currency and market
              if (asset.market === 'US' && asset.currency !== 'USD') {
                await prisma.asset.update({
                  where: { id: asset.id },
                  data: { currency: 'USD' },
                })
              }

              updatedPrices.push({
                ticker: asset.ticker,
                market: asset.market,
                currency: quote.currency || (asset.market === 'US' ? 'USD' : 'THB'),
                price: quote.price,
                change: quote.change || 0,
                changePercent: quote.changePercent || 0,
                source: quote.provider || 'yahoo',
              })
            }
          } catch (assetError) {
            console.error(`[refresh-prices] Failed for ${asset.ticker}:`, assetError)
          }
        })
      ),
    ])

    // Clear this user's portfolio/holdings/performance caches so downstream APIs immediately reflect latest prices & splits
    invalidateUserHoldingsCache(session.user.id)

    return NextResponse.json({
      success: true,
      updatedCount: updatedPrices.length,
      prices: updatedPrices,
      detectedSplits: splitSyncRes.newlyAddedSplits,
      syncedSplitsCount: splitSyncRes.totalSplitsFound,
    })
  } catch (error) {
    console.error('[refresh-prices POST]', error)
    return NextResponse.json({ error: 'Failed to refresh prices' }, { status: 500 })
  }
}
