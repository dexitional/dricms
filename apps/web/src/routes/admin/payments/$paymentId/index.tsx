import { useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, FileCheck2, MoreHorizontal, Pencil, Plus, Printer, ReceiptText, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@dric/ui'
import { api, errorMessage } from '#/lib/api-client'
import { date, dateTime, money, percent } from '#/lib/format'
import { RETIREMENT_STATE_LABELS, RETIREMENT_STATUS_LABELS } from '#/lib/labels'
import { RETIREMENT_REVIEW_ROLES } from '#/lib/permissions'
import { Button } from '#/components/ui/button'
import { Card, CardBody, CardHeader } from '#/components/ui/card'
import { Dialog, DialogContent } from '#/components/ui/dialog'
import { Dropdown, DropdownContent, DropdownItem, DropdownTrigger } from '#/components/ui/dropdown'
import { Textarea } from '#/components/ui/input'
import { DetailList, EmptyState, Money, PageHeader, ProgressBar, StatusBadge } from '#/components/admin/page'
import { AttachmentList } from '#/components/admin/file-upload'
import { Field } from '#/components/admin/form'
import { useConfirm } from '#/components/admin/confirm'
import { useCan, useUser } from '#/components/admin/session'
import { RetirementDialog } from '#/components/forms/retirement-dialog'
import { DetailSkeleton } from '#/components/admin/skeletons'

export const Route = createFileRoute('/admin/payments/$paymentId/')({ component: PaymentPage })

type Row = Record<string, any>

function PaymentPage() {
  const { paymentId } = Route.useParams()
  const queryClient = useQueryClient()
  const user = useUser()
  const canPay = useCan('payments', 'manage')
  const canRetire = useCan('retirements', 'manage')
  const canReview = RETIREMENT_REVIEW_ROLES.includes(user.role)
  const { confirm, dialog } = useConfirm()
  const [editing, setEditing] = useState<Row | null>(null)
  const [lineOpen, setLineOpen] = useState(false)
  const [rejecting, setRejecting] = useState<Row | null>(null)
  const { data: p } = useQuery({
    queryKey: ['payments', paymentId],
    queryFn: () => api.get<Row>(`/payments/${paymentId}`),
  })

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['payments'] })
    await queryClient.invalidateQueries({ queryKey: ['claims'] })
    await queryClient.invalidateQueries({ queryKey: ['projects'] })
    await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }
  const review = useMutation({
    mutationFn: (v: { id: number; status: 'ACCEPTED' | 'REJECTED'; reviewNote?: string }) =>
      api.patch(`/retirements/${v.id}/review`, { status: v.status, reviewNote: v.reviewNote ?? null }),
    onSuccess: async (_r, v) => {
      toast.success(v.status === 'ACCEPTED' ? 'Receipts accepted' : 'Receipts rejected')
      setRejecting(null)
      await refresh()
    },
    onError: (err) => toast.error(errorMessage(err)),
  })

  if (!p) return <DetailSkeleton metrics={3} />

  const lines = p.retirements as Array<Row>
  const activities = p.activities as Array<{ id: number; title: string }>
  const canChange = (l: Row) =>
    canRetire && l.status !== 'ACCEPTED' && (user.role !== 'investigator' || l.createdBy === user.id)
  const remove = (l: Row) =>
    confirm({
      title: 'Remove this retirement line?',
      description: `${l.description} — ${money(l.amount, p.currency)}`,
      danger: true,
      confirmLabel: 'Remove line',
      onConfirm: async () => {
        try {
          await api.delete(`/retirements/${l.id}`)
          toast.success('Line removed')
          await refresh()
        } catch (err) {
          toast.error(errorMessage(err))
        }
      },
    })
  const byActivity = activities
    .map((a) => {
      const own = lines.filter((l) => l.activityId === a.id && l.status !== 'REJECTED')
      return { ...a, spent: own.reduce((s, l) => s + Number(l.amount), 0), receipts: own.length }
    })
    .filter((a) => a.receipts > 0)

  return (
    <>
      {dialog}
      <RetirementDialog
        open={lineOpen}
        onOpenChange={setLineOpen}
        paymentId={p.id}
        currency={p.currency}
        activities={activities}
        left={p.retirementLeft}
        line={editing}
      />
      <RejectDialog
        line={rejecting}
        currency={p.currency}
        pending={review.isPending}
        onClose={() => setRejecting(null)}
        onReject={(note) => review.mutate({ id: rejecting!.id, status: 'REJECTED', reviewNote: note })}
      />
      <PageHeader
        back={{ to: '/admin/payments', label: 'Payments' }}
        eyebrow={<span className="font-mono">Tranche {p.reference}</span>}
        title={p.claimPurpose}
        meta={
          <>
            <StatusBadge status={p.retirement} label={RETIREMENT_STATE_LABELS[p.retirement]} />
            <Link
              to="/admin/claims/$claimId"
              params={{ claimId: String(p.claimId) }}
              className="text-xs text-muted-foreground hover:text-primary"
            >
              <span className="font-mono">{p.claimReference}</span> · {p.projectTitle} · Phase {p.phaseNo}
            </Link>
          </>
        }
        actions={
          <>
            <Button variant="outline" asChild>
              <a href={`/print/retirement/${p.id}`} target="_blank" rel="noreferrer">
                <FileCheck2 /> Retirement statement
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a href={`/print/payment/${p.id}`} target="_blank" rel="noreferrer">
                <Printer /> Voucher
              </a>
            </Button>
            {canPay && (
              <Button asChild>
                <Link to="/admin/payments/$paymentId/edit" params={{ paymentId }}>
                  <Pencil /> Edit
                </Link>
              </Button>
            )}
          </>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-primary bg-primary p-4 text-white">
          <p className="eyebrow text-white/60">Tranche paid</p>
          <p className="mt-1.5 font-mono text-lg font-semibold">{money(p.amount, p.currency)}</p>
          <p className="mt-1 text-xs text-white/65">
            {p.projectRate
              ? `${money(p.amount * p.projectRate, p.projectCurrency)} charged to the project`
              : `No rate into ${p.projectCurrency} yet`}
          </p>
        </div>
        <Tile
          label="Retired (accepted)"
          value={money(p.retired, p.currency)}
          progress={percent(p.retired, p.amount)}
          tone="success"
        />
        <Tile label="Awaiting review" value={money(p.retirePending, p.currency)} />
        <Tile label="Left to retire" value={money(p.retirementLeft, p.currency)} danger={p.retirementLeft > 0.009} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Retirement"
            description="Receipts for how the tranche was spent, activity by activity. Only accepted receipts count as retired."
            action={
              canRetire &&
              p.retirementLeft > 0.009 && (
                <Button size="sm" onClick={() => (setEditing(null), setLineOpen(true))}>
                  <Plus /> Add receipts
                </Button>
              )
            }
          />
          {lines.length === 0 ? (
            <EmptyState
              icon={ReceiptText}
              title="Not retired yet"
              description={
                activities.length
                  ? 'Upload receipts against the phase’s activities to account for this tranche.'
                  : 'The phase has no activities yet. Add the activities first, then retire against them.'
              }
            />
          ) : (
            <ul className="divide-y">
              {lines.map((l) => (
                <li key={l.id} className="px-5 py-4">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-slate-900">{l.description}</p>
                        <StatusBadge
                          status={l.status}
                          label={RETIREMENT_STATUS_LABELS[l.status as keyof typeof RETIREMENT_STATUS_LABELS]}
                        />
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {l.activityTitle} · spent {date(l.spentAt)} · entered by {l.createdByName ?? '—'}
                      </p>
                      <AttachmentList files={l.receipts} className="mt-2.5" />
                      {l.reviewedAt && (
                        <p
                          className={cn(
                            'mt-2 rounded-xl px-3 py-2 text-xs',
                            l.status === 'REJECTED' ? 'bg-secondary text-secondary-foreground' : 'bg-muted',
                          )}
                        >
                          {l.status === 'REJECTED' ? 'Rejected' : 'Reviewed'} by {l.reviewedByName ?? '—'} ·{' '}
                          {dateTime(l.reviewedAt)}
                          {l.reviewNote && <span className="block font-medium">{l.reviewNote}</span>}
                        </p>
                      )}
                    </div>
                    <Money amount={l.amount} currency={p.currency} className="shrink-0 font-semibold" />
                    {(canChange(l) || (canReview && l.status !== 'ACCEPTED')) && (
                      <Dropdown>
                        <DropdownTrigger
                          className="rounded-full p-1.5 text-muted-foreground hover:bg-accent"
                          aria-label="Line actions"
                        >
                          <MoreHorizontal className="size-4" />
                        </DropdownTrigger>
                        <DropdownContent>
                          {canReview && l.status === 'SUBMITTED' && (
                            <>
                              <DropdownItem onSelect={() => review.mutate({ id: l.id, status: 'ACCEPTED' })}>
                                <Check /> Accept receipts
                              </DropdownItem>
                              <DropdownItem onSelect={() => setRejecting(l)}>
                                <X /> Reject…
                              </DropdownItem>
                            </>
                          )}
                          {canChange(l) && (
                            <>
                              <DropdownItem onSelect={() => (setEditing(l), setLineOpen(true))}>
                                <Pencil /> Edit
                              </DropdownItem>
                              <DropdownItem danger onSelect={() => remove(l)}>
                                <Trash2 /> Remove
                              </DropdownItem>
                            </>
                          )}
                        </DropdownContent>
                      </Dropdown>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="By activity" description={`Receipts submitted or accepted (${p.currency})`} />
            <CardBody className="space-y-3.5">
              {byActivity.length === 0 && <p className="text-sm text-muted-foreground">Nothing retired yet.</p>}
              {byActivity.map((a) => (
                <div key={a.id}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate font-medium text-slate-700">{a.title}</span>
                    <span className="shrink-0 font-mono text-xs tabular-nums">{money(a.spent, p.currency)}</span>
                  </div>
                  <ProgressBar value={percent(a.spent, p.amount)} />
                </div>
              ))}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Tranche" />
            <CardBody>
              <DetailList
                columns={1}
                items={[
                  ['Payee', p.payee],
                  ['Date issued', date(p.paidAt, 'long')],
                  [
                    'Claim currency',
                    p.currency === p.claimCurrency
                      ? p.claimCurrency
                      : `${money(p.converted, p.claimCurrency)} at ${p.conversionRate}`,
                  ],
                  [
                    'Project',
                    <Link
                      key="p"
                      to="/admin/projects/$projectId"
                      params={{ projectId: String(p.projectId) }}
                      className="text-primary hover:underline"
                    >
                      {p.projectCode} — {p.projectTitle}
                    </Link>,
                  ],
                  ['Phase', `Phase ${p.phaseNo}: ${p.phaseTitle}`],
                  ['Description', p.description],
                  ['Recorded by', p.createdByName],
                ]}
              />
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  )
}

function Tile({
  label,
  value,
  progress,
  tone = 'primary',
  danger,
}: {
  label: string
  value: string
  progress?: number
  tone?: 'primary' | 'success'
  danger?: boolean
}) {
  return (
    <div className={cn('rounded-2xl border bg-white p-4', danger && 'border-red-200 bg-secondary/40')}>
      <p className="eyebrow">{label}</p>
      <p className={cn('mt-1.5 font-mono text-lg font-semibold tabular-nums', danger && 'text-destructive')}>{value}</p>
      {progress !== undefined && <ProgressBar value={progress} tone={tone} className="mt-2" />}
    </div>
  )
}

function RejectDialog({
  line,
  currency,
  pending,
  onClose,
  onReject,
}: {
  line: Row | null
  currency: string
  pending: boolean
  onClose: () => void
  onReject: (note: string) => void
}) {
  const [note, setNote] = useState('')
  return (
    <Dialog open={Boolean(line)} onOpenChange={(open) => (!open && onClose(), setNote(''))}>
      <DialogContent
        title="Reject these receipts?"
        description={line ? `${line.description} — ${money(line.amount, currency)}` : undefined}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (note.trim()) onReject(note.trim())
          }}
          className="space-y-4"
        >
          <Field label="Reason" required hint="The investigator sees this and can correct and resubmit the line.">
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={500} autoFocus />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={pending || !note.trim()}>
              <X /> Reject receipts
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
