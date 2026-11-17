import { useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { z } from 'zod'
import { Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'
import { api, errorMessage } from '#/lib/api-client'
import { retirementSchema } from '#/lib/schemas'
import { money, today } from '#/lib/format'
import { Button } from '#/components/ui/button'
import { Dialog, DialogContent } from '#/components/ui/dialog'
import { Input, NativeSelect } from '#/components/ui/input'
import { Field } from '#/components/admin/form'
import { AttachmentsField } from '#/components/admin/file-upload'
import type { UploadedFile } from '#/components/admin/file-upload'

type In = z.input<typeof retirementSchema>
type Out = z.output<typeof retirementSchema>

/** One line of a tranche's retirement: money spent on an activity, with receipts. */
export function RetirementDialog({
  open,
  onOpenChange,
  paymentId,
  currency,
  activities,
  left,
  line,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  paymentId: number
  currency: string
  activities: Array<{ id: number; title: string }>
  /** Amount of the tranche not yet covered by other lines. */
  left: number
  line?: Record<string, any> | null
}) {
  const queryClient = useQueryClient()
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<In, unknown, Out>({ resolver: zodResolver(retirementSchema) })
  useEffect(() => {
    if (!open) return
    reset(
      line
        ? {
            activityId: line.activityId,
            description: line.description,
            amount: line.amount,
            spentAt: line.spentAt,
            receipts: line.receipts ?? [],
          }
        : {
            activityId: (activities.length === 1 ? activities[0]!.id : '') as never,
            description: '',
            amount: '' as never,
            spentAt: today(),
            receipts: [],
          },
    )
  }, [open, line, activities, reset])
  const save = useMutation({
    mutationFn: (values: Out) =>
      line ? api.put(`/retirements/${line.id}`, values) : api.post(`/payments/${paymentId}/retirements`, values),
    onSuccess: async () => {
      toast.success(line ? 'Retirement line updated and sent for review' : 'Receipts submitted for review')
      onOpenChange(false)
      await queryClient.invalidateQueries({ queryKey: ['payments'] })
      await queryClient.invalidateQueries({ queryKey: ['projects'] })
      await queryClient.invalidateQueries({ queryKey: ['phases'] })
    },
    onError: (err) => toast.error(errorMessage(err)),
  })
  const available = left + (line ? Number(line.amount) : 0)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={line ? 'Edit retirement line' : 'Retire part of this tranche'}
        description="Account for what was spent on one activity and upload the receipts for it."
        className="max-w-2xl"
      >
        <form onSubmit={handleSubmit((v) => save.mutate(v))} noValidate className="grid gap-4 sm:grid-cols-2">
          <Field label="Activity" required error={errors.activityId?.message} className="sm:col-span-2">
            <NativeSelect {...register('activityId')} aria-invalid={Boolean(errors.activityId)}>
              <option value="">Choose an activity of this phase…</option>
              {activities.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field
            label="What the money was spent on"
            required
            error={errors.description?.message}
            className="sm:col-span-2"
          >
            <Input
              {...register('description')}
              placeholder="e.g. Fuel and transport for enumerators"
              aria-invalid={Boolean(errors.description)}
            />
          </Field>
          <Field
            label={`Amount spent (${currency})`}
            required
            error={errors.amount?.message}
            hint={`Up to ${money(available, currency)} of the tranche is left to retire.`}
          >
            <Input type="number" step="0.01" min="0" {...register('amount')} className="font-mono" />
          </Field>
          <Field label="Date spent" required error={errors.spentAt?.message}>
            <Input type="date" {...register('spentAt')} />
          </Field>
          <Field label="Receipts" required error={errors.receipts?.message} className="sm:col-span-2">
            <Controller
              control={control}
              name="receipts"
              render={({ field }) => (
                <AttachmentsField
                  endpoint="/files"
                  value={(field.value ?? []) as Array<UploadedFile>}
                  onChange={field.onChange}
                />
              )}
            />
          </Field>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? <Loader2 className="animate-spin" /> : <Save />} {line ? 'Save and resubmit' : 'Submit'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
