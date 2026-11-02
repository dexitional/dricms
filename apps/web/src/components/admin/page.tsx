import { Link } from '@tanstack/react-router'
import { ArrowLeft, Inbox } from 'lucide-react'
import { cn } from '@dric/ui'
import { Badge } from '#/components/ui/badge'
import { STATUS_TONES } from '#/lib/labels'
import { money } from '#/lib/format'

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  back,
  meta,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  eyebrow?: React.ReactNode
  actions?: React.ReactNode
  back?: { to: string; label: string; params?: Record<string, string> }
  meta?: React.ReactNode
}) {
  return (
    <div className="mb-6 flex flex-col gap-4">
      {back && (
        <Link
          to={back.to}
          params={back.params as never}
          className="inline-flex w-fit items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="size-3.5" /> {back.label}
        </Link>
      )}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-6 gap-y-3 max-sm:grid-cols-1">
        <div className="min-w-0">
          {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
          <h1 className="text-2xl leading-tight font-extrabold tracking-tight text-slate-900 lg:text-[1.75rem]">
            {title}
          </h1>
          {description && <p className="mt-1.5 max-w-3xl text-sm text-muted-foreground">{description}</p>}
          {meta && <div className="mt-3 flex flex-wrap items-center gap-2">{meta}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return (
    <Badge tone={STATUS_TONES[status] ?? 'neutral'}>
      {label ??
        status
          .replace(/_/g, ' ')
          .toLowerCase()
          .replace(/^./, (c) => c.toUpperCase())}
    </Badge>
  )
}

export function Money({
  amount,
  currency,
  className,
}: {
  amount: number | string | null | undefined
  currency: string
  className?: string
}) {
  return <span className={cn('font-mono text-[0.85em] tabular-nums', className)}>{money(amount, currency)}</span>
}

export function EmptyState({
  title,
  description,
  action,
  icon: Icon = Inbox,
  className,
}: {
  title: string
  description?: string
  action?: React.ReactNode
  icon?: typeof Inbox
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      <div className="flex size-12 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground">
        <Icon className="size-5" />
      </div>
      <p className="mt-4 font-semibold text-slate-800">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function DetailList({ items, columns = 2 }: { items: Array<[string, React.ReactNode]>; columns?: 1 | 2 | 3 }) {
  return (
    <dl
      className={cn(
        'grid gap-x-6 gap-y-4',
        columns === 2 && 'sm:grid-cols-2',
        columns === 3 && 'sm:grid-cols-2 lg:grid-cols-3',
      )}
    >
      {items.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="eyebrow">{label}</dt>
          <dd className="mt-1 text-sm break-words text-slate-800">
            {value === null || value === undefined || value === '' ? '—' : value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export function ProgressBar({
  value,
  tone = 'primary',
  className,
}: {
  value: number
  tone?: 'primary' | 'success' | 'warning' | 'danger'
  className?: string
}) {
  const color = { primary: 'bg-primary', success: 'bg-success', warning: 'bg-warning', danger: 'bg-destructive' }[tone]
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-slate-100', className)}>
      <div
        className={cn('h-full rounded-full transition-[width] duration-700', color)}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  )
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  const letters = name
    .replace(/^(Prof\.|Assoc\. Prof\.|Dr\.|Mr\.|Mrs\.|Ms\.|Rev\.|Hon\.)\s*/i, '')
    .split(/\s+/)
    .filter(Boolean)
  const initials = (
    (letters[0]?.[0] ?? '') + (letters.length > 1 ? (letters[letters.length - 1]?.[0] ?? '') : '')
  ).toUpperCase()
  return (
    <span
      className={cn(
        'inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[0.7rem] font-bold text-primary',
        className,
      )}
    >
      {initials || '?'}
    </span>
  )
}

export function FunderLogo({
  url,
  name,
  className = 'size-9',
}: {
  url?: string | null
  name: string
  className?: string
}) {
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-white text-xs font-bold text-primary',
        className,
      )}
    >
      {url ? <img src={url} alt="" className="size-full object-contain p-1" /> : name.slice(0, 2).toUpperCase()}
    </span>
  )
}
