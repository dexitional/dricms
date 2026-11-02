import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  Banknote,
  Building2,
  CalendarClock,
  FileStack,
  FolderKanban,
  HandCoins,
  Plus,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react'
import { api } from '#/lib/api-client'
import { date, money, num, percent, relative } from '#/lib/format'
import { CLAIM_STATUS_LABELS, PROJECT_STATUS_LABELS, PROJECT_TYPE_LABELS, REQUEST_STATUS_LABELS } from '#/lib/labels'
import { REQUEST_FORM_BY_TYPE } from '#/lib/forms'
import type { RequestType } from '@dric/db/types'
import { Card, CardBody, CardHeader } from '#/components/ui/card'
import { Button } from '#/components/ui/button'
import { Skeleton } from '#/components/ui/skeleton'
import { Donut, MonthlyBars, RankBars, StatCard } from '#/components/admin/charts'
import { EmptyState, Money, PageHeader, ProgressBar, StatusBadge } from '#/components/admin/page'
import { useCan, useUser } from '#/components/admin/session'

export const Route = createFileRoute('/admin/')({ component: Dashboard })

type Row = Record<string, any>

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

function Dashboard() {
  const user = useUser()
  const { data, isLoading } = useQuery({ queryKey: ['dashboard'], queryFn: () => api.get<Row>('/dashboard') })
  const firstName = user.fullName.replace(/^(Prof\.|Dr\.|Mr\.|Mrs\.|Ms\.|Rev\.)\s*/i, '').split(' ')[0]
  return (
    <>
      <PageHeader
        eyebrow={new Date().toLocaleDateString('en-GB', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })}
        title={`${greeting()}, ${firstName}`}
        description={
          user.role === 'investigator'
            ? 'Your projects, claims and payments at a glance.'
            : 'Here is where DRIC’s grant portfolio stands today.'
        }
        actions={<QuickActions />}
      />
      {isLoading || !data ? (
        <DashboardSkeleton />
      ) : data.kind === 'investigator' ? (
        <InvestigatorDashboard data={data} />
      ) : (
        <StaffDashboard data={data} />
      )}
    </>
  )
}

function QuickActions() {
  const canProjects = useCan('projects', 'manage')
  const canClaims = useCan('claims', 'manage')
  return (
    <>
      {canClaims && (
        <Button variant="outline" asChild>
          <Link to="/admin/claims/new">
            <HandCoins /> New claim
          </Link>
        </Button>
      )}
      {canProjects && (
        <Button asChild>
          <Link to="/admin/projects/new">
            <Plus /> New project
          </Link>
        </Button>
      )}
    </>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-80 rounded-2xl lg:col-span-2" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    </div>
  )
}

