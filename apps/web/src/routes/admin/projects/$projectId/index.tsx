import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Banknote,
  CalendarRange,
  ClipboardCheck,
  Download,
  FileText,
  FolderOpen,
  HandCoins,
  Layers,
  Mail,
  MoreHorizontal,
  Pencil,
  Plus,
  Printer,
  Trash2,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { api, errorMessage } from '#/lib/api-client'
import { date, money, percent, period } from '#/lib/format'
import { CLAIM_STATUS_LABELS, PROJECT_STATUS_LABELS, PROJECT_TYPE_LABELS, REQUEST_STATUS_LABELS } from '#/lib/labels'
import { REQUEST_FORM_BY_TYPE } from '#/lib/forms'
import type { RequestType } from '@dric/db/types'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card, CardBody, CardHeader } from '#/components/ui/card'
import { Dropdown, DropdownContent, DropdownItem, DropdownSeparator, DropdownTrigger } from '#/components/ui/dropdown'
import { Skeleton } from '#/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { DataTable } from '#/components/admin/data-table'
import {
  Avatar,
  DetailList,
  EmptyState,
  FunderLogo,
  Money,
  PageHeader,
  ProgressBar,
  StatusBadge,
} from '#/components/admin/page'
import { useConfirm } from '#/components/admin/confirm'
import { useCan } from '#/components/admin/session'

export const Route = createFileRoute('/admin/projects/$projectId/')({ component: ProjectPage })

type Row = Record<string, any>

function elapsed(start?: string | null, end?: string | null) {
  if (!start || !end) return null
  const s = new Date(start).getTime()
  const e = new Date(end).getTime()
  return percent(Date.now() - s, e - s)
}

