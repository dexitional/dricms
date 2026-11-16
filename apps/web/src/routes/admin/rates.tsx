import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { z } from 'zod'
import {
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUpRight,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Save,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@dric/ui'
import { api, errorMessage } from '#/lib/api-client'
import { date, today } from '#/lib/format'
import { can } from '#/lib/permissions'
import { exchangeRateSchema } from '#/lib/schemas'
import { Button } from '#/components/ui/button'
import { Dialog, DialogContent } from '#/components/ui/dialog'
import { Dropdown, DropdownContent, DropdownItem, DropdownTrigger } from '#/components/ui/dropdown'
import { Input, NativeSelect } from '#/components/ui/input'
import { DataTable, FilterSelect, Toolbar } from '#/components/admin/data-table'
import { Field } from '#/components/admin/form'
import { CURRENCY_OPTIONS } from '#/components/admin/lookups'
import { EmptyState, PageHeader } from '#/components/admin/page'
import { useConfirm } from '#/components/admin/confirm'
import { formatRate } from '#/components/admin/rate-field'
import { useUser } from '#/components/admin/session'

export const Route = createFileRoute('/admin/rates')({ component: RatesPage })

type Row = Record<string, any> & { id: number }
type In = z.input<typeof exchangeRateSchema>
type Out = z.output<typeof exchangeRateSchema>

function RatesPage() {
  const me = useUser()
  const canManage = can(me.role, 'rates', 'manage')
  const queryClient = useQueryClient()
  const { confirm, dialog } = useConfirm()
  const [currency, setCurrency] = useState('')
  const [editing, setEditing] = useState<Row | null>(null)
  const [open, setOpen] = useState(false)
  const { data, isLoading } = useQuery({
    queryKey: ['rates', { currency }],
    queryFn: () => api.get<{ latest: Array<Row>; history: Array<Row> }>('/rates', { currency }),
  })
  const edit = (r: Row | null) => (setEditing(r), setOpen(true))
  const remove = (r: Row) =>
    confirm({
      title: `Remove the ${r.baseCurrency} → ${r.quoteCurrency} rate of ${date(r.effectiveDate)}?`,
      description:
        'Forms will suggest the rate before it instead. Payments and remittances already recorded keep the rate they used.',
      danger: true,
      confirmLabel: 'Remove rate',
      onConfirm: async () => {
        try {
          await api.delete(`/rates/${r.id}`)
          toast.success('Rate removed')
          await queryClient.invalidateQueries({ queryKey: ['rates'] })
        } catch (err) {
          toast.error(errorMessage(err))
        }
      },
    })

  return (
    <>
      {dialog}
      <RateDialog open={open} onOpenChange={setOpen} rate={editing} />
      <PageHeader
        title="Exchange rates"
        description="Rates change, so each one is kept with the date it applies from. Payment and remittance forms suggest the rate in effect on the transaction date; records already saved keep the rate they used."
        actions={
          canManage && (
            <Button onClick={() => edit(null)}>
              <Plus /> New rate
            </Button>
          )
        }
      />

      {Boolean(data?.latest.length) && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {data?.latest.map((r) => {
            const prev = r.previousRate as number | null
            const up = prev != null && r.rate > prev
            const down = prev != null && r.rate < prev
            return (
              <div key={r.id} className="rounded-2xl border bg-white p-4">
                <p className="eyebrow flex items-center gap-1.5">
                  {r.baseCurrency} <ArrowLeftRight className="size-3" /> {r.quoteCurrency}
                </p>
                <p className="mt-2 font-mono text-xl font-semibold text-slate-900">
                  1 {r.baseCurrency} = {formatRate(r.rate)} {r.quoteCurrency}
                </p>
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  1 {r.quoteCurrency} = {formatRate(1 / r.rate)} {r.baseCurrency}
                </p>
                <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                  Since {date(r.effectiveDate)}
                  {prev != null && (
                    <span
                      className={cn(
                        'inline-flex items-center gap-0.5 font-medium',
                        up && 'text-emerald-700',
                        down && 'text-rose-700',
                      )}
                    >
                      {up ? (
                        <ArrowUpRight className="size-3.5" />
                      ) : down ? (
                        <ArrowDownRight className="size-3.5" />
                      ) : null}
                      from {formatRate(prev)}
                    </span>
                  )}
                </p>
              </div>
            )
          })}
        </div>
      )}

      <Toolbar>
        <FilterSelect
          label="Currency"
          value={currency}
          onChange={setCurrency}
          options={CURRENCY_OPTIONS.map((c) => ({ value: c, label: c }))}
        />
      </Toolbar>
      <DataTable
        loading={isLoading}
        rows={data?.history}
        empty={
          <EmptyState
            icon={ArrowLeftRight}
            title="No rates yet"
            description="Add the rates you use, or tick “Save this rate to the register” when recording a payment or remittance."
          />
        }
        columns={[
          {
            header: 'Pair',
            cell: (r) => (
              <span className="font-mono font-semibold text-slate-800">
                {r.baseCurrency} → {r.quoteCurrency}
              </span>
            ),
          },
          {
            header: 'Rate',
            cell: (r) => (
              <span className="font-mono">
                1 {r.baseCurrency} = {formatRate(r.rate)} {r.quoteCurrency}
                <span className="block text-xs text-muted-foreground">
                  1 {r.quoteCurrency} = {formatRate(1 / r.rate)} {r.baseCurrency}
                </span>
              </span>
            ),
          },
          { header: 'Applies from', cell: (r) => date(r.effectiveDate) },
          {
            header: 'Source',
            cell: (r) => (
              <span className="text-xs text-muted-foreground">
                {r.source || '—'}
                {r.createdByName && <span className="block">Added by {r.createdByName}</span>}
              </span>
            ),
          },
          {
            header: '',
            align: 'right',
            cell: (r) =>
              canManage && (
                <Dropdown>
                  <DropdownTrigger
                    className="rounded-full p-1.5 text-muted-foreground hover:bg-accent"
                    aria-label="Rate actions"
                  >
                    <MoreHorizontal className="size-4" />
                  </DropdownTrigger>
                  <DropdownContent>
                    <DropdownItem onSelect={() => edit(r)}>
                      <Pencil /> Edit
                    </DropdownItem>
                    <DropdownItem danger onSelect={() => remove(r)}>
                      <Trash2 /> Remove
                    </DropdownItem>
                  </DropdownContent>
                </Dropdown>
              ),
          },
        ]}
      />
    </>
  )
}

