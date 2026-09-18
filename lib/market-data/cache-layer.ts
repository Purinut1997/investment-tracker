/**
 * lib/market-data/cache-layer.ts
 * Unified price cache and dispatcher layer.
 * Checks database PriceHistory first, falls back to external providers.
 */

import { prisma } from '@/lib/prisma'
import { yahooFinanceProvider } from './yahoo'
import { finnhubProvider } from './finnhub'
import { coinGeckoProvider } from './coingecko'
import { stooqProvider } from './stooq'
import { MarketQuote } from './types'

export async function getCachedOrFetchPrice(
  assetId: string,
  targetDate = new Date()
): Promise<{ price: number; sourceProvider: string; isStale: boolean } | null> {
  const dateKey = new Date(targetDate)
  dateKey.setUTCHours(0, 0, 0, 0)

  try {
    // 1. Check PriceHistory for exact date
    const cached = await prisma.priceHistory.findUnique({
      where: {
        assetId_priceDate: {
          assetId,
          priceDate: dateKey,
        },
      },
    })

    if (cached && Number(cached.closePrice) > 0) {
      return {
        price: Number(cached.closePrice),
        sourceProvider: cached.sourceProvider,
        isStale: false,
      }
    }

    // 2. Fetch Asset info
    const asset = await prisma.asset.findUnique({ where: { id: assetId } })
    if (!asset) return null

    // 3. Fetch from appropriate provider
    let quote: MarketQuote | null = null

    if (asset.market === 'CRYPTO' || asset.assetType === 'crypto') {
      quote = await coinGeckoProvider.getQuote(asset.ticker)
    } else if (asset.market === 'TH' || asset.ticker.endsWith('.BK')) {
      quote = await yahooFinanceProvider.getQuote(asset.ticker, 'TH')
      if (!quote) {
        quote = await stooqProvider.getQuote(asset.ticker, 'TH')
      }
    } else if (asset.market === 'US' || asset.currency === 'USD') {
      // Primary: Yahoo Finance (most reliable, live real-time, no api key required)
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

    // 4. Save to PriceHistory if successfully fetched with valid positive price
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

      return {
        price: quote.price,
        sourceProvider: quote.provider,
        isStale: false,
      }
    }

    // 5. Fallback: Find most recent historical price in DB
    const latestHistorical = await prisma.priceHistory.findFirst({
      where: {
        assetId,
        closePrice: { gt: 0 },
      },
      orderBy: { priceDate: 'desc' },
    })

    if (latestHistorical) {
      return {
        price: Number(latestHistorical.closePrice),
        sourceProvider: `${latestHistorical.sourceProvider} (cached)`,
        isStale: true,
      }
    }

    // 6. Last resort: latest transaction price (BUY or SELL ONLY, NEVER DIVIDEND OR FEE)
    const latestTxn = await prisma.transaction.findFirst({
      where: {
        assetId,
        txnType: { in: ['BUY', 'SELL'] },
      },
      orderBy: { txnDate: 'desc' },
      select: { pricePerUnit: true },
    })

    if (latestTxn && Number(latestTxn.pricePerUnit) > 0) {
      return {
        price: Number(latestTxn.pricePerUnit),
        sourceProvider: 'last_transaction',
        isStale: true,
      }
    }

    return null
  } catch (error) {
    console.error(`[cache-layer] Error fetching price for asset ${assetId}:`, error)
    return null
  }
}