function ProjectPage() {
  const { projectId } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const canManage = useCan('projects', 'manage')
  const canClaim = useCan('claims', 'manage')
  const { confirm, dialog } = useConfirm()
  const { data: p, isLoading } = useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => api.get<Row>(`/projects/${projectId}`),
  })
  if (isLoading || !p) return <Skeleton className="h-[32rem]" />

  const phases = p.phases as Array<Row>
  const claims = p.claims as Array<Row>
  const budgeted = phases.reduce((s, ph) => s + Number(ph.budget), 0)
  const spent = phases.reduce((s, ph) => s + Number(ph.spent), 0)
  const time = elapsed(p.startDate, p.endDate)
  const claimCurrency = claims[0]?.currency ?? p.currency
  const claimed = claims
    .filter((c) => c.status !== 'DECLINED' && c.currency === claimCurrency)
    .reduce((s, c) => s + Number(c.amount), 0)
  const paid = claims.filter((c) => c.currency === claimCurrency).reduce((s, c) => s + Number(c.paid), 0)

  const remove = () =>
    confirm({
      title: 'Delete this project?',
      description:
        'Its phases, activities, claims and kick-off checklist are deleted too. Projects with payments cannot be deleted.',
      confirmLabel: 'Delete project',
      danger: true,
      onConfirm: async () => {
        try {
          await api.delete(`/projects/${projectId}`)
          toast.success('Project deleted')
          await queryClient.invalidateQueries({ queryKey: ['projects'] })
          await navigate({ to: '/admin/projects' })
        } catch (err) {
          toast.error(errorMessage(err))
        }
      },
    })

  return (
    <>
      {dialog}
      <PageHeader
        back={{ to: '/admin/projects', label: 'Projects' }}
        eyebrow={<span className="font-mono">{p.code}</span>}
        title={p.title}
        meta={
          <>
            <StatusBadge
              status={p.status}
              label={PROJECT_STATUS_LABELS[p.status as keyof typeof PROJECT_STATUS_LABELS]}
            />
            <Badge tone={p.type === 'CONSULTANCY' ? 'warning' : 'brand'} dot={false}>
              {PROJECT_TYPE_LABELS[p.type as keyof typeof PROJECT_TYPE_LABELS]}
            </Badge>
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarRange className="size-3.5" /> {date(p.startDate)} – {date(p.endDate)} ·{' '}
              {period(p.startDate, p.endDate)}
            </span>
          </>
        }
        actions={
          <>
            {canClaim && (
              <Button variant="outline" asChild>
                <Link to="/admin/claims/new" search={{ projectId: Number(projectId) }}>
                  <HandCoins /> Request funds
                </Link>
              </Button>
            )}
            {canManage && (
              <Button asChild>
                <Link to="/admin/projects/$projectId/edit" params={{ projectId }}>
                  <Pencil /> Edit
                </Link>
              </Button>
            )}
            <Dropdown>
              <DropdownTrigger asChild>
                <Button variant="outline" size="icon" aria-label="More actions">
                  <MoreHorizontal />
                </Button>
              </DropdownTrigger>
              <DropdownContent>
                <DropdownItem
                  onSelect={() => navigate({ to: '/admin/projects/$projectId/kickoff', params: { projectId } })}
                >
                  <ClipboardCheck /> Kick-off checklist
                </DropdownItem>
                {p.hasKickoff && (
                  <DropdownItem onSelect={() => window.open(`/print/kickoff/${projectId}`, '_blank')}>
                    <Printer /> Print kick-off checklist
                  </DropdownItem>
                )}
                {canManage && (
                  <>
                    <DropdownSeparator />
                    <DropdownItem danger onSelect={remove}>
                      <Trash2 /> Delete project
                    </DropdownItem>
                  </>
                )}
              </DropdownContent>
            </Dropdown>
          </>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Total award"
          value={money(p.totalFunding, p.currency)}
          sub={p.funderName ?? 'No funder linked'}
        />
        <Metric
          label="Phase budgets"
          value={money(budgeted, p.currency)}
          sub={`${percent(budgeted, p.totalFunding)}% of award allocated`}
          progress={percent(budgeted, p.totalFunding)}
        />
        <Metric
          label="Spent"
          value={money(spent, p.currency)}
          sub={`${percent(spent, budgeted)}% of phase budgets`}
          progress={percent(spent, budgeted)}
          tone={percent(spent, budgeted) > 95 ? 'danger' : 'primary'}
        />
        <Metric
          label="Disbursed to team"
          value={money(paid, claimCurrency)}
          sub={`of ${money(claimed, claimCurrency)} claimed`}
          progress={percent(paid, claimed)}
          tone="success"
        />
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="mb-5">
          <TabsTrigger value="overview">
            <FolderOpen /> Overview
          </TabsTrigger>
          <TabsTrigger value="phases">
            <Layers /> Phases <Count n={phases.length} />
          </TabsTrigger>
          <TabsTrigger value="finance">
            <Banknote /> Claims & payments <Count n={claims.length} />
          </TabsTrigger>
          <TabsTrigger value="team">
            <Users /> Team <Count n={(p.coInvestigators?.length ?? 0) + (p.piId ? 1 : 0)} />
          </TabsTrigger>
          <TabsTrigger value="report">
            <FileText /> Report & documents
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader title="About this project" />
            <CardBody className="space-y-6">
              <p className="text-sm leading-relaxed whitespace-pre-line text-slate-700">
                {p.description || 'No description yet.'}
              </p>
              <DetailList
                columns={3}
                items={[
                  ['Date awarded', date(p.awardedAt)],
                  ['Start date', date(p.startDate)],
                  ['End date', date(p.endDate)],
                  ['Country', p.country],
                  ['Currency', p.currency],
                  ['Created', date(p.createdAt)],
                ]}
              />
              {time !== null && (
                <div>
                  <div className="mb-1.5 flex justify-between text-xs">
                    <span className="eyebrow">Timeline</span>
                    <span className="font-mono text-muted-foreground">{time}% elapsed</span>
                  </div>
                  <ProgressBar value={time} tone={time >= 100 && p.status === 'ONGOING' ? 'danger' : 'primary'} />
                </div>
              )}
            </CardBody>
          </Card>
          <div className="space-y-4">
            <Card>
              <CardHeader title="Funder" />
              <CardBody>
                {p.funderId ? (
                  <Link
                    to="/admin/funders/$funderId"
                    params={{ funderId: String(p.funderId) }}
                    className="flex items-center gap-3"
                  >
                    <FunderLogo url={p.funderLogo} name={p.funderName} className="size-11" />
                    <span>
                      <span className="block font-semibold text-slate-800 hover:text-primary">{p.funderName}</span>
                      {p.funderEmail && <span className="text-xs text-muted-foreground">{p.funderEmail}</span>}
                    </span>
                  </Link>
                ) : (
                  <p className="text-sm text-muted-foreground">No funder linked.</p>
                )}
              </CardBody>
            </Card>
            <Card>
              <CardHeader
                title="Kick-off meeting"
                action={
                  <Link
                    to="/admin/projects/$projectId/kickoff"
                    params={{ projectId }}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    {p.hasKickoff ? 'Open' : 'Start'}
                  </Link>
                }
              />
              <CardBody>
                <p className="flex items-center gap-2 text-sm">
                  <ClipboardCheck className={p.hasKickoff ? 'size-4 text-success' : 'size-4 text-muted-foreground'} />
                  {p.hasKickoff ? 'Checklist recorded' : 'Checklist not completed yet'}
                </p>
              </CardBody>
            </Card>
            {(p.requests as Array<Row>).length > 0 && (
              <Card>
                <CardHeader title="Related form requests" />
                <ul className="divide-y">
                  {(p.requests as Array<Row>).map((r) => (
                    <li key={r.id}>
                      <Link
                        to="/admin/requests/$requestId"
                        params={{ requestId: String(r.id) }}
                        className="flex items-center justify-between gap-3 px-5 py-3 text-sm hover:bg-slate-50"
                      >
                        <span>
                          <span className="block font-medium">
                            {REQUEST_FORM_BY_TYPE[r.type as RequestType].shortTitle}
                          </span>
                          <span className="font-mono text-xs text-muted-foreground">{r.reference}</span>
                        </span>
                        <StatusBadge
                          status={r.status}
                          label={REQUEST_STATUS_LABELS[r.status as keyof typeof REQUEST_STATUS_LABELS]}
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="phases">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Each phase has its own budget, activities, report and claims.
            </p>
            {canManage && (
              <Button size="sm" asChild>
                <Link to="/admin/projects/$projectId/phases/new" params={{ projectId }}>
                  <Plus /> Add phase
                </Link>
              </Button>
            )}
          </div>
          {phases.length === 0 ? (
            <Card>
              <EmptyState
                icon={Layers}
                title="No phases yet"
                description="Break the project into phases to track budgets, activities and claims."
              />
            </Card>
          ) : (
            <ol className="relative space-y-3 before:absolute before:top-4 before:bottom-4 before:left-[1.35rem] before:w-px before:bg-border">
              {phases.map((ph) => {
                const used = percent(ph.spent, Number(ph.budget) + Number(ph.balanceBf))
                return (
                  <li key={ph.id} className="relative pl-14">
                    <span className="absolute top-4 left-0 flex size-11 items-center justify-center rounded-2xl border-4 border-white bg-primary font-mono text-sm font-bold text-white shadow-sm">
                      {ph.phaseNo}
                    </span>
                    <Link
                      to="/admin/projects/$projectId/phases/$phaseId"
                      params={{ projectId, phaseId: String(ph.id) }}
                      className="lift block rounded-2xl border bg-white p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-bold text-slate-900">{ph.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {date(ph.startDate)} – {date(ph.endDate)} · {ph.activitiesDone}/{ph.activitiesCount}{' '}
                            activities done {ph.hasReport ? '· report filed' : ''}
                          </p>
                        </div>
                        <div className="text-right text-xs">
                          <p>
                            <span className="text-muted-foreground">Budget</span>{' '}
                            <Money amount={ph.budget} currency={p.currency} className="font-semibold" />
                          </p>
                          <p>
                            <span className="text-muted-foreground">Spent</span>{' '}
                            <Money amount={ph.spent} currency={p.currency} />
                          </p>
                        </div>
                      </div>
                      <ProgressBar
                        value={used}
                        tone={used > 100 ? 'danger' : used > 85 ? 'warning' : 'primary'}
                        className="mt-3"
                      />
                    </Link>
                  </li>
                )
              })}
            </ol>
          )}
        </TabsContent>

        <TabsContent value="finance" className="space-y-4">
          <Card>
            <CardHeader
              title="Claims (requests for funds)"
              action={
                canClaim && (
                  <Button size="sm" asChild>
                    <Link to="/admin/claims/new" search={{ projectId: Number(projectId) }}>
                      <Plus /> New claim
                    </Link>
                  </Button>
                )
              }
            />
            <DataTable
              className="rounded-none border-0"
              rows={claims}
              rowLink={(c) => ({ to: '/admin/claims/$claimId', params: { claimId: String(c.id) } })}
              empty={<EmptyState icon={HandCoins} title="No claims yet" />}
              columns={[
                {
                  header: 'Claim',
                  cell: (c: Row) => (
                    <span>
                      <span className="block font-semibold">{c.purpose}</span>
                      <span className="text-xs text-muted-foreground">
                        <span className="font-mono">{c.reference}</span> · Phase {c.phaseNo}
                      </span>
                    </span>
                  ),
                },
                {
                  header: 'Status',
                  cell: (c: Row) => (
                    <StatusBadge
                      status={c.status}
                      label={CLAIM_STATUS_LABELS[c.status as keyof typeof CLAIM_STATUS_LABELS]}
                    />
                  ),
                },
                {
                  header: 'Paid',
                  cell: (c: Row) => (
                    <div className="w-28">
                      <ProgressBar value={percent(c.paid, c.amount)} tone="success" />
                      <p className="mt-1 text-[0.7rem] text-muted-foreground">{percent(c.paid, c.amount)}%</p>
                    </div>
                  ),
                },
                {
                  header: 'Amount',
                  align: 'right',
                  cell: (c: Row) => <Money amount={c.amount} currency={c.currency} className="font-semibold" />,
                },
              ]}
            />
          </Card>
          <Card>
            <CardHeader title="Tranche payments" />
            <DataTable
              className="rounded-none border-0"
              rows={p.payments}
              empty={<EmptyState icon={Banknote} title="No payments yet" />}
              columns={[
                {
                  header: 'Reference',
                  cell: (m: Row) => <span className="font-mono font-semibold">{m.reference}</span>,
                },
                { header: 'Claim', cell: (m: Row) => <span className="font-mono text-xs">{m.claimReference}</span> },
                { header: 'Date issued', cell: (m: Row) => date(m.paidAt) },
                {
                  header: 'Amount',
                  align: 'right',
                  cell: (m: Row) => (
                    <span className="text-right">
                      <Money amount={m.amount} currency={m.currency} className="block font-semibold" />
                      {m.currency !== m.claimCurrency && (
                        <span className="text-[0.7rem] text-muted-foreground">
                          ≈ {money(m.amount * m.conversionRate, m.claimCurrency)}
                        </span>
                      )}
                    </span>
                  ),
                },
                {
                  header: '',
                  align: 'right',
                  cell: (m: Row) => (
                    <a
                      href={`/print/payment/${m.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="relative z-[1] inline-flex rounded-full p-1.5 text-muted-foreground hover:bg-accent"
                      aria-label="Print voucher"
                    >
                      <Printer className="size-4" />
                    </a>
                  ),
                },
              ]}
            />
          </Card>
        </TabsContent>

        <TabsContent value="team">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {p.piId ? (
              <PersonCard
                id={p.piId}
                name={p.piName}
                role="Principal investigator"
                email={p.piEmail}
                sub={p.piDepartment}
                highlight
              />
            ) : (
              <Card className="p-5 text-sm text-muted-foreground">No principal investigator assigned.</Card>
            )}
            {(p.coInvestigators as Array<Row>).map((c) => (
              <PersonCard
                key={c.id}
                id={c.id}
                name={c.name}
                role="Co-investigator"
                email={c.email}
                sub={c.department}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="report" className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader
              title="Final report"
              action={
                canManage && (
                  <Link
                    to="/admin/projects/$projectId/edit"
                    params={{ projectId }}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    Edit
                  </Link>
                )
              }
            />
            <CardBody>
              {p.finalReport ? (
                <div className="report-content" dangerouslySetInnerHTML={{ __html: p.finalReport }} />
              ) : (
                <EmptyState icon={FileText} title="No final report yet" className="py-8" />
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Documents" />
            <CardBody className="space-y-3">
              <DocLink label="Contract" url={p.contractUrl} name={p.contractName} />
              <DocLink label="Budget" url={p.budgetUrl} name={p.budgetName} />
            </CardBody>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  )
}

function Count({ n }: { n: number }) {
  return <span className="rounded-full bg-muted px-1.5 py-px font-mono text-[0.65rem] text-muted-foreground">{n}</span>
}

function Metric({
  label,
  value,
  sub,
  progress,
  tone = 'primary',
}: {
  label: string
  value: string
  sub: string
  progress?: number
  tone?: 'primary' | 'success' | 'danger'
}) {
  return (
    <div className="rounded-2xl border bg-white p-4">
      <p className="eyebrow">{label}</p>
      <p className="mt-1.5 font-mono text-lg font-semibold tracking-tight tabular-nums">{value}</p>
      {progress !== undefined && <ProgressBar value={progress} tone={tone} className="mt-2" />}
      <p className="mt-1.5 text-xs text-muted-foreground">{sub}</p>
    </div>
  )
}

function PersonCard({
  id,
  name,
  role,
  email,
  sub,
  highlight,
}: {
  id: number
  name: string
  role: string
  email?: string
  sub?: string
  highlight?: boolean
}) {
  return (
    <Link
      to="/admin/investigators/$investigatorId"
      params={{ investigatorId: String(id) }}
      className={`lift flex items-start gap-3 rounded-2xl border p-4 ${highlight ? 'border-primary/30 bg-primary-soft/50' : 'bg-white'}`}
    >
      <Avatar name={name} className="size-11" />
      <div className="min-w-0">
        <p className="eyebrow">{role}</p>
        <p className="truncate font-semibold text-slate-900">{name}</p>
        {sub && <p className="truncate text-xs text-muted-foreground">{sub}</p>}
        {email && (
          <p className="mt-1 flex items-center gap-1 truncate text-xs text-primary">
            <Mail className="size-3" /> {email}
          </p>
        )}
      </div>
    </Link>
  )
}

function DocLink({ label, url, name }: { label: string; url?: string | null; name?: string | null }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border p-3">
      <span className="flex size-9 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
        <FileText className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="eyebrow">{label}</p>
        <p className="truncate text-sm">{name ?? 'Not uploaded'}</p>
      </div>
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="rounded-full p-2 text-muted-foreground hover:bg-accent hover:text-primary"
          aria-label={`Download ${label}`}
        >
          <Download className="size-4" />
        </a>
      )}
    </div>
  )
}
