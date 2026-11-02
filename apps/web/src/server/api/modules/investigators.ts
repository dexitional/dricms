import bcrypt from 'bcryptjs'
import { Hono } from 'hono'
import { investigatorAccountSchema, investigatorSchema } from '#/lib/schemas'
import { requirePermission } from '../lib/auth'
import { audit } from '../lib/audit'
import { exec, insert, like, one, paging, parseId, rows, scalar, update } from '../lib/db'
import { AppError, notFound } from '../lib/errors'
import { validate } from '../lib/validate'

const NAME = `TRIM(CONCAT_WS(' ', i.title, i.first_name, i.middle_name, i.last_name))`

export const investigatorsRoute = new Hono()
  .get('/', requirePermission('investigators', 'view'), async (c) => {
    const q = c.req.query()
    const { page, pageSize, limit, offset } = paging(q)
    const where: Array<string> = ['1 = 1']
    const params: Array<unknown> = []
    if (q.q) {
      where.push(`(${NAME} LIKE ? OR i.staff_no LIKE ? OR i.email LIKE ? OR i.department LIKE ?)`)
      params.push(like(q.q), like(q.q), like(q.q), like(q.q))
    }
    if (q.status === 'active') where.push('i.is_active = 1')
    if (q.status === 'inactive') where.push('i.is_active = 0')
    const from = `FROM investigators i WHERE ${where.join(' AND ')}`
    const [data, total] = await Promise.all([
      rows(
        `SELECT i.id, i.title, i.first_name, i.middle_name, i.last_name, i.staff_no, i.email, i.phone, i.department,
                i.is_active,
                (SELECT COUNT(*) FROM projects p WHERE p.pi_id = i.id) AS pi_count,
                (SELECT COUNT(*) FROM project_co_investigators pci WHERE pci.investigator_id = i.id) AS co_count,
                EXISTS (SELECT 1 FROM users u WHERE u.investigator_id = i.id) AS has_account
           ${from} ORDER BY i.last_name, i.first_name LIMIT ? OFFSET ?`,
        [...params, limit, offset],
      ),
      scalar(`SELECT COUNT(*) ${from}`, params),
    ])
    return c.json({ data, total, page, pageSize })
  })
  .get('/:id', requirePermission('investigators', 'view'), async (c) => {
    const id = parseId(c.req.param('id'))
    const investigator = await one('SELECT * FROM investigators WHERE id = ?', [id])
    if (!investigator) throw notFound('Investigator')
    const [projects, account, claims] = await Promise.all([
      rows(
        `SELECT p.id, p.code, p.title, p.status, p.total_funding, p.currency, p.start_date, p.end_date,
                IF(p.pi_id = ?, 'PI', 'Co-I') AS role
           FROM projects p
          WHERE p.pi_id = ? OR EXISTS (SELECT 1 FROM project_co_investigators pci WHERE pci.project_id = p.id AND pci.investigator_id = ?)
          ORDER BY p.start_date DESC, p.id DESC`,
        [id, id, id],
      ),
      one('SELECT id, email, is_active, last_login_at FROM users WHERE investigator_id = ?', [id]),
      rows(
        `SELECT cl.id, cl.reference, cl.purpose, cl.amount, cl.currency, cl.status, cl.created_at, p.title AS project_title
           FROM claims cl JOIN phases ph ON ph.id = cl.phase_id JOIN projects p ON p.id = ph.project_id
          WHERE cl.investigator_id = ? ORDER BY cl.created_at DESC LIMIT 10`,
        [id],
      ),
    ])
    return c.json({ ...investigator, projects, account, claims })
  })
  .post('/', requirePermission('investigators', 'manage'), validate('json', investigatorSchema), async (c) => {
    const data = c.req.valid('json')
    const id = await insert('investigators', data)
    audit(c.get('user'), 'create', 'investigator', id, `Added investigator ${data.firstName} ${data.lastName}`)
    return c.json({ id }, 201)
  })
  .put('/:id', requirePermission('investigators', 'manage'), validate('json', investigatorSchema), async (c) => {
    const id = parseId(c.req.param('id'))
    const data = c.req.valid('json')
    if (!(await update('investigators', id, data))) throw notFound('Investigator')
    // Keep the linked sign-in account's name and active flag in step.
    await exec(`UPDATE users SET full_name = ?, is_active = IF(?, is_active, 0) WHERE investigator_id = ?`, [
      [data.title, data.firstName, data.lastName].filter(Boolean).join(' '),
      data.isActive,
      id,
    ])
    audit(c.get('user'), 'update', 'investigator', id, `Updated investigator ${data.firstName} ${data.lastName}`)
    return c.json({ id })
  })
  // Creates (or resets the password of) the investigator's sign-in account,
  // using the email on their record.
  .post(
    '/:id/account',
    requirePermission('investigators', 'manage'),
    validate('json', investigatorAccountSchema),
    async (c) => {
      const id = parseId(c.req.param('id'))
      const inv = await one<{ title: string | null; firstName: string; lastName: string; email: string | null }>(
        'SELECT title, first_name, last_name, email FROM investigators WHERE id = ?',
        [id],
      )
      if (!inv) throw notFound('Investigator')
      if (!inv.email) throw new AppError('Add an email address to this investigator first.', 422)
      const hash = await bcrypt.hash(c.req.valid('json').password, 12)
      const existing = await one<{ id: number }>('SELECT id FROM users WHERE investigator_id = ?', [id])
      if (existing) {
        await exec(
          'UPDATE users SET password_hash = ?, email = ?, is_active = 1, failed_login_attempts = 0, locked_until = NULL WHERE id = ?',
          [hash, inv.email, existing.id],
        )
      } else {
        const clash = await one('SELECT id FROM users WHERE email = ?', [inv.email])
        if (clash) throw new AppError('Another account already uses this email address.', 409)
        await insert('users', {
          fullName: [inv.title, inv.firstName, inv.lastName].filter(Boolean).join(' '),
          email: inv.email,
          role: 'investigator',
          passwordHash: hash,
          investigatorId: id,
        })
      }
      audit(
        c.get('user'),
        existing ? 'update' : 'create',
        'user',
        id,
        `${existing ? 'Reset' : 'Created'} portal account for ${inv.firstName} ${inv.lastName}`,
      )
      return c.json({ ok: true })
    },
  )
  .delete('/:id', requirePermission('investigators', 'manage'), async (c) => {
    const id = parseId(c.req.param('id'))
    const inv = await one<{ firstName: string; lastName: string }>(
      'SELECT first_name, last_name FROM investigators WHERE id = ?',
      [id],
    )
    if (!inv) throw notFound('Investigator')
    const leads = await scalar<number>('SELECT COUNT(*) FROM projects WHERE pi_id = ?', [id])
    if (leads)
      throw new AppError('This investigator leads projects. Reassign them, or mark the investigator inactive.', 409)
    await exec('DELETE FROM users WHERE investigator_id = ?', [id])
    await exec('DELETE FROM investigators WHERE id = ?', [id])
    audit(c.get('user'), 'delete', 'investigator', id, `Deleted investigator ${inv.firstName} ${inv.lastName}`)
    return c.json({ ok: true })
  })
