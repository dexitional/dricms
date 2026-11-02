import { useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'
import { api, errorMessage } from '#/lib/api-client'
import { investigatorSchema, personnelSchema } from '#/lib/schemas'
import { TITLES } from '#/lib/labels'
import { toFormValues } from '#/lib/form-utils'
import { Button } from '#/components/ui/button'
import { Input, NativeSelect } from '#/components/ui/input'
import { Switch } from '#/components/ui/switch'
import { Field, FormActions, FormSection } from '#/components/admin/form'

const BASE_KEYS = [
  'title',
  'firstName',
  'middleName',
  'lastName',
  'location',
  'phone',
  'email',
  'staffNo',
  'department',
  'address',
  'ghanaCardNo',
  'accountName',
  'bankName',
  'accountNo',
  'bankBranch',
  'isActive',
]
const INVESTIGATOR_KEYS = [...BASE_KEYS, 'college', 'faculty', 'designation']

/** Investigators and personnel share the same record shape. */
export function PersonForm({ kind, person }: { kind: 'investigator' | 'personnel'; person?: Record<string, any> }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isInv = kind === 'investigator'
  const base = isInv ? '/investigators' : '/personnel'
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<any>({
    resolver: zodResolver(isInv ? investigatorSchema : personnelSchema),
    defaultValues: { firstName: '', lastName: '', isActive: true },
  })
  useEffect(() => {
    if (person) reset(toFormValues(person, isInv ? INVESTIGATOR_KEYS : BASE_KEYS))
  }, [person, reset, isInv])
  const save = useMutation({
    mutationFn: (values: unknown) =>
      person ? api.put<{ id: number }>(`${base}/${person.id}`, values) : api.post<{ id: number }>(base, values),
    onSuccess: async ({ id }) => {
      toast.success(person ? 'Changes saved' : `${isInv ? 'Investigator' : 'Personnel'} added`)
      await queryClient.invalidateQueries({ queryKey: [kind] })
      await queryClient.invalidateQueries({ queryKey: ['lookup', isInv ? 'investigators' : 'personnel'] })
      if (isInv) await navigate({ to: '/admin/investigators/$investigatorId', params: { investigatorId: String(id) } })
      else await navigate({ to: '/admin/personnel/$personnelId', params: { personnelId: String(id) } })
    },
    onError: (err) => toast.error(errorMessage(err)),
  })
  const err = (name: string) => (errors[name]?.message as string | undefined) ?? undefined

  return (
    <form onSubmit={handleSubmit((v) => save.mutate(v))} noValidate>
      <FormSection
        index={1}
        title="Identity"
        description={
          isInv
            ? 'Investigators lead or coordinate projects and can sign in to request funds.'
            : 'Personnel are assigned to manage activities within project phases.'
        }
      >
        <Field label="Title" error={err('title')}>
          <NativeSelect {...register('title')}>
            <option value="">—</option>
            {TITLES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="First name" required error={err('firstName')}>
          <Input {...register('firstName')} aria-invalid={Boolean(errors.firstName)} />
        </Field>
        <Field label="Middle name(s)" error={err('middleName')}>
          <Input {...register('middleName')} />
        </Field>
        <Field label="Last name" required error={err('lastName')}>
          <Input {...register('lastName')} aria-invalid={Boolean(errors.lastName)} />
        </Field>
        <Field label="Staff number" error={err('staffNo')}>
          <Input {...register('staffNo')} />
        </Field>
        <Field label="Ghana Card number" error={err('ghanaCardNo')} hint="GHA-000000000-0">
          <Input
            {...register('ghanaCardNo')}
            placeholder="GHA-"
            className="font-mono uppercase"
            aria-invalid={Boolean(errors.ghanaCardNo)}
          />
        </Field>
      </FormSection>

      <FormSection
        index={2}
        title="Work & contact"
        description={isInv ? 'College, faculty and designation are printed on the DRIC request forms.' : undefined}
      >
        {isInv && (
          <>
            <Field label="College" error={err('college')}>
              <Input {...register('college')} placeholder="e.g. College of Health and Allied Sciences" />
            </Field>
            <Field label="Faculty / School" error={err('faculty')}>
              <Input {...register('faculty')} />
            </Field>
          </>
        )}
        <Field
          label="Department"
          error={err('department')}
          hint={isInv ? 'Directorate, centre, department or office' : undefined}
        >
          <Input {...register('department')} />
        </Field>
        {isInv && (
          <Field label="Designation" error={err('designation')} hint="e.g. Senior Lecturer">
            <Input {...register('designation')} />
          </Field>
        )}
        <Field label="Email address" error={err('email')}>
          <Input type="email" {...register('email')} aria-invalid={Boolean(errors.email)} />
        </Field>
        <Field label="Phone number" error={err('phone')}>
          <Input type="tel" {...register('phone')} />
        </Field>
        <Field label="Location" error={err('location')}>
          <Input {...register('location')} />
        </Field>
        <Field label="Address" error={err('address')}>
          <Input {...register('address')} />
        </Field>
      </FormSection>

      <FormSection
        index={3}
        title="Bank details"
        description="Where disbursed funds are paid. Printed on payment vouchers."
      >
        <Field label="Account name" error={err('accountName')}>
          <Input {...register('accountName')} />
        </Field>
        <Field label="Bank name" error={err('bankName')}>
          <Input {...register('bankName')} />
        </Field>
        <Field label="Account number" error={err('accountNo')}>
          <Input {...register('accountNo')} className="font-mono" />
        </Field>
        <Field label="Bank branch" error={err('bankBranch')}>
          <Input {...register('bankBranch')} />
        </Field>
        <Controller
          control={control}
          name="isActive"
          render={({ field }) => (
            <label className="flex items-center gap-3 text-sm text-slate-700 sm:col-span-2">
              <Switch checked={Boolean(field.value)} onCheckedChange={field.onChange} />
              Active — available to assign {isInv ? 'to projects' : 'to activities'}
            </label>
          )}
        />
      </FormSection>

      <FormActions>
        <Button type="button" variant="ghost" onClick={() => history.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={save.isPending || (Boolean(person) && !isDirty)}>
          {save.isPending ? <Loader2 className="animate-spin" /> : <Save />} {person ? 'Save changes' : 'Save'}
        </Button>
      </FormActions>
    </form>
  )
}
