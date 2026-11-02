import { useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { z } from 'zod'
import { Briefcase, FlaskConical, Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@dric/ui'
import { api, errorMessage } from '#/lib/api-client'
import { projectSchema } from '#/lib/schemas'
import { PROJECT_STATUS_LABELS } from '#/lib/labels'
import { toFormValues } from '#/lib/form-utils'
import { amountInWords } from '#/lib/words'
import { Button } from '#/components/ui/button'
import { Input, NativeSelect, Textarea } from '#/components/ui/input'
import { Field, FormActions, FormSection } from '#/components/admin/form'
import { Combobox, MultiCombobox } from '#/components/admin/combobox'
import { CURRENCY_OPTIONS, useLookup } from '#/components/admin/lookups'
import { FileField } from '#/components/admin/file-upload'
import { RichTextEditor } from '#/components/admin/rich-text-editor'

type In = z.input<typeof projectSchema>
type Out = z.output<typeof projectSchema>

const KEYS = [
  'title',
  'description',
  'totalFunding',
  'currency',
  'type',
  'status',
  'awardedAt',
  'startDate',
  'endDate',
  'finalReport',
  'contractUrl',
  'contractName',
  'budgetUrl',
  'budgetName',
] as const

export function ProjectForm({ project }: { project?: Record<string, any> }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const countries = useLookup('countries')
  const funders = useLookup('funders')
  const investigators = useLookup('investigators')
  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<In, unknown, Out>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      title: '',
      currency: 'USD',
      type: 'PROJECT',
      status: 'ONGOING',
      totalFunding: '' as never,
      coInvestigatorIds: [],
      countryId: null,
      funderId: null,
      piId: null,
    },
  })
  useEffect(() => {
    if (!project) {
      // Default the country to Ghana for new projects.
      const ghana = countries.data?.find((c) => c.code === 'GH')
      if (ghana) setValue('countryId', ghana.value)
      return
    }
    reset({
      ...toFormValues(project, KEYS),
      countryId: project.countryId ?? null,
      funderId: project.funderId ?? null,
      piId: project.piId ?? null,
      coInvestigatorIds: (project.coInvestigators ?? []).map((c: { id: number }) => c.id),
    } as In)
  }, [project, reset, countries.data, setValue])

  const save = useMutation({
    mutationFn: (values: Out) =>
      project
        ? api.put<{ id: number }>(`/projects/${project.id}`, values)
        : api.post<{ id: number }>('/projects', values),
    onSuccess: async ({ id }) => {
      toast.success(project ? 'Project updated' : 'Project created')
      await queryClient.invalidateQueries({ queryKey: ['projects'] })
      await queryClient.invalidateQueries({ queryKey: ['lookup'] })
      await navigate({ to: '/admin/projects/$projectId', params: { projectId: String(id) } })
    },
    onError: (err) => toast.error(errorMessage(err)),
  })

  const amount = Number(watch('totalFunding')) || 0
  const currency = watch('currency') as string
  const piId = watch('piId') as number | null
  const type = watch('type')

  return (
    <form onSubmit={handleSubmit((v) => save.mutate(v))} noValidate>
      <FormSection index={1} title="Project" description="What the award is for.">
        <Field label="Project type" required className="sm:col-span-2">
          <Controller
            control={control}
            name="type"
            render={({ field }) => (
              <div className="grid grid-cols-2 gap-3">
                {(
                  [
                    ['PROJECT', 'Research project', 'Grant-funded research', FlaskConical],
                    ['CONSULTANCY', 'Consultancy', 'Commissioned consultancy work', Briefcase],
                  ] as const
                ).map(([value, label, hint, Icon]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => field.onChange(value)}
                    className={cn(
                      'flex items-center gap-3 rounded-2xl border p-3.5 text-left transition-all',
                      field.value === value
                        ? 'border-primary bg-primary-soft ring-4 ring-primary/5'
                        : 'hover:border-border-strong',
                    )}
                  >
                    <span
                      className={cn(
                        'flex size-9 items-center justify-center rounded-xl',
                        field.value === value ? 'bg-primary text-white' : 'bg-muted text-muted-foreground',
                      )}
                    >
                      <Icon className="size-4" />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold">{label}</span>
                      <span className="block text-xs text-muted-foreground">{hint}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          />
        </Field>
        <Field label="Project title" required error={errors.title?.message} className="sm:col-span-2">
          <Input {...register('title')} aria-invalid={Boolean(errors.title)} />
        </Field>
        <Field label="Project description" error={errors.description?.message} className="sm:col-span-2">
          <Textarea
            {...register('description')}
            rows={5}
            placeholder={
              type === 'CONSULTANCY'
                ? 'Scope of the consultancy, client and deliverables…'
                : 'Aim, objectives and expected outcomes…'
            }
          />
        </Field>
        <Field label="Funder" error={errors.funderId?.message}>
          <Controller
            control={control}
            name="funderId"
            render={({ field }) => (
              <Combobox
                options={funders.data}
                loading={funders.isLoading}
                value={field.value as number | null}
                onChange={field.onChange}
                placeholder="Search funders…"
              />
            )}
          />
        </Field>
        <Field label="Country" error={errors.countryId?.message}>
          <Controller
            control={control}
            name="countryId"
            render={({ field }) => (
              <Combobox
                options={countries.data}
                loading={countries.isLoading}
                value={field.value as number | null}
                onChange={field.onChange}
                placeholder="Search countries…"
              />
            )}
          />
        </Field>
        {project && (
          <Field label="Status" error={errors.status?.message}>
            <NativeSelect {...register('status')}>
              {Object.entries(PROJECT_STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </NativeSelect>
          </Field>
        )}
      </FormSection>

      <FormSection index={2} title="Funding & dates" description="The award amount and project period.">
        <Field
          label="Total funding (in figures)"
          required
          error={errors.totalFunding?.message}
          hint={amount > 0 ? amountInWords(amount, currency) : undefined}
        >
          <Input
            type="number"
            step="0.01"
            min="0"
            {...register('totalFunding')}
            className="font-mono"
            aria-invalid={Boolean(errors.totalFunding)}
          />
        </Field>
        <Field label="Funding currency" required error={errors.currency?.message}>
          <NativeSelect {...register('currency')}>
            {CURRENCY_OPTIONS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Date awarded" error={errors.awardedAt?.message}>
          <Input type="date" {...register('awardedAt')} />
        </Field>
        <div className="hidden sm:block" />
        <Field label="Start date" error={errors.startDate?.message}>
          <Input type="date" {...register('startDate')} />
        </Field>
        <Field label="End date" error={errors.endDate?.message}>
          <Input type="date" {...register('endDate')} aria-invalid={Boolean(errors.endDate)} />
        </Field>
      </FormSection>

      <FormSection
        index={3}
        title="Investigators"
        description="The principal investigator leads; co-investigators share access to the project."
      >
        <Field label="Principal investigator" error={errors.piId?.message} className="sm:col-span-2">
          <Controller
            control={control}
            name="piId"
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
        <Field
          label="Co-investigators"
          error={errors.coInvestigatorIds?.message}
          className="sm:col-span-2"
          hint="Add as many as needed."
        >
          <Controller
            control={control}
            name="coInvestigatorIds"
            render={({ field }) => (
              <MultiCombobox
                options={investigators.data}
                loading={investigators.isLoading}
                value={(field.value as Array<number>) ?? []}
                onChange={field.onChange}
                exclude={piId ? [piId] : []}
                placeholder="Search and add co-investigators…"
              />
            )}
          />
        </Field>
      </FormSection>

      <FormSection index={4} title="Documents" description="The signed contract and approved budget (PDF or Word).">
        <Field label="Contract" className="sm:col-span-2">
          <Controller
            control={control}
            name="contractUrl"
            render={({ field }) => (
              <FileField
                value={{ url: (field.value as string) || null, name: (watch('contractName') as string) || null }}
                onChange={(v) => (field.onChange(v.url ?? ''), setValue('contractName', v.name ?? ''))}
              />
            )}
          />
        </Field>
        <Field label="Budget" className="sm:col-span-2">
          <Controller
            control={control}
            name="budgetUrl"
            render={({ field }) => (
              <FileField
                value={{ url: (field.value as string) || null, name: (watch('budgetName') as string) || null }}
                onChange={(v) => (field.onChange(v.url ?? ''), setValue('budgetName', v.name ?? ''))}
              />
            )}
          />
        </Field>
      </FormSection>

      <FormSection index={5} title="Final report" description="The project’s final report. You can fill this in later.">
        <div className="sm:col-span-2">
          <Controller
            control={control}
            name="finalReport"
            render={({ field }) => (
              <RichTextEditor
                value={field.value as string}
                onChange={field.onChange}
                placeholder="Write the final project report…"
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
          {save.isPending ? <Loader2 className="animate-spin" /> : <Save />}{' '}
          {project ? 'Save changes' : 'Create project'}
        </Button>
      </FormActions>
    </form>
  )
}
