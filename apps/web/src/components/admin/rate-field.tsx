import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeftRight } from 'lucide-react'
import { cn } from '@dric/ui'
import { api } from '#/lib/api-client'
import { date as formatDate } from '#/lib/format'
import { can } from '#/lib/permissions'
import { Input } from '#/components/ui/input'
import { useUser } from '#/components/admin/session'

// Exchange rates change, so a rate is never fixed in the forms: each one is
// suggested from the dated register (/admin/rates) for the transaction date,
// can be typed either way round, and can be saved back to the register.

export type RateSuggestion = { rate: number | null; effectiveDate?: string; source?: string | null }
/** A rate to add to the register, written the way it was entered. */
export type RateEntry = { baseCurrency: string; quoteCurrency: string; rate: number }

/** The register's rate from → to on a date (null when it has none). */
export function useRateSuggestion(from: string | undefined, to: string | undefined, on: string | undefined) {
  return useQuery({
    queryKey: ['rates', 'lookup', from, to, on],
    queryFn: () => api.get<RateSuggestion>('/rates/lookup', { from, to, on }),
    enabled: Boolean(from && to && from !== to),
    staleTime: 60_000,
  })
}

/** Up to eight significant figures, without trailing zeros. */
export function formatRate(rate: number) {
  return String(Number(rate.toPrecision(8)))
}

const close = (a: number, b: number) => Math.abs(a - b) <= Math.abs(b) * 1e-7

/**
 * A rate from one currency into another. `value` is always 1 `from` = value
 * `to` (the direction the ledger uses); the user may type it the other way
 * round, which is handy when the natural quote is "1 USD = 15.23 GHS" but the
 * money moves from GHS to USD.
 *
 * With `autoApply`, the register's rate fills the field until the user types
 * their own (new records). Otherwise it is offered with a "Use it" link.
 */
export function RateField({
  from,
  to,
  on,
  value,
  onChange,
  autoApply = false,
  invalid,
  onRemember,
}: {
  from: string
  to: string
  /** The transaction date the rate applies to. */
  on: string | undefined
  value: number | null
  onChange: (rate: number | null) => void
  autoApply?: boolean
  invalid?: boolean
  /** Called with the rate to save to the register, or null for none. */
  onRemember?: (entry: RateEntry | null) => void
}) {
  const user = useUser()
  const canSave = Boolean(onRemember) && can(user.role, 'rates', 'manage')
  const suggestion = useRateSuggestion(from, to, on)
  const suggested = suggestion.data?.rate ?? null

  // Shown as "1 to = ? from" when inverted.
  const [inverted, setInverted] = useState(() => (value ? value < 1 : false))
  const [text, setText] = useState(() => (value ? formatRate(inverted ? 1 / value : value) : ''))
  const [remember, setRemember] = useState(false)
  const typed = useRef(false)

  // A new pair starts over: the user hasn't typed a rate for it yet.
  const pair = `${from}>${to}`
  const lastPair = useRef(pair)
  useEffect(() => {
    if (lastPair.current === pair) return
    lastPair.current = pair
    typed.current = false
    setRemember(false)
  }, [pair])

  // Keep the text in step when the value is set from outside (loading a
  // record, applying the register's rate), showing it the readable way round.
  useEffect(() => {
    const shown = Number(text)
    const current = shown > 0 ? (inverted ? 1 / shown : shown) : null
    if (value == null || value <= 0) {
      if (current != null && !typed.current) setText('')
      return
    }
    if (current != null && close(current, value)) return
    const flip = typed.current ? inverted : value < 1
    setInverted(flip)
    setText(formatRate(flip ? 1 / value : value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  // New records follow the register until the user types a rate of their own.
  useEffect(() => {
    if (!autoApply || typed.current || suggested == null) return
    if (value == null || !close(value, suggested)) onChange(suggested)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoApply, suggested, pair])

  const differs = value != null && value > 0 && (suggested == null || !close(value, suggested))
  const shownBase = inverted ? to : from
  const shownQuote = inverted ? from : to

  useEffect(() => {
    if (!onRemember) return
    const shown = Number(text)
    onRemember(
      remember && differs && shown > 0 ? { baseCurrency: shownBase, quoteCurrency: shownQuote, rate: shown } : null,
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remember, differs, text, shownBase, shownQuote])

  const type = (next: string) => {
    typed.current = true
    setText(next)
    const n = Number(next)
    onChange(n > 0 ? (inverted ? 1 / n : n) : null)
  }
  const flip = () => {
    const n = Number(text)
    setInverted(!inverted)
    if (n > 0) setText(formatRate(1 / n))
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="shrink-0 font-mono text-xs text-muted-foreground">1 {shownBase} =</span>
        <Input
          type="number"
          step="any"
          min="0"
          inputMode="decimal"
          value={text}
          onChange={(e) => type(e.target.value)}
          className="font-mono"
          aria-invalid={invalid}
          aria-label={`Rate: how many ${shownQuote} one ${shownBase} buys`}
        />
        <span className="shrink-0 font-mono text-xs text-muted-foreground">{shownQuote}</span>
        <button
          type="button"
          onClick={flip}
          className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          title={`Enter as 1 ${shownQuote} = ? ${shownBase}`}
          aria-label={`Enter the rate the other way round, as 1 ${shownQuote} = ? ${shownBase}`}
        >
          <ArrowLeftRight className="size-4" />
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        {suggestion.isLoading ? (
          'Checking the rate register…'
        ) : suggested == null ? (
          <>
            No {from}/{to} rate in the register for this date. Type the rate used.
          </>
        ) : differs ? (
          <>
            Register rate from {formatDate(suggestion.data?.effectiveDate)}: 1 {shownBase} ={' '}
            {formatRate(inverted ? 1 / suggested : suggested)} {shownQuote}
            {suggestion.data?.source ? ` (${suggestion.data.source})` : ''}.{' '}
            <button
              type="button"
              className="font-medium text-primary underline-offset-2 hover:underline"
              onClick={() => {
                typed.current = false
                onChange(suggested)
              }}
            >
              Use it
            </button>
          </>
        ) : (
          <>
            Register rate from {formatDate(suggestion.data?.effectiveDate)}
            {suggestion.data?.source ? ` (${suggestion.data.source})` : ''}.
          </>
        )}
      </p>
      {canSave && differs && (
        <label
          className={cn('flex items-center gap-2 text-xs', remember ? 'text-foreground' : 'text-muted-foreground')}
        >
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="size-3.5 accent-[var(--primary)]"
          />
          Save this rate to the register from {on ? formatDate(on) : 'the transaction date'}
        </label>
      )}
    </div>
  )
}

/** Adds the rates ticked "save to the register" once the record is saved. */
export async function saveRatesToRegister(entries: Array<RateEntry | null>, effectiveDate: string, source: string) {
  const unique = new Map<string, RateEntry>()
  for (const e of entries) if (e) unique.set(`${e.baseCurrency}>${e.quoteCurrency}`, e)
  await Promise.all([...unique.values()].map((e) => api.post('/rates', { ...e, effectiveDate, source })))
  return unique.size
}
