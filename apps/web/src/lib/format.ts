const moneyFormatters = new Map<string, Intl.NumberFormat>()

export function money(amount: number | string | null | undefined, currency = 'USD', opts?: { compact?: boolean }) {
  const value = Number(amount ?? 0)
  const key = `${currency}:${opts?.compact ? 'c' : 'f'}`
  let fmt = moneyFormatters.get(key)
  if (!fmt) {
    try {
      fmt = new Intl.NumberFormat('en-GH', {
        style: 'currency',
        currency,
        currencyDisplay: 'code',
        notation: opts?.compact ? 'compact' : 'standard',
        maximumFractionDigits: opts?.compact ? 1 : 2,
        minimumFractionDigits: opts?.compact ? 0 : 2,
      })
    } catch {
      fmt = new Intl.NumberFormat('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    }
    moneyFormatters.set(key, fmt)
  }
  return fmt.format(Number.isFinite(value) ? value : 0).replace(/ /g, ' ')
}

export function num(value: number | string | null | undefined, digits = 2) {
  return Number(value ?? 0).toLocaleString('en-GH', { minimumFractionDigits: 0, maximumFractionDigits: digits })
}

// Dates arrive as "YYYY-MM-DD" (DATE) or "YYYY-MM-DD HH:MM:SS" (TIMESTAMP)
// strings; parse them as local dates so nothing shifts a day.
function parse(value: string) {
  const [d, t] = value.split(/[ T]/)
  const [y, m, day] = (d ?? '').split('-').map(Number)
  const [hh, mm] = (t ?? '00:00').split(':').map(Number)
  return new Date(y ?? 1970, (m ?? 1) - 1, day ?? 1, hh ?? 0, mm ?? 0)
}

export function date(value: string | null | undefined, style: 'medium' | 'long' | 'short' = 'medium') {
  if (!value) return '—'
  const d = parse(value)
  if (style === 'short') return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: style === 'long' ? 'long' : 'short', year: 'numeric' })
}

export function dateTime(value: string | null | undefined) {
  if (!value) return '—'
  return parse(value).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function relative(value: string | null | undefined) {
  if (!value) return '—'
  const diff = (Date.now() - parse(value).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)}d ago`
  return date(value)
}

export function today() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Length of a date range (inclusive) as "18 months" / "2 years". */
export function period(start: string | null | undefined, end: string | null | undefined) {
  if (!start || !end) return '—'
  const days = (parse(end).getTime() - parse(start).getTime()) / 86_400_000 + 1
  const months = Math.round(days / 30.4375)
  if (months <= 0) return 'Under a month'
  if (months % 12 === 0) return `${months / 12} year${months === 12 ? '' : 's'}`
  return `${months} month${months === 1 ? '' : 's'}`
}

export function personName(p: Record<string, any>) {
  return [p.title, p.firstName, p.middleName, p.lastName].filter(Boolean).join(' ')
}

export function initials(name: string) {
  const parts = name
    .replace(/^(Prof\.|Assoc\. Prof\.|Dr\.|Mr\.|Mrs\.|Ms\.|Rev\.|Hon\.)\s*/i, '')
    .split(/\s+/)
    .filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '')).toUpperCase()
}

export function percent(part: number, whole: number) {
  if (!whole) return 0
  return Math.max(0, Math.min(100, Math.round((part / whole) * 100)))
}

export function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
