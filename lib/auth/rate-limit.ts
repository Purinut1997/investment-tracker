/**
 * lib/auth/rate-limit.ts
 * DB-backed login rate limiting using LoginAttempt table.
 * Prevents brute force attacks: max 5 failed attempts per email within 15 minutes.
 */

import { prisma } from '@/lib/prisma'

const MAX_ATTEMPTS = 5
const WINDOW_MINUTES = 15
const LOCKOUT_MINUTES = 15

export interface RateLimitResult {
  allowed: boolean
  remainingAttempts: number
  lockoutUntil?: Date
}

/**
 * Check if a login attempt is allowed for the given email.
 */
export async function checkLoginRateLimit(
  email: string,
  ipAddress: string
): Promise<RateLimitResult> {
  const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000)

  const recentFailures = await prisma.loginAttempt.count({
    where: {
      email,
      success: false,
      attemptedAt: { gte: windowStart },
    },
  })

  if (recentFailures >= MAX_ATTEMPTS) {
    // Find the most recent failure to calculate lockout end time
    const lastFailure = await prisma.loginAttempt.findFirst({
      where: { email, success: false, attemptedAt: { gte: windowStart } },
      orderBy: { attemptedAt: 'desc' },
    })

    const lockoutUntil = new Date(
      (lastFailure?.attemptedAt ?? new Date()).getTime() +
        LOCKOUT_MINUTES * 60 * 1000
    )

    return {
      allowed: false,
      remainingAttempts: 0,
      lockoutUntil,
    }
  }

  return {
    allowed: true,
    remainingAttempts: MAX_ATTEMPTS - recentFailures,
  }
}

/**
 * Record a login attempt (success or failure).
 */
export async function recordLoginAttempt(
  email: string,
  ipAddress: string,
  success: boolean
): Promise<void> {
  await prisma.loginAttempt.create({
    data: { email, ipAddress, success },
  })
}
