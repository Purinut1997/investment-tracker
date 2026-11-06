/**
 * lib/market-data/cache-layer.ts
 * Unified high-speed multi-tier price cache and dispatcher layer.
 * Tier 1: In-memory cache (5-minute TTL, 0ms)
 * Tier 2: Database PriceHistory latest valid close price (<5ms)
 * Tier 3: External providers (Yahoo, Finnhub, Stooq, CoinGecko) only if forceRefresh=true or no DB record
 */

import { prisma } from '../prisma'
import { yahooFinanceProvider, invalidateYahooCache } from './yahoo'
import { finnhubProvider } from './finnhub'
import { coinGeckoProvider, invalidateCoinGeckoCache } from './coingecko'
import { stooqProvider } from './stooq'
import { invalidateTechnicalCache } from './technical-signals'
import { invalidateResolverCache } from './resolver'
import { invalidateDividendCache } from '../dividends/dividend-analyzer'
import { invalidateEarningsAnalyzerCache } from '../earnings/earnings-analyzer'
import { MarketQuote } from './types'

interface PriceCacheEntry {
  price: number
  sourceProvider: string
  isStale: boolean
  timestamp: number
}

// In-memory price cache: assetId -> PriceCacheEntry (5-minute TTL)
const priceMemoryCache = new Map<string, PriceCacheEntry>()
const PRICE_CACHE_TTL_MS = 5 * 60 * 1000

export function invalidatePriceCache(assetId?: string) {
  if (assetId) {
    priceMemoryCache.delete(assetId)
  } else {
    priceMemoryCache.clear()
    invalidateYahooCache()
    invalidateCoinGeckoCache()
    invalidateTechnicalCache()
    invalidateResolverCache()
    invalidateDividendCache()
    invalidateEarningsAnalyzerCache()
  }
}

export async function syncAssetLivePrice(
  assetId: string,
  price: number,
  sourceProvider = 'yahoo'
) {
  if (!assetId || !price || price <= 0 || isNaN(price)) return
  const now = Date.now()
  priceMemoryCache.set(assetId, {
    price,
    sourceProvider,
    isStale: false,
    timestamp: now,
  })

  try {
    const dateKey = new Date()
    dateKey.setUTCHours(0, 0, 0, 0)
    await prisma.priceHistory.upsert({
      where: {
        assetId_priceDate: {
          assetId,
          priceDate: dateKey,
        },
      },
      update: {
        closePrice: price,
        sourceProvider,
      },
      create: {
        assetId,
        priceDate: dateKey,
        closePrice: price,
        sourceProvider,
      },
    })
  } catch (err) {
    console.warn('[syncAssetLivePrice DB warning]', err)
  }
}

async function fetchLiveAssetQuote(
  asset: { id: string; ticker: string; market: string; assetType: string },
  forceRefresh = false
): Promise<MarketQuote | null> {
  if (asset.market === 'CRYPTO' || asset.assetType === 'crypto') {
    return coinGeckoProvider.getQuote(asset.ticker, 'CRYPTO', forceRefresh)
  }
  if (asset.market === 'TH' || asset.ticker.endsWith('.BK')) {
    const q = await yahooFinanceProvider.getQuote(asset.ticker, 'TH', forceRefresh)
    return q ?? stooqProvider.getQuote(asset.ticker, 'TH', forceRefresh)
  }
  if (asset.assetType === 'gold' || asset.ticker === 'GOLD' || asset.ticker === 'XAU') {
    const q = await yahooFinanceProvider.getQuote('GOLD', 'GLOBAL', forceRefresh)
    return q ?? stooqProvider.getQuote('GC.F', 'COMMODITY', forceRefresh)
  }
  let q = await yahooFinanceProvider.getQuote(asset.ticker, 'US', forceRefresh)
  if (!q) {
    q = await finnhubProvider.getQuote(asset.ticker, 'US', forceRefresh)
  }
  if (!q) {
    q = await stooqProvider.getQuote(`${asset.ticker}.US`, 'US', forceRefresh)
  }
  return q
}

const backgroundRefreshingAssets = new Set<string>()

async function refreshStaleAssetsInBackground(assetIds: string[]) {
  const toRefresh = assetIds.filter((id) => !backgroundRefreshingAssets.has(id))
  if (toRefresh.length === 0) return
  toRefresh.forEach((id) => backgroundRefreshingAssets.add(id))

  try {
    const assets = await prisma.asset.findMany({
      where: { id: { in: toRefresh } },
    })
    await Promise.allSettled(
      assets.map(async (asset) => {
        const quote = await fetchLiveAssetQuote(asset, false)
        if (quote && quote.price > 0) {
          await syncAssetLivePrice(asset.id, quote.price, quote.provider)
        }
      })
    )
  } catch (err) {
    console.warn('[refreshStaleAssetsInBackground warning]', err)
  } finally {
    toRefresh.forEach((id) => backgroundRefreshingAssets.delete(id))
  }
}

