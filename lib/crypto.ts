/**
 * lib/crypto.ts
 * AES-256-GCM encryption for Gemini API keys stored in DB.
 *
 * ENCRYPTION_KEY must be a 64-char hex string (32 bytes).
 * WARNING: If ENCRYPTION_KEY changes after deploy, all stored API keys become unrecoverable.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12 // GCM standard
const AUTH_TAG_LENGTH = 16

function getKey(): Buffer {
  const hexKey = process.env.ENCRYPTION_KEY
  if (!hexKey || hexKey.length !== 64) {
    throw new Error(
      'ENCRYPTION_KEY must be set as a 64-character hex string (32 bytes). ' +
        'Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    )
  }
  return Buffer.from(hexKey, 'hex')
}

/**
 * Encrypt plaintext (e.g. Gemini API key) for storage in DB.
 * Returns base64-encoded string: iv:authTag:ciphertext
 */
export function encrypt(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()

  // Format: base64(iv):base64(authTag):base64(ciphertext)
  return [
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':')
}

/**
 * Decrypt a value previously encrypted with encrypt().
 * Returns the original plaintext.
 */
export function decrypt(encryptedValue: string): string {
  const key = getKey()
  const parts = encryptedValue.split(':')
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted value format')
  }

  const [ivBase64, authTagBase64, ciphertextBase64] = parts
  const iv = Buffer.from(ivBase64, 'base64')
  const authTag = Buffer.from(authTagBase64, 'base64')
  const ciphertext = Buffer.from(ciphertextBase64, 'base64')

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ])

  return decrypted.toString('utf8')
}
