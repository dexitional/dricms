// Client-safe session surface, imported by route guards — which the route
// tree bundles for BOTH client and server. Keep this file free of DB/JWT
// imports; the real work lives in session-core.ts, loaded dynamically so it
// is code-split into a chunk the browser never fetches.
import { createServerFn } from '@tanstack/react-start'
import { getCookie } from '@tanstack/react-start/server'

export const SESSION_COOKIE = 'dric_session'
export const SESSION_TTL_SECONDS = 60 * 60 * 10 // 10 hours

export type { SessionUser } from './session-core'

export const getSession = createServerFn({ method: 'GET' }).handler(async () => {
  const { readUserIdFromToken, getSessionUser } = await import('./session-core')
  const id = await readUserIdFromToken(getCookie(SESSION_COOKIE))
  if (!id) return null
  return getSessionUser(id)
})