function StaffDashboard({ data }: { data: Row }) {
  const k = data.kpis
  const fc: string = data.fundingCurrency
  const cc: string = data.claimCurrency
  const statusOrder = ['ONGOING', 'COMPLETED', 'CLOSED', 'SUSPENDED'] as const
  const claimOrder = ['PENDING', 'PROCESSING', 'APPROVED', 'DECLINED'] as const
  const claimCount = (s: string) => Number(data.claimsByStatus.find((r: Row) => r.status === s)?.count ?? 0)
  const claimTotal = (s: string) => Number(data.claimsByStatus.find((r: Row) => r.status === s)?.total ?? 0)
  const otherCurrencies = (data.fundingByCurrency as Array<Row>).filter((r) => r.currency !== fc)
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          accent
          icon={Wallet}
          label="Portfolio funding"
          value={money(k.funding, fc, { compact: true })}
          sub={
            otherCurrencies.length
              ? `+ ${otherCurrencies.map((r) => money(r.total, r.currency, { compact: true })).join(' · ')}`
              : `${num(k.projects, 0)} projects awarded`
          }
        />
        <StatCard
          icon={FolderKanban}
          label="Active projects"
          value={num(k.ongoing, 0)}
          sub={`of ${num(k.projects, 0)} in total`}
        />
        <StatCard
          icon={Banknote}
          label={`Disbursed ${new Date().getFullYear()}`}
          value={money(k.disbursedThisYear, cc, { compact: true })}
          sub={`${money(k.disbursed, cc, { compact: true })} all time`}
        />
        <StatCard
          icon={HandCoins}
          label="Open claims"
          value={num(k.openClaims, 0)}
          sub={`${num(k.openRequests, 0)} form requests awaiting action`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Disbursements"
            description={`Tranche payments per month over the last year (${cc})`}
            action={
              <Link to="/admin/payments" className="text-xs font-semibold text-primary hover:underline">
                All payments
              </Link>
            }
          />
          <CardBody>
            <MonthlyBars data={data.paymentsByMonth} currency={cc} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Portfolio mix" description="Projects by type" />
          <CardBody>
            <Donut
              items={(['PROJECT', 'CONSULTANCY'] as const).map((t) => ({
                label: PROJECT_TYPE_LABELS[t],
                value: Number(data.byType.find((r: Row) => r.type === t)?.count ?? 0),
              }))}
              centerLabel="Projects"
              centerValue={num(k.projects, 0)}
            />
            <div className="mt-6 grid grid-cols-2 gap-2">
              {statusOrder.map((s) => (
                <div key={s} className="rounded-xl bg-muted px-3 py-2.5">
                  <p className="text-lg font-extrabold text-slate-900">
                    {num(data.byStatus.find((r: Row) => r.status === s)?.count ?? 0, 0)}
                  </p>
                  <p className="text-xs text-muted-foreground">{PROJECT_STATUS_LABELS[s]}</p>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Top funders" description={`Total awards in ${fc}`} />
          <CardBody>
            <RankBars
              items={(data.byFunder as Array<Row>).map((f) => ({
                label: f.name,
                value: Number(f.total),
                sub: `${f.count} project${f.count === 1 ? '' : 's'}`,
              }))}
              format={(v) => money(v, fc, { compact: true })}
              emptyText="No funded projects yet."
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader
            title="Claims pipeline"
            description={`Requests for disbursement (${cc})`}
            action={
              <Link to="/admin/claims" className="text-xs font-semibold text-primary hover:underline">
                Review
              </Link>
            }
          />
          <CardBody className="space-y-3">
            {claimOrder.map((s) => (
              <Link
                key={s}
                to="/admin/claims"
                search={{ status: s }}
                className="flex items-center justify-between gap-3 rounded-xl border px-3.5 py-3 transition-colors hover:border-border-strong hover:bg-slate-50"
              >
                <StatusBadge status={s} label={CLAIM_STATUS_LABELS[s]} />
                <span className="text-right">
                  <span className="block font-mono text-sm font-semibold tabular-nums">{money(claimTotal(s), cc)}</span>
                  <span className="text-xs text-muted-foreground">
                    {claimCount(s)} claim{claimCount(s) === 1 ? '' : 's'}
                  </span>
                </span>
              </Link>
            ))}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Budget utilisation" description="Largest active projects: spent vs phase budgets" />
          <CardBody className="space-y-4">
            {(data.topProjects as Array<Row>).length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">No active projects.</p>
            )}
            {(data.topProjects as Array<Row>).map((p) => {
              const used = percent(p.spent, p.budgeted)
              return (
                <Link key={p.id} to="/admin/projects/$projectId" params={{ projectId: String(p.id) }} className="block">
                  <div className="mb-1.5 flex items-baseline justify-between gap-3">
                    <span className="truncate text-sm font-medium text-slate-700 hover:text-primary">{p.title}</span>
                    <span className="shrink-0 font-mono text-xs tabular-nums">{used}%</span>
                  </div>
                  <ProgressBar value={used} tone={used > 95 ? 'danger' : used > 80 ? 'warning' : 'primary'} />
                  <p className="mt-1 text-[0.7rem] text-muted-foreground">
                    {money(p.spent, p.currency, { compact: true })} of{' '}
                    {money(p.budgeted, p.currency, { compact: true })} budgeted · award{' '}
                    {money(p.totalFunding, p.currency, { compact: true })}
                  </p>
                </Link>
              )
            })}
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Latest claims"
            action={
              <Link to="/admin/claims" className="text-xs font-semibold text-primary hover:underline">
                View all
              </Link>
            }
          />
          <ul className="divide-y">
            {(data.recentClaims as Array<Row>).length === 0 && <EmptyState title="No claims yet" icon={HandCoins} />}
            {(data.recentClaims as Array<Row>).map((c) => (
              <li key={c.id}>
                <Link
                  to="/admin/claims/$claimId"
                  params={{ claimId: String(c.id) }}
                  className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">{c.purpose}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {c.reference} · {c.projectTitle} · {c.requester ?? '—'}
                    </p>
                  </div>
                  <Money amount={c.amount} currency={c.currency} className="hidden sm:inline" />
                  <StatusBadge
                    status={c.status}
                    label={CLAIM_STATUS_LABELS[c.status as keyof typeof CLAIM_STATUS_LABELS]}
                  />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Ending soon" description="Ongoing projects ending within 120 days" />
          <ul className="divide-y">
            {(data.endingSoon as Array<Row>).length === 0 && (
              <EmptyState title="Nothing ending soon" icon={CalendarClock} />
            )}
            {(data.endingSoon as Array<Row>).map((p) => (
              <li key={p.id}>
                <Link
                  to="/admin/projects/$projectId"
                  params={{ projectId: String(p.id) }}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50"
                >
                  <span
                    className={`flex size-11 shrink-0 flex-col items-center justify-center rounded-xl text-center leading-none ${p.daysLeft < 0 ? 'bg-secondary text-secondary-foreground' : 'bg-primary-soft text-primary'}`}
                  >
                    <span className="text-sm font-extrabold">{Math.abs(p.daysLeft)}</span>
                    <span className="text-[0.6rem]">{p.daysLeft < 0 ? 'overdue' : 'days'}</span>
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-slate-800">{p.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      Ends {date(p.endDate)} · {p.piName ?? 'No PI'}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Recent form requests"
            action={
              <Link to="/admin/requests" className="text-xs font-semibold text-primary hover:underline">
                View all
              </Link>
            }
          />
          <ul className="divide-y">
            {(data.recentRequests as Array<Row>).length === 0 && (
              <EmptyState title="No requests yet" icon={FileStack} />
            )}
            {(data.recentRequests as Array<Row>).map((r) => (
              <li key={r.id}>
                <Link
                  to="/admin/requests/$requestId"
                  params={{ requestId: String(r.id) }}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">{r.projectTitle}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {REQUEST_FORM_BY_TYPE[r.type as RequestType].shortTitle} · {r.firstName} {r.surname} ·{' '}
                      {relative(r.createdAt)}
                    </p>
                  </div>
                  <StatusBadge
                    status={r.status}
                    label={REQUEST_STATUS_LABELS[r.status as keyof typeof REQUEST_STATUS_LABELS]}
                  />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Recent activity" />
          <ul className="space-y-0 px-5 py-3">
            {(data.activity as Array<Row>).length === 0 && <EmptyState title="No activity yet" />}
            {(data.activity as Array<Row>).map((a, i, all) => (
              <li key={a.id} className="relative flex gap-3 pb-4">
                {i < all.length - 1 && <span className="absolute top-5 left-[5px] h-full w-px bg-border" />}
                <span className="relative mt-1.5 size-[11px] shrink-0 rounded-full border-2 border-white bg-primary ring-1 ring-border" />
                <div className="min-w-0 text-sm">
                  <p className="text-slate-700">{a.summary}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.userName ?? 'Public submission'} · {relative(a.createdAt)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <MiniStat icon={Building2} label="Funders" value={k.funders} to="/admin/funders" />
        <MiniStat icon={Users} label="Active investigators" value={k.investigators} to="/admin/investigators" />
        <MiniStat icon={Users} label="Active personnel" value={k.personnel} to="/admin/personnel" />
        <MiniStat
          icon={TrendingUp}
          label={`Approved claims (${cc})`}
          value={money(k.approvedClaims, cc, { compact: true })}
          to="/admin/claims"
        />
      </div>
    </div>
  )
}

function MiniStat({
  icon: Icon,
  label,
  value,
  to,
}: {
  icon: typeof Users
  label: string
  value: React.ReactNode
  to: string
}) {
  return (
    <Link to={to} className="lift flex items-center gap-3 rounded-2xl border bg-white p-4">
      <span className="flex size-9 items-center justify-center rounded-xl bg-primary-soft text-primary">
        <Icon className="size-4" />
      </span>
      <span>
        <span className="block text-lg leading-tight font-extrabold tabular-nums">{value}</span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </span>
    </Link>
  )
}

function InvestigatorDashboard({ data }: { data: Row }) {
  const projects = data.projects as Array<Row>
  const totals = data.totals as Array<Row>
  const currency = totals[0]?.currency ?? 'GHS'
  const sum = (key: string, filter?: (r: Row) => boolean) =>
    totals.filter((r) => r.currency === currency && (!filter || filter(r))).reduce((s, r) => s + Number(r[key] ?? 0), 0)
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          accent
          icon={FolderKanban}
          label="My projects"
          value={projects.length}
          sub={`${projects.filter((p) => p.status === 'ONGOING').length} ongoing`}
        />
        <StatCard
          icon={HandCoins}
          label="Requested"
          value={money(sum('requested'), currency, { compact: true })}
          sub={`${sum('count')} claims`}
        />
        <StatCard
          icon={TrendingUp}
          label="Approved"
          value={money(
            sum('requested', (r) => r.status === 'APPROVED'),
            currency,
            { compact: true },
          )}
          sub="awaiting or paid in tranches"
        />
        <StatCard
          icon={Banknote}
          label="Received"
          value={money(sum('paid'), currency, { compact: true })}
          sub="paid out to date"
        />
      </div>
      <Card>
        <CardHeader
          title="My projects"
          action={
            <Link to="/admin/projects" className="text-xs font-semibold text-primary hover:underline">
              All
            </Link>
          }
        />
        {projects.length === 0 ? (
          <EmptyState
            title="No projects yet"
            description="Projects you lead or co-investigate appear here once DRIC registers them."
            icon={FolderKanban}
          />
        ) : (
          <div className="grid gap-4 p-5 md:grid-cols-2">
            {projects.map((p) => {
              const used = percent(p.spent, p.budgeted)
              return (
                <Link
                  key={p.id}
                  to="/admin/projects/$projectId"
                  params={{ projectId: String(p.id) }}
                  className="lift rounded-2xl border p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="eyebrow">
                      {p.code} · {p.role}
                    </p>
                    <StatusBadge
                      status={p.status}
                      label={PROJECT_STATUS_LABELS[p.status as keyof typeof PROJECT_STATUS_LABELS]}
                    />
                  </div>
                  <p className="mt-2 line-clamp-2 font-bold text-slate-900">{p.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {p.funderName ?? 'No funder'} · {date(p.startDate)} – {date(p.endDate)}
                  </p>
                  <div className="mt-4 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      {p.phasesCount} phase{p.phasesCount === 1 ? '' : 's'} · {used}% of budget used
                    </span>
                    <Money amount={p.totalFunding} currency={p.currency} className="font-semibold" />
                  </div>
                  <ProgressBar value={used} className="mt-2" />
                </Link>
              )
            })}
          </div>
        )}
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="My claims"
            action={
              <Button size="sm" asChild>
                <Link to="/admin/claims/new">
                  <Plus /> New claim
                </Link>
              </Button>
            }
          />
          <ul className="divide-y">
            {(data.claims as Array<Row>).length === 0 && (
              <EmptyState title="No claims yet" description="Request funds for a project phase." icon={HandCoins} />
            )}
            {(data.claims as Array<Row>).map((c) => (
              <li key={c.id}>
                <Link
                  to="/admin/claims/$claimId"
                  params={{ claimId: String(c.id) }}
                  className="block px-5 py-3 hover:bg-slate-50"
                >
                  <div className="flex items-center gap-3">
                    <p className="min-w-0 flex-1 truncate text-sm font-semibold">{c.purpose}</p>
                    <StatusBadge
                      status={c.status}
                      label={CLAIM_STATUS_LABELS[c.status as keyof typeof CLAIM_STATUS_LABELS]}
                    />
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {c.reference} · Phase {c.phaseNo} · {money(c.paid, c.currency)} of {money(c.amount, c.currency)}{' '}
                    received
                  </p>
                  <ProgressBar value={percent(c.paid, c.amount)} tone="success" className="mt-2" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Recent payments" />
          <ul className="divide-y">
            {(data.payments as Array<Row>).length === 0 && <EmptyState title="No payments yet" icon={Banknote} />}
            {(data.payments as Array<Row>).map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-5 py-3">
                <span className="flex size-9 items-center justify-center rounded-xl bg-success-soft font-mono text-[0.65rem] font-bold text-emerald-700">
                  {p.reference}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.projectTitle}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.claimReference} · {date(p.paidAt)}
                  </p>
                </div>
                <Money amount={p.amount} currency={p.currency} className="font-semibold" />
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  )
}
