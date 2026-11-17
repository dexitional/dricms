// Tranche payments against approved claims. A tranche may be paid in a
// different currency from the claim; conversion_rate turns it into the
// claim's currency, and the converted total may never exceed the claim.
// project_rate turns it into the project's currency so the tranche can be
// charged against the project's balance sheet (lib/ledger.ts).
//
// Every tranche is then retired: the payee accounts for it line by line
// against the phase's activities, uploading receipts for each line, and an
// accountant accepts or rejects each line.
//
//   /api/payments                    list, create
//   /api/payments/:id                voucher detail (+ retirement), update, delete
//   /api/payments/:id/retirements    add a retirement line
//   /api/retirements/:id             update, delete a line (until accepted)
//   /api/retirements/:id/review      accept or reject a line
import { Hono } from 'hono'
import type { z } from 'zod'
import type { SessionUser } from '#/server/session-core'
import { RETIREMENT_REVIEW_ROLES } from '#/lib/permissions'
import { paymentSchema, retirementReviewSchema, retirementSchema } from '#/lib/schemas'
import { money } from '#/lib/format'
import { assertRole, requirePermission } from '../lib/auth'
import { audit } from '../lib/audit'
import { exec, insert, like, one, paging, parseId, rows, scalar, update } from '../lib/db'
import { AppError, notFound } from '../lib/errors'
import { RETIRED, RETIRE_PENDING, retirementState } from '../lib/ledger'
import { paymentReference, retryOnDuplicate } from '../lib/refs'
import { projectScope } from '../lib/scope'
import { validate } from '../lib/validate'

const NAME = `TRIM(CONCAT_WS(' ', i.title, i.first_name, i.middle_name, i.last_name))`
const TOLERANCE = 0.01
const round2 = (n: number) => Math.round(n * 100) / 100

const RETIREMENT_SQL: Record<string, string> = {
  retired: `${RETIRED} >= pm.amount - ${TOLERANCE}`,
  partial: `${RETIRED} < pm.amount - ${TOLERANCE} AND ${RETIRED} + ${RETIRE_PENDING} > 0`,
  unretired: `${RETIRED} + ${RETIRE_PENDING} = 0`,
  outstanding: `${RETIRED} < pm.amount - ${TOLERANCE}`,
}

/** Retirement lines that still count against a tranche (not rejected), in its currency. */
async function retiredOn(paymentId: number, excludeRetirementId = 0) {
  return scalar<number>(
    `SELECT COALESCE(SUM(amount), 0) FROM retirements WHERE payment_id = ? AND status <> 'REJECTED' AND id <> ?`,
    [paymentId, excludeRetirementId],
  )
}

