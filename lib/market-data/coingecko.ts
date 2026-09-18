/**
 * lib/market-data/coingecko.ts
 * High-performance CoinGecko crypto quote provider with Demo API key support,
 * in-memory caching (90s TTL), timeout protection, and seamless Yahoo Finance fallback.
 */

import { MarketDataProvider, MarketQuote } from './types'
import { yahooFinanceProvider } from './yahoo'

const COIN_ID_MAP: Record<string, string> = {
  BTC: 'bitcoin',
  BITCOIN: 'bitcoin',
  ETH: 'ethereum',
  ETHEREUM: 'ethereum',
  SOL: 'solana',
  SOLANA: 'solana',
  BNB: 'binancecoin',
  XRP: 'ripple',
  ADA: 'cardano',
  DOGE: 'dogecoin',
  AVAX: 'avalanche-2',
  DOT: 'polkadot',
  LINK: 'chainlink',
  USDT: 'tether',
  USDC: 'usd-coin',
}

const COIN_NAME_MAP: Record<string, string> = {
  BTC: 'Bitcoin',
  ETH: 'Ethereum',
  SOL: 'Solana',
  BNB: 'BNB',
  XRP: 'XRP',
  ADA: 'Cardano',
  DOGE: 'Dogecoin',
  AVAX: 'Avalanche',
  DOT: 'Polkadot',
  LINK: 'Chainlink',
  USDT: 'Tether USD',
  USDC: 'USD Coin',
}

interface CryptoCacheEntry {
  quote: MarketQuote
  timestamp: number
}

const cryptoMemoryCache = new Map<string, CryptoCacheEntry>()
const CRYPTO_CACHE_TTL_MS = 90 * 1000 // 90 seconds in-memory cache

export class CoinGeckoProvider implements MarketDataProvider {
  name = 'coingecko'

  async getQuote(symbol: string): Promise<MarketQuote | null> {
    const cleanSymbol = symbol.trim().toUpperCase()
    const now = Date.now()

    // 1. Check in-memory cache (<0.1ms)
    const cached = cryptoMemoryCache.get(cleanSymbol)
    if (cached && now - cached.timestamp < CRYPTO_CACHE_TTL_MS) {
      return cached.quote
    }

    const coinId = COIN_ID_MAP[cleanSymbol] || cleanSymbol.toLowerCase()
    const apiKey = process.env.COINGECKO_API_KEY

    try {
      const headers: Record<string, string> = {
        Accept: 'application/json',
      }
      if (apiKey) {
        headers['x-cg-demo-api-key'] = apiKey
      }

      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(coinId)}&vs_currencies=usd,thb&include_24hr_change=true&include_24hr_vol=true`
      const res = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(3000),
        next: { revalidate: 120 },
      })

      if (!res.ok) {
        console.warn(`[CoinGecko] HTTP ${res.status} for ${cleanSymbol}, falling back to Yahoo Finance`)
        return this.fallbackToYahoo(cleanSymbol, cached?.quote)
      }

      const data = await res.json()
      const item = data[coinId]
      if (!item || item.usd === undefined) {
        return this.fallbackToYahoo(cleanSymbol, cached?.quote)
      }

      const usdPrice = item.usd
      const change24h = item.usd_24h_change ?? 0

      const quote: MarketQuote = {
        symbol: cleanSymbol,
        name: COIN_NAME_MAP[cleanSymbol] || cleanSymbol,
        price: usdPrice,
        change: (usdPrice * change24h) / 100,
        changePercent: change24h,
        timestamp: now,
        provider: this.name,
        currency: 'USD',
      }

      cryptoMemoryCache.set(cleanSymbol, { quote, timestamp: now })
      return quote
    } catch (error) {
      console.warn(`[CoinGecko] Fetch timeout or error for ${cleanSymbol}, falling back to Yahoo Finance`)
      return this.fallbackToYahoo(cleanSymbol, cached?.quote)
    }
  }

  private async fallbackToYahoo(symbol: string, staleQuote?: MarketQuote): Promise<MarketQuote | null> {
    try {
      const yahooTicker = `${symbol}-USD`
      const yahooQuote = await yahooFinanceProvider.getQuote(yahooTicker, 'CRYPTO')
      if (yahooQuote && yahooQuote.price > 0) {
        const enriched: MarketQuote = {
          ...yahooQuote,
          symbol,
          name: COIN_NAME_MAP[symbol] || yahooQuote.name || symbol,
          provider: 'yahoo_fallback',
        }
        cryptoMemoryCache.set(symbol, { quote: enriched, timestamp: Date.now() })
        return enriched
      }
    } catch (err) {
      console.error(`[CoinGecko] Yahoo fallback failed for ${symbol}:`, err)
    }

    return staleQuote ?? null
  }
}

export const coinGeckoProvider = new CoinGeckoProvider()
