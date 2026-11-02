import { useMemo, useRef, useState } from 'react'
import { Check, ChevronsUpDown, Loader2, Search, X } from 'lucide-react'
import { cn } from '@dric/ui'
import { Popover, PopoverContent, PopoverTrigger } from '#/components/ui/popover'
import type { Option } from '#/lib/api-client'

function useFiltered(options: Array<Option> | undefined, query: string) {
  return useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = options ?? []
    if (!q) return list.slice(0, 200)
    return list.filter((o) => `${o.label} ${o.hint ?? ''}`.toLowerCase().includes(q)).slice(0, 200)
  }, [options, query])
}

function OptionList({
  options,
  isSelected,
  onPick,
  loading,
  query,
  setQuery,
}: {
  options: Array<Option>
  isSelected: (o: Option) => boolean
  onPick: (o: Option) => void
  loading?: boolean
  query: string
  setQuery: (q: string) => void
}) {
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const move = (delta: number) => {
    const next = Math.max(0, Math.min(options.length - 1, active + delta))
    setActive(next)
    listRef.current?.querySelector(`[data-index="${next}"]`)?.scrollIntoView({ block: 'nearest' })
  }
  return (
    <>
      <div className="flex items-center gap-2 border-b px-2.5 pb-1">
        <Search className="size-4 text-subtle-foreground" />
        <input
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setActive(0)
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') (e.preventDefault(), move(1))
            if (e.key === 'ArrowUp') (e.preventDefault(), move(-1))
            if (e.key === 'Enter' && options[active]) (e.preventDefault(), onPick(options[active]))
          }}
          placeholder="Type to search…"
          className="h-9 w-full bg-transparent text-sm outline-none"
        />
      </div>
      <div ref={listRef} role="listbox" className="max-h-64 overflow-y-auto py-1">
        {loading && (
          <p className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </p>
        )}
        {!loading && options.length === 0 && <p className="px-3 py-3 text-sm text-muted-foreground">No matches.</p>}
        {options.map((o, i) => (
          <button
            key={o.value}
            type="button"
            role="option"
            aria-selected={isSelected(o)}
            data-index={i}
            onMouseEnter={() => setActive(i)}
            onClick={() => onPick(o)}
            className={cn(
              'flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left text-sm',
              i === active && 'bg-accent',
            )}
          >
            <Check className={cn('mt-0.5 size-4 shrink-0 text-primary', !isSelected(o) && 'invisible')} />
            <span className="min-w-0">
              <span className="block truncate font-medium text-slate-800">{o.label}</span>
              {o.hint && <span className="block truncate text-xs text-muted-foreground">{o.hint}</span>}
            </span>
          </button>
        ))}
      </div>
    </>
  )
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder = 'Choose…',
  loading,
  invalid,
  disabled,
  clearable = true,
}: {
  options: Array<Option> | undefined
  value: number | null | undefined
  onChange: (value: number | null, option?: Option) => void
  placeholder?: string
  loading?: boolean
  invalid?: boolean
  disabled?: boolean
  clearable?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const filtered = useFiltered(options, query)
  const selected = options?.find((o) => o.value === Number(value))
  return (
    <Popover open={open} onOpenChange={(o) => (setOpen(o), o || setQuery(''))}>
      <PopoverTrigger asChild disabled={disabled}>
        <button
          type="button"
          aria-invalid={invalid}
          className="field-control flex h-10 items-center justify-between gap-2 text-left"
        >
          <span className={cn('truncate', !selected && 'text-subtle-foreground')}>
            {selected?.label ?? (value && loading ? 'Loading…' : placeholder)}
          </span>
          <span className="flex items-center gap-1">
            {clearable && selected && (
              <span
                role="button"
                tabIndex={-1}
                onClick={(e) => (e.stopPropagation(), onChange(null))}
                className="rounded-full p-0.5 text-subtle-foreground hover:bg-accent hover:text-foreground"
                aria-label="Clear"
              >
                <X className="size-3.5" />
              </span>
            )}
            <ChevronsUpDown className="size-4 text-subtle-foreground" />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent>
        <OptionList
          options={filtered}
          loading={loading}
          query={query}
          setQuery={setQuery}
          isSelected={(o) => o.value === Number(value)}
          onPick={(o) => {
            onChange(o.value, o)
            setOpen(false)
            setQuery('')
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

export function MultiCombobox({
  options,
  value,
  onChange,
  placeholder = 'Choose…',
  loading,
  invalid,
  exclude = [],
}: {
  options: Array<Option> | undefined
  value: Array<number>
  onChange: (value: Array<number>) => void
  placeholder?: string
  loading?: boolean
  invalid?: boolean
  exclude?: Array<number>
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const available = useMemo(() => options?.filter((o) => !exclude.includes(o.value)), [options, exclude])
  const filtered = useFiltered(available, query)
  const selected = (options ?? []).filter((o) => value.includes(o.value))
  const toggle = (id: number) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id])
  return (
    <Popover open={open} onOpenChange={(o) => (setOpen(o), o || setQuery(''))}>
      <PopoverTrigger asChild>
        <div
          role="button"
          tabIndex={0}
          aria-invalid={invalid}
          className="field-control flex min-h-10 flex-wrap items-center gap-1.5 py-1.5 text-left"
        >
          {selected.length === 0 && <span className="px-0.5 text-subtle-foreground">{placeholder}</span>}
          {selected.map((o) => (
            <span
              key={o.value}
              className="inline-flex items-center gap-1 rounded-full bg-primary-soft py-0.5 pr-1 pl-2.5 text-xs font-medium text-primary"
            >
              {o.label}
              <span
                role="button"
                tabIndex={-1}
                onClick={(e) => (e.stopPropagation(), toggle(o.value))}
                className="rounded-full p-0.5 hover:bg-primary/10"
                aria-label={`Remove ${o.label}`}
              >
                <X className="size-3" />
              </span>
            </span>
          ))}
          <ChevronsUpDown className="ml-auto size-4 text-subtle-foreground" />
        </div>
      </PopoverTrigger>
      <PopoverContent>
        <OptionList
          options={filtered}
          loading={loading}
          query={query}
          setQuery={setQuery}
          isSelected={(o) => value.includes(o.value)}
          onPick={(o) => toggle(o.value)}
        />
      </PopoverContent>
    </Popover>
  )
}
