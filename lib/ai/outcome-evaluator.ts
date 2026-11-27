/**
 * lib/ai/outcome-evaluator.ts
 * Pure TypeScript functions for:
 * 1. User Investment Memory parsing / serialization (stored in UserSettings.defaultRiskProfile)
 * 2. Closed-Loop Tactical Advice Outcome & Win-Rate Evaluation
 */

export interface UserInvestmentMemory {
  riskTolerance: 'conservative' | 'moderate' | 'aggressive'
  horizonYears: number
  maxSinglePositionPercent: number
  maxDrawdownTolerancePercent: number
  preferredStyle: string
  personalRules: string
  updatedAt?: string
}

export const DEFAULT_INVESTMENT_MEMORY: UserInvestmentMemory = {
  riskTolerance: 'moderate',
  horizonYears: 10,
  maxSinglePositionPercent: 20,
  maxDrawdownTolerancePercent: 20,
  preferredStyle: 'Core-Satellite Growth + Dividend',
  personalRules:
    'ไม่ไล่ราคาตอน RSI > 70, แบ่งซื้ออย่างน้อย 2-3 ไม้ตามแนวรับ และถือเงินสดสำรองไว้รับความผันผวน',
}

function clampNumber(val: unknown, fallback: number, min: number, max: number): number {
  const num = Number(val)
  if (!Number.isFinite(num)) return fallback
  return Math.min(max, Math.max(min, Math.round(num)))
}

export function parseUserInvestmentMemory(raw: string | null | undefined): UserInvestmentMemory {
  if (!raw || !raw.trim()) {
    return { ...DEFAULT_INVESTMENT_MEMORY }
  }

  const trimmed = raw.trim()
  if (trimmed === 'conservative' || trimmed === 'moderate' || trimmed === 'aggressive') {
    return {
      ...DEFAULT_INVESTMENT_MEMORY,
      riskTolerance: trimmed,
    }
  }

  try {
    const parsed = JSON.parse(trimmed)
    if (!parsed || typeof parsed !== 'object') {
      return { ...DEFAULT_INVESTMENT_MEMORY }
    }
    const risk =
      parsed.riskTolerance === 'conservative' ||
      parsed.riskTolerance === 'moderate' ||
      parsed.riskTolerance === 'aggressive'
        ? parsed.riskTolerance
        : DEFAULT_INVESTMENT_MEMORY.riskTolerance

    return {
      riskTolerance: risk,
      horizonYears: clampNumber(parsed.horizonYears, DEFAULT_INVESTMENT_MEMORY.horizonYears, 1, 50),
      maxSinglePositionPercent: clampNumber(
        parsed.maxSinglePositionPercent,
        DEFAULT_INVESTMENT_MEMORY.maxSinglePositionPercent,
        5,
        100
      ),
      maxDrawdownTolerancePercent: clampNumber(
        parsed.maxDrawdownTolerancePercent,
        DEFAULT_INVESTMENT_MEMORY.maxDrawdownTolerancePercent,
        5,
        80
      ),
      preferredStyle:
        typeof parsed.preferredStyle === 'string' && parsed.preferredStyle.trim().length > 0
          ? parsed.preferredStyle.trim().slice(0, 120)
          : DEFAULT_INVESTMENT_MEMORY.preferredStyle,
      personalRules:
        typeof parsed.personalRules === 'string' && parsed.personalRules.trim().length > 0
          ? parsed.personalRules.trim().slice(0, 500)
          : DEFAULT_INVESTMENT_MEMORY.personalRules,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : undefined,
    }
  } catch {
    return { ...DEFAULT_INVESTMENT_MEMORY }
  }
}

export function serializeUserInvestmentMemory(mem: Partial<UserInvestmentMemory>): string {
  const normalized = parseUserInvestmentMemory(JSON.stringify(mem))
  return JSON.stringify({
    ...normalized,
    updatedAt: new Date().toISOString(),
  })
}

