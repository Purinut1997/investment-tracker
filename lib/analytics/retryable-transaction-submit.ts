export function transactionSubmitRequest(
  attempts: Map<string, string>,
  payload: unknown,
  newKey: () => string = () => crypto.randomUUID(),
) {
  const body = JSON.stringify(payload)
  let key = attempts.get(body)
  if (!key) {
    key = newKey()
    attempts.set(body, key)
  }
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
    body,
  }
}

type RetryScope = 'transaction' | 'transaction-batch' | 'cash-wallet'
type RetryStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function tabRetryStorage(): RetryStorage | null {
  try { return globalThis.sessionStorage ?? null } catch { return null }
}

// Keep only a digest and the pending request ID in the current browser tab.
export async function prepareTransactionSubmit(
  attempts: Map<string, string>,
  scope: RetryScope,
  payload: unknown,
  storage: RetryStorage | null = tabRetryStorage(),
) {
  const body = JSON.stringify(payload)
  let storageKey: string | undefined
  if (storage && globalThis.crypto?.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(scope + '\n' + body))
    storageKey = 'pending-ledger:' + Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
    try {
      const key = storage.getItem(storageKey)
      if (key && /^[A-Za-z0-9_-]{16,100}$/.test(key)) attempts.set(body, key)
    } catch { /* Use the in-memory request ID if storage is unavailable. */ }
  }

  const request = transactionSubmitRequest(attempts, payload)
  const key = request.headers['Idempotency-Key']
  if (storageKey && storage) {
    try { storage.setItem(storageKey, key) } catch { /* In-memory retry is still available. */ }
  }
  return {
    request,
    confirmed() {
      if (!storageKey || !storage) return
      try {
        if (storage.getItem(storageKey) === key) storage.removeItem(storageKey)
      } catch { /* Storage access is optional. */ }
    },
  }
}
