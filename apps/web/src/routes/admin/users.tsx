import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { z } from 'zod'
import { Loader2, Lock, MoreHorizontal, Pencil, Plus, Save, ShieldCheck, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { USER_ROLES } from '@dric/db/types'
import { api, errorMessage } from '#/lib/api-client'
import { relative } from '#/lib/format'
import { ROLE_LABELS } from '#/lib/labels'
import { userSchema } from '#/lib/schemas'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Dialog, DialogContent } from '#/components/ui/dialog'
import { Dropdown, DropdownContent, DropdownItem, DropdownTrigger } from '#/components/ui/dropdown'
import { Input, NativeSelect } from '#/components/ui/input'
import { Switch } from '#/components/ui/switch'
import { Combobox } from '#/components/admin/combobox'
import { DataTable, FilterSelect, SearchInput, Toolbar } from '#/components/admin/data-table'
import { Field } from '#/components/admin/form'
import { useLookup } from '#/components/admin/lookups'
import { Avatar, EmptyState, PageHeader } from '#/components/admin/page'
import { useConfirm } from '#/components/admin/confirm'
import { useUser } from '#/components/admin/session'

export const Route = createFileRoute('/admin/users')({ component: UsersPage })

type Row = Record<string, any> & { id: number }
type In = z.input<typeof userSchema>
type Out = z.output<typeof userSchema>

const ROLE_HINTS: Record<string, string> = {
  administrator: 'Full access, including user accounts',
  director: 'Views everything; decides on claims and requests',
  accountant: 'Processes claims and records tranche payments',
  clerk: 'Maintains funders, projects, people and form intake',
  investigator: 'Own projects only; submits claims',
}

