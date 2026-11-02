import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ExternalLink, FileStack } from 'lucide-react'
import { REQUEST_STATUSES } from '@dric/db/types'
import type { RequestType } from '@dric/db/types'
import { api } from '#/lib/api-client'
import type { Page } from '#/lib/api-client'
import { date } from '#/lib/format'
import { REQUEST_FORMS, REQUEST_FORM_BY_TYPE } from '#/lib/forms'
import { REQUEST_STATUS_LABELS } from '#/lib/labels'
import { Button } from '#/components/ui/button'
import { DataTable, FilterSelect, Pagination, SearchInput, Toolbar } from '#/components/admin/data-table'
import { EmptyState, PageHeader, StatusBadge } from '#/components/admin/page'
import { StatusTabs } from '#/components/admin/status-tabs'
import { useUser } from '#/components/admin/session'

export const Route = createFileRoute('/admin/requests/')({ component: RequestsPage })

type Row = Record<string, any> & { id: number }

function RequestsPage() {
  const user = useUser()
  const [q, setQ] = useState('')
  const [type, setType] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const { data, isLoading } = useQuery({
    queryKey: ['requests', { q, type, status, page }],
    queryFn: () =>
      api.get<Page<Row> & { summary: Array<{ status: string; count: number }> }>('/requests', {
        q,
        type,
        status,
        page,
      }),
    placeholderData: keepPreviousData,
  })
  return (
    <>
      <PageHeader
        title={user.role === 'investigator' ? 'My requests' : 'Form requests'}
        description="Submissions of the DRIC request forms: intent to submit, letters of support, proposal reviews, close-outs and equipment transfers."
        actions={
          <Button variant="outline" asChild>
            <a href="/#forms" target="_blank" rel="noreferrer">
              <ExternalLink /> Open forms site
            </a>
          </Button>
        }
      />
      <StatusTabs
        value={status}
        onChange={(v) => (setStatus(v), setPage(1))}
        options={REQUEST_STATUSES.map((s) => ({ value: s, label: REQUEST_STATUS_LABELS[s] }))}
        counts={data?.summary}
      />
      <Toolbar>
        <SearchInput
          value={q}
          onChange={(v) => (setQ(v), setPage(1))}
          placeholder="Search reference, title, applicant…"
        />
        <FilterSelect
          label="Form"
          value={type}
          onChange={(v) => (setType(v), setPage(1))}
          options={REQUEST_FORMS.map((f) => ({ value: f.type, label: f.shortTitle }))}
        />
      </Toolbar>
      <DataTable
        loading={isLoading}
        rows={data?.data}
        rowLink={(r) => ({ to: '/admin/requests/$requestId', params: { requestId: String(r.id) } })}
        empty={<EmptyState icon={FileStack} title="No requests found" />}
        columns={[
          {
            header: 'Request',
            cell: (r) => {
              const def = REQUEST_FORM_BY_TYPE[r.type as RequestType]
              return (
                <span className="flex items-center gap-3">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: def.accent }} />
                  <span className="min-w-0">
                    <span className="block max-w-md truncate font-semibold text-slate-800">{r.projectTitle}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      <span className="font-mono">{r.reference}</span> · {def.shortTitle}
                    </span>
                  </span>
                </span>
              )
            },
          },
          {
            header: 'Applicant',
            cell: (r) => (
              <span className="text-xs">
                <span className="block font-medium">
                  {r.firstName} {r.surname}
                </span>
                <span className="text-muted-foreground">{r.department}</span>
              </span>
            ),
          },
          { header: 'Submitted', cell: (r) => <span className="text-xs whitespace-nowrap">{date(r.createdAt)}</span> },
          {
            header: 'Status',
            cell: (r) => (
              <StatusBadge
                status={r.status}
                label={REQUEST_STATUS_LABELS[r.status as keyof typeof REQUEST_STATUS_LABELS]}
              />
            ),
          },
        ]}
      />
      {data && <Pagination page={page} pageSize={data.pageSize} total={data.total} onChange={setPage} />}
    </>
  )
}
