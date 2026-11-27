/**
 * lib/market-data/frankfurter.ts
 * Free, unlimited currency exchange rate provider via Frankfurter API.
 */

import { prisma } from '../prisma'

type FxObservation = {
  rate: number
  asOf: string | null
  source: 'Frankfurter' | 'cache' | 'identity' | 'estimate'
}
const fxMemoryCache = new Map<string, { value: FxObservation; timestamp: number }>()
const fxInFlight = new Map<string, Promise<FxObservation | null>>()
const FX_CACHE_TTL_MS = 15 * 60 * 1000

export async function getExchangeRateObservation(baseCurrency = 'USD', targetCurrency = 'THB'): Promise<FxObservation | null> {
  const base = baseCurrency.toUpperCase()
  const target = targetCurrency.toUpperCase()
  if (base === target) return { rate: 1, asOf: null, source: 'identity' }

  const key = `${base}_${target}`
  const now = Date.now()
  const cached = fxMemoryCache.get(key)
  if (cached && now - cached.timestamp < FX_CACHE_TTL_MS) return cached.value
  const pending = fxInFlight.get(key)
  if (pending) return pending

  const load = async (): Promise<FxObservation | null> => {
    const today = new Date(now)
    today.setUTCHours(0, 0, 0, 0)
    const latest = await prisma.exchangeRateHistory.findFirst({
      where: { baseCurrency: base, targetCurrency: target, rateDate: { lte: today } },
      orderBy: { rateDate: 'desc' },
    }).catch(() => null)
    const storedRate = Number(latest?.rate)
    // Existing records may store the refresh date rather than the source observation date.
    const stored: FxObservation | null = latest && Number.isFinite(storedRate) && storedRate > 0
      ? { rate: storedRate, asOf: null, source: 'cache' } : null
    try {
      const response = await fetch(`https://api.frankfurter.app/latest?from=${base}&to=${target}`, {
        next: { revalidate: 3600 },
        signal: AbortSignal.timeout(4000),
      } as RequestInit)
      if (!response.ok) return stored
      const data = await response.json()
      const rate: unknown = data.rates?.[target]
      if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) return stored
      const date = typeof data.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.date)
        ? new Date(data.date + 'T00:00:00Z') : null
      const observed = date && Number.isFinite(+date) && +date <= +today ? date : null
      if (observed) {
        void prisma.exchangeRateHistory.upsert({
          where: { baseCurrency_targetCurrency_rateDate: { baseCurrency: base, targetCurrency: target, rateDate: observed } },
          update: { rate },
          create: { baseCurrency: base, targetCurrency: target, rateDate: observed, rate },
        }).catch(error => console.error('[Frankfurter DB Cache Error]', error))
      }
      return { rate, asOf: observed?.toISOString() ?? null, source: 'Frankfurter' }
    } catch {
      return stored
    }
  }
  const task = load().then(value => {
    if (value) fxMemoryCache.set(key, { value, timestamp: now })
    return value
  }).finally(() => fxInFlight.delete(key))
  fxInFlight.set(key, task)
  return task
}

export async function getExchangeRate(baseCurrency = 'USD', targetCurrency = 'THB') {
  return (await getExchangeRateObservation(baseCurrency, targetCurrency))?.rate ?? null
}

export async function getValuationRates(currencies: Iterable<string>, baseCurrency: string) {
  const base = baseCurrency.toUpperCase()
  const entries = await Promise.all([...new Set(currencies)].map(async currency => {
    const observation = await getExchangeRateObservation(currency, base)
    const estimate = currency === 'USD' && base === 'THB' ? 35.5
      : currency === 'THB' && base === 'USD' ? 1 / 35.5 : null
    const value: FxObservation | null = observation ?? (estimate
      ? { rate: estimate, asOf: null, source: 'estimate' } : null)
    return [currency, value] as const
  }))
  return Object.fromEntries(entries)
}

export function describeValuationRate(currency: string, baseCurrency: string, value: FxObservation | null) {
  const pair = currency + '/' + baseCurrency.toUpperCase()
  if (!value) return `ขาดอัตรา ${pair} จึงเว้นยอดสกุลนี้จากยอดรวม`
  if (value.source === 'identity') return null
  if (value.source === 'estimate') return `ใช้อัตราประมาณการ ${pair}`
  if (!value.asOf || Date.now() - Date.parse(value.asOf) > 4 * 86400_000) {
    return `อัตรา ${pair} เก่าหรือไม่ทราบเวลาของข้อมูล`
  }
  return null
}

export async function valueCashAccounts(accounts: { cashBalance: unknown; currency?: string | null }[], baseCurrency: string) {
  const balances = accounts.map(account => ({
    amount: Number(account.cashBalance),
    currency: (account.currency || 'THB').toUpperCase(),
  })).filter(account => Number.isFinite(account.amount) && account.amount !== 0)
  const rates = await getValuationRates(balances.map(account => account.currency), baseCurrency)
  return {
    totalCash: balances.reduce((sum, account) => sum + account.amount * (rates[account.currency]?.rate ?? 0), 0),
    valuationIssues: Object.entries(rates).flatMap(([currency, rate]) => describeValuationRate(currency, baseCurrency, rate) ?? []),
    rates,
  }
}
