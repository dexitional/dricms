// Dashboard charts. Single-series magnitude is navy; categorical identity uses
// --chart-1..5 in fixed order (validated, see packages/ui/src/tokens.css).
// Text always wears text colours, never a series colour.
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { cn } from '@dric/ui'
import { money, num } from '#/lib/format'

/** The slice of recharts' tooltip props these charts read. */
type TipProps = { active?: boolean; payload?: ReadonlyArray<{ payload?: any; name?: unknown; value?: unknown }> }

export const SERIES = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']

function TooltipCard({
  title,
  rows,
}: {
  title: React.ReactNode
  rows: Array<{ label: string; value: string; color?: string }>
}) {
  return (
    <div className="min-w-40 rounded-xl border bg-white/95 px-3 py-2.5 text-xs shadow-xl backdrop-blur">
      <p className="mb-1.5 font-semibold text-slate-900">{title}</p>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            {r.color && <span className="size-2 rounded-full" style={{ background: r.color }} />}
            {r.label}
          </span>
          <span className="font-mono font-medium text-slate-900 tabular-nums">{r.value}</span>
        </div>
      ))}
    </div>
  )
}

/** Last 12 months, filling months with no payments with zero. */
function lastTwelveMonths(data: Array<{ month: string; total: number; count: number }>) {
  const byMonth = new Map(data.map((d) => [d.month, d]))
  const out: Array<{ month: string; label: string; total: number; count: number }> = []
  const now = new Date()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const hit = byMonth.get(key)
    out.push({
      month: key,
      label: d.toLocaleDateString('en-GB', { month: 'short' }),
      total: Number(hit?.total ?? 0),
      count: Number(hit?.count ?? 0),
    })
  }
  return out
}

export function MonthlyBars({
  data,
  currency,
  height = 240,
}: {
  data: Array<{ month: string; total: number; count: number }>
  currency: string
  height?: number
}) {
  const series = lastTwelveMonths(data)
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={series} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barCategoryGap="22%">
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748b' }} dy={6} />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={56}
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            tickFormatter={(v: number) => money(v, currency, { compact: true }).replace(`${currency} `, '')}
          />
          <Tooltip
            cursor={{ fill: 'rgb(23 37 84 / 0.05)', radius: 8 }}
            content={(props: TipProps) => {
              const p = props.payload?.[0]?.payload as (typeof series)[number] | undefined
              if (!props.active || !p) return null
              const [y, m] = p.month.split('-').map(Number)
              return (
                <TooltipCard
                  title={new Date(y!, m! - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                  rows={[
                    { label: 'Disbursed', value: money(p.total, currency), color: 'var(--chart-single)' },
                    { label: 'Tranches', value: num(p.count, 0) },
                  ]}
                />
              )
            }}
          />
          <Bar dataKey="total" fill="var(--chart-single)" radius={[4, 4, 0, 0]} maxBarSize={30} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Ranked horizontal bars in plain HTML with direct value labels. */
export function RankBars({
  items,
  format,
  emptyText = 'No data yet.',
}: {
  items: Array<{ label: string; value: number; sub?: string }>
  format: (v: number) => string
  emptyText?: string
}) {
  const max = Math.max(1, ...items.map((i) => i.value))
  if (!items.length) return <p className="py-8 text-center text-sm text-muted-foreground">{emptyText}</p>
  return (
    <ul className="space-y-3.5">
      {items.map((item) => (
        <li
          key={item.label}
          className="group"
          title={`${item.label}: ${format(item.value)}${item.sub ? ` · ${item.sub}` : ''}`}
        >
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate font-medium text-slate-700">{item.label}</span>
            <span className="shrink-0 font-mono text-xs font-medium text-slate-900 tabular-nums">
              {format(item.value)}
            </span>
          </div>
          <div className="h-2 rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-chart-single transition-[width,opacity] duration-700 group-hover:opacity-85"
              style={{ width: `${Math.max(2, (item.value / max) * 100)}%` }}
            />
          </div>
          {item.sub && <p className="mt-1 text-[0.7rem] text-muted-foreground">{item.sub}</p>}
        </li>
      ))}
    </ul>
  )
}

/** Share-of-whole donut for a few categories, with legend + direct labels. */
export function Donut({
  items,
  centerLabel,
  centerValue,
  format = (v) => num(v, 0),
}: {
  items: Array<{ label: string; value: number }>
  centerLabel: string
  centerValue: string
  format?: (v: number) => string
}) {
  const total = items.reduce((s, i) => s + i.value, 0)
  const data = items.filter((i) => i.value > 0)
  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative size-40 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data.length ? data : [{ label: 'None', value: 1 }]}
              dataKey="value"
              nameKey="label"
              innerRadius="68%"
              outerRadius="100%"
              stroke="#fff"
              strokeWidth={2}
              startAngle={90}
              endAngle={-270}
              isAnimationActive
            >
              {(data.length ? data : [{ label: 'None', value: 1 }]).map((d) => (
                <Cell
                  key={d.label}
                  fill={data.length ? SERIES[items.findIndex((i) => i.label === d.label) % SERIES.length] : '#eef0f4'}
                />
              ))}
            </Pie>
            {data.length > 0 && (
              <Tooltip
                content={(props: TipProps) => {
                  const p = props.payload?.[0]
                  if (!props.active || !p) return null
                  return (
                    <TooltipCard
                      title={String(p.name)}
                      rows={[
                        { label: 'Value', value: format(Number(p.value)) },
                        { label: 'Share', value: `${Math.round((Number(p.value) / total) * 100)}%` },
                      ]}
                    />
                  )
                }}
              />
            )}
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-xl font-extrabold text-slate-900">{centerValue}</span>
          <span className="eyebrow">{centerLabel}</span>
        </div>
      </div>
      <ul className="w-full space-y-2.5">
        {items.map((item, i) => (
          <li key={item.label} className="flex items-center gap-2.5 text-sm">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: SERIES[i % SERIES.length] }} />
            <span className="flex-1 text-slate-700">{item.label}</span>
            <span className="font-mono text-xs text-slate-900 tabular-nums">{format(item.value)}</span>
            <span className="w-10 text-right text-xs text-muted-foreground">
              {total ? Math.round((item.value / total) * 100) : 0}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent = false,
  className,
}: {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  icon: React.ComponentType<{ className?: string }>
  accent?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        'lift relative overflow-hidden rounded-2xl border p-5',
        accent ? 'border-primary bg-primary text-white' : 'border-border bg-white',
        className,
      )}
    >
      {accent && <div className="dot-grid absolute inset-0 opacity-50" aria-hidden="true" />}
      <div className="relative flex items-start justify-between gap-3">
        <p className={cn('eyebrow', accent && 'text-white/60')}>{label}</p>
        <span
          className={cn(
            'flex size-9 items-center justify-center rounded-xl',
            accent ? 'bg-white/10 text-white' : 'bg-secondary text-secondary-foreground',
          )}
        >
          <Icon className="size-4" />
        </span>
      </div>
      <p
        className={cn(
          'relative mt-3 text-2xl font-extrabold tracking-tight tabular-nums',
          accent ? 'text-white' : 'text-slate-900',
        )}
      >
        {value}
      </p>
      {sub && <p className={cn('relative mt-1 text-xs', accent ? 'text-white/65' : 'text-muted-foreground')}>{sub}</p>}
    </div>
  )
}
