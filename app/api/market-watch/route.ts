import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { finnhubProvider } from '@/lib/market-data/finnhub'
import { coinGeckoProvider } from '@/lib/market-data/coingecko'
import { stooqProvider } from '@/lib/market-data/stooq'
import { getExchangeRate } from '@/lib/market-data/frankfurter'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // 1. Fetch Crypto quotes
    const cryptoSymbols = ['BTC', 'ETH', 'SOL', 'BNB']
    const cryptoQuotes = await Promise.all(
      cryptoSymbols.map((s) => coinGeckoProvider.getQuote(s))
    )

    // 2. Fetch US stocks
    const usSymbols = ['AAPL', 'NVDA', 'MSFT', 'TSLA']
    const usQuotes = await Promise.all(
      usSymbols.map(async (s) => {
        let q = await finnhubProvider.getQuote(s)
        if (!q) q = await stooqProvider.getQuote(`${s}.US`, 'US')
        return q
      })
    )

    // 3. Fetch Thai stocks
    const thSymbols = ['PTT', 'CPALL', 'BDMS', 'DELTA']
    const thQuotes = await Promise.all(
      thSymbols.map((s) => stooqProvider.getQuote(s, 'TH'))
    )

    // 4. Fetch Commodities & FX
    const [goldQuote, usdThb, eurThb, jpyThb] = await Promise.all([
      stooqProvider.getQuote('GC.F', 'COMMODITY'),
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
