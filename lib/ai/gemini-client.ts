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
  systemInstruction?: string
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
}: CallGeminiOptions): Promise<CallGeminiResult> {
  // 1. Get user settings and API key
  const userSettings = await prisma.userSettings.findUnique({
    where: { userId },
    include: { selectedAiModel: true },
  })

  let apiKey: string | null = null

  if (userSettings?.geminiApiKeyEncrypted) {
    try {
      apiKey = decrypt(userSettings.geminiApiKeyEncrypted)
    } catch (err) {
      console.error('[Gemini] Failed to decrypt user API key:', err)
      throw new Error('ไม่สามารถถอดรหัส Gemini API Key ได้ กรุณาบันทึกคีย์ใหม่อีกครั้งในหน้าตั้งค่า')
    }
  } else if (process.env.GEMINI_API_KEY) {
    apiKey = process.env.GEMINI_API_KEY
  }

  if (!apiKey) {
    throw new Error('กรุณาระบุ Gemini API Key ในหน้าตั้งค่า (Settings) ก่อนใช้งานฟีเจอร์ AI')
  }

  const ai = new GoogleGenerativeAI(apiKey)

  // 2. Determine models to try based on Auto or Manual mode
  let modelsToTry: string[] = []

  if (userSettings?.aiModelMode === 'manual' && userSettings.selectedAiModel?.modelId) {
    modelsToTry = [userSettings.selectedAiModel.modelId]
  } else {
    // Auto Mode: get active models ordered by default, then sortOrder
    const dbModels = await prisma.aiModelOption.findMany({
      where: { isActive: true },
      orderBy: [{ isDefaultForAuto: 'desc' }, { sortOrder: 'asc' }],
    })

    if (dbModels.length > 0) {
      modelsToTry = dbModels.map((m) => m.modelId)
    } else {
      // Hardcoded fallback list in case seed has not been run
      modelsToTry = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-2.0-flash']
    }
  }

  let lastError: any = null

  // 3. Fallback execution chain
  for (const modelId of modelsToTry) {
    try {
      const model = ai.getGenerativeModel({
        model: modelId,
        ...(systemInstruction ? { systemInstruction } : {}),
      })

      const contentPayload = images && images.length > 0
        ? [prompt, ...images]
        : prompt

      const result = await model.generateContent(contentPayload as any)
      const response = await result.response
      const text = response.text()

      if (!text) {
        throw new Error('Empty response from model')
      }

      // 4. Log to AiAdviceLog
      prisma.aiAdviceLog
        .create({
          data: {
            userId,
            logType: logType === 'stock_insight' ? 'advisor' : logType,
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
      console.warn(`[Gemini] Model ${modelId} failed:`, errMsg)

      // If user selected manual mode, do not fallback
      if (userSettings?.aiModelMode === 'manual') {
        break
      }

      // If rate limit (429) or quota exceeded, proceed to next model
      if (errMsg.includes('429') || errMsg.includes('Quota') || errMsg.includes('ResourceExhausted')) {
        continue
      }
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
