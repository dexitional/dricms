import { useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Copy,
  ExternalLink,
  Eye,
  FolderKanban,
  KeyRound,
  Landmark,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { api, errorMessage } from '#/lib/api-client'
import { date, money } from '#/lib/format'
import { PROJECT_STATUS_LABELS } from '#/lib/labels'
import { Button } from '#/components/ui/button'
import { Card, CardBody, CardHeader } from '#/components/ui/card'
import { DataTable } from '#/components/admin/data-table'
import { DetailList, EmptyState, FunderLogo, Money, PageHeader, StatusBadge } from '#/components/admin/page'
import { useConfirm } from '#/components/admin/confirm'
import { FUNDER_CONTACT_ROLES } from '#/lib/permissions'
import { useCan, useUser } from '#/components/admin/session'
import { DetailSkeleton } from '#/components/admin/skeletons'

export const Route = createFileRoute('/admin/funders/$funderId/')({ component: FunderPage })

type Row = Record<string, any>

function FunderPage() {
  const { funderId } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const canManage = useCan('funders', 'manage')
  const canRecord = useCan('remittances', 'manage')
  // Accountants and investigators don't see the funder's contact details or
  // grant-portal sign-in; roles without the funds ledger don't see the money.
  const seesContact = FUNDER_CONTACT_ROLES.includes(useUser().role)
  const seesFunds = useCan('remittances')
  const { confirm, dialog } = useConfirm()
  const [password, setPassword] = useState<string | null>(null)
  const { data: f, isLoading } = useQuery({
    queryKey: ['funders', funderId],
    queryFn: () => api.get<Row>(`/funders/${funderId}`),
  })
  if (isLoading || !f) return <DetailSkeleton />

  const reveal = async () => {
    try {
      const res = await api.get<{ password: string | null }>(`/funders/${funderId}/portal-password`)
      setPassword(res.password ?? '(could not decrypt)')
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }
  const remove = () =>
    confirm({
      title: `Delete ${f.name}?`,
      description: 'Projects linked to this funder will keep their records but lose the link.',
      confirmLabel: 'Delete funder',
      danger: true,
      onConfirm: async () => {
        try {
          await api.delete(`/funders/${funderId}`)
          toast.success('Funder deleted')
          await queryClient.invalidateQueries({ queryKey: ['funders'] })
          await navigate({ to: '/admin/funders' })
        } catch (err) {
          toast.error(errorMessage(err))
        }
      },
    })

  const totals = (f.projects as Array<Row>).reduce<Record<string, number>>(
    (acc, p) => ((acc[p.currency] = (acc[p.currency] ?? 0) + Number(p.totalFunding)), acc),
    {},
  )
  return (
    <>
      {dialog}
      <PageHeader
        back={{ to: '/admin/funders', label: 'Funders' }}
        title={
          <span className="flex items-center gap-4">
            <FunderLogo url={f.logoUrl} name={f.name} className="size-14 rounded-2xl" />
            {f.name}
          </span>
        }
        meta={
          <>
            {f.country && (
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="size-3.5" /> {[f.location, f.country].filter(Boolean).join(', ')}
              </span>
            )}
            {f.websiteUrl && (
              <a
                href={f.websiteUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                {f.websiteUrl.replace(/^https?:\/\//, '')} <ExternalLink className="size-3" />
              </a>
            )}
          </>
        }
        actions={
          canManage && (
            <>
              <Button variant="outline" onClick={remove}>
                <Trash2 /> Delete
              </Button>
              <Button asChild>
                <Link to="/admin/funders/$funderId/edit" params={{ funderId }}>
                  <Pencil /> Edit
                </Link>
              </Button>
            </>
          )
        }
      />
      <div className={seesContact ? 'grid gap-4 lg:grid-cols-3' : 'grid gap-4'}>
        <div className={seesContact ? 'space-y-4 lg:col-span-2' : 'space-y-4'}>
          <Card>
            <CardHeader title="About" />
            <CardBody>
              <p className="text-sm leading-relaxed whitespace-pre-line text-slate-700">
                {f.description || 'No description yet.'}
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardHeader
              title="Funded projects"
              description={
                Object.entries(totals)
                  .map(([c, t]) => `${c} ${t.toLocaleString()}`)
                  .join(' · ') || undefined
              }
            />
            <DataTable
              className="rounded-none border-0"
              rows={f.projects}
              rowLink={(p) => ({ to: '/admin/projects/$projectId', params: { projectId: String(p.id) } })}
              empty={<EmptyState icon={FolderKanban} title="No projects linked yet" />}
              columns={[
                {
                  header: 'Project',
                  cell: (p: Row) => (
                    <span>
                      <span className="block font-semibold text-slate-800">{p.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {p.code} · {p.piName ?? 'No PI'}
                      </span>
                    </span>
                  ),
                },
                {
                  header: 'Period',
                  cell: (p: Row) => (
                    <span className="text-xs whitespace-nowrap">
                      {date(p.startDate)} – {date(p.endDate)}
                    </span>
                  ),
                },
                {
                  header: 'Status',
                  cell: (p: Row) => (
                    <StatusBadge
                      status={p.status}
                      label={PROJECT_STATUS_LABELS[p.status as keyof typeof PROJECT_STATUS_LABELS]}
                    />
                  ),
                },
                seesFunds
                  ? {
                      header: 'Award / received',
                      align: 'right' as const,
                      cell: (p: Row) => (
                        <span>
                          <Money amount={p.totalFunding} currency={p.currency} className="block" />
                          <span className="text-[0.7rem] text-muted-foreground">
                            {money(p.received, p.currency, { compact: true })} received
                          </span>
                        </span>
                      ),
                    }
                  : {
                      header: 'Award',
                      align: 'right' as const,
                      cell: (p: Row) => <Money amount={p.totalFunding} currency={p.currency} />,
                    },
                ...(seesFunds
                  ? [
                      {
                        header: 'Balance',
                        align: 'right' as const,
                        cell: (p: Row) => (
                          <Money
                            amount={Number(p.received) - Number(p.disbursed)}
                            currency={p.currency}
                            className={
                              Number(p.received) - Number(p.disbursed) < 0
                                ? 'font-semibold text-destructive'
                                : 'font-semibold'
                            }
                          />
                        ),
                      },
                    ]
                  : []),
              ]}
            />
          </Card>
          {seesFunds && (
            <Card>
              <CardHeader
                title="Funds distributed"
                description="Remittances from this funder to DRIC projects, most recent first"
                action={
                  <div className="flex gap-2">
                    <Link
                      to="/admin/remittances"
                      search={{ funderId: Number(funderId) }}
                      className="self-center text-xs font-semibold text-primary hover:underline"
                    >
                      View all
                    </Link>
                    {canRecord && (
                      <Button size="sm" asChild>
                        <Link to="/admin/remittances/new" search={{ funderId: Number(funderId) }}>
                          <Plus /> Record remittance
                        </Link>
                      </Button>
                    )}
                  </div>
                }
              />
              <DataTable
                className="rounded-none border-0"
                rows={f.remittances}
                rowLink={(r) => ({
                  to: '/admin/projects/$projectId',
                  params: { projectId: String(r.projectId) },
                })}
                empty={<EmptyState icon={Landmark} title="No remittances recorded" className="py-8" />}
                columns={[
                  {
                    header: 'Reference',
                    cell: (r: Row) => (
                      <span>
                        <span className="block font-mono text-xs font-semibold">{r.reference}</span>
                        <span className="text-xs text-muted-foreground">{date(r.receivedAt)}</span>
                      </span>
                    ),
                  },
                  {
                    header: 'To project',
                    cell: (r: Row) => (
                      <span className="block max-w-xs text-xs">
                        <span className="block truncate font-medium">{r.projectTitle}</span>
                        <span className="font-mono text-muted-foreground">{r.projectCode}</span>
                      </span>
                    ),
                  },
                  {
                    header: 'Amount',
                    align: 'right',
                    cell: (r: Row) => (
                      <span>
                        <Money amount={r.amount} currency={r.currency} className="block font-semibold" />
                        {r.currency !== r.projectCurrency && (
                          <span className="text-[0.7rem] text-muted-foreground">
                            × {r.exchangeRate} = {money(r.amount * r.exchangeRate, r.projectCurrency)}
                          </span>
                        )}
                      </span>
                    ),
                  },
                ]}
              />
            </Card>
          )}
        </div>
        {seesContact && (
          <div className="space-y-4">
            <Card>
              <CardHeader title="Contact" />
              <CardBody className="space-y-3 text-sm">
                {f.email && (
                  <a href={`mailto:${f.email}`} className="flex items-center gap-2.5 text-primary hover:underline">
                    <Mail className="size-4 text-muted-foreground" /> {f.email}
                  </a>
                )}
                {f.phone && (
                  <a href={`tel:${f.phone}`} className="flex items-center gap-2.5">
                    <Phone className="size-4 text-muted-foreground" /> {f.phone}
                  </a>
                )}
                <DetailList
                  columns={1}
                  items={[
                    ['Address', f.address],
                    ['Added', date(f.createdAt)],
                  ]}
                />
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Grant portal" description="Funder’s online submission portal" />
              <CardBody className="space-y-4">
                <DetailList
                  columns={1}
                  items={[
                    [
                      'Portal address',
                      f.portalUrl ? (
                        <a
                          href={f.portalUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="break-all text-primary hover:underline"
                        >
                          {f.portalUrl}
                        </a>
                      ) : null,
                    ],
                    ['Username', f.portalUsername],
                  ]}
                />
                <div>
                  <p className="eyebrow">Password</p>
                  {f.hasPortalPassword ? (
                    password ? (
                      <div className="mt-1.5 flex items-center gap-2 rounded-xl bg-muted px-3 py-2 font-mono text-sm">
                        <span className="flex-1 break-all">{password}</span>
                        <button
                          type="button"
                          onClick={() => (navigator.clipboard.writeText(password), toast.success('Copied'))}
                          aria-label="Copy password"
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <Copy className="size-4" />
                        </button>
                      </div>
                    ) : canManage ? (
                      <Button variant="secondary" size="sm" className="mt-1.5" onClick={reveal}>
                        <Eye /> Reveal password
                      </Button>
                    ) : (
                      <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                        <KeyRound className="size-4" /> Stored securely
                      </p>
                    )
                  ) : (
                    <p className="mt-1 text-sm text-muted-foreground">Not stored</p>
                  )}
                  {password && (
                    <p className="mt-1.5 text-[0.7rem] text-muted-foreground">
                      Reveals are recorded in the activity log.
                    </p>
                  )}
                </div>
              </CardBody>
            </Card>
          </div>
        )}
      </div>
    </>
  )
}
