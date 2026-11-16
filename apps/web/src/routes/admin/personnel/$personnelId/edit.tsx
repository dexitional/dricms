import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { api } from '#/lib/api-client'
import { personName } from '#/lib/format'
import { PageHeader } from '#/components/admin/page'
import { PersonForm } from '#/components/forms/person-form'
import { FormSkeleton } from '#/components/admin/skeletons'

export const Route = createFileRoute('/admin/personnel/$personnelId/edit')({ component: Edit })

function Edit() {
  const { personnelId } = Route.useParams()
  const { data } = useQuery({
    queryKey: ['personnel', personnelId],
    queryFn: () => api.get<Record<string, any>>(`/personnel/${personnelId}`),
  })
  return (
    <>
      <PageHeader
        back={{
          to: '/admin/personnel/$personnelId',
          label: data ? personName(data) : 'Personnel',
          params: { personnelId },
        }}
        title="Edit personnel"
      />
      {data ? <PersonForm kind="personnel" person={data} /> : <FormSkeleton sections={3} />}
    </>
  )
}
