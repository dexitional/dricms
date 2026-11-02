import type { SessionUser } from '#/server/session-core'
import { AppError } from './errors'

// Investigators only ever see the projects they lead or co-investigate.
// These helpers return SQL fragments (with params) to AND into queries,
// given the alias of the projects table in that query.
export function projectScope(user: SessionUser, alias = 'p'): { sql: string; params: Array<unknown> } {
  if (user.role !== 'investigator') return { sql: '1 = 1', params: [] }
  const inv = user.investigatorId ?? 0
  return {
    sql: `(${alias}.pi_id = ? OR EXISTS (SELECT 1 FROM project_co_investigators pci WHERE pci.project_id = ${alias}.id AND pci.investigator_id = ?))`,
    params: [inv, inv],
  }
}

export function isInvestigator(user: SessionUser) {
  return user.role === 'investigator'
}

export function requireInvestigatorLink(user: SessionUser): number {
  if (!user.investigatorId) throw new AppError('Your account is not linked to an investigator record.', 403)
  return user.investigatorId
}
