import { useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { Landmark, Paperclip, Pencil, Plus } from 'lucide-react'
import { api } from '#/lib/api-client'
import type { Page } from '#/lib/api-client'
import { date, money } from '#/lib/format'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { DataTable, FilterSelect, Pagination, SearchInput, Toolbar } from '#/components/admin/data-table'
import { EmptyState, FunderLogo, Money, PageHeader } from '#/components/admin/page'
import { useLookup } from '#/components/admin/lookups'
import { useCan, useUser } from '#/components/admin/session'

export const Route = createFileRoute('/admin/remittances/')({
  validateSearch: z.object({ funderId: z.coerce.number().optional() }),
  component: RemittancesPage,
})

type Row = Record<string, any> & { id: number }

function RemittancesPage() {
  const user = useUser()
  const canManage = useCan('remittances', 'manage')
  const funders = useLookup('funders')
  const [q, setQ] = useState('')
  const [funderId, setFunderId] = useState(String(Route.useSearch().funderId ?? ''))
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const { data, isLoading } = useQuery({
    queryKey: ['remittances', { q, funderId, from, to, page }],
    queryFn: () => api.get<Page<Row> & { totals: Array<Row> }>('/remittances', { q, funderId, from, to, page }),
    placeholderData: keepPreviousData,
  })
  return (
    <>
      <PageHeader
        title={user.role === 'investigator' ? 'Funds received' : 'Funder remittances'}
        description="Money funders have distributed to projects. Each remittance is credited to the project’s balance sheet; tranche payments draw it down."
        actions={
          canManage && (
            <Button asChild>
              <Link to="/admin/remittances/new">
                <Plus /> Record remittance
              </Link>
            </Button>
          )
        }
      />
      {data && data.totals.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {data.totals.map((t) => (
            <span key={t.currency} className="rounded-full border bg-white px-3.5 py-1.5 text-sm">
              <span className="font-mono font-semibold tabular-nums">{money(t.total, t.currency)}</span>{' '}
              <span className="text-xs text-muted-foreground">
                in {t.count} remittance{t.count === 1 ? '' : 's'}
              </span>
            </span>
          ))}
        </div>
      )}
      <Toolbar>
        <SearchInput
          value={q}
          onChange={(v) => (setQ(v), setPage(1))}
          placeholder="Search reference, project, funder…"
        />
        {user.role !== 'investigator' && (
          <FilterSelect
            label="Funder"
            value={funderId}
            onChange={(v) => (setFunderId(v), setPage(1))}
            options={(funders.data ?? []).map((f) => ({ value: String(f.value), label: f.label }))}
          />
        )}
        <label className="flex flex-col gap-1">
          <span className="pl-3 text-xs font-medium text-muted-foreground">From</span>
          <Input
            type="date"
            value={from}
            onChange={(e) => (setFrom(e.target.value), setPage(1))}
            className="w-40 rounded-full"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="pl-3 text-xs font-medium text-muted-foreground">To</span>
          <Input
            type="date"
            value={to}
            onChange={(e) => (setTo(e.target.value), setPage(1))}
            className="w-40 rounded-full"
          />
        </label>
      </Toolbar>
      <DataTable
        loading={isLoading}
        rows={data?.data}
        rowLink={(r) => ({ to: '/admin/projects/$projectId', params: { projectId: String(r.projectId) } })}
        empty={
          <EmptyState
            icon={Landmark}
            title="No remittances found"
            description="Record the funds each funder sends so every project shows its real balance."
          />
        }
        columns={[
          {
            header: 'Reference',
            cell: (r) => (
              <span className="flex items-center gap-3">
                <span className="flex h-9 items-center rounded-xl bg-primary-soft px-2.5 font-mono text-xs font-bold text-primary">
                  {r.reference}
                </span>
                <span className="text-xs text-muted-foreground">{date(r.receivedAt)}</span>
              </span>
            ),
          },
          {
            header: 'Funder',
            cell: (r) =>
              r.funderName ? (
                <span className="flex items-center gap-2 text-xs">
                  <FunderLogo url={r.funderLogo} name={r.funderName} className="size-7" />
                  <span className="max-w-40 truncate">{r.funderName}</span>
                </span>
              ) : (
                '—'
              ),
          },
          {
            header: 'Project',
            cell: (r) => (
              <span className="block max-w-xs text-xs">
                <span className="block truncate font-medium">{r.projectTitle}</span>
                <span className="font-mono text-muted-foreground">{r.projectCode}</span>
              </span>
            ),
          },
          {
            header: 'Proof',
            cell: (r) =>
              r.attachmentsCount ? (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Paperclip className="size-3.5" /> {r.attachmentsCount}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">—</span>
              ),
          },
          {
            header: 'Amount',
            align: 'right',
            cell: (r) => (
              <span>
                <Money amount={r.amount} currency={r.currency} className="block font-semibold" />
                {r.currency !== r.projectCurrency && (
                  <span className="text-[0.7rem] text-muted-foreground">
                    × {r.exchangeRate} = {money(r.converted, r.projectCurrency)}
                  </span>
                )}
              </span>
            ),
          },
          ...(canManage
            ? [
                {
                  header: '',
                  align: 'right' as const,
                  cell: (r: Row) => (
                    <Link
                      to="/admin/remittances/$remittanceId/edit"
                      params={{ remittanceId: String(r.id) }}
                      className="inline-flex rounded-full p-1.5 text-muted-foreground hover:bg-accent"
                      aria-label="Edit remittance"
                    >
                      <Pencil className="size-4" />
                    </Link>
                  ),
                },
              ]
            : []),
        ]}
      />
      {data && <Pagination page={page} pageSize={data.pageSize} total={data.total} onChange={setPage} />}
    </>
  )
}
