import { createFileRoute } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { z } from 'zod'
import { KeyRound, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { api, errorMessage } from '#/lib/api-client'
import { ROLE_LABELS } from '#/lib/labels'
import { changePasswordSchema } from '#/lib/schemas'
import { Button } from '#/components/ui/button'
import { Card, CardBody, CardHeader } from '#/components/ui/card'
import { Input } from '#/components/ui/input'
import { Field } from '#/components/admin/form'
import { DetailList, PageHeader } from '#/components/admin/page'
import { useUser } from '#/components/admin/session'

export const Route = createFileRoute('/admin/account')({ component: AccountPage })

type Values = z.infer<typeof changePasswordSchema>

function AccountPage() {
  const user = useUser()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(changePasswordSchema) })
  const save = useMutation({
    mutationFn: (v: Values) => api.post('/auth/password', v),
    onSuccess: () => (
      toast.success('Password changed'),
      reset({ currentPassword: '', newPassword: '', confirmPassword: '' })
    ),
    onError: (err) => toast.error(errorMessage(err)),
  })
  return (
    <>
      <PageHeader title="My account" />
      <div className="grid max-w-4xl gap-4 md:grid-cols-2">
        <Card>
          <CardHeader title="Profile" />
          <CardBody>
            <DetailList
              columns={1}
              items={[
                ['Name', user.fullName],
                ['Email', user.email],
                ['Role', ROLE_LABELS[user.role]],
              ]}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Change password" />
          <CardBody>
            <form onSubmit={handleSubmit((v) => save.mutate(v))} className="space-y-4" noValidate>
              <Field label="Current password" error={errors.currentPassword?.message}>
                <Input type="password" autoComplete="current-password" {...register('currentPassword')} />
              </Field>
              <Field label="New password" error={errors.newPassword?.message}>
                <Input type="password" autoComplete="new-password" {...register('newPassword')} />
              </Field>
              <Field label="Confirm new password" error={errors.confirmPassword?.message}>
                <Input type="password" autoComplete="new-password" {...register('confirmPassword')} />
              </Field>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? <Loader2 className="animate-spin" /> : <KeyRound />} Update password
              </Button>
            </form>
          </CardBody>
        </Card>
      </div>
    </>
  )
}
