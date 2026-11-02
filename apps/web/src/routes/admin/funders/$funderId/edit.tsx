import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { api } from '#/lib/api-client'
import { Skeleton } from '#/components/ui/skeleton'
import { PageHeader } from '#/components/admin/page'
import { FunderForm } from '#/components/forms/funder-form'

export const Route = createFileRoute('/admin/funders/$funderId/edit')({ component: EditFunder })

function EditFunder() {
  const { funderId } = Route.useParams()
  const { data } = useQuery({
    queryKey: ['funders', funderId],
    queryFn: () => api.get<Record<string, any>>(`/funders/${funderId}`),
  })
  return (
    <>
      <PageHeader
        back={{ to: '/admin/funders/$funderId', label: data?.name ?? 'Funder', params: { funderId } }}
        title="Edit funder"
      />
      {data ? <FunderForm funder={data} /> : <Skeleton className="h-96" />}
    </>
  )
}
