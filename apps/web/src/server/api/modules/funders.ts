import { Hono } from 'hono'
import { funderSchema } from '#/lib/schemas'
import { requirePermission } from '../lib/auth'
import { audit } from '../lib/audit'
import { exec, insert, like, one, paging, parseId, rows, scalar, update } from '../lib/db'
import { notFound } from '../lib/errors'
import { decryptSecret, encryptSecret } from '../lib/secrets'
import { validate } from '../lib/validate'

const PROJECTS_COUNT = '(SELECT COUNT(*) FROM projects p WHERE p.funder_id = f.id)'

export const fundersRoute = new Hono()
  .get('/', requirePermission('funders', 'view'), async (c) => {
    const q = c.req.query()
    const { page, pageSize, limit, offset } = paging(q)
    const where: Array<string> = ['1 = 1']
    const params: Array<unknown> = []
    if (q.q) {
      where.push('(f.name LIKE ? OR f.email LIKE ? OR f.location LIKE ? OR co.name LIKE ?)')
      params.push(like(q.q), like(q.q), like(q.q), like(q.q))
    }
    const from = `FROM funders f LEFT JOIN countries co ON co.id = f.country_id WHERE ${where.join(' AND ')}`
    const [data, total] = await Promise.all([
      rows(
        `SELECT f.id, f.name, f.location, f.email, f.phone, f.website_url, f.logo_url, co.name AS country,
                ${PROJECTS_COUNT} AS projects_count
           ${from} ORDER BY f.name LIMIT ? OFFSET ?`,
        [...params, limit, offset],
      ),
      scalar(`SELECT COUNT(*) ${from}`, params),
    ])
    return c.json({ data, total, page, pageSize })
  })
  .get('/:id', requirePermission('funders', 'view'), async (c) => {
    const id = parseId(c.req.param('id'))
    const funder = await one(
      `SELECT f.*, co.name AS country, f.portal_password_enc IS NOT NULL AS has_portal_password
         FROM funders f LEFT JOIN countries co ON co.id = f.country_id WHERE f.id = ?`,
      [id],
    )
    if (!funder) throw notFound('Funder')
    delete funder.portalPasswordEnc
    const projects = await rows(
      `SELECT p.id, p.code, p.title, p.status, p.type, p.total_funding, p.currency, p.start_date, p.end_date,
              TRIM(CONCAT_WS(' ', i.title, i.first_name, i.last_name)) AS pi_name
         FROM projects p LEFT JOIN investigators i ON i.id = p.pi_id
        WHERE p.funder_id = ? ORDER BY p.start_date DESC, p.id DESC`,
      [id],
    )
    return c.json({ ...funder, hasPortalPassword: Boolean(funder.hasPortalPassword), projects })
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
