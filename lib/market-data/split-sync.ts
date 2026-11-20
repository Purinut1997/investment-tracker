/**
 * lib/market-data/split-sync.ts
 * Automatic Yahoo Finance corporate action (stock split & reverse split) discovery & persistence.
 */

import { prisma } from '../prisma'
import { isGoldTicker } from './gold'
import {
  formatSplitRatio,
  getSplitDateKey,
  normalizeSplitDate,
} from '../analytics/stock-splits'

export interface DiscoveredSplit {
  splitDate: Date
  numerator: number
  denominator: number
  splitRatio: string
}

export interface NewlyDetectedSplitInfo {
  assetId: string
  ticker: string
  splitDate: string
  splitRatio: string
}

// 6-hour per-asset cooldown cache to avoid redundant Yahoo requests on routine reads
const splitSyncCooldown = new Map<string, number>()
const SPLIT_SYNC_TTL_MS = 6 * 60 * 60 * 1000

export function invalidateSplitSyncCache(assetId?: string) {
  if (assetId) {
    splitSyncCooldown.delete(assetId)
  } else {
    splitSyncCooldown.clear()
  }
}

function shouldSkipSplitLookup(ticker: string, market: string, assetType: string): boolean {
  const mkt = String(market || '').toUpperCase()
  const type = String(assetType || '').toLowerCase()
  if (mkt === 'CRYPTO' || type === 'crypto' || type === 'gold') return true
  return isGoldTicker(ticker, assetType)
}

function formatYahooSplitTicker(ticker: string, market: string): string {
  const clean = String(ticker || '').trim().toUpperCase()
  const mkt = String(market || 'US').toUpperCase()
  if ((mkt === 'TH' || mkt === 'SET') && !clean.endsWith('.BK')) {
    return `${clean}.BK`
  }
  return clean
}

/**
 * Extracts validated, normalized split events from a Yahoo Finance v8 chart result.
 * Uses Object.values() and reads s.date (exact ex-split timestamp) rather than the object key.
 */
export function extractDiscoveredSplitsFromYahooChart(
  chartResult: any,
  market = 'US'
): DiscoveredSplit[] {
  const rawSplits = chartResult?.events?.splits
  if (!rawSplits || typeof rawSplits !== 'object') return []

  const entries = Object.values(rawSplits) as Array<{
    date?: number | string
    numerator?: number | string
    denominator?: number | string
    splitRatio?: string
  }>

  const byDate = new Map<string, DiscoveredSplit>()

  for (const s of entries) {
    const rawDateNum = Number(s?.date)
    const numerator = Number(s?.numerator)
    const denominator = Number(s?.denominator || 1)

    if (
      !Number.isFinite(rawDateNum) ||
      rawDateNum <= 0 ||
      !Number.isFinite(numerator) ||
      !Number.isFinite(denominator) ||
      numerator <= 0 ||
      denominator <= 0 ||
      Math.abs(numerator / denominator - 1) <= 1e-6
    ) {
      continue
    }

    const splitDate = normalizeSplitDate(rawDateNum, market)
    const dateKey = getSplitDateKey(splitDate)
    const splitRatio =
      typeof s?.splitRatio === 'string' && s.splitRatio.trim()
        ? s.splitRatio.trim()
        : formatSplitRatio(numerator, denominator)

    byDate.set(dateKey, {
      splitDate,
      numerator,
      denominator,
      splitRatio,
    })
  }

  return Array.from(byDate.values()).sort(
    (a, b) => a.splitDate.getTime() - b.splitDate.getTime()
  )
}

/**
 * Queries Yahoo Finance 10-year monthly chart endpoint for stock split events.
 */
