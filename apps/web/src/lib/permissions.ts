import type { UserRole } from '@dric/db'

// Who can see and change what. "view" allows reads; "edit" also allows
// creating and updating, but not deleting or account administration;
// "manage" allows every change. The API enforces this matrix on every route;
// the admin UI reads it only to decide what to show. Investigators are
// additionally scoped to the projects they lead or co-investigate, and to
// those projects' funders (server/api/lib/scope.ts).
//
// - Accountants work on money: payments, remittances, retirements and the
//   rate register. Claims are read-only to them (status included), and
//   funders are shown without their contact and grant-portal details.
// - The Director views everything and moves claims along (status and
//   decision), but doesn't raise claims.
// - Clerks keep funders, projects, people and form intake; they don't see
//   claims, payments or remittances, and can add and edit investigators and
//   personnel but not delete them or create portal accounts.
// - Investigators see only their own projects and those projects' funders,
//   read-only, and raise claims and log activities on them.
export type Access = 'view' | 'edit' | 'manage'
export type Module =
  | 'dashboard'
  | 'funders'
  | 'projects'
  | 'activities'
  | 'investigators'
  | 'personnel'
  | 'claims'
  | 'payments'
  | 'remittances'
  | 'retirements'
  | 'rates'
  | 'requests'
  | 'users'
  | 'audit'

const MATRIX: Record<Module, Partial<Record<UserRole, Access>>> = {
  dashboard: { administrator: 'manage', director: 'view', accountant: 'view', clerk: 'view', investigator: 'view' },
  funders: { administrator: 'manage', director: 'view', accountant: 'view', clerk: 'manage', investigator: 'view' },
  projects: { administrator: 'manage', director: 'view', accountant: 'view', clerk: 'manage', investigator: 'view' },
  activities: {
    administrator: 'manage',
    director: 'view',
    accountant: 'view',
    clerk: 'manage',
    investigator: 'manage',
  },
  investigators: { administrator: 'manage', director: 'view', clerk: 'edit' },
  personnel: { administrator: 'manage', director: 'view', clerk: 'edit' },
  claims: { administrator: 'manage', director: 'view', accountant: 'view', investigator: 'manage' },
  payments: { administrator: 'manage', director: 'view', accountant: 'manage', investigator: 'view' },
  remittances: { administrator: 'manage', director: 'view', accountant: 'manage', investigator: 'view' },
  retirements: { administrator: 'manage', director: 'view', accountant: 'manage', investigator: 'manage' },
  // The exchange-rate register: kept by the accountant and administrator,
  // read by the Director.
  rates: { administrator: 'manage', director: 'view', accountant: 'manage' },
  requests: { administrator: 'manage', director: 'manage', clerk: 'manage', investigator: 'view' },
  users: { administrator: 'manage' },
  audit: { administrator: 'view', director: 'view', accountant: 'view' },
}

const RANK: Record<Access, number> = { view: 1, edit: 2, manage: 3 }

export function can(role: UserRole, module: Module, level: Access = 'view'): boolean {
  const access = MATRIX[module][role]
  if (!access) return false
  return RANK[access] >= RANK[level]
}

export function rolesWith(module: Module, level: Access): Array<UserRole> {
  return (Object.keys(MATRIX[module]) as Array<UserRole>).filter((role) => can(role, module, level))
}

// Finer-grained actions on claims and form requests (the "For official use
// only" section of each form).
// Accountants only view a claim's status; the Director and administrators
// move it along.
export const CLAIM_STATUS_ROLES: Array<UserRole> = ['administrator', 'director']
export const DECISION_ROLES: Array<UserRole> = ['administrator', 'director']
/** Who records when a form request was received. */
export const RECEIPT_ROLES: Array<UserRole> = ['administrator', 'director', 'accountant', 'clerk']
/** Who records when a claim was received (clerks no longer see claims). */
export const CLAIM_RECEIPT_ROLES: Array<UserRole> = ['administrator', 'director']
/** Anyone who may set some part of a claim's official-use section. */
export const CLAIM_OFFICIAL_ROLES: Array<UserRole> = [
  ...new Set([...CLAIM_STATUS_ROLES, ...DECISION_ROLES, ...CLAIM_RECEIPT_ROLES]),
]
/** Who sees a funder's contact details and grant-portal sign-in. */
export const FUNDER_CONTACT_ROLES: Array<UserRole> = ['administrator', 'director', 'clerk']
/** Who accepts or rejects the receipts a tranche is retired with. */
export const RETIREMENT_REVIEW_ROLES: Array<UserRole> = ['administrator', 'accountant']
/** Who sees everyone's activity log; other roles with audit access (the accountant) see only their own. */
export const AUDIT_ALL_ROLES: Array<UserRole> = ['administrator', 'director']
