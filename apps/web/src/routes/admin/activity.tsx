import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Activity } from 'lucide-react'
import { api } from '#/lib/api-client'
import type { Page } from '#/lib/api-client'
import { dateTime } from '#/lib/format'
import { ROLE_LABELS } from '#/lib/labels'
import { Badge } from '#/components/ui/badge'
import { DataTable, FilterSelect, Pagination, SearchInput, Toolbar } from '#/components/admin/data-table'
import { EmptyState, PageHeader } from '#/components/admin/page'

export const Route = createFileRoute('/admin/activity')({ component: ActivityPage })

type Row = Record<string, any> & { id: number }
const ENTITIES = [
  'project',
  'phase',
  'activity',
  'funder',
  'investigator',
  'personnel',
  'claim',
  'payment',
  'request',
  'user',
]
const TONES: Record<string, 'success' | 'info' | 'danger' | 'warning'> = {
  create: 'success',
  update: 'info',
  delete: 'danger',
  reveal: 'warning',
}

function ActivityPage() {
  const [q, setQ] = useState('')
  const [entity, setEntity] = useState('')
  const [page, setPage] = useState(1)
  const { data, isLoading } = useQuery({
    queryKey: ['audit', { q, entity, page }],
    queryFn: () => api.get<Page<Row>>('/audit', { q, entity, page }),
    placeholderData: keepPreviousData,
  })
  return (
    <>
      <PageHeader
        title="Activity log"
        description="Every change made in the portal, and every portal-password reveal."
      />
      <Toolbar>
        <SearchInput value={q} onChange={(v) => (setQ(v), setPage(1))} placeholder="Search summaries or people…" />
        <FilterSelect
          label="Record"
          value={entity}
          onChange={(v) => (setEntity(v), setPage(1))}
          options={ENTITIES.map((e) => ({ value: e, label: e[0]!.toUpperCase() + e.slice(1) }))}
        />
      </Toolbar>
      <DataTable
        loading={isLoading}
        rows={data?.data}
        empty={<EmptyState icon={Activity} title="No activity recorded" />}
        columns={[
          {
            header: 'When',
            cell: (r) => (
              <span className="text-xs whitespace-nowrap text-muted-foreground">{dateTime(r.createdAt)}</span>
            ),
          },
          { header: 'Action', cell: (r) => <Badge tone={TONES[r.action] ?? 'neutral'}>{r.action}</Badge> },
          { header: 'Summary', cell: (r) => <span className="text-sm">{r.summary}</span> },
          {
            header: 'By',
            cell: (r) => (
              <span className="text-xs">
                {r.userName ? `${r.userName} · ${ROLE_LABELS[r.userRole as keyof typeof ROLE_LABELS]}` : 'Public form'}
              </span>
            ),
          },
        ]}
      />
      {data && <Pagination page={page} pageSize={data.pageSize} total={data.total} onChange={setPage} />}
    </>
  )
}
