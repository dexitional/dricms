import { useEffect, useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Clock, FolderKanban, Printer, Save, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { REQUEST_STATUSES } from '@dric/db/types'
import type { RequestType } from '@dric/db/types'
import { api, errorMessage } from '#/lib/api-client'
import { date, dateTime } from '#/lib/format'
import { REQUEST_FORM_BY_TYPE } from '#/lib/forms'
import { REQUEST_STATUS_LABELS } from '#/lib/labels'
import { Button } from '#/components/ui/button'
import { Card, CardBody, CardHeader } from '#/components/ui/card'
import { Skeleton } from '#/components/ui/skeleton'
import { Combobox } from '#/components/admin/combobox'
import { useLookup } from '#/components/admin/lookups'
import { OfficialPanel } from '#/components/admin/official-panel'
import { PageHeader, StatusBadge } from '#/components/admin/page'
import { RequestAnswers } from '#/components/admin/request-view'
import { useConfirm } from '#/components/admin/confirm'
import { useCan, useUser } from '#/components/admin/session'

export const Route = createFileRoute('/admin/requests/$requestId')({ component: RequestPage })

function RequestPage() {
  const { requestId } = Route.useParams()
  const user = useUser()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const canManage = useCan('requests', 'manage')
  const { confirm, dialog } = useConfirm()
  const { data: r } = useQuery({
    queryKey: ['requests', requestId],
    queryFn: () => api.get<Record<string, any>>(`/requests/${requestId}`),
  })
  if (!r) return <Skeleton className="h-[30rem]" />
  const def = REQUEST_FORM_BY_TYPE[r.type as RequestType]
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['requests'] })
  const remove = () =>
    confirm({
      title: `Delete request ${r.reference}?`,
      danger: true,
      confirmLabel: 'Delete request',
      onConfirm: async () => {
        try {
          await api.delete(`/requests/${requestId}`)
          toast.success('Request deleted')
          await refresh()
          await navigate({ to: '/admin/requests' })
        } catch (err) {
          toast.error(errorMessage(err))
        }
      },
    })
  return (
    <>
      {dialog}
      <PageHeader
        back={{ to: '/admin/requests', label: user.role === 'investigator' ? 'My requests' : 'Form requests' }}
        eyebrow={
          <span>
            <span className="font-mono">{r.reference}</span> · {def.title}
          </span>
        }
        title={r.projectTitle}
        meta={
          <>
            <StatusBadge
              status={r.status}
              label={REQUEST_STATUS_LABELS[r.status as keyof typeof REQUEST_STATUS_LABELS]}
            />
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="size-3.5" /> Submitted {dateTime(r.createdAt)} · allow {def.allowance}
            </span>
          </>
        }
        actions={
          <>
            <Button variant="outline" asChild>
              <a href={`/print/request/${r.reference}`} target="_blank" rel="noreferrer">
                <Printer /> Print form
              </a>
            </Button>
            {user.role === 'administrator' && (
              <Button variant="outline" size="icon" onClick={remove} aria-label="Delete request">
                <Trash2 />
              </Button>
            )}
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <RequestAnswers def={def} request={r} />
        </div>
        <div className="space-y-4">
          {canManage ? (
            <OfficialPanel
              record={r}
              endpoint={`/requests/${requestId}/official`}
              statusOptions={REQUEST_STATUSES.map((s) => ({ value: s, label: REQUEST_STATUS_LABELS[s] }))}
              statusRoles={['administrator', 'director', 'clerk']}
              showVc={def.vcDecision}
              showCondition={def.officialCondition}
              onSaved={() => void refresh()}
            />
          ) : (
            <Card>
              <CardHeader title="Progress" />
              <CardBody className="space-y-2 text-sm">
                <p>Received at DRIC: {date(r.receivedAt)}</p>
                <p className="whitespace-pre-line">Director’s decision: {r.directorDecision ?? 'Pending'}</p>
              </CardBody>
            </Card>
          )}
          {def.linksProject && <LinkedProject request={r} canEdit={canManage} onSaved={() => void refresh()} />}
          <Card>
            <CardHeader title="Declaration" />
            <CardBody className="text-sm">
              <p className="font-serif text-lg italic">{r.signedName}</p>
              <p className="text-xs text-muted-foreground">Signed electronically on {date(r.signedAt, 'long')}</p>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  )
}

function LinkedProject({
  request,
  canEdit,
  onSaved,
}: {
  request: Record<string, any>
  canEdit: boolean
  onSaved: () => void
}) {
  const projects = useLookup('projects')
  const [projectId, setProjectId] = useState<number | null>(request.projectId ?? null)
  useEffect(() => setProjectId(request.projectId ?? null), [request.projectId])
  const save = useMutation({
    mutationFn: () => api.patch(`/requests/${request.id}/official`, { projectId }),
    onSuccess: () => (toast.success('Project link saved'), onSaved()),
    onError: (err) => toast.error(errorMessage(err)),
  })
  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <FolderKanban className="size-4 text-muted-foreground" /> Linked project
          </span>
        }
        description={request.type === 'CLOSE_OUT' ? 'Approving the close-out closes this project.' : undefined}
      />
      <CardBody className="space-y-3">
        {request.projectId && (
          <Link
            to="/admin/projects/$projectId"
            params={{ projectId: String(request.projectId) }}
            className="block text-sm font-medium text-primary hover:underline"
          >
            <span className="font-mono">{request.projectCodeLinked}</span> — {request.projectTitleLinked}
          </Link>
        )}
        {canEdit && (
          <>
            <Combobox
              options={projects.data}
              loading={projects.isLoading}
              value={projectId}
              onChange={setProjectId}
              placeholder="Find the project…"
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={() => save.mutate()}
              disabled={save.isPending || projectId === (request.projectId ?? null)}
            >
              <Save /> Save link
            </Button>
          </>
        )}
        {!canEdit && !request.projectId && <p className="text-sm text-muted-foreground">Not linked</p>}
      </CardBody>
    </Card>
  )
}
