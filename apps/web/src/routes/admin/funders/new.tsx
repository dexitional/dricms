import { createFileRoute } from '@tanstack/react-router'
import { PageHeader } from '#/components/admin/page'
import { FunderForm } from '#/components/forms/funder-form'

export const Route = createFileRoute('/admin/funders/new')({
  component: () => (
    <>
      <PageHeader
        back={{ to: '/admin/funders', label: 'Funders' }}
        title="Add funder"
        description="Register a funding agency so projects can be linked to it."
      />
      <FunderForm />
    </>
  ),
})
