import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (session?.user?.role !== 'superadmin' && session?.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = req.nextUrl
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit = Math.min(100, parseInt(searchParams.get('limit') ?? '30'))
  const type = searchParams.get('type') ?? 'audit' // 'audit' | 'login'

  try {
    if (type === 'login') {
      const [attempts, total] = await Promise.all([
        prisma.loginAttempt.findMany({
          orderBy: { attemptedAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.loginAttempt.count(),
      ])
      return NextResponse.json({ data: attempts, total, page, limit })
    }

    // Default: audit logs
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        include: {
          user: { select: { id: true, email: true, name: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auditLog.count(),
    ])

    return NextResponse.json({ data: logs, total, page, limit })
  } catch (error) {
    console.error('[superadmin logs GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
