// Submissions of the DRIC request forms (lib/forms.ts).
//
// Public (no sign-in, rate limited):
//   POST /api/public/requests              submit a form → { reference, accessKey }
//   POST /api/public/uploads               attach a document to a form
//   POST /api/public/track                 { reference, email } → status
//   GET  /api/public/requests/:ref?k=key   full submission (confirmation page & printout)
//   GET  /api/public/stats                 landing-page counters
// Staff:
//   GET    /api/requests                   list
//   GET    /api/requests/:id | /ref/:ref   detail
//   PATCH  /api/requests/:id/official      status, receipt and decisions
//   DELETE /api/requests/:id
import { timingSafeEqual } from 'node:crypto'
import { Hono } from 'hono'
import type { SessionUser } from '#/server/session-core'
import { REQUEST_FORM_BY_TYPE } from '#/lib/forms'
import { DECISION_ROLES, RECEIPT_ROLES } from '#/lib/permissions'
import { requestOfficialSchema, requestSchema, trackSchema } from '#/lib/schemas'
import { assertRole, requirePermission, sessionUser } from '../lib/auth'
import { audit } from '../lib/audit'
import { exec, insert, like, one, paging, parseId, rows, scalar, update } from '../lib/db'
import { AppError, notFound } from '../lib/errors'
import { rateLimit } from '../lib/rate-limit'
import { accessKey, requestReference, retryOnDuplicate } from '../lib/refs'
import { ATTACHMENT_EXTENSIONS, saveUpload } from '../lib/storage'
import { validate } from '../lib/validate'

const DETAIL = `SELECT r.*, p.code AS project_code_linked, p.title AS project_title_linked
                  FROM requests r LEFT JOIN projects p ON p.id = r.project_id`

function present(row: Record<string, any>, includeKey = false) {
  const { accessKey: key, ...rest } = row
  return {
    ...rest,
    data: rest.data ?? {},
    items: rest.items ?? [],
    attachments: rest.attachments ?? [],
    ...(includeKey ? { accessKey: key } : {}),
  }
}

