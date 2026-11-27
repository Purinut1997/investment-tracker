import { prisma } from '../prisma'
import { advisorFlags } from './advisor-rollout'
import { policySchema } from './advisor-policy-schema'

export type PositionLimit = { percent: number; basis: 'totalPortfolio' | 'investedAssets' }

export async function getPositionLimit(userId: string, profilePercent: number): Promise<PositionLimit> {
  if (advisorFlags(userId).planning) {
    const policy = await prisma.advisorPolicy.findFirst({
      where: { userId }, orderBy: { version: 'desc' }, select: { config: true },
    })
    const config = policySchema.safeParse(policy?.config)
    if (config.success) return { percent: config.data.maxPositionPercent, basis: 'totalPortfolio' }
  }
  return { percent: profilePercent, basis: 'investedAssets' }
}

export function positionWeight(value: number, invested: number, cash: number, limit: PositionLimit) {
  const denominator = invested + (limit.basis === 'totalPortfolio' ? cash : 0)
  return denominator > 0 ? Math.max(0, value / denominator * 100) : null
}

export function positionBasisLabel(limit: PositionLimit) {
  return limit.basis === 'totalPortfolio' ? 'พอร์ตรวมเงินสด' : 'สินทรัพย์ลงทุน'
}
