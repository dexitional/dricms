import { useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Banknote, Plus, Printer } from 'lucide-react'
import { api } from '#/lib/api-client'
import type { Page } from '#/lib/api-client'
import { date, money } from '#/lib/format'
import { RETIREMENT_STATE_LABELS } from '#/lib/labels'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { DataTable, FilterSelect, Pagination, SearchInput, Toolbar } from '#/components/admin/data-table'
import { EmptyState, Money, PageHeader, StatusBadge } from '#/components/admin/page'
import { useCan } from '#/components/admin/session'

export const Route = createFileRoute('/admin/payments/')({
  validateSearch: z.object({ retirement: z.string().optional() }),
  component: PaymentsPage,
})

type Row = Record<string, any> & { id: number }

function PaymentsPage() {
  const canManage = useCan('payments', 'manage')
  const [q, setQ] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [retirement, setRetirement] = useState(Route.useSearch().retirement ?? '')
  const [page, setPage] = useState(1)
  const { data, isLoading } = useQuery({
    queryKey: ['payments', { q, from, to, retirement, page }],
    queryFn: () => api.get<Page<Row>>('/payments', { q, from, to, retirement, page }),
    placeholderData: keepPreviousData,
  })
  return (
    <>
      <PageHeader
        title="Payments"
        description="Tranche disbursements against approved claims. Each tranche is retired with receipts for what it was spent on."
        actions={
          canManage && (
            <Button asChild>
              <Link to="/admin/payments/new">
                <Plus /> Record payment
              </Link>
            </Button>
          )
        }
      />
      <Toolbar>
        <SearchInput
          value={q}
          onChange={(v) => (setQ(v), setPage(1))}
          placeholder="Search reference, claim, project, payee…"
        />
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
        <FilterSelect
          label="Retirement"
          value={retirement}
          onChange={(v) => (setRetirement(v), setPage(1))}
          options={[
            { value: 'outstanding', label: 'Not fully retired' },
            { value: 'unretired', label: RETIREMENT_STATE_LABELS.UNRETIRED! },
            { value: 'partial', label: RETIREMENT_STATE_LABELS.PARTIAL! },
            { value: 'retired', label: RETIREMENT_STATE_LABELS.RETIRED! },
          ]}
        />
      </Toolbar>
      <DataTable
        loading={isLoading}
        rows={data?.data}
        rowLink={(r) => ({ to: '/admin/payments/$paymentId', params: { paymentId: String(r.id) } })}
        empty={<EmptyState icon={Banknote} title="No payments found" />}
        columns={[
          {
            header: 'Reference',
            cell: (r) => (
              <span className="flex items-center gap-3">
                <span className="flex h-9 items-center rounded-xl bg-success-soft px-2.5 font-mono text-xs font-bold text-emerald-700">
                  {r.reference}
                </span>
                <span className="text-xs text-muted-foreground">{date(r.paidAt)}</span>
              </span>
            ),
          },
          {
            header: 'Claim / project',
            cell: (r) => (
              <span className="block max-w-xs text-xs">
                <span className="block truncate font-medium">{r.projectTitle}</span>
                <span className="text-muted-foreground">
                  <span className="font-mono">{r.claimReference}</span> · Phase {r.phaseNo}
                </span>
              </span>
            ),
          },
          { header: 'Payee', cell: (r) => <span className="text-xs">{r.payee ?? '—'}</span> },
          {
            header: 'Retirement',
            cell: (r) => <StatusBadge status={r.retirement} label={RETIREMENT_STATE_LABELS[r.retirement]} />,
          },
          {
            header: 'Amount',
            align: 'right',
            cell: (r) => (
              <span>
                <Money amount={r.amount} currency={r.currency} className="block font-semibold" />
                {r.currency !== r.claimCurrency && (
                  <span className="text-[0.7rem] text-muted-foreground">≈ {money(r.converted, r.claimCurrency)}</span>
                )}
              </span>
            ),
          },
          {
            header: '',
            align: 'right',
            cell: (r) => (
              <a
                href={`/print/payment/${r.id}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex rounded-full p-1.5 text-muted-foreground hover:bg-accent"
                aria-label="Print voucher"
              >
                <Printer className="size-4" />
              </a>
            ),
          },
        ]}
      />
      {data && <Pagination page={page} pageSize={data.pageSize} total={data.total} onChange={setPage} />}
    </>
  )
}
