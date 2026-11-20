/**
 * lib/analytics/stock-splits.ts
 * Shared Stock Split & Reverse Split normalization and chronological FIFO timeline engine.
 */

import { prisma } from '../prisma'

export interface StockSplitEvent {
  id?: string
  assetId: string
  splitDate: Date | string
  numerator: number
  denominator: number
  splitRatio: string
  source?: 'auto_yahoo' | 'manual'
  note?: string | null
}

export interface AppliedSplitBadge {
  splitDate: string
  splitRatio: string
  multiplier: number
  source: string
}

export type MergedTimelineItem<T> =
  | { kind: 'SPLIT'; dateMs: number; split: StockSplitEvent }
  | { kind: 'TXN'; dateMs: number; txn: T }

/**
 * Computes the split share multiplier (newShares / oldShares).
 * Forward 8:1 => 8; Reverse 1:10 => 0.1. Invalid ratios default to 1.
 */
export function getSplitMultiplier(split: { numerator: number; denominator: number }): number {
  const num = Number(split?.numerator)
  const den = Number(split?.denominator || 1)
  if (!Number.isFinite(num) || !Number.isFinite(den) || num <= 0 || den <= 0) {
    return 1
  }
  const mult = num / den
  return Number.isFinite(mult) && mult > 0 ? mult : 1
}

function formatRatioPart(value: number): string {
  if (!Number.isFinite(value)) return '1'
  return Number(value.toFixed(6)).toString()
}

/**
 * Formats a split ratio cleanly without trailing zeroes (e.g. "8:1", "1:10", "3:2").
 */
export function formatSplitRatio(numerator: number, denominator: number): string {
  const num = Number(numerator)
  const den = Number(denominator || 1)
  return `${formatRatioPart(num)}:${formatRatioPart(den)}`
}

/**
 * Normalizes a split date (Yahoo Unix seconds timestamp, ISO/date string, or Date)
 * into UTC midnight (YYYY-MM-DDT00:00:00.000Z) in the asset's exchange calendar.
 */
export function normalizeSplitDate(dateInput: Date | string | number, market = 'US'): Date {
  if (typeof dateInput === 'number') {
    const ms = dateInput > 1e12 ? dateInput : dateInput * 1000
    const mkt = String(market || 'US').toUpperCase()
    const timeZone =
      mkt === 'TH' || mkt === 'SET'
        ? 'Asia/Bangkok'
        : mkt === 'CRYPTO'
        ? 'UTC'
        : 'America/New_York'
    const ymd = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(ms))
    return new Date(`${ymd}T00:00:00.000Z`)
  }

  if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim()
    const ymdMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})/)
    if (ymdMatch) {
      return new Date(`${ymdMatch[1]}T00:00:00.000Z`)
    }
    const parsed = new Date(trimmed)
    const ymd = isNaN(parsed.getTime())
      ? new Date().toISOString().slice(0, 10)
      : parsed.toISOString().slice(0, 10)
    return new Date(`${ymd}T00:00:00.000Z`)
  }

  const d = dateInput instanceof Date ? dateInput : new Date()
  const ymd = isNaN(d.getTime())
    ? new Date().toISOString().slice(0, 10)
    : d.toISOString().slice(0, 10)
  return new Date(`${ymd}T00:00:00.000Z`)
}

/**
 * Returns the canonical YYYY-MM-DD UTC date key for a split date.
 */
export function getSplitDateKey(dateInput: Date | string): string {
  return normalizeSplitDate(dateInput).toISOString().slice(0, 10)
}

/**
 * Resolves raw global + manual split rows into an effective chronological list per assetId.
 * On matching (assetId, YYYY-MM-DD), manual rows override auto_yahoo rows.
 * No-op ratios (e.g. manual 1:1 override) are filtered out.
 */