export async function fetchYahooAssetSplits(
  ticker: string,
  market = 'US',
  assetType = 'stock'
): Promise<DiscoveredSplit[]> {
  if (shouldSkipSplitLookup(ticker, market, assetType)) {
    return []
  }

  const yfTicker = formatYahooSplitTicker(ticker, market)
  if (!yfTicker) return []

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      yfTicker
    )}?range=10y&interval=1mo&events=split`

    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(4500),
    })

    if (!res.ok) return []

    const json = await res.json()
    const chartResult = json?.chart?.result?.[0]
    return extractDiscoveredSplitsFromYahooChart(chartResult, market)
  } catch (err) {
    console.warn(`[split-sync] Failed to fetch splits for ${yfTicker}:`, err)
    return []
  }
}

/**
 * Upserts discovered global Yahoo splits for an assetId and returns only genuinely new rows.
 */
export async function persistDiscoveredYahooSplits(
  assetId: string,
  ticker: string,
  _market: string,
  splits: DiscoveredSplit[]
): Promise<NewlyDetectedSplitInfo[]> {
  if (!assetId || splits.length === 0) return []

  const existingRows = await prisma.assetSplit.findMany({
    where: { assetId, scopeKey: 'GLOBAL' },
    select: { splitDate: true },
  })
  const existingKeys = new Set(existingRows.map((r) => getSplitDateKey(r.splitDate)))

  const newlyAdded: NewlyDetectedSplitInfo[] = []

  for (const s of splits) {
    const dayKey = getSplitDateKey(s.splitDate)
    const isNew = !existingKeys.has(dayKey)

    await prisma.assetSplit.upsert({
      where: {
        assetId_splitDate_scopeKey: {
          assetId,
          splitDate: s.splitDate,
          scopeKey: 'GLOBAL',
        },
      },
      update: {
        numerator: s.numerator,
        denominator: s.denominator,
        splitRatio: s.splitRatio,
        source: 'auto_yahoo',
      },
      create: {
        assetId,
        userId: null,
        scopeKey: 'GLOBAL',
        splitDate: s.splitDate,
        numerator: s.numerator,
        denominator: s.denominator,
        splitRatio: s.splitRatio,
        source: 'auto_yahoo',
        note: `ซิงค์อัตโนมัติจากตลาด (Yahoo Finance: ${s.splitRatio})`,
      },
    })

    if (isNew) {
      existingKeys.add(dayKey)
      newlyAdded.push({
        assetId,
        ticker: ticker.toUpperCase(),
        splitDate: dayKey,
        splitRatio: s.splitRatio,
      })
    }
  }

  return newlyAdded
}

/**
 * Syncs Yahoo Finance stock split events for a batch of assets in bounded parallel chunks.
 */
export async function syncAssetSplitsFromYahoo(
  assets: Array<{ id: string; ticker: string; market: string; assetType?: string }>,
  forceRefresh = false
): Promise<{
  syncedAssetsCount: number
  totalSplitsFound: number
  newlyAddedSplits: NewlyDetectedSplitInfo[]
}> {
  const uniqueMap = new Map<
    string,
    { id: string; ticker: string; market: string; assetType: string }
  >()

  for (const a of assets) {
    if (!a?.id || !a?.ticker) continue
    const assetType = a.assetType || 'stock'
    if (shouldSkipSplitLookup(a.ticker, a.market, assetType)) continue
    if (!uniqueMap.has(a.id)) {
      uniqueMap.set(a.id, {
        id: a.id,
        ticker: a.ticker,
        market: a.market || 'US',
        assetType,
      })
    }
  }

  const now = Date.now()
  const targets = Array.from(uniqueMap.values()).filter((a) => {
    if (forceRefresh) return true
    const last = splitSyncCooldown.get(a.id)
    return !last || now - last >= SPLIT_SYNC_TTL_MS
  })

  if (targets.length === 0) {
    return { syncedAssetsCount: 0, totalSplitsFound: 0, newlyAddedSplits: [] }
  }

  let totalSplitsFound = 0
  const newlyAddedSplits: NewlyDetectedSplitInfo[] = []
  const CHUNK_SIZE = 6

  for (let i = 0; i < targets.length; i += CHUNK_SIZE) {
    const chunk = targets.slice(i, i + CHUNK_SIZE)
    const results = await Promise.allSettled(
      chunk.map(async (asset) => {
        const discovered = await fetchYahooAssetSplits(
          asset.ticker,
          asset.market,
          asset.assetType
        )
        splitSyncCooldown.set(asset.id, Date.now())
        if (discovered.length === 0) {
          return { found: 0, added: [] as NewlyDetectedSplitInfo[] }
        }
        const added = await persistDiscoveredYahooSplits(
          asset.id,
          asset.ticker,
          asset.market,
          discovered
        )
        return { found: discovered.length, added }
      })
    )

    for (const r of results) {
      if (r.status === 'fulfilled') {
        totalSplitsFound += r.value.found
        if (r.value.added.length > 0) {
          newlyAddedSplits.push(...r.value.added)
        }
      }
    }
  }

  return {
    syncedAssetsCount: targets.length,
    totalSplitsFound,
    newlyAddedSplits,
  }
}
