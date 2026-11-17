import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { api, errorMessage } from '#/lib/api-client'
import { money } from '#/lib/format'
import { Button } from '#/components/ui/button'
import { PageHeader } from '#/components/admin/page'
import { useConfirm } from '#/components/admin/confirm'
import { RemittanceForm } from '#/components/forms/remittance-form'
import { FormSkeleton } from '#/components/admin/skeletons'

export const Route = createFileRoute('/admin/remittances/$remittanceId/edit')({ component: EditRemittance })

function EditRemittance() {
  const { remittanceId } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { confirm, dialog } = useConfirm()
  const { data } = useQuery({
    queryKey: ['remittances', remittanceId],
    queryFn: () => api.get<Record<string, any>>(`/remittances/${remittanceId}`),
  })
  const remove = () =>
    confirm({
      title: `Delete remittance ${data?.reference}?`,
      description: `${money(data?.amount, data?.currency)} comes off the balance of ${data?.projectTitle}.`,
      danger: true,
      confirmLabel: 'Delete remittance',
      onConfirm: async () => {
        try {
          await api.delete(`/remittances/${remittanceId}`)
          toast.success('Remittance deleted')
          await queryClient.invalidateQueries()
          await navigate({ to: '/admin/remittances' })
        } catch (err) {
          toast.error(errorMessage(err))
        }
      },
    })
  return (
    <>
      {dialog}
      <PageHeader
        back={{ to: '/admin/remittances', label: 'Remittances' }}
        eyebrow={data && <span className="font-mono">{data.reference}</span>}
        title="Edit remittance"
        actions={
          data && (
            <Button variant="outline" size="icon" onClick={remove} aria-label="Delete remittance">
              <Trash2 />
            </Button>
          )
        }
      />
      {data ? <RemittanceForm remittance={data} /> : <FormSkeleton />}
    </>
  )
}
