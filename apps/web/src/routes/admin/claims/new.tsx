import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { PageHeader } from '#/components/admin/page'
import { ClaimForm } from '#/components/forms/claim-form'

export const Route = createFileRoute('/admin/claims/new')({
  validateSearch: z.object({ phaseId: z.coerce.number().optional(), projectId: z.coerce.number().optional() }),
  component: NewClaim,
})

function NewClaim() {
  const { phaseId, projectId } = Route.useSearch()
  return (
    <>
      <PageHeader
        back={{ to: '/admin/claims', label: 'Claims' }}
        title="Request for disbursement of funds"
        description="Request funds for a project phase. DRIC reviews the request and pays approved amounts in tranches."
      />
      <ClaimForm phaseId={phaseId} projectId={projectId} />
    </>
  )
}
