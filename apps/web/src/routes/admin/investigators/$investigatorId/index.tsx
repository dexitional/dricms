import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { FolderKanban, HandCoins } from 'lucide-react'
import { api } from '#/lib/api-client'
import { date } from '#/lib/format'
import { CLAIM_STATUS_LABELS, PROJECT_STATUS_LABELS } from '#/lib/labels'
import { Badge } from '#/components/ui/badge'
import { Card, CardBody, CardHeader } from '#/components/ui/card'
import { Skeleton } from '#/components/ui/skeleton'
import { DataTable } from '#/components/admin/data-table'
import { DetailList, EmptyState, Money, StatusBadge } from '#/components/admin/page'
import { PersonHeader, PersonSideCards, PortalAccountCard } from '#/components/admin/person-detail'

export const Route = createFileRoute('/admin/investigators/$investigatorId/')({ component: InvestigatorPage })

type Row = Record<string, any>

function InvestigatorPage() {
  const { investigatorId } = Route.useParams()
  const { data: inv } = useQuery({
    queryKey: ['investigator', investigatorId],
    queryFn: () => api.get<Row>(`/investigators/${investigatorId}`),
  })
  if (!inv) return <Skeleton className="h-96" />
  return (
    <>
      <PersonHeader person={inv} kind="investigator" />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader title="Institutional particulars" description="Printed on the DRIC request forms" />
            <CardBody>
              <DetailList
                items={[
                  ['College', inv.college],
                  ['Faculty / School', inv.faculty],
                  ['Department', inv.department],
                  ['Designation', inv.designation],
                ]}
              />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Projects" />
            <DataTable
              className="rounded-none border-0"
              rows={inv.projects}
              rowLink={(p) => ({ to: '/admin/projects/$projectId', params: { projectId: String(p.id) } })}
              empty={<EmptyState icon={FolderKanban} title="Not on any projects yet" />}
              columns={[
                {
                  header: 'Project',
                  cell: (p: Row) => (
                    <span>
                      <span className="block font-semibold">{p.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {p.code} · {date(p.startDate)} – {date(p.endDate)}
                      </span>
                    </span>
                  ),
                },
                {
                  header: 'Role',
                  cell: (p: Row) => (
                    <Badge tone={p.role === 'PI' ? 'brand' : 'neutral'} dot={false}>
                      {p.role}
                    </Badge>
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
                {
                  header: 'Award',
                  align: 'right',
                  cell: (p: Row) => <Money amount={p.totalFunding} currency={p.currency} />,
                },
              ]}
            />
          </Card>
          <Card>
            <CardHeader title="Recent claims" />
            <DataTable
              className="rounded-none border-0"
              rows={inv.claims}
              rowLink={(c) => ({ to: '/admin/claims/$claimId', params: { claimId: String(c.id) } })}
              empty={<EmptyState icon={HandCoins} title="No claims yet" />}
              columns={[
                {
                  header: 'Claim',
                  cell: (c: Row) => (
                    <span>
                      <span className="block font-semibold">{c.purpose}</span>
                      <span className="text-xs text-muted-foreground">
                        {c.reference} · {c.projectTitle}
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
                  header: 'Amount',
                  align: 'right',
                  cell: (c: Row) => <Money amount={c.amount} currency={c.currency} />,
                },
              ]}
            />
          </Card>
        </div>
        <div className="space-y-4">
          <PortalAccountCard investigator={inv} />
          <PersonSideCards person={inv} />
        </div>
      </div>
    </>
  )
}
