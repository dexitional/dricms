import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { PageHeader } from '#/components/admin/page'
import { RemittanceForm } from '#/components/forms/remittance-form'

export const Route = createFileRoute('/admin/remittances/new')({
  validateSearch: z.object({ funderId: z.coerce.number().optional(), projectId: z.coerce.number().optional() }),
  component: NewRemittance,
})

function NewRemittance() {
  const { funderId, projectId } = Route.useSearch()
  return (
    <>
      <PageHeader
        back={{ to: '/admin/remittances', label: 'Remittances' }}
        title="Record funder remittance"
        description="Funds a funder has sent for a project. They are added to the project’s balance in its own currency."
      />
      <RemittanceForm funderId={funderId} projectId={projectId} />
    </>
  )
}
