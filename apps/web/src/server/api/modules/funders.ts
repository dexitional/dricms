import { Hono } from 'hono'
import { funderSchema } from '#/lib/schemas'
import { FUNDER_CONTACT_ROLES, can } from '#/lib/permissions'
import type { SessionUser } from '#/server/session-core'
import { requirePermission } from '../lib/auth'
import { audit } from '../lib/audit'
import { exec, insert, like, one, paging, parseId, rows, scalar, update } from '../lib/db'
import { notFound } from '../lib/errors'
import { PROJECT_DISBURSED, PROJECT_RECEIVED } from '../lib/ledger'
import { decryptSecret, encryptSecret } from '../lib/secrets'
import { funderScope, projectScope } from '../lib/scope'
import { validate } from '../lib/validate'

// Contact details and the grant-portal sign-in are left out for roles that
// shouldn't see them (accountants, investigators).
const PRIVATE_FIELDS = ['email', 'phone', 'address', 'portalUrl', 'portalUsername', 'hasPortalPassword'] as const
function forRole<T extends Record<string, any>>(user: SessionUser, funder: T): T {
  if (FUNDER_CONTACT_ROLES.includes(user.role)) return funder
  const copy: Record<string, any> = { ...funder }
  for (const key of PRIVATE_FIELDS) delete copy[key]
  return copy as T
}

export const fundersRoute = new Hono()
  .get('/', requirePermission('funders', 'view'), async (c) => {
    const q = c.req.query()
    const { page, pageSize, limit, offset } = paging(q)
    const user = c.get('user')
    const scope = funderScope(user)
    const inScope = projectScope(user)
    const where: Array<string> = [scope.sql]
    const params: Array<unknown> = [...scope.params]
    if (q.q) {
      // Email is only searchable by those allowed to see it.
      const byEmail = FUNDER_CONTACT_ROLES.includes(user.role)
      where.push(`(f.name LIKE ? ${byEmail ? 'OR f.email LIKE ?' : ''} OR f.location LIKE ? OR co.name LIKE ?)`)
      params.push(like(q.q), ...(byEmail ? [like(q.q)] : []), like(q.q), like(q.q))
    }
    const from = `FROM funders f LEFT JOIN countries co ON co.id = f.country_id WHERE ${where.join(' AND ')}`
    const [data, total] = await Promise.all([
      rows(
        `SELECT f.id, f.name, f.location, f.email, f.phone, f.website_url, f.logo_url, co.name AS country,
                (SELECT COUNT(*) FROM projects p WHERE p.funder_id = f.id AND ${inScope.sql}) AS projects_count
           ${from} ORDER BY f.name LIMIT ? OFFSET ?`,
        [...inScope.params, ...params, limit, offset],
      ),
      scalar(`SELECT COUNT(*) ${from}`, params),
    ])
    return c.json({ data: data.map((f) => forRole(user, f)), total, page, pageSize })
  })
  .get('/:id', requirePermission('funders', 'view'), async (c) => {
    const user = c.get('user')
    const id = parseId(c.req.param('id'))
    const scope = funderScope(user)
    const funder = await one(
      `SELECT f.*, co.name AS country, f.portal_password_enc IS NOT NULL AS has_portal_password
         FROM funders f LEFT JOIN countries co ON co.id = f.country_id WHERE f.id = ? AND ${scope.sql}`,
      [id, ...scope.params],
    )
    if (!funder) throw notFound('Funder')
    const inScope = projectScope(user)
    // Money columns only for roles that see the funds ledger.
    const seesFunds = can(user.role, 'remittances')
    delete funder.portalPasswordEnc
    const [projects, remittances] = await Promise.all([
      rows(
        `SELECT p.id, p.code, p.title, p.status, p.type, p.total_funding, p.currency, p.start_date, p.end_date,
                TRIM(CONCAT_WS(' ', i.title, i.first_name, i.last_name)) AS pi_name,
                ${PROJECT_RECEIVED} AS received, ${PROJECT_DISBURSED} AS disbursed
           FROM projects p LEFT JOIN investigators i ON i.id = p.pi_id
          WHERE p.funder_id = ? AND ${inScope.sql} ORDER BY p.start_date DESC, p.id DESC`,
        [id, ...inScope.params],
      ),
      // What this funder has distributed, to any project (co-funding included).
      rows(
        `SELECT r.id, r.reference, r.amount, r.currency, r.exchange_rate, r.received_at, r.description,
                p.id AS project_id, p.code AS project_code, p.title AS project_title, p.currency AS project_currency
           FROM remittances r JOIN projects p ON p.id = r.project_id
          WHERE r.funder_id = ? AND ${inScope.sql} ORDER BY r.received_at DESC, r.id DESC LIMIT 12`,
        [id, ...inScope.params],
      ),
    ])
    return c.json(
      forRole(user, {
        ...funder,
        hasPortalPassword: Boolean(funder.hasPortalPassword),
        projects: seesFunds ? projects : projects.map(({ received: _r, disbursed: _d, ...p }) => p),
        remittances: seesFunds ? remittances : [],
      }),
    )
  })
  // Decrypts the stored portal password on demand; every reveal is logged.
  .get('/:id/portal-password', requirePermission('funders', 'manage'), async (c) => {
    const id = parseId(c.req.param('id'))
    const row = await one<{ name: string; portalPasswordEnc: string | null }>(
      'SELECT name, portal_password_enc FROM funders WHERE id = ?',
      [id],
    )
    if (!row) throw notFound('Funder')
    audit(c.get('user'), 'reveal', 'funder', id, `Revealed portal password for ${row.name}`)
    return c.json({ password: row.portalPasswordEnc ? decryptSecret(row.portalPasswordEnc) : null })
  })
  .post('/', requirePermission('funders', 'manage'), validate('json', funderSchema), async (c) => {
    const { portalPassword, clearPortalPassword: _clear, ...data } = c.req.valid('json')
    const id = await insert('funders', {
      ...data,
      portalPasswordEnc: portalPassword ? encryptSecret(portalPassword) : null,
    })
    audit(c.get('user'), 'create', 'funder', id, `Added funder ${data.name}`)
    return c.json({ id }, 201)
  })
  .put('/:id', requirePermission('funders', 'manage'), validate('json', funderSchema), async (c) => {
    const id = parseId(c.req.param('id'))
    const { portalPassword, clearPortalPassword, ...data } = c.req.valid('json')
    const changes: Record<string, unknown> = { ...data }
    if (portalPassword) changes.portalPasswordEnc = encryptSecret(portalPassword)
    else if (clearPortalPassword) changes.portalPasswordEnc = null
    if (!(await update('funders', id, changes))) throw notFound('Funder')
    audit(c.get('user'), 'update', 'funder', id, `Updated funder ${data.name}`)
    return c.json({ id })
  })
  .delete('/:id', requirePermission('funders', 'manage'), async (c) => {
    const id = parseId(c.req.param('id'))
    const row = await one<{ name: string }>('SELECT name FROM funders WHERE id = ?', [id])
    if (!row) throw notFound('Funder')
    await exec('DELETE FROM funders WHERE id = ?', [id])
    audit(c.get('user'), 'delete', 'funder', id, `Deleted funder ${row.name}`)
    return c.json({ ok: true })
  })
