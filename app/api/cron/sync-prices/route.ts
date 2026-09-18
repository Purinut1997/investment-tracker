import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCachedOrFetchPrice, invalidatePriceCache } from '@/lib/market-data/cache-layer'
import { getExchangeRate } from '@/lib/market-data/frankfurter'
import { invalidateUserHoldingsCache } from '@/lib/analytics/holdings'

export const maxDuration = 60 // Allow 60 seconds on Vercel

export async function GET(req: NextRequest) {
  // 1. Verify CRON_SECRET authorization header
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized cron request' }, { status: 401 })
  }

  const results = {
    syncedAssets: 0,
    syncedFx: 0,
    errors: [] as string[],
    timestamp: new Date().toISOString(),
  }

  try {
    // 2. Sync Exchange Rates (USD/THB, EUR/THB, SGD/THB)
    const currencies = ['USD', 'EUR', 'SGD', 'JPY']
    for (const curr of currencies) {
      try {
        const rate = await getExchangeRate(curr, 'THB')
        if (rate) results.syncedFx++
      } catch (err: any) {
        results.errors.push(`FX ${curr}/THB error: ${err.message}`)
      }
    }

    // 3. Find distinct active assets held by users in transactions
    const distinctAssets = await prisma.transaction.findMany({
      select: { assetId: true },
      distinct: ['assetId'],
      take: 20, // Limit batch size to stay within Vercel execution window
    })

    const today = new Date()

    // 4. Update prices with a small delay between requests to be polite with rate limits
    for (const item of distinctAssets) {
      try {
        const priceResult = await getCachedOrFetchPrice(item.assetId, today, true)
        if (priceResult) {
          results.syncedAssets++
        }
        // Small throttle delay (500ms)
        await new Promise((resolve) => setTimeout(resolve, 500))
      } catch (err: any) {
        results.errors.push(`Asset ${item.assetId} error: ${err.message}`)
      }
    }

    // Invalidate caches so users immediately see updated prices
    invalidatePriceCache()
    invalidateUserHoldingsCache()

    // 5. Log Cron execution to AuditLog
    await prisma.auditLog.create({
      data: {
        action: 'CRON_SYNC_PRICES',
        detail: results as any,
        ipAddress: req.headers.get('x-forwarded-for') ?? 'cron',
      },
    })

    return NextResponse.json({ success: true, results })
  } catch (error: any) {
    console.error('[cron/sync-prices]', error)
    return NextResponse.json({ error: error.message || 'Cron execution failed' }, { status: 500 })
  }
}
