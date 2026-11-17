// A project's balance sheet, kept in the project's currency: funder
// remittances come in, tranche payments (against approved claims) go out.
// Each tranche is then retired with receipts; only accepted receipts count as
// retired. Everything is computed from the rows on every call, so the
// balance is always current.
import { one, rows } from './db'
import { notFound } from './errors'

const round2 = (n: number) => Math.round(n * 100) / 100
const PAYEE = `TRIM(CONCAT_WS(' ', i.title, i.first_name, i.last_name))`

/** Accepted / submitted retirement totals for a tranche aliased `pm`, in its own currency. */
export const RETIRED = `COALESCE((SELECT SUM(rt.amount) FROM retirements rt WHERE rt.payment_id = pm.id AND rt.status = 'ACCEPTED'), 0)`
export const RETIRE_PENDING = `COALESCE((SELECT SUM(rt.amount) FROM retirements rt WHERE rt.payment_id = pm.id AND rt.status = 'SUBMITTED'), 0)`

/** Money in and out of the project aliased `p`, in its currency — for list columns. */
export const PROJECT_RECEIVED = `COALESCE((SELECT SUM(r.amount * r.exchange_rate) FROM remittances r WHERE r.project_id = p.id), 0)`
export const PROJECT_DISBURSED = `COALESCE((SELECT SUM(pm.amount * pm.project_rate) FROM payments pm
  JOIN claims cl ON cl.id = pm.claim_id JOIN phases ph ON ph.id = cl.phase_id WHERE ph.project_id = p.id), 0)`

export type RetirementState = 'UNRETIRED' | 'PARTIAL' | 'RETIRED'

/** Fully retired once accepted receipts cover the tranche (to the cent). */
export function retirementState(amount: number, retired: number, pending: number): RetirementState {
  if (retired >= amount - 0.01) return 'RETIRED'
  return retired + pending > 0 ? 'PARTIAL' : 'UNRETIRED'
}

export interface LedgerEntry {
  kind: 'remittance' | 'payment'
  id: number
  date: string
  reference: string
  description: string
  amount: number
  currency: string
  rate: number | null
  credit: number
  debit: number
  balance: number
  [key: string]: unknown
}

