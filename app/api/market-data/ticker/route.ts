import { NextResponse } from 'next/server'
import { yahooFinanceProvider } from '@/lib/market-data/yahoo'
import { coinGeckoProvider } from '@/lib/market-data/coingecko'
import { getExchangeRate } from '@/lib/market-data/frankfurter'

export interface TickerItem {
  symbol: string
  name: string
  price: number
  changePercent: number
  change: number
  currency: 'USD' | 'THB' | 'PTS'
  category: 'index' | 'crypto' | 'stock' | 'commodity' | 'fx'
}

// In-memory cache for the ticker list (30s)
let cachedTicker: { items: TickerItem[]; timestamp: number } | null = null
const CACHE_DURATION = 30 * 1000

export async function GET() {
  const now = Date.now()
  if (cachedTicker && now - cachedTicker.timestamp < CACHE_DURATION) {
    return NextResponse.json({
      items: cachedTicker.items,
      timestamp: cachedTicker.timestamp,
      cached: true,
    })
  }

  try {
    // 1. Parallel fetch from live providers with fallback
    const [
      setQuote,
      spxQuote,
      nasdaqQuote,
      btcQuote,
      ethQuote,
      solQuote,
      bnbQuote,
      nvdaQuote,
      aaplQuote,
      tslaQuote,
      pttQuote,
      deltaQuote,
      goldQuote,
      usdThb,
      eurThb,
      jpyThb,
    ] = await Promise.allSettled([
      yahooFinanceProvider.getQuote('SET INDEX'),
      yahooFinanceProvider.getQuote('S&P 500'),
      yahooFinanceProvider.getQuote('NASDAQ'),
      coinGeckoProvider.getQuote('BTC'),
      coinGeckoProvider.getQuote('ETH'),
      coinGeckoProvider.getQuote('SOL'),
      coinGeckoProvider.getQuote('BNB'),
      yahooFinanceProvider.getQuote('NVDA'),
      yahooFinanceProvider.getQuote('AAPL'),
      yahooFinanceProvider.getQuote('TSLA'),
      yahooFinanceProvider.getQuote('PTT', 'TH'),
      yahooFinanceProvider.getQuote('DELTA', 'TH'),
      yahooFinanceProvider.getQuote('GOLD'),
      getExchangeRate('USD', 'THB'),
      getExchangeRate('EUR', 'THB'),
      getExchangeRate('JPY', 'THB'),
    ])

    const items: TickerItem[] = []

    // Helper to safely extract quote
    const getVal = (res: PromiseSettledResult<any>) =>
      res.status === 'fulfilled' ? res.value : null

    // 1. Indices
    const set = getVal(setQuote)
    if (set && set.price > 0) {
      items.push({
        symbol: 'SET INDEX',
        name: 'ตลาดหุ้นไทย',
        price: set.price,
        changePercent: set.changePercent,
        change: set.change,
        currency: 'PTS',
        category: 'index',
      })
    }

    const spx = getVal(spxQuote)
    if (spx && spx.price > 0) {
      items.push({
        symbol: 'S&P 500',
        name: 'ดัชนีสหรัฐฯ',
        price: spx.price,
        changePercent: spx.changePercent,
        change: spx.change,
        currency: 'USD',
        category: 'index',
      })
    }

    const ndq = getVal(nasdaqQuote)
    if (ndq && ndq.price > 0) {
      items.push({
        symbol: 'NASDAQ',
        name: 'หุ้นเทคโนโลยี',
        price: ndq.price,
        changePercent: ndq.changePercent,
        change: ndq.change,
        currency: 'USD',
        category: 'index',
      })
    }

    // 2. Crypto
    const btc = getVal(btcQuote)
    if (btc && btc.price > 0) {
      items.push({
        symbol: 'BTC',
        name: 'Bitcoin',
        price: btc.price,
        changePercent: btc.changePercent,
        change: btc.change,
        currency: 'USD',
        category: 'crypto',
      })
    }

    const eth = getVal(ethQuote)
    if (eth && eth.price > 0) {
      items.push({
        symbol: 'ETH',
        name: 'Ethereum',
        price: eth.price,
        changePercent: eth.changePercent,
        change: eth.change,
        currency: 'USD',
        category: 'crypto',
      })
    }

    const sol = getVal(solQuote)
    if (sol && sol.price > 0) {
      items.push({
        symbol: 'SOL',
        name: 'Solana',
        price: sol.price,
        changePercent: sol.changePercent,
        change: sol.change,
        currency: 'USD',
        category: 'crypto',
      })
    }

    const bnb = getVal(bnbQuote)
    if (bnb && bnb.price > 0) {
      items.push({
        symbol: 'BNB',
        name: 'BNB',
        price: bnb.price,
        changePercent: bnb.changePercent,
        change: bnb.change,
        currency: 'USD',
        category: 'crypto',
      })
    }

    // 3. Gold & Commodities
    const gold = getVal(goldQuote)
    if (gold && gold.price > 0) {
      items.push({
        symbol: 'GOLD (XAU)',
        name: 'ทองคำโลก',
        price: gold.price,
        changePercent: gold.changePercent,
        change: gold.change,
        currency: 'USD',
        category: 'commodity',
      })
    }

    // 4. US Stocks
    const nvda = getVal(nvdaQuote)
    if (nvda && nvda.price > 0) {
      items.push({
        symbol: 'NVDA',
        name: 'NVIDIA Corp',
        price: nvda.price,
        changePercent: nvda.changePercent,
        change: nvda.change,
        currency: 'USD',
        category: 'stock',
      })
    }

    const aapl = getVal(aaplQuote)
    if (aapl && aapl.price > 0) {
      items.push({
        symbol: 'AAPL',
        name: 'Apple Inc',
        price: aapl.price,
        changePercent: aapl.changePercent,
        change: aapl.change,
        currency: 'USD',
        category: 'stock',
      })
    }

    const tsla = getVal(tslaQuote)
    if (tsla && tsla.price > 0) {
      items.push({
        symbol: 'TSLA',
        name: 'Tesla Inc',
        price: tsla.price,
        changePercent: tsla.changePercent,
        change: tsla.change,
        currency: 'USD',
        category: 'stock',
      })
    }

    // 5. Thai Stocks
    const ptt = getVal(pttQuote)
    if (ptt && ptt.price > 0) {
      items.push({
        symbol: 'PTT',
        name: 'ปตท.',
        price: ptt.price,
        changePercent: ptt.changePercent,
        change: ptt.change,
        currency: 'THB',
        category: 'stock',
      })
    }

    const delta = getVal(deltaQuote)
    if (delta && delta.price > 0) {
      items.push({
        symbol: 'DELTA',
        name: 'เดลต้า อีเลคโทรนิคส์',
        price: delta.price,
        changePercent: delta.changePercent,
        change: delta.change,
        currency: 'THB',
        category: 'stock',
      })
    }

    // 6. Foreign Exchange Rates (FX)
    const usdRate = getVal(usdThb)
    if (usdRate && usdRate > 0) {
      items.push({
        symbol: 'USD / THB',
        name: 'ดอลลาร์/บาท',
        price: usdRate,
        changePercent: 0,
        change: 0,
        currency: 'THB',
        category: 'fx',
      })
    }

    const eurRate = getVal(eurThb)
    if (eurRate && eurRate > 0) {
      items.push({
        symbol: 'EUR / THB',
        name: 'ยูโร/บาท',
        price: eurRate,
        changePercent: 0,
        change: 0,
        currency: 'THB',
        category: 'fx',
      })
    }

    const jpyRate = getVal(jpyThb)
    if (jpyRate && jpyRate > 0) {
      items.push({
        symbol: 'JPY / THB',
        name: 'เยน/บาท',
        price: jpyRate,
        changePercent: 0,
        change: 0,
        currency: 'THB',
        category: 'fx',
      })
    }

    if (items.length > 0) {
      cachedTicker = { items, timestamp: now }
    }

    return NextResponse.json({
      items: items.length > 0 ? items : (cachedTicker?.items ?? []),
      timestamp: now,
      cached: false,
    })
  } catch (err: any) {
    console.error('[Ticker API error]', err)
    if (cachedTicker) {
      return NextResponse.json({
        items: cachedTicker.items,
        timestamp: cachedTicker.timestamp,
        cached: true,
      })
    }
    return NextResponse.json({ error: 'Failed to fetch ticker data' }, { status: 500 })
  }
}
