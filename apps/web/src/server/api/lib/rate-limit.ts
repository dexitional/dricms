import type { Context, Next } from 'hono'
import { AppError } from './errors'

// Small in-memory fixed-window limiter for the public endpoints (form
// submissions, uploads, tracking, sign-in). Per process; enough to blunt
// scripted abuse of a single server.
const hits = new Map<string, { count: number; resetAt: number }>()

export function clientIp(c: Context) {
  return (
    c.req.header('cf-connecting-ip') ??
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
    c.req.header('x-real-ip') ??
    'local'
  )
}

export function rateLimit(name: string, max: number, windowSeconds: number) {
  return async (c: Context, next: Next) => {
    const now = Date.now()
    const key = `${name}:${clientIp(c)}`
    const entry = hits.get(key)
    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowSeconds * 1000 })
    } else if (++entry.count > max) {
      throw new AppError('Too many requests. Please wait a moment and try again.', 429)
    }
    if (hits.size > 5000) for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k)
    await next()
  }
}
