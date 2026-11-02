// Projects and everything under them: phases, activities and the kick-off
// meeting checklist.
//
//   /api/projects                 list, create
//   /api/projects/:id             overview, update, delete
//   /api/projects/:id/phases      create a phase   (+ /next: suggested number & balance b/f)
//   /api/projects/:id/kickoff     kick-off meeting checklist
//   /api/phases/:id               phase overview, update, delete
//   /api/phases/:id/activities    create an activity
//   /api/activities/:id           update, delete
import { Hono } from 'hono'
import type { PoolConnection } from 'mysql2/promise'
import type { SessionUser } from '#/server/session-core'
import { KICKOFF_ITEMS } from '#/lib/forms'
import { activitySchema, kickoffSchema, phaseSchema, projectSchema } from '#/lib/schemas'
import { requirePermission } from '../lib/auth'
import { audit } from '../lib/audit'
import { exec, insert, like, one, paging, parseId, rows, scalar, update, withTransaction } from '../lib/db'
import { notFound } from '../lib/errors'
import { retryOnDuplicate } from '../lib/refs'
import { cleanHtml } from '../lib/rich-text'
import { projectScope } from '../lib/scope'
import { validate } from '../lib/validate'

const PI_NAME = `TRIM(CONCAT_WS(' ', i.title, i.first_name, i.middle_name, i.last_name))`

/** 404s unless the project exists and the user may see it. */
export async function assertProjectAccess(user: SessionUser, projectId: number) {
  const scope = projectScope(user)
  const project = await one<{ id: number; title: string; currency: string }>(
    `SELECT p.id, p.title, p.currency FROM projects p WHERE p.id = ? AND ${scope.sql}`,
    [projectId, ...scope.params],
  )
  if (!project) throw notFound('Project')
  return project
}

async function phaseProject(user: SessionUser, phaseId: number) {
  const phase = await one<{ id: number; projectId: number; title: string; phaseNo: number }>(
    'SELECT id, project_id, title, phase_no FROM phases WHERE id = ?',
    [phaseId],
  )
  if (!phase) throw notFound('Phase')
  const project = await assertProjectAccess(user, phase.projectId)
  return { phase, project }
}

async function nextProjectCode(year: number) {
  const max = await scalar<number | null>(
    `SELECT MAX(CAST(SUBSTRING_INDEX(code, '-', -1) AS UNSIGNED)) FROM projects WHERE code LIKE ?`,
    [`DRIC-${year}-%`],
  )
  return `DRIC-${year}-${String((max ?? 0) + 1).padStart(3, '0')}`
}

async function setCoInvestigators(conn: PoolConnection, projectId: number, ids: Array<number>) {
  await exec('DELETE FROM project_co_investigators WHERE project_id = ?', [projectId], conn)
  if (ids.length) {
    await exec(
      'INSERT INTO project_co_investigators (project_id, investigator_id) VALUES ?',
      [[...new Set(ids)].map((id) => [projectId, id])],
      conn,
    )
  }
}

async function setActivityPersonnel(conn: PoolConnection, activityId: number, ids: Array<number>) {
  await exec('DELETE FROM activity_personnel WHERE activity_id = ?', [activityId], conn)
  if (ids.length) {
    await exec(
      'INSERT INTO activity_personnel (activity_id, personnel_id) VALUES ?',
      [[...new Set(ids)].map((id) => [activityId, id])],
      conn,
    )
  }
}

