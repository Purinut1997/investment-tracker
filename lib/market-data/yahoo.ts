/**
 * lib/market-data/yahoo.ts
 * Reliable Yahoo Finance v8 chart API quote provider for global indices, US stocks, commodities, and Thai stocks.
 * Includes in-memory caching to avoid rate-limiting and guarantee sub-second responses.
 */

import { MarketDataProvider, MarketQuote } from './types'

interface YahooCacheEntry {
  quote: MarketQuote
  timestamp: number
}

const cache = new Map<string, YahooCacheEntry>()
const CACHE_TTL_MS = 3 * 60 * 1000 // 3 minutes in-memory cache to prevent Yahoo API rate limits

export function invalidateYahooCache(symbol?: string) {
  if (symbol) {
    const clean = symbol.trim().toUpperCase()
    cache.delete(clean)
    cache.delete(`${clean}.BK`)
    cache.delete(clean.replace(/\.BK$/i, ''))
  } else {
    cache.clear()
  }
}

export function syncYahooQuoteCache(
  symbol: string,
  market: string,
  patch: Partial<MarketQuote> & { price: number }
) {
  const rawSymbol = symbol.trim().toUpperCase()
  const yfTicker = market === 'TH' && !rawSymbol.endsWith('.BK') ? `${rawSymbol}.BK` : rawSymbol
  const existing = cache.get(yfTicker)?.quote
  const now = Date.now()
  const updated: MarketQuote = {
    symbol: rawSymbol,
    name: patch.name || existing?.name || rawSymbol,
    price: patch.price,
    change: patch.change ?? existing?.change ?? 0,
    changePercent: patch.changePercent ?? existing?.changePercent ?? 0,
    high: patch.high ?? existing?.high,
    low: patch.low ?? existing?.low,
    open: patch.open ?? existing?.open,
    previousClose: patch.previousClose ?? existing?.previousClose,
    timestamp: now,
    provider: 'yahoo',
    currency: patch.currency || existing?.currency || (market === 'TH' ? 'THB' : 'USD'),
  }
  cache.set(yfTicker, { quote: updated, timestamp: now })
}

export class YahooFinanceProvider implements MarketDataProvider {
  name = 'yahoo'

  async getQuote(symbol: string, market = 'US', forceRefresh = false): Promise<MarketQuote | null> {
    const rawSymbol = symbol.trim().toUpperCase()
    const now = Date.now()

    // 1. Map symbol to Yahoo Finance ticker format first so cache key is market-aware
    let yfTicker = rawSymbol
    if (rawSymbol === 'SET' || rawSymbol === 'SET INDEX' || rawSymbol === '^SET') {
      yfTicker = '%5ESET.BK'
    } else if (rawSymbol === 'S&P 500' || rawSymbol === 'SP500' || rawSymbol === '^SPX' || rawSymbol === '^GSPC') {
      yfTicker = '%5EGSPC'
    } else if (rawSymbol === 'NASDAQ' || rawSymbol === '^IXIC') {
      yfTicker = '%5EIXIC'
    } else if (rawSymbol === 'DOW' || rawSymbol === '^DJI') {
      yfTicker = '%5EDJI'
    } else if (rawSymbol === 'GOLD' || rawSymbol === 'XAU' || rawSymbol === 'GC.F' || rawSymbol === 'GC=F') {
      yfTicker = 'GC%3DF'
    } else if (rawSymbol === 'US10Y' || rawSymbol === 'TNX' || rawSymbol === '^TNX') {
      yfTicker = '%5ETNX'
    } else if (rawSymbol === 'VIX' || rawSymbol === '^VIX') {
      yfTicker = '%5EVIX'
    } else if (rawSymbol === 'DXY' || rawSymbol === 'USDX' || rawSymbol === 'DX-Y.NYB') {
      yfTicker = 'DX-Y.NYB'
    } else if (rawSymbol === 'OIL' || rawSymbol === 'WTI' || rawSymbol === 'CL=F') {
      yfTicker = 'CL%3DF'
    } else if (market === 'TH' && !rawSymbol.endsWith('.BK')) {
      yfTicker = `${rawSymbol}.BK`
    }

    // 2. Check in-memory cache keyed by normalized yfTicker
    const cached = cache.get(yfTicker)
    if (!forceRefresh && cached && now - cached.timestamp < CACHE_TTL_MS) {
      return cached.quote
    }

    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yfTicker}?interval=1d&range=1d`
      const fetchOptions: RequestInit = {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(3500),
        cache: 'no-store',
      }

      const res = await fetch(url, fetchOptions)

      if (!res.ok) {
        console.warn(`[YahooFinance] HTTP ${res.status} for ${rawSymbol} (${yfTicker})`)
        return cached?.quote ?? null
      }

      const data = await res.json()
      const meta = data?.chart?.result?.[0]?.meta
      if (!meta || meta.regularMarketPrice === undefined) {
        return cached?.quote ?? null
      }

      const price = Number(meta.regularMarketPrice)
      const prev = Number(meta.previousClose || meta.regularMarketPreviousClose || meta.chartPreviousClose || price)
      const change = meta.regularMarketChange !== undefined && meta.regularMarketChange !== null
        ? Number(meta.regularMarketChange)
        : price - prev
      const changePercent = meta.regularMarketChangePercent !== undefined && meta.regularMarketChangePercent !== null
        ? Number(meta.regularMarketChangePercent)
        : (prev > 0 ? (change / prev) * 100 : 0)

      let currency = 'USD'
      if (rawSymbol.includes('SET') || market === 'TH' || rawSymbol.endsWith('.BK') || yfTicker.endsWith('.BK')) {
        currency = rawSymbol.includes('SET') ? 'PTS' : 'THB'
      }

      const quote: MarketQuote = {
        symbol: rawSymbol,
        name: meta.shortName || meta.longName || rawSymbol,
        price,
        change,
        changePercent,
        high: meta.regularMarketDayHigh,
        low: meta.regularMarketDayLow,
        open: meta.regularMarketDayOpen,
        previousClose: prev,
        timestamp: (meta.regularMarketTime ? meta.regularMarketTime * 1000 : now),
        provider: this.name,
        currency,
      }

      // Save to memory cache keyed by normalized yfTicker
      cache.set(yfTicker, { quote, timestamp: now })
      return quote
    } catch (err) {
      console.error(`[YahooFinance] Error fetching ${rawSymbol}:`, err)
      return cached?.quote ?? null
    }
  }
}

export const yahooFinanceProvider = new YahooFinanceProvider()
