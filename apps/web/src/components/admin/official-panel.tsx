import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Loader2, Lock, Save, Stamp } from 'lucide-react'
import { toast } from 'sonner'
import type { UserRole } from '@dric/db/types'
import { api, errorMessage } from '#/lib/api-client'
import { DECISION_ROLES, RECEIPT_ROLES } from '#/lib/permissions'
import { date } from '#/lib/format'
import { Button } from '#/components/ui/button'
import { Card, CardBody, CardHeader } from '#/components/ui/card'
import { Input, NativeSelect, Textarea } from '#/components/ui/input'
import { Field } from './form'
import { useUser } from './session'

type Values = Record<string, string>

/**
 * The "FOR OFFICIAL USE ONLY" block of the DRIC forms: receipt date, status
 * and the Director's (and, where the form has one, the Vice Chancellor's)
 * decision. Each part is editable only by the roles allowed to set it.
 */
export function OfficialPanel({
  record,
  endpoint,
  statusOptions,
  statusRoles,
  showVc,
  showCondition,
  onSaved,
}: {
  record: Record<string, any>
  endpoint: string
  statusOptions: Array<{ value: string; label: string }>
  statusRoles: Array<UserRole>
  showVc?: boolean
  showCondition?: boolean
  onSaved: () => void
}) {
  const user = useUser()
  const canStatus = statusRoles.includes(user.role)
  const canReceipt = RECEIPT_ROLES.includes(user.role)
  const canDecide = DECISION_ROLES.includes(user.role)
  const pick = (r: Record<string, any>): Values => ({
    status: r.status ?? '',
    receivedAt: r.receivedAt ?? '',
    officialCondition: r.officialCondition ?? '',
    directorDecision: r.directorDecision ?? '',
    directorName: r.directorName ?? '',
    directorDecidedAt: r.directorDecidedAt ?? '',
    vcDecision: r.vcDecision ?? '',
    vcName: r.vcName ?? '',
    vcDecidedAt: r.vcDecidedAt ?? '',
  })
  const [values, setValues] = useState<Values>(() => pick(record))
  useEffect(() => setValues(pick(record)), [record])
  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setValues((v) => ({ ...v, [key]: e.target.value }))

  const save = useMutation({
    mutationFn: () => {
      const body: Record<string, string> = {}
      if (canStatus && values.status !== record.status) body.status = values.status!
      if (canReceipt) body.receivedAt = values.receivedAt!
      if (canReceipt && showCondition) body.officialCondition = values.officialCondition!
      if (canDecide) {
        for (const k of ['directorDecision', 'directorName', 'directorDecidedAt']) body[k] = values[k]!
        if (showVc) for (const k of ['vcDecision', 'vcName', 'vcDecidedAt']) body[k] = values[k]!
      }
      return api.patch(endpoint, body)
    },
    onSuccess: () => {
      toast.success('Official record updated')
      onSaved()
    },
    onError: (err) => toast.error(errorMessage(err)),
  })
  const editable = canStatus || canReceipt || canDecide

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <Stamp className="size-4 text-secondary-foreground" /> For official use only
          </span>
        }
        className="bg-secondary/40"
      />
      <CardBody className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <Field label="Status">
            <NativeSelect value={values.status} onChange={set('status')} disabled={!canStatus}>
              {statusOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Date of receipt at DRIC">
            <Input type="date" value={values.receivedAt} onChange={set('receivedAt')} disabled={!canReceipt} />
          </Field>
        </div>
        {showCondition && (
          <Field label="Condition of equipment (DRIC inspection)">
            <Textarea
              value={values.officialCondition}
              onChange={set('officialCondition')}
              rows={3}
              disabled={!canReceipt}
            />
          </Field>
        )}
        <Decision who="Director of DRIC" prefix="director" values={values} set={set} disabled={!canDecide} />
        {showVc && (
          <Decision who="Vice Chancellor (if applicable)" prefix="vc" values={values} set={set} disabled={!canDecide} />
        )}
        {editable ? (
          <Button className="w-full" onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? <Loader2 className="animate-spin" /> : <Save />} Save official record
          </Button>
        ) : (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Lock className="size-3.5" /> Completed by DRIC staff
          </p>
        )}
      </CardBody>
    </Card>
  )
}

function Decision({
  who,
  prefix,
  values,
  set,
  disabled,
}: {
  who: string
  prefix: 'director' | 'vc'
  values: Values
  set: (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void
  disabled: boolean
}) {
  if (disabled) {
    return (
      <div className="rounded-xl border border-dashed p-3">
        <p className="eyebrow">Decision by {who}</p>
        <p className="mt-1 text-sm whitespace-pre-line">{values[`${prefix}Decision`] || 'Pending'}</p>
        {values[`${prefix}Name`] && (
          <p className="mt-1 text-xs text-muted-foreground">
            {values[`${prefix}Name`]} · {date(values[`${prefix}DecidedAt`])}
          </p>
        )}
      </div>
    )
  }
  return (
    <div className="space-y-3 rounded-xl border border-dashed p-3">
      <Field label={`Decision by ${who}`}>
        <Textarea value={values[`${prefix}Decision`]} onChange={set(`${prefix}Decision`)} rows={2} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name">
          <Input value={values[`${prefix}Name`]} onChange={set(`${prefix}Name`)} />
        </Field>
        <Field label="Date">
          <Input type="date" value={values[`${prefix}DecidedAt`]} onChange={set(`${prefix}DecidedAt`)} />
        </Field>
      </div>
    </div>
  )
}
