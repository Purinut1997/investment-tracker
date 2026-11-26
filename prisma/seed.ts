import { PrismaClient, UserRole } from '@prisma/client'
import { syncGeminiModels } from './sync-gemini-models'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting seed...')

  const models = await syncGeminiModels(prisma)
  console.log(`✅ Synced ${models.catalogOptions} Gemini models and migrated ${models.migratedSelections} selections`)

  // ============================================================
  // 2. Superadmin Bootstrap
  // ============================================================
  const superadminEmail = process.env.SUPERADMIN_EMAIL
  if (!superadminEmail) {
    console.warn(
      '⚠️  SUPERADMIN_EMAIL not set — skipping superadmin bootstrap. Set this env var and re-run seed.'
    )
    return
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: superadminEmail },
  })

  if (existingUser) {
    if (existingUser.role !== UserRole.superadmin) {
      await prisma.user.update({
        where: { email: superadminEmail },
        data: { role: UserRole.superadmin },
      })
      await prisma.auditLog.create({
        data: {
          userId: existingUser.id,
          action: 'SUPERADMIN_ROLE_GRANTED_BY_SEED',
          detail: {
            email: superadminEmail,
            previousRole: existingUser.role,
            newRole: 'superadmin',
            grantedAt: new Date().toISOString(),
          },
          ipAddress: 'seed-script',
        },
      })
      console.log(`✅ Upgraded existing user "${superadminEmail}" to superadmin`)
    } else {
      console.log(`ℹ️  User "${superadminEmail}" is already superadmin`)
    }
  } else {
    // User doesn't exist yet — create a placeholder that will be updated on first login
    // (The full user will be created by NextAuth on first Google login or /register)
    console.log(
      `ℹ️  User "${superadminEmail}" not found yet. They will be promoted to superadmin on first login.`
    )
    console.log(
      `   Make sure SUPERADMIN_EMAIL matches the email used during registration.`
    )
  }

  console.log('🌱 Seed complete.')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
