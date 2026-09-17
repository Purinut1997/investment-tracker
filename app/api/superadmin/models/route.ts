import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const ModelSchema = z.object({
  modelId: z.string().min(1),
  displayName: z.string().min(1),
  tier: z.enum(['free', 'paid_only', 'requires_billing']).default('free'),
  isActive: z.boolean().default(true),
  isDefaultForAuto: z.boolean().default(false),
  sortOrder: z.number().default(1),
  notes: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (session?.user?.role !== 'superadmin' && session?.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const models = await prisma.aiModelOption.findMany({
    orderBy: [{ isDefaultForAuto: 'desc' }, { sortOrder: 'asc' }],
  })

  return NextResponse.json(models)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (session?.user?.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const parsed = ModelSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    if (parsed.data.isDefaultForAuto) {
      // Clear previous default
      await prisma.aiModelOption.updateMany({
        where: { isDefaultForAuto: true },
        data: { isDefaultForAuto: false },
      })
    }

    const created = await prisma.aiModelOption.create({
      data: parsed.data,
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error: any) {
    console.error('[superadmin models POST]', error)
    return NextResponse.json({ error: error.message || 'Failed to create model' }, { status: 500 })
  }
}
