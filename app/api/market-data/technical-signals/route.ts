import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getBatchTechnicalSignals } from '@/lib/market-data/technical-signals'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const tickersParam = searchParams.get('tickers')
  const marketParam = searchParams.get('market') || 'US'

  if (!tickersParam) {
    return NextResponse.json({ error: 'Missing tickers parameter' }, { status: 400 })
  }

  const rawList = tickersParam.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean)

  if (rawList.length === 0) {
    return NextResponse.json({ signals: {} })
  }

  try {
    const tickerItems = rawList.map((ticker) => ({
      ticker,
      market: ticker.endsWith('.BK') ? 'TH' : marketParam,
    }))

    const signals = await getBatchTechnicalSignals(tickerItems)
    return NextResponse.json({ signals })
  } catch (error: any) {
    console.error('[technical-signals GET]', error)
    return NextResponse.json({ error: error.message || 'Failed to fetch technical signals' }, { status: 500 })
  }
}
