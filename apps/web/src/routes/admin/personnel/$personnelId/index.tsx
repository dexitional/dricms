import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ListChecks } from 'lucide-react'
import { api } from '#/lib/api-client'
import { date } from '#/lib/format'
import { ACTIVITY_STATUS_LABELS } from '#/lib/labels'
import { Card, CardHeader } from '#/components/ui/card'
import { Skeleton } from '#/components/ui/skeleton'
import { DataTable } from '#/components/admin/data-table'
import { EmptyState, Money, StatusBadge } from '#/components/admin/page'
import { PersonHeader, PersonSideCards } from '#/components/admin/person-detail'

export const Route = createFileRoute('/admin/personnel/$personnelId/')({ component: PersonnelPage })

type Row = Record<string, any>

function PersonnelPage() {
  const { personnelId } = Route.useParams()
  const { data: person } = useQuery({
    queryKey: ['personnel', personnelId],
    queryFn: () => api.get<Row>(`/personnel/${personnelId}`),
  })
  if (!person) return <Skeleton className="h-96" />
  return (
    <>
      <PersonHeader person={person} kind="personnel" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Assigned activities" />
          <DataTable
            className="rounded-none border-0"
            rows={person.activities}
            rowLink={(a) => ({
              to: '/admin/projects/$projectId/phases/$phaseId',
              params: { projectId: String(a.projectId), phaseId: String(a.phaseId) },
            })}
            empty={<EmptyState icon={ListChecks} title="No activities assigned" />}
            columns={[
              {
                header: 'Activity',
                cell: (a: Row) => (
                  <span>
                    <span className="block font-semibold">{a.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {a.projectTitle} · Phase {a.phaseNo}
                    </span>
                  </span>
                ),
              },
              {
                header: 'Dates',
                cell: (a: Row) => (
                  <span className="text-xs whitespace-nowrap">
                    {date(a.startDate)} – {date(a.endDate)}
                  </span>
                ),
              },
              {
                header: 'Status',
                cell: (a: Row) => (
                  <StatusBadge
                    status={a.status}
                    label={ACTIVITY_STATUS_LABELS[a.status as keyof typeof ACTIVITY_STATUS_LABELS]}
                  />
                ),
              },
              { header: 'Budget', align: 'right', cell: (a: Row) => <Money amount={a.amount} currency={a.currency} /> },
            ]}
          />
        </Card>
        <div className="space-y-4">
          <PersonSideCards person={person} />
        </div>
      </div>
    </>
  )
}
