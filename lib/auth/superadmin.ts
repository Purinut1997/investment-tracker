/**
 * lib/auth/superadmin.ts
 * Superadmin bootstrap logic.
 * Called after user creation/login to promote SUPERADMIN_EMAIL user.
 */

import { prisma } from '@/lib/prisma'
import { UserRole } from '@prisma/client'

export async function promoteSuperadminIfNeeded(userId: string, email: string): Promise<void> {
  const superadminEmail = process.env.SUPERADMIN_EMAIL
  if (!superadminEmail || email !== superadminEmail) return

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user || user.role === UserRole.superadmin) return

  await prisma.user.update({
    where: { id: userId },
    data: { role: UserRole.superadmin },
  })

  await prisma.auditLog.create({
    data: {
      userId,
      action: 'SUPERADMIN_AUTO_PROMOTED',
      detail: {
        email,
        promotedAt: new Date().toISOString(),
        source: 'auto-bootstrap',
      },
      ipAddress: 'system',
    },
  })
}

/**
 * Check if there's at least one superadmin besides the given userId.
 * Used to prevent self-demotion of the last superadmin.
 */
export async function hasOtherSuperadmin(excludeUserId: string): Promise<boolean> {
  const count = await prisma.user.count({
    where: {
      role: UserRole.superadmin,
      id: { not: excludeUserId },
      status: 'active',
    },
  })
  return count > 0
}
