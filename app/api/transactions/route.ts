/**
 * GET/POST /api/transactions
 * List user's transactions (paginated) or create new one.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { invalidateUserHoldingsCache } from '@/lib/analytics/holdings'
import { getTransactionCashDelta, applyCashDeltaClamped } from '@/lib/analytics/cash-ledger'

// ─── Zod Schemas ──────────────────────────────────────────
const CreateTransactionSchema = z.object({
  accountId: z.string().min(1),
  assetId: z.string().min(1),
  txnDate: z.string().datetime({ offset: true }),
  txnType: z.enum(['BUY', 'SELL', 'DIVIDEND', 'DEPOSIT', 'WITHDRAW', 'FEE']),
  quantity: z.number().positive(),
  pricePerUnit: z.number().nonnegative(),
  fee: z.number().nonnegative().default(0),
  taxWithheld: z.number().nonnegative().default(0),
  note: z.string().max(500).optional(),
  source: z.enum(['manual', 'quick_add', 'quick_add_photo', 'csv_import']).default('manual'),
  syncCashBalance: z.boolean().optional(),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = req.nextUrl
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit = Math.min(100, parseInt(searchParams.get('limit') ?? '50'))
  const accountId = searchParams.get('accountId')
  const assetId = searchParams.get('assetId')
  const txnType = searchParams.get('txnType')
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const search = searchParams.get('search')?.trim() || searchParams.get('q')?.trim() || ''

  const where: any = {
    userId: session.user.id,
    ...(accountId && { accountId }),
    ...(assetId && { assetId }),
    ...(txnType && { txnType: txnType as any }),
    ...(from || to ? {
      txnDate: {
        ...(from && { gte: new Date(from) }),
        ...(to && { lte: new Date(to) }),
      },
    } : {}),
  }

  if (search) {
    where.OR = [
      { asset: { ticker: { contains: search, mode: 'insensitive' } } },
      { asset: { assetName: { contains: search, mode: 'insensitive' } } },
      { note: { contains: search, mode: 'insensitive' } },
      { account: { accountName: { contains: search, mode: 'insensitive' } } },
    ]
  }

  const [transactions, total, allMatchingForSummary] = await prisma.$transaction([
    prisma.transaction.findMany({
      where,
      include: {
        asset: { select: { ticker: true, assetName: true, assetType: true, market: true, currency: true } },
        account: { select: { accountName: true, currency: true } },
      },
      orderBy: { txnDate: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.transaction.count({ where }),
    prisma.transaction.findMany({
      where,
      select: {
        txnType: true,
        totalAmount: true,
        fee: true,
        asset: { select: { currency: true, market: true } },
        account: { select: { currency: true } },
      },
    }),
  ])

  let usdOutflow = 0
  let thbOutflow = 0
  let usdInflow = 0
  let thbInflow = 0
  let usdFees = 0
  let thbFees = 0

  for (const t of allMatchingForSummary) {
    const isUSD =
      t.account?.currency === 'USD' ||
      t.asset?.currency === 'USD' ||
      t.asset?.market === 'US'
    const amount = Number(t.totalAmount || 0)
    const feeVal = Number(t.fee || 0)

    if (t.txnType === 'BUY') {
      if (isUSD) usdOutflow += amount
      else thbOutflow += amount
    } else if (t.txnType === 'SELL' || t.txnType === 'DIVIDEND') {
      if (isUSD) usdInflow += amount
      else thbInflow += amount
    }

    if (isUSD) usdFees += feeVal
    else thbFees += feeVal
  }

  return NextResponse.json({
    data: transactions,
    transactions,
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    summary: { usdOutflow, thbOutflow, usdInflow, thbInflow, usdFees, thbFees },
  })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const parsed = CreateTransactionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    const data = parsed.data

    // Verify account belongs to user
    const account = await prisma.investmentAccount.findFirst({
      where: { id: data.accountId, userId: session.user.id },
    })
    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    // Verify asset exists
    const asset = await prisma.asset.findUnique({ where: { id: data.assetId } })
    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    }

    // Calculate totalAmount
    let totalAmount = data.quantity * data.pricePerUnit + data.fee
    if (data.txnType === 'SELL') {
      totalAmount = Math.max(0, data.quantity * data.pricePerUnit - data.fee - (data.taxWithheld || 0))
    } else if (data.txnType === 'DIVIDEND') {
      totalAmount = Math.max(0, data.quantity * data.pricePerUnit - data.fee - (data.taxWithheld || 0))
    } else if (data.txnType === 'FEE') {
      totalAmount = data.fee
    }

    const shouldSync = data.syncCashBalance ?? data.source !== 'csv_import'
    const delta = shouldSync ? getTransactionCashDelta(data.txnType, totalAmount) : 0

    const transaction = await prisma.$transaction(async (tx) => {
      const created = await tx.transaction.create({
        data: {
          userId: session.user.id,
          accountId: data.accountId,
          assetId: data.assetId,
          txnDate: new Date(data.txnDate),
          txnType: data.txnType,
          quantity: data.quantity,
          pricePerUnit: data.pricePerUnit,
          fee: data.fee,
          taxWithheld: data.taxWithheld,
          totalAmount,
          note: data.note,
          source: data.source,
        },
        include: {
          asset: { select: { ticker: true, assetName: true, currency: true } },
          account: { select: { accountName: true, currency: true } },
        },
      })

      if (shouldSync && delta !== 0) {
        const currentCash = Number(account.cashBalance || 0)
        if (delta > 0 || (delta < 0 && currentCash > 0)) {
          await tx.investmentAccount.update({
            where: { id: data.accountId },
            data: { cashBalance: applyCashDeltaClamped(currentCash, delta) },
          })
        }
      }

      return created
    })

    invalidateUserHoldingsCache(session.user.id)

    return NextResponse.json(transaction, { status: 201 })
  } catch (error) {
    console.error('[transactions POST]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { ids, clearAll, accountId, resetCashBalance } = body as {
      ids?: string[]
      clearAll?: boolean
      accountId?: string
      resetCashBalance?: boolean
    }

    // 1. Batch delete specific transaction IDs with atomic cash ledger reversal
    if (Array.isArray(ids) && ids.length > 0) {
      const deletedCount = await prisma.$transaction(async (tx) => {
        const toDelete = await tx.transaction.findMany({
          where: {
            id: { in: ids },
            userId: session.user.id,
          },
          select: {
            id: true,
            accountId: true,
            txnType: true,
            totalAmount: true,
          },
        })

        if (toDelete.length === 0) return 0

        const result = await tx.transaction.deleteMany({
          where: {
            id: { in: toDelete.map((t) => t.id) },
            userId: session.user.id,
          },
        })

        const reverseDeltaByAccount = new Map<string, number>()
        for (const t of toDelete) {
          const reverseDelta = -getTransactionCashDelta(t.txnType, Number(t.totalAmount || 0))
          if (reverseDelta !== 0) {
            reverseDeltaByAccount.set(
              t.accountId,
              (reverseDeltaByAccount.get(t.accountId) || 0) + reverseDelta
            )
          }
        }

        if (reverseDeltaByAccount.size > 0) {
          const accounts = await tx.investmentAccount.findMany({
            where: {
              id: { in: Array.from(reverseDeltaByAccount.keys()) },
              userId: session.user.id,
            },
            select: { id: true, cashBalance: true },
          })
          for (const acc of accounts) {
            const delta = reverseDeltaByAccount.get(acc.id) || 0
            if (Math.abs(delta) > 0.0001) {
              const currentCash = Number(acc.cashBalance || 0)
              if (delta > 0 || (delta < 0 && currentCash > 0)) {
                await tx.investmentAccount.update({
                  where: { id: acc.id },
                  data: { cashBalance: applyCashDeltaClamped(currentCash, delta) },
                })
              }
            }
          }
        }

        return result.count
      })

      invalidateUserHoldingsCache(session.user.id)
      return NextResponse.json({ success: true, count: deletedCount })
    }

    // 2. Clear all transactions (scoped or global for user)
    if (clearAll) {
      const whereClause: any = { userId: session.user.id }
      if (accountId && accountId !== 'ALL') {
        whereClause.accountId = accountId
      }

      const result = await prisma.transaction.deleteMany({
        where: whereClause,
      })

      // Optionally reset cash balance for the cleared account(s)
      if (resetCashBalance) {
        if (accountId && accountId !== 'ALL') {
          await prisma.investmentAccount.update({
            where: { id: accountId, userId: session.user.id },
            data: { cashBalance: 0 },
          })
        } else {
          await prisma.investmentAccount.updateMany({
            where: { userId: session.user.id },
            data: { cashBalance: 0 },
          })
        }
      }

      invalidateUserHoldingsCache(session.user.id)
      return NextResponse.json({ success: true, count: result.count })
    }

    return NextResponse.json({ error: 'Invalid delete request' }, { status: 400 })
  } catch (error) {
    console.error('[transactions DELETE]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
