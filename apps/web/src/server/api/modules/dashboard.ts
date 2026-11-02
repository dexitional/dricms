// GET /api/dashboard — staff overview, or an investigator's own portfolio.
import { Hono } from 'hono'
import type { SessionUser } from '#/server/session-core'
import { requirePermission } from '../lib/auth'
import { one, rows, scalar } from '../lib/db'
import { projectScope } from '../lib/scope'

const NAME = `TRIM(CONCAT_WS(' ', i.title, i.first_name, i.last_name))`
const PAID = 'COALESCE((SELECT SUM(pm.amount * pm.conversion_rate) FROM payments pm WHERE pm.claim_id = cl.id), 0)'

/** The currency most of the money is in — charts can't mix currencies. */
async function mainCurrency(sql: string, params: Array<unknown> = []) {
  return (await scalar<string | null>(sql, params)) ?? 'USD'
}

async function staffDashboard() {
  const fundingCurrency = await mainCurrency(
    'SELECT currency FROM projects GROUP BY currency ORDER BY COUNT(*) DESC, SUM(total_funding) DESC LIMIT 1',
  )
  const claimCurrency = await mainCurrency(
    'SELECT currency FROM claims GROUP BY currency ORDER BY COUNT(*) DESC, SUM(amount) DESC LIMIT 1',
  )
  const [
    kpis,
    fundingByCurrency,
    byFunder,
    byStatus,
    byType,
    claimsByStatus,
    paymentsByMonth,
    requestsByType,
    endingSoon,
    recentClaims,
    recentRequests,
    activity,
    topProjects,
  ] = await Promise.all([
    one(
      `SELECT (SELECT COUNT(*) FROM projects) AS projects,
                (SELECT COUNT(*) FROM projects WHERE status = 'ONGOING') AS ongoing,
                (SELECT COUNT(*) FROM funders) AS funders,
                (SELECT COUNT(*) FROM investigators WHERE is_active = 1) AS investigators,
                (SELECT COUNT(*) FROM personnel WHERE is_active = 1) AS personnel,
                (SELECT COUNT(*) FROM claims WHERE status IN ('PENDING','PROCESSING')) AS open_claims,
                (SELECT COUNT(*) FROM requests WHERE status IN ('SUBMITTED','RECEIVED','UNDER_REVIEW')) AS open_requests,
                (SELECT COALESCE(SUM(total_funding), 0) FROM projects WHERE currency = ?) AS funding,
                (SELECT COALESCE(SUM(cl.amount), 0) FROM claims cl WHERE cl.status = 'APPROVED' AND cl.currency = ?) AS approved_claims,
                (SELECT COALESCE(SUM(pm.amount * pm.conversion_rate), 0) FROM payments pm JOIN claims cl ON cl.id = pm.claim_id WHERE cl.currency = ?) AS disbursed,
                (SELECT COALESCE(SUM(pm.amount * pm.conversion_rate), 0) FROM payments pm JOIN claims cl ON cl.id = pm.claim_id
                  WHERE cl.currency = ? AND YEAR(pm.paid_at) = YEAR(CURDATE())) AS disbursed_this_year`,
      [fundingCurrency, claimCurrency, claimCurrency, claimCurrency],
    ),
    rows(
      'SELECT currency, SUM(total_funding) AS total, COUNT(*) AS count FROM projects GROUP BY currency ORDER BY total DESC',
    ),
    rows(
      `SELECT COALESCE(f.name, 'Unassigned') AS name, SUM(p.total_funding) AS total, COUNT(*) AS count
           FROM projects p LEFT JOIN funders f ON f.id = p.funder_id
          WHERE p.currency = ? GROUP BY f.id, f.name ORDER BY total DESC LIMIT 8`,
      [fundingCurrency],
    ),
    rows('SELECT status, COUNT(*) AS count FROM projects GROUP BY status'),
    rows('SELECT type, COUNT(*) AS count, SUM(total_funding) AS total FROM projects GROUP BY type'),
    rows(`SELECT status, COUNT(*) AS count, SUM(amount) AS total FROM claims WHERE currency = ? GROUP BY status`, [
      claimCurrency,
    ]),
    rows(
      `SELECT DATE_FORMAT(pm.paid_at, '%Y-%m') AS month, SUM(pm.amount * pm.conversion_rate) AS total, COUNT(*) AS count
           FROM payments pm JOIN claims cl ON cl.id = pm.claim_id
          WHERE cl.currency = ? AND pm.paid_at >= DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 11 MONTH)
          GROUP BY month ORDER BY month`,
      [claimCurrency],
    ),
    rows('SELECT type, COUNT(*) AS count FROM requests GROUP BY type'),
    rows(
      `SELECT p.id, p.code, p.title, p.end_date, DATEDIFF(p.end_date, CURDATE()) AS days_left, ${NAME} AS pi_name
           FROM projects p LEFT JOIN investigators i ON i.id = p.pi_id
          WHERE p.status = 'ONGOING' AND p.end_date IS NOT NULL AND p.end_date <= DATE_ADD(CURDATE(), INTERVAL 120 DAY)
          ORDER BY p.end_date LIMIT 6`,
    ),
    rows(
      `SELECT cl.id, cl.reference, cl.purpose, cl.amount, cl.currency, cl.status, cl.created_at, p.title AS project_title, ${NAME} AS requester
           FROM claims cl JOIN phases ph ON ph.id = cl.phase_id JOIN projects p ON p.id = ph.project_id
           LEFT JOIN investigators i ON i.id = cl.investigator_id
          ORDER BY cl.created_at DESC LIMIT 6`,
    ),
    rows(
      `SELECT id, reference, type, status, project_title, first_name, surname, created_at
           FROM requests ORDER BY created_at DESC LIMIT 6`,
    ),
    rows(
      `SELECT a.id, a.action, a.entity, a.entity_id, a.summary, a.created_at, u.full_name AS user_name
           FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.id DESC LIMIT 8`,
    ),
    rows(
      `SELECT p.id, p.code, p.title, p.total_funding, p.currency,
                COALESCE((SELECT SUM(ph.spent) FROM phases ph WHERE ph.project_id = p.id), 0) AS spent,
                COALESCE((SELECT SUM(ph.budget) FROM phases ph WHERE ph.project_id = p.id), 0) AS budgeted
           FROM projects p WHERE p.status = 'ONGOING' AND p.currency = ?
          ORDER BY p.total_funding DESC LIMIT 5`,
      [fundingCurrency],
    ),
  ])
  return {
    kind: 'staff' as const,
    fundingCurrency,
    claimCurrency,
    kpis,
    fundingByCurrency,
    byFunder,
    byStatus,
    byType,
    claimsByStatus,
    paymentsByMonth,
    requestsByType,
    endingSoon,
    recentClaims,
    recentRequests,
    activity,
    topProjects,
  }
}

