import { NextRequest, NextResponse } from 'next/server'
import { coinGeckoProvider } from '@/lib/market-data/coingecko'
import { yahooFinanceProvider } from '@/lib/market-data/yahoo'
import { getExchangeRate } from '@/lib/market-data/frankfurter'

let marketWatchCache: { data: any; timestamp: number } | null = null
let inFlightMarketWatch: Promise<any> | null = null
const MARKET_WATCH_CACHE_TTL_MS = 45 * 1000 // 45 seconds in-memory cache

export async function GET(req: NextRequest) {
  const forceRefresh = req.nextUrl.searchParams.get('refresh') === 'true'
  const now = Date.now()

  // 1. Return in-memory cache if fresh (<0.1ms)
  if (!forceRefresh && marketWatchCache && now - marketWatchCache.timestamp < MARKET_WATCH_CACHE_TTL_MS) {
    return NextResponse.json(marketWatchCache.data, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      },
    })
  }

  // Deduplicate concurrent requests
  if (!forceRefresh && inFlightMarketWatch) {
    const data = await inFlightMarketWatch
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      },
    })
  }

  try {
    const cryptoSymbols = ['BTC', 'ETH', 'SOL', 'BNB']
    const usSymbols = ['AAPL', 'NVDA', 'MSFT', 'TSLA']
    const thSymbols = ['PTT', 'CPALL', 'BDMS', 'DELTA']

    const fetchPromise = (async () => {
      // Parallel fetch ALL 4 categories concurrently
      const [cryptoQuotes, usQuotes, thQuotes, [goldQuote, usdThb, eurThb, jpyThb]] = await Promise.all([
        Promise.all(cryptoSymbols.map((s) => coinGeckoProvider.getQuote(s))),
        Promise.all(usSymbols.map((s) => yahooFinanceProvider.getQuote(s, 'US'))),
        Promise.all(thSymbols.map((s) => yahooFinanceProvider.getQuote(s, 'TH'))),
        Promise.all([
          yahooFinanceProvider.getQuote('GOLD'),
          getExchangeRate('USD', 'THB'),
          getExchangeRate('EUR', 'THB'),
          getExchangeRate('JPY', 'THB'),
        ]),
      ])

      const commoditiesAndFx = [
        ...(goldQuote ? [{ ...goldQuote, symbol: 'GOLD (XAU/USD)' }] : []),
        ...(usdThb ? [{ symbol: 'USD / THB', price: usdThb, change: 0, changePercent: 0, currency: 'THB', provider: 'frankfurter', timestamp: Date.now() }] : []),
        ...(eurThb ? [{ symbol: 'EUR / THB', price: eurThb, change: 0, changePercent: 0, currency: 'THB', provider: 'frankfurter', timestamp: Date.now() }] : []),
        ...(jpyThb ? [{ symbol: 'JPY / THB', price: jpyThb, change: 0, changePercent: 0, currency: 'THB', provider: 'frankfurter', timestamp: Date.now() }] : []),
      ]

      const payload = {
        crypto: cryptoQuotes.filter(Boolean),
        usStocks: usQuotes.filter(Boolean),
        thStocks: thQuotes.filter(Boolean),
        fxAndCommodities: commoditiesAndFx,
        timestamp: Date.now(),
      }

      marketWatchCache = { data: payload, timestamp: Date.now() }
      return payload
    })()

    inFlightMarketWatch = fetchPromise
    fetchPromise.finally(() => {
      inFlightMarketWatch = null
    })

    const payload = await fetchPromise

    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      },
    })
  } catch (error) {
    console.error('[market-watch GET]', error)
    if (marketWatchCache) {
      return NextResponse.json(marketWatchCache.data)
    }
    return NextResponse.json({ error: 'Failed to fetch market watch data' }, { status: 500 })
  }
}
