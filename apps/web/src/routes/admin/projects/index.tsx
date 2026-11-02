import { useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { FolderKanban, Plus } from 'lucide-react'
import { api } from '#/lib/api-client'
import type { Page } from '#/lib/api-client'
import { date } from '#/lib/format'
import { PROJECT_STATUS_LABELS, PROJECT_TYPE_LABELS } from '#/lib/labels'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { DataTable, FilterSelect, Pagination, SearchInput, Toolbar } from '#/components/admin/data-table'
import { EmptyState, FunderLogo, Money, PageHeader, StatusBadge } from '#/components/admin/page'
import { useCan, useUser } from '#/components/admin/session'

export const Route = createFileRoute('/admin/projects/')({ component: ProjectsPage })

type Row = Record<string, any> & { id: number }

function ProjectsPage() {
  const user = useUser()
  const canManage = useCan('projects', 'manage')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [type, setType] = useState('')
  const [page, setPage] = useState(1)
  const { data, isLoading } = useQuery({
    queryKey: ['projects', { q, status, type, page }],
    queryFn: () => api.get<Page<Row>>('/projects', { q, status, type, page }),
    placeholderData: keepPreviousData,
  })
  return (
    <>
      <PageHeader
        title={user.role === 'investigator' ? 'My projects' : 'Projects'}
        description="Research projects and consultancies, each run in phases."
        actions={
          canManage && (
            <Button asChild>
              <Link to="/admin/projects/new">
                <Plus /> New project
              </Link>
            </Button>
          )
        }
      />
      <Toolbar>
        <SearchInput value={q} onChange={(v) => (setQ(v), setPage(1))} placeholder="Search title, code, funder, PI…" />
        <FilterSelect
          label="Status"
          value={status}
          onChange={(v) => (setStatus(v), setPage(1))}
          options={Object.entries(PROJECT_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
        />
        <FilterSelect
          label="Type"
          value={type}
          onChange={(v) => (setType(v), setPage(1))}
          options={Object.entries(PROJECT_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
        />
      </Toolbar>
      <DataTable
        loading={isLoading}
        rows={data?.data}
        rowLink={(r) => ({ to: '/admin/projects/$projectId', params: { projectId: String(r.id) } })}
        empty={
          <EmptyState
            icon={FolderKanban}
            title="No projects found"
            description={canManage ? 'Create a project to start tracking phases, claims and payments.' : undefined}
          />
        }
        columns={[
          {
            header: 'Project',
            cell: (r) => (
              <span className="flex items-center gap-3">
                <FunderLogo url={r.funderLogo} name={r.funderName ?? r.title} />
                <span className="min-w-0">
                  <span className="block max-w-md truncate font-semibold text-slate-800">{r.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    <span className="font-mono">{r.code}</span> · {r.funderName ?? 'No funder'}
                  </span>
                </span>
              </span>
            ),
          },
          { header: 'PI', cell: (r) => <span className="text-xs">{r.piName ?? '—'}</span> },
          {
            header: 'Type',
            cell: (r) => (
              <Badge tone={r.type === 'CONSULTANCY' ? 'warning' : 'brand'} dot={false}>
                {r.type === 'CONSULTANCY' ? 'Consultancy' : 'Research'}
              </Badge>
            ),
          },
          {
            header: 'Period',
            cell: (r) => (
              <span className="text-xs whitespace-nowrap">
                {date(r.startDate)} – {date(r.endDate)}
              </span>
            ),
          },
          {
            header: 'Status',
            cell: (r) => (
              <StatusBadge
                status={r.status}
                label={PROJECT_STATUS_LABELS[r.status as keyof typeof PROJECT_STATUS_LABELS]}
              />
            ),
          },
          {
            header: 'Award',
            align: 'right',
            cell: (r) => <Money amount={r.totalFunding} currency={r.currency} className="font-semibold" />,
          },
        ]}
      />
      {data && <Pagination page={page} pageSize={data.pageSize} total={data.total} onChange={setPage} />}
    </>
  )
}
