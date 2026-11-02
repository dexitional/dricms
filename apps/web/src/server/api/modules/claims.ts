// Claims are "Requests for Disbursement of Research/Consultancy Project Funds"
// against a project phase, paid out in tranches (modules/payments.ts).
//
//   /api/claims               list, create
//   /api/claims/:id           detail, update (content), delete
//   /api/claims/:id/official  status, receipt date and Director/VC decisions
import { Hono } from 'hono'
import type { PoolConnection } from 'mysql2/promise'
import type { SessionUser } from '#/server/session-core'
import { CLAIM_STATUS_ROLES, DECISION_ROLES, RECEIPT_ROLES } from '#/lib/permissions'
import { claimOfficialSchema, claimSchema } from '#/lib/schemas'
import type { z } from 'zod'
import { assertRole, requirePermission } from '../lib/auth'
import { audit } from '../lib/audit'
import { exec, insert, like, one, paging, parseId, rows, scalar, update, withTransaction } from '../lib/db'
import { AppError, notFound } from '../lib/errors'
import { claimReference, retryOnDuplicate } from '../lib/refs'
import { projectScope, requireInvestigatorLink } from '../lib/scope'
import { validate } from '../lib/validate'
import { assertProjectAccess } from './projects'

const PAID = 'COALESCE((SELECT SUM(pm.amount * pm.conversion_rate) FROM payments pm WHERE pm.claim_id = cl.id), 0)'
const NAME = (a: string) => `TRIM(CONCAT_WS(' ', ${a}.title, ${a}.first_name, ${a}.middle_name, ${a}.last_name))`

const round2 = (n: number) => Math.round(n * 100) / 100

type ClaimInput = z.output<typeof claimSchema>

function itemsWithTotals(items: ClaimInput['items']) {
  return items.map((item, index) => ({
    ...item,
    sort: index,
    total: round2(item.quantity * (item.days || 1) * item.unitCost),
  }))
}

async function saveItems(conn: PoolConnection, claimId: number, items: ReturnType<typeof itemsWithTotals>) {
  await exec('DELETE FROM claim_items WHERE claim_id = ?', [claimId], conn)
  if (items.length) {
    await exec(
      'INSERT INTO claim_items (claim_id, sort, description, quantity, unit, days, unit_cost, total) VALUES ?',
      [items.map((i) => [claimId, i.sort, i.description, i.quantity, i.unit, i.days || 1, i.unitCost, i.total])],
      conn,
    )
  }
}

async function loadClaim(user: SessionUser, id: number) {
  const claim = await one<{
    id: number
    reference: string
    status: string
    investigatorId: number | null
    projectId: number
    phaseId: number
    purpose: string
    payments: number
  }>(
    `SELECT cl.id, cl.reference, cl.status, cl.investigator_id, cl.phase_id, cl.purpose, ph.project_id,
            (SELECT COUNT(*) FROM payments pm WHERE pm.claim_id = cl.id) AS payments
       FROM claims cl JOIN phases ph ON ph.id = cl.phase_id WHERE cl.id = ?`,
    [id],
  )
  if (!claim) throw notFound('Claim')
  await assertProjectAccess(user, claim.projectId)
  return claim
}

/** Investigators may only change their own claims, and only while pending. */
function assertCanEditContent(
  user: SessionUser,
  claim: { status: string; investigatorId: number | null; payments: number },
) {
  if (claim.payments > 0)
    throw new AppError('Payments have been made against this claim, so it can no longer be edited.', 409)
  if (user.role === 'investigator') {
    if (claim.investigatorId !== user.investigatorId)
      throw new AppError('You can only change claims you submitted.', 403)
    if (claim.status !== 'PENDING') throw new AppError('This claim is already being processed by DRIC.', 409)
  }
}

