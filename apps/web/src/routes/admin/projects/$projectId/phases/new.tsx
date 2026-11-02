import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { api } from '#/lib/api-client'
import { Skeleton } from '#/components/ui/skeleton'
import { PageHeader } from '#/components/admin/page'
import { PhaseForm } from '#/components/forms/phase-form'

export const Route = createFileRoute('/admin/projects/$projectId/phases/new')({ component: NewPhase })

function NewPhase() {
  const { projectId } = Route.useParams()
  const { data } = useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => api.get<Record<string, any>>(`/projects/${projectId}`),
  })
  return (
    <>
      <PageHeader
        back={{ to: '/admin/projects/$projectId', label: data?.title ?? 'Project', params: { projectId } }}
        eyebrow={data?.code}
        title="Add phase"
      />
      {data ? <PhaseForm projectId={projectId} currency={data.currency} /> : <Skeleton className="h-96" />}
    </>
  )
}