async function checkBalance(data: z.output<typeof paymentSchema>, excludePaymentId = 0) {
  const claim = await one<{
    status: string
    amount: number
    currency: string
    reference: string
    paid: number
    projectCurrency: string
  }>(
    `SELECT cl.status, cl.amount, cl.currency, cl.reference, p.currency AS project_currency,
            COALESCE((SELECT SUM(pm.amount * pm.conversion_rate) FROM payments pm WHERE pm.claim_id = cl.id AND pm.id <> ?), 0) AS paid
       FROM claims cl JOIN phases ph ON ph.id = cl.phase_id JOIN projects p ON p.id = ph.project_id WHERE cl.id = ?`,
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
  // The rate into the project's currency follows from the other rates when
  // either currency matches; otherwise the accountant must give it.
  let projectRate = data.projectRate
  if (data.currency === claim.projectCurrency) projectRate = 1
  else if (claim.currency === claim.projectCurrency) projectRate = data.conversionRate
  else if (!projectRate) {
    throw new AppError(
      `Give the rate from ${data.currency} to the project's currency (${claim.projectCurrency}) so the tranche can be charged to the project's balance.`,
      422,
    )
  }
  return { claim, projectRate }
}

/** Loads a tranche the user may see, with what retiring it needs. */
async function loadPayment(user: SessionUser, id: number) {
  const scope = projectScope(user)
  const payment = await one<{
    id: number
    reference: string
    amount: number
    currency: string
    phaseId: number
    projectId: number
  }>(
    `SELECT pm.id, pm.reference, pm.amount, pm.currency, cl.phase_id, p.id AS project_id
       FROM payments pm JOIN claims cl ON cl.id = pm.claim_id JOIN phases ph ON ph.id = cl.phase_id
       JOIN projects p ON p.id = ph.project_id
      WHERE pm.id = ? AND ${scope.sql}`,
    [id, ...scope.params],
  )
  if (!payment) throw notFound('Payment')
  return payment
}

async function checkRetirementLine(
  payment: { id: number; amount: number; currency: string; phaseId: number },
  data: z.output<typeof retirementSchema>,
  excludeRetirementId = 0,
) {
  const activity = await one<{ title: string }>('SELECT title FROM activities WHERE id = ? AND phase_id = ?', [
    data.activityId,
    payment.phaseId,
  ])
  if (!activity) throw new AppError('Choose an activity of the phase this tranche was paid for.', 422)
  const already = await retiredOn(payment.id, excludeRetirementId)
  const left = round2(payment.amount - already)
  if (data.amount > left + TOLERANCE) {
    throw new AppError(
      `Only ${money(left, payment.currency)} of this tranche is left to retire; this line is ${money(data.amount, payment.currency)}.`,
      422,
    )
  }
  return activity
}

/** Investigators may change only lines they entered; nobody may change an accepted line. */
async function loadRetirement(user: SessionUser, id: number) {
  const line = await one<{
    id: number
    paymentId: number
    status: string
    createdBy: number | null
    description: string
    amount: number
  }>('SELECT id, payment_id, status, created_by, description, amount FROM retirements WHERE id = ?', [id])
  if (!line) throw notFound('Retirement line')
  const payment = await loadPayment(user, line.paymentId)
  return { line, payment }
}

function assertCanChangeLine(user: SessionUser, line: { status: string; createdBy: number | null }) {
  if (line.status === 'ACCEPTED') throw new AppError('Accepted receipts can no longer be changed.', 409)
  if (user.role === 'investigator' && line.createdBy !== user.id) {
    throw new AppError('You can only change retirement lines you entered.', 403)
  }
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
    if (q.projectId) (where.push('p.id = ?'), params.push(Number(q.projectId)))
    if (q.retirement && RETIREMENT_SQL[q.retirement]) where.push(RETIREMENT_SQL[q.retirement]!)
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
                cl.currency AS claim_currency, ph.phase_no, p.id AS project_id, p.title AS project_title, ${NAME} AS payee,
                ${RETIRED} AS retired, ${RETIRE_PENDING} AS retire_pending
           ${from} ORDER BY pm.paid_at DESC, pm.id DESC LIMIT ? OFFSET ?`,
        [...params, limit, offset],
      ),
      scalar(`SELECT COUNT(*) ${from}`, params),
    ])
    return c.json({
      data: data.map((r) => ({ ...r, retirement: retirementState(r.amount, r.retired, r.retirePending) })),
      total,
      page,
      pageSize,
    })
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
              cl.investigator_id AS claim_investigator_id, cl.phase_id,
              ph.phase_no, ph.title AS phase_title, p.id AS project_id, p.code AS project_code, p.title AS project_title,
              p.currency AS project_currency, f.name AS funder_name,
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
    const [retirements, activities] = await Promise.all([
      rows(
        `SELECT rt.*, a.title AS activity_title, u.full_name AS created_by_name, rv.full_name AS reviewed_by_name
           FROM retirements rt
           JOIN activities a ON a.id = rt.activity_id
           LEFT JOIN users u ON u.id = rt.created_by
           LEFT JOIN users rv ON rv.id = rt.reviewed_by
          WHERE rt.payment_id = ? ORDER BY rt.spent_at, rt.id`,
        [id],
      ),
      rows('SELECT id, title, amount, currency, status FROM activities WHERE phase_id = ? ORDER BY start_date, id', [
        payment.phaseId,
      ]),
    ])
    const sum = (status: string) =>
      round2(retirements.filter((r) => r.status === status).reduce((s, r) => s + r.amount, 0))
    const retired = sum('ACCEPTED')
    const retirePending = sum('SUBMITTED')
    return c.json({
      ...payment,
      retirements: retirements.map((r) => ({ ...r, receipts: r.receipts ?? [] })),
      activities,
      retired,
      retirePending,
      retirementLeft: round2(Math.max(0, payment.amount - retired - retirePending)),
      retirement: retirementState(payment.amount, retired, retirePending),
    })
  })
  .post('/', requirePermission('payments', 'manage'), validate('json', paymentSchema), async (c) => {
    const data = c.req.valid('json')
    const { claim, projectRate } = await checkBalance(data)
    const result = await retryOnDuplicate(async () => {
      const reference = paymentReference()
      return {
        id: await insert('payments', { ...data, projectRate, reference, createdBy: c.get('user').id }),
        reference,
      }
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
    const existing = await one<{ reference: string; currency: string; claimId: number }>(
      'SELECT reference, currency, claim_id FROM payments WHERE id = ?',
      [id],
    )
    if (!existing) throw notFound('Payment')
    const data = c.req.valid('json')
    const { projectRate } = await checkBalance(data, id)
    // Receipts are in the tranche's currency and against its claim's phase.
    const retired = await retiredOn(id)
    if (retired > 0) {
      if (data.currency !== existing.currency || data.claimId !== existing.claimId) {
        throw new AppError('Receipts have been retired against this tranche, so its claim and currency are fixed.', 409)
      }
      if (data.amount < retired - TOLERANCE) {
        throw new AppError(
          `Receipts for ${money(retired, existing.currency)} have been retired against this tranche, so it can't be less than that.`,
          409,
        )
      }
    }
    await update('payments', id, { ...data, projectRate })
    audit(c.get('user'), 'update', 'payment', id, `Updated tranche ${existing.reference}`)
    return c.json({ id })
  })
  .delete('/:id', requirePermission('payments', 'manage'), async (c) => {
    const id = parseId(c.req.param('id'))
    const existing = await one<{ reference: string }>('SELECT reference FROM payments WHERE id = ?', [id])
    if (!existing) throw notFound('Payment')
    if (await scalar('SELECT COUNT(*) FROM retirements WHERE payment_id = ?', [id])) {
      throw new AppError('Receipts have been retired against this tranche. Delete those lines first.', 409)
    }
    await exec('DELETE FROM payments WHERE id = ?', [id])
    audit(c.get('user'), 'delete', 'payment', id, `Deleted tranche ${existing.reference}`)
    return c.json({ ok: true })
  })
  .post(
    '/:id/retirements',
    requirePermission('retirements', 'manage'),
    validate('json', retirementSchema),
    async (c) => {
      const user = c.get('user')
      const payment = await loadPayment(user, parseId(c.req.param('id')))
      const { receipts, ...data } = c.req.valid('json')
      const activity = await checkRetirementLine(payment, { ...data, receipts })
      const id = await insert('retirements', {
        ...data,
        paymentId: payment.id,
        receipts: JSON.stringify(receipts),
        status: 'SUBMITTED',
        createdBy: user.id,
      })
      audit(
        user,
        'create',
        'retirement',
        id,
        `Retired ${money(data.amount, payment.currency)} of tranche ${payment.reference} on "${activity.title}"`,
      )
      return c.json({ id }, 201)
    },
  )

