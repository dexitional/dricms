import { createFileRoute } from '@tanstack/react-router'
import { PageHeader } from '#/components/admin/page'
import { ProjectForm } from '#/components/forms/project-form'

export const Route = createFileRoute('/admin/projects/new')({
  component: () => (
    <>
      <PageHeader
        back={{ to: '/admin/projects', label: 'Projects' }}
        title="New project"
        description="A project code (DRIC-YYYY-NNN) is assigned when you save."
      />
      <ProjectForm />
    </>
  ),
})
