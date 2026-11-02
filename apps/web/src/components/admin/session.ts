import { useRouteContext } from '@tanstack/react-router'
import { can } from '#/lib/permissions'
import type { Access, Module } from '#/lib/permissions'

export function useUser() {
  return useRouteContext({ from: '/admin', select: (c) => c.user })
}

export function useCan(module: Module, level: Access = 'view') {
  const user = useUser()
  return can(user.role, module, level)
}