export async function getBatchCachedOrFetchPrices(
  assetIds: string[],
  forceRefresh = false
): Promise<Map<string, { price: number; sourceProvider: string; isStale: boolean }>> {
  const now = Date.now()
  const todayKey = new Date()
  todayKey.setUTCHours(0, 0, 0, 0)

  const resultMap = new Map<string, { price: number; sourceProvider: string; isStale: boolean }>()
  const staleFallbackMap = new Map<string, { price: number; sourceProvider: string; isStale: boolean }>()
  const missingAssetIds: string[] = []

  // ── Tier 1: In-Memory Fast Cache (<0.1ms) ──────────────────────
  if (!forceRefresh) {
    for (const id of assetIds) {
      const memoryCached = priceMemoryCache.get(id)
      if (memoryCached && now - memoryCached.timestamp < PRICE_CACHE_TTL_MS) {
        resultMap.set(id, {
          price: memoryCached.price,
          sourceProvider: memoryCached.sourceProvider,
          isStale: memoryCached.isStale,
        })
      } else {
        missingAssetIds.push(id)
      }
    }
  } else {
    missingAssetIds.push(...assetIds)
  }

  if (missingAssetIds.length === 0) {
    return resultMap
  }

  // ── Tier 2: Single Batch Database Query to PriceHistory (<5ms) ────────
  const staleAssetIdsForBackgroundRefresh: string[] = []
  try {
    const historicalPrices = await prisma.priceHistory.findMany({
      where: {
        assetId: { in: missingAssetIds },
        closePrice: { gt: 0 },
      },
      orderBy: { priceDate: 'desc' },
    })

    for (const row of historicalPrices) {
      if (resultMap.has(row.assetId) || staleFallbackMap.has(row.assetId)) continue

      const rowDateMs = new Date(row.priceDate).getTime()
      const isToday = rowDateMs >= todayKey.getTime()
      const entry = {
        price: Number(row.closePrice),
        sourceProvider: isToday ? row.sourceProvider : `${row.sourceProvider} (cached)`,
        isStale: !isToday,
      }

      if (!forceRefresh) {
        // Return DB price immediately (<5ms) so page loads never block on 20 external API calls
        resultMap.set(row.assetId, entry)
        priceMemoryCache.set(row.assetId, { ...entry, timestamp: now })
        if (!isToday) {
          staleAssetIdsForBackgroundRefresh.push(row.assetId)
        }
      } else {
        staleFallbackMap.set(row.assetId, entry)
      }
    }
  } catch (err) {
    console.warn('[getBatchCachedOrFetchPrices DB error]', err)
  }

  if (!forceRefresh && staleAssetIdsForBackgroundRefresh.length > 0) {
    void refreshStaleAssetsInBackground(staleAssetIdsForBackgroundRefresh)
  }

  // ── Tier 3: Batch fetch live for brand-new assets or forceRefresh ──
  const stillMissing = missingAssetIds.filter((id) => !resultMap.has(id))
  if (stillMissing.length > 0) {
    try {
      const assets = await prisma.asset.findMany({
        where: { id: { in: stillMissing } },
      })
      const assetMap = new Map(assets.map((a) => [a.id, a]))

      await Promise.all(
        stillMissing.map(async (assetId) => {
          const asset = assetMap.get(assetId)
          if (!asset) return

          try {
            const quote = await fetchLiveAssetQuote(asset, forceRefresh)
            if (quote && quote.price > 0) {
              const entry = {
                price: quote.price,
                sourceProvider: quote.provider,
                isStale: false,
              }
              resultMap.set(assetId, entry)
              priceMemoryCache.set(assetId, { ...entry, timestamp: now })
              await syncAssetLivePrice(assetId, quote.price, quote.provider)
              return
            }
          } catch {
            // Fall through to staleFallbackMap
          }

          if (staleFallbackMap.has(assetId)) {
            const fallback = staleFallbackMap.get(assetId)!
            resultMap.set(assetId, fallback)
            priceMemoryCache.set(assetId, { ...fallback, timestamp: now })
          }
        })
      )
    } catch (err) {
      console.warn('[getBatchCachedOrFetchPrices Tier 3 error]', err)
    }
  }

  return resultMap
}

