import { z } from 'zod'

export function parseModelJson(text: string): unknown {
  const trimmed = text.trim()
  const wrapped = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  return JSON.parse(wrapped?.[1] ?? trimmed)
}

export function remainingModelBudget(startedAt: number, budget: number, now = Date.now()) {
  return Math.max(0, budget - (now - startedAt))
}

export function isModelRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function hasNonemptyText(value: unknown): value is string {
  return typeof value === 'string' && Boolean(value.trim())
}

const amount = z.number().finite().nonnegative()
export const forecastInputSchema = z.object({
  initialAmount: amount,
  monthlyContribution: amount,
  years: z.number().int().min(1).max(100),
  finalP10: amount,
  finalP50: amount,
  finalP90: amount,
  targetAmount: amount,
  probabilityOfReachingTarget: z.number().min(0).max(100).nullish(),
  adjustInflation: z.boolean().optional().default(false),
  finalRealP50: amount.nullish(),
  retirementMonthlyIncome: amount.nullish(),
  dividendMonthlyIncome: amount.nullish(),
  milestonesSummary: z.string().max(4000).nullish(),
}).refine((input) => input.finalP10 <= input.finalP50 && input.finalP50 <= input.finalP90, {
  message: 'P10/P50/P90 must be in ascending order',
})

export function forecastContextKey(input: z.input<typeof forecastInputSchema>) {
  return [
    input.initialAmount, input.monthlyContribution, input.years, input.targetAmount,
    input.finalP10, input.finalP50, input.finalP90, input.probabilityOfReachingTarget ?? '-',
    input.adjustInflation ? 1 : 0, input.finalRealP50 ?? '-',
    input.retirementMonthlyIncome ?? '-', input.dividendMonthlyIncome ?? '-',
  ].join('_')
}

const weights = z.record(z.string().max(80), z.number().min(0).max(100))
export const planAdviceInput = z.object({
  presetId: z.string().max(70).optional(),
  presetName: z.string().max(180).optional(),
  targetAllocation: weights.optional(),
  subAllocations: z.record(z.string().max(80), weights).optional(),
  monthlyContribution: amount,
  tolerancePercent: z.number().min(0).max(100).optional(),
})

export function planAdviceContextKey(input: z.input<typeof planAdviceInput>) {
  const compare = ([a]: [string, unknown], [b]: [string, unknown]) => a < b ? -1 : a > b ? 1 : 0
  const ordered = (map: Record<string, number> = {}) => Object.entries(map).sort(compare)
  const nested = Object.entries(input.subAllocations ?? {}).sort(compare)
    .map(([key, value]) => [key, ordered(value)])
  const data = JSON.stringify([input.presetId ?? '', input.presetName ?? '', input.monthlyContribution, input.tolerancePercent ?? '-', ordered(input.targetAllocation), nested])
  // Stable browser/server cache partition. The database query also scopes by account.
  let hash = 2166136261
  for (let i = 0; i < data.length; i++) hash = Math.imul(hash ^ data.charCodeAt(i), 16777619)
  return `${(hash >>> 0).toString(16)}-${data.length}`
}
