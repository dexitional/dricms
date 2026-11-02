import { useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { HandCoins, Plus } from 'lucide-react'
import { CLAIM_STATUSES } from '@dric/db/types'
import { api } from '#/lib/api-client'
import type { Page } from '#/lib/api-client'
import { date, percent } from '#/lib/format'
import { CLAIM_STATUS_LABELS } from '#/lib/labels'
import { Button } from '#/components/ui/button'
import { DataTable, Pagination, SearchInput, Toolbar } from '#/components/admin/data-table'
import { EmptyState, Money, PageHeader, ProgressBar, StatusBadge } from '#/components/admin/page'
import { StatusTabs } from '#/components/admin/status-tabs'
import { useCan, useUser } from '#/components/admin/session'

export const Route = createFileRoute('/admin/claims/')({
  validateSearch: z.object({ status: z.enum(CLAIM_STATUSES).optional() }),
  component: ClaimsPage,
})

type Row = Record<string, any> & { id: number }

function ClaimsPage() {
  const user = useUser()
  const canManage = useCan('claims', 'manage')
  const { status = '' } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const { data, isLoading } = useQuery({
    queryKey: ['claims', { q, status, page }],
    queryFn: () =>
      api.get<Page<Row> & { summary: Array<{ status: string; count: number }> }>('/claims', { q, status, page }),
    placeholderData: keepPreviousData,
  })
  return (
    <>
      <PageHeader
        title={user.role === 'investigator' ? 'My claims' : 'Claims'}
        description="Requests for disbursement of project funds, paid out in tranches."
        actions={
          canManage && (
            <Button asChild>
              <Link to="/admin/claims/new">
                <Plus /> New claim
              </Link>
            </Button>
          )
        }
      />
      <StatusTabs
        value={status}
        onChange={(v) => (setPage(1), navigate({ search: v ? { status: v as (typeof CLAIM_STATUSES)[number] } : {} }))}
        options={CLAIM_STATUSES.map((s) => ({ value: s, label: CLAIM_STATUS_LABELS[s] }))}
        counts={data?.summary}
      />
      <Toolbar>
        <SearchInput
          value={q}
          onChange={(v) => (setQ(v), setPage(1))}
          placeholder="Search reference, purpose, project, PI…"
        />
      </Toolbar>
      <DataTable
        loading={isLoading}
        rows={data?.data}
        rowLink={(r) => ({ to: '/admin/claims/$claimId', params: { claimId: String(r.id) } })}
        empty={<EmptyState icon={HandCoins} title="No claims found" />}
        columns={[
          {
            header: 'Claim',
            cell: (r) => (
              <span className="block min-w-0">
                <span className="block max-w-sm truncate font-semibold text-slate-800">{r.purpose}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  <span className="font-mono">{r.reference}</span> · {date(r.createdAt)}
                </span>
              </span>
            ),
          },
          {
            header: 'Project / phase',
            cell: (r) => (
              <span className="block max-w-xs text-xs">
                <span className="block truncate font-medium">{r.projectTitle}</span>
                <span className="text-muted-foreground">
                  Phase {r.phaseNo}: {r.phaseTitle}
                </span>
              </span>
            ),
          },
          { header: 'Requested by', cell: (r) => <span className="text-xs">{r.requesterName ?? '—'}</span> },
          {
            header: 'Status',
            cell: (r) => (
              <StatusBadge
                status={r.status}
                label={CLAIM_STATUS_LABELS[r.status as keyof typeof CLAIM_STATUS_LABELS]}
              />
            ),
          },
          {
            header: 'Paid',
            cell: (r) => (
              <div className="w-24">
                <ProgressBar value={percent(r.paid, r.amount)} tone="success" />
                <p className="mt-1 font-mono text-[0.68rem] text-muted-foreground">{percent(r.paid, r.amount)}%</p>
              </div>
            ),
          },
          {
            header: 'Amount',
            align: 'right',
            cell: (r) => <Money amount={r.amount} currency={r.currency} className="font-semibold" />,
          },
        ]}
      />
      {data && <Pagination page={page} pageSize={data.pageSize} total={data.total} onChange={setPage} />}
    </>
  )
}
