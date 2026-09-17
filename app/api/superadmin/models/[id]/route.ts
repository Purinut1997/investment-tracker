import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const UpdateModelSchema = z.object({
  displayName: z.string().optional(),
  tier: z.enum(['free', 'paid_only', 'requires_billing']).optional(),
  isActive: z.boolean().optional(),
  isDefaultForAuto: z.boolean().optional(),
  sortOrder: z.number().optional(),
  notes: z.string().optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (session?.user?.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  try {
    const body = await req.json()
    const parsed = UpdateModelSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    if (parsed.data.isDefaultForAuto) {
      await prisma.aiModelOption.updateMany({
        where: { id: { not: id }, isDefaultForAuto: true },
        data: { isDefaultForAuto: false },
      })
    }

    const updated = await prisma.aiModelOption.update({
      where: { id },
      data: parsed.data,
    })

    return NextResponse.json(updated)
  } catch (error: any) {
    console.error('[superadmin models PATCH]', error)
    return NextResponse.json({ error: error.message || 'Failed to update model' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (session?.user?.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  try {
    await prisma.aiModelOption.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[superadmin models DELETE]', error)
    return NextResponse.json({ error: error.message || 'Failed to delete model' }, { status: 500 })
  }
}
