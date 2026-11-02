import { useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { z } from 'zod'
import { Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'
import { api, errorMessage } from '#/lib/api-client'
import { activitySchema } from '#/lib/schemas'
import { ACTIVITY_STATUS_LABELS } from '#/lib/labels'
import { toFormValues } from '#/lib/form-utils'
import { Button } from '#/components/ui/button'
import { Dialog, DialogContent } from '#/components/ui/dialog'
import { Input, NativeSelect, Textarea } from '#/components/ui/input'
import { Field } from '#/components/admin/form'
import { MultiCombobox } from '#/components/admin/combobox'
import { CURRENCY_OPTIONS, useLookup } from '#/components/admin/lookups'

type In = z.input<typeof activitySchema>
type Out = z.output<typeof activitySchema>
const KEYS = [
  'title',
  'description',
  'subjects',
  'amount',
  'currency',
  'location',
  'status',
  'startDate',
  'endDate',
  'report',
] as const

export function ActivityDialog({
  open,
  onOpenChange,
  phaseId,
  currency,
  activity,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  phaseId: number
  currency: string
  activity?: Record<string, any> | null
}) {
  const queryClient = useQueryClient()
  const personnel = useLookup('personnel')
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<In, unknown, Out>({ resolver: zodResolver(activitySchema) })
  useEffect(() => {
    if (!open) return
    if (activity)
      reset({
        ...toFormValues(activity, KEYS),
        personnelIds: (activity.personnel ?? []).map((p: { id: number }) => p.id),
      } as In)
    else reset({ title: '', currency: currency as never, status: 'PLANNED', amount: '' as never, personnelIds: [] })
  }, [open, activity, currency, reset])
  const save = useMutation({
    mutationFn: (values: Out) =>
      activity ? api.put(`/activities/${activity.id}`, values) : api.post(`/phases/${phaseId}/activities`, values),
    onSuccess: async () => {
      toast.success(activity ? 'Activity updated' : 'Activity added')
      onOpenChange(false)
      await queryClient.invalidateQueries({ queryKey: ['phases', String(phaseId)] })
      await queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
    onError: (err) => toast.error(errorMessage(err)),
  })
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={activity ? 'Edit activity' : 'New activity'}
        description="A task within this phase, managed by assigned personnel."
        className="max-w-2xl"
      >
        <form onSubmit={handleSubmit((v) => save.mutate(v))} noValidate className="grid gap-4 sm:grid-cols-2">
          <Field label="Activity title" required error={errors.title?.message} className="sm:col-span-2">
            <Input {...register('title')} aria-invalid={Boolean(errors.title)} />
          </Field>
          <Field label="Description" error={errors.description?.message} className="sm:col-span-2">
            <Textarea {...register('description')} rows={3} />
          </Field>
          <Field
            label="Subject(s) of activity"
            error={errors.subjects?.message}
            className="sm:col-span-2"
            hint="Who or what the activity is about, e.g. ‘Basic school teachers, Cape Coast Metro’"
          >
            <Input {...register('subjects')} />
          </Field>
          <Field label="Activity personnel" className="sm:col-span-2">
            <Controller
              control={control}
              name="personnelIds"
              render={({ field }) => (
                <MultiCombobox
                  options={personnel.data}
                  loading={personnel.isLoading}
                  value={(field.value as Array<number>) ?? []}
                  onChange={field.onChange}
                  placeholder="Assign personnel…"
                />
              )}
            />
          </Field>
          <Field label="Budget amount" required error={errors.amount?.message}>
            <Input type="number" step="0.01" min="0" {...register('amount')} className="font-mono" />
          </Field>
          <Field label="Budget currency" required>
            <NativeSelect {...register('currency')}>
              {CURRENCY_OPTIONS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Place or location" error={errors.location?.message}>
            <Input {...register('location')} />
          </Field>
          <Field label="Status">
            <NativeSelect {...register('status')}>
              {Object.entries(ACTIVITY_STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Start date" error={errors.startDate?.message}>
            <Input type="date" {...register('startDate')} />
          </Field>
          <Field label="End date" error={errors.endDate?.message}>
            <Input type="date" {...register('endDate')} aria-invalid={Boolean(errors.endDate)} />
          </Field>
          <Field label="Activity report" error={errors.report?.message} className="sm:col-span-2">
            <Textarea {...register('report')} rows={4} placeholder="What was delivered, outcomes, issues…" />
          </Field>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? <Loader2 className="animate-spin" /> : <Save />} Save activity
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
