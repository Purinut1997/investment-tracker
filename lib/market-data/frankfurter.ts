/**
 * lib/market-data/frankfurter.ts
 * Free, unlimited currency exchange rate provider via Frankfurter API.
 */

import { FxRate } from './types'
import { prisma } from '@/lib/prisma'

const fxMemoryCache = new Map<string, { rate: number; timestamp: number }>()
const FX_CACHE_TTL_MS = 15 * 60 * 1000 // 15 minutes in-memory cache

export async function getExchangeRate(
  baseCurrency = 'USD',
  targetCurrency = 'THB'
): Promise<number | null> {
  const base = baseCurrency.toUpperCase()
  const target = targetCurrency.toUpperCase()

  if (base === target) return 1.0

  const cacheKey = `${base}_${target}`
  const now = Date.now()
  const inMem = fxMemoryCache.get(cacheKey)
  if (inMem && now - inMem.timestamp < FX_CACHE_TTL_MS) {
    return inMem.rate
  }

  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  try {
    // 1. Check ExchangeRateHistory in DB first
    const cached = await prisma.exchangeRateHistory.findUnique({
      where: {
        baseCurrency_targetCurrency_rateDate: {
          baseCurrency: base,
          targetCurrency: target,
          rateDate: today,
        },
      },
    })

    if (cached) {
      return Number(cached.rate)
    }

    // 2. Fetch fresh from Frankfurter
    const url = `https://api.frankfurter.app/latest?from=${base}&to=${target}`
    const res = await fetch(url, { next: { revalidate: 3600 } })

    if (!res.ok) {
      console.warn(`[Frankfurter] HTTP ${res.status} for ${base}/${target}`)
      // Fallback: check most recent rate in DB
      const latest = await prisma.exchangeRateHistory.findFirst({
        where: { baseCurrency: base, targetCurrency: target },
        orderBy: { rateDate: 'desc' },
      })
      return latest ? Number(latest.rate) : null
    }

    const data = await res.json()
    const rate = data.rates?.[target]

    if (rate && typeof rate === 'number') {
      // Cache in DB asynchronously
      prisma.exchangeRateHistory
        .upsert({
          where: {
            baseCurrency_targetCurrency_rateDate: {
              baseCurrency: base,
              targetCurrency: target,
              rateDate: today,
            },
          },
          update: { rate },
          create: {
            baseCurrency: base,
            targetCurrency: target,
            rate,
            rateDate: today,
          },
        })
        .catch((err) => console.error('[Frankfurter DB Cache Error]', err))

      return rate
    }

    return null
  } catch (error) {
    console.error(`[Frankfurter] Error fetching FX rate ${base}/${target}:`, error)
    // Fallback: return last known rate from DB
    try {
      const fallback = await prisma.exchangeRateHistory.findFirst({
        where: { baseCurrency: base, targetCurrency: target },
        orderBy: { rateDate: 'desc' },
      })
      return fallback ? Number(fallback.rate) : null
    } catch {
      return null
    }
  }
}
