import { PrismaClient, UserRole, AiModelTier } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting seed...')

  // ============================================================
  // 1. Seed AiModelOption (PRE-FLIGHT CHECK: Sep 2026)
  // ============================================================
  const aiModels = [
    {
      provider: 'gemini',
      modelId: 'gemini-2.5-flash',
      displayName: 'Gemini 2.5 Flash (แนะนำ)',
      tier: AiModelTier.free,
      isActive: true,
      isDefaultForAuto: true,
      sortOrder: 1,
      notes: 'Free tier default. Best balance of speed and quality for this app.',
    },
    {
      provider: 'gemini',
      modelId: 'gemini-2.5-flash-lite',
      displayName: 'Gemini 2.5 Flash-Lite',
      tier: AiModelTier.free,
      isActive: true,
      isDefaultForAuto: false,
      sortOrder: 2,
      notes: 'Free tier. Fastest, lowest cost per token. Good for quick-add and CSV mapping.',
    },
    {
      provider: 'gemini',
      modelId: 'gemini-3-flash',
      displayName: 'Gemini 3 Flash',
      tier: AiModelTier.free,
      isActive: true,
      isDefaultForAuto: false,
      sortOrder: 3,
      notes: 'Free tier. Latest generation Flash model.',
    },
    {
      provider: 'gemini',
      modelId: 'gemini-3.1-flash-lite',
      displayName: 'Gemini 3.1 Flash-Lite',
      tier: AiModelTier.free,
      isActive: true,
      isDefaultForAuto: false,
      sortOrder: 4,
      notes: 'Free tier. Newest Flash-Lite model.',
    },
    {
      provider: 'gemini',
      modelId: 'gemini-2.0-flash',
      displayName: 'Gemini 2.0 Flash',
      tier: AiModelTier.free,
      isActive: true,
      isDefaultForAuto: false,
      sortOrder: 5,
      notes: 'Free tier. Fallback option if newer models are unavailable.',
    },
    {
      provider: 'gemini',
      modelId: 'gemini-2.5-pro',
      displayName: 'Gemini 2.5 Pro (ต้องเปิด Billing)',
      tier: AiModelTier.requires_billing,
      isActive: true,
      isDefaultForAuto: false,
      sortOrder: 10,
      notes:
        'Requires Cloud Billing enabled on Google Cloud project. NOT covered by Google AI Pro/Ultra personal subscription. Must enable billing separately.',
    },
    {
      provider: 'gemini',
      modelId: 'gemini-3-pro',
      displayName: 'Gemini 3 Pro (ต้องเปิด Billing)',
      tier: AiModelTier.requires_billing,
      isActive: true,
      isDefaultForAuto: false,
      sortOrder: 11,
      notes:
        'Requires Cloud Billing. Most capable model but incurs real costs per API call.',
    },
  ]

  for (const model of aiModels) {
    await prisma.aiModelOption.upsert({
      where: { id: `seed-${model.modelId}` },
      update: model,
      create: { id: `seed-${model.modelId}`, ...model },
    })
  }
  console.log(`✅ Seeded ${aiModels.length} AI model options`)

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
