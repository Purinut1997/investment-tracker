import { LedgerRequestError, withLedgerRequest } from '@/lib/analytics/ledger-request'
import { Prisma } from '@prisma/client'
import { applyLedgerCash, withLedgerTransaction } from '@/lib/analytics/transaction-ledger'
/**
 * GET/POST /api/transactions
 * List user's transactions (paginated) or create new one.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { invalidateUserHoldingsCache } from '@/lib/analytics/holdings'
import { getTransactionCashDelta, getTransactionNetAmount } from '@/lib/analytics/cash-ledger'

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

    const totalAmount = getTransactionNetAmount(data.txnType, data.quantity, data.pricePerUnit, data.fee, data.taxWithheld)
    const shouldSync = data.syncCashBalance ?? data.source !== 'csv_import'
    const delta = shouldSync ? getTransactionCashDelta(data.txnType, totalAmount) : 0

    const transaction = await withLedgerRequest(session.user.id, 'transaction', req.headers.get('Idempotency-Key'), data, async tx => {
      // Verify account belongs to user
      const account = await tx.investmentAccount.findFirst({
        where: { id: data.accountId, userId: session.user.id },
      })
      if (!account) {
        throw new LedgerRequestError('ไม่พบบัญชีลงทุน', 404)
      }

      // Verify asset exists
      const asset = await tx.asset.findUnique({ where: { id: data.assetId } })
      if (!asset) {
        throw new LedgerRequestError('ไม่พบสินทรัพย์', 404)
      }

      if (account.currency !== asset.currency) throw new LedgerRequestError('สกุลเงินบัญชีต้องตรงกับสกุลสินทรัพย์', 400)

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
          cashDeltaApplied: delta,
          cashSyncEnabled: shouldSync,
          note: data.note,
          source: data.source,
        },
        include: {
          asset: { select: { ticker: true, assetName: true, currency: true } },
          account: { select: { accountName: true, currency: true } },
        },
      })

      await applyLedgerCash(tx, data.accountId, delta)
      return created
    })

    invalidateUserHoldingsCache(session.user.id)

    return NextResponse.json(transaction, { status: 201 })
  } catch (error) {
    if (error instanceof LedgerRequestError) return NextResponse.json({ error: error.message }, { status: error.status })
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

    const userId = session.user.id
    if ((!Array.isArray(ids) || !ids.length) && !clearAll) {
      return NextResponse.json({ error: 'Invalid delete request' }, { status: 400 })
    }
    const clearAccountHistory = Boolean(clearAll && (!Array.isArray(ids) || !ids.length))
    const result = await withLedgerTransaction(async tx => {
      const where = {
        userId,
        ...(clearAccountHistory && accountId && accountId !== 'ALL' ? { accountId } : {}),
        ...(!clearAccountHistory && Array.isArray(ids) ? { id: { in: ids } } : {}),
      }
      const clearingCash = Boolean(clearAccountHistory && resetCashBalance)
      const targets = clearAccountHistory ? [] : await tx.transaction.findMany({
        where, select: { accountId: true, cashDeltaApplied: true },
      })
      const deleted = await tx.transaction.deleteMany({ where })
      if (clearingCash) {
        await tx.investmentAccount.updateMany({
          where: { userId, ...(where.accountId ? { id: where.accountId } : {}) },
          data: { cashBalance: 0 },
        })
      } else {
        const corrections = new Map<string, Prisma.Decimal>()
        for (const item of targets) {
          if (!item.cashDeltaApplied) continue
          corrections.set(item.accountId, (corrections.get(item.accountId) ?? new Prisma.Decimal(0)).minus(item.cashDeltaApplied))
        }
        for (const [id, delta] of corrections) await applyLedgerCash(tx, id, delta)
      }
      return { count: deleted.count, unverifiedCashCount: targets.filter(item => item.cashDeltaApplied === null).length }
    })
    invalidateUserHoldingsCache(userId)
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('[transactions DELETE]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
