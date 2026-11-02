import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { PageHeader } from '#/components/admin/page'
import { PaymentForm } from '#/components/forms/payment-form'

export const Route = createFileRoute('/admin/payments/new')({
  validateSearch: z.object({ claimId: z.coerce.number().optional() }),
  component: NewPayment,
})

function NewPayment() {
  const { claimId } = Route.useSearch()
  return (
    <>
      <PageHeader
        back={{ to: '/admin/payments', label: 'Payments' }}
        title="Record tranche payment"
        description="Disburse part or all of an approved claim."
      />
      <PaymentForm claimId={claimId} />
    </>
  )
}
