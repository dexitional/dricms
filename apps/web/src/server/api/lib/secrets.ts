import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

// Funder portal passwords are stored encrypted (AES-256-GCM) with a key
// derived from CREDENTIALS_KEY, and only decrypted on an explicit "reveal".
function key(): Buffer {
  const secret = process.env.CREDENTIALS_KEY
  if (!secret || secret.length < 32) throw new Error('CREDENTIALS_KEY must be set to at least 32 characters.')
  return createHash('sha256').update(secret).digest()
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(), iv)
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64')
}

export function decryptSecret(encoded: string): string | null {
  try {
    const buf = Buffer.from(encoded, 'base64')
    const decipher = createDecipheriv('aes-256-gcm', key(), buf.subarray(0, 12))
    decipher.setAuthTag(buf.subarray(12, 28))
    return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString('utf8')
  } catch {
    return null
  }
}
