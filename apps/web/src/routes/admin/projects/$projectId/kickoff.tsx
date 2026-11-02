import { useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Controller, useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { z } from 'zod'
import { Check, Loader2, Printer, Save, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@dric/ui'
import { api, errorMessage } from '#/lib/api-client'
import { kickoffSchema } from '#/lib/schemas'
import { KICKOFF_ITEMS } from '#/lib/forms'
import { dateTime } from '#/lib/format'
import { Button } from '#/components/ui/button'
import { Card } from '#/components/ui/card'
import { Input, Textarea } from '#/components/ui/input'
import { Skeleton } from '#/components/ui/skeleton'
import { Field, FormActions, FormSection } from '#/components/admin/form'
import { PageHeader, ProgressBar } from '#/components/admin/page'
import { useCan } from '#/components/admin/session'

export const Route = createFileRoute('/admin/projects/$projectId/kickoff')({ component: KickoffPage })

type In = z.input<typeof kickoffSchema>
type Out = z.output<typeof kickoffSchema>

function KickoffPage() {
  const { projectId } = Route.useParams()
  const queryClient = useQueryClient()
  const canManage = useCan('projects', 'manage')
  const { data } = useQuery({
    queryKey: ['kickoff', projectId],
    queryFn: () => api.get<Record<string, any>>(`/projects/${projectId}/kickoff`),
  })
  const { register, control, handleSubmit, reset, watch } = useForm<In, unknown, Out>({
    resolver: zodResolver(kickoffSchema),
  })
  const { fields } = useFieldArray({ control, name: 'items' })
  useEffect(() => {
    if (!data) return
    const c = data.checklist
    reset({
      meetingDate: c.meetingDate ?? '',
      venue: c.venue ?? '',
      attendees: c.attendees ?? '',
      notes: c.notes ?? '',
      items: c.items.map((i: Record<string, any>) => ({ no: i.no, tick: i.tick ?? null, note: i.note ?? '' })),
    })
  }, [data, reset])
  const save = useMutation({
    mutationFn: (values: Out) => api.put(`/projects/${projectId}/kickoff`, values),
    onSuccess: async () => {
      toast.success('Checklist saved')
      await queryClient.invalidateQueries({ queryKey: ['kickoff', projectId] })
      await queryClient.invalidateQueries({ queryKey: ['projects', projectId] })
    },
    onError: (err) => toast.error(errorMessage(err)),
  })
  if (!data) return <Skeleton className="h-[30rem]" />
  const items = (watch('items') ?? []) as Array<{ tick: boolean | null }>
  const covered = items.filter((i) => i.tick !== null).length

  return (
    <>
      <PageHeader
        back={{ to: '/admin/projects/$projectId', label: data.project.title, params: { projectId } }}
        eyebrow={<span className="font-mono">{data.project.code}</span>}
        title="Kick-off meeting checklist"
        description="Record what was covered at the project kick-off meeting with the PI and team."
        meta={
          data.saved && data.checklist.updatedAt ? (
            <span className="text-xs text-muted-foreground">
              Last saved {dateTime(data.checklist.updatedAt)}
              {data.checklist.updatedByName ? ` by ${data.checklist.updatedByName}` : ''}
            </span>
          ) : undefined
        }
        actions={
          data.saved && (
            <Button variant="outline" asChild>
              <a href={`/print/kickoff/${projectId}`} target="_blank" rel="noreferrer">
                <Printer /> Print checklist
              </a>
            </Button>
          )
        }
      />
      <form onSubmit={handleSubmit((v) => save.mutate(v))} noValidate>
        <fieldset disabled={!canManage}>
          <FormSection title="Meeting" description="When and where the kick-off took place, and who attended.">
            <Field label="Meeting date">
              <Input type="date" {...register('meetingDate')} />
            </Field>
            <Field label="Venue">
              <Input {...register('venue')} placeholder="e.g. DRIC Conference Room" />
            </Field>
            <Field label="Attendees" className="sm:col-span-2" hint="One per line, with their role.">
              <Textarea {...register('attendees')} rows={4} />
            </Field>
          </FormSection>
          <div className="py-7">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-bold">Issues discussed</h2>
                <p className="text-xs text-muted-foreground">Tick ✓ if covered, ✗ if not, and add notes.</p>
              </div>
              <div className="w-40 text-right">
                <p className="font-mono text-xs">
                  {covered}/{KICKOFF_ITEMS.length} marked
                </p>
                <ProgressBar value={(covered / KICKOFF_ITEMS.length) * 100} className="mt-1" />
              </div>
            </div>
            <Card className="divide-y overflow-hidden">
              {fields.map((f, index) => {
                const item = KICKOFF_ITEMS[index]!
                return (
                  <div key={f.id} className="grid gap-3 p-4 md:grid-cols-[2.5rem_minmax(0,1fr)_auto]">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-muted font-mono text-xs font-bold">
                      {item.no}
                    </span>
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                      {item.hint && <p className="text-xs text-muted-foreground italic">{item.hint}</p>}
                      <Input {...register(`items.${index}.note`)} placeholder="Notes (optional)" className="h-9" />
                    </div>
                    <Controller
                      control={control}
                      name={`items.${index}.tick`}
                      render={({ field }) => (
                        <div className="flex gap-1.5 md:pt-0.5">
                          <TickButton
                            active={field.value === true}
                            tone="yes"
                            onClick={() => field.onChange(field.value === true ? null : true)}
                          />
                          <TickButton
                            active={field.value === false}
                            tone="no"
                            onClick={() => field.onChange(field.value === false ? null : false)}
                          />
                        </div>
                      )}
                    />
                  </div>
                )
              })}
            </Card>
          </div>
          <FormSection title="Other notes" description="Agreed actions, follow-ups and questions for clarification.">
            <Field label="Notes" className="sm:col-span-2">
              <Textarea {...register('notes')} rows={5} />
            </Field>
          </FormSection>
        </fieldset>
        {canManage && (
          <FormActions>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? <Loader2 className="animate-spin" /> : <Save />} Save checklist
            </Button>
          </FormActions>
        )}
      </form>
    </>
  )
}

function TickButton({ active, tone, onClick }: { active: boolean; tone: 'yes' | 'no'; onClick: () => void }) {
  const Icon = tone === 'yes' ? Check : X
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={tone === 'yes' ? 'Covered' : 'Not covered'}
      className={cn(
        'flex size-10 items-center justify-center rounded-xl border-2 transition-all',
        active
          ? tone === 'yes'
            ? 'border-success bg-success text-white'
            : 'border-destructive bg-destructive text-white'
          : 'border-border-strong bg-white text-slate-300 hover:text-slate-500',
      )}
    >
      <Icon className="size-5" strokeWidth={3} />
    </button>
  )
}