export const projectsRoute = new Hono()
  .get('/', requirePermission('projects', 'view'), async (c) => {
    const q = c.req.query()
    const { page, pageSize, limit, offset } = paging(q)
    const scope = projectScope(c.get('user'))
    const where: Array<string> = [scope.sql]
    const params: Array<unknown> = [...scope.params]
    if (q.q) {
      where.push(`(p.title LIKE ? OR p.code LIKE ? OR f.name LIKE ? OR ${PI_NAME} LIKE ?)`)
      params.push(like(q.q), like(q.q), like(q.q), like(q.q))
    }
    if (q.status) (where.push('p.status = ?'), params.push(q.status))
    if (q.type) (where.push('p.type = ?'), params.push(q.type))
    if (q.funderId) (where.push('p.funder_id = ?'), params.push(Number(q.funderId)))
    const from = `FROM projects p
      LEFT JOIN funders f ON f.id = p.funder_id
      LEFT JOIN investigators i ON i.id = p.pi_id
      WHERE ${where.join(' AND ')}`
    const [data, total] = await Promise.all([
      rows(
        `SELECT p.id, p.code, p.title, p.type, p.status, p.total_funding, p.currency, p.start_date, p.end_date,
                f.name AS funder_name, f.logo_url AS funder_logo, ${PI_NAME} AS pi_name,
                (SELECT COUNT(*) FROM phases ph WHERE ph.project_id = p.id) AS phases_count
           ${from} ORDER BY p.created_at DESC LIMIT ? OFFSET ?`,
        [...params, limit, offset],
      ),
      scalar(`SELECT COUNT(*) ${from}`, params),
    ])
    return c.json({ data, total, page, pageSize })
  })
  .get('/:id', requirePermission('projects', 'view'), async (c) => {
    const id = parseId(c.req.param('id'))
    await assertProjectAccess(c.get('user'), id)
    const project = await one(
      `SELECT p.*, co.name AS country, f.name AS funder_name, f.logo_url AS funder_logo, f.email AS funder_email,
              ${PI_NAME} AS pi_name, i.email AS pi_email, i.phone AS pi_phone, i.department AS pi_department,
              EXISTS (SELECT 1 FROM kickoff_checklists k WHERE k.project_id = p.id) AS has_kickoff
         FROM projects p
         LEFT JOIN countries co ON co.id = p.country_id
         LEFT JOIN funders f ON f.id = p.funder_id
         LEFT JOIN investigators i ON i.id = p.pi_id
        WHERE p.id = ?`,
      [id],
    )
    if (!project) throw notFound('Project')
    const [coInvestigators, phases, claims, payments, requests] = await Promise.all([
      rows(
        `SELECT i.id, ${PI_NAME} AS name, i.email, i.department, i.staff_no
           FROM project_co_investigators pci JOIN investigators i ON i.id = pci.investigator_id
          WHERE pci.project_id = ? ORDER BY i.last_name`,
        [id],
      ),
      rows(
        `SELECT ph.id, ph.phase_no, ph.title, ph.balance_bf, ph.budget, ph.spent, ph.start_date, ph.end_date,
                ph.report IS NOT NULL AS has_report,
                (SELECT COUNT(*) FROM activities a WHERE a.phase_id = ph.id) AS activities_count,
                (SELECT COUNT(*) FROM activities a WHERE a.phase_id = ph.id AND a.status = 'COMPLETED') AS activities_done
           FROM phases ph WHERE ph.project_id = ? ORDER BY ph.phase_no, ph.id`,
        [id],
      ),
      rows(
        `SELECT cl.id, cl.reference, cl.purpose, cl.amount, cl.currency, cl.status, cl.created_at,
                ph.phase_no, ph.title AS phase_title,
                COALESCE((SELECT SUM(pm.amount * pm.conversion_rate) FROM payments pm WHERE pm.claim_id = cl.id), 0) AS paid
           FROM claims cl JOIN phases ph ON ph.id = cl.phase_id
          WHERE ph.project_id = ? ORDER BY cl.created_at DESC`,
        [id],
      ),
      rows(
        `SELECT pm.id, pm.reference, pm.amount, pm.currency, pm.conversion_rate, pm.paid_at, cl.reference AS claim_reference,
                cl.currency AS claim_currency
           FROM payments pm JOIN claims cl ON cl.id = pm.claim_id JOIN phases ph ON ph.id = cl.phase_id
          WHERE ph.project_id = ? ORDER BY pm.paid_at DESC`,
        [id],
      ),
      rows(
        'SELECT id, reference, type, status, created_at FROM requests WHERE project_id = ? ORDER BY created_at DESC',
        [id],
      ),
    ])
    return c.json({
      ...project,
      hasKickoff: Boolean(project.hasKickoff),
      coInvestigators,
      phases,
      claims,
      payments,
      requests,
    })
  })
  .post('/', requirePermission('projects', 'manage'), validate('json', projectSchema), async (c) => {
    const { coInvestigatorIds, ...data } = c.req.valid('json')
    const year = Number((data.awardedAt ?? data.startDate ?? '').slice(0, 4)) || new Date().getFullYear()
    // Two clerks saving at once can race for the same code; retry on collision.
    const id = await retryOnDuplicate(() =>
      withTransaction(async (conn) => {
        const code = await nextProjectCode(year)
        const projectId = await insert(
          'projects',
          { ...data, code, finalReport: cleanHtml(data.finalReport), createdBy: c.get('user').id },
          conn,
        )
        await setCoInvestigators(conn, projectId, coInvestigatorIds)
        return projectId
      }),
    )
    audit(c.get('user'), 'create', 'project', id, `Created project ${data.title}`)
    return c.json({ id }, 201)
  })
  .put('/:id', requirePermission('projects', 'manage'), validate('json', projectSchema), async (c) => {
    const id = parseId(c.req.param('id'))
    const { coInvestigatorIds, ...data } = c.req.valid('json')
    await withTransaction(async (conn) => {
      if (!(await update('projects', id, { ...data, finalReport: cleanHtml(data.finalReport) }, conn))) {
        throw notFound('Project')
      }
      await setCoInvestigators(conn, id, coInvestigatorIds)
    })
    audit(c.get('user'), 'update', 'project', id, `Updated project ${data.title}`)
    return c.json({ id })
  })
  .delete('/:id', requirePermission('projects', 'manage'), async (c) => {
    const id = parseId(c.req.param('id'))
    const project = await one<{ title: string }>('SELECT title FROM projects WHERE id = ?', [id])
    if (!project) throw notFound('Project')
    // Payments restrict claim deletion, so a project with money paid out
    // can't be deleted (the error handler answers 409).
    await exec('DELETE FROM projects WHERE id = ?', [id])
    audit(c.get('user'), 'delete', 'project', id, `Deleted project ${project.title}`)
    return c.json({ ok: true })
  })

  // ----------------------------------------------------------- Phases
  .get('/:id/phases/next', requirePermission('projects', 'manage'), async (c) => {
    const id = parseId(c.req.param('id'))
    const last = await one<{ phaseNo: number; balanceBf: number; budget: number; spent: number }>(
      'SELECT phase_no, balance_bf, budget, spent FROM phases WHERE project_id = ? ORDER BY phase_no DESC LIMIT 1',
      [id],
    )
    return c.json({
      phaseNo: (last?.phaseNo ?? 0) + 1,
      // Whatever was not spent last phase is carried forward.
      balanceBf: last ? Math.round((last.balanceBf + last.budget - last.spent) * 100) / 100 : 0,
    })
  })
  .post('/:id/phases', requirePermission('projects', 'manage'), validate('json', phaseSchema), async (c) => {
    const projectId = parseId(c.req.param('id'))
    await assertProjectAccess(c.get('user'), projectId)
    const data = c.req.valid('json')
    const id = await insert('phases', { ...data, projectId, report: cleanHtml(data.report) })
    audit(c.get('user'), 'create', 'phase', id, `Added phase ${data.phaseNo}: ${data.title}`)
    return c.json({ id }, 201)
  })

  // ----------------------------------------------------------- Kick-off checklist
  .get('/:id/kickoff', requirePermission('projects', 'view'), async (c) => {
    const id = parseId(c.req.param('id'))
    await assertProjectAccess(c.get('user'), id)
    const project = await one(
      `SELECT p.id, p.code, p.title, p.type, p.start_date, p.end_date, p.total_funding, p.currency,
              f.name AS funder_name, ${PI_NAME} AS pi_name
         FROM projects p LEFT JOIN funders f ON f.id = p.funder_id LEFT JOIN investigators i ON i.id = p.pi_id
        WHERE p.id = ?`,
      [id],
    )
    const checklist = await one(
      `SELECT k.*, u.full_name AS updated_by_name FROM kickoff_checklists k LEFT JOIN users u ON u.id = k.updated_by
        WHERE k.project_id = ?`,
      [id],
    )
    return c.json({
      project,
      checklist: checklist ?? {
        meetingDate: null,
        venue: null,
        attendees: null,
        notes: null,
        items: KICKOFF_ITEMS.map((item) => ({ no: item.no, tick: null, note: null })),
      },
      saved: Boolean(checklist),
    })
  })
  .put('/:id/kickoff', requirePermission('projects', 'manage'), validate('json', kickoffSchema), async (c) => {
    const id = parseId(c.req.param('id'))
    const project = await assertProjectAccess(c.get('user'), id)
    const data = c.req.valid('json')
    await exec(
      `INSERT INTO kickoff_checklists (project_id, meeting_date, venue, attendees, items, notes, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE meeting_date = VALUES(meeting_date), venue = VALUES(venue), attendees = VALUES(attendees),
         items = VALUES(items), notes = VALUES(notes), updated_by = VALUES(updated_by)`,
      [id, data.meetingDate, data.venue, data.attendees, JSON.stringify(data.items), data.notes, c.get('user').id],
    )
    audit(c.get('user'), 'update', 'project', id, `Saved kick-off checklist for ${project.title}`)
    return c.json({ ok: true })
  })

