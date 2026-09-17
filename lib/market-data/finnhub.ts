/**
 * lib/market-data/finnhub.ts
 * Finnhub quote provider for US/International stocks.
 */

import { MarketDataProvider, MarketQuote } from './types'

export class FinnhubProvider implements MarketDataProvider {
  name = 'finnhub'

  async getQuote(symbol: string): Promise<MarketQuote | null> {
    const apiKey = process.env.FINNHUB_API_KEY
    if (!apiKey) {
      console.warn('[Finnhub] FINNHUB_API_KEY not set. Using fallback or skipping.')
      return null
    }

    try {
      const cleanSymbol = symbol.trim().toUpperCase()
      const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(cleanSymbol)}&token=${apiKey}`
      const res = await fetch(url, { next: { revalidate: 300 } })

      if (!res.ok) {
        console.warn(`[Finnhub] HTTP ${res.status} for ${cleanSymbol}`)
        return null
      }

      const data = await res.json()
      // Finnhub returns c=0 when symbol not found
      if (!data || data.c === 0 || data.c === undefined) {
        return null
      }

      return {
        symbol: cleanSymbol,
        price: data.c,
        change: data.d ?? 0,
        changePercent: data.dp ?? 0,
        high: data.h,
        low: data.l,
        open: data.o,
        previousClose: data.pc,
        timestamp: (data.t ? data.t * 1000 : Date.now()),
        provider: this.name,
        currency: 'USD',
      }
    } catch (error) {
      console.error(`[Finnhub] Error fetching quote for ${symbol}:`, error)
      return null
    }
  }
}

export const finnhubProvider = new FinnhubProvider()
