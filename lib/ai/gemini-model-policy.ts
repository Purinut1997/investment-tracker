export const FLASH_MODEL = 'gemini-3.8-flash'
export const LITE_MODEL = 'gemini-3.5-flash-lite'
export const PRO_MODEL = 'gemini-3.1-pro-preview'

export const GEMINI_MODEL_CATALOG = [
  { modelId: FLASH_MODEL, displayName: 'Gemini 3.8 Flash (วิเคราะห์)', tier: 'free', sortOrder: 1, isDefaultForAuto: true, notes: 'Auto: วิเคราะห์พอร์ต, Copilot และงานที่ต้องใช้เหตุผล' },
  { modelId: LITE_MODEL, displayName: 'Gemini 3.5 Flash-Lite (งานด่วน)', tier: 'free', sortOrder: 2, isDefaultForAuto: false, notes: 'Auto: อ่านสลิป จัดข้อมูล และสรุปแบบสั้น' },
  { modelId: PRO_MODEL, displayName: 'Gemini 3.1 Pro Preview (ต้องเปิด Billing)', tier: 'requires_billing', sortOrder: 10, isDefaultForAuto: false, notes: 'เลือกเองในโหมด Manual และตรวจสิทธิ์ของ API key ก่อนใช้' },
] as const

const replacements = new Map([
  ['gemini-1.5-flash', LITE_MODEL],
  ['gemini-2.0-flash', FLASH_MODEL],
  ['gemini-2.0-flash-001', FLASH_MODEL],
  ['gemini-2.5-flash', LITE_MODEL],
  ['gemini-3-flash', FLASH_MODEL],
  ['gemini-3-flash-preview', FLASH_MODEL],
  ['gemini-3.7-flash', FLASH_MODEL],
  ['gemini-2.5-pro', FLASH_MODEL],
  ['gemini-3-pro', FLASH_MODEL],
  ['gemini-3-pro-preview', FLASH_MODEL],
])

export function migratedGeminiModel(modelId: string) {
  return replacements.get(modelId) ?? modelId
}

type ModelOption = { modelId: string; tier: string; isActive: boolean }

export function autoGeminiModels(options: ModelOption[], fastTask: boolean) {
  const active = (id: string) => {
    const matches = options.filter((model) => model.modelId === id)
    return matches.length === 0 || matches.some((model) => model.isActive && model.tier === 'free')
  }
  const preferred = fastTask ? [LITE_MODEL, FLASH_MODEL] : [FLASH_MODEL, LITE_MODEL]
  const configured = options
    .filter((model) => model.isActive && model.tier === 'free' && migratedGeminiModel(model.modelId) === model.modelId
      && !model.modelId.startsWith('gemini-2.') && !/^gemini-3(?:\.\d+)?-pro(?:-|$)/.test(model.modelId))
    .map((model) => model.modelId)
  return [...new Set([...preferred.filter(active), ...configured])]
}

export function geminiThinkingConfig(modelId: string, budget: number) {
  if (/^gemini-3(?:\.|-)/.test(modelId)) {
    const constrained = modelId.startsWith('gemini-3.8-') || /^gemini-3(?:\.1)?-pro(?:-|$)/.test(modelId)
    return { thinkingLevel: budget >= 1024 ? 'MEDIUM' : budget > 0 || constrained ? 'LOW' : 'MINIMAL' }
  }
  return budget > 0 ? { thinkingBudget: budget } : undefined
}
