import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { calculateUserHoldings } from '@/lib/analytics/holdings'
import { z } from 'zod'

const PresetSchema = z.object({
  presetName: z.string().min(1).max(100),
  riskProfile: z.string().default('moderate'),
  targetAllocation: z.record(z.string(), z.any()), // e.g. { "US": 50, "TH": 20, "_subTargets": { ... } }
  monthlyContribution: z.number().nonnegative().default(0),
  targetAmount: z.number().nonnegative().default(0),
  targetDate: z.string().optional(),
  isDefault: z.boolean().default(false),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id

  try {
    const presets = await prisma.investmentPreset.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    })

    const userSettings = await prisma.userSettings.findUnique({
      where: { userId },
      select: { baseCurrency: true },
    })
    const baseCurrency = userSettings?.baseCurrency ?? 'THB'

    // Fetch cash balances across user accounts
    const accounts = await prisma.investmentAccount.findMany({
      where: { userId },
      select: { cashBalance: true, currency: true },
    })
    let totalCash = 0
    for (const acc of accounts) {
      totalCash += Number(acc.cashBalance) || 0
    }

    // Calculate actual holdings to provide rebalancing feedback
    const holdingsResult = await calculateUserHoldings(userId, baseCurrency)
    const actualAllocation: Record<string, number> = {}
    const actualByTicker: Record<string, number> = {}

    for (const h of holdingsResult.holdings) {
      const key = (h.market || h.assetType || 'OTHER').toUpperCase()
      actualAllocation[key] = (actualAllocation[key] || 0) + h.allocationPercent

      const tKey = h.ticker.toUpperCase()
      actualByTicker[tKey] = (actualByTicker[tKey] || 0) + h.allocationPercent
    }

    // Add cash allocation
    const totalPortfolioValue = holdingsResult.totalValueBase + totalCash
    if (totalPortfolioValue > 0) {
      const cashPct = (totalCash / totalPortfolioValue) * 100
      actualAllocation['CASH'] = cashPct
      actualByTicker['CASH'] = cashPct
    }

    return NextResponse.json({
      presets,
      actualAllocation,
      actualByTicker,
      holdings: holdingsResult.holdings,
      totalCash,
      investedValue: holdingsResult.totalValueBase,
      totalPortfolioValue,
      baseCurrency,
    })
  } catch (error) {
    console.error('[plans GET]', error)
    return NextResponse.json({ error: 'Failed to fetch presets' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id

  try {
    const body = await req.json()
    const parsed = PresetSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    if (parsed.data.isDefault) {
      await prisma.investmentPreset.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      })
    }

    const created = await prisma.investmentPreset.create({
      data: {
        userId,
        presetName: parsed.data.presetName,
        riskProfile: parsed.data.riskProfile,
        targetAllocation: parsed.data.targetAllocation as any,
        monthlyContribution: parsed.data.monthlyContribution,
        targetAmount: parsed.data.targetAmount,
        targetDate: parsed.data.targetDate ? new Date(parsed.data.targetDate) : null,
        isDefault: parsed.data.isDefault,
      },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error: any) {
    console.error('[plans POST]', error)
    return NextResponse.json({ error: error.message || 'Failed to create preset' }, { status: 500 })
  }
}
