import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { yahooFinanceProvider } from '@/lib/market-data/yahoo'
import { stooqProvider } from '@/lib/market-data/stooq'
import { getExchangeRate } from '@/lib/market-data/frankfurter'
import { GRAMS_PER_TROY_OZ, calculateThai965PricePerBaht } from '@/lib/market-data/gold'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const forceRefresh = req.nextUrl.searchParams.get('refresh') === 'true'

  try {
    const [xauYahoo, usdThbRaw] = await Promise.all([
      yahooFinanceProvider.getQuote('XAU', 'GLOBAL', forceRefresh).catch(() => null),
      getExchangeRate('USD', 'THB').catch(() => 35.5),
    ])

    let xauQuote = xauYahoo
    if (!xauQuote || xauQuote.price <= 0) {
      xauQuote = await stooqProvider.getQuote('GC.F', 'COMMODITY', forceRefresh).catch(() => null)
    }

    const xauUsdPerOz = xauQuote?.price ?? 0
    const usdThbRate = usdThbRaw ?? 35.5
    const thai965ThbPerBaht =
      xauUsdPerOz > 0 ? calculateThai965PricePerBaht(xauUsdPerOz, usdThbRate) : 0

    return NextResponse.json({
      xauUsdPerOz,
      changePercent: xauQuote?.changePercent ?? 0,
      usdThbRate,
      thai965ThbPerBaht,
      gramsPerOz: GRAMS_PER_TROY_OZ,
      provider: xauQuote?.provider || 'yahoo',
      updatedAt: Date.now(),
    })
  } catch (error: any) {
    console.error('[GET /api/market-data/gold error]', error)
    return NextResponse.json(
      { error: error.message || 'Failed to load live gold price' },
      { status: 500 }
    )
  }
}
