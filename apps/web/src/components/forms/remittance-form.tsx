import { useEffect, useMemo, useRef } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { z } from 'zod'
import { Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@dric/ui'
import { api, errorMessage } from '#/lib/api-client'
import type { Option } from '#/lib/api-client'
import { remittanceSchema } from '#/lib/schemas'
import { money, today } from '#/lib/format'
import { Button } from '#/components/ui/button'
import { Input, NativeSelect } from '#/components/ui/input'
import { Field, FormActions, FormSection } from '#/components/admin/form'
import { Combobox } from '#/components/admin/combobox'
import { AttachmentsField } from '#/components/admin/file-upload'
import type { UploadedFile } from '#/components/admin/file-upload'
import { CURRENCY_OPTIONS, useLookup } from '#/components/admin/lookups'
import { RateField, saveRatesToRegister } from '#/components/admin/rate-field'
import type { RateEntry } from '#/components/admin/rate-field'

type In = z.input<typeof remittanceSchema>
type Out = z.output<typeof remittanceSchema>
type ProjectOption = Option & { currency: string; funderId: number | null }

/** Funds a funder distributes to a project, credited to the project's balance sheet. */
export function RemittanceForm({
  remittance,
  funderId,
  projectId,
}: {
  remittance?: Record<string, any>
  funderId?: number
  projectId?: number
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const funders = useLookup('funders')
  // A rate ticked "save to the register", added once the remittance is saved.
  const remembered = useRef<RateEntry | null>(null)
  const projects = useLookup<ProjectOption>('projects')
  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<In, unknown, Out>({
    resolver: zodResolver(remittanceSchema),
    defaultValues: {
      funderId: funderId ?? null,
      projectId: projectId ?? ('' as never),
      amount: '' as never,
      currency: 'USD',
      exchangeRate: 1,
      receivedAt: today(),
      attachments: [],
    },
  })
  useEffect(() => {
    if (remittance)
      reset({
        funderId: remittance.funderId,
        projectId: remittance.projectId,
        description: remittance.description ?? '',
        amount: remittance.amount,
        currency: remittance.currency,
        exchangeRate: remittance.exchangeRate,
        receivedAt: remittance.receivedAt,
        attachments: remittance.attachments ?? [],
      })
  }, [remittance, reset])

  const selectedFunder = watch('funderId') as number | null
  const selectedProject = Number(watch('projectId')) || 0
  const project = projects.data?.find((p) => p.value === selectedProject)
  // Projects of the chosen funder first; a project may also take money from a co-funder.
  const projectOptions = useMemo(() => {
    if (!selectedFunder || !projects.data) return projects.data
    const own = projects.data.filter((p) => p.funderId === selectedFunder)
    return own.length ? own : projects.data
  }, [projects.data, selectedFunder])
  // Prefill the project's funder and currency for a new remittance.
  useEffect(() => {
    if (remittance || !project) return
    if (!selectedFunder && project.funderId) setValue('funderId', project.funderId)
    setValue('currency', project.currency as never)
  }, [remittance, project, selectedFunder, setValue])

  const currency = watch('currency') as string
  const sameCurrency = project ? currency === project.currency : true
  // Same currency means rate 1. A new remittance in another currency starts
  // blank (not 1) so the register's rate, or the one typed, is used.
  useEffect(() => {
    if (sameCurrency) setValue('exchangeRate', 1)
    else if (!remittance && Number(getValues('exchangeRate')) === 1) setValue('exchangeRate', '' as never)
  }, [sameCurrency, remittance, getValues, setValue])
  const receivedAt = watch('receivedAt') as string

  const ledger = useQuery({
    queryKey: ['projects', String(selectedProject), 'ledger'],
    queryFn: () => api.get<Record<string, any>>(`/projects/${selectedProject}/ledger`),
    enabled: selectedProject > 0,
  })
  const amount = Number(watch('amount')) || 0
  const rate = Number(watch('exchangeRate')) || 0
  const converted = amount * rate
  // When editing, this remittance is already in the balance.
  const balance = ledger.data
    ? ledger.data.summary.balance -
      (remittance && remittance.projectId === selectedProject
        ? Number(remittance.amount) * Number(remittance.exchangeRate)
        : 0)
    : 0

  const save = useMutation({
    mutationFn: (values: Out) =>
      remittance
        ? api.put<{ id: number }>(`/remittances/${remittance.id}`, values)
        : api.post<{ id: number; reference: string }>('/remittances', values),
    onSuccess: async (res, values) => {
      toast.success(
        remittance ? 'Remittance updated' : `Remittance ${'reference' in res ? res.reference : ''} recorded`,
      )
      const reference = 'reference' in res ? res.reference : remittance?.reference
      try {
        if (
          await saveRatesToRegister([remembered.current], values.receivedAt, `Remittance ${reference ?? ''}`.trim())
        ) {
          toast.success('Rate saved to the register')
          await queryClient.invalidateQueries({ queryKey: ['rates'] })
        }
      } catch (err) {
        toast.error(`The remittance was saved, but the rate register wasn’t updated: ${errorMessage(err)}`)
      }
      await queryClient.invalidateQueries({ queryKey: ['remittances'] })
      await queryClient.invalidateQueries({ queryKey: ['projects'] })
      await queryClient.invalidateQueries({ queryKey: ['funders'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      await navigate({
        to: '/admin/projects/$projectId',
        params: { projectId: String(values.projectId) },
        search: { tab: 'funds' },
      })
    },
    onError: (err) => toast.error(errorMessage(err)),
  })

  return (
    <form onSubmit={handleSubmit((v) => save.mutate(v))} noValidate>
      <FormSection index={1} title="Funder and project" description="Who sent the money and which project it is for.">
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
        <Field label="Project" required error={errors.projectId?.message}>
          <Controller
            control={control}
            name="projectId"
            render={({ field }) => (
              <Combobox
                options={projectOptions}
                loading={projects.isLoading}
                value={field.value as number | null}
                onChange={field.onChange}
                clearable={false}
                invalid={Boolean(errors.projectId)}
                placeholder="Search projects…"
              />
            )}
          />
        </Field>
        {project && ledger.data && (
          <div className="grid grid-cols-2 gap-3 rounded-2xl bg-muted p-4 text-sm sm:col-span-2 sm:grid-cols-4">
            <div>
              <p className="eyebrow">Award</p>
              <p className="mt-1 font-mono font-semibold">{money(ledger.data.summary.award, project.currency)}</p>
            </div>
            <div>
              <p className="eyebrow">Received so far</p>
              <p className="mt-1 font-mono font-semibold">{money(ledger.data.summary.received, project.currency)}</p>
            </div>
            <div>
              <p className="eyebrow">Current balance</p>
              <p className={cn('mt-1 font-mono font-semibold', balance < 0 && 'text-destructive')}>
                {money(balance, project.currency)}
              </p>
            </div>
            <div>
              <p className="eyebrow">After this remittance</p>
              <p className="mt-1 font-mono font-semibold text-emerald-700">
                {money(balance + converted, project.currency)}
              </p>
            </div>
          </div>
        )}
      </FormSection>
      <FormSection
        index={2}
        title="Remittance"
        description="The amount as the funder sent it, and the rate it converts into the project’s currency at."
      >
        <Field label="Amount received" required error={errors.amount?.message}>
          <Input
            type="number"
            step="0.01"
            min="0"
            {...register('amount')}
            className="font-mono"
            aria-invalid={Boolean(errors.amount)}
          />
        </Field>
        <Field label="Currency" required>
          <NativeSelect {...register('currency')}>
            {CURRENCY_OPTIONS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Date received" required error={errors.receivedAt?.message}>
          <Input type="date" {...register('receivedAt')} />
        </Field>
        <Field
          label="Exchange rate"
          required
          error={errors.exchangeRate?.message}
          className={project && !sameCurrency ? 'sm:col-span-2' : undefined}
          hint={
            project && !sameCurrency
              ? `Rates change, so use the rate on the day received. Credited: ${money(converted, project.currency)}`
              : undefined
          }
        >
          {project && !sameCurrency ? (
            <Controller
              control={control}
              name="exchangeRate"
              render={({ field }) => (
                <RateField
                  from={currency}
                  to={project.currency}
                  on={receivedAt}
                  value={Number(field.value) > 0 ? Number(field.value) : null}
                  onChange={(r) => field.onChange(r ?? '')}
                  autoApply={!remittance}
                  invalid={Boolean(errors.exchangeRate)}
                  onRemember={(e) => (remembered.current = e)}
                />
              )}
            />
          ) : (
            <p className="flex h-10 items-center rounded-xl bg-muted px-3 text-sm text-muted-foreground">
              Same currency as the project (rate 1)
            </p>
          )}
        </Field>
        <Field label="Description" error={errors.description?.message} className="sm:col-span-2">
          <Input {...register('description')} placeholder="e.g. Second instalment — year 2 budget" />
        </Field>
      </FormSection>
      <FormSection
        index={3}
        title="Proof of receipt"
        description="Bank credit advice, remittance letter or funder notification."
      >
        <div className="sm:col-span-2">
          <Controller
            control={control}
            name="attachments"
            render={({ field }) => (
              <AttachmentsField
                endpoint="/files"
                value={(field.value ?? []) as Array<UploadedFile>}
                onChange={field.onChange}
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
          {remittance ? 'Save changes' : 'Record remittance'}
        </Button>
      </FormActions>
    </form>
  )
}