export async function projectLedger(projectId: number) {
  const project = await one<{
    id: number
    code: string
    title: string
    currency: string
    totalFunding: number
    funderId: number | null
    funderName: string | null
  }>(
    `SELECT p.id, p.code, p.title, p.currency, p.total_funding, p.funder_id, f.name AS funder_name
       FROM projects p LEFT JOIN funders f ON f.id = p.funder_id WHERE p.id = ?`,
    [projectId],
  )
  if (!project) throw notFound('Project')

  const [remittances, payments, committed, phases] = await Promise.all([
    rows(
      `SELECT r.id, r.reference, r.description, r.amount, r.currency, r.exchange_rate, r.received_at, r.attachments,
              r.funder_id, f.name AS funder_name, r.amount * r.exchange_rate AS converted
         FROM remittances r LEFT JOIN funders f ON f.id = r.funder_id
        WHERE r.project_id = ? ORDER BY r.received_at, r.id`,
      [projectId],
    ),
    rows(
      `SELECT pm.id, pm.reference, pm.description, pm.amount, pm.currency, pm.project_rate, pm.paid_at,
              pm.amount * pm.project_rate AS converted, ${RETIRED} AS retired, ${RETIRE_PENDING} AS retire_pending,
              cl.id AS claim_id, cl.reference AS claim_reference, cl.purpose AS claim_purpose,
              ph.id AS phase_id, ph.phase_no, ph.title AS phase_title, ${PAYEE} AS payee
         FROM payments pm
         JOIN claims cl ON cl.id = pm.claim_id
         JOIN phases ph ON ph.id = cl.phase_id
         JOIN projects p ON p.id = ph.project_id
         LEFT JOIN investigators i ON i.id = COALESCE(cl.investigator_id, p.pi_id)
        WHERE ph.project_id = ? ORDER BY pm.paid_at, pm.id`,
      [projectId],
    ),
    // Approved claims not yet fully paid: money already promised out of the balance.
    rows(
      `SELECT cl.currency, COUNT(*) AS count,
              SUM(cl.amount - COALESCE((SELECT SUM(pm.amount * pm.conversion_rate) FROM payments pm WHERE pm.claim_id = cl.id), 0)) AS outstanding
         FROM claims cl JOIN phases ph ON ph.id = cl.phase_id
        WHERE ph.project_id = ? AND cl.status = 'APPROVED'
          AND cl.amount - COALESCE((SELECT SUM(pm.amount * pm.conversion_rate) FROM payments pm WHERE pm.claim_id = cl.id), 0) > 0.009
        GROUP BY cl.currency`,
      [projectId],
    ),
    rows('SELECT id, phase_no, title, budget FROM phases WHERE project_id = ? ORDER BY phase_no, id', [projectId]),
  ])

  const entries: Array<LedgerEntry> = [
    ...remittances.map((r) => ({
      kind: 'remittance' as const,
      id: r.id,
      date: r.receivedAt,
      reference: r.reference,
      description: r.description || `Funds received${r.funderName ? ` from ${r.funderName}` : ''}`,
      amount: r.amount,
      currency: r.currency,
      rate: r.exchangeRate,
      credit: round2(r.converted),
      debit: 0,
      balance: 0,
      funderName: r.funderName,
      attachments: r.attachments ?? [],
    })),
    ...payments.map((pm) => ({
      kind: 'payment' as const,
      id: pm.id,
      date: pm.paidAt,
      reference: pm.reference,
      description: pm.description || `Tranche on ${pm.claimReference}: ${pm.claimPurpose}`,
      amount: pm.amount,
      currency: pm.currency,
      rate: pm.projectRate,
      credit: 0,
      // A tranche with no known rate can't be charged; it is flagged instead.
      debit: pm.projectRate == null ? 0 : round2(pm.converted),
      balance: 0,
      claimId: pm.claimId,
      claimReference: pm.claimReference,
      phaseNo: pm.phaseNo,
      payee: pm.payee,
      retired: pm.retired,
      retirePending: pm.retirePending,
      retirement: retirementState(pm.amount, pm.retired, pm.retirePending),
    })),
  ].sort((a, b) => a.date.localeCompare(b.date) || (a.kind === b.kind ? a.id - b.id : a.kind === 'remittance' ? -1 : 1))

  let balance = 0
  for (const e of entries) {
    balance = round2(balance + e.credit - e.debit)
    e.balance = balance
  }

  const received = round2(remittances.reduce((s, r) => s + r.converted, 0))
  const charged = payments.filter((pm) => pm.projectRate != null)
  const disbursed = round2(charged.reduce((s, pm) => s + pm.converted, 0))
  // Retirement totals in project currency, from each tranche's own rate.
  const retired = round2(charged.reduce((s, pm) => s + Math.min(pm.retired, pm.amount) * pm.projectRate, 0))
  const awaitingReview = round2(
    charged.reduce((s, pm) => s + Math.min(pm.retirePending, Math.max(0, pm.amount - pm.retired)) * pm.projectRate, 0),
  )
  const byFunder = new Map<string, number>()
  for (const r of remittances) {
    const name = r.funderName ?? 'Unspecified'
    byFunder.set(name, round2((byFunder.get(name) ?? 0) + r.converted))
  }

  return {
    project,
    currency: project.currency,
    summary: {
      award: project.totalFunding,
      received,
      disbursed,
      balance,
      expected: round2(Math.max(0, project.totalFunding - received)),
      retired,
      awaitingReview,
      unretired: round2(Math.max(0, disbursed - retired - awaitingReview)),
      remittances: remittances.length,
      tranches: payments.length,
      tranchesRetired: payments.filter((pm) => retirementState(pm.amount, pm.retired, pm.retirePending) === 'RETIRED')
        .length,
      unconverted: payments.length - charged.length,
    },
    committed,
    byPhase: phases.map((ph) => {
      const own = charged.filter((pm) => pm.phaseId === ph.id)
      return {
        id: ph.id,
        phaseNo: ph.phaseNo,
        title: ph.title,
        budget: ph.budget,
        disbursed: round2(own.reduce((s, pm) => s + pm.converted, 0)),
        retired: round2(own.reduce((s, pm) => s + Math.min(pm.retired, pm.amount) * pm.projectRate, 0)),
      }
    }),
    byFunder: [...byFunder].map(([name, total]) => ({ name, total })),
    entries,
  }
}
