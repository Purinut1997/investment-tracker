/**
 * GET/POST /api/accounts
 * List or create investment accounts.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

const CreateSchema = z.object({
  accountName: z.string().min(1).max(100),
  accountType: z.enum(['brokerage', 'crypto_exchange', 'bank', 'cash']),
  currency: z.string().length(3).default('THB'),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const accounts = await prisma.investmentAccount.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'asc' },
    include: {
      _count: { select: { transactions: true } },
    },
  })

  return NextResponse.json(accounts)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const parsed = CreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const account = await prisma.investmentAccount.create({
      data: { userId: session.user.id, ...parsed.data },
    })

    return NextResponse.json(account, { status: 201 })
  } catch (error) {
    console.error('[accounts POST]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
