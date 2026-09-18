import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { resolveMarketQuote } from '@/lib/market-data/resolver'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  const market = req.nextUrl.searchParams.get('market') ?? undefined
  const type = req.nextUrl.searchParams.get('type') ?? undefined

  if (!q) {
    return NextResponse.json({ suggestions: [], previewQuote: null })
  }

  try {
    // 1. Resolve live quote for the typed symbol
    const resolvedPromise = resolveMarketQuote(q, type, market)

    // 2. Fetch Yahoo suggestions for auto-complete if not purely crypto
    const yahooSearchPromise = (type !== 'crypto')
      ? fetch(`https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=5&newsCount=0`, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          next: { revalidate: 300 },
        })
          .then((res) => (res.ok ? res.json() : null))
          .catch(() => null)
      : Promise.resolve(null)

    const [resolved, yahooData] = await Promise.all([resolvedPromise, yahooSearchPromise])

    const rawSuggestions = yahooData?.quotes ?? []
    const suggestions = rawSuggestions
      .filter((item: any) => item.symbol && (item.shortname || item.longname))
      .map((item: any) => {
        const isThai = item.symbol.endsWith('.BK') || item.exchange === 'SET'
        const cleanSymbol = item.symbol.replace(/\.BK$/i, '')
        return {
          symbol: isThai ? cleanSymbol : item.symbol,
          rawSymbol: item.symbol,
          name: item.shortname || item.longname || item.symbol,
          type: item.typeDisp || item.quoteType,
          exchange: item.exchange,
          market: isThai ? 'TH' : 'US',
        }
      })

    return NextResponse.json({
      previewQuote: resolved.quote,
      itemType: resolved.itemType,
      market: resolved.market,
      suggestions,
    })
  } catch (error) {
    console.error('[watchlist/search GET]', error)
    return NextResponse.json({ error: 'Failed to search ticker' }, { status: 500 })
  }
}
