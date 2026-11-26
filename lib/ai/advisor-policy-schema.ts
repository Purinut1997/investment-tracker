import { z } from 'zod'

const money = z.number().finite().min(0).max(100_000_000)
const percent = z.number().finite().min(0).max(100)
export const policySchema = z.object({
  accountId: z.string().min(1).max(100),
  presetId: z.string().min(1).max(100),
  reserve: money,
  monthlyBudget: money,
  maxPositionPercent: percent.refine((value) => value > 0),
  horizonYears: z.number().int().min(1).max(50),
  feePercent: percent.max(10),
  feePerOrder: money,
  targets: z.array(z.object({
    assetId: z.string().min(1).max(100), weight: percent.refine((value) => value > 0),
    lotSize: z.number().int().min(1).max(10_000),
  })).min(1).max(50),
}).superRefine(({ targets }, ctx) => {
  if (new Set(targets.map((target) => target.assetId)).size !== targets.length ||
      targets.reduce((sum, target) => sum + target.weight, 0) > 100 + 1e-8) {
    ctx.addIssue({ code: 'custom', path: ['targets'], message: 'สัดส่วนเป้าหมายรวมต้องไม่เกิน 100% และสินทรัพย์ต้องไม่ซ้ำ' })
  }
})
export const scenarioSchema = z.object({ inflow: money, reserve: money.optional() })
