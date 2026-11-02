import type { Context, Next } from 'hono'
import { getCookie } from 'hono/cookie'
import type { UserRole } from '@dric/db'
import { rolesWith } from '#/lib/permissions'
import type { Access, Module } from '#/lib/permissions'
import { SESSION_COOKIE } from '#/server/session'
import { getSessionUser, readUserIdFromToken } from '#/server/session-core'
import type { SessionUser } from '#/server/session-core'
import { AppError } from './errors'

declare module 'hono' {
  interface ContextVariableMap {
    user: SessionUser
  }
}

export async function sessionUser(c: Context): Promise<SessionUser | null> {
  const id = await readUserIdFromToken(getCookie(c, SESSION_COOKIE))
  return id ? getSessionUser(id) : null
}

export function requireRoles(allowed: ReadonlyArray<UserRole>) {
  return async (c: Context, next: Next) => {
    const user = await sessionUser(c)
    if (!user) throw new AppError('Please sign in.', 401)
    if (!allowed.includes(user.role)) throw new AppError('You do not have access to this.', 403)
    c.set('user', user)
    await next()
  }
}

export const requireUser = requireRoles(['administrator', 'director', 'accountant', 'clerk', 'investigator'])

/** Guards a route by the role matrix in lib/permissions.ts. */
export function requirePermission(module: Module, level: Access) {
  return requireRoles(rolesWith(module, level))
}

export function assertRole(user: SessionUser, allowed: ReadonlyArray<UserRole>, what = 'do this') {
  if (!allowed.includes(user.role)) throw new AppError(`Your role cannot ${what}.`, 403)
}
