/**
 * POST /api/auth/verify-email
 * Consume an email verification token.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

const Schema = z.object({ token: z.string().min(1) })

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = Schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Token ไม่ถูกต้อง' }, { status: 400 })
    }

    const { token } = parsed.data

    const record = await prisma.emailVerificationToken.findUnique({
      where: { token },
      include: { user: true },
    })

    if (!record) {
      return NextResponse.json({ error: 'Token ไม่ถูกต้องหรือหมดอายุ' }, { status: 400 })
    }
    if (record.usedAt) {
      return NextResponse.json({ error: 'Token นี้ถูกใช้ไปแล้ว' }, { status: 400 })
    }
    if (record.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Token หมดอายุแล้ว กรุณาขอ link ใหม่' }, { status: 400 })
    }

    // Mark token as used and verify user email
    await prisma.$transaction([
      prisma.emailVerificationToken.update({
        where: { token },
        data: { usedAt: new Date() },
      }),
      prisma.user.update({
        where: { id: record.userId },
        data: { emailVerified: new Date() },
      }),
    ])

    return NextResponse.json({ message: 'ยืนยันอีเมลสำเร็จ' })
  } catch (error) {
    console.error('[verify-email]', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
  }
}

/**
 * GET /api/auth/verify-email?token=xxx
 * For direct link from email.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) {
    return Response.redirect(new URL('/login?error=invalid_token', req.url))
  }

  const record = await prisma.emailVerificationToken.findUnique({
    where: { token },
  })

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return Response.redirect(new URL('/login?error=invalid_token', req.url))
  }

  await prisma.$transaction([
    prisma.emailVerificationToken.update({
      where: { token },
      data: { usedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: record.userId },
      data: { emailVerified: new Date() },
    }),
  ])

  return Response.redirect(new URL('/login?verified=1', req.url))
}
