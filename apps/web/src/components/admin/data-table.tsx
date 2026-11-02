import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react'
import { cn } from '@dric/ui'
import { Skeleton } from '#/components/ui/skeleton'
import { EmptyState } from './page'

export interface Column<T> {
  header: React.ReactNode
  cell: (row: T) => React.ReactNode
  className?: string
  align?: 'left' | 'right' | 'center'
}

export function DataTable<T extends Record<string, any>>({
  columns,
  rows,
  loading,
  empty,
  rowLink,
  className,
}: {
  columns: Array<Column<T>>
  rows: Array<T> | undefined
  loading?: boolean
  empty?: React.ReactNode
  rowLink?: (row: T) => { to: string; params?: Record<string, string> }
  className?: string
}) {
  const align = (a?: string) => (a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left')
  return (
    <div className={cn('overflow-hidden rounded-2xl border border-border bg-white', className)}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border bg-slate-50/70">
              {columns.map((col, i) => (
                <th
                  key={i}
                  className={cn('eyebrow px-4 py-3 font-medium whitespace-nowrap', align(col.align), col.className)}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading &&
              Array.from({ length: 5 }).map((_, r) => (
                <tr key={r}>
                  {columns.map((_c, i) => (
                    <td key={i} className="px-4 py-3.5">
                      <Skeleton className="h-4 w-full max-w-40" />
                    </td>
                  ))}
                </tr>
              ))}
            {!loading &&
              rows?.map((row, rowIndex) => {
                const link = rowLink?.(row)
                return (
                  <tr
                    key={String(row.id ?? rowIndex)}
                    className={cn('group transition-colors', link && 'relative hover:bg-slate-50/80')}
                  >
                    {columns.map((col, i) => (
                      <td key={i} className={cn('px-4 py-3 align-middle', align(col.align), col.className)}>
                        {link && i === 0 ? (
                          <Link
                            to={link.to}
                            params={link.params as never}
                            className="block after:absolute after:inset-0"
                          >
                            {col.cell(row)}
                          </Link>
                        ) : (
                          <div className={cn(link && 'relative z-[1] w-fit', col.align === 'right' && 'ml-auto')}>
                            {col.cell(row)}
                          </div>
                        )}
                      </td>
                    ))}
                  </tr>
                )
              })}
          </tbody>
        </table>
      </div>
      {!loading &&
        rows?.length === 0 &&
        (empty ?? <EmptyState title="Nothing here yet" description="Records you add will show up here." />)}
    </div>
  )
}

export function Pagination({
  page,
  pageSize,
  total,
  onChange,
}: {
  page: number
  pageSize: number
  total: number
  onChange: (page: number) => void
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (total <= pageSize)
    return total ? (
      <p className="mt-3 text-xs text-muted-foreground">
        {total} record{total === 1 ? '' : 's'}
      </p>
    ) : null
  const from = (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)
  return (
    <div className="mt-4 flex items-center justify-between gap-4 text-xs text-muted-foreground">
      <span>
        Showing{' '}
        <b className="text-foreground">
          {from}–{to}
        </b>{' '}
        of <b className="text-foreground">{total}</b>
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          className="flex size-8 items-center justify-center rounded-full border bg-white hover:bg-accent disabled:opacity-40"
          aria-label="Previous page"
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="px-2 font-medium text-foreground">
          {page} / {pages}
        </span>
        <button
          type="button"
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
          className="flex size-8 items-center justify-center rounded-full border bg-white hover:bg-accent disabled:opacity-40"
          aria-label="Next page"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  )
}

/** Search box that reports its value after the user stops typing. */
export function SearchInput({
  value,
  onChange,
  placeholder = 'Search…',
  className,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}) {
  const [text, setText] = useState(value)
  useEffect(() => setText(value), [value])
  useEffect(() => {
    if (text === value) return
    const t = setTimeout(() => onChange(text), 300)
    return () => clearTimeout(t)
  }, [text, value, onChange])
  return (
    <div className={cn('relative w-full sm:w-72', className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-subtle-foreground" />
      <input
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        className="field-control h-10 rounded-full pr-9 pl-10 [&::-webkit-search-cancel-button]:hidden"
      />
      {text && (
        <button
          type="button"
          onClick={() => setText('')}
          className="absolute top-1/2 right-3 -translate-y-1/2 text-subtle-foreground hover:text-foreground"
          aria-label="Clear search"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  )
}

/** Pill-shaped filter select (as in the layout reference's filter row). */
export function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: Array<{ value: string; label: string }>
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="pl-3 text-xs font-medium text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="field-control h-10 min-w-36 appearance-none rounded-full pr-8"
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function Toolbar({ children }: { children: React.ReactNode }) {
  return <div className="mb-4 flex flex-wrap items-end gap-3">{children}</div>
}