export const phasesRoute = new Hono()
  .get('/:id', requirePermission('projects', 'view'), async (c) => {
    const id = parseId(c.req.param('id'))
    await phaseProject(c.get('user'), id)
    const phase = await one(
      `SELECT ph.*, p.title AS project_title, p.code AS project_code, p.currency, p.status AS project_status
         FROM phases ph JOIN projects p ON p.id = ph.project_id WHERE ph.id = ?`,
      [id],
    )
    const [activities, claims, siblings] = await Promise.all([
      rows(
        `SELECT a.*,
                (SELECT JSON_ARRAYAGG(JSON_OBJECT('id', pe.id, 'name', TRIM(CONCAT_WS(' ', pe.title, pe.first_name, pe.last_name))))
                   FROM activity_personnel ap JOIN personnel pe ON pe.id = ap.personnel_id WHERE ap.activity_id = a.id) AS personnel
           FROM activities a WHERE a.phase_id = ? ORDER BY a.start_date IS NULL, a.start_date, a.id`,
        [id],
      ),
      rows(
        `SELECT cl.id, cl.reference, cl.purpose, cl.amount, cl.currency, cl.status, cl.created_at,
                COALESCE((SELECT SUM(pm.amount * pm.conversion_rate) FROM payments pm WHERE pm.claim_id = cl.id), 0) AS paid
           FROM claims cl WHERE cl.phase_id = ? ORDER BY cl.created_at DESC`,
        [id],
      ),
      rows('SELECT id, phase_no, title FROM phases WHERE project_id = ? ORDER BY phase_no', [phase!.projectId]),
    ])
    return c.json({
      ...phase,
      activities: activities.map((a) => ({ ...a, personnel: a.personnel ?? [] })),
      claims,
      siblings,
    })
  })
  .put('/:id', requirePermission('projects', 'manage'), validate('json', phaseSchema), async (c) => {
    const id = parseId(c.req.param('id'))
    await phaseProject(c.get('user'), id)
    const data = c.req.valid('json')
    await update('phases', id, { ...data, report: cleanHtml(data.report) })
    audit(c.get('user'), 'update', 'phase', id, `Updated phase ${data.phaseNo}: ${data.title}`)
    return c.json({ id })
  })
  .delete('/:id', requirePermission('projects', 'manage'), async (c) => {
    const id = parseId(c.req.param('id'))
    const { phase } = await phaseProject(c.get('user'), id)
    await exec('DELETE FROM phases WHERE id = ?', [id])
    audit(c.get('user'), 'delete', 'phase', id, `Deleted phase ${phase.phaseNo}: ${phase.title}`)
    return c.json({ ok: true })
  })
  .post('/:id/activities', requirePermission('activities', 'manage'), validate('json', activitySchema), async (c) => {
    const phaseId = parseId(c.req.param('id'))
    await phaseProject(c.get('user'), phaseId)
    const { personnelIds, ...data } = c.req.valid('json')
    const id = await withTransaction(async (conn) => {
      const activityId = await insert('activities', { ...data, phaseId }, conn)
      await setActivityPersonnel(conn, activityId, personnelIds)
      return activityId
    })
    audit(c.get('user'), 'create', 'activity', id, `Added activity ${data.title}`)
    return c.json({ id }, 201)
  })

