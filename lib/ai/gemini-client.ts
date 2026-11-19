/**
 * lib/ai/gemini-client.ts
 * Multi-model Gemini client with Auto-fallback chain, reasoning (thinkingBudget),
 * optional Google Search Grounding, request timeout, and AiAdviceLog auditing.
 */

import { GoogleGenerativeAI } from '@google/generative-ai'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/crypto'

export interface GroundingSource {
  title: string
  url: string
}

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
  enableGoogleSearch?: boolean
  timeoutMs?: number
  skipLog?: boolean
}

export interface CallGeminiResult {
  text: string
  modelUsed: string
  groundingSources?: GroundingSource[]
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`Gemini timeout (${ms}ms) on ${label}`))
    }, ms)
  })
  try {
    return await Promise.race([promise, timeoutPromise])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

function extractGroundingSources(response: any): GroundingSource[] {
  const chunks: any[] = response?.candidates?.[0]?.groundingMetadata?.groundingChunks || []
  const seen = new Set<string>()
  const sources: GroundingSource[] = []

  for (const chunk of chunks) {
    const url = String(chunk?.web?.uri || '').trim()
    if (!url || seen.has(url)) continue
    seen.add(url)
    const rawTitle = String(chunk?.web?.title || '').trim()
    let hostname = url
    try {
      hostname = new URL(url).hostname.replace(/^www\./, '')
    } catch {}
    sources.push({
      title: rawTitle || hostname,
      url,
    })
    if (sources.length >= 6) break
  }

  return sources
}

export async function callGemini({
  userId,
  prompt,
  images,
  logType,
  systemInstruction,
  responseMimeType,
  thinkingBudget,
  enableGoogleSearch = false,
  timeoutMs = 28000,
  skipLog = false,
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
    // Auto Mode: prioritize non-billing models first, keep billing models only as last-resort fallback
    const dbModels = await prisma.aiModelOption.findMany({
      where: { isActive: true },
      orderBy: [{ isDefaultForAuto: 'desc' }, { sortOrder: 'asc' }],
    })

    const activeModels = dbModels.filter((m) => !deprecatedModels.has(m.modelId))
    const standardModels = activeModels.filter((m) => m.tier !== 'requires_billing').map((m) => m.modelId)
    const billingModels = activeModels.filter((m) => m.tier === 'requires_billing').map((m) => m.modelId)
    modelsToTry = [...standardModels, ...billingModels]

    if (modelsToTry.length === 0) {
      modelsToTry = ['gemini-2.5-flash', 'gemini-3-flash']
    }
  }

  // Enable structured reasoning budget for advisory/analysis endpoints; 0 for fast extraction
  const deepReasoningTypes = new Set<CallGeminiOptions['logType']>([
    'advisor',
    'bucket_chat',
    'forecast_explain',
    'tax_explain',
    'weekly_digest',
    'daily_brief',
  ])

  const effectiveThinkingBudget =
    thinkingBudget !== undefined
      ? thinkingBudget
      : deepReasoningTypes.has(logType)
      ? 1024
      : 0

  // Google Search Grounding cannot be paired with application/json responseMimeType on Gemini API
  const shouldUseSearch = Boolean(enableGoogleSearch && responseMimeType !== 'application/json')

  let lastError: any = null

  // 3. Fallback execution chain across API Keys and Models
  for (let keyIdx = 0; keyIdx < apiKeysToTry.length; keyIdx++) {
    const currentApiKey = apiKeysToTry[keyIdx]
    const isUserKey = keyIdx === 0 && Boolean(userSettings?.geminiApiKeyEncrypted)
    const ai = new GoogleGenerativeAI(currentApiKey)

    for (const modelId of modelsToTry) {
      const contentPayload = images && images.length > 0 ? [prompt, ...images] : prompt

      const invokeModel = async (useSearch: boolean, useThinking: boolean) => {
        const generationConfig: Record<string, any> = {}
        if (responseMimeType) {
          generationConfig.responseMimeType = responseMimeType
        }
        if (useThinking && effectiveThinkingBudget > 0) {
          generationConfig.thinkingConfig = { thinkingBudget: effectiveThinkingBudget }
        }

        const model = ai.getGenerativeModel({
          model: modelId,
          ...(systemInstruction ? { systemInstruction } : {}),
          ...(Object.keys(generationConfig).length > 0 ? { generationConfig } : {}),
          ...(useSearch ? { tools: [{ googleSearch: {} } as any] } : {}),
        })

        const result = await withTimeout(
          model.generateContent(contentPayload as any),
          timeoutMs,
          modelId
        )
        const response = result.response
        const text = response.text()
        if (!text) {
          throw new Error('Empty response from model')
        }
        const groundingSources = useSearch ? extractGroundingSources(response) : []
        return { text, groundingSources }
      }

      try {
        let generated: { text: string; groundingSources: GroundingSource[] }
        try {
          generated = await invokeModel(shouldUseSearch, effectiveThinkingBudget > 0)
        } catch (primaryErr: any) {
          const msg = String(primaryErr?.message || '')
          const isAuthKeyInvalid =
            msg.includes('API_KEY_INVALID') || msg.includes('API key not valid')
          const isFeatureRejected =
            !isAuthKeyInvalid &&
            (shouldUseSearch || effectiveThinkingBudget > 0) &&
            (msg.includes('google_search') ||
              msg.includes('Search') ||
              msg.includes('tools') ||
              msg.includes('thinking') ||
              msg.includes('thinkingConfig') ||
              msg.includes('INVALID_ARGUMENT') ||
              msg.includes('400'))

          if (!isFeatureRejected) {
            throw primaryErr
          }

          console.warn(
            `[Gemini] Retrying ${modelId} without optional search/thinking features after:`,
            msg
          )
          generated = await invokeModel(false, false)
        }

        const { text, groundingSources } = generated

        // Map logType safely to Prisma enum (advisor, weekly_digest, forecast_explain, tax_explain, csv_mapping, quick_add_multimodal)
        const validDbLogType =
          logType === 'weekly_digest' ||
          logType === 'forecast_explain' ||
          logType === 'tax_explain' ||
          logType === 'csv_mapping' ||
          logType === 'quick_add_multimodal'
            ? logType
            : 'advisor'

        // 4. Log to AiAdviceLog before returning unless caller manages persistence itself
        if (!skipLog) {
          try {
            await prisma.aiAdviceLog.create({
              data: {
                userId,
                logType: validDbLogType,
                prompt,
                response: text,
                modelUsed: modelId,
              },
            })
          } catch (err) {
            console.error('[AiAdviceLog Error]', err)
          }
        }

        return {
          text,
          modelUsed: modelId,
          ...(groundingSources.length > 0 ? { groundingSources } : {}),
        }
      } catch (err: any) {
        lastError = err
        const errMsg = String(err?.message || '')
        console.warn(`[Gemini] Model ${modelId} with key #${keyIdx + 1} failed:`, errMsg)

        const isRetryable =
          errMsg.includes('429') ||
          errMsg.includes('Quota') ||
          errMsg.includes('ResourceExhausted') ||
          errMsg.includes('API_KEY_INVALID') ||
          errMsg.includes('API key not valid') ||
          errMsg.includes('timeout')

        if (userSettings?.aiModelMode === 'manual' && !isRetryable) {
          break
        }
      }
    }

    if (isUserKey && apiKeysToTry.length > 1) {
      console.warn('[Gemini] User key exhausted or failed, falling back to system key...')
    }
  }

  // If all failed, format user-friendly message
  const errString = String(lastError?.message || 'Unknown error')
  if (errString.includes('API_KEY_INVALID') || errString.includes('API key not valid')) {
    throw new Error('Gemini API Key ไม่ถูกต้อง กรุณาตรวจสอบคีย์ในหน้าตั้งค่า')
  } else if (errString.includes('429') || errString.includes('Quota')) {
    throw new Error('โควตาการเรียกใช้งาน Gemini API เต็มชั่วคราว กรุณารอสักครู่แล้วลองใหม่')
  } else if (errString.includes('Billing') || errString.includes('billing')) {
    throw new Error('โมเดลนี้ต้องการเปิด Cloud Billing บน Google Cloud Project ก่อนใช้งาน')
  }

  throw new Error(`เกิดข้อผิดพลาดในการเรียก AI: ${errString}`)
}
