import { createHash } from 'node:crypto'

export function adviceCacheKey(snapshot: unknown) {
  return createHash('sha256').update(JSON.stringify(snapshot)).digest('hex').slice(0, 32)
}
