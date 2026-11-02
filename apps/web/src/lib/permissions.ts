import type { UserRole } from '@dric/db'

// Who can see and change what. "view" allows reads, "manage" allows changes.
// The API enforces this matrix on every route; the admin UI reads it only to
// decide what to show. Investigators are additionally scoped to the projects
// they lead or co-investigate (server/api/lib/scope.ts).
export type Access = 'view' | 'manage'
export type Module =
  | 'dashboard'
  | 'funders'
  | 'projects'
  | 'activities'
  | 'investigators'
  | 'personnel'
  | 'claims'
  | 'payments'
  | 'requests'
  | 'users'
  | 'audit'

const MATRIX: Record<Module, Partial<Record<UserRole, Access>>> = {
  dashboard: { administrator: 'manage', director: 'view', accountant: 'view', clerk: 'view', investigator: 'view' },
  funders: { administrator: 'manage', director: 'view', accountant: 'view', clerk: 'manage' },
  projects: { administrator: 'manage', director: 'view', accountant: 'view', clerk: 'manage', investigator: 'view' },
  activities: {
    administrator: 'manage',
    director: 'view',
    accountant: 'view',
    clerk: 'manage',
    investigator: 'manage',
  },
  investigators: { administrator: 'manage', director: 'view', accountant: 'view', clerk: 'manage' },
  personnel: { administrator: 'manage', director: 'view', accountant: 'view', clerk: 'manage', investigator: 'view' },
  claims: {
    administrator: 'manage',
    director: 'manage',
    accountant: 'manage',
    clerk: 'manage',
    investigator: 'manage',
  },
  payments: { administrator: 'manage', director: 'view', accountant: 'manage', clerk: 'view', investigator: 'view' },
  requests: { administrator: 'manage', director: 'manage', accountant: 'view', clerk: 'manage', investigator: 'view' },
  users: { administrator: 'manage' },
  audit: { administrator: 'view', director: 'view' },
}

export function can(role: UserRole, module: Module, level: Access = 'view'): boolean {
  const access = MATRIX[module][role]
  if (!access) return false
  return level === 'view' || access === 'manage'
}

export function rolesWith(module: Module, level: Access): Array<UserRole> {
  return (Object.keys(MATRIX[module]) as Array<UserRole>).filter((role) => can(role, module, level))
}

// Finer-grained actions on claims and form requests (the "For official use
// only" section of each form).
export const CLAIM_STATUS_ROLES: Array<UserRole> = ['administrator', 'director', 'accountant']
export const DECISION_ROLES: Array<UserRole> = ['administrator', 'director']
export const RECEIPT_ROLES: Array<UserRole> = ['administrator', 'director', 'accountant', 'clerk']
