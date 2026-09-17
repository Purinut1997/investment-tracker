import { NextRequest, NextResponse } from 'next/server'
import { coinGeckoProvider } from '@/lib/market-data/coingecko'
import { yahooFinanceProvider } from '@/lib/market-data/yahoo'
import { getExchangeRate } from '@/lib/market-data/frankfurter'

export async function GET(req: NextRequest) {
  try {
    // 1. Fetch Crypto quotes
    const cryptoSymbols = ['BTC', 'ETH', 'SOL', 'BNB']
    const cryptoQuotes = await Promise.all(
      cryptoSymbols.map((s) => coinGeckoProvider.getQuote(s))
    )

    // 2. Fetch US stocks
    const usSymbols = ['AAPL', 'NVDA', 'MSFT', 'TSLA']
    const usQuotes = await Promise.all(
      usSymbols.map(async (s) => yahooFinanceProvider.getQuote(s, 'US'))
    )

    // 3. Fetch Thai stocks
    const thSymbols = ['PTT', 'CPALL', 'BDMS', 'DELTA']
    const thQuotes = await Promise.all(
      thSymbols.map((s) => yahooFinanceProvider.getQuote(s, 'TH'))
    )

    // 4. Fetch Commodities & FX
    const [goldQuote, usdThb, eurThb, jpyThb] = await Promise.all([
      yahooFinanceProvider.getQuote('GOLD'),
      getExchangeRate('USD', 'THB'),
      getExchangeRate('EUR', 'THB'),
      getExchangeRate('JPY', 'THB'),
    ])

    const commoditiesAndFx = [
      ...(goldQuote ? [{ ...goldQuote, symbol: 'GOLD (XAU/USD)' }] : []),
      ...(usdThb ? [{ symbol: 'USD / THB', price: usdThb, change: 0, changePercent: 0, currency: 'THB', provider: 'frankfurter', timestamp: Date.now() }] : []),
      ...(eurThb ? [{ symbol: 'EUR / THB', price: eurThb, change: 0, changePercent: 0, currency: 'THB', provider: 'frankfurter', timestamp: Date.now() }] : []),
      ...(jpyThb ? [{ symbol: 'JPY / THB', price: jpyThb, change: 0, changePercent: 0, currency: 'THB', provider: 'frankfurter', timestamp: Date.now() }] : []),
    ]

    return NextResponse.json({
      crypto: cryptoQuotes.filter(Boolean),
      usStocks: usQuotes.filter(Boolean),
      thStocks: thQuotes.filter(Boolean),
      fxAndCommodities: commoditiesAndFx,
      timestamp: Date.now(),
    })
  } catch (error) {
    console.error('[market-watch GET]', error)
    return NextResponse.json({ error: 'Failed to fetch market watch data' }, { status: 500 })
  }
}
