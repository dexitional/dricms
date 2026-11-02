import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Banknote, Pencil, Plus, Printer, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { CLAIM_STATUSES } from '@dric/db/types'
import { api, errorMessage } from '#/lib/api-client'
import { date, money, num, percent, personName } from '#/lib/format'
import { CLAIM_STATUS_LABELS } from '#/lib/labels'
import { CLAIM_STATUS_ROLES } from '#/lib/permissions'
import { amountInWords } from '#/lib/words'
import { Button } from '#/components/ui/button'
import { Card, CardBody, CardHeader } from '#/components/ui/card'
import { Skeleton } from '#/components/ui/skeleton'
import { DataTable } from '#/components/admin/data-table'
import { DetailList, EmptyState, Money, PageHeader, ProgressBar, StatusBadge } from '#/components/admin/page'
import { OfficialPanel } from '#/components/admin/official-panel'
import { useConfirm } from '#/components/admin/confirm'
import { useCan, useUser } from '#/components/admin/session'

export const Route = createFileRoute('/admin/claims/$claimId/')({ component: ClaimPage })

type Row = Record<string, any>

function ClaimPage() {
  const { claimId } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const user = useUser()
  const canPay = useCan('payments', 'manage')
  const canManage = useCan('claims', 'manage')
  const { confirm, dialog } = useConfirm()
  const { data: c } = useQuery({ queryKey: ['claims', claimId], queryFn: () => api.get<Row>(`/claims/${claimId}`) })
  if (!c) return <Skeleton className="h-[30rem]" />

  const hasPayments = (c.payments as Array<Row>).length > 0
  const own = user.role !== 'investigator' || c.investigatorId === user.investigatorId
  const editable = canManage && !hasPayments && (user.role !== 'investigator' || (own && c.status === 'PENDING'))
  const deletable = editable && ['administrator', 'clerk', 'investigator'].includes(user.role)
  const requester = personName({
    title: '',
    firstName: c.reqFirstName,
    middleName: c.reqMiddleName,
    lastName: c.reqLastName,
  })

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['claims'] })
    await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }
  const remove = () =>
    confirm({
      title: `Delete claim ${c.reference}?`,
      danger: true,
      confirmLabel: 'Delete claim',
      onConfirm: async () => {
        try {
          await api.delete(`/claims/${claimId}`)
          toast.success('Claim deleted')
          await refresh()
          await navigate({ to: '/admin/claims' })
        } catch (err) {
          toast.error(errorMessage(err))
        }
      },
    })

  return (
    <>
      {dialog}
      <PageHeader
        back={{ to: '/admin/claims', label: 'Claims' }}
        eyebrow={<span className="font-mono">{c.reference}</span>}
        title={c.purpose}
        meta={
          <>
            <StatusBadge status={c.status} label={CLAIM_STATUS_LABELS[c.status as keyof typeof CLAIM_STATUS_LABELS]} />
            <Link
              to="/admin/projects/$projectId/phases/$phaseId"
              params={{ projectId: String(c.projectId), phaseId: String(c.phaseId) }}
              className="text-xs text-muted-foreground hover:text-primary"
            >
              {c.projectTitle} · Phase {c.phaseNo}: {c.phaseTitle}
            </Link>
          </>
        }
        actions={
          <>
            <Button variant="outline" asChild>
              <a href={`/print/claim/${claimId}`} target="_blank" rel="noreferrer">
                <Printer /> Print form
              </a>
            </Button>
            {deletable && (
              <Button variant="outline" size="icon" onClick={remove} aria-label="Delete claim">
                <Trash2 />
              </Button>
            )}
            {editable && (
              <Button asChild>
                <Link to="/admin/claims/$claimId/edit" params={{ claimId }}>
                  <Pencil /> Edit
                </Link>
              </Button>
            )}
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-primary bg-primary p-4 text-white">
              <p className="eyebrow text-white/60">Requested</p>
              <p className="mt-1.5 font-mono text-lg font-semibold">{money(c.amount, c.currency)}</p>
            </div>
            <div className="rounded-2xl border bg-white p-4">
              <p className="eyebrow">Paid ({(c.payments as Array<Row>).length} tranches)</p>
              <p className="mt-1.5 font-mono text-lg font-semibold">{money(c.paid, c.currency)}</p>
              <ProgressBar value={percent(c.paid, c.amount)} tone="success" className="mt-2" />
            </div>
            <div className="rounded-2xl border bg-white p-4">
              <p className="eyebrow">Outstanding</p>
              <p className="mt-1.5 font-mono text-lg font-semibold">{money(c.balance, c.currency)}</p>
            </div>
          </div>
          <Card>
            <CardHeader title="Request details" />
            <CardBody className="space-y-5">
              <DetailList
                items={[
                  ['Brief description of activity', c.description],
                  ['Specific reason(s) for requesting funds', c.reasons],
                  ['Funding agency', c.funderName],
                  [
                    'Project code',
                    <span key="c" className="font-mono">
                      {c.projectCode}
                    </span>,
                  ],
                ]}
              />
              <div className="rounded-xl bg-muted px-4 py-3">
                <p className="eyebrow">Total amount requested (in words)</p>
                <p className="mt-1 text-sm font-medium">{amountInWords(c.amount, c.currency)}</p>
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Breakdown of amount requested" description="Based on activities and items" />
            {(c.items as Array<Row>).length === 0 ? (
              <EmptyState title="Lump-sum request" description="No breakdown was provided." className="py-8" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="bg-slate-50/80 text-left">
                    <tr>
                      {['S/No.', 'Description', 'Quantity', 'Days', `Unit cost`, `Total (${c.currency})`].map(
                        (h, i) => (
                          <th key={h} className={`eyebrow px-4 py-2.5 ${i >= 4 ? 'text-right' : ''}`}>
                            {h}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(c.items as Array<Row>).map((i, idx) => (
                      <tr key={idx}>
                        <td className="px-4 py-2.5 font-mono text-xs">{idx + 1}.</td>
                        <td className="px-4 py-2.5">{i.description}</td>
                        <td className="px-4 py-2.5 font-mono text-xs">
                          {num(i.quantity)} {i.unit}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs">{num(i.days)}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-xs">{num(i.unitCost)}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-xs font-semibold">{num(i.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t bg-slate-50/80">
                      <td colSpan={5} className="px-4 py-2.5 text-right text-xs font-bold uppercase">
                        Total amount
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold">{money(c.amount, c.currency)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Card>
          <Card>
            <CardHeader
              title="Tranche payments"
              action={
                canPay &&
                c.status === 'APPROVED' &&
                c.balance > 0.009 && (
                  <Button size="sm" asChild>
                    <Link to="/admin/payments/new" search={{ claimId: Number(claimId) }}>
                      <Plus /> Pay tranche
                    </Link>
                  </Button>
                )
              }
              description={c.status !== 'APPROVED' ? 'Payments can be made once the claim is approved.' : undefined}
            />
            <DataTable
              className="rounded-none border-0"
              rows={c.payments}
              empty={<EmptyState icon={Banknote} title="No tranches paid yet" className="py-8" />}
              columns={[
                { header: 'Tranche', cell: (p: Row) => <span className="font-mono font-semibold">{p.reference}</span> },
                { header: 'Description', cell: (p: Row) => <span className="text-xs">{p.description ?? '—'}</span> },
                { header: 'Date issued', cell: (p: Row) => date(p.paidAt) },
                {
                  header: 'Amount',
                  align: 'right',
                  cell: (p: Row) => (
                    <span>
                      <Money amount={p.amount} currency={p.currency} className="block font-semibold" />
                      {p.currency !== c.currency && (
                        <span className="text-[0.7rem] text-muted-foreground">
                          × {p.conversionRate} = {money(p.converted, c.currency)}
                        </span>
                      )}
                    </span>
                  ),
                },
                {
                  header: '',
                  align: 'right',
                  cell: (p: Row) => (
                    <span className="flex gap-1">
                      {canPay && (
                        <Link
                          to="/admin/payments/$paymentId/edit"
                          params={{ paymentId: String(p.id) }}
                          className="rounded-full p-1.5 text-muted-foreground hover:bg-accent"
                          aria-label="Edit tranche"
                        >
                          <Pencil className="size-4" />
                        </Link>
                      )}
                      <a
                        href={`/print/payment/${p.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full p-1.5 text-muted-foreground hover:bg-accent"
                        aria-label="Print voucher"
                      >
                        <Printer className="size-4" />
                      </a>
                    </span>
                  ),
                },
              ]}
            />
          </Card>
        </div>
        <div className="space-y-4">
          <OfficialPanel
            record={c}
            endpoint={`/claims/${claimId}/official`}
            statusOptions={CLAIM_STATUSES.map((s) => ({ value: s, label: CLAIM_STATUS_LABELS[s] }))}
            statusRoles={CLAIM_STATUS_ROLES}
            showVc
            onSaved={() => void refresh()}
          />
          <Card>
            <CardHeader title="Principal investigator / lead consultant" />
            <CardBody>
              <DetailList
                columns={1}
                items={[
                  [
                    'Name',
                    c.investigatorId ? (
                      <Link
                        key="n"
                        to="/admin/investigators/$investigatorId"
                        params={{ investigatorId: String(c.investigatorId) }}
                        className="text-primary hover:underline"
                      >
                        {[c.reqTitle, requester].filter(Boolean).join(' ')}
                      </Link>
                    ) : null,
                  ],
                  ['College', c.reqCollege],
                  ['Faculty / School', c.reqFaculty],
                  ['Department', c.reqDepartment],
                  ['Designation', c.reqDesignation],
                  ['Email', c.reqEmail],
                  ['Phone', c.reqPhone],
                  ['Signed', c.signedName ? `${c.signedName} · ${date(c.signedAt)}` : null],
                  ['Entered by', c.createdByName],
                ]}
              />
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  )
}
