import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { KeyRound, Landmark, Loader2, Mail, Pencil, Phone, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { api, errorMessage } from '#/lib/api-client'
import { dateTime, personName } from '#/lib/format'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card, CardBody, CardHeader } from '#/components/ui/card'
import { Dialog, DialogContent } from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { Field } from './form'
import { Avatar, DetailList, PageHeader } from './page'
import { useConfirm } from './confirm'
import { useCan } from './session'

type Row = Record<string, any>

export function PersonHeader({ person, kind }: { person: Row; kind: 'investigator' | 'personnel' }) {
  const isInv = kind === 'investigator'
  const canManage = useCan(isInv ? 'investigators' : 'personnel', 'manage')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { confirm, dialog } = useConfirm()
  const id = String(person.id)
  const remove = () =>
    confirm({
      title: `Delete ${personName(person)}?`,
      description: isInv
        ? 'Their sign-in account is removed too. Investigators who lead projects cannot be deleted.'
        : 'They will be removed from all activities.',
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: async () => {
        try {
          await api.delete(`${isInv ? '/investigators' : '/personnel'}/${id}`)
          toast.success('Deleted')
          await queryClient.invalidateQueries({ queryKey: [kind] })
          await navigate({ to: isInv ? '/admin/investigators' : '/admin/personnel' })
        } catch (err) {
          toast.error(errorMessage(err))
        }
      },
    })
  return (
    <>
      {dialog}
      <PageHeader
        back={{ to: isInv ? '/admin/investigators' : '/admin/personnel', label: isInv ? 'Investigators' : 'Personnel' }}
        title={
          <span className="flex items-center gap-4">
            <Avatar name={personName(person)} className="size-14 text-base" />
            {personName(person)}
          </span>
        }
        meta={
          <>
            <Badge tone={person.isActive ? 'success' : 'neutral'}>{person.isActive ? 'Active' : 'Inactive'}</Badge>
            {[person.designation, person.department].filter(Boolean).length > 0 && (
              <span className="text-sm text-muted-foreground">
                {[person.designation, person.department].filter(Boolean).join(' · ')}
              </span>
            )}
          </>
        }
        actions={
          canManage && (
            <>
              <Button variant="outline" onClick={remove}>
                <Trash2 /> Delete
              </Button>
              <Button asChild>
                {isInv ? (
                  <Link to="/admin/investigators/$investigatorId/edit" params={{ investigatorId: id }}>
                    <Pencil /> Edit
                  </Link>
                ) : (
                  <Link to="/admin/personnel/$personnelId/edit" params={{ personnelId: id }}>
                    <Pencil /> Edit
                  </Link>
                )}
              </Button>
            </>
          )
        }
      />
    </>
  )
}

export function PersonSideCards({ person }: { person: Row }) {
  return (
    <>
      <Card>
        <CardHeader title="Contact" />
        <CardBody className="space-y-3 text-sm">
          {person.email && (
            <a
              href={`mailto:${person.email}`}
              className="flex items-center gap-2.5 break-all text-primary hover:underline"
            >
              <Mail className="size-4 shrink-0 text-muted-foreground" /> {person.email}
            </a>
          )}
          {person.phone && (
            <a href={`tel:${person.phone}`} className="flex items-center gap-2.5">
              <Phone className="size-4 text-muted-foreground" /> {person.phone}
            </a>
          )}
          <DetailList
            columns={1}
            items={[
              ['Staff number', person.staffNo && <span className="font-mono">{person.staffNo}</span>],
              ['Ghana Card', person.ghanaCardNo && <span className="font-mono">{person.ghanaCardNo}</span>],
              ['Location', person.location],
              ['Address', person.address],
            ]}
          />
        </CardBody>
      </Card>
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Landmark className="size-4 text-muted-foreground" /> Bank details
            </span>
          }
        />
        <CardBody>
          <DetailList
            columns={1}
            items={[
              ['Account name', person.accountName],
              ['Bank', person.bankName],
              ['Account number', person.accountNo && <span className="font-mono">{person.accountNo}</span>],
              ['Branch', person.bankBranch],
            ]}
          />
        </CardBody>
      </Card>
    </>
  )
}

export function PortalAccountCard({ investigator }: { investigator: Row }) {
  const canManage = useCan('investigators', 'manage')
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const account = investigator.account as Row | null
  const save = useMutation({
    mutationFn: () => api.post(`/investigators/${investigator.id}/account`, { password }),
    onSuccess: async () => {
      toast.success(account ? 'Password reset' : 'Portal account created')
      setOpen(false)
      setPassword('')
      await queryClient.invalidateQueries({ queryKey: ['investigator', String(investigator.id)] })
    },
    onError: (err) => toast.error(errorMessage(err)),
  })
  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <KeyRound className="size-4 text-muted-foreground" /> Portal access
          </span>
        }
        description="Lets the investigator sign in to view projects and request funds."
      />
      <CardBody className="space-y-3">
        {account ? (
          <DetailList
            columns={1}
            items={[
              ['Sign-in email', account.email],
              [
                'Status',
                <Badge key="s" tone={account.isActive ? 'success' : 'neutral'}>
                  {account.isActive ? 'Active' : 'Disabled'}
                </Badge>,
              ],
              ['Last sign-in', account.lastLoginAt ? dateTime(account.lastLoginAt) : 'Never'],
            ]}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            No portal account yet.{!investigator.email && ' Add an email address first.'}
          </p>
        )}
        {canManage && investigator.email && (
          <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
            <KeyRound /> {account ? 'Reset password' : 'Create portal account'}
          </Button>
        )}
      </CardBody>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          title={account ? 'Reset portal password' : 'Create portal account'}
          description={`The investigator signs in with ${investigator.email}.`}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault()
              save.mutate()
            }}
            className="space-y-5"
          >
            <Field label="Password" hint="At least 8 characters. Share it with the investigator securely.">
              <Input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
                className="font-mono"
              />
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={password.length < 8 || save.isPending}>
                {save.isPending && <Loader2 className="animate-spin" />} {account ? 'Reset password' : 'Create account'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
