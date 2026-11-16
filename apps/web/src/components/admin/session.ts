import { useRouteContext } from '@tanstack/react-router'
import { can } from '#/lib/permissions'
import type { Access, Module } from '#/lib/permissions'

// The signed-in user is fetched once and kept in the query cache, so moving
// between admin pages does not wait on a server round trip. The API still
// checks the session cookie on every request; signing out clears the cache.
export const SESSION_QUERY_KEY = ['session'] as const
export const SESSION_STALE_MS = 5 * 60_000

export function useUser() {
  return useRouteContext({ from: '/admin', select: (c) => c.user })
}

export function useCan(module: Module, level: Access = 'view') {
  const user = useUser()
  return can(user.role, module, level)
}
