import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Increment sessionVersion to invalidate all existing JWTs on other devices
    await prisma.user.update({
      where: { id: session.user.id },
      data: { sessionVersion: { increment: 1 } },
    })

    // Log to AuditLog
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'INVALIDATE_ALL_SESSIONS',
        detail: { reason: 'User requested sign out from all devices' },
        ipAddress: req.headers.get('x-forwarded-for') ?? 'client',
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[invalidate-sessions]', error)
    return NextResponse.json({ error: 'Failed to invalidate sessions' }, { status: 500 })
  }
}
