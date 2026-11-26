import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { advisorFlags } from '@/lib/ai/advisor-rollout'
import { policySchema, scenarioSchema } from '@/lib/ai/advisor-policy-schema'
import { AdvisorPlanError, getAdvisorPolicy, getLatestAdvisorRun, runAdvisorPlan, saveAdvisorPolicy } from '@/lib/ai/advisor-planning-service'
import { loadAdvisorReview } from '@/lib/ai/advisor-review'

export const maxDuration = 45

async function authorize() {
  const userId = (await auth())?.user?.id
  return userId && advisorFlags(userId).planning ? userId : null
}

function failed(error: unknown) {
  if (error instanceof AdvisorPlanError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }
  console.error('[advisor plan]', error)
  return NextResponse.json({ error: 'ไม่สามารถดำเนินการกับแผนได้' }, { status: 500 })
}

export async function GET(req: NextRequest) {
  const userId = await authorize()
  if (!userId) return NextResponse.json({ enabled: false })
  try {
    const policy = await getAdvisorPolicy(userId)
    const run = await getLatestAdvisorRun(userId, policy)
    const symbol = req.nextUrl.searchParams.get('symbol')?.toUpperCase()
    const market = req.nextUrl.searchParams.get('market')?.toUpperCase()
    if (req.nextUrl.searchParams.get('review') === '1') {
      return NextResponse.json({ enabled: true, review: await loadAdvisorReview(userId) })
    }
    if (symbol && market) {
      const result = run?.result as { targets?: { ticker: string; market: string }[] } | undefined
      const target = result?.targets?.find((line) => line.market === market &&
        line.ticker.toUpperCase().replace(/\.BK$/, '') === symbol.replace(/\.BK$/, ''))
      return NextResponse.json({ enabled: true, target: target ?? null, asOf: run?.asOf, stale: run?.stale })
    }
    if (req.nextUrl.searchParams.get('options') !== '1') {
      return NextResponse.json({ enabled: true, policy, run })
    }
    const [settings, accounts, presets, positions] = await Promise.all([
      prisma.userSettings.findUnique({ where: { userId }, select: { baseCurrency: true } }),
      prisma.investmentAccount.findMany({
        where: { userId, accountType: 'brokerage' },
        select: { id: true, accountName: true, currency: true }, orderBy: { accountName: 'asc' },
      }),
      prisma.investmentPreset.findMany({
        where: { userId }, select: { id: true, presetName: true, monthlyContribution: true, targetAllocation: true },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      }),
      prisma.transaction.findMany({
        where: { userId }, distinct: ['assetId'],
        select: { asset: { select: { id: true, ticker: true, market: true } } },
        take: 150,
      }),
    ])
    const currency = settings?.baseCurrency ?? 'THB'
    return NextResponse.json({
      enabled: true, policy, run, currency,
      accounts: accounts.filter((account) => account.currency === currency), presets,
      assets: positions.map((position) => position.asset).sort((a, b) => a.ticker.localeCompare(b.ticker)),
    })
  } catch (error) {
    return failed(error)
  }
}

const updateSchema = z.object({ config: policySchema, expectedVersion: z.number().int().nonnegative() })
const runSchema = z.object({ scenario: scenarioSchema.optional(), expectedVersion: z.number().int().positive().optional() })

export async function PUT(req: NextRequest) {
  const userId = await authorize()
  if (!userId) return NextResponse.json({ error: 'ไม่สามารถใช้แผนที่ปรึกษา' }, { status: 403 })
  const input = updateSchema.safeParse(await req.json().catch(() => null))
  if (!input.success) return NextResponse.json({ error: input.error.issues[0]?.message }, { status: 400 })
  try {
    return NextResponse.json({ policy: await saveAdvisorPolicy(userId, input.data.config, input.data.expectedVersion) })
  } catch (error) {
    return failed(error)
  }
}

export async function POST(req: NextRequest) {
  const userId = await authorize()
  if (!userId) return NextResponse.json({ error: 'ไม่สามารถใช้แผนที่ปรึกษา' }, { status: 403 })
  const input = runSchema.safeParse(await req.json().catch(() => null))
  if (!input.success) return NextResponse.json({ error: 'ตรวจงบและเงินสดขั้นต่ำ' }, { status: 400 })
  try {
    return NextResponse.json({ run: await runAdvisorPlan(userId, input.data.scenario, input.data.expectedVersion) })
  } catch (error) {
    return failed(error)
  }
}
