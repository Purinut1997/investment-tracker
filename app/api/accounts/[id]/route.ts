import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

const UpdateSchema = z.object({
  accountName: z.string().min(1).max(100).optional(),
  accountType: z.enum(['brokerage', 'crypto_exchange', 'bank', 'cash']).optional(),
  currency: z.string().length(3).optional(),
})

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  try {
    const body = await req.json()
    const parsed = UpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const existing = await prisma.investmentAccount.findFirst({
      where: { id, userId: session.user.id },
    })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const updated = await prisma.investmentAccount.update({
      where: { id },
      data: parsed.data,
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('[accounts PUT]', error)
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

  try {
    const existing = await prisma.investmentAccount.findFirst({
      where: { id, userId: session.user.id },
      include: { _count: { select: { transactions: true } } },
    })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (existing._count.transactions > 0) {
      return NextResponse.json(
        { error: `ไม่สามารถลบบัญชีนี้ได้ เนื่องจากมี ${existing._count.transactions} รายการธุรกรรมที่ผูกอยู่` },
        { status: 400 }
      )
    }

    await prisma.investmentAccount.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[accounts DELETE]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
