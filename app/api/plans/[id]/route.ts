import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const UpdatePresetSchema = z.object({
  presetName: z.string().min(1).optional(),
  riskProfile: z.string().optional(),
  targetAllocation: z.record(z.string(), z.any()).optional(),
  monthlyContribution: z.number().nonnegative().optional(),
  targetAmount: z.number().nonnegative().optional(),
  targetDate: z.string().nullable().optional(),
  isDefault: z.boolean().optional(),
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
    const parsed = UpdatePresetSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const existing = await prisma.investmentPreset.findFirst({
      where: { id, userId: session.user.id },
    })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (parsed.data.isDefault) {
      await prisma.investmentPreset.updateMany({
        where: { userId: session.user.id, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      })
    }

    const updated = await prisma.investmentPreset.update({
      where: { id },
      data: {
        ...(parsed.data.presetName && { presetName: parsed.data.presetName }),
        ...(parsed.data.riskProfile && { riskProfile: parsed.data.riskProfile }),
        ...(parsed.data.targetAllocation && { targetAllocation: parsed.data.targetAllocation as any }),
        ...(parsed.data.monthlyContribution !== undefined && { monthlyContribution: parsed.data.monthlyContribution }),
        ...(parsed.data.targetAmount !== undefined && { targetAmount: parsed.data.targetAmount }),
        ...(parsed.data.targetDate !== undefined && {
          targetDate: parsed.data.targetDate ? new Date(parsed.data.targetDate) : null,
        }),
        ...(parsed.data.isDefault !== undefined && { isDefault: parsed.data.isDefault }),
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('[plans PUT]', error)
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
    const existing = await prisma.investmentPreset.findFirst({
      where: { id, userId: session.user.id },
    })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await prisma.investmentPreset.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[plans DELETE]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
