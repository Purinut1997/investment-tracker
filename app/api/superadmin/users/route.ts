/**
 * GET /api/superadmin/users
 * List all users (superadmin only).
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { hasOtherSuperadmin } from '@/lib/auth/superadmin'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (session?.user?.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = req.nextUrl
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit = Math.min(100, parseInt(searchParams.get('limit') ?? '20'))
  const q = searchParams.get('q') ?? ''

  const where = q
    ? {
        OR: [
          { email: { contains: q, mode: 'insensitive' as const } },
          { name: { contains: q, mode: 'insensitive' as const } },
        ],
      }
    : {}

  const [users, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        authProvider: true,
        emailVerified: true,
        createdAt: true,
        _count: { select: { transactions: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where }),
  ])

  return NextResponse.json({ data: users, total, page, limit })
}

/**
 * PATCH /api/superadmin/users
 * Update a user's role or status.
 */
export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (session?.user?.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { userId, role, status } = await req.json()

  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 })
  }

  const targetUser = await prisma.user.findUnique({ where: { id: userId } })
  if (!targetUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // Prevent removing last superadmin
  if (
    targetUser.role === 'superadmin' &&
    (role !== 'superadmin' || status === 'suspended')
  ) {
    const hasOther = await hasOtherSuperadmin(userId)
    if (!hasOther) {
      return NextResponse.json(
        { error: 'ไม่สามารถลดสิทธิ์ superadmin คนสุดท้ายในระบบได้' },
        { status: 400 }
      )
    }
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(role && { role }),
      ...(status && { status }),
    },
  })

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: 'SUPERADMIN_USER_UPDATED',
      detail: { targetUserId: userId, role, status },
      ipAddress: req.headers.get('x-forwarded-for') ?? 'unknown',
    },
  })

  return NextResponse.json(updated)
}
