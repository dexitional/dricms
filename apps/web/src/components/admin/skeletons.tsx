import { cn } from '@dric/ui'
import { Skeleton } from '#/components/ui/skeleton'

// Loading layouts shaped like the pages they stand in for, so the page keeps
// its structure while data arrives instead of flashing a blank block.

function Loading({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div role="status" aria-live="polite" className={className}>
      <span className="sr-only">Loading…</span>
      {children}
    </div>
  )
}

function Lines({ count = 3, className }: { count?: number; className?: string }) {
  return (
    <div className={cn('space-y-2.5', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className={cn('h-3', i === count - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  )
}

function HeaderSkeleton({ avatar = false }: { avatar?: boolean }) {
  return (
    <div className="mb-6 space-y-3">
      <Skeleton className="h-3 w-28" />
      <div className="flex items-center gap-4">
        {avatar && <Skeleton className="size-16 shrink-0 rounded-full" />}
        <div className="flex-1 space-y-2.5">
          <Skeleton className="h-7 w-2/3 max-w-md" />
          <Skeleton className="h-3.5 w-1/2 max-w-sm" />
        </div>
        <Skeleton className="hidden h-9 w-28 rounded-xl sm:block" />
      </div>
    </div>
  )
}

export function MetricsSkeleton({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div
      className={cn(
        'grid gap-3 sm:grid-cols-2',
        count >= 6 ? 'xl:grid-cols-6' : count === 5 ? 'xl:grid-cols-5' : 'xl:grid-cols-4',
        className,
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-2xl border bg-white p-4">
          <Skeleton className="h-2.5 w-20" />
          <Skeleton className="mt-3 h-6 w-32" />
          <Skeleton className="mt-3 h-1.5 w-full rounded-full" />
          <Skeleton className="mt-3 h-2.5 w-24" />
        </div>
      ))}
    </div>
  )
}

export function CardSkeleton({
  lines = 4,
  chart = false,
  className,
}: {
  lines?: number
  chart?: boolean
  className?: string
}) {
  return (
    <div className={cn('rounded-2xl border bg-white p-5', className)}>
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-2 h-3 w-56 max-w-full" />
      {chart ? <Skeleton className="mt-5 h-48 rounded-xl" /> : <Lines count={lines} className="mt-5" />}
    </div>
  )
}

function TabsSkeleton() {
  return (
    <div className="mb-5 flex gap-2">
      {['w-24', 'w-28', 'w-20', 'w-24'].map((w, i) => (
        <Skeleton key={i} className={cn('h-9 rounded-xl', w)} />
      ))}
    </div>
  )
}

// A whole page: used while a route's code loads.
export function PageSkeleton() {
  return (
    <Loading>
      <HeaderSkeleton />
      <MetricsSkeleton />
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <CardSkeleton chart className="lg:col-span-2" />
        <CardSkeleton lines={6} />
      </div>
    </Loading>
  )
}

// A record's overview page: header, metric cards, tabs and content cards.
export function DetailSkeleton({ metrics = 4 }: { metrics?: number }) {
  return (
    <Loading>
      <HeaderSkeleton />
      {metrics > 0 && <MetricsSkeleton count={metrics} className="mb-6" />}
      <TabsSkeleton />
      <div className="grid gap-4 lg:grid-cols-3">
        <CardSkeleton lines={7} className="lg:col-span-2" />
        <CardSkeleton lines={5} />
      </div>
    </Loading>
  )
}

// An investigator's or personnel member's page: photo, name and details.
export function PersonSkeleton() {
  return (
    <Loading>
      <HeaderSkeleton avatar />
      <MetricsSkeleton count={3} className="mb-6 xl:grid-cols-3" />
      <div className="grid gap-4 lg:grid-cols-3">
        <CardSkeleton lines={8} />
        <CardSkeleton lines={6} className="lg:col-span-2" />
      </div>
    </Loading>
  )
}

// A form: sections of labelled fields.
export function FormSkeleton({ sections = 2, fields = 6 }: { sections?: number; fields?: number }) {
  return (
    <Loading className="space-y-4">
      {Array.from({ length: sections }).map((_, s) => (
        <div key={s} className="rounded-2xl border bg-white p-5">
          <Skeleton className="h-4 w-44" />
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            {Array.from({ length: fields }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-10 rounded-xl" />
              </div>
            ))}
          </div>
        </div>
      ))}
      <div className="flex justify-end gap-2">
        <Skeleton className="h-10 w-24 rounded-xl" />
        <Skeleton className="h-10 w-32 rounded-xl" />
      </div>
    </Loading>
  )
}

// The dashboard: metric cards, then charts.
export function DashboardSkeleton() {
  return (
    <Loading className="space-y-4">
      <MetricsSkeleton />
      <div className="grid gap-4 lg:grid-cols-3">
        <CardSkeleton chart className="lg:col-span-2" />
        <CardSkeleton chart />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <CardSkeleton lines={6} />
        <CardSkeleton lines={6} />
      </div>
    </Loading>
  )
}

// A project's funds and balance sheet: five tiles, three cards and a ledger.
export function BalanceSheetSkeleton() {
  return (
    <Loading className="space-y-4">
      <MetricsSkeleton count={5} />
      <div className="grid gap-4 lg:grid-cols-3">
        <CardSkeleton chart />
        <CardSkeleton lines={6} />
        <CardSkeleton lines={6} />
      </div>
      <CardSkeleton lines={8} />
    </Loading>
  )
}
