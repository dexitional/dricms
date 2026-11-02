import { useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { z } from 'zod'
import { Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'
import { api, errorMessage } from '#/lib/api-client'
import { phaseSchema } from '#/lib/schemas'
import { money } from '#/lib/format'
import { toFormValues } from '#/lib/form-utils'
import { Button } from '#/components/ui/button'
import { Input, Textarea } from '#/components/ui/input'
import { Field, FormActions, FormSection } from '#/components/admin/form'
import { RichTextEditor } from '#/components/admin/rich-text-editor'

type In = z.input<typeof phaseSchema>
type Out = z.output<typeof phaseSchema>
const KEYS = [
  'title',
  'description',
  'phaseNo',
  'balanceBf',
  'budget',
  'spent',
  'startDate',
  'endDate',
  'report',
] as const

export function PhaseForm({
  projectId,
  currency,
  phase,
}: {
  projectId: string
  currency: string
  phase?: Record<string, any>
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<In, unknown, Out>({
    resolver: zodResolver(phaseSchema),
    defaultValues: { title: '', phaseNo: 1, balanceBf: 0, budget: '' as never, spent: 0 },
  })
  // New phases: next number, and the previous phase's unspent balance carried forward.
  const next = useQuery({
    queryKey: ['projects', projectId, 'next-phase'],
    queryFn: () => api.get<{ phaseNo: number; balanceBf: number }>(`/projects/${projectId}/phases/next`),
    enabled: !phase,
  })
  useEffect(() => {
    if (phase) reset(toFormValues(phase, KEYS) as In)
    else if (next.data)
      reset({ title: '', phaseNo: next.data.phaseNo, balanceBf: next.data.balanceBf, budget: '' as never, spent: 0 })
  }, [phase, next.data, reset])

  const save = useMutation({
    mutationFn: (values: Out) =>
      phase
        ? api.put<{ id: number }>(`/phases/${phase.id}`, values)
        : api.post<{ id: number }>(`/projects/${projectId}/phases`, values),
    onSuccess: async ({ id }) => {
      toast.success(phase ? 'Phase updated' : 'Phase added')
      await queryClient.invalidateQueries({ queryKey: ['projects'] })
      await queryClient.invalidateQueries({ queryKey: ['phases'] })
      await navigate({ to: '/admin/projects/$projectId/phases/$phaseId', params: { projectId, phaseId: String(id) } })
    },
    onError: (err) => toast.error(errorMessage(err)),
  })
  const available = (Number(watch('balanceBf')) || 0) + (Number(watch('budget')) || 0)
  const remaining = available - (Number(watch('spent')) || 0)

  return (
    <form onSubmit={handleSubmit((v) => save.mutate(v))} noValidate>
      <FormSection index={1} title="Phase" description="A stage of the project with its own budget and report.">
        <Field label="Phase title" required error={errors.title?.message}>
          <Input {...register('title')} aria-invalid={Boolean(errors.title)} placeholder="e.g. Baseline survey" />
        </Field>
        <Field label="Phase number" required error={errors.phaseNo?.message} hint="Sets the order of phases">
          <Input type="number" min={1} {...register('phaseNo')} className="font-mono" />
        </Field>
        <Field label="Phase description" error={errors.description?.message} className="sm:col-span-2">
          <Textarea {...register('description')} rows={4} />
        </Field>
        <Field label="Start date" error={errors.startDate?.message}>
          <Input type="date" {...register('startDate')} />
        </Field>
        <Field label="End date" error={errors.endDate?.message}>
          <Input type="date" {...register('endDate')} aria-invalid={Boolean(errors.endDate)} />
        </Field>
      </FormSection>

      <FormSection index={2} title="Finances" description={`Amounts are in the project currency (${currency}).`}>
        <Field
          label={`Project balance brought forward (${currency})`}
          error={errors.balanceBf?.message}
          hint={!phase ? 'Carried over from the previous phase — adjust if needed.' : undefined}
        >
          <Input type="number" step="0.01" {...register('balanceBf')} className="font-mono" />
        </Field>
        <Field label={`Phase budget / disbursed amount (${currency})`} required error={errors.budget?.message}>
          <Input
            type="number"
            step="0.01"
            min="0"
            {...register('budget')}
            className="font-mono"
            aria-invalid={Boolean(errors.budget)}
          />
        </Field>
        <Field label={`Phase actual amount spent (${currency})`} error={errors.spent?.message}>
          <Input type="number" step="0.01" min="0" {...register('spent')} className="font-mono" />
        </Field>
        <div className="rounded-2xl bg-muted p-4 text-sm">
          <p className="flex justify-between">
            <span className="text-muted-foreground">Available this phase</span>{' '}
            <span className="font-mono">{money(available, currency)}</span>
          </p>
          <p className="mt-1 flex justify-between font-semibold">
            <span>Balance to carry forward</span>{' '}
            <span className={`font-mono ${remaining < 0 ? 'text-destructive' : ''}`}>{money(remaining, currency)}</span>
          </p>
        </div>
      </FormSection>

      <FormSection index={3} title="Phase report" description="Progress, outputs and challenges for this phase.">
        <div className="sm:col-span-2">
          <Controller
            control={control}
            name="report"
            render={({ field }) => (
              <RichTextEditor
                value={field.value as string}
                onChange={field.onChange}
                placeholder="Write the phase report…"
              />
            )}
          />
        </div>
      </FormSection>

      <FormActions>
        <Button type="button" variant="ghost" onClick={() => history.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? <Loader2 className="animate-spin" /> : <Save />} {phase ? 'Save changes' : 'Add phase'}
        </Button>
      </FormActions>
    </form>
  )
}
