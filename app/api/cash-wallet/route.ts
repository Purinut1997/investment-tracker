import { LedgerRequestError, withLedgerRequest } from '@/lib/analytics/ledger-request'
import { reconcileLedgerCash } from '@/lib/analytics/transaction-ledger'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { describeValuationRate, getValuationRates } from '@/lib/market-data/frankfurter'
import { invalidateUserPortfolioCache } from '@/lib/analytics/holdings'
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

    const rateMap = await getValuationRates(accounts.map(account => account.currency.toUpperCase()), baseCurrency)
    const usedCurrencies = new Set(accounts.filter(account => Number(account.cashBalance) || Number(account.accruedInterest))
      .map(account => account.currency.toUpperCase()))
    const valuationIssues = [...usedCurrencies].flatMap(currency => describeValuationRate(currency, baseCurrency, rateMap[currency]) ?? [])

    let totalCashBase = 0
    let totalAccruedInterestBase = 0
    let minInterestDays: number | null = null

    const enrichedAccounts = accounts.map((acc) => {
      const balance = Number(acc.cashBalance || 0)
      const interest = Number(acc.accruedInterest || 0)
      const days = acc.interestDays
      const rate = rateMap[acc.currency.toUpperCase()]?.rate ?? null

      const balanceBase = rate === null ? null : balance * rate
      const interestBase = rate === null ? null : interest * rate

      totalCashBase += balanceBase ?? 0
      totalAccruedInterestBase += interestBase ?? 0

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
      minInterestDays,
      valuationIssues,
      accounts: enrichedAccounts,
      rates: Object.fromEntries(Object.entries(rateMap).map(([currency, quote]) => [currency, quote?.rate ?? null])),
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

    const updatedBalance = await withLedgerRequest(userId, 'cash-wallet', req.headers.get('Idempotency-Key'), parsed.data, async tx => {
      const account = await tx.investmentAccount.findFirst({ where: { id: accountId, userId } })

      if (!account) throw new LedgerRequestError('ไม่พบบัญชีที่ระบุ', 404)

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

      const updated = await tx.investmentAccount.update({
        where: { id: accountId },
        data: updatedData,
      })

      // Record snapshot
      const today = new Date()
      today.setUTCHours(0, 0, 0, 0)

      if (action === 'adjust' && amount !== undefined) await reconcileLedgerCash(tx, accountId)
      await tx.cashBalance.upsert({
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
      return updated
    })

    invalidateUserPortfolioCache(userId)

    return NextResponse.json({
      success: true,
      account: updatedBalance,
    })
  } catch (error: any) {
    if (error instanceof LedgerRequestError) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('[cash-wallet POST]', error)
    return NextResponse.json(
      { error: error.message || 'บันทึกการปรับยอดเงินสดล้มเหลว' },
      { status: 500 }
    )
  }
}
