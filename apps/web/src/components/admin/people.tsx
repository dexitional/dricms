import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Plus, Users } from 'lucide-react'
import { api } from '#/lib/api-client'
import type { Page } from '#/lib/api-client'
import { personName } from '#/lib/format'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { DataTable, FilterSelect, Pagination, SearchInput, Toolbar } from './data-table'
import { Avatar, EmptyState, PageHeader } from './page'
import { useCan } from './session'

type Row = Record<string, any> & { id: number }

/** List page shared by investigators and personnel. */
export function PeopleList({ kind }: { kind: 'investigator' | 'personnel' }) {
  const isInv = kind === 'investigator'
  const canManage = useCan(isInv ? 'investigators' : 'personnel', 'manage')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const { data, isLoading } = useQuery({
    queryKey: [kind, { q, status, page }],
    queryFn: () => api.get<Page<Row>>(isInv ? '/investigators' : '/personnel', { q, status, page }),
    placeholderData: keepPreviousData,
  })
  return (
    <>
      <PageHeader
        title={isInv ? 'Investigators' : 'Personnel'}
        description={
          isInv
            ? 'Principal and co-investigators who lead and coordinate projects.'
            : 'People assigned to manage activities within project phases.'
        }
        actions={
          canManage && (
            <Button asChild>
              <Link to={isInv ? '/admin/investigators/new' : '/admin/personnel/new'}>
                <Plus /> Add {isInv ? 'investigator' : 'personnel'}
              </Link>
            </Button>
          )
        }
      />
      <Toolbar>
        <SearchInput value={q} onChange={(v) => (setQ(v), setPage(1))} placeholder="Search name, staff no., email…" />
        <FilterSelect
          label="Status"
          value={status}
          onChange={(v) => (setStatus(v), setPage(1))}
          options={[
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
          ]}
        />
      </Toolbar>
      <DataTable
        loading={isLoading}
        rows={data?.data}
        rowLink={(r): { to: string; params: Record<string, string> } =>
          isInv
            ? { to: '/admin/investigators/$investigatorId', params: { investigatorId: String(r.id) } }
            : { to: '/admin/personnel/$personnelId', params: { personnelId: String(r.id) } }
        }
        empty={<EmptyState icon={Users} title="No one here yet" />}
        columns={[
          {
            header: 'Name',
            cell: (r) => (
              <span className="flex items-center gap-3">
                <Avatar name={personName(r)} />
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-slate-800">{personName(r)}</span>
                  <span className="block truncate text-xs text-muted-foreground">{r.email ?? '—'}</span>
                </span>
              </span>
            ),
          },
          { header: 'Staff no.', cell: (r) => <span className="font-mono text-xs">{r.staffNo ?? '—'}</span> },
          { header: 'Department', cell: (r) => <span className="text-xs">{r.department ?? '—'}</span> },
          isInv
            ? {
                header: 'Projects',
                cell: (r) => (
                  <span className="text-xs whitespace-nowrap">
                    {r.piCount} as PI · {r.coCount} as Co-I
                  </span>
                ),
              }
            : {
                header: 'Activities',
                align: 'right' as const,
                cell: (r) => <span className="font-mono">{r.activitiesCount}</span>,
              },
          {
            header: 'Status',
            cell: (r) => (
              <span className="flex gap-1.5">
                <Badge tone={r.isActive ? 'success' : 'neutral'}>{r.isActive ? 'Active' : 'Inactive'}</Badge>
                {isInv && r.hasAccount ? (
                  <Badge tone="brand" dot={false}>
                    Portal
                  </Badge>
                ) : null}
              </span>
            ),
          },
        ]}
      />
      {data && <Pagination page={page} pageSize={data.pageSize} total={data.total} onChange={setPage} />}
    </>
  )
}
