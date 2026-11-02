import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { api } from '#/lib/api-client'
import { Skeleton } from '#/components/ui/skeleton'
import { PageHeader } from '#/components/admin/page'
import { ClaimForm } from '#/components/forms/claim-form'

export const Route = createFileRoute('/admin/claims/$claimId/edit')({ component: EditClaim })

function EditClaim() {
  const { claimId } = Route.useParams()
  const { data } = useQuery({
    queryKey: ['claims', claimId],
    queryFn: () => api.get<Record<string, any>>(`/claims/${claimId}`),
  })
  return (
    <>
      <PageHeader
        back={{ to: '/admin/claims/$claimId', label: data?.reference ?? 'Claim', params: { claimId } }}
        title="Edit claim"
      />
      {data ? <ClaimForm claim={data} /> : <Skeleton className="h-96" />}
    </>
  )
}
