/**
 * lib/ai/gemini-client.ts
 * Multi-model Gemini client with Auto-fallback chain and AiAdviceLog auditing.
 */

import { GoogleGenerativeAI } from '@google/generative-ai'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/crypto'

export interface CallGeminiOptions {
  userId: string
  prompt: string
  images?: Array<{
    inlineData: {
      data: string
      mimeType: string
    }
  }>
  logType:
    | 'advisor'
    | 'weekly_digest'
    | 'forecast_explain'
    | 'tax_explain'
    | 'csv_mapping'
    | 'quick_add_multimodal'
    | 'stock_insight'
    | 'daily_brief'
    | 'bucket_chat'
  systemInstruction?: string
  responseMimeType?: 'application/json' | 'text/plain'
  thinkingBudget?: number
}

export interface CallGeminiResult {
  text: string
  modelUsed: string
}

export async function callGemini({
  userId,
  prompt,
  images,
  logType,
  systemInstruction,
  responseMimeType,
  thinkingBudget,
}: CallGeminiOptions): Promise<CallGeminiResult> {
  // 1. Get user settings and prepare candidate API keys (User key first, then System key fallback)
  const userSettings = await prisma.userSettings.findUnique({
    where: { userId },
    include: { selectedAiModel: true },
  })

  const apiKeysToTry: string[] = []

  if (userSettings?.geminiApiKeyEncrypted) {
    try {
      const decrypted = decrypt(userSettings.geminiApiKeyEncrypted)
      if (decrypted && decrypted.trim().length > 0) {
        apiKeysToTry.push(decrypted.trim())
      }
    } catch (err) {
      console.warn('[Gemini] Failed to decrypt user API key, will try system key:', err)
    }
  }

  const systemKey = process.env.GEMINI_API_KEY?.trim()
  if (systemKey && !apiKeysToTry.includes(systemKey)) {
    apiKeysToTry.push(systemKey)
  }

  if (apiKeysToTry.length === 0) {
    throw new Error('กรุณาระบุ Gemini API Key ในหน้าตั้งค่า (Settings) ก่อนใช้งานฟีเจอร์ AI')
  }

  // 2. Determine models to try based on Auto or Manual mode
  let modelsToTry: string[] = []
  const deprecatedModels = new Set(['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash-lite'])

  if (userSettings?.aiModelMode === 'manual' && userSettings.selectedAiModel?.modelId) {
    modelsToTry = [userSettings.selectedAiModel.modelId]
  } else {
    // Auto Mode: get active models ordered by default, then sortOrder
    const dbModels = await prisma.aiModelOption.findMany({
      where: { isActive: true },
      orderBy: [{ isDefaultForAuto: 'desc' }, { sortOrder: 'asc' }],
    })

    if (dbModels.length > 0) {
      modelsToTry = dbModels.map((m) => m.modelId).filter((id) => !deprecatedModels.has(id))
    }

    if (modelsToTry.length === 0) {
      modelsToTry = ['gemini-2.5-flash', 'gemini-3-flash']
    }
  }

  // Determine optimal thinking budget:
  // For fast responses (<4s), default to 0 for operational endpoints unless explicitly specified or forecast
  const effectiveThinkingBudget =
    thinkingBudget !== undefined
      ? thinkingBudget
      : logType === 'forecast_explain'
      ? 512
      : 0

  let lastError: any = null

  // 3. Fallback execution chain across API Keys and Models
  for (let keyIdx = 0; keyIdx < apiKeysToTry.length; keyIdx++) {
    const currentApiKey = apiKeysToTry[keyIdx]
    const isUserKey = keyIdx === 0 && Boolean(userSettings?.geminiApiKeyEncrypted)
    const ai = new GoogleGenerativeAI(currentApiKey)

    for (const modelId of modelsToTry) {
      try {
        const model = ai.getGenerativeModel({
          model: modelId,
          ...(systemInstruction ? { systemInstruction } : {}),
          generationConfig: {
            ...(responseMimeType ? { responseMimeType } : {}),
            ...(effectiveThinkingBudget !== undefined
              ? { thinkingConfig: { thinkingBudget: effectiveThinkingBudget } }
              : {}),
          } as any,
        })

        const contentPayload = images && images.length > 0 ? [prompt, ...images] : prompt

        const result = await model.generateContent(contentPayload as any)
        const response = await result.response
        const text = response.text()

        if (!text) {
          throw new Error('Empty response from model')
        }

        // Map logType safely to Prisma enum (advisor, weekly_digest, forecast_explain, tax_explain, csv_mapping, quick_add_multimodal)
        const validDbLogType =
          logType === 'weekly_digest' ||
          logType === 'forecast_explain' ||
          logType === 'tax_explain' ||
          logType === 'csv_mapping' ||
          logType === 'quick_add_multimodal'
            ? logType
            : 'advisor'

        // 4. Log to AiAdviceLog asynchronously
        prisma.aiAdviceLog
          .create({
            data: {
              userId,
              logType: validDbLogType,
              prompt,
              response: text,
              modelUsed: modelId,
            },
          })
          .catch((err) => console.error('[AiAdviceLog Error]', err))

        return {
          text,
          modelUsed: modelId,
        }
      } catch (err: any) {
        lastError = err
        const errMsg = err?.message || ''
        console.warn(`[Gemini] Model ${modelId} with key #${keyIdx + 1} failed:`, errMsg)

        // If rate limit (429) or quota exceeded, or invalid key on user key:
        // Try next model, or let loop fall through to system key fallback
        const isQuotaOrAuth =
          errMsg.includes('429') ||
          errMsg.includes('Quota') ||
          errMsg.includes('ResourceExhausted') ||
          errMsg.includes('API_KEY_INVALID')

        if (userSettings?.aiModelMode === 'manual' && !isQuotaOrAuth) {
          break
        }
      }
    }

    if (isUserKey && apiKeysToTry.length > 1) {
      console.warn('[Gemini] User key exhausted or failed, falling back to system key...')
    }
  }

  // If all failed, format user-friendly message
  const errString = lastError?.message || 'Unknown error'
  if (errString.includes('API_KEY_INVALID') || errString.includes('400')) {
    throw new Error('Gemini API Key ไม่ถูกต้อง กรุณาตรวจสอบคีย์ในหน้าตั้งค่า')
  } else if (errString.includes('429') || errString.includes('Quota')) {
    throw new Error('โควตาการเรียกใช้งาน Gemini API เต็มชั่วคราว กรุณารอสักครู่แล้วลองใหม่')
  } else if (errString.includes('Billing') || errString.includes('billing')) {
    throw new Error('โมเดลนี้ต้องการเปิด Cloud Billing บน Google Cloud Project ก่อนใช้งาน')
  }

  throw new Error(`เกิดข้อผิดพลาดในการเรียก AI: ${errString}`)
}
