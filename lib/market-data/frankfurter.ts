/**
 * lib/market-data/frankfurter.ts
 * Free, unlimited currency exchange rate provider via Frankfurter API.
 */

import { FxRate } from './types'
import { prisma } from '../prisma'

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
      const rateVal = Number(cached.rate)
      fxMemoryCache.set(cacheKey, { rate: rateVal, timestamp: now })
      return rateVal
    }

    // 2. Fetch fresh from Frankfurter
    const url = `https://api.frankfurter.app/latest?from=${base}&to=${target}`
    const fetchOptions: RequestInit & { next?: { revalidate?: number } } = {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(4000),
    }
    const res = await fetch(url, fetchOptions as RequestInit)

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
      fxMemoryCache.set(cacheKey, { rate, timestamp: now })
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

/**
 * Sum cash balances across multi-currency investment accounts into baseCurrency.
 */
export async function sumAccountCashInBaseCurrency(
  accounts: Array<{ cashBalance: unknown; currency?: string | null }>,
  baseCurrency = 'THB',
  preloadedUsdThbRate?: number
): Promise<number> {
  if (!accounts || accounts.length === 0) return 0

  const target = baseCurrency.toUpperCase()
  const uniqueCurrencies = Array.from(
    new Set(
      accounts
        .map((acc) => (acc.currency || 'THB').toUpperCase())
        .filter((curr) => curr !== target)
    )
  )

  const rateMap = new Map<string, number>()
  await Promise.all(
    uniqueCurrencies.map(async (curr) => {
      if (curr === 'USD' && target === 'THB' && preloadedUsdThbRate && preloadedUsdThbRate > 0) {
        rateMap.set(curr, preloadedUsdThbRate)
        return
      }
      if (curr === 'THB' && target === 'USD' && preloadedUsdThbRate && preloadedUsdThbRate > 0) {
        rateMap.set(curr, 1 / preloadedUsdThbRate)
        return
      }

      const rate = await getExchangeRate(curr, target)
      if (rate && rate > 0) {
        rateMap.set(curr, rate)
      } else if (curr === 'USD' && target === 'THB') {
        rateMap.set(curr, preloadedUsdThbRate ?? 35.5)
      } else if (curr === 'THB' && target === 'USD') {
        rateMap.set(curr, 1 / (preloadedUsdThbRate ?? 35.5))
      } else {
        rateMap.set(curr, 1.0)
      }
    })
  )

  let totalCash = 0
  for (const acc of accounts) {
    const bal = Number(acc.cashBalance) || 0
    if (bal === 0) continue
    const curr = (acc.currency || 'THB').toUpperCase()
    const fx = curr === target ? 1.0 : (rateMap.get(curr) ?? 1.0)
    totalCash += bal * fx
  }
  return totalCash
}
