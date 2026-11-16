// The exchange-rate register. Rates change, so they are kept as dated
// entries (1 base = rate quote from effective_date on) rather than one fixed
// figure. Payment and remittance forms ask /lookup for the rate in effect on
// the transaction date and prefill it; the transaction still stores the rate
// it actually used, so editing the register never changes past records.
//
//   /api/rates          list (latest per pair + history), create or replace
//   /api/rates/lookup   rate between two currencies on a date
//   /api/rates/:id      update, delete
import { Hono } from 'hono'
import { CURRENCIES } from '@dric/db/types'
import { exchangeRateSchema } from '#/lib/schemas'
import { rolesWith } from '#/lib/permissions'
import { requirePermission, requireRoles } from '../lib/auth'
import { audit } from '../lib/audit'
import { exec, insert, one, parseId, rows, update } from '../lib/db'
import { AppError, notFound } from '../lib/errors'
import { validate } from '../lib/validate'

type RateRow = {
  id: number
  baseCurrency: string
  quoteCurrency: string
  rate: number
  effectiveDate: string
  source: string | null
}

const isCurrency = (v: string | undefined): v is string =>
  Boolean(v && (CURRENCIES as ReadonlyArray<string>).includes(v))
const LOOKUP_ROLES = [
  ...new Set([
    ...rolesWith('rates', 'view'),
    ...rolesWith('payments', 'manage'),
    ...rolesWith('remittances', 'manage'),
  ]),
]
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const describe = (r: { baseCurrency: string; quoteCurrency: string; rate: number; effectiveDate: string }) =>
  `1 ${r.baseCurrency} = ${r.rate} ${r.quoteCurrency} from ${r.effectiveDate}`

/**
 * The rate to turn `from` into `to` on `on`: the latest entry dated on or
 * before that day, recorded either way round (an entry for to → from is
 * inverted). Null when the register has nothing for the pair by then.
 */
export async function rateOn(from: string, to: string, on: string) {
  if (from === to) return { rate: 1, effectiveDate: on, source: null, entry: null }
  const entry = await one<RateRow>(
    `SELECT id, base_currency, quote_currency, rate, effective_date, source
       FROM exchange_rates
      WHERE ((base_currency = ? AND quote_currency = ?) OR (base_currency = ? AND quote_currency = ?))
        AND effective_date <= ?
      ORDER BY effective_date DESC, (base_currency = ?) DESC, id DESC
      LIMIT 1`,
    [from, to, to, from, on, from],
  )
  if (!entry) return null
  const rate = entry.baseCurrency === from ? entry.rate : 1 / entry.rate
  return { rate, effectiveDate: entry.effectiveDate, source: entry.source, entry }
}

export const ratesRoute = new Hono()
  .get('/', requirePermission('rates', 'view'), async (c) => {
    const q = c.req.query()
    const where: Array<string> = ['1 = 1']
    const params: Array<unknown> = []
    if (isCurrency(q.currency)) {
      where.push('(r.base_currency = ? OR r.quote_currency = ?)')
      params.push(q.currency, q.currency)
    }
    const [history, latest] = await Promise.all([
      rows(
        `SELECT r.id, r.base_currency, r.quote_currency, r.rate, r.effective_date, r.source, r.updated_at,
                u.full_name AS created_by_name
           FROM exchange_rates r LEFT JOIN users u ON u.id = r.created_by
          WHERE ${where.join(' AND ')}
          ORDER BY r.effective_date DESC, r.id DESC
          LIMIT 500`,
        params,
      ),
      // The entry in effect today for each pair, with the one before it so the
      // page can show which way the rate moved.
      rows(
        `SELECT r.id, r.base_currency, r.quote_currency, r.rate, r.effective_date, r.source,
                (SELECT x.rate FROM exchange_rates x
                  WHERE x.base_currency = r.base_currency AND x.quote_currency = r.quote_currency
                    AND x.effective_date < r.effective_date
                  ORDER BY x.effective_date DESC LIMIT 1) AS previous_rate
           FROM exchange_rates r
          WHERE r.effective_date = (SELECT MAX(y.effective_date) FROM exchange_rates y
                                     WHERE y.base_currency = r.base_currency AND y.quote_currency = r.quote_currency
                                       AND y.effective_date <= CURDATE())
            AND ${where.join(' AND ')}
          ORDER BY r.base_currency, r.quote_currency`,
        params,
      ),
    ])
    return c.json({ latest, history })
  })
  // Anyone who records money gets suggestions, as well as those who can read
  // the register.
  .get('/lookup', requireRoles(LOOKUP_ROLES), async (c) => {
    const { from, to, on } = c.req.query()
    if (!isCurrency(from) || !isCurrency(to)) throw new AppError('Choose two currencies.', 422)
    const day = on && ISO_DATE.test(on) ? on : new Date().toISOString().slice(0, 10)
    const found = await rateOn(from, to, day)
    if (!found) return c.json({ rate: null })
    return c.json({ rate: found.rate, effectiveDate: found.effectiveDate, source: found.source })
  })
  // Saving the same pair and date again replaces that day's rate, so a form
  // can offer "save this rate to the register" without creating duplicates.
  .post('/', requirePermission('rates', 'manage'), validate('json', exchangeRateSchema), async (c) => {
    const data = c.req.valid('json')
    const existing = await one<{ id: number }>(
      'SELECT id FROM exchange_rates WHERE base_currency = ? AND quote_currency = ? AND effective_date = ?',
      [data.baseCurrency, data.quoteCurrency, data.effectiveDate],
    )
    let id: number
    if (existing) {
      id = existing.id
      await update('exchange_rates', id, { rate: data.rate, source: data.source })
      audit(c.get('user'), 'update', 'exchange_rate', id, `Set ${describe(data)}`)
    } else {
      id = await insert('exchange_rates', { ...data, createdBy: c.get('user').id })
      audit(c.get('user'), 'create', 'exchange_rate', id, `Added ${describe(data)}`)
    }
    return c.json({ id }, existing ? 200 : 201)
  })
  .put('/:id', requirePermission('rates', 'manage'), validate('json', exchangeRateSchema), async (c) => {
    const id = parseId(c.req.param('id'))
    const data = c.req.valid('json')
    if (!(await one('SELECT id FROM exchange_rates WHERE id = ?', [id]))) throw notFound('Exchange rate')
    const clash = await one<{ id: number }>(
      'SELECT id FROM exchange_rates WHERE base_currency = ? AND quote_currency = ? AND effective_date = ? AND id <> ?',
      [data.baseCurrency, data.quoteCurrency, data.effectiveDate, id],
    )
    if (clash) {
      throw new AppError(
        `There is already a ${data.baseCurrency} → ${data.quoteCurrency} rate for ${data.effectiveDate}. Edit that one instead.`,
        409,
      )
    }
    await update('exchange_rates', id, data)
    audit(c.get('user'), 'update', 'exchange_rate', id, `Changed to ${describe(data)}`)
    return c.json({ id })
  })
  .delete('/:id', requirePermission('rates', 'manage'), async (c) => {
    const id = parseId(c.req.param('id'))
    const existing = await one<RateRow>(
      'SELECT id, base_currency, quote_currency, rate, effective_date, source FROM exchange_rates WHERE id = ?',
      [id],
    )
    if (!existing) throw notFound('Exchange rate')
    await exec('DELETE FROM exchange_rates WHERE id = ?', [id])
    audit(c.get('user'), 'delete', 'exchange_rate', id, `Removed ${describe(existing)}`)
    return c.json({ ok: true })
  })