async function investigatorDashboard(user: SessionUser) {
  const scope = projectScope(user)
  const inv = user.investigatorId ?? 0
  const [projects, claims, payments, totals, requests] = await Promise.all([
    rows(
      `SELECT p.id, p.code, p.title, p.status, p.total_funding, p.currency, p.start_date, p.end_date,
              IF(p.pi_id = ?, 'PI', 'Co-I') AS role, f.name AS funder_name,
              (SELECT COUNT(*) FROM phases ph WHERE ph.project_id = p.id) AS phases_count,
              COALESCE((SELECT SUM(ph.spent) FROM phases ph WHERE ph.project_id = p.id), 0) AS spent,
              COALESCE((SELECT SUM(ph.budget) FROM phases ph WHERE ph.project_id = p.id), 0) AS budgeted
         FROM projects p LEFT JOIN funders f ON f.id = p.funder_id
        WHERE ${scope.sql} ORDER BY p.status = 'ONGOING' DESC, p.end_date`,
      [inv, ...scope.params],
    ),
    rows(
      `SELECT cl.id, cl.reference, cl.purpose, cl.amount, cl.currency, cl.status, cl.created_at, p.title AS project_title,
              ph.phase_no, ${PAID} AS paid
         FROM claims cl JOIN phases ph ON ph.id = cl.phase_id JOIN projects p ON p.id = ph.project_id
        WHERE cl.investigator_id = ? ORDER BY cl.created_at DESC LIMIT 8`,
      [inv],
    ),
    rows(
      `SELECT pm.id, pm.reference, pm.amount, pm.currency, pm.paid_at, cl.reference AS claim_reference, p.title AS project_title
         FROM payments pm JOIN claims cl ON cl.id = pm.claim_id JOIN phases ph ON ph.id = cl.phase_id JOIN projects p ON p.id = ph.project_id
        WHERE cl.investigator_id = ? ORDER BY pm.paid_at DESC LIMIT 8`,
      [inv],
    ),
    rows(
      `SELECT cl.currency, cl.status, COUNT(*) AS count, SUM(cl.amount) AS requested, SUM(${PAID}) AS paid
         FROM claims cl WHERE cl.investigator_id = ? GROUP BY cl.currency, cl.status`,
      [inv],
    ),
    rows(
      `SELECT id, reference, type, status, project_title, created_at FROM requests
        WHERE investigator_id = ? OR email = ? ORDER BY created_at DESC LIMIT 6`,
      [inv, user.email],
    ),
  ])
  return { kind: 'investigator' as const, projects, claims, payments, totals, requests }
}

export const dashboardRoute = new Hono().get('/', requirePermission('dashboard', 'view'), async (c) => {
  const user = c.get('user')
  return c.json(user.role === 'investigator' ? await investigatorDashboard(user) : await staffDashboard())
})
