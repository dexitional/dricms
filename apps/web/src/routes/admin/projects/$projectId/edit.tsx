import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { api } from '#/lib/api-client'
import { PageHeader } from '#/components/admin/page'
import { ProjectForm } from '#/components/forms/project-form'
import { FormSkeleton } from '#/components/admin/skeletons'

export const Route = createFileRoute('/admin/projects/$projectId/edit')({ component: EditProject })

function EditProject() {
  const { projectId } = Route.useParams()
  const { data } = useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => api.get<Record<string, any>>(`/projects/${projectId}`),
  })
  return (
    <>
      <PageHeader
        back={{ to: '/admin/projects/$projectId', label: data?.title ?? 'Project', params: { projectId } }}
        eyebrow={data?.code}
        title="Edit project"
      />
      {data ? <ProjectForm project={data} /> : <FormSkeleton sections={3} />}
    </>
  )
}
