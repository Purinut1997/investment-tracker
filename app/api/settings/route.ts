import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { encrypt } from '@/lib/crypto'
import { z } from 'zod'

const UpdateSettingsSchema = z.object({
  baseCurrency: z.string().length(3).optional(),
  theme: z.enum(['dark', 'light']).optional(),
  aiEnabled: z.boolean().optional(),
  aiModelMode: z.enum(['auto', 'manual']).optional(),
  selectedAiModelId: z.string().nullable().optional(),
  geminiApiKey: z.string().min(10).optional(),
  weeklyDigestEnabled: z.boolean().optional(),
  allocationAlertThresholdPercent: z.number().min(1).max(50).optional(),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id

  try {
    // 1. Get or create UserSettings
    let settings = await prisma.userSettings.findUnique({
      where: { userId },
      include: { selectedAiModel: true },
    })

    if (!settings) {
      settings = await prisma.userSettings.create({
        data: { userId },
        include: { selectedAiModel: true },
      })
    }

    // 2. Get list of active AI models
    const aiModels = await prisma.aiModelOption.findMany({
      where: { isActive: true },
      orderBy: [{ isDefaultForAuto: 'desc' }, { sortOrder: 'asc' }],
    })

    return NextResponse.json({
      settings: {
        baseCurrency: settings.baseCurrency,
        theme: settings.theme,
        aiEnabled: settings.aiEnabled,
        aiModelMode: settings.aiModelMode,
        selectedAiModelId: settings.selectedAiModelId,
        selectedAiModel: settings.selectedAiModel,
        hasApiKey: Boolean(settings.geminiApiKeyEncrypted || process.env.GEMINI_API_KEY),
        weeklyDigestEnabled: settings.weeklyDigestEnabled,
        allocationAlertThresholdPercent: Number(settings.allocationAlertThresholdPercent),
      },
      aiModels,
    })
  } catch (error) {
    console.error('[settings GET]', error)
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id

  try {
    const body = await req.json()
    const parsed = UpdateSettingsSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const { geminiApiKey, ...otherFields } = parsed.data
    const dataToUpdate: any = { ...otherFields }

    // Encrypt Gemini API key if provided
    if (geminiApiKey) {
      dataToUpdate.geminiApiKeyEncrypted = encrypt(geminiApiKey.trim())
    }

    const updated = await prisma.userSettings.upsert({
      where: { userId },
      update: dataToUpdate,
      create: { userId, ...dataToUpdate },
    })

    return NextResponse.json({
      success: true,
      hasApiKey: Boolean(updated.geminiApiKeyEncrypted || process.env.GEMINI_API_KEY),
    })
  } catch (error: any) {
    console.error('[settings PATCH]', error)
    return NextResponse.json({ error: error.message || 'Failed to update settings' }, { status: 500 })
  }
}
