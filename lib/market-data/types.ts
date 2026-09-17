/**
 * lib/market-data/types.ts
 * Unified abstraction layer for all market data providers.
 */

export interface MarketQuote {
  symbol: string
  name?: string
  price: number
  change: number
  changePercent: number
  high?: number
  low?: number
  open?: number
  previousClose?: number
  timestamp: number
  provider: string
  currency: string
}

export interface FxRate {
  base: string
  target: string
  rate: number
  date: string
}

export interface MarketDataProvider {
  name: string
  getQuote(symbol: string, market?: string): Promise<MarketQuote | null>
}
