import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getBatchTechnicalSignals } from '@/lib/market-data/technical-signals'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const tickersParam = searchParams.get('tickers')
  const marketParam = searchParams.get('market')
  const forceRefresh = searchParams.get('refresh') === 'true'

  if (!tickersParam) {
    return NextResponse.json({ error: 'Missing tickers parameter' }, { status: 400 })
  }

  const rawList = tickersParam.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean)

  if (rawList.length === 0) {
    return NextResponse.json({ signals: {} })
  }

  try {
    // Look up asset market metadata from DB so Thai stocks & crypto get their true market hint
    const dbAssets = await prisma.asset.findMany({
      where: { ticker: { in: rawList } },
      select: { ticker: true, market: true, currency: true },
    })
    const assetMarketMap = new Map<string, string>()
    for (const a of dbAssets) {
      assetMarketMap.set(a.ticker.toUpperCase(), a.market || (a.currency === 'THB' ? 'TH' : 'US'))
    }

    const tickerItems = rawList.map((ticker) => ({
      ticker,
      market:
        marketParam ||
        assetMarketMap.get(ticker) ||
        (ticker.endsWith('.BK') ? 'TH' : 'US'),
    }))

    const signals = await getBatchTechnicalSignals(tickerItems, forceRefresh)
    return NextResponse.json({ signals })
  } catch (error: any) {
    console.error('[technical-signals GET]', error)
    return NextResponse.json({ error: error.message || 'Failed to fetch technical signals' }, { status: 500 })
  }
}
