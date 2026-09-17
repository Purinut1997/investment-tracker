/**
 * POST /api/auth/forgot-password
 * Sends a password reset email.
 */

import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { sendPasswordReset } from '@/lib/email/send'

const Schema = z.object({ email: z.string().email() })

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = Schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'อีเมลไม่ถูกต้อง' }, { status: 400 })
    }

    const { email } = parsed.data

    // Always return success to prevent email enumeration
    const user = await prisma.user.findUnique({ where: { email } })
    if (user && user.authProvider !== 'google') {
      const token = randomBytes(32).toString('hex')
      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          token,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
        },
      })
      await sendPasswordReset(email, user.name ?? 'ผู้ใช้', token)
    }

    return NextResponse.json({
      message: 'ถ้าอีเมลนี้มีบัญชีอยู่ในระบบ เราจะส่งลิงก์รีเซ็ตรหัสผ่านไปให้',
    })
  } catch (error) {
    console.error('[forgot-password]', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
  }
}
