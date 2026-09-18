import { yahooFinanceProvider } from './yahoo'
import { coinGeckoProvider } from './coingecko'
import { MarketQuote } from './types'
import { WatchlistType } from '@prisma/client'

const CRYPTO_SYMBOLS = new Set([
  'BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'AVAX', 'DOT', 'LINK',
  'USDT', 'USDC', 'MATIC', 'NEAR', 'SUI', 'PEPE', 'SHIB', 'LTC', 'BCH'
])

export interface ResolvedQuoteResult {
  quote: MarketQuote | null
  itemType: WatchlistType
  market: 'US' | 'TH' | 'GLOBAL'
}

const resolverCache = new Map<string, { result: ResolvedQuoteResult; timestamp: number }>()
const RESOLVER_CACHE_TTL_MS = 60 * 1000 // 60 seconds

export async function resolveMarketQuote(
  rawSymbol: string,
  hintType?: WatchlistType | string,
  hintMarket?: string
): Promise<ResolvedQuoteResult> {
  const symbol = rawSymbol.trim().toUpperCase()
  if (!symbol) {
    return { quote: null, itemType: 'stock', market: 'US' }
  }

  const cacheKey = `${symbol}_${hintType || ''}_${hintMarket || ''}`
  const now = Date.now()
  const cached = resolverCache.get(cacheKey)
  if (cached && now - cached.timestamp < RESOLVER_CACHE_TTL_MS) {
    return cached.result
  }

  const result = await doResolveMarketQuote(symbol, hintType, hintMarket)
  if (result && result.quote) {
    resolverCache.set(cacheKey, { result, timestamp: now })
  }
  return result
}

async function doResolveMarketQuote(
  symbol: string,
  hintType?: WatchlistType | string,
  hintMarket?: string
): Promise<ResolvedQuoteResult> {
  // 1. Explicit or detected Crypto
  if (hintType === 'crypto' || CRYPTO_SYMBOLS.has(symbol)) {
    const quote = await coinGeckoProvider.getQuote(symbol)
    if (quote) {
      return { quote, itemType: 'crypto', market: 'GLOBAL' }
    }
  }

  // 2. Gold or Commodity
  if (hintType === 'gold' || symbol === 'GOLD' || symbol === 'XAU' || symbol === 'GC=F') {
    const quote = await yahooFinanceProvider.getQuote('GOLD')
    if (quote) {
      return {
        quote: { ...quote, symbol: 'GOLD' },
        itemType: 'gold',
        market: 'GLOBAL',
      }
    }
  }

  // 3. Explicit Thai Stock
  if (hintMarket === 'TH' || symbol.endsWith('.BK')) {
    const cleanSymbol = symbol.replace(/\.BK$/i, '')
    const quote = await yahooFinanceProvider.getQuote(cleanSymbol, 'TH')
    if (quote) {
      return { quote, itemType: 'stock', market: 'TH' }
    }
  }

  // 4. Default: Try US Equities / Global Yahoo Ticker
  let quote = await yahooFinanceProvider.getQuote(symbol, 'US')
  if (quote) {
    const isIndex = symbol.startsWith('^') || symbol.includes('INDEX')
    return {
      quote,
      itemType: isIndex ? 'index' : (hintType === 'crypto' ? 'crypto' : 'stock'),
      market: 'US',
    }
  }

  // 5. Fallback: Try Thai stock if not explicitly set
  if (!hintMarket || hintMarket !== 'US') {
    quote = await yahooFinanceProvider.getQuote(symbol, 'TH')
    if (quote) {
      return { quote, itemType: 'stock', market: 'TH' }
    }
  }

  // 6. Fallback: Try Crypto if not tried yet
  if (hintType !== 'stock') {
    quote = await coinGeckoProvider.getQuote(symbol)
    if (quote) {
      return { quote, itemType: 'crypto', market: 'GLOBAL' }
    }
  }

  return { quote: null, itemType: (hintType as WatchlistType) || 'stock', market: 'US' }
}
