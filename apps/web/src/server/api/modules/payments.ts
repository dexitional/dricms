// Tranche payments against approved claims. A tranche may be paid in a
// different currency from the claim; conversion_rate turns it into the
// claim's currency, and the converted total may never exceed the claim.
//
//   /api/payments       list, create
//   /api/payments/:id   voucher detail, update, delete
import { Hono } from 'hono'
import type { z } from 'zod'
import { paymentSchema } from '#/lib/schemas'
import { money } from '#/lib/format'
import { requirePermission } from '../lib/auth'
import { audit } from '../lib/audit'
import { exec, insert, like, one, paging, parseId, rows, scalar, update } from '../lib/db'
import { AppError, notFound } from '../lib/errors'
import { paymentReference, retryOnDuplicate } from '../lib/refs'
import { projectScope } from '../lib/scope'
import { validate } from '../lib/validate'

const NAME = `TRIM(CONCAT_WS(' ', i.title, i.first_name, i.middle_name, i.last_name))`
const TOLERANCE = 0.01

async function checkBalance(data: z.output<typeof paymentSchema>, excludePaymentId = 0) {
  const claim = await one<{ status: string; amount: number; currency: string; reference: string; paid: number }>(
    `SELECT cl.status, cl.amount, cl.currency, cl.reference,
            COALESCE((SELECT SUM(pm.amount * pm.conversion_rate) FROM payments pm WHERE pm.claim_id = cl.id AND pm.id <> ?), 0) AS paid
       FROM claims cl WHERE cl.id = ?`,
    [excludePaymentId, data.claimId],
  )
  if (!claim) throw notFound('Claim')
  if (claim.status !== 'APPROVED') throw new AppError('Payments can only be made against approved claims.', 409)
  if (data.currency === claim.currency && data.conversionRate !== 1) {
    throw new AppError(
      `The tranche is in the claim's currency (${claim.currency}), so the conversion rate must be 1.`,
      422,
    )
  }
  const converted = data.amount * data.conversionRate
  const balance = claim.amount - claim.paid
  if (converted > balance + TOLERANCE) {
    throw new AppError(
      `This tranche (${money(converted, claim.currency)}) is more than the outstanding balance of ${money(balance, claim.currency)} on ${claim.reference}.`,
      422,
    )
  }
  return claim
}

export const paymentsRoute = new Hono()
  .get('/', requirePermission('payments', 'view'), async (c) => {
    const q = c.req.query()
    const { page, pageSize, limit, offset } = paging(q)
    const scope = projectScope(c.get('user'))
    const where: Array<string> = [scope.sql]
    const params: Array<unknown> = [...scope.params]
    if (q.q) {
      where.push(
        `(pm.reference LIKE ? OR cl.reference LIKE ? OR p.title LIKE ? OR ${NAME} LIKE ? OR pm.description LIKE ?)`,
      )
      params.push(like(q.q), like(q.q), like(q.q), like(q.q), like(q.q))
    }
    if (q.claimId) (where.push('cl.id = ?'), params.push(Number(q.claimId)))
    if (q.from) (where.push('pm.paid_at >= ?'), params.push(q.from))
    if (q.to) (where.push('pm.paid_at <= ?'), params.push(q.to))
    const from = `FROM payments pm
      JOIN claims cl ON cl.id = pm.claim_id
      JOIN phases ph ON ph.id = cl.phase_id
      JOIN projects p ON p.id = ph.project_id
      LEFT JOIN investigators i ON i.id = COALESCE(cl.investigator_id, p.pi_id)
      WHERE ${where.join(' AND ')}`
    const [data, total] = await Promise.all([
      rows(
        `SELECT pm.id, pm.reference, pm.description, pm.amount, pm.currency, pm.conversion_rate, pm.paid_at,
                pm.amount * pm.conversion_rate AS converted, cl.id AS claim_id, cl.reference AS claim_reference,
                cl.currency AS claim_currency, ph.phase_no, p.id AS project_id, p.title AS project_title, ${NAME} AS payee
           ${from} ORDER BY pm.paid_at DESC, pm.id DESC LIMIT ? OFFSET ?`,
        [...params, limit, offset],
      ),
      scalar(`SELECT COUNT(*) ${from}`, params),
    ])
    return c.json({ data, total, page, pageSize })
  })
  .get('/:id', requirePermission('payments', 'view'), async (c) => {
    const id = parseId(c.req.param('id'))
    const scope = projectScope(c.get('user'))
    const payment = await one(
      `SELECT pm.*, pm.amount * pm.conversion_rate AS converted, u.full_name AS created_by_name,
              cl.reference AS claim_reference, cl.purpose AS claim_purpose, cl.amount AS claim_amount,
              cl.currency AS claim_currency,
              (SELECT COUNT(*) FROM payments x WHERE x.claim_id = pm.claim_id AND (x.paid_at < pm.paid_at OR (x.paid_at = pm.paid_at AND x.id <= pm.id))) AS tranche_no,
              COALESCE((SELECT SUM(x.amount * x.conversion_rate) FROM payments x WHERE x.claim_id = pm.claim_id), 0) AS claim_paid,
              ph.phase_no, ph.title AS phase_title, p.id AS project_id, p.code AS project_code, p.title AS project_title,
              f.name AS funder_name,
              ${NAME} AS payee, i.staff_no AS payee_staff_no, i.department AS payee_department, i.email AS payee_email,
              i.phone AS payee_phone, i.account_name, i.bank_name, i.account_no, i.bank_branch
         FROM payments pm
         JOIN claims cl ON cl.id = pm.claim_id
         JOIN phases ph ON ph.id = cl.phase_id
         JOIN projects p ON p.id = ph.project_id
         LEFT JOIN funders f ON f.id = p.funder_id
         LEFT JOIN investigators i ON i.id = COALESCE(cl.investigator_id, p.pi_id)
         LEFT JOIN users u ON u.id = pm.created_by
        WHERE pm.id = ? AND ${scope.sql}`,
      [id, ...scope.params],
    )
    if (!payment) throw notFound('Payment')
    return c.json(payment)
  })
  .post('/', requirePermission('payments', 'manage'), validate('json', paymentSchema), async (c) => {
    const data = c.req.valid('json')
    const claim = await checkBalance(data)
    const result = await retryOnDuplicate(async () => {
      const reference = paymentReference()
      return { id: await insert('payments', { ...data, reference, createdBy: c.get('user').id }), reference }
    })
    audit(
      c.get('user'),
      'create',
      'payment',
      result.id,
      `Paid tranche ${result.reference} of ${money(data.amount, data.currency)} on ${claim.reference}`,
    )
    return c.json(result, 201)
  })
  .put('/:id', requirePermission('payments', 'manage'), validate('json', paymentSchema), async (c) => {
    const id = parseId(c.req.param('id'))
    const existing = await one<{ reference: string }>('SELECT reference FROM payments WHERE id = ?', [id])
    if (!existing) throw notFound('Payment')
    const data = c.req.valid('json')
    await checkBalance(data, id)
    await update('payments', id, data)
    audit(c.get('user'), 'update', 'payment', id, `Updated tranche ${existing.reference}`)
    return c.json({ id })
  })
  .delete('/:id', requirePermission('payments', 'manage'), async (c) => {
    const id = parseId(c.req.param('id'))
    const existing = await one<{ reference: string }>('SELECT reference FROM payments WHERE id = ?', [id])
    if (!existing) throw notFound('Payment')
    await exec('DELETE FROM payments WHERE id = ?', [id])
    audit(c.get('user'), 'delete', 'payment', id, `Deleted tranche ${existing.reference}`)
    return c.json({ ok: true })
  })
