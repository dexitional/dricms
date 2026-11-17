import { createFileRoute, notFound, useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '#/lib/api-client'
import type { Option } from '#/lib/api-client'
import { REQUEST_FORM_BY_SLUG } from '#/lib/forms'
import { useLookup } from '#/components/admin/lookups'
import { EmptyState, PageHeader } from '#/components/admin/page'
import { useUser } from '#/components/admin/session'
import { FormIcon } from '#/components/site/form-icon'
import { RequestForm, RequestFormAside } from '#/components/site/request-form'

export const Route = createFileRoute('/admin/requests/new/$slug')({
  loader: ({ params }) => {
    const def = REQUEST_FORM_BY_SLUG[params.slug]
    if (!def) throw notFound()
    return { title: def.shortTitle }
  },
  head: ({ loaderData }) => ({ meta: [{ title: `${loaderData?.title ?? 'Request form'} · DRIC Grants` }] }),
  component: PortalRequestFormPage,
})

type ProjectOption = Option & { code: string }

/** A DRIC request form filled in from the investigator portal. */
function PortalRequestFormPage() {
  const { slug } = Route.useParams()
  const def = REQUEST_FORM_BY_SLUG[slug]!
  const user = useUser()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const projects = useLookup<ProjectOption>('projects')
  if (user.role !== 'investigator') {
    return (
      <EmptyState
        title="Request forms are filled in by investigators"
        description="Staff record requests from the forms site."
      />
    )
  }

  // Open the new request in My requests, where its status can be followed.
  const onSubmitted = async ({ reference }: { reference: string }) => {
    toast.success(`Request ${reference} sent to DRIC`)
    await queryClient.invalidateQueries({ queryKey: ['requests'] })
    await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    try {
      const request = await api.get<{ id: number }>(`/requests/ref/${reference}`)
      await navigate({ to: '/admin/requests/$requestId', params: { requestId: String(request.id) } })
    } catch {
      await navigate({ to: '/admin/requests' })
    }
  }

  return (
    <>
      <PageHeader
        back={{ to: '/admin/requests/new', label: 'Choose a form' }}
        title={
          <span className="flex items-center gap-4">
            <span
              className="flex size-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm"
              style={{ background: def.accent }}
            >
              <FormIcon name={def.icon} className="size-5" />
            </span>
            {def.title}
          </span>
        }
        description={def.summary}
      />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="rounded-2xl border bg-white p-6 sm:p-8">
          <RequestForm
            def={def}
            onSubmitted={onSubmitted}
            projects={(projects.data ?? []).map((p) => ({ code: p.code, title: p.label }))}
          />
        </div>
        <RequestFormAside def={def} />
      </div>
    </>
  )
}
