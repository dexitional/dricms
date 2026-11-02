import { useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CalendarDays,
  FileText,
  HandCoins,
  ListChecks,
  MapPin,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@dric/ui'
import { api, errorMessage } from '#/lib/api-client'
import { date, money, percent } from '#/lib/format'
import { ACTIVITY_STATUS_LABELS, CLAIM_STATUS_LABELS } from '#/lib/labels'
import { Button } from '#/components/ui/button'
import { Card, CardBody, CardHeader } from '#/components/ui/card'
import { Dropdown, DropdownContent, DropdownItem, DropdownTrigger } from '#/components/ui/dropdown'
import { Skeleton } from '#/components/ui/skeleton'
import { DataTable } from '#/components/admin/data-table'
import { EmptyState, Money, PageHeader, ProgressBar, StatusBadge } from '#/components/admin/page'
import { useConfirm } from '#/components/admin/confirm'
import { useCan } from '#/components/admin/session'
import { ActivityDialog } from '#/components/forms/activity-dialog'

export const Route = createFileRoute('/admin/projects/$projectId/phases/$phaseId/')({ component: PhasePage })

type Row = Record<string, any>

function PhasePage() {
  const { projectId, phaseId } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const canManage = useCan('projects', 'manage')
  const canActivities = useCan('activities', 'manage')
  const canClaim = useCan('claims', 'manage')
  const { confirm, dialog } = useConfirm()
  const [editing, setEditing] = useState<Row | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const { data: ph } = useQuery({ queryKey: ['phases', phaseId], queryFn: () => api.get<Row>(`/phases/${phaseId}`) })
  if (!ph) return <Skeleton className="h-[30rem]" />

  const activities = ph.activities as Array<Row>
  const available = Number(ph.balanceBf) + Number(ph.budget)
  const remaining = available - Number(ph.spent)
  const done = activities.filter((a) => a.status === 'COMPLETED').length
  const siblings = ph.siblings as Array<Row>
  const index = siblings.findIndex((s) => s.id === ph.id)

  const removePhase = () =>
    confirm({
      title: `Delete phase ${ph.phaseNo}?`,
      description: 'Its activities and claims are deleted too. Phases with paid claims cannot be deleted.',
      danger: true,
      confirmLabel: 'Delete phase',
      onConfirm: async () => {
        try {
          await api.delete(`/phases/${phaseId}`)
          toast.success('Phase deleted')
          await queryClient.invalidateQueries({ queryKey: ['projects'] })
          await navigate({ to: '/admin/projects/$projectId', params: { projectId } })
        } catch (err) {
          toast.error(errorMessage(err))
        }
      },
    })
  const removeActivity = (a: Row) =>
    confirm({
      title: `Delete “${a.title}”?`,
      danger: true,
      confirmLabel: 'Delete activity',
      onConfirm: async () => {
        try {
          await api.delete(`/activities/${a.id}`)
          toast.success('Activity deleted')
          await queryClient.invalidateQueries({ queryKey: ['phases', phaseId] })
        } catch (err) {
          toast.error(errorMessage(err))
        }
      },
    })

  return (
    <>
      {dialog}
      <ActivityDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        phaseId={ph.id}
        currency={ph.currency}
        activity={editing}
      />
      <PageHeader
        back={{ to: '/admin/projects/$projectId', label: ph.projectTitle, params: { projectId } }}
        eyebrow={
          <span>
            <span className="font-mono">{ph.projectCode}</span> · Phase {ph.phaseNo} of {siblings.length}
          </span>
        }
        title={ph.title}
        meta={
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarDays className="size-3.5" /> {date(ph.startDate)} – {date(ph.endDate)}
          </span>
        }
        actions={
          <>
            {canClaim && (
              <Button variant="outline" asChild>
                <Link to="/admin/claims/new" search={{ phaseId: ph.id }}>
                  <HandCoins /> Request funds
                </Link>
              </Button>
            )}
            {canManage && (
              <>
                <Button asChild>
                  <Link to="/admin/projects/$projectId/phases/$phaseId/edit" params={{ projectId, phaseId }}>
                    <Pencil /> Edit phase
                  </Link>
                </Button>
                <Button variant="outline" size="icon" onClick={removePhase} aria-label="Delete phase">
                  <Trash2 />
                </Button>
              </>
            )}
          </>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="Balance brought forward" value={money(ph.balanceBf, ph.currency)} />
        <Tile label="Phase budget / disbursed" value={money(ph.budget, ph.currency)} />
        <Tile
          label="Actual amount spent"
          value={money(ph.spent, ph.currency)}
          progress={percent(ph.spent, available)}
        />
        <Tile label="Balance to carry forward" value={money(remaining, ph.currency)} danger={remaining < 0} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader
              title="Activities"
              description={`${done} of ${activities.length} completed`}
              action={
                canActivities && (
                  <Button size="sm" onClick={() => (setEditing(null), setDialogOpen(true))}>
                    <Plus /> Add activity
                  </Button>
                )
              }
            />
            {activities.length === 0 ? (
              <EmptyState
                icon={ListChecks}
                title="No activities yet"
                description="Break the phase into activities and assign personnel to manage them."
              />
            ) : (
              <ul className="divide-y">
                {activities.map((a) => (
                  <li key={a.id} className="group px-5 py-4">
                    <div className="flex items-start gap-3">
                      <span
                        className={cn(
                          'mt-1 size-2.5 shrink-0 rounded-full',
                          a.status === 'COMPLETED' ? 'bg-success' : a.status === 'ONGOING' ? 'bg-info' : 'bg-slate-300',
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-slate-900">{a.title}</p>
                          <StatusBadge
                            status={a.status}
                            label={ACTIVITY_STATUS_LABELS[a.status as keyof typeof ACTIVITY_STATUS_LABELS]}
                          />
                        </div>
                        {a.description && <p className="mt-1 text-sm text-slate-600">{a.description}</p>}
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <CalendarDays className="size-3.5" /> {date(a.startDate)} – {date(a.endDate)}
                          </span>
                          {a.location && (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="size-3.5" /> {a.location}
                            </span>
                          )}
                          {a.personnel.length > 0 && (
                            <span className="inline-flex items-center gap-1">
                              <Users className="size-3.5" /> {a.personnel.map((p: Row) => p.name).join(', ')}
                            </span>
                          )}
                          {a.subjects && <span>Subjects: {a.subjects}</span>}
                        </div>
                        {a.report && (
                          <p className="mt-2 rounded-xl bg-muted px-3 py-2 text-xs leading-relaxed text-slate-600">
                            {a.report}
                          </p>
                        )}
                      </div>
                      <Money amount={a.amount} currency={a.currency} className="shrink-0 font-semibold" />
                      {canActivities && (
                        <Dropdown>
                          <DropdownTrigger
                            className="rounded-full p-1.5 text-muted-foreground hover:bg-accent"
                            aria-label="Activity actions"
                          >
                            <MoreHorizontal className="size-4" />
                          </DropdownTrigger>
                          <DropdownContent>
                            <DropdownItem onSelect={() => (setEditing(a), setDialogOpen(true))}>
                              <Pencil /> Edit
                            </DropdownItem>
                            <DropdownItem danger onSelect={() => removeActivity(a)}>
                              <Trash2 /> Delete
                            </DropdownItem>
                          </DropdownContent>
                        </Dropdown>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <CardHeader
              title="Phase report"
              action={
                canManage && (
                  <Link
                    to="/admin/projects/$projectId/phases/$phaseId/edit"
                    params={{ projectId, phaseId }}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    Edit report
                  </Link>
                )
              }
            />
            <CardBody>
              {ph.report ? (
                <div className="report-content" dangerouslySetInnerHTML={{ __html: ph.report }} />
              ) : (
                <EmptyState icon={FileText} title="No report filed yet" className="py-8" />
              )}
            </CardBody>
          </Card>
        </div>
        <div className="space-y-4">
          <Card>
            <CardHeader title="About this phase" />
            <CardBody className="space-y-4">
              <p className="text-sm leading-relaxed whitespace-pre-line text-slate-700">
                {ph.description || 'No description.'}
              </p>
              <div>
                <div className="mb-1.5 flex justify-between text-xs">
                  <span className="eyebrow">Activities done</span>
                  <span className="font-mono">{percent(done, activities.length)}%</span>
                </div>
                <ProgressBar value={percent(done, activities.length)} tone="success" />
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Claims on this phase" />
            <DataTable
              className="rounded-none border-0"
              rows={ph.claims}
              rowLink={(c) => ({ to: '/admin/claims/$claimId', params: { claimId: String(c.id) } })}
              empty={<EmptyState icon={HandCoins} title="No claims yet" className="py-8" />}
              columns={[
                {
                  header: 'Claim',
                  cell: (c: Row) => (
                    <span>
                      <span className="block max-w-40 truncate font-semibold">{c.purpose}</span>
                      <StatusBadge
                        status={c.status}
                        label={CLAIM_STATUS_LABELS[c.status as keyof typeof CLAIM_STATUS_LABELS]}
                      />
                    </span>
                  ),
                },
                {
                  header: 'Amount',
                  align: 'right',
                  cell: (c: Row) => <Money amount={c.amount} currency={c.currency} />,
                },
              ]}
            />
          </Card>
          <div className="flex gap-2">
            {index > 0 && (
              <Button variant="outline" size="sm" className="flex-1" asChild>
                <Link
                  to="/admin/projects/$projectId/phases/$phaseId"
                  params={{ projectId, phaseId: String(siblings[index - 1]!.id) }}
                >
                  ← Phase {siblings[index - 1]!.phaseNo}
                </Link>
              </Button>
            )}
            {index < siblings.length - 1 && (
              <Button variant="outline" size="sm" className="flex-1" asChild>
                <Link
                  to="/admin/projects/$projectId/phases/$phaseId"
                  params={{ projectId, phaseId: String(siblings[index + 1]!.id) }}
                >
                  Phase {siblings[index + 1]!.phaseNo} →
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

function Tile({
  label,
  value,
  progress,
  danger,
}: {
  label: string
  value: string
  progress?: number
  danger?: boolean
}) {
  return (
    <div className={cn('rounded-2xl border bg-white p-4', danger && 'border-red-200 bg-secondary/40')}>
      <p className="eyebrow">{label}</p>
      <p className={cn('mt-1.5 font-mono text-lg font-semibold tabular-nums', danger && 'text-destructive')}>{value}</p>
      {progress !== undefined && (
        <ProgressBar value={progress} className="mt-2" tone={progress > 100 ? 'danger' : 'primary'} />
      )}
    </div>
  )
}
