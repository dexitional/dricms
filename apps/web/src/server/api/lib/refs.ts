import { randomBytes, randomInt } from 'node:crypto'

// No 0/O, 1/I/L: references get read out over the phone and typed by hand.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export function code(length: number) {
  let out = ''
  for (let i = 0; i < length; i++) out += ALPHABET[randomInt(ALPHABET.length)]
  return out
}

export const paymentReference = () => code(5)
export const claimReference = () => `CLM-${code(6)}`
export const requestReference = () => `RQ-${code(6)}`
export const accessKey = () => randomBytes(16).toString('hex')

/**
 * Runs an insert that takes a generated reference/code, retrying on the
 * (rare) duplicate-key collision. `fn` must generate a fresh value per call.
 */
export async function retryOnDuplicate<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn()
    } catch (err) {
      if ((err as { code?: string }).code !== 'ER_DUP_ENTRY' || attempt >= 6) throw err
    }
  }
}
