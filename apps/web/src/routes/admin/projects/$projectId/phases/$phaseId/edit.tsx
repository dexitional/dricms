import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { api } from '#/lib/api-client'
import { Skeleton } from '#/components/ui/skeleton'
import { PageHeader } from '#/components/admin/page'
import { PhaseForm } from '#/components/forms/phase-form'

export const Route = createFileRoute('/admin/projects/$projectId/phases/$phaseId/edit')({ component: EditPhase })

function EditPhase() {
  const { projectId, phaseId } = Route.useParams()
  const { data } = useQuery({
    queryKey: ['phases', phaseId],
    queryFn: () => api.get<Record<string, any>>(`/phases/${phaseId}`),
  })
  return (
    <>
      <PageHeader
        back={{
          to: '/admin/projects/$projectId/phases/$phaseId',
          label: data ? `Phase ${data.phaseNo}` : 'Phase',
          params: { projectId, phaseId },
        }}
        eyebrow={data?.projectTitle}
        title="Edit phase"
      />
      {data ? <PhaseForm projectId={projectId} currency={data.currency} phase={data} /> : <Skeleton className="h-96" />}
    </>
  )
}
