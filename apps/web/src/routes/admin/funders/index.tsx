import { useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Building2, Plus } from 'lucide-react'
import { api } from '#/lib/api-client'
import type { Page } from '#/lib/api-client'
import { Button } from '#/components/ui/button'
import { DataTable, Pagination, SearchInput, Toolbar } from '#/components/admin/data-table'
import { EmptyState, FunderLogo, PageHeader } from '#/components/admin/page'
import { useCan } from '#/components/admin/session'

export const Route = createFileRoute('/admin/funders/')({ component: FundersPage })

type Row = Record<string, any> & { id: number }

function FundersPage() {
  const canManage = useCan('funders', 'manage')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const { data, isLoading } = useQuery({
    queryKey: ['funders', { q, page }],
    queryFn: () => api.get<Page<Row>>('/funders', { q, page }),
    placeholderData: keepPreviousData,
  })
  return (
    <>
      <PageHeader
        title="Funders"
        description="Agencies and organisations that fund DRIC projects and consultancies."
        actions={
          canManage && (
            <Button asChild>
              <Link to="/admin/funders/new">
                <Plus /> Add funder
              </Link>
            </Button>
          )
        }
      />
      <Toolbar>
        <SearchInput value={q} onChange={(v) => (setQ(v), setPage(1))} placeholder="Search name, email, country…" />
      </Toolbar>
      <DataTable
        loading={isLoading}
        rows={data?.data}
        rowLink={(r) => ({ to: '/admin/funders/$funderId', params: { funderId: String(r.id) } })}
        empty={
          <EmptyState
            icon={Building2}
            title={q ? 'No funders match your search' : 'No funders yet'}
            description="Add the organisations that award grants and consultancies."
          />
        }
        columns={[
          {
            header: 'Funder',
            cell: (r) => (
              <span className="flex items-center gap-3">
                <FunderLogo url={r.logoUrl} name={r.name} />
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-slate-800">{r.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {r.websiteUrl?.replace(/^https?:\/\//, '') ?? '—'}
                  </span>
                </span>
              </span>
            ),
          },
          { header: 'Country', cell: (r) => r.country ?? '—' },
          { header: 'Contact', cell: (r) => <span className="text-xs">{r.email ?? r.phone ?? '—'}</span> },
          { header: 'Projects', align: 'right', cell: (r) => <span className="font-mono">{r.projectsCount}</span> },
        ]}
      />
      {data && <Pagination page={page} pageSize={data.pageSize} total={data.total} onChange={setPage} />}
    </>
  )
}
