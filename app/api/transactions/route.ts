/**
 * GET/POST /api/transactions
 * List user's transactions (paginated) or create new one.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

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

  const where = {
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

  const [transactions, total] = await prisma.$transaction([
    prisma.transaction.findMany({
      where,
      include: {
        asset: { select: { ticker: true, assetName: true, assetType: true, market: true } },
        account: { select: { accountName: true, currency: true } },
      },
      orderBy: { txnDate: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.transaction.count({ where }),
  ])

  return NextResponse.json({
    data: transactions,
    transactions,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
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
    const totalAmount = data.quantity * data.pricePerUnit + data.fee

    const transaction = await prisma.transaction.create({
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
        asset: { select: { ticker: true, assetName: true } },
        account: { select: { accountName: true } },
      },
    })

    return NextResponse.json(transaction, { status: 201 })
  } catch (error) {
    console.error('[transactions POST]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