function UsersPage() {
  const me = useUser()
  const queryClient = useQueryClient()
  const { confirm, dialog } = useConfirm()
  const [q, setQ] = useState('')
  const [role, setRole] = useState('')
  const [editing, setEditing] = useState<Row | null>(null)
  const [open, setOpen] = useState(false)
  const { data, isLoading } = useQuery({
    queryKey: ['users', { q, role }],
    queryFn: () => api.get<Array<Row>>('/users', { q, role }),
  })
  const remove = (u: Row) =>
    confirm({
      title: `Delete ${u.fullName}’s account?`,
      description: 'They will no longer be able to sign in. Their records are kept.',
      danger: true,
      confirmLabel: 'Delete account',
      onConfirm: async () => {
        try {
          await api.delete(`/users/${u.id}`)
          toast.success('Account deleted')
          await queryClient.invalidateQueries({ queryKey: ['users'] })
        } catch (err) {
          toast.error(errorMessage(err))
        }
      },
    })
  return (
    <>
      {dialog}
      <UserDialog open={open} onOpenChange={setOpen} user={editing} />
      <PageHeader
        title="User accounts"
        description="Who can sign in to the portal, and what their role lets them do."
        actions={
          <Button onClick={() => (setEditing(null), setOpen(true))}>
            <Plus /> New account
          </Button>
        }
      />
      <Toolbar>
        <SearchInput value={q} onChange={setQ} placeholder="Search name or email…" />
        <FilterSelect
          label="Role"
          value={role}
          onChange={setRole}
          options={USER_ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
        />
      </Toolbar>
      <DataTable
        loading={isLoading}
        rows={data}
        empty={<EmptyState icon={ShieldCheck} title="No accounts found" />}
        columns={[
          {
            header: 'User',
            cell: (u) => (
              <span className="flex items-center gap-3">
                <Avatar name={u.fullName} />
                <span>
                  <span className="block font-semibold text-slate-800">
                    {u.fullName}{' '}
                    {u.id === me.id && <span className="text-xs font-normal text-muted-foreground">(you)</span>}
                  </span>
                  <span className="text-xs text-muted-foreground">{u.email}</span>
                </span>
              </span>
            ),
          },
          {
            header: 'Role',
            cell: (u) => (
              <Badge
                tone={u.role === 'administrator' ? 'danger' : u.role === 'investigator' ? 'neutral' : 'brand'}
                dot={false}
              >
                {ROLE_LABELS[u.role as keyof typeof ROLE_LABELS]}
              </Badge>
            ),
          },
          {
            header: 'Status',
            cell: (u) => (
              <span className="flex items-center gap-1.5">
                <Badge tone={u.isActive ? 'success' : 'neutral'}>{u.isActive ? 'Active' : 'Disabled'}</Badge>
                {u.locked ? (
                  <Badge tone="warning" dot={false}>
                    <Lock className="size-3" /> Locked
                  </Badge>
                ) : null}
              </span>
            ),
          },
          {
            header: 'Last sign-in',
            cell: (u) => (
              <span className="text-xs text-muted-foreground">{u.lastLoginAt ? relative(u.lastLoginAt) : 'Never'}</span>
            ),
          },
          {
            header: '',
            align: 'right',
            cell: (u) => (
              <Dropdown>
                <DropdownTrigger
                  className="rounded-full p-1.5 text-muted-foreground hover:bg-accent"
                  aria-label="Account actions"
                >
                  <MoreHorizontal className="size-4" />
                </DropdownTrigger>
                <DropdownContent>
                  <DropdownItem onSelect={() => (setEditing(u), setOpen(true))}>
                    <Pencil /> Edit / reset password
                  </DropdownItem>
                  {u.id !== me.id && (
                    <DropdownItem danger onSelect={() => remove(u)}>
                      <Trash2 /> Delete
                    </DropdownItem>
                  )}
                </DropdownContent>
              </Dropdown>
            ),
          },
        ]}
      />
    </>
  )
}

function UserDialog({
  open,
  onOpenChange,
  user,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  user: Row | null
}) {
  const queryClient = useQueryClient()
  const investigators = useLookup('investigators')
  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<In, unknown, Out>({ resolver: zodResolver(userSchema) })
  useEffect(() => {
    if (!open) return
    reset(
      user
        ? {
            fullName: user.fullName,
            email: user.email,
            role: user.role,
            investigatorId: user.investigatorId,
            isActive: Boolean(user.isActive),
            password: '',
          }
        : { fullName: '', email: '', role: 'clerk', investigatorId: null, isActive: true, password: '' },
    )
  }, [open, user, reset])
  const save = useMutation({
    mutationFn: (v: Out) => (user ? api.put(`/users/${user.id}`, v) : api.post('/users', v)),
    onSuccess: async () => {
      toast.success(user ? 'Account updated' : 'Account created')
      onOpenChange(false)
      await queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (err) => toast.error(errorMessage(err)),
  })
  const role = watch('role')
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={user ? 'Edit account' : 'New account'}
        description={role ? ROLE_HINTS[role as string] : undefined}
      >
        <form onSubmit={handleSubmit((v) => save.mutate(v))} noValidate className="space-y-4">
          <Field label="Full name" required error={errors.fullName?.message}>
            <Input {...register('fullName')} />
          </Field>
          <Field label="Email" required error={errors.email?.message}>
            <Input type="email" {...register('email')} />
          </Field>
          <Field label="Role" required>
            <NativeSelect {...register('role')}>
              {USER_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </NativeSelect>
          </Field>
          {role === 'investigator' && (
            <Field label="Investigator record" required error={errors.investigatorId?.message}>
              <Controller
                control={control}
                name="investigatorId"
                render={({ field }) => (
                  <Combobox
                    options={investigators.data}
                    loading={investigators.isLoading}
                    value={field.value as number | null}
                    onChange={field.onChange}
                    placeholder="Link to investigator…"
                  />
                )}
              />
            </Field>
          )}
          <Field
            label={user ? 'New password' : 'Password'}
            required={!user}
            error={errors.password?.message}
            hint={
              user
                ? 'Leave blank to keep the current password. Setting one also unlocks the account.'
                : 'At least 8 characters.'
            }
          >
            <Input type="text" autoComplete="new-password" {...register('password')} className="font-mono" />
          </Field>
          <Controller
            control={control}
            name="isActive"
            render={({ field }) => (
              <label className="flex items-center gap-3 text-sm">
                <Switch checked={Boolean(field.value)} onCheckedChange={field.onChange} /> Account active
              </label>
            )}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? <Loader2 className="animate-spin" /> : <Save />} Save
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
