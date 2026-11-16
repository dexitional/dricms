// A project's balance sheet (GET /api/projects/:id/ledger): funder
// remittances in, tranche payments out, the running balance, and how much of
// what was paid out has been retired with receipts.
import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Landmark, Plus, Printer, Scale } from 'lucide-react'
import { cn } from '@dric/ui'
import { api } from '#/lib/api-client'
import { date, money, percent } from '#/lib/format'
import { RETIREMENT_STATE_LABELS } from '#/lib/labels'
import { Button } from '#/components/ui/button'
import { Card, CardBody, CardHeader } from '#/components/ui/card'
import { Donut, RankBars } from './charts'
import { EmptyState, ProgressBar, StatusBadge } from './page'
import { useCan } from './session'
import { BalanceSheetSkeleton } from '#/components/admin/skeletons'

type Row = Record<string, any>

export function useLedger(projectId: string, enabled = true) {
  return useQuery({
    queryKey: ['projects', projectId, 'ledger'],
    queryFn: () => api.get<Row>(`/projects/${projectId}/ledger`),
    enabled,
  })
}

export function BalanceSheet({ projectId }: { projectId: string }) {
  const canRecord = useCan('remittances', 'manage')
  const canPay = useCan('payments', 'manage')
  const { data: l } = useLedger(projectId)
  if (!l) return <BalanceSheetSkeleton />

  const s = l.summary
  const cur: string = l.currency
  const fmt = (v: number) => money(v, cur, { compact: true })
  const entries = l.entries as Array<Row>
  const committed = l.committed as Array<Row>
  const committedSame = committed.find((c) => c.currency === cur)

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Tile soft label="Total award" value={money(s.award, cur)} sub="Agreed with the funder" />
        <Tile
          soft
          label="Received from funder"
          value={money(s.received, cur)}
          sub={`${percent(s.received, s.award)}% of the ${money(s.award, cur, { compact: true })} award · ${s.remittances} remittance${s.remittances === 1 ? '' : 's'}`}
          progress={percent(s.received, s.award)}
        />
        <div
          className={cn(
            'relative overflow-hidden rounded-2xl border p-4',
            s.balance < 0 ? 'border-red-200 bg-secondary/60' : 'border-primary bg-primary text-white',
          )}
        >
          <p className={cn('eyebrow', s.balance >= 0 && 'text-white/60')}>Closing balance</p>
          <p className={cn('mt-1.5 font-mono text-xl font-semibold tabular-nums', s.balance < 0 && 'text-destructive')}>
            {money(s.balance, cur)}
          </p>
          <p className={cn('mt-1.5 text-xs', s.balance >= 0 ? 'text-white/65' : 'text-secondary-foreground')}>
            {s.balance < 0
              ? 'More has been paid out than received from the funder'
              : `${percent(s.balance, s.received)}% of funds received is still available`}
          </p>
        </div>
        <Tile
          label="Paid out in tranches"
          value={money(s.disbursed, cur)}
          sub={`${percent(s.disbursed, s.received)}% of funds received · ${s.tranches} tranche${s.tranches === 1 ? '' : 's'}`}
          progress={percent(s.disbursed, s.received)}
          tone={s.disbursed > s.received ? 'danger' : 'primary'}
        />
        <Tile label="Still expected from funder" value={money(s.expected, cur)} sub="Award not yet received" />
      </div>

      {s.unconverted > 0 && (
        <p className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-warning-soft px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            {s.unconverted} tranche{s.unconverted === 1 ? ' has' : 's have'} no exchange rate into {cur}, so{' '}
            {s.unconverted === 1 ? 'it is' : 'they are'} not charged to the balance yet.
            {canPay ? ' Edit each one marked “no rate” below to set it.' : ' The accountant needs to set the rate.'}
          </span>
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Where the funds stand" description={`Funds received, in ${cur}`} />
          <CardBody>
            <Donut
              items={[
                // Series colours go by position: navy, red, teal, … — red marks what still needs receipts.
                { label: 'Remaining balance', value: Math.max(0, s.balance) },
                { label: 'Paid out, not yet retired', value: s.unretired },
                { label: 'Paid out, receipts in review', value: s.awaitingReview },
                { label: 'Paid out, retired', value: s.retired },
              ]}
              centerLabel="Received"
              centerValue={fmt(s.received)}
              format={fmt}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Paid out by phase" description="Tranches charged to each phase, and how much is retired" />
          <CardBody>
            <RankBars
              items={(l.byPhase as Array<Row>).map((ph) => ({
                label: `Phase ${ph.phaseNo}: ${ph.title}`,
                value: ph.disbursed,
                sub: `${fmt(ph.retired)} retired · budget ${fmt(ph.budget)}`,
              }))}
              format={fmt}
              emptyText="No phases yet."
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Retirement & commitments" />
          <CardBody className="space-y-5">
            <div>
              <div className="mb-1.5 flex items-baseline justify-between text-sm">
                <span className="font-medium text-slate-700">Tranches fully retired</span>
                <span className="font-mono text-xs">
                  {s.tranchesRetired} of {s.tranches}
                </span>
              </div>
              <ProgressBar value={percent(s.retired, s.disbursed)} tone="success" />
              <p className="mt-1 text-[0.7rem] text-muted-foreground">
                {fmt(s.retired)} of {fmt(s.disbursed)} paid out is backed by accepted receipts
              </p>
            </div>
            <div className="rounded-xl bg-muted px-3.5 py-3">
              <p className="eyebrow">Approved claims not yet paid</p>
              {committed.length === 0 ? (
                <p className="mt-1 text-sm text-muted-foreground">None</p>
              ) : (
                committed.map((c) => (
                  <p key={c.currency} className="mt-1 font-mono text-sm font-semibold">
                    {money(c.outstanding, c.currency)}{' '}
                    <span className="font-sans text-xs font-normal text-muted-foreground">
                      on {c.count} claim{c.count === 1 ? '' : 's'}
                    </span>
                  </p>
                ))
              )}
              {committedSame && (
                <p className="mt-2 border-t pt-2 text-xs text-muted-foreground">
                  Balance after these:{' '}
                  <b
                    className={cn(
                      'font-mono',
                      s.balance - committedSame.outstanding < 0 ? 'text-destructive' : 'text-slate-900',
                    )}
                  >
                    {money(s.balance - committedSame.outstanding, cur)}
                  </b>
                </p>
              )}
            </div>
            {(l.byFunder as Array<Row>).length > 1 && (
              <div>
                <p className="eyebrow mb-2">Received by funder</p>
                {(l.byFunder as Array<Row>).map((f) => (
                  <p key={f.name} className="flex justify-between gap-3 py-0.5 text-sm">
                    <span className="truncate">{f.name}</span>
                    <span className="font-mono text-xs">{money(f.total, cur)}</span>
                  </p>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Balance sheet"
          description={`Every remittance and tranche, with the running balance in ${cur}`}
          action={
            <div className="flex gap-2">
              <Button size="sm" variant="outline" asChild>
                <a href={`/print/ledger/${projectId}`} target="_blank" rel="noreferrer">
                  <Printer /> Print
                </a>
              </Button>
              {canRecord && (
                <Button size="sm" asChild>
                  <Link to="/admin/remittances/new" search={{ projectId: Number(projectId) }}>
                    <Plus /> Record remittance
                  </Link>
                </Button>
              )}
            </div>
          }
        />
        {entries.length === 0 ? (
          <EmptyState
            icon={Scale}
            title="Nothing recorded yet"
            description="Record what the funder sends; tranche payments are charged here automatically."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="border-b bg-slate-50/70 text-left">
                <tr>
                  <th className="eyebrow px-4 py-3">Date</th>
                  <th className="eyebrow px-4 py-3">Reference</th>
                  <th className="eyebrow px-4 py-3">Details</th>
                  <th className="eyebrow px-4 py-3 text-right">Received</th>
                  <th className="eyebrow px-4 py-3 text-right">Paid out</th>
                  <th className="eyebrow px-4 py-3 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {entries.map((e) => (
                  <LedgerRow key={`${e.kind}-${e.id}`} e={e} currency={cur} canRecord={canRecord} />
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-300 bg-slate-50/80 font-semibold">
                  <td colSpan={3} className="px-4 py-3 text-right text-xs tracking-wide uppercase">
                    Closing balance
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">{money(s.received, cur)}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">{money(s.disbursed, cur)}</td>
                  <td
                    className={cn(
                      'px-4 py-3 text-right font-mono text-base tabular-nums',
                      s.balance < 0 && 'text-destructive',
                    )}
                  >
                    {money(s.balance, cur)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

function LedgerRow({ e, currency, canRecord }: { e: Row; currency: string; canRecord: boolean }) {
  const foreign = e.currency !== currency
  const isIn = e.kind === 'remittance'
  return (
    <tr className="align-top hover:bg-slate-50/60">
      <td className="px-4 py-3 text-xs whitespace-nowrap text-muted-foreground">{date(e.date)}</td>
      <td className="px-4 py-3">
        {isIn ? (
          canRecord ? (
            <Link
              to="/admin/remittances/$remittanceId/edit"
              params={{ remittanceId: String(e.id) }}
              className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-primary hover:underline"
            >
              <Landmark className="size-3.5" /> {e.reference}
            </Link>
          ) : (
            <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold">
              <Landmark className="size-3.5" /> {e.reference}
            </span>
          )
        ) : (
          <Link
            to="/admin/payments/$paymentId"
            params={{ paymentId: String(e.id) }}
            className="font-mono text-xs font-semibold text-primary hover:underline"
          >
            {e.reference}
          </Link>
        )}
      </td>
      <td className="max-w-md px-4 py-3">
        <p className="text-sm text-slate-800">{e.description}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {isIn ? (
            <span>{e.funderName ?? 'Funder not set'}</span>
          ) : (
            <>
              <span>
                {e.payee ?? '—'} · <span className="font-mono">{e.claimReference}</span> · Phase {e.phaseNo}
              </span>
              <StatusBadge status={e.retirement} label={RETIREMENT_STATE_LABELS[e.retirement]} />
            </>
          )}
          {foreign &&
            (e.rate == null ? (
              <span className="font-semibold text-amber-700">
                {money(e.amount, e.currency)} · no rate into {currency}
              </span>
            ) : (
              <span>
                {money(e.amount, e.currency)} at {Number(e.rate).toLocaleString('en-GB', { maximumFractionDigits: 6 })}
              </span>
            ))}
        </p>
      </td>
      <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-emerald-700">
        {isIn ? money(e.credit, currency) : ''}
      </td>
      <td className="px-4 py-3 text-right font-mono text-xs tabular-nums">
        {!isIn && (e.rate == null ? '—' : money(e.debit, currency))}
      </td>
      <td
        className={cn(
          'px-4 py-3 text-right font-mono text-xs font-semibold tabular-nums',
          e.balance < 0 && 'text-destructive',
        )}
      >
        {money(e.balance, currency)}
      </td>
    </tr>
  )
}

function Tile({
  label,
  value,
  sub,
  progress,
  tone = 'primary',
  soft = false,
}: {
  label: string
  value: string
  sub: string
  progress?: number
  tone?: 'primary' | 'danger'
  // A light blush card, for the award and the funds received.
  soft?: boolean
}) {
  return (
    <div className={cn('rounded-2xl border p-4', soft ? 'border-secondary-strong/70 bg-secondary-soft' : 'bg-white')}>
      <p className="eyebrow">{label}</p>
      <p className="mt-1.5 font-mono text-lg font-semibold tabular-nums">{value}</p>
      {progress !== undefined && <ProgressBar value={progress} tone={tone} className="mt-2" />}
      <p className="mt-1.5 text-xs text-muted-foreground">{sub}</p>
    </div>
  )
}