function keysMatch(a: string, b: string) {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

/** Investigators see only their own submissions. */
function ownScope(user: SessionUser): { sql: string; params: Array<unknown> } {
  if (user.role !== 'investigator') return { sql: '1 = 1', params: [] }
  return { sql: '(r.investigator_id = ? OR r.email = ?)', params: [user.investigatorId ?? 0, user.email] }
}

export const publicRoute = new Hono()
  .get('/stats', async (c) => {
    const stats = await one(
      `SELECT (SELECT COUNT(*) FROM projects WHERE status = 'ONGOING') AS ongoing_projects,
              (SELECT COUNT(*) FROM projects) AS projects,
              (SELECT COUNT(*) FROM funders) AS funders,
              (SELECT COUNT(*) FROM investigators WHERE is_active = 1) AS investigators,
              (SELECT COUNT(DISTINCT country_id) FROM projects WHERE country_id IS NOT NULL) AS countries`,
    )
    c.header('cache-control', 'public, max-age=300')
    return c.json(stats)
  })
  .post('/uploads', rateLimit('upload', 40, 600), async (c) => {
    const body = await c.req.parseBody()
    const file = body.file
    if (!(file instanceof File)) throw new AppError('Choose a file to upload.', 422)
    return c.json(await saveUpload(file, ATTACHMENT_EXTENSIONS), 201)
  })
  .post('/requests', rateLimit('submit', 10, 600), validate('json', requestSchema), async (c) => {
    const { declaration: _d, projectCode, items, attachments, currency, data, ...fields } = c.req.valid('json')
    const def = REQUEST_FORM_BY_TYPE[fields.type]
    // Keep only the answers this form asks for.
    const answers: Record<string, unknown> = {}
    for (const group of def.groups)
      for (const f of group.fields) if (data[f.name] !== undefined) answers[f.name] = data[f.name]
    if (def.hasItems || fields.type === 'CLOSE_OUT') answers.currency = currency

    const user = await sessionUser(c)
    const [project, investigator] = await Promise.all([
      projectCode ? one<{ id: number }>('SELECT id FROM projects WHERE code = ?', [projectCode.toUpperCase()]) : null,
      user?.investigatorId
        ? { id: user.investigatorId }
        : one<{ id: number }>('SELECT id FROM investigators WHERE email = ? LIMIT 1', [fields.email]),
    ])
    const key = accessKey()
    const result = await retryOnDuplicate(async () => {
      const reference = requestReference()
      const id = await insert('requests', {
        ...fields,
        reference,
        accessKey: key,
        data: JSON.stringify(answers),
        items: def.hasItems ? JSON.stringify(items) : null,
        attachments: JSON.stringify(attachments),
        projectId: def.linksProject ? (project?.id ?? null) : null,
        investigatorId: investigator?.id ?? null,
        signedAt: new Date().toISOString().slice(0, 10),
      })
      return { id, reference }
    })
    audit(
      user,
      'create',
      'request',
      result.id,
      `${def.shortTitle} submitted by ${fields.firstName} ${fields.surname} (${result.reference})`,
    )
    return c.json({ reference: result.reference, accessKey: key }, 201)
  })
  .post('/track', rateLimit('track', 30, 600), validate('json', trackSchema), async (c) => {
    const { reference, email } = c.req.valid('json')
    const row = await one(
      `SELECT reference, access_key, type, status, project_title, created_at, received_at, director_decided_at, updated_at
         FROM requests WHERE reference = ? AND email = ?`,
      [reference, email],
    )
    if (!row) throw new AppError('No request matches that reference and email.', 404)
    return c.json(row)
  })
  .get('/requests/:ref', rateLimit('view', 120, 600), async (c) => {
    const key = c.req.query('k') ?? ''
    const row = await one(`${DETAIL} WHERE r.reference = ?`, [(c.req.param('ref') ?? '').toUpperCase()])
    if (!row || !keysMatch(String(row.accessKey), key)) throw notFound('Request')
    return c.json(present(row))
  })

export const requestsRoute = new Hono()
  .get('/', requirePermission('requests', 'view'), async (c) => {
    const q = c.req.query()
    const { page, pageSize, limit, offset } = paging(q)
    const scope = ownScope(c.get('user'))
    const where: Array<string> = [scope.sql]
    const params: Array<unknown> = [...scope.params]
    if (q.q) {
      where.push(
        `(r.reference LIKE ? OR r.project_title LIKE ? OR CONCAT(r.first_name, ' ', r.surname) LIKE ? OR r.email LIKE ?)`,
      )
      params.push(like(q.q), like(q.q), like(q.q), like(q.q))
    }
    if (q.type) (where.push('r.type = ?'), params.push(q.type))
    if (q.status) (where.push('r.status = ?'), params.push(q.status))
    const from = `FROM requests r WHERE ${where.join(' AND ')}`
    const [data, total, summary] = await Promise.all([
      rows(
        `SELECT r.id, r.reference, r.type, r.status, r.project_title, r.surname, r.first_name, r.email, r.department,
                r.created_at, r.received_at
           ${from} ORDER BY r.created_at DESC LIMIT ? OFFSET ?`,
        [...params, limit, offset],
      ),
      scalar(`SELECT COUNT(*) ${from}`, params),
      rows(`SELECT r.status, COUNT(*) AS count FROM requests r WHERE ${scope.sql} GROUP BY r.status`, scope.params),
    ])
    return c.json({ data, total, page, pageSize, summary })
  })
  .get('/ref/:ref', requirePermission('requests', 'view'), async (c) => {
    const scope = ownScope(c.get('user'))
    const row = await one(`${DETAIL} WHERE r.reference = ? AND ${scope.sql}`, [
      (c.req.param('ref') ?? '').toUpperCase(),
      ...scope.params,
    ])
    if (!row) throw notFound('Request')
    return c.json(present(row))
  })
  .get('/:id', requirePermission('requests', 'view'), async (c) => {
    const scope = ownScope(c.get('user'))
    const row = await one(`${DETAIL} WHERE r.id = ? AND ${scope.sql}`, [parseId(c.req.param('id')), ...scope.params])
    if (!row) throw notFound('Request')
    return c.json(present(row))
  })
  .patch(
    '/:id/official',
    requirePermission('requests', 'manage'),
    validate('json', requestOfficialSchema),
    async (c) => {
      const user = c.get('user')
      const id = parseId(c.req.param('id'))
      const existing = await one<{ reference: string; type: string; projectId: number | null }>(
        'SELECT reference, type, project_id FROM requests WHERE id = ?',
        [id],
      )
      if (!existing) throw notFound('Request')
      const data = c.req.valid('json')
      const decisions = [
        'directorDecision',
        'directorName',
        'directorDecidedAt',
        'vcDecision',
        'vcName',
        'vcDecidedAt',
      ] as const
      if (decisions.some((k) => data[k] !== undefined)) assertRole(user, DECISION_ROLES, 'record decisions')
      if (data.status === 'APPROVED' || data.status === 'DECLINED')
        assertRole(user, DECISION_ROLES, 'approve or decline requests')
      if (data.receivedAt !== undefined) assertRole(user, RECEIPT_ROLES, 'record receipt')
      await update('requests', id, data)
      // An approved close-out closes the linked project.
      const projectId = data.projectId ?? existing.projectId
      if (data.status === 'APPROVED' && existing.type === 'CLOSE_OUT' && projectId) {
        await exec(`UPDATE projects SET status = 'CLOSED' WHERE id = ?`, [projectId])
        audit(user, 'update', 'project', projectId, `Project closed out via ${existing.reference}`)
      }
      audit(
        user,
        'update',
        'request',
        id,
        `Request ${existing.reference}: ${data.status ? `status → ${data.status}` : 'official-use details'}`,
      )
      return c.json({ id })
    },
  )
  .delete('/:id', requirePermission('requests', 'manage'), async (c) => {
    const user = c.get('user')
    assertRole(user, ['administrator'], 'delete requests')
    const id = parseId(c.req.param('id'))
    const existing = await one<{ reference: string }>('SELECT reference FROM requests WHERE id = ?', [id])
    if (!existing) throw notFound('Request')
    await exec('DELETE FROM requests WHERE id = ?', [id])
    audit(user, 'delete', 'request', id, `Deleted request ${existing.reference}`)
    return c.json({ ok: true })
  })
