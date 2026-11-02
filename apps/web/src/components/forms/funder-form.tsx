import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { z } from 'zod'
import { Eye, EyeOff, Globe, KeyRound, Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'
import { api, errorMessage } from '#/lib/api-client'
import { funderSchema } from '#/lib/schemas'
import { toFormValues } from '#/lib/form-utils'
import { Button } from '#/components/ui/button'
import { Input, Textarea } from '#/components/ui/input'
import { Switch } from '#/components/ui/switch'
import { Field, FormActions, FormSection } from '#/components/admin/form'
import { Combobox } from '#/components/admin/combobox'
import { useLookup } from '#/components/admin/lookups'

type In = z.input<typeof funderSchema>
type Out = z.output<typeof funderSchema>

const KEYS = [
  'name',
  'description',
  'location',
  'address',
  'phone',
  'email',
  'countryId',
  'websiteUrl',
  'logoUrl',
  'portalUrl',
  'portalUsername',
] as const

export function FunderForm({ funder }: { funder?: Record<string, any> }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const countries = useLookup('countries')
  const [showPassword, setShowPassword] = useState(false)
  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty },
  } = useForm<In, unknown, Out>({
    resolver: zodResolver(funderSchema),
    defaultValues: { name: '', portalPassword: '', clearPortalPassword: false },
  })
  useEffect(() => {
    if (funder)
      reset({
        ...toFormValues(funder, KEYS),
        countryId: funder.countryId ?? null,
        portalPassword: '',
        clearPortalPassword: false,
      })
  }, [funder, reset])

  const save = useMutation({
    mutationFn: (values: Out) =>
      funder ? api.put<{ id: number }>(`/funders/${funder.id}`, values) : api.post<{ id: number }>('/funders', values),
    onSuccess: async ({ id }) => {
      toast.success(funder ? 'Funder updated' : 'Funder added')
      await queryClient.invalidateQueries({ queryKey: ['funders'] })
      await queryClient.invalidateQueries({ queryKey: ['lookup', 'funders'] })
      await navigate({ to: '/admin/funders/$funderId', params: { funderId: String(id) } })
    },
    onError: (err) => toast.error(errorMessage(err)),
  })
  const logo = watch('logoUrl') as string | undefined

  return (
    <form onSubmit={handleSubmit((v) => save.mutate(v))} noValidate>
      <FormSection index={1} title="Organisation" description="Who the funder is and what they fund.">
        <Field label="Funder name" required error={errors.name?.message} className="sm:col-span-2">
          <Input
            {...register('name')}
            placeholder="e.g. Bill & Melinda Gates Foundation"
            aria-invalid={Boolean(errors.name)}
          />
        </Field>
        <Field label="Description" error={errors.description?.message} className="sm:col-span-2">
          <Textarea {...register('description')} rows={4} placeholder="Focus areas, programmes, typical award sizes…" />
        </Field>
        <Field
          label="Website logo URL"
          error={errors.logoUrl?.message}
          hint="A direct link to the funder’s logo image."
        >
          <div className="flex items-center gap-2">
            <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-white">
              {logo ? (
                <img src={logo} alt="" className="size-full object-contain p-1" />
              ) : (
                <Globe className="size-4 text-subtle-foreground" />
              )}
            </span>
            <Input {...register('logoUrl')} placeholder="https://…/logo.png" aria-invalid={Boolean(errors.logoUrl)} />
          </div>
        </Field>
        <Field label="Website address" error={errors.websiteUrl?.message}>
          <Input {...register('websiteUrl')} placeholder="https://" aria-invalid={Boolean(errors.websiteUrl)} />
        </Field>
      </FormSection>

      <FormSection index={2} title="Contact & location" description="How DRIC reaches the funder.">
        <Field label="Email address" error={errors.email?.message}>
          <Input type="email" {...register('email')} aria-invalid={Boolean(errors.email)} />
        </Field>
        <Field label="Phone number" error={errors.phone?.message}>
          <Input type="tel" {...register('phone')} />
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
        <Field label="Location" error={errors.location?.message} hint="City or region">
          <Input {...register('location')} />
        </Field>
        <Field label="Address" error={errors.address?.message} className="sm:col-span-2">
          <Input {...register('address')} />
        </Field>
      </FormSection>

      <FormSection
        index={3}
        title="Grant portal"
        description="Login for the funder’s online portal. The password is encrypted and only revealed on request."
      >
        <Field label="Portal address" error={errors.portalUrl?.message} className="sm:col-span-2">
          <Input {...register('portalUrl')} placeholder="https://" aria-invalid={Boolean(errors.portalUrl)} />
        </Field>
        <Field label="Portal username" error={errors.portalUsername?.message}>
          <Input {...register('portalUsername')} autoComplete="off" />
        </Field>
        <Field
          label="Portal password"
          error={errors.portalPassword?.message}
          hint={funder?.hasPortalPassword ? 'A password is stored. Leave blank to keep it.' : undefined}
        >
          <div className="relative">
            <KeyRound className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle-foreground" />
            <Input
              type={showPassword ? 'text' : 'password'}
              {...register('portalPassword')}
              autoComplete="new-password"
              className="pl-9"
              placeholder={funder?.hasPortalPassword ? '••••••••' : ''}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute top-1/2 right-3 -translate-y-1/2 text-subtle-foreground"
              aria-label="Toggle password visibility"
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </Field>
        {funder?.hasPortalPassword && (
          <Controller
            control={control}
            name="clearPortalPassword"
            render={({ field }) => (
              <label className="flex items-center gap-3 text-sm text-slate-700 sm:col-span-2">
                <Switch checked={Boolean(field.value)} onCheckedChange={field.onChange} /> Remove the stored password
              </label>
            )}
          />
        )}
      </FormSection>

      <FormActions>
        <Button type="button" variant="ghost" onClick={() => history.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={save.isPending || (Boolean(funder) && !isDirty)}>
          {save.isPending ? <Loader2 className="animate-spin" /> : <Save />} {funder ? 'Save changes' : 'Add funder'}
        </Button>
      </FormActions>
    </form>
  )
}
