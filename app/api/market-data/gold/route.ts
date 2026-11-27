import { getObservationTime } from '@/lib/ai/advisor-evidence'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { yahooFinanceProvider } from '@/lib/market-data/yahoo'
import { stooqProvider } from '@/lib/market-data/stooq'
import { describeValuationRate, getExchangeRateObservation } from '@/lib/market-data/frankfurter'
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
      getExchangeRateObservation('USD', 'THB'),
    ])

    let xauQuote = xauYahoo
    const now = Date.now()
    if (!xauQuote || xauQuote.price <= 0 || !getObservationTime(xauQuote.observationTimestamp, now)) {
      xauQuote = await stooqProvider.getQuote('GC.F', 'COMMODITY', forceRefresh).catch(() => null)
    }

    const observedAt = getObservationTime(xauQuote?.observationTimestamp, now)
    const xauUsdPerOz = observedAt && xauQuote && xauQuote.price > 0 ? xauQuote.price : null
    const usdThbRate = usdThbRaw && !describeValuationRate('USD', 'THB', usdThbRaw) ? usdThbRaw.rate : null
    const thai965ThbPerBaht = xauUsdPerOz !== null && usdThbRate !== null
      ? calculateThai965PricePerBaht(xauUsdPerOz, usdThbRate) : null

    return NextResponse.json({
      xauUsdPerOz,
      changePercent: xauQuote?.changePercent ?? 0,
      usdThbRate,
      thai965ThbPerBaht,
      gramsPerOz: GRAMS_PER_TROY_OZ,
      provider: xauUsdPerOz === null ? null : xauQuote?.provider,
      updatedAt: observedAt,
    })
  } catch (error: any) {
    console.error('[GET /api/market-data/gold error]', error)
    return NextResponse.json(
      { error: error.message || 'Failed to load live gold price' },
      { status: 500 }
    )
  }
}