export function formatInvestmentMemoryForPrompt(mem: UserInvestmentMemory): string {
  const riskLabel =
    mem.riskTolerance === 'conservative'
      ? 'อนุรักษ์นิยม (Conservative — เน้นรักษาเงินต้น)'
      : mem.riskTolerance === 'aggressive'
      ? 'เชิงรุก (Aggressive — รับความผันผวนเพื่อผลตอบแทนสูง)'
      : 'สมดุลเติบโต (Moderate — สมดุลความเสี่ยงและผลตอบแทน)'

  return [
    `- ระดับการรับความเสี่ยง: ${riskLabel}`,
    `- ระยะเวลาลงทุนเป้าหมาย: ${mem.horizonYears} ปี | สไตล์หลัก: ${mem.preferredStyle}`,
    `- เพดานสัดส่วนต่อหุ้น 1 ตัว (Max Position Cap): ไม่เกิน ${mem.maxSinglePositionPercent}% ของพอร์ต`,
    `- Max Drawdown ที่รับได้: -${mem.maxDrawdownTolerancePercent}%`,
    `- กฎเหล็กส่วนตัวของนักลงทุน (Personal Investment Rules): ${mem.personalRules}`,
  ].join('\n')
}

export interface EvaluatedAdviceCall {
  dateKey: string
  dateLabel: string
  ticker: string
  action: 'ACCUMULATE' | 'TRIM_PROFIT' | 'HOLD_WATCH' | 'CASH_PRESERVE'
  actionLabel: string
  recPrice: number
  currentPrice: number
  currency: string
  returnPercent: number
  verdict: 'HIT' | 'MISS' | 'NEUTRAL'
}

export interface AdviceOutcomeMetrics {
  totalTrackedCalls: number
  evaluatedCalls: number
  hits: number
  misses: number
  neutrals: number
  winRatePercent: number | null
  avgAccumulateReturnPercent: number | null
  avgTrimAvoidedDropPercent: number | null
  recentCalls: EvaluatedAdviceCall[]
}

function toBangkokDateKey(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

function toThaiShortDate(d: Date): string {
  return d.toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Bangkok',
  })
}

