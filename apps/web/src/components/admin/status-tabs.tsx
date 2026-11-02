import { cn } from '@dric/ui'

/** Pill tabs with counts for filtering a list by status. */
export function StatusTabs({
  value,
  onChange,
  options,
  counts,
}: {
  value: string
  onChange: (v: string) => void
  options: Array<{ value: string; label: string }>
  counts?: Array<{ status: string; count: number }>
}) {
  const countOf = (s: string) => Number(counts?.find((c) => c.status === s)?.count ?? 0)
  const all = (counts ?? []).reduce((s, c) => s + Number(c.count), 0)
  return (
    <div className="no-scrollbar mb-4 flex gap-1.5 overflow-x-auto">
      {[{ value: '', label: 'All' }, ...options].map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors',
            value === o.value
              ? 'border-primary bg-primary text-white'
              : 'bg-white text-slate-600 hover:border-border-strong',
          )}
        >
          {o.label}
          <span
            className={cn(
              'rounded-full px-1.5 font-mono text-[0.65rem]',
              value === o.value ? 'bg-white/15' : 'bg-muted',
            )}
          >
            {o.value ? countOf(o.value) : all}
          </span>
        </button>
      ))}
    </div>
  )
}
