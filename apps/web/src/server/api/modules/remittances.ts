// Funds a funder distributes to a project. Each remittance is credited to
// the project's balance sheet in the project's currency (amount *
// exchange_rate); tranche payments are what draw it down (lib/ledger.ts).
//
//   /api/remittances       list, create
//   /api/remittances/:id   detail, update, delete
import { Hono } from 'hono'
import type { z } from 'zod'
import { remittanceSchema } from '#/lib/schemas'
import { money } from '#/lib/format'
import { requirePermission } from '../lib/auth'
import { audit } from '../lib/audit'
import { exec, insert, like, one, paging, parseId, rows, scalar, update } from '../lib/db'
import { AppError, notFound } from '../lib/errors'
import { projectLedger } from '../lib/ledger'
import { code, retryOnDuplicate } from '../lib/refs'
import { projectScope } from '../lib/scope'
import { validate } from '../lib/validate'
import { assertProjectAccess } from './projects'

const remittanceReference = () => `RMT-${code(6)}`

/** The project must exist; a remittance in the project's own currency has rate 1. */
async function checkProject(data: z.output<typeof remittanceSchema>) {
  const project = await one<{ title: string; currency: string; funderId: number | null }>(
    'SELECT title, currency, funder_id FROM projects WHERE id = ?',
    [data.projectId],
  )
  if (!project) throw notFound('Project')
  if (data.currency === project.currency && data.exchangeRate !== 1) {
    throw new AppError(
      `The remittance is in the project's currency (${project.currency}), so the exchange rate must be 1.`,
      422,
    )
  }
  return project
}

export const remittancesRoute = new Hono()
  .get('/', requirePermission('remittances', 'view'), async (c) => {
    const q = c.req.query()
    const { page, pageSize, limit, offset } = paging(q)
    const scope = projectScope(c.get('user'))
    const where: Array<string> = [scope.sql]
    const params: Array<unknown> = [...scope.params]
    if (q.q) {
      where.push('(r.reference LIKE ? OR r.description LIKE ? OR p.title LIKE ? OR p.code LIKE ? OR f.name LIKE ?)')
      params.push(like(q.q), like(q.q), like(q.q), like(q.q), like(q.q))
    }
    if (q.funderId) (where.push('r.funder_id = ?'), params.push(Number(q.funderId)))
    if (q.projectId) (where.push('r.project_id = ?'), params.push(Number(q.projectId)))
    if (q.from) (where.push('r.received_at >= ?'), params.push(q.from))
    if (q.to) (where.push('r.received_at <= ?'), params.push(q.to))
    const from = `FROM remittances r
      JOIN projects p ON p.id = r.project_id
      LEFT JOIN funders f ON f.id = r.funder_id
      WHERE ${where.join(' AND ')}`
    const [data, total, totals] = await Promise.all([
      rows(
        `SELECT r.id, r.reference, r.description, r.amount, r.currency, r.exchange_rate, r.received_at,
                r.amount * r.exchange_rate AS converted, JSON_LENGTH(COALESCE(r.attachments, JSON_ARRAY())) AS attachments_count,
                p.id AS project_id, p.code AS project_code, p.title AS project_title, p.currency AS project_currency,
                f.id AS funder_id, f.name AS funder_name, f.logo_url AS funder_logo
           ${from} ORDER BY r.received_at DESC, r.id DESC LIMIT ? OFFSET ?`,
        [...params, limit, offset],
      ),
      scalar(`SELECT COUNT(*) ${from}`, params),
      rows(
        `SELECT r.currency, SUM(r.amount) AS total, COUNT(*) AS count ${from} GROUP BY r.currency ORDER BY total DESC`,
        params,
      ),
    ])
    return c.json({ data, total, page, pageSize, totals })
  })
  .get('/:id', requirePermission('remittances', 'view'), async (c) => {
    const id = parseId(c.req.param('id'))
    const remittance = await one(
      `SELECT r.*, r.amount * r.exchange_rate AS converted, p.code AS project_code, p.title AS project_title,
              p.currency AS project_currency, f.name AS funder_name, u.full_name AS created_by_name
         FROM remittances r
         JOIN projects p ON p.id = r.project_id
         LEFT JOIN funders f ON f.id = r.funder_id
         LEFT JOIN users u ON u.id = r.created_by
        WHERE r.id = ?`,
      [id],
    )
    if (!remittance) throw notFound('Remittance')
    await assertProjectAccess(c.get('user'), remittance.projectId)
    return c.json({ ...remittance, attachments: remittance.attachments ?? [] })
  })
  .post('/', requirePermission('remittances', 'manage'), validate('json', remittanceSchema), async (c) => {
    const { attachments, ...data } = c.req.valid('json')
    const project = await checkProject({ ...data, attachments })
    const result = await retryOnDuplicate(async () => {
      const reference = remittanceReference()
      const id = await insert('remittances', {
        ...data,
        funderId: data.funderId ?? project.funderId,
        reference,
        attachments: JSON.stringify(attachments),
        createdBy: c.get('user').id,
      })
      return { id, reference }
    })
    audit(
      c.get('user'),
      'create',
      'remittance',
      result.id,
      `Received ${money(data.amount, data.currency)} (${result.reference}) for ${project.title}`,
    )
    const ledger = await projectLedger(data.projectId)
    return c.json({ ...result, balance: ledger.summary.balance, currency: ledger.currency }, 201)
  })
  .put('/:id', requirePermission('remittances', 'manage'), validate('json', remittanceSchema), async (c) => {
    const id = parseId(c.req.param('id'))
    const existing = await one<{ reference: string }>('SELECT reference FROM remittances WHERE id = ?', [id])
    if (!existing) throw notFound('Remittance')
    const { attachments, ...data } = c.req.valid('json')
    const project = await checkProject({ ...data, attachments })
    await update('remittances', id, {
      ...data,
      funderId: data.funderId ?? project.funderId,
      attachments: JSON.stringify(attachments),
    })
    audit(c.get('user'), 'update', 'remittance', id, `Updated remittance ${existing.reference} for ${project.title}`)
    return c.json({ id })
  })
  .delete('/:id', requirePermission('remittances', 'manage'), async (c) => {
    const id = parseId(c.req.param('id'))
    const existing = await one<{ reference: string; amount: number; currency: string }>(
      'SELECT reference, amount, currency FROM remittances WHERE id = ?',
      [id],
    )
    if (!existing) throw notFound('Remittance')
    await exec('DELETE FROM remittances WHERE id = ?', [id])
    audit(
      c.get('user'),
      'delete',
      'remittance',
      id,
      `Deleted remittance ${existing.reference} of ${money(existing.amount, existing.currency)}`,
    )
    return c.json({ ok: true })
  })