export function resolveEffectiveSplitsByAsset(
  rows: StockSplitEvent[]
): Map<string, StockSplitEvent[]> {
  const byAssetAndDay = new Map<string, Map<string, StockSplitEvent>>()

  for (const row of rows) {
    if (!row?.assetId) continue
    const dayKey = getSplitDateKey(row.splitDate)
    if (!byAssetAndDay.has(row.assetId)) {
      byAssetAndDay.set(row.assetId, new Map())
    }
    const dayMap = byAssetAndDay.get(row.assetId)!
    const existing = dayMap.get(dayKey)
    const normalizedRow: StockSplitEvent = {
      ...row,
      splitDate: normalizeSplitDate(row.splitDate),
      numerator: Number(row.numerator),
      denominator: Number(row.denominator || 1),
      splitRatio: row.splitRatio || formatSplitRatio(Number(row.numerator), Number(row.denominator || 1)),
      source: row.source ?? 'auto_yahoo',
    }

    if (!existing) {
      dayMap.set(dayKey, normalizedRow)
    } else if (normalizedRow.source === 'manual' && existing.source !== 'manual') {
      // Manual split or 1:1 cancellation always wins over auto_yahoo on the same day
      dayMap.set(dayKey, normalizedRow)
    } else if (normalizedRow.source === existing.source) {
      dayMap.set(dayKey, normalizedRow)
    }
  }

  const result = new Map<string, StockSplitEvent[]>()
  for (const [assetId, dayMap] of byAssetAndDay.entries()) {
    const effective = Array.from(dayMap.values())
      .filter((s) => Math.abs(getSplitMultiplier(s) - 1) > 1e-9)
      .sort((a, b) => new Date(a.splitDate).getTime() - new Date(b.splitDate).getTime())

    if (effective.length > 0) {
      result.set(assetId, effective)
    }
  }

  return result
}

/**
 * Merges transactions and split events into a deterministic chronological timeline.
 * When a SPLIT and a TXN occur at the exact same timestamp, SPLIT sorts BEFORE TXN
 * so same-day post-split trades (e.g. YYYY-MM-DDT00:00:00.000Z) are not re-multiplied.
 */
export function mergeTxnsAndSplits<T extends { txnDate: Date | string; assetId?: string }>(
  txns: T[],
  splits: StockSplitEvent[]
): MergedTimelineItem<T>[] {
  const timeline: MergedTimelineItem<T>[] = []

  for (const txn of txns) {
    timeline.push({
      kind: 'TXN',
      dateMs: new Date(txn.txnDate).getTime(),
      txn,
    })
  }

  for (const split of splits) {
    timeline.push({
      kind: 'SPLIT',
      dateMs: normalizeSplitDate(split.splitDate).getTime(),
      split,
    })
  }

  timeline.sort((a, b) => {
    if (a.dateMs !== b.dateMs) return a.dateMs - b.dateMs
    const priorityA = a.kind === 'SPLIT' ? 0 : 1
    const priorityB = b.kind === 'SPLIT' ? 0 : 1
    return priorityA - priorityB
  })

  return timeline
}

/**
 * Converts a Map or Record of splits by assetId into a flattened list or Map.
 */
export function toSplitsMap(
  input?: Map<string, StockSplitEvent[]> | Record<string, StockSplitEvent[]>
): Map<string, StockSplitEvent[]> {
  if (!input) return new Map()
  if (input instanceof Map) return input
  return new Map(Object.entries(input))
}

/**
 * Fetches and resolves effective stock splits (global auto_yahoo + user manual overrides)
 * for the given assetIds belonging to a user.
 */
export async function getUserAssetSplitsMap(
  userId: string,
  assetIds: string[]
): Promise<Map<string, StockSplitEvent[]>> {
  const uniqueIds = Array.from(new Set(assetIds.filter(Boolean)))
  if (uniqueIds.length === 0) return new Map()

  try {
    const rows = await prisma.assetSplit.findMany({
      where: {
        assetId: { in: uniqueIds },
        OR: [{ userId: null }, { userId }],
      },
      orderBy: { splitDate: 'asc' },
    })

    return resolveEffectiveSplitsByAsset(
      rows.map((r) => ({
        id: r.id,
        assetId: r.assetId,
        splitDate: r.splitDate,
        numerator: Number(r.numerator),
        denominator: Number(r.denominator),
        splitRatio: r.splitRatio,
        source: r.source,
        note: r.note,
      }))
    )
  } catch (err) {
    console.warn('[getUserAssetSplitsMap warning]', err)
    return new Map()
  }
}

/**
 * Convenience wrapper fetching effective splits for a single asset.
 */
export async function getAssetSplitsForSingleAsset(
  userId: string,
  assetId: string
): Promise<StockSplitEvent[]> {
  if (!assetId) return []
  const map = await getUserAssetSplitsMap(userId, [assetId])
  return map.get(assetId) ?? []
}
