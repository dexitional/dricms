// Options for the searchable dropdowns in the admin forms.
//   GET /api/lookups/countries | funders | investigators | personnel | phases | claims | projects
import { Hono } from 'hono'
import { requireUser } from '../lib/auth'
import { rows } from '../lib/db'
import { projectScope } from '../lib/scope'

let countryCache: Array<{ value: number; label: string; code: string }> | null = null

export const lookupsRoute = new Hono()
  .use('*', requireUser)
  .get('/countries', async (c) => {
    countryCache ??= await rows('SELECT id AS value, name AS label, code FROM countries ORDER BY name')
    return c.json(countryCache)
  })
  .get('/funders', async (c) => c.json(await rows('SELECT id AS value, name AS label FROM funders ORDER BY name')))
  .get('/investigators', async (c) =>
    c.json(
      await rows(
        `SELECT id AS value, TRIM(CONCAT_WS(' ', title, first_name, middle_name, last_name)) AS label,
                CONCAT_WS(' · ', staff_no, department) AS hint
           FROM investigators WHERE is_active = 1 ORDER BY last_name, first_name`,
      ),
    ),
  )
  .get('/personnel', async (c) =>
    c.json(
      await rows(
        `SELECT id AS value, TRIM(CONCAT_WS(' ', title, first_name, middle_name, last_name)) AS label,
                CONCAT_WS(' · ', staff_no, department) AS hint
           FROM personnel WHERE is_active = 1 ORDER BY last_name, first_name`,
      ),
    ),
  )
  .get('/projects', async (c) => {
    const scope = projectScope(c.get('user'))
    return c.json(
      await rows(
        `SELECT p.id AS value, p.title AS label, p.code AS hint FROM projects p WHERE ${scope.sql} ORDER BY p.title`,
        scope.params,
      ),
    )
  })
  // "Phase N: <title> — <project>", for the claim form.
  .get('/phases', async (c) => {
    const scope = projectScope(c.get('user'))
    return c.json(
      await rows(
        `SELECT ph.id AS value, CONCAT('Phase ', ph.phase_no, ': ', ph.title) AS label,
                CONCAT(p.code, ' — ', p.title) AS hint, p.currency, p.pi_id, p.id AS project_id
           FROM phases ph JOIN projects p ON p.id = ph.project_id
          WHERE ${scope.sql} AND p.status IN ('ONGOING','COMPLETED')
          ORDER BY p.title, ph.phase_no`,
        scope.params,
      ),
    )
  })
  // Approved claims still owed money: "<phase> — <project> — <PI>".
  .get('/claims', async (c) =>
    c.json(
      await rows(
        `SELECT cl.id AS value,
                CONCAT(cl.reference, ' · Phase ', ph.phase_no, ': ', ph.title) AS label,
                CONCAT(p.title, ' — ', COALESCE(TRIM(CONCAT_WS(' ', i.title, i.first_name, i.last_name)), 'No PI')) AS hint,
                cl.amount, cl.currency,
                cl.amount - COALESCE((SELECT SUM(pm.amount * pm.conversion_rate) FROM payments pm WHERE pm.claim_id = cl.id), 0) AS balance
           FROM claims cl
           JOIN phases ph ON ph.id = cl.phase_id
           JOIN projects p ON p.id = ph.project_id
           LEFT JOIN investigators i ON i.id = COALESCE(cl.investigator_id, p.pi_id)
          WHERE cl.status = 'APPROVED'
          ORDER BY cl.created_at DESC`,
      ),
    ),
  )
