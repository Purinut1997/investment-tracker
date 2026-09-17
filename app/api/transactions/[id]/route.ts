/**
 * GET/PUT/DELETE /api/transactions/[id]
 * Get, update (with history snapshot), or delete a transaction.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

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
    const body = await req.json()
    const parsed = UpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const { id } = await params
    const existing = await getTransaction(id, session.user.id)
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Snapshot before edit
    await prisma.transactionEditHistory.create({
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

    const updates = parsed.data
    const newQuantity = updates.quantity ?? Number(existing.quantity)
    const newPrice = updates.pricePerUnit ?? Number(existing.pricePerUnit)
    const newFee = updates.fee ?? Number(existing.fee)
    const newTotal = newQuantity * newPrice + newFee

    const updated = await prisma.transaction.update({
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
      },
    })

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
  const existing = await getTransaction(id, session.user.id)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.transaction.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
