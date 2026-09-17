/**
 * POST /api/auth/reset-password
 * Consumes a password reset token and updates the password.
 */

import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

const Schema = z.object({
  token: z.string().min(1),
  password: z
    .string()
    .min(8, 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร')
    .regex(/[a-zA-Z]/, 'ต้องมีตัวอักษร')
    .regex(/[0-9]/, 'ต้องมีตัวเลข'),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = Schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    const { token, password } = parsed.data

    const record = await prisma.passwordResetToken.findUnique({
      where: { token },
    })

    if (!record) {
      return NextResponse.json({ error: 'Token ไม่ถูกต้อง' }, { status: 400 })
    }
    if (record.usedAt) {
      return NextResponse.json({ error: 'Token นี้ถูกใช้ไปแล้ว' }, { status: 400 })
    }
    if (record.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Token หมดอายุแล้ว' }, { status: 400 })
    }

    const passwordHash = await bcrypt.hash(password, 12)

    await prisma.$transaction([
      prisma.passwordResetToken.update({
        where: { token },
        data: { usedAt: new Date() },
      }),
      prisma.user.update({
        where: { id: record.userId },
        data: {
          passwordHash,
          // Invalidate all existing sessions
          sessionVersion: { increment: 1 },
        },
      }),
    ])

    await prisma.auditLog.create({
      data: {
        userId: record.userId,
        action: 'PASSWORD_RESET',
        detail: { tokenUsed: true },
        ipAddress: req.headers.get('x-forwarded-for') ?? 'unknown',
      },
    })

    return NextResponse.json({ message: 'รีเซ็ตรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบใหม่' })
  } catch (error) {
    console.error('[reset-password]', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
  }
}