export function computeAdviceOutcomeMetrics(
  pastLogs: Array<{ createdAt: Date | string; response: string }>,
  livePriceMap: Map<string, number>,
  options?: { minAgeHours?: number; now?: Date; maxCalls?: number }
): AdviceOutcomeMetrics {
  const minAgeHours = options?.minAgeHours ?? 12
  const now = options?.now ?? new Date()
  const maxCalls = options?.maxCalls ?? 20
  const minAgeMs = minAgeHours * 60 * 60 * 1000

  const seenDayTicker = new Set<string>()
  const recentCalls: EvaluatedAdviceCall[] = []

  const sortedLogs = [...(pastLogs || [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  for (const log of sortedLogs) {
    const createdAt = new Date(log.createdAt)
    if (isNaN(createdAt.getTime())) continue
    if (now.getTime() - createdAt.getTime() < minAgeMs) continue

    let parsed: any = null
    try {
      parsed = JSON.parse(log.response)
    } catch {
      try {
        const cleaned = String(log.response || '')
          .replace(/```json/gi, '')
          .replace(/```/g, '')
          .trim()
        parsed = JSON.parse(cleaned)
      } catch {
        continue
      }
    }

    const actions: any[] = Array.isArray(parsed?.tacticalActions) ? parsed.tacticalActions : []
    const dateKey = toBangkokDateKey(createdAt)
    const dateLabel = toThaiShortDate(createdAt)

    for (const item of actions) {
      if (recentCalls.length >= maxCalls) break
      const ticker = String(item?.ticker || '')
        .trim()
        .toUpperCase()
      if (!ticker) continue

      const dedupKey = `${dateKey}:${ticker}`
      if (seenDayTicker.has(dedupKey)) continue

      const recPrice = Number(item?.currentPrice || 0)
      const currentPrice = Number(livePriceMap.get(ticker) || 0)
      if (!Number.isFinite(recPrice) || recPrice <= 0 || !Number.isFinite(currentPrice) || currentPrice <= 0) {
        continue
      }

      seenDayTicker.add(dedupKey)
      const returnPercent = Number((((currentPrice - recPrice) / recPrice) * 100).toFixed(2))
      const rawAction = String(item?.action || 'HOLD_WATCH').toUpperCase()
      const action: EvaluatedAdviceCall['action'] =
        rawAction === 'ACCUMULATE' ||
        rawAction === 'TRIM_PROFIT' ||
        rawAction === 'CASH_PRESERVE'
          ? rawAction
          : 'HOLD_WATCH'

      let verdict: EvaluatedAdviceCall['verdict'] = 'NEUTRAL'
      if (action === 'ACCUMULATE') {
        if (returnPercent >= 1.0) verdict = 'HIT'
        else if (returnPercent <= -3.0) verdict = 'MISS'
      } else if (action === 'TRIM_PROFIT') {
        if (returnPercent <= -1.0) verdict = 'HIT'
        else if (returnPercent >= 4.0) verdict = 'MISS'
      } else {
        if (returnPercent >= -3.0 && returnPercent <= 8.0) verdict = 'HIT'
        else if (returnPercent < -5.0) verdict = 'MISS'
      }

      recentCalls.push({
        dateKey,
        dateLabel,
        ticker,
        action,
        actionLabel: String(item?.actionLabel || action),
        recPrice: Number(recPrice.toFixed(2)),
        currentPrice: Number(currentPrice.toFixed(2)),
        currency: String(item?.currency || '$'),
        returnPercent,
        verdict,
      })
    }

    if (recentCalls.length >= maxCalls) break
  }

  let hits = 0
  let misses = 0
  let neutrals = 0
  let accSum = 0
  let accCount = 0
  let trimAvoidedSum = 0
  let trimCount = 0

  for (const c of recentCalls) {
    if (c.verdict === 'HIT') hits++
    else if (c.verdict === 'MISS') misses++
    else neutrals++

    if (c.action === 'ACCUMULATE') {
      accSum += c.returnPercent
      accCount++
    } else if (c.action === 'TRIM_PROFIT') {
      trimAvoidedSum += -c.returnPercent
      trimCount++
    }
  }

  const decided = hits + misses
  const winRatePercent = decided > 0 ? Number(((hits / decided) * 100).toFixed(1)) : null
  const avgAccumulateReturnPercent =
    accCount > 0 ? Number((accSum / accCount).toFixed(2)) : null
  const avgTrimAvoidedDropPercent =
    trimCount > 0 ? Number((trimAvoidedSum / trimCount).toFixed(2)) : null

  return {
    totalTrackedCalls: recentCalls.length,
    evaluatedCalls: decided,
    hits,
    misses,
    neutrals,
    winRatePercent,
    avgAccumulateReturnPercent,
    avgTrimAvoidedDropPercent,
    recentCalls,
  }
}

export function formatOutcomeMetricsForPrompt(metrics: AdviceOutcomeMetrics): string {
  if (!metrics || metrics.totalTrackedCalls === 0) {
    return 'ยังไม่มีคำแนะนำเก่าที่มีอายุเกิน 12 ชั่วโมงเพียงพอสำหรับเปรียบเทียบกับราคาล่าสุด'
  }

  const lines = [
    `- ติดตามสัญญาณย้อนหลัง (${metrics.totalTrackedCalls} คำแนะนำที่วัดผลกับราคาตลาดจริง): เข้าเกณฑ์ ${metrics.hits} | ผิดเกณฑ์ ${metrics.misses} | ยังไม่เข้าเกณฑ์ทั้งสองด้าน ${metrics.neutrals}${
      metrics.winRatePercent !== null ? ` ➔ สัดส่วนที่เข้าเกณฑ์จากราคาล่าสุด: ${metrics.winRatePercent}% (เฉพาะรายการเข้าเกณฑ์หรือผิดเกณฑ์ ช่วงเวลาวัดต่างกัน)` : ''
    }`,
  ]
  if (metrics.avgAccumulateReturnPercent !== null) {
    const sign = metrics.avgAccumulateReturnPercent >= 0 ? '+' : ''
    lines.push(`- การเปลี่ยนแปลงราคาเฉลี่ยตั้งแต่คำแนะนำฝั่งซื้อ (ACCUMULATE): ${sign}${metrics.avgAccumulateReturnPercent}%`)
  }
  if (metrics.avgTrimAvoidedDropPercent !== null) {
    lines.push(
      `- การปรับลงเฉลี่ยหลังคำแนะนำฝั่งขายทำกำไร (TRIM_PROFIT): ${metrics.avgTrimAvoidedDropPercent >= 0 ? '+' : ''}${metrics.avgTrimAvoidedDropPercent}%`
    )
  }

  for (const c of metrics.recentCalls.slice(0, 6)) {
    const sign = c.returnPercent >= 0 ? '+' : ''
    lines.push(
      `  • [${c.dateLabel}] ${c.ticker} (${c.actionLabel}): ${c.currency}${c.recPrice} -> ${c.currency}${c.currentPrice} (${sign}${c.returnPercent}%) [${c.verdict}]`
    )
  }

  return lines.join('\n')
}