export const retirementsRoute = new Hono()
  .put('/:id', requirePermission('retirements', 'manage'), validate('json', retirementSchema), async (c) => {
    const user = c.get('user')
    const id = parseId(c.req.param('id'))
    const { line, payment } = await loadRetirement(user, id)
    assertCanChangeLine(user, line)
    const { receipts, ...data } = c.req.valid('json')
    await checkRetirementLine(payment, { ...data, receipts }, id)
    // A corrected line goes back for review.
    await update('retirements', id, {
      ...data,
      receipts: JSON.stringify(receipts),
      status: 'SUBMITTED',
      reviewNote: null,
      reviewedBy: null,
      reviewedAt: null,
    })
    audit(user, 'update', 'retirement', id, `Updated retirement line on tranche ${payment.reference}`)
    return c.json({ id })
  })
  .delete('/:id', requirePermission('retirements', 'manage'), async (c) => {
    const user = c.get('user')
    const id = parseId(c.req.param('id'))
    const { line, payment } = await loadRetirement(user, id)
    assertCanChangeLine(user, line)
    await exec('DELETE FROM retirements WHERE id = ?', [id])
    audit(
      user,
      'delete',
      'retirement',
      id,
      `Removed retirement line "${line.description}" on tranche ${payment.reference}`,
    )
    return c.json({ ok: true })
  })
  .patch(
    '/:id/review',
    requirePermission('retirements', 'manage'),
    validate('json', retirementReviewSchema),
    async (c) => {
      const user = c.get('user')
      assertRole(user, RETIREMENT_REVIEW_ROLES, 'review retirements')
      const id = parseId(c.req.param('id'))
      const { line, payment } = await loadRetirement(user, id)
      const data = c.req.valid('json')
      await exec(
        'UPDATE retirements SET status = ?, review_note = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?',
        [data.status, data.reviewNote, user.id, id],
      )
      audit(
        user,
        'update',
        'retirement',
        id,
        `${data.status === 'ACCEPTED' ? 'Accepted' : 'Rejected'} receipts for ${money(line.amount, payment.currency)} on tranche ${payment.reference}`,
      )
      return c.json({ id })
    },
  )
