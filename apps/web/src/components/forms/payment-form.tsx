import { useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { z } from 'zod'
import { Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@dric/ui'
import { api, errorMessage } from '#/lib/api-client'
import type { Option } from '#/lib/api-client'
import { paymentSchema } from '#/lib/schemas'
import { money, today } from '#/lib/format'
import { Button } from '#/components/ui/button'
import { Input, NativeSelect } from '#/components/ui/input'
import { Field, FormActions, FormSection } from '#/components/admin/form'
import { Combobox } from '#/components/admin/combobox'
import { CURRENCY_OPTIONS, useLookup } from '#/components/admin/lookups'

type In = z.input<typeof paymentSchema>
type Out = z.output<typeof paymentSchema>
type ClaimOption = Option & { amount: number; currency: string; balance: number }

export function PaymentForm({ payment, claimId }: { payment?: Record<string, any>; claimId?: number }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const claims = useLookup<ClaimOption>('claims')
  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<In, unknown, Out>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      claimId: claimId ?? ('' as never),
      currency: 'GHS',
      conversionRate: 1,
      amount: '' as never,
      paidAt: today(),
    },
  })
  useEffect(() => {
    if (payment)
      reset({
        claimId: payment.claimId,
        description: payment.description ?? '',
        amount: payment.amount,
        currency: payment.currency,
        conversionRate: payment.conversionRate,
        paidAt: payment.paidAt,
      })
  }, [payment, reset])
  const selectedId = Number(watch('claimId'))
  const claim = claims.data?.find((c) => c.value === selectedId)
  // Default the tranche currency to the claim's currency for new payments.
  useEffect(() => {
    if (!payment && claim) setValue('currency', claim.currency as never)
  }, [payment, claim, setValue])

  const currency = watch('currency') as string
  const sameCurrency = claim ? currency === claim.currency : true
  useEffect(() => {
    if (sameCurrency) setValue('conversionRate', 1)
  }, [sameCurrency, setValue])

  const amount = Number(watch('amount')) || 0
  const rate = Number(watch('conversionRate')) || 0
  const converted = amount * rate
  // When editing, this payment is already counted in the balance.
  const balance = claim ? claim.balance + (payment ? Number(payment.amount) * Number(payment.conversionRate) : 0) : 0
  const over = claim ? converted > balance + 0.01 : false

  const save = useMutation({
    mutationFn: (values: Out) =>
      payment
        ? api.put<{ id: number }>(`/payments/${payment.id}`, values)
        : api.post<{ id: number; reference: string }>('/payments', values),
    onSuccess: async (res) => {
      toast.success(payment ? 'Tranche updated' : `Tranche ${'reference' in res ? res.reference : ''} recorded`)
      await queryClient.invalidateQueries({ queryKey: ['payments'] })
      await queryClient.invalidateQueries({ queryKey: ['claims'] })
      await queryClient.invalidateQueries({ queryKey: ['lookup', 'claims'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      await navigate({ to: '/admin/claims/$claimId', params: { claimId: String(selectedId) } })
    },
    onError: (err) => toast.error(errorMessage(err)),
  })

  return (
    <form onSubmit={handleSubmit((v) => save.mutate(v))} noValidate>
      <FormSection index={1} title="Tranche request" description="The approved claim this payment is made against.">
        <Field
          label="Tranche request"
          required
          error={errors.claimId?.message}
          className="sm:col-span-2"
          hint="Approved claims only, shown as reference · phase — project — principal investigator."
        >
          <Controller
            control={control}
            name="claimId"
            render={({ field }) => (
              <Combobox
                options={
                  payment && !claims.data?.some((c) => c.value === payment.claimId)
                    ? [
                        ...(claims.data ?? []),
                        {
                          value: payment.claimId,
                          label: payment.claimReference,
                          hint: payment.projectTitle,
                          amount: payment.claimAmount,
                          currency: payment.claimCurrency,
                          balance: 0,
                        },
                      ]
                    : claims.data
                }
                loading={claims.isLoading}
                value={field.value as number | null}
                onChange={field.onChange}
                clearable={false}
                invalid={Boolean(errors.claimId)}
                placeholder="Search approved claims…"
              />
            )}
          />
        </Field>
        {claim && (
          <div className="grid grid-cols-3 gap-3 rounded-2xl bg-muted p-4 text-sm sm:col-span-2">
            <div>
              <p className="eyebrow">Claim amount</p>
              <p className="mt-1 font-mono font-semibold">{money(claim.amount, claim.currency)}</p>
            </div>
            <div>
              <p className="eyebrow">Outstanding</p>
              <p className="mt-1 font-mono font-semibold">{money(balance, claim.currency)}</p>
            </div>
            <div>
              <p className="eyebrow">After this tranche</p>
              <p className={cn('mt-1 font-mono font-semibold', over && 'text-destructive')}>
                {money(balance - converted, claim.currency)}
              </p>
            </div>
          </div>
        )}
      </FormSection>
      <FormSection index={2} title="Payment" description="A five-character reference is generated when you save.">
        <Field label="Tranche amount" required error={errors.amount?.message}>
          <Input
            type="number"
            step="0.01"
            min="0"
            {...register('amount')}
            className="font-mono"
            aria-invalid={Boolean(errors.amount) || over}
          />
        </Field>
        <Field label="Tranche currency" required>
          <NativeSelect {...register('currency')}>
            {CURRENCY_OPTIONS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </NativeSelect>
        </Field>
        <Field
          label="Tranche conversion rate"
          required
          error={errors.conversionRate?.message}
          hint={
            claim && !sameCurrency
              ? `1 ${currency} = ? ${claim.currency}. Converted: ${money(converted, claim.currency)}`
              : 'Same currency as the claim (rate 1)'
          }
        >
          <Input
            type="number"
            step="0.000001"
            min="0"
            {...register('conversionRate')}
            disabled={sameCurrency}
            className="font-mono"
          />
        </Field>
        <Field label="Date issued" required error={errors.paidAt?.message}>
          <Input type="date" {...register('paidAt')} />
        </Field>
        <Field label="Description" error={errors.description?.message} className="sm:col-span-2">
          <Input {...register('description')} placeholder="e.g. First tranche — field work advance" />
        </Field>
        {over && (
          <p className="rounded-xl bg-secondary px-3 py-2 text-sm text-secondary-foreground sm:col-span-2">
            This tranche is more than the outstanding balance on the claim.
          </p>
        )}
      </FormSection>
      <FormActions>
        <Button type="button" variant="ghost" onClick={() => history.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={save.isPending || over}>
          {save.isPending ? <Loader2 className="animate-spin" /> : <Save />}{' '}
          {payment ? 'Save changes' : 'Record payment'}
        </Button>
      </FormActions>
    </form>
  )
}