function RateDialog({
  open,
  onOpenChange,
  rate,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  rate: Row | null
}) {
  const queryClient = useQueryClient()
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<In, unknown, Out>({ resolver: zodResolver(exchangeRateSchema) })
  useEffect(() => {
    if (!open) return
    reset(
      rate
        ? {
            baseCurrency: rate.baseCurrency,
            quoteCurrency: rate.quoteCurrency,
            rate: rate.rate,
            effectiveDate: rate.effectiveDate,
            source: rate.source ?? '',
          }
        : { baseCurrency: 'USD', quoteCurrency: 'GHS', rate: '' as never, effectiveDate: today(), source: '' },
    )
  }, [open, rate, reset])
  const save = useMutation({
    mutationFn: (v: Out) => (rate ? api.put(`/rates/${rate.id}`, v) : api.post('/rates', v)),
    onSuccess: async () => {
      toast.success(rate ? 'Rate updated' : 'Rate saved')
      onOpenChange(false)
      await queryClient.invalidateQueries({ queryKey: ['rates'] })
    },
    onError: (err) => toast.error(errorMessage(err)),
  })
  const base = watch('baseCurrency') as string
  const quote = watch('quoteCurrency') as string
  const value = Number(watch('rate')) || 0
  const swap = () => {
    setValue('baseCurrency', quote as never)
    setValue('quoteCurrency', base as never)
    if (value > 0) setValue('rate', Number(formatRate(1 / value)) as never)
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={rate ? 'Edit exchange rate' : 'New exchange rate'}
        description="Saving a pair again for the same date replaces that day’s rate."
      >
        <form onSubmit={handleSubmit((v) => save.mutate(v))} noValidate className="space-y-4">
          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
            <Field label="From" required>
              <NativeSelect {...register('baseCurrency')}>
                {CURRENCY_OPTIONS.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </NativeSelect>
            </Field>
            <button
              type="button"
              onClick={swap}
              className="mb-2 rounded-full p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Swap currencies"
              title="Swap currencies"
            >
              <ArrowLeftRight className="size-4" />
            </button>
            <Field label="To" required error={errors.quoteCurrency?.message}>
              <NativeSelect {...register('quoteCurrency')}>
                {CURRENCY_OPTIONS.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </NativeSelect>
            </Field>
          </div>
          <Field
            label="Rate"
            required
            error={errors.rate?.message}
            hint={value > 0 ? `So 1 ${quote} = ${formatRate(1 / value)} ${base}` : undefined}
          >
            <div className="flex items-center gap-2">
              <span className="shrink-0 font-mono text-xs text-muted-foreground">1 {base} =</span>
              <Input type="number" step="any" min="0" {...register('rate')} className="font-mono" />
              <span className="shrink-0 font-mono text-xs text-muted-foreground">{quote}</span>
            </div>
          </Field>
          <Field label="Applies from" required error={errors.effectiveDate?.message}>
            <Input type="date" {...register('effectiveDate')} />
          </Field>
          <Field
            label="Source"
            error={errors.source?.message}
            hint="Where the rate came from, e.g. Bank of Ghana or the bank’s quote."
          >
            <Input {...register('source')} />
          </Field>
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
