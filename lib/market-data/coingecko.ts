/**
 * lib/market-data/coingecko.ts
 * CoinGecko crypto quote provider with Demo API key support.
 */

import { MarketDataProvider, MarketQuote } from './types'

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

export class CoinGeckoProvider implements MarketDataProvider {
  name = 'coingecko'

  async getQuote(symbol: string): Promise<MarketQuote | null> {
    const cleanSymbol = symbol.trim().toUpperCase()
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
      const res = await fetch(url, { headers, next: { revalidate: 300 } })

      if (!res.ok) {
        console.warn(`[CoinGecko] HTTP ${res.status} for ${cleanSymbol}`)
        return null
      }

      const data = await res.json()
      const item = data[coinId]
      if (!item || item.usd === undefined) {
        return null
      }

      const usdPrice = item.usd
      const change24h = item.usd_24h_change ?? 0

      return {
        symbol: cleanSymbol,
        price: usdPrice,
        change: (usdPrice * change24h) / 100,
        changePercent: change24h,
        timestamp: Date.now(),
        provider: this.name,
        currency: 'USD',
      }
    } catch (error) {
      console.error(`[CoinGecko] Error fetching quote for ${symbol}:`, error)
      return null
    }
  }
}

export const coinGeckoProvider = new CoinGeckoProvider()
