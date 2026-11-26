import { PrismaClient } from '@prisma/client'
import { GEMINI_MODEL_CATALOG, migratedGeminiModel } from '../lib/ai/gemini-model-policy'

export async function syncGeminiModels(prisma: PrismaClient) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.aiModelOption.findMany({
      where: { provider: 'gemini' },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }],
    })
    const idsByModel = new Map<string, string>()
    for (const definition of GEMINI_MODEL_CATALOG) {
      const current = existing.find((row) => row.modelId === definition.modelId)
      const row = current
        ? await tx.aiModelOption.update({ where: { id: current.id }, data: definition })
        : await tx.aiModelOption.create({ data: {
            id: `seed-${definition.modelId}`, provider: 'gemini', isActive: true, ...definition,
          } })
      if (row.isActive) idsByModel.set(row.modelId, row.id)
    }

    let migratedSelections = 0
    for (const row of existing) {
      const replacement = migratedGeminiModel(row.modelId)
      if (replacement === row.modelId) continue
      const replacementId = idsByModel.get(replacement)
      if (replacementId) {
        const moved = await tx.userSettings.updateMany({
          where: { selectedAiModelId: row.id },
          data: { selectedAiModelId: replacementId },
        })
        migratedSelections += moved.count
      }
      await tx.aiModelOption.update({
        where: { id: row.id }, data: { isActive: false, isDefaultForAuto: false },
      })
    }
    return { catalogOptions: GEMINI_MODEL_CATALOG.length, migratedSelections }
  })
}

if (require.main === module) {
  const prisma = new PrismaClient()
  syncGeminiModels(prisma)
    .then((result) => console.log('Gemini model catalog updated', result))
    .catch((error: unknown) => {
      console.error('Gemini model catalog update failed', error instanceof Error ? error.name : 'Unknown error')
      process.exitCode = 1
    })
    .finally(() => prisma.$disconnect())
}
