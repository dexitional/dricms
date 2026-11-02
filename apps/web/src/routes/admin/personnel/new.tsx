import { createFileRoute } from '@tanstack/react-router'
import { PageHeader } from '#/components/admin/page'
import { PersonForm } from '#/components/forms/person-form'

export const Route = createFileRoute('/admin/personnel/new')({
  component: () => (
    <>
      <PageHeader back={{ to: '/admin/personnel', label: 'Personnel' }} title="Add personnel" />
      <PersonForm kind="personnel" />
    </>
  ),
})
