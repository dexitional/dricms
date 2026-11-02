import { Hono } from 'hono'
import { personnelSchema } from '#/lib/schemas'
import { requirePermission } from '../lib/auth'
import { audit } from '../lib/audit'
import { exec, insert, like, one, paging, parseId, rows, scalar, update } from '../lib/db'
import { notFound } from '../lib/errors'
import { validate } from '../lib/validate'

const NAME = `TRIM(CONCAT_WS(' ', pe.title, pe.first_name, pe.middle_name, pe.last_name))`

export const personnelRoute = new Hono()
  .get('/', requirePermission('personnel', 'view'), async (c) => {
    const q = c.req.query()
    const { page, pageSize, limit, offset } = paging(q)
    const where: Array<string> = ['1 = 1']
    const params: Array<unknown> = []
    if (q.q) {
      where.push(`(${NAME} LIKE ? OR pe.staff_no LIKE ? OR pe.email LIKE ? OR pe.department LIKE ?)`)
      params.push(like(q.q), like(q.q), like(q.q), like(q.q))
    }
    if (q.status === 'active') where.push('pe.is_active = 1')
    if (q.status === 'inactive') where.push('pe.is_active = 0')
    const from = `FROM personnel pe WHERE ${where.join(' AND ')}`
    const [data, total] = await Promise.all([
      rows(
        `SELECT pe.id, pe.title, pe.first_name, pe.middle_name, pe.last_name, pe.staff_no, pe.email, pe.phone,
                pe.department, pe.is_active,
                (SELECT COUNT(*) FROM activity_personnel ap WHERE ap.personnel_id = pe.id) AS activities_count
           ${from} ORDER BY pe.last_name, pe.first_name LIMIT ? OFFSET ?`,
        [...params, limit, offset],
      ),
      scalar(`SELECT COUNT(*) ${from}`, params),
    ])
    return c.json({ data, total, page, pageSize })
  })
  .get('/:id', requirePermission('personnel', 'view'), async (c) => {
    const id = parseId(c.req.param('id'))
    const person = await one('SELECT * FROM personnel WHERE id = ?', [id])
    if (!person) throw notFound('Personnel')
    const activities = await rows(
      `SELECT a.id, a.title, a.status, a.start_date, a.end_date, a.amount, a.currency,
              ph.id AS phase_id, ph.phase_no, ph.title AS phase_title, p.id AS project_id, p.title AS project_title
         FROM activity_personnel ap
         JOIN activities a ON a.id = ap.activity_id
         JOIN phases ph ON ph.id = a.phase_id
         JOIN projects p ON p.id = ph.project_id
        WHERE ap.personnel_id = ? ORDER BY a.start_date DESC, a.id DESC`,
      [id],
    )
    return c.json({ ...person, activities })
  })
  .post('/', requirePermission('personnel', 'manage'), validate('json', personnelSchema), async (c) => {
    const data = c.req.valid('json')
    const id = await insert('personnel', data)
    audit(c.get('user'), 'create', 'personnel', id, `Added personnel ${data.firstName} ${data.lastName}`)
    return c.json({ id }, 201)
  })
  .put('/:id', requirePermission('personnel', 'manage'), validate('json', personnelSchema), async (c) => {
    const id = parseId(c.req.param('id'))
    const data = c.req.valid('json')
    if (!(await update('personnel', id, data))) throw notFound('Personnel')
    audit(c.get('user'), 'update', 'personnel', id, `Updated personnel ${data.firstName} ${data.lastName}`)
    return c.json({ id })
  })
  .delete('/:id', requirePermission('personnel', 'manage'), async (c) => {
    const id = parseId(c.req.param('id'))
    const person = await one<{ firstName: string; lastName: string }>(
      'SELECT first_name, last_name FROM personnel WHERE id = ?',
      [id],
    )
    if (!person) throw notFound('Personnel')
    await exec('DELETE FROM personnel WHERE id = ?', [id])
    audit(c.get('user'), 'delete', 'personnel', id, `Deleted personnel ${person.firstName} ${person.lastName}`)
    return c.json({ ok: true })
  })