export const claimsRoute = new Hono()
  .get('/', requirePermission('claims', 'view'), async (c) => {
    const q = c.req.query()
    const { page, pageSize, limit, offset } = paging(q)
    const scope = projectScope(c.get('user'))
    const where: Array<string> = [scope.sql]
    const params: Array<unknown> = [...scope.params]
    if (q.q) {
      where.push(`(cl.reference LIKE ? OR cl.purpose LIKE ? OR p.title LIKE ? OR ${NAME('i')} LIKE ?)`)
      params.push(like(q.q), like(q.q), like(q.q), like(q.q))
    }
    if (q.status) (where.push('cl.status = ?'), params.push(q.status))
    if (q.projectId) (where.push('p.id = ?'), params.push(Number(q.projectId)))
    const from = `FROM claims cl
      JOIN phases ph ON ph.id = cl.phase_id
      JOIN projects p ON p.id = ph.project_id
      LEFT JOIN investigators i ON i.id = cl.investigator_id
      WHERE ${where.join(' AND ')}`
    const [data, total, summary] = await Promise.all([
      rows(
        `SELECT cl.id, cl.reference, cl.purpose, cl.amount, cl.currency, cl.status, cl.created_at,
                ph.id AS phase_id, ph.phase_no, ph.title AS phase_title, p.id AS project_id, p.code AS project_code,
                p.title AS project_title, ${NAME('i')} AS requester_name, ${PAID} AS paid
           ${from} ORDER BY cl.created_at DESC LIMIT ? OFFSET ?`,
        [...params, limit, offset],
      ),
      scalar(`SELECT COUNT(*) ${from}`, params),
      rows(
        `SELECT cl.status, COUNT(*) AS count FROM claims cl JOIN phases ph ON ph.id = cl.phase_id JOIN projects p ON p.id = ph.project_id WHERE ${scope.sql} GROUP BY cl.status`,
        scope.params,
      ),
    ])
    return c.json({ data, total, page, pageSize, summary })
  })
  .get('/:id', requirePermission('claims', 'view'), async (c) => {
    const id = parseId(c.req.param('id'))
    await loadClaim(c.get('user'), id)
    const claim = await one(
      `SELECT cl.*, ${PAID} AS paid,
              ph.phase_no, ph.title AS phase_title, ph.budget AS phase_budget,
              p.id AS project_id, p.code AS project_code, p.title AS project_title, p.currency AS project_currency,
              f.name AS funder_name,
              i.title AS req_title, i.first_name AS req_first_name, i.middle_name AS req_middle_name,
              i.last_name AS req_last_name, i.college AS req_college, i.faculty AS req_faculty,
              i.department AS req_department, i.designation AS req_designation, i.email AS req_email,
              i.phone AS req_phone,
              u.full_name AS created_by_name
         FROM claims cl
         JOIN phases ph ON ph.id = cl.phase_id
         JOIN projects p ON p.id = ph.project_id
         LEFT JOIN funders f ON f.id = p.funder_id
         LEFT JOIN investigators i ON i.id = cl.investigator_id
         LEFT JOIN users u ON u.id = cl.created_by
        WHERE cl.id = ?`,
      [id],
    )
    const [items, payments] = await Promise.all([
      rows(
        'SELECT description, quantity, unit, days, unit_cost, total FROM claim_items WHERE claim_id = ? ORDER BY sort, id',
        [id],
      ),
      rows(
        `SELECT id, reference, description, amount, currency, conversion_rate, paid_at, amount * conversion_rate AS converted
           FROM payments WHERE claim_id = ? ORDER BY paid_at, id`,
        [id],
      ),
    ])
    return c.json({ ...claim, items, payments, balance: round2(claim!.amount - claim!.paid) })
  })
  .post('/', requirePermission('claims', 'manage'), validate('json', claimSchema), async (c) => {
    const user = c.get('user')
    const { items, ...data } = c.req.valid('json')
    const phase = await one<{ projectId: number; piId: number | null }>(
      'SELECT ph.project_id, p.pi_id FROM phases ph JOIN projects p ON p.id = ph.project_id WHERE ph.id = ?',
      [data.phaseId],
    )
    if (!phase) throw notFound('Phase')
    await assertProjectAccess(user, phase.projectId)
    // Investigators always claim as themselves; staff default to the project PI.
    const investigatorId =
      user.role === 'investigator' ? requireInvestigatorLink(user) : (data.investigatorId ?? phase.piId)
    const lines = itemsWithTotals(items)
    const amount = lines.length ? round2(lines.reduce((sum, l) => sum + l.total, 0)) : data.amount
    if (amount <= 0) throw new AppError('Enter the amount requested, or add breakdown items.', 422)
    const id = await retryOnDuplicate(() =>
      withTransaction(async (conn) => {
        const claimId = await insert(
          'claims',
          { ...data, investigatorId, amount, reference: claimReference(), status: 'PENDING', createdBy: user.id },
          conn,
        )
        await saveItems(conn, claimId, lines)
        return claimId
      }),
    )
    audit(user, 'create', 'claim', id, `Submitted claim "${data.purpose}" for ${data.currency} ${amount}`)
    return c.json({ id }, 201)
  })
  .put('/:id', requirePermission('claims', 'manage'), validate('json', claimSchema), async (c) => {
    const user = c.get('user')
    const id = parseId(c.req.param('id'))
    const claim = await loadClaim(user, id)
    assertCanEditContent(user, claim)
    const { items, ...data } = c.req.valid('json')
    const phase = await one<{ projectId: number }>('SELECT project_id FROM phases WHERE id = ?', [data.phaseId])
    if (!phase) throw notFound('Phase')
    await assertProjectAccess(user, phase.projectId)
    const lines = itemsWithTotals(items)
    const amount = lines.length ? round2(lines.reduce((sum, l) => sum + l.total, 0)) : data.amount
    if (amount <= 0) throw new AppError('Enter the amount requested, or add breakdown items.', 422)
    await withTransaction(async (conn) => {
      await update(
        'claims',
        id,
        { ...data, amount, investigatorId: user.role === 'investigator' ? claim.investigatorId : data.investigatorId },
        conn,
      )
      await saveItems(conn, id, lines)
    })
    audit(user, 'update', 'claim', id, `Updated claim ${claim.reference}`)
    return c.json({ id })
  })
  .patch('/:id/official', requirePermission('claims', 'manage'), validate('json', claimOfficialSchema), async (c) => {
    const user = c.get('user')
    const id = parseId(c.req.param('id'))
    const claim = await loadClaim(user, id)
    const data = c.req.valid('json')
    if (data.status !== undefined) {
      assertRole(user, CLAIM_STATUS_ROLES, 'change claim status')
      if (data.status === 'DECLINED' && claim.payments > 0) {
        throw new AppError('A claim with payments cannot be declined.', 409)
      }
    }
    if (data.receivedAt !== undefined) assertRole(user, RECEIPT_ROLES, 'record receipt')
    const decisions = [
      'directorDecision',
      'directorName',
      'directorDecidedAt',
      'vcDecision',
      'vcName',
      'vcDecidedAt',
    ] as const
    if (decisions.some((k) => data[k] !== undefined)) assertRole(user, DECISION_ROLES, 'record decisions')
    await update('claims', id, data)
    const what = data.status ? `status → ${data.status}` : 'official-use details'
    audit(user, 'update', 'claim', id, `Claim ${claim.reference}: ${what}`)
    return c.json({ id })
  })
  .delete('/:id', requirePermission('claims', 'manage'), async (c) => {
    const user = c.get('user')
    const id = parseId(c.req.param('id'))
    const claim = await loadClaim(user, id)
    assertRole(user, ['administrator', 'clerk', 'investigator'], 'delete claims')
    assertCanEditContent(user, claim)
    await exec('DELETE FROM claims WHERE id = ?', [id])
    audit(user, 'delete', 'claim', id, `Deleted claim ${claim.reference}`)
    return c.json({ ok: true })
  })
