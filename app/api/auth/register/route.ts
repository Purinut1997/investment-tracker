/**
 * POST /api/auth/register
 * Register with email + password. Sends verification email.
 */

import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { sendEmailVerification } from '@/lib/email/send'
import { promoteSuperadminIfNeeded } from '@/lib/auth/superadmin'

const RegisterSchema = z.object({
  email: z.string().email('อีเมลไม่ถูกต้อง'),
  password: z
    .string()
    .min(8, 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร')
    .regex(/[a-zA-Z]/, 'ต้องมีตัวอักษร')
    .regex(/[0-9]/, 'ต้องมีตัวเลข'),
  name: z.string().min(1, 'กรุณากรอกชื่อ').max(100),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = RegisterSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    const { email, password, name } = parsed.data

    // Check if email already exists
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json(
        { error: 'อีเมลนี้มีบัญชีอยู่แล้ว' },
        { status: 409 }
      )
    }

    // Hash password (cost factor 12)
    const passwordHash = await bcrypt.hash(password, 12)

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        authProvider: 'credentials',
        settings: {
          create: {}, // default UserSettings
        },
      },
    })

    // Auto-promote superadmin
    await promoteSuperadminIfNeeded(user.id, user.email)

    // Create email verification token (24h expiry)
    const token = randomBytes(32).toString('hex')
    await prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    })

    // Send verification email
    await sendEmailVerification(email, name, token)

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'USER_REGISTERED',
        detail: { email, authProvider: 'credentials' },
        ipAddress: req.headers.get('x-forwarded-for') ?? 'unknown',
      },
    })

    return NextResponse.json(
      { message: 'สมัครสมาชิกสำเร็จ กรุณาตรวจสอบอีเมลเพื่อยืนยัน' },
      { status: 201 }
    )
  } catch (error) {
    console.error('[register]', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' },
      { status: 500 }
    )
  }
}
