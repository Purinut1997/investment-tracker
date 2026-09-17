/**
 * lib/market-data/stooq.ts
 * Stooq CSV provider for Thai stocks (.BK) and Gold (GC.F).
 */

import { MarketDataProvider, MarketQuote } from './types'

export class StooqProvider implements MarketDataProvider {
  name = 'stooq'

  async getQuote(symbol: string, market = 'TH'): Promise<MarketQuote | null> {
    let cleanSymbol = symbol.trim().toUpperCase()

    // Add .BK suffix for Thai stocks if not present
    if (market === 'TH' && !cleanSymbol.endsWith('.BK')) {
      cleanSymbol = `${cleanSymbol}.BK`
    } else if (cleanSymbol === 'GOLD' || cleanSymbol === 'XAU') {
      cleanSymbol = 'GC.F'
    }

    try {
      const url = `https://stooq.com/q/l/?s=${encodeURIComponent(cleanSymbol.toLowerCase())}&f=sd2t2ohlcv&h&e=csv`
      const res = await fetch(url, { next: { revalidate: 300 } })

      if (!res.ok) {
        console.warn(`[Stooq] HTTP ${res.status} for ${cleanSymbol}`)
        return null
      }

      const text = await res.text()
      const lines = text.trim().split('\n')
      if (lines.length < 2) return null

      // Header: Symbol,Date,Time,Open,High,Low,Close,Volume
      // Data row: ptt.bk,2026-09-17,16:30:00,32.50,33.00,32.25,32.75,45000000
      const row = lines[1].split(',')
      if (row.length < 7) return null

      const closePrice = parseFloat(row[6])
      const openPrice = parseFloat(row[3])
      const highPrice = parseFloat(row[4])
      const lowPrice = parseFloat(row[5])

      if (isNaN(closePrice) || closePrice === 0) return null

      const change = !isNaN(openPrice) ? closePrice - openPrice : 0
      const changePercent = !isNaN(openPrice) && openPrice > 0 ? (change / openPrice) * 100 : 0

      return {
        symbol: symbol.trim().toUpperCase(),
        price: closePrice,
        change,
        changePercent,
        high: !isNaN(highPrice) ? highPrice : undefined,
        low: !isNaN(lowPrice) ? lowPrice : undefined,
        open: !isNaN(openPrice) ? openPrice : undefined,
        timestamp: Date.now(),
        provider: this.name,
        currency: market === 'TH' ? 'THB' : 'USD',
      }
    } catch (error) {
      console.error(`[Stooq] Error fetching quote for ${cleanSymbol}:`, error)
      return null
    }
  }
}

export const stooqProvider = new StooqProvider()