export const activitiesRoute = new Hono()
  .put('/:id', requirePermission('activities', 'manage'), validate('json', activitySchema), async (c) => {
    const id = parseId(c.req.param('id'))
    const activity = await one<{ phaseId: number }>('SELECT phase_id FROM activities WHERE id = ?', [id])
    if (!activity) throw notFound('Activity')
    await phaseProject(c.get('user'), activity.phaseId)
    const { personnelIds, ...data } = c.req.valid('json')
    await withTransaction(async (conn) => {
      await update('activities', id, data, conn)
      await setActivityPersonnel(conn, id, personnelIds)
    })
    audit(c.get('user'), 'update', 'activity', id, `Updated activity ${data.title}`)
    return c.json({ id })
  })
  .delete('/:id', requirePermission('activities', 'manage'), async (c) => {
    const id = parseId(c.req.param('id'))
    const activity = await one<{ phaseId: number; title: string }>(
      'SELECT phase_id, title FROM activities WHERE id = ?',
      [id],
    )
    if (!activity) throw notFound('Activity')
    await phaseProject(c.get('user'), activity.phaseId)
    await exec('DELETE FROM activities WHERE id = ?', [id])
    audit(c.get('user'), 'delete', 'activity', id, `Deleted activity ${activity.title}`)
    return c.json({ ok: true })
  })
