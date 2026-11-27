export class GeminiQuotaError extends Error {
  constructor() {
    super('Gemini จำกัดจำนวนคำขอในรอบนี้ กรุณาตรวจโควตาหรือลองใหม่ภายหลัง')
    this.name = 'GeminiQuotaError'
  }
}

export function isProviderQuotaError(error: unknown) {
  if (!error || typeof error !== 'object') return false
  if ('status' in error && typeof error.status === 'number') return error.status === 429
  const message = 'message' in error ? String(error.message) : ''
  return /\[429\b|\bRESOURCE_?EXHAUSTED\b|\bquota (?:exceeded|exhausted)\b|\btoo many requests\b/i.test(message)
}
