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
const CACHE_TTL_MS = 60 * 1000 // 1 minute in-memory cache

export class YahooFinanceProvider implements MarketDataProvider {
  name = 'yahoo'

  async getQuote(symbol: string, market = 'US'): Promise<MarketQuote | null> {
    const rawSymbol = symbol.trim().toUpperCase()
    const now = Date.now()

    // 1. Check in-memory cache
    const cached = cache.get(rawSymbol)
    if (cached && now - cached.timestamp < CACHE_TTL_MS) {
      return cached.quote
    }

    // 2. Map symbol to Yahoo Finance ticker format
    let yfTicker = rawSymbol
    if (rawSymbol === 'SET' || rawSymbol === 'SET INDEX' || rawSymbol === '^SET') {
      yfTicker = '%5ESET.BK'
    } else if (rawSymbol === 'S&P 500' || rawSymbol === 'SP500' || rawSymbol === '^SPX' || rawSymbol === '^GSPC') {
      yfTicker = '%5EGSPC'
    } else if (rawSymbol === 'NASDAQ' || rawSymbol === '^IXIC') {
      yfTicker = '%5EIXIC'
    } else if (rawSymbol === 'DOW' || rawSymbol === '^DJI') {
      yfTicker = '%5EDJI'
    } else if (rawSymbol === 'GOLD' || rawSymbol === 'XAU' || rawSymbol === 'GC.F') {
      yfTicker = 'GC%3DF'
    } else if (market === 'TH' && !rawSymbol.endsWith('.BK')) {
      yfTicker = `${rawSymbol}.BK`
    }

    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yfTicker}?interval=1d&range=1d`
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(3500),
        next: { revalidate: 60 },
      })

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
      const prev = Number(meta.chartPreviousClose || meta.previousClose || price)
      const change = price - prev
      const changePercent = prev > 0 ? (change / prev) * 100 : 0

      let currency = 'USD'
      if (rawSymbol.includes('SET') || market === 'TH' || rawSymbol.endsWith('.BK')) {
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

      // Save to memory cache
      cache.set(rawSymbol, { quote, timestamp: now })
      return quote
    } catch (err) {
      console.error(`[YahooFinance] Error fetching ${rawSymbol}:`, err)
      return cached?.quote ?? null
    }
  }
}

export const yahooFinanceProvider = new YahooFinanceProvider()
