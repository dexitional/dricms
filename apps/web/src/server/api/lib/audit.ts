import type { SessionUser } from '#/server/session-core'
import { exec } from './db'

// Fire-and-forget audit trail; a failed write never fails the request.
export function audit(
  user: SessionUser | null,
  action: string,
  entity: string,
  entityId: number | null,
  summary: string,
) {
  void exec('INSERT INTO audit_logs (user_id, action, entity, entity_id, summary) VALUES (?, ?, ?, ?, ?)', [
    user?.id ?? null,
    action,
    entity,
    entityId,
    summary.slice(0, 500),
  ]).catch((err) => console.error('audit log:', err))
}
