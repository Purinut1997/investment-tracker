import { applyLedgerCash, withLedgerTransaction } from '@/lib/analytics/transaction-ledger'
/**
 * GET/PUT/DELETE /api/transactions/[id]
 * Get, update (with history snapshot), or delete a transaction.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { invalidateUserHoldingsCache } from '@/lib/analytics/holdings'
import { getTransactionCashDelta, getTransactionNetAmount } from '@/lib/analytics/cash-ledger'

const UpdateSchema = z.object({
  txnDate: z.string().datetime({ offset: true }).optional(),
  txnType: z.enum(['BUY', 'SELL', 'DIVIDEND', 'DEPOSIT', 'WITHDRAW', 'FEE']).optional(),
  quantity: z.number().positive().optional(),
  pricePerUnit: z.number().nonnegative().optional(),
  fee: z.number().nonnegative().optional(),
  taxWithheld: z.number().nonnegative().optional(),
  note: z.string().max(500).optional(),
})

async function getTransaction(id: string, userId: string) {
  return prisma.transaction.findFirst({
    where: { id, userId },
    include: {
      asset: { select: { ticker: true, assetName: true, assetType: true } },
      account: { select: { accountName: true, currency: true } },
    },
  })
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const txn = await getTransaction(id, session.user.id)
  if (!txn) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(txn)
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json().catch(() => null)
    const parsed = UpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const { id } = await params
    const userId = session.user.id
    const updates = parsed.data
    const updated = await withLedgerTransaction(async tx => {
      const existing = await tx.transaction.findFirst({ where: { id, userId } })
      if (!existing) return null
      const amountChanged = (updates.txnType ?? existing.txnType) !== existing.txnType ||
        (updates.quantity ?? Number(existing.quantity)) !== Number(existing.quantity) ||
        (updates.pricePerUnit ?? Number(existing.pricePerUnit)) !== Number(existing.pricePerUnit) ||
        (updates.fee ?? Number(existing.fee)) !== Number(existing.fee) ||
        (updates.taxWithheld ?? Number(existing.taxWithheld)) !== Number(existing.taxWithheld)
      const type = updates.txnType ?? existing.txnType
      const newTotal = amountChanged ? getTransactionNetAmount(type, updates.quantity ?? Number(existing.quantity),
        updates.pricePerUnit ?? Number(existing.pricePerUnit), updates.fee ?? Number(existing.fee),
        updates.taxWithheld ?? Number(existing.taxWithheld)) : Number(existing.totalAmount)
      const oldDelta = existing.cashDeltaApplied
      const nextDelta = !amountChanged || oldDelta === null ? oldDelta
        : existing.cashSyncEnabled ? getTransactionCashDelta(type, newTotal) : 0
      if (oldDelta !== null && nextDelta !== null) await applyLedgerCash(tx, existing.accountId, oldDelta.negated().plus(nextDelta))
      // Snapshot before edit
      await tx.transactionEditHistory.create({
        data: {
          transactionId: existing.id,
          editedByUserId: session.user.id,
          previousValues: {
            txnDate: existing.txnDate,
            txnType: existing.txnType,
            quantity: existing.quantity.toString(),
            pricePerUnit: existing.pricePerUnit.toString(),
            fee: existing.fee.toString(),
            taxWithheld: existing.taxWithheld.toString(),
            totalAmount: existing.totalAmount.toString(),
            note: existing.note,
          },
        },
      })

      const row = await tx.transaction.update({
        where: { id },
        data: {
          ...(updates.txnDate && { txnDate: new Date(updates.txnDate) }),
          ...(updates.txnType && { txnType: updates.txnType }),
          ...(updates.quantity !== undefined && { quantity: updates.quantity }),
          ...(updates.pricePerUnit !== undefined && { pricePerUnit: updates.pricePerUnit }),
          ...(updates.fee !== undefined && { fee: updates.fee }),
          ...(updates.taxWithheld !== undefined && { taxWithheld: updates.taxWithheld }),
          ...(updates.note !== undefined && { note: updates.note }),
          totalAmount: newTotal,
          cashDeltaApplied: nextDelta,
        },
      })

      return { ...row, unverifiedCashCount: amountChanged && oldDelta === null ? 1 : 0 }
    })
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    invalidateUserHoldingsCache(session.user.id)

    return NextResponse.json(updated)
  } catch (error) {
    console.error('[transactions PUT]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const userId = session.user.id
  try {
    const deleted = await withLedgerTransaction(async tx => {
      const existing = await tx.transaction.findFirst({ where: { id, userId } })
      if (!existing) return null
      await tx.transaction.delete({ where: { id } })
      if (existing.cashDeltaApplied) await applyLedgerCash(tx, existing.accountId, existing.cashDeltaApplied.negated())
      return { success: true, unverifiedCashCount: existing.cashDeltaApplied === null ? 1 : 0 }
    })
    if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    invalidateUserHoldingsCache(userId)
    return NextResponse.json(deleted)
  } catch (error) {
    console.error('[transactions DELETE]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
