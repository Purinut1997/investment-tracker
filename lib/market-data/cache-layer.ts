/**
 * lib/market-data/cache-layer.ts
 * Unified high-speed multi-tier price cache and dispatcher layer.
 * Tier 1: In-memory cache (5-minute TTL, 0ms)
 * Tier 2: Database PriceHistory latest valid close price (<5ms)
 * Tier 3: External providers (Yahoo, Finnhub, Stooq, CoinGecko) only if forceRefresh=true or no DB record
 */

import { prisma } from '@/lib/prisma'
import { yahooFinanceProvider } from './yahoo'
import { finnhubProvider } from './finnhub'
import { coinGeckoProvider } from './coingecko'
import { stooqProvider } from './stooq'
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
  }
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
    // ── Tier 2: Database PriceHistory Lookup ───────────────────────
    // If not forcing refresh, check if we already have a recent valid historical price in DB
    if (!forceRefresh) {
      // Check exact date first
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

      // Check most recent historical price in DB (from last trading day)
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
    }

    // ── Tier 3: External Providers Fetch (Only if forceRefresh OR no DB price exists) ──
    const asset = await prisma.asset.findUnique({ where: { id: assetId } })
    if (!asset) return null

    let quote: MarketQuote | null = null

    if (asset.market === 'CRYPTO' || asset.assetType === 'crypto') {
      quote = await coinGeckoProvider.getQuote(asset.ticker)
    } else if (asset.market === 'TH' || asset.ticker.endsWith('.BK')) {
      quote = await yahooFinanceProvider.getQuote(asset.ticker, 'TH')
      if (!quote) {
        quote = await stooqProvider.getQuote(asset.ticker, 'TH')
      }
    } else if (asset.market === 'US' || asset.currency === 'USD') {
      quote = await yahooFinanceProvider.getQuote(asset.ticker, 'US')
      if (!quote) {
        quote = await finnhubProvider.getQuote(asset.ticker)
      }
      if (!quote) {
        quote = await stooqProvider.getQuote(`${asset.ticker}.US`, 'US')
      }
    } else if (asset.assetType === 'gold') {
      quote = await yahooFinanceProvider.getQuote('GOLD', 'GLOBAL')
      if (!quote) {
        quote = await stooqProvider.getQuote('GC.F', 'COMMODITY')
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
