import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { api } from '#/lib/api-client'
import { personName } from '#/lib/format'
import { Skeleton } from '#/components/ui/skeleton'
import { PageHeader } from '#/components/admin/page'
import { PersonForm } from '#/components/forms/person-form'

export const Route = createFileRoute('/admin/investigators/$investigatorId/edit')({ component: Edit })

function Edit() {
  const { investigatorId } = Route.useParams()
  const { data } = useQuery({
    queryKey: ['investigator', investigatorId],
    queryFn: () => api.get<Record<string, any>>(`/investigators/${investigatorId}`),
  })
  return (
    <>
      <PageHeader
        back={{
          to: '/admin/investigators/$investigatorId',
          label: data ? personName(data) : 'Investigator',
          params: { investigatorId },
        }}
        title="Edit investigator"
      />
      {data ? <PersonForm kind="investigator" person={data} /> : <Skeleton className="h-96" />}
    </>
  )
}
