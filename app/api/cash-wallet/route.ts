import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getExchangeRate } from '@/lib/market-data/frankfurter'
import { z } from 'zod'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id

  try {
    const userSettings = await prisma.userSettings.findUnique({
      where: { userId },
    })
    const baseCurrency = userSettings?.baseCurrency || 'THB'

    const accounts = await prisma.investmentAccount.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      include: {
        _count: { select: { transactions: true } },
      },
    })

    // Fetch exchange rates for all distinct currencies
    const uniqueCurrencies = Array.from(new Set(accounts.map((a) => a.currency.toUpperCase())))
    const rateMap = new Map<string, number>()
    rateMap.set(baseCurrency.toUpperCase(), 1.0)

    for (const curr of uniqueCurrencies) {
      if (!rateMap.has(curr)) {
        const rate = await getExchangeRate(curr, baseCurrency)
        rateMap.set(curr, rate || 1.0)
      }
    }

    let totalCashBase = 0
    let totalAccruedInterestBase = 0
    let minInterestDays: number | null = null

    const enrichedAccounts = accounts.map((acc) => {
      const balance = Number(acc.cashBalance || 0)
      const interest = Number(acc.accruedInterest || 0)
      const days = acc.interestDays
      const rate = rateMap.get(acc.currency.toUpperCase()) || 1.0

      const balanceBase = balance * rate
      const interestBase = interest * rate

      totalCashBase += balanceBase
      totalAccruedInterestBase += interestBase

      if (days && days > 0) {
        if (minInterestDays === null || days < minInterestDays) {
          minInterestDays = days
        }
      }

      return {
        id: acc.id,
        accountName: acc.accountName,
        accountType: acc.accountType,
        currency: acc.currency,
        cashBalance: balance,
        balanceBase,
        accruedInterest: interest,
        accruedInterestBase: interestBase,
        interestDays: days ?? 0,
        exchangeRateToBase: rate,
        transactionCount: acc._count?.transactions || 0,
        createdAt: acc.createdAt,
      }
    })

    return NextResponse.json({
      baseCurrency,
      totalCashBase,
      totalAccruedInterestBase,
      minInterestDays: minInterestDays ?? 104,
      accounts: enrichedAccounts,
      rates: Object.fromEntries(rateMap.entries()),
      timestamp: Date.now(),
    })
  } catch (error: any) {
    console.error('[cash-wallet GET]', error)
    return NextResponse.json(
      { error: error.message || 'Failed to load cash wallet data' },
      { status: 500 }
    )
  }
}

const AdjustSchema = z.object({
  accountId: z.string().min(1),
  action: z.enum(['adjust', 'deposit', 'withdraw', 'interest_update']),
  amount: z.number().optional(),
  accruedInterest: z.number().optional(),
  interestDays: z.number().nullable().optional(),
  note: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id

  try {
    const body = await req.json()
    const parsed = AdjustSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const { accountId, action, amount, accruedInterest, interestDays, note } = parsed.data

    const account = await prisma.investmentAccount.findFirst({
      where: { id: accountId, userId },
    })

    if (!account) {
      return NextResponse.json({ error: 'ไม่พบบัญชีที่ระบุ' }, { status: 404 })
    }

    let newBalance = Number(account.cashBalance || 0)

    if (action === 'adjust' && amount !== undefined) {
      newBalance = amount
    } else if (action === 'deposit' && amount !== undefined) {
      newBalance += amount
    } else if (action === 'withdraw' && amount !== undefined) {
      newBalance -= amount
    }

    const updatedData: any = {
      cashBalance: newBalance,
    }

    if (accruedInterest !== undefined) {
      updatedData.accruedInterest = accruedInterest
    }

    if (interestDays !== undefined) {
      updatedData.interestDays = interestDays ?? 0
    }

    const updated = await prisma.investmentAccount.update({
      where: { id: accountId },
      data: updatedData,
    })

    // Record snapshot
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)

    await prisma.cashBalance.upsert({
      where: {
        accountId_balanceDate: {
          accountId,
          balanceDate: today,
        },
      },
      update: {
        cashAmount: newBalance,
        accruedInterest: accruedInterest ?? Number(account.accruedInterest || 0),
        note: note || `ปรับยอดเงินสด (${action})`,
      },
      create: {
        accountId,
        balanceDate: today,
        cashAmount: newBalance,
        accruedInterest: accruedInterest ?? Number(account.accruedInterest || 0),
        note: note || `ปรับยอดเงินสด (${action})`,
      },
    })

    return NextResponse.json({
      success: true,
      account: updated,
    })
  } catch (error: any) {
    console.error('[cash-wallet POST]', error)
    return NextResponse.json(
      { error: error.message || 'บันทึกการปรับยอดเงินสดล้มเหลว' },
      { status: 500 }
    )
  }
}
