import { useEffect, useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Controller, useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { z } from 'zod'
import { Loader2, Plus, Save, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { api, errorMessage } from '#/lib/api-client'
import type { Option } from '#/lib/api-client'
import { claimSchema } from '#/lib/schemas'
import { money, today } from '#/lib/format'
import { DISBURSEMENT_FORM } from '#/lib/forms'
import { amountInWords } from '#/lib/words'
import { Button } from '#/components/ui/button'
import { Input, NativeSelect, Textarea } from '#/components/ui/input'
import { Field, FormActions, FormSection, errorAt } from '#/components/admin/form'
import { Combobox } from '#/components/admin/combobox'
import { CURRENCY_OPTIONS, useLookup } from '#/components/admin/lookups'
import { useUser } from '#/components/admin/session'

type In = z.input<typeof claimSchema>
type Out = z.output<typeof claimSchema>
type PhaseOption = Option & { currency: string; piId: number | null; projectId: number }

const blankItem = { description: '', quantity: 1, unit: '', days: 1, unitCost: '' as never }

/** "Request for Disbursement of Research/Consultancy Project Funds". */
export function ClaimForm({
  claim,
  phaseId,
  projectId,
}: {
  claim?: Record<string, any>
  phaseId?: number
  projectId?: number
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const user = useUser()
  const isInvestigator = user.role === 'investigator'
  const phases = useLookup<PhaseOption>('phases')
  const investigators = useLookup('investigators')
  const phaseOptions = useMemo(
    () => (projectId ? phases.data?.filter((p) => p.projectId === projectId) : phases.data),
    [phases.data, projectId],
  )

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<In, unknown, Out>({
    resolver: zodResolver(claimSchema),
    defaultValues: {
      purpose: '',
      currency: 'GHS',
      amount: '' as never,
      items: [],
      phaseId: phaseId ?? ('' as never),
      investigatorId: null,
      signedName: isInvestigator ? user.fullName : '',
      signedAt: today(),
    },
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'items' })
  useEffect(() => {
    if (!claim) return
    reset({
      phaseId: claim.phaseId,
      investigatorId: claim.investigatorId,
      purpose: claim.purpose,
      description: claim.description ?? '',
      reasons: claim.reasons ?? '',
      amount: claim.amount,
      currency: claim.currency,
      signedName: claim.signedName ?? '',
      signedAt: claim.signedAt ?? '',
      items: (claim.items ?? []).map((i: Record<string, any>) => ({
        description: i.description,
        quantity: i.quantity,
        unit: i.unit ?? '',
        days: i.days,
        unitCost: i.unitCost,
      })),
    })
  }, [claim, reset])
  // A phase picked from a link pre-selects the PI as requester.
  useEffect(() => {
    if (claim || isInvestigator || !phaseId) return
    const phase = phases.data?.find((p) => p.value === phaseId)
    if (phase?.piId) setValue('investigatorId', phase.piId)
  }, [claim, isInvestigator, phaseId, phases.data, setValue])

  const save = useMutation({
    mutationFn: (values: Out) =>
      claim ? api.put<{ id: number }>(`/claims/${claim.id}`, values) : api.post<{ id: number }>('/claims', values),
    onSuccess: async ({ id }) => {
      toast.success(claim ? 'Claim updated' : 'Claim submitted to DRIC')
      await queryClient.invalidateQueries({ queryKey: ['claims'] })
      await queryClient.invalidateQueries({ queryKey: ['projects'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      await navigate({ to: '/admin/claims/$claimId', params: { claimId: String(id) } })
    },
    onError: (err) => toast.error(errorMessage(err)),
  })

  const items = (watch('items') ?? []) as Array<{ quantity: unknown; days: unknown; unitCost: unknown }>
  const lineTotal = (i: { quantity: unknown; days: unknown; unitCost: unknown }) =>
    (Number(i.quantity) || 0) * (Number(i.days) || 1) * (Number(i.unitCost) || 0)
  const itemsTotal = Math.round(items.reduce((s, i) => s + lineTotal(i), 0) * 100) / 100
  const currency = watch('currency') as string
  const total = items.length ? itemsTotal : Number(watch('amount')) || 0

  return (
    <form
      onSubmit={handleSubmit((v) => save.mutate({ ...v, amount: items.length ? itemsTotal : v.amount }))}
      noValidate
    >
      <div className="mb-6 rounded-2xl border border-secondary-strong bg-secondary/50 px-4 py-3 text-sm text-secondary-foreground">
        <b>{DISBURSEMENT_FORM.title}.</b> Principal Investigators or Lead Consultants should allow{' '}
        <b>{DISBURSEMENT_FORM.allowance}</b> from deadline for processing of request and feedback from DRIC.
      </div>
      <FormSection index={1} title="Project details" description="Which project phase the funds are for.">
        <Field label="Project phase" required error={errors.phaseId?.message} className="sm:col-span-2">
          <Controller
            control={control}
            name="phaseId"
            render={({ field }) => (
              <Combobox
                options={phaseOptions}
                loading={phases.isLoading}
                value={field.value as number | null}
                clearable={false}
                invalid={Boolean(errors.phaseId)}
                onChange={(v, opt) => {
                  field.onChange(v)
                  const phase = opt as PhaseOption | undefined
                  if (phase && !claim && !isInvestigator && phase.piId) setValue('investigatorId', phase.piId)
                }}
                placeholder="Search by phase or project…"
              />
            )}
          />
        </Field>
        {!isInvestigator && (
          <Field
            label="Principal investigator / lead consultant"
            error={errors.investigatorId?.message}
            className="sm:col-span-2"
            hint="Defaults to the project’s PI."
          >
            <Controller
              control={control}
              name="investigatorId"
              render={({ field }) => (
                <Combobox
                  options={investigators.data}
                  loading={investigators.isLoading}
                  value={field.value as number | null}
                  onChange={field.onChange}
                  placeholder="Search investigators…"
                />
              )}
            />
          </Field>
        )}
        <Field label="Purpose of request" required error={errors.purpose?.message} className="sm:col-span-2">
          <Input
            {...register('purpose')}
            aria-invalid={Boolean(errors.purpose)}
            placeholder="e.g. Data collection field work — Central Region"
          />
        </Field>
        <Field label="Brief description of activity" error={errors.description?.message} className="sm:col-span-2">
          <Textarea {...register('description')} rows={3} />
        </Field>
        <Field
          label="Specific reason(s) for requesting project funds"
          error={errors.reasons?.message}
          className="sm:col-span-2"
        >
          <Textarea {...register('reasons')} rows={3} />
        </Field>
      </FormSection>

      <FormSection
        index={2}
        title="Breakdown"
        description="Amount requested based on activities and items. The total is calculated for you; leave empty to enter a lump sum."
      >
        <Field label="Request currency" required>
          <NativeSelect {...register('currency')}>
            {CURRENCY_OPTIONS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </NativeSelect>
        </Field>
        <Field
          label="Total amount requested (in figures)"
          required
          error={errors.amount?.message}
          hint={items.length ? 'Calculated from the breakdown' : undefined}
        >
          {items.length ? (
            <div className="field-control flex h-10 items-center bg-muted font-mono font-semibold">
              {money(itemsTotal, currency)}
            </div>
          ) : (
            <Input type="number" step="0.01" min="0" {...register('amount')} className="font-mono" />
          )}
        </Field>
        <div className="space-y-3 sm:col-span-2">
          {fields.length > 0 && (
            <div className="overflow-x-auto rounded-2xl border">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-slate-50/80">
                  <tr className="text-left">
                    <th className="eyebrow w-10 px-3 py-2.5">#</th>
                    <th className="eyebrow px-2 py-2.5">Description [activity/item]</th>
                    <th className="eyebrow w-20 px-2 py-2.5">Qty</th>
                    <th className="eyebrow w-24 px-2 py-2.5">Unit</th>
                    <th className="eyebrow w-20 px-2 py-2.5">Days</th>
                    <th className="eyebrow w-32 px-2 py-2.5">Unit cost</th>
                    <th className="eyebrow w-32 px-2 py-2.5 text-right">Total</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {fields.map((f, index) => (
                    <tr key={f.id} className="align-top">
                      <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{index + 1}.</td>
                      <td className="px-2 py-1.5">
                        <Input
                          {...register(`items.${index}.description`)}
                          className="h-9"
                          aria-invalid={Boolean(errorAt(errors, `items.${index}.description`))}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input
                          type="number"
                          step="any"
                          min="0"
                          {...register(`items.${index}.quantity`)}
                          className="h-9 px-2 font-mono"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input {...register(`items.${index}.unit`)} className="h-9 px-2" placeholder="pcs" />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input
                          type="number"
                          step="any"
                          min="0"
                          {...register(`items.${index}.days`)}
                          className="h-9 px-2 font-mono"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          {...register(`items.${index}.unitCost`)}
                          className="h-9 px-2 font-mono"
                        />
                      </td>
                      <td className="px-2 py-2.5 text-right font-mono text-xs font-semibold tabular-nums">
                        {money(lineTotal(items[index] ?? { quantity: 0, days: 0, unitCost: 0 }), currency).replace(
                          `${currency} `,
                          '',
                        )}
                      </td>
                      <td className="px-1 py-1.5">
                        <button
                          type="button"
                          onClick={() => remove(index)}
                          className="rounded-full p-2 text-muted-foreground hover:bg-secondary hover:text-secondary-foreground"
                          aria-label={`Remove line ${index + 1}`}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t bg-slate-50/80">
                    <td colSpan={6} className="px-3 py-2.5 text-right text-xs font-bold tracking-wide uppercase">
                      Total amount
                    </td>
                    <td className="px-2 py-2.5 text-right font-mono font-bold tabular-nums">
                      {money(itemsTotal, currency)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
          <Button type="button" variant="outline" size="sm" onClick={() => append(blankItem)}>
            <Plus /> Add breakdown line
          </Button>
          {total > 0 && (
            <p className="rounded-xl bg-muted px-3 py-2 text-xs text-slate-600">
              <span className="eyebrow mr-2">In words</span>
              {amountInWords(total, currency)}
            </p>
          )}
        </div>
      </FormSection>

      <FormSection
        index={3}
        title="Declaration"
        description="Type the name of the principal investigator to sign the request."
      >
        <Field label="Signature of principal investigator" error={errors.signedName?.message}>
          <Input {...register('signedName')} className="font-serif text-base italic" />
        </Field>
        <Field label="Date" error={errors.signedAt?.message}>
          <Input type="date" {...register('signedAt')} />
        </Field>
      </FormSection>

      <FormActions>
        <Button type="button" variant="ghost" onClick={() => history.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? <Loader2 className="animate-spin" /> : <Save />} {claim ? 'Save changes' : 'Submit request'}
        </Button>
      </FormActions>
    </form>
  )
}
