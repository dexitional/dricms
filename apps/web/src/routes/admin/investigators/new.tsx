import { createFileRoute } from '@tanstack/react-router'
import { PageHeader } from '#/components/admin/page'
import { PersonForm } from '#/components/forms/person-form'

export const Route = createFileRoute('/admin/investigators/new')({
  component: () => (
    <>
      <PageHeader back={{ to: '/admin/investigators', label: 'Investigators' }} title="Add investigator" />
      <PersonForm kind="investigator" />
    </>
  ),
})