export async function getCachedOrFetchPrice(
  assetId: string,
  targetDate = new Date(),
  forceRefresh = false
): Promise<{ price: number; sourceProvider: string; isStale: boolean } | null> {
  const now = Date.now()

  // ── Tier 1: In-Memory Fast Cache (<0.1ms) ──────────────────────
  if (!forceRefresh) {
    const memoryCached = priceMemoryCache.get(assetId)
    if (memoryCached && now - memoryCached.timestamp < PRICE_CACHE_TTL_MS) {
      return {
        price: memoryCached.price,
        sourceProvider: memoryCached.sourceProvider,
        isStale: memoryCached.isStale,
      }
    }
  }

  const dateKey = new Date(targetDate)
  dateKey.setUTCHours(0, 0, 0, 0)

  try {
    // ── Tier 2: Database PriceHistory Lookup (Only exact today date before Tier 3) ──
    if (!forceRefresh) {
      const exactCached = await prisma.priceHistory.findUnique({
        where: {
          assetId_priceDate: {
            assetId,
            priceDate: dateKey,
          },
        },
      })

      if (exactCached && Number(exactCached.closePrice) > 0) {
        const result = {
          price: Number(exactCached.closePrice),
          sourceProvider: exactCached.sourceProvider,
          isStale: false,
        }
        priceMemoryCache.set(assetId, { ...result, timestamp: now })
        return result
      }
    }

    // ── Tier 3: External Providers Fetch (when forceRefresh OR no DB price for today) ──
    const asset = await prisma.asset.findUnique({ where: { id: assetId } })
    if (!asset) return null

    let quote: MarketQuote | null = null

    if (asset.market === 'CRYPTO' || asset.assetType === 'crypto') {
      quote = await coinGeckoProvider.getQuote(asset.ticker, 'CRYPTO', forceRefresh)
    } else if (asset.market === 'TH' || asset.ticker.endsWith('.BK')) {
      quote = await yahooFinanceProvider.getQuote(asset.ticker, 'TH', forceRefresh)
      if (!quote) {
        quote = await stooqProvider.getQuote(asset.ticker, 'TH', forceRefresh)
      }
    } else if (asset.assetType === 'gold' || asset.ticker === 'GOLD' || asset.ticker === 'XAU') {
      quote = await yahooFinanceProvider.getQuote('GOLD', 'GLOBAL', forceRefresh)
      if (!quote) {
        quote = await stooqProvider.getQuote('GC.F', 'COMMODITY', forceRefresh)
      }
    } else {
      quote = await yahooFinanceProvider.getQuote(asset.ticker, 'US', forceRefresh)
      if (!quote) {
        quote = await finnhubProvider.getQuote(asset.ticker, 'US', forceRefresh)
      }
      if (!quote) {
        quote = await stooqProvider.getQuote(`${asset.ticker}.US`, 'US', forceRefresh)
      }
    }

    // Save to PriceHistory and update Memory Cache if fetched successfully
    if (quote && quote.price > 0) {
      await prisma.priceHistory.upsert({
        where: {
          assetId_priceDate: {
            assetId,
            priceDate: dateKey,
          },
        },
        update: {
          closePrice: quote.price,
          sourceProvider: quote.provider,
        },
        create: {
          assetId,
          priceDate: dateKey,
          closePrice: quote.price,
          sourceProvider: quote.provider,
        },
      })

      const result = {
        price: quote.price,
        sourceProvider: quote.provider,
        isStale: false,
      }
      priceMemoryCache.set(assetId, { ...result, timestamp: now })
      return result
    }

    // Fallback: Find most recent historical price in DB
    const latestHistorical = await prisma.priceHistory.findFirst({
      where: {
        assetId,
        closePrice: { gt: 0 },
      },
      orderBy: { priceDate: 'desc' },
    })

    if (latestHistorical && Number(latestHistorical.closePrice) > 0) {
      const result = {
        price: Number(latestHistorical.closePrice),
        sourceProvider: `${latestHistorical.sourceProvider} (cached)`,
        isStale: true,
      }
      priceMemoryCache.set(assetId, { ...result, timestamp: now })
      return result
    }

    // Last resort: latest transaction price
    const latestTxn = await prisma.transaction.findFirst({
      where: {
        assetId,
        txnType: { in: ['BUY', 'SELL'] },
      },
      orderBy: { txnDate: 'desc' },
      select: { pricePerUnit: true },
    })

    if (latestTxn && Number(latestTxn.pricePerUnit) > 0) {
      const result = {
        price: Number(latestTxn.pricePerUnit),
        sourceProvider: 'last_transaction',
        isStale: true,
      }
      priceMemoryCache.set(assetId, { ...result, timestamp: now })
      return result
    }

    return null
  } catch (error) {
    console.error(`[cache-layer] Error fetching price for asset ${assetId}:`, error)
    return null
  }
}
