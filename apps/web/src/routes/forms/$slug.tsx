import { Fragment, useEffect } from 'react'
import { createFileRoute, notFound, useNavigate } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import { Controller, useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { z } from 'zod'
import { AlertCircle, CheckCircle2, Clock, FileText, Info, Loader2, Mail, Plus, Send, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@dric/ui'
import { api, errorMessage } from '#/lib/api-client'
import { DRIC_EMAIL, REQUEST_FORM_BY_SLUG } from '#/lib/forms'
import type { FieldDef, RequestFormDef } from '#/lib/forms'
import { requestSchema } from '#/lib/schemas'
import { money, today } from '#/lib/format'
import { amountInWords } from '#/lib/words'
import { Button } from '#/components/ui/button'
import { Input, NativeSelect, Textarea } from '#/components/ui/input'
import { Field, FormSection, errorAt } from '#/components/admin/form'
import { AttachmentsField } from '#/components/admin/file-upload'
import { CURRENCY_OPTIONS } from '#/components/admin/lookups'
import { FormIcon } from '#/components/site/form-icon'
import { SiteFooter, SiteHeader, useMe } from '#/components/site/site-shell'

export const Route = createFileRoute('/forms/$slug')({
  loader: ({ params }) => {
    const def = REQUEST_FORM_BY_SLUG[params.slug]
    if (!def) throw notFound()
    return { title: def.title }
  },
  head: ({ loaderData }) => ({ meta: [{ title: `${loaderData?.title ?? 'Request form'} · DRIC` }] }),
  component: RequestFormPage,
})

type In = z.input<typeof requestSchema>
type Out = z.output<typeof requestSchema>

const blankEquipment = {
  description: '',
  quantity: 1,
  make: '',
  model: '',
  serialNo: '',
  assetNo: '',
  year: '',
  cost: '' as never,
}

function RequestFormPage() {
  const { slug } = Route.useParams()
  const def = REQUEST_FORM_BY_SLUG[slug]!
  return (
    <div className="min-h-dvh bg-canvas">
      <SiteHeader />
      <div className="mx-auto max-w-7xl px-5 py-10">
        <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-center">
          <span
            className="flex size-14 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg"
            style={{ background: def.accent }}
          >
            <FormIcon name={def.icon} className="size-6" />
          </span>
          <div>
            <p className="eyebrow">University of Cape Coast · DRIC</p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">{def.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{def.summary}</p>
          </div>
        </div>
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="rounded-3xl border bg-white p-6 shadow-sm sm:p-8">
            <RequestForm def={def} />
          </div>
          <aside className="space-y-4 lg:sticky lg:top-24">
            <div className="rounded-3xl border border-secondary-strong bg-secondary p-5 text-sm text-secondary-foreground">
              <p className="flex items-center gap-2 font-bold">
                <Clock className="size-4" /> Processing time
              </p>
              <p className="mt-2 leading-relaxed">
                Please allow <b>{def.allowance}</b> from your deadline for DRIC to process the request and give
                feedback.
              </p>
            </div>
            <div className="rounded-3xl border bg-white p-5">
              <p className="flex items-center gap-2 text-sm font-bold">
                <FileText className="size-4 text-muted-foreground" /> Documents to attach
              </p>
              <ol className="mt-3 space-y-2.5 text-sm text-slate-600">
                {def.attachments.map((a, i) => (
                  <li key={a} className="flex gap-2.5">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-[0.65rem] font-bold">
                      {i + 1}
                    </span>
                    {a}
                  </li>
                ))}
              </ol>
              <p className="mt-4 flex items-start gap-2 rounded-2xl bg-muted p-3 text-xs text-muted-foreground">
                <Mail className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  You can also email soft copies to{' '}
                  <a href={`mailto:${DRIC_EMAIL}`} className="font-semibold text-primary">
                    {DRIC_EMAIL}
                  </a>
                  , quoting your reference.
                </span>
              </p>
            </div>
          </aside>
        </div>
      </div>
      <SiteFooter />
    </div>
  )
}

function RequestForm({ def }: { def: RequestFormDef }) {
  const navigate = useNavigate()
  const me = useMe()
  const {
    register,
    control,
    handleSubmit,
    setValue,
    getValues,
    watch,
    formState: { errors, submitCount },
  } = useForm<In, unknown, Out>({
    resolver: zodResolver(requestSchema),
    defaultValues: {
      type: def.type,
      data: {},
      items: def.hasItems ? [blankEquipment] : [],
      attachments: [],
      currency: 'GHS',
      declaration: false as never,
      surname: '',
      firstName: '',
    },
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'items' })

  // Signed-in investigators get their particulars filled in.
  useEffect(() => {
    const p = me.data?.profile
    if (!p || getValues('surname')) return
    const set = (name: keyof In, value: unknown) => value && setValue(name, value as never)
    set('surname', p.lastName)
    set('firstName', p.firstName)
    set('middleName', p.middleName)
    set('college', p.college)
    set('faculty', p.faculty)
    set('department', p.department)
    set('designation', p.designation)
    set('email', p.email)
    set('phone', p.phone)
    set('signedName', [p.title, p.firstName, p.lastName].filter(Boolean).join(' '))
  }, [me.data, getValues, setValue])

  const submit = useMutation({
    mutationFn: (values: Out) => api.post<{ reference: string; accessKey: string }>('/public/requests', values),
    onSuccess: ({ reference, accessKey }) =>
      navigate({ to: '/submitted/$reference', params: { reference }, search: { k: accessKey } }),
    onError: (err) => toast.error(errorMessage(err)),
  })

  const currency = watch('currency') as string
  const items = (watch('items') ?? []) as Array<{ cost: unknown }>
  // As on the paper form, Total Amount is the sum of the Cost column.
  const equipmentTotal = items.reduce((s, i) => s + (Number(i.cost) || 0), 0)
  const errorCount = Object.keys(errors).length
  let step = 1

  return (
    <form onSubmit={handleSubmit((v) => submit.mutate(v))} noValidate>
      {def.notices && (
        <div className="mb-8 rounded-2xl border border-amber-200 bg-warning-soft p-5 text-sm text-amber-900">
          <p className="flex items-center gap-2 font-bold">
            <Info className="size-4" /> Please note the following
          </p>
          <ol className="mt-2 list-decimal space-y-2 pl-5 leading-relaxed">
            {def.notices.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ol>
        </div>
      )}

      <FormSection
        index={step++}
        title="Particulars of principal investigator or lead consultant"
        description="As they should appear on the form."
      >
        <Field label="Surname" required error={errors.surname?.message}>
          <Input {...register('surname')} aria-invalid={Boolean(errors.surname)} autoComplete="family-name" />
        </Field>
        <Field label="First name" required error={errors.firstName?.message}>
          <Input {...register('firstName')} aria-invalid={Boolean(errors.firstName)} autoComplete="given-name" />
        </Field>
        <Field label="Middle name" error={errors.middleName?.message}>
          <Input {...register('middleName')} autoComplete="additional-name" />
        </Field>
        <Field label="College" error={errors.college?.message}>
          <Input {...register('college')} />
        </Field>
        <Field label="Faculty / School" error={errors.faculty?.message}>
          <Input {...register('faculty')} />
        </Field>
        <Field label="Directorate / Centre / Department / Office" required error={errors.department?.message}>
          <Input {...register('department')} aria-invalid={Boolean(errors.department)} />
        </Field>
        <Field label="Designation / Title" required error={errors.designation?.message}>
          <Input
            {...register('designation')}
            aria-invalid={Boolean(errors.designation)}
            placeholder="e.g. Senior Lecturer"
          />
        </Field>
        <Field
          label="Email address"
          required
          error={errors.email?.message}
          hint="We use this to match your request when you track it."
        >
          <Input type="email" {...register('email')} aria-invalid={Boolean(errors.email)} autoComplete="email" />
        </Field>
        <Field label="Cell phone no." required error={errors.phone?.message}>
          <Input type="tel" {...register('phone')} aria-invalid={Boolean(errors.phone)} autoComplete="tel" />
        </Field>
      </FormSection>

      <FormSection
        index={step++}
        title={def.detailsHeading}
        description={
          def.showCallLink
            ? 'A copy of the request/call for applications, or a link to it.'
            : 'The project this request is about.'
        }
      >
        {def.linksProject && (
          <Field
            label="DRIC project code"
            error={errors.projectCode?.message}
            hint="If known, e.g. DRIC-2025-004 — helps DRIC link your request."
          >
            <Input {...register('projectCode')} className="font-mono uppercase" placeholder="DRIC-" />
          </Field>
        )}
        {def.showCallLink && (
          <Field
            label="Link to the request/call (if applicable)"
            error={errors.callLink?.message}
            className="sm:col-span-2"
          >
            <Input {...register('callLink')} placeholder="https://" aria-invalid={Boolean(errors.callLink)} />
          </Field>
        )}
        <Field label="Proposed project title" required error={errors.projectTitle?.message} className="sm:col-span-2">
          <Input {...register('projectTitle')} aria-invalid={Boolean(errors.projectTitle)} />
        </Field>
        <Field label="Funding agency(ies)" required error={errors.fundingAgencies?.message}>
          <Input {...register('fundingAgencies')} aria-invalid={Boolean(errors.fundingAgencies)} />
        </Field>
        <Field
          label={`Funding agency email address(es)${def.showCallLink ? ' (if applicable)' : ''}`}
          error={errors.funderEmails?.message}
        >
          <Input {...register('funderEmails')} />
        </Field>
      </FormSection>

      {def.groups.map((group, gi) => (
        <Fragment key={gi}>
          <FormSection
            index={step++}
            title={group.heading ?? (gi === 0 ? 'Further details' : 'Additional information')}
            description={group.note}
          >
            {group.fields.map((f) => (
              <DynamicField
                key={f.name}
                field={f}
                register={register}
                control={control}
                error={errorAt(errors, `data.${f.name}`)}
                currency={currency}
                setCurrency={(c) => setValue('currency', c as never)}
              />
            ))}
          </FormSection>
          {/* As on the paper form, the equipment table follows the equipment details. */}
          {def.hasItems && group.heading === 'Details of Equipment' && (
            <FormSection
              index={step++}
              title="Description of equipment"
              description="List each item of equipment to be transferred."
            >
              <Field label="Cost currency">
                <NativeSelect {...register('currency')}>
                  {CURRENCY_OPTIONS.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </NativeSelect>
              </Field>
              <div className="space-y-3 sm:col-span-2">
                {fields.map((f, index) => (
                  <div key={f.id} className="rounded-2xl border bg-slate-50/50 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="eyebrow">Item {index + 1}</p>
                      {fields.length > 1 && (
                        <button
                          type="button"
                          onClick={() => remove(index)}
                          className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-secondary-foreground"
                          aria-label={`Remove item ${index + 1}`}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-4">
                      <Field
                        label="Description of equipment"
                        required
                        error={errorAt(errors, `items.${index}.description`)}
                        className="sm:col-span-3"
                      >
                        <Input {...register(`items.${index}.description`)} />
                      </Field>
                      <Field label="Quantity">
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          {...register(`items.${index}.quantity`)}
                          className="font-mono"
                        />
                      </Field>
                      <Field label="Make">
                        <Input {...register(`items.${index}.make`)} />
                      </Field>
                      <Field label="Model no.">
                        <Input {...register(`items.${index}.model`)} />
                      </Field>
                      <Field label="Serial no.">
                        <Input {...register(`items.${index}.serialNo`)} className="font-mono" />
                      </Field>
                      <Field label="UCC asset no.">
                        <Input {...register(`items.${index}.assetNo`)} className="font-mono" />
                      </Field>
                      <Field label="Year of purchase" error={errorAt(errors, `items.${index}.year`)}>
                        <Input
                          type="number"
                          min="1950"
                          max="2100"
                          {...register(`items.${index}.year`)}
                          className="font-mono"
                        />
                      </Field>
                      <Field label={`Cost (${currency})`} error={errorAt(errors, `items.${index}.cost`)}>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          {...register(`items.${index}.cost`)}
                          className="font-mono"
                        />
                      </Field>
                    </div>
                  </div>
                ))}
                {errors.items?.message && (
                  <p className="text-xs font-medium text-destructive">{errors.items.message}</p>
                )}
                <div className="flex items-center justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => append(blankEquipment)}
                    disabled={fields.length >= 50}
                  >
                    <Plus /> Add equipment
                  </Button>
                  <p className="text-sm">
                    Total <span className="font-mono font-semibold">{money(equipmentTotal, currency)}</span>
                  </p>
                </div>
              </div>
            </FormSection>
          )}
        </Fragment>
      ))}

      <FormSection index={step++} title="Attachments" description="Upload the documents listed alongside this form.">
        <div className="sm:col-span-2">
          <Controller
            control={control}
            name="attachments"
            render={({ field }) => <AttachmentsField value={(field.value as never) ?? []} onChange={field.onChange} />}
          />
        </div>
      </FormSection>

      <FormSection index={step++} title="Declaration" description="Type your full name as your signature.">
        <Field
          label="Signature of principal investigator / lead consultant"
          required
          error={errors.signedName?.message}
        >
          <Input
            {...register('signedName')}
            className="font-serif text-lg italic"
            aria-invalid={Boolean(errors.signedName)}
          />
        </Field>
        <Field label="Date">
          <Input value={today()} readOnly disabled />
        </Field>
        <Controller
          control={control}
          name="declaration"
          render={({ field }) => (
            <label
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-2xl border p-4 text-sm sm:col-span-2',
                errors.declaration ? 'border-destructive bg-red-50/50' : 'hover:bg-slate-50',
              )}
            >
              <input
                type="checkbox"
                checked={field.value === true}
                onChange={(e) => field.onChange(e.target.checked)}
                className="mt-0.5 size-4 accent-[var(--primary)]"
              />
              <span>
                I confirm that the information given in this form is accurate and complete, and that DRIC may contact me
                about this request.
                {errors.declaration && (
                  <span className="mt-1 block text-xs font-medium text-destructive">{errors.declaration.message}</span>
                )}
              </span>
            </label>
          )}
        />
      </FormSection>

      <div className="mt-2 flex flex-col-reverse items-stretch gap-3 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
        {submitCount > 0 && errorCount > 0 ? (
          <p className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="size-4" /> Please fix the highlighted fields.
          </p>
        ) : (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <CheckCircle2 className="size-4 text-success" /> You’ll get a reference number to track your request.
          </p>
        )}
        <Button type="submit" size="lg" disabled={submit.isPending}>
          {submit.isPending ? <Loader2 className="animate-spin" /> : <Send />} Submit to DRIC
        </Button>
      </div>
    </form>
  )
}

function DynamicField({
  field,
  register,
  control,
  error,
  currency,
  setCurrency,
}: {
  field: FieldDef
  register: ReturnType<typeof useForm<In, unknown, Out>>['register']
  control: ReturnType<typeof useForm<In, unknown, Out>>['control']
  error?: string
  currency: string
  setCurrency: (c: string) => void
}) {
  const name = `data.${field.name}` as const
  const wide = field.wide || field.kind === 'textarea' ? 'sm:col-span-2' : undefined
  if (field.kind === 'yesno') {
    return (
      <Field label={field.label} required={field.required} error={error} className={wide}>
        <Controller
          control={control}
          name={name}
          render={({ field: f }) => (
            <div className="flex gap-2">
              {(['yes', 'no'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => f.onChange(v)}
                  className={cn(
                    'h-10 min-w-24 rounded-full border px-5 text-sm font-semibold capitalize transition-all',
                    f.value === v ? 'border-primary bg-primary text-white' : 'bg-white hover:border-border-strong',
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
          )}
        />
      </Field>
    )
  }
  if (field.kind === 'money') {
    return (
      <Controller
        control={control}
        name={name}
        render={({ field: f }) => (
          <Field
            label={field.label}
            required={field.required}
            error={error}
            className="sm:col-span-2"
            hint={Number(f.value) > 0 ? `In words: ${amountInWords(Number(f.value), currency)}` : undefined}
          >
            <div className="flex gap-2">
              <NativeSelect value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-28">
                {CURRENCY_OPTIONS.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </NativeSelect>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={(f.value as string) ?? ''}
                onChange={(e) => f.onChange(e.target.value)}
                className="font-mono"
                aria-invalid={Boolean(error)}
              />
            </div>
          </Field>
        )}
      />
    )
  }
  return (
    <Field label={field.label} required={field.required} error={error} hint={field.hint} className={wide}>
      {field.kind === 'textarea' ? (
        <Textarea {...register(name)} rows={4} aria-invalid={Boolean(error)} />
      ) : field.kind === 'select' ? (
        <NativeSelect {...register(name)} aria-invalid={Boolean(error)}>
          <option value="">Choose…</option>
          {field.options?.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </NativeSelect>
      ) : (
        <Input type={field.kind === 'date' ? 'date' : 'text'} {...register(name)} aria-invalid={Boolean(error)} />
      )}
    </Field>
  )
}
