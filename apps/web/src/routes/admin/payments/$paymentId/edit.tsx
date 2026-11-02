import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Printer, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { api, errorMessage } from '#/lib/api-client'
import { Button } from '#/components/ui/button'
import { Skeleton } from '#/components/ui/skeleton'
import { PageHeader } from '#/components/admin/page'
import { useConfirm } from '#/components/admin/confirm'
import { PaymentForm } from '#/components/forms/payment-form'

export const Route = createFileRoute('/admin/payments/$paymentId/edit')({ component: EditPayment })

function EditPayment() {
  const { paymentId } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { confirm, dialog } = useConfirm()
  const { data } = useQuery({
    queryKey: ['payments', paymentId],
    queryFn: () => api.get<Record<string, any>>(`/payments/${paymentId}`),
  })
  const remove = () =>
    confirm({
      title: `Delete tranche ${data?.reference}?`,
      description: 'The amount goes back onto the claim’s outstanding balance.',
      danger: true,
      confirmLabel: 'Delete tranche',
      onConfirm: async () => {
        try {
          await api.delete(`/payments/${paymentId}`)
          toast.success('Tranche deleted')
          await queryClient.invalidateQueries()
          await navigate({ to: '/admin/claims/$claimId', params: { claimId: String(data!.claimId) } })
        } catch (err) {
          toast.error(errorMessage(err))
        }
      },
    })
  return (
    <>
      {dialog}
      <PageHeader
        back={{ to: '/admin/payments', label: 'Payments' }}
        eyebrow={data && <span className="font-mono">Tranche {data.reference}</span>}
        title="Edit tranche payment"
        actions={
          data && (
            <>
              <Button variant="outline" asChild>
                <a href={`/print/payment/${paymentId}`} target="_blank" rel="noreferrer">
                  <Printer /> Voucher
                </a>
              </Button>
              <Button variant="outline" size="icon" onClick={remove} aria-label="Delete tranche">
                <Trash2 />
              </Button>
            </>
          )
        }
      />
      {data ? <PaymentForm payment={data} /> : <Skeleton className="h-96" />}
    </>
  )
}
