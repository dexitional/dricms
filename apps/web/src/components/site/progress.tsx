import { Check, X } from 'lucide-react'
import { cn } from '@dric/ui'
import { date } from '#/lib/format'

/** Submitted → Received → Under review → Decision, for applicants. */
export function RequestProgress({
  status,
  createdAt,
  receivedAt,
  decidedAt,
}: {
  status: string
  createdAt: string
  receivedAt?: string | null
  decidedAt?: string | null
}) {
  const order = ['SUBMITTED', 'RECEIVED', 'UNDER_REVIEW', 'DECIDED']
  const reached = status === 'APPROVED' || status === 'DECLINED' ? 3 : order.indexOf(status)
  const declined = status === 'DECLINED'
  const steps = [
    { label: 'Submitted', when: date(createdAt) },
    { label: 'Received at DRIC', when: receivedAt ? date(receivedAt) : null },
    { label: 'Under review', when: null },
    {
      label: declined ? 'Declined' : status === 'APPROVED' ? 'Approved' : 'Decision',
      when: decidedAt ? date(decidedAt) : null,
    },
  ]
  return (
    <ol className="grid gap-3 sm:grid-cols-4">
      {steps.map((s, i) => {
        const done = i <= reached
        const isDecline = i === 3 && declined
        return (
          <li key={s.label} className="relative">
            {i < 3 && (
              <span
                className={cn(
                  'absolute top-4 left-9 hidden h-0.5 w-[calc(100%-2.25rem)] sm:block',
                  i < reached ? 'bg-primary' : 'bg-border',
                )}
              />
            )}
            <span
              className={cn(
                'relative flex size-8 items-center justify-center rounded-full border-2 text-xs font-bold',
                isDecline
                  ? 'border-destructive bg-destructive text-white'
                  : done
                    ? 'border-primary bg-primary text-white'
                    : 'border-border-strong bg-white text-muted-foreground',
              )}
            >
              {isDecline ? <X className="size-4" /> : done ? <Check className="size-4" /> : i + 1}
            </span>
            <p className={cn('mt-2 text-sm font-semibold', done ? 'text-slate-900' : 'text-muted-foreground')}>
              {s.label}
            </p>
            {s.when && <p className="text-xs text-muted-foreground">{s.when}</p>}
          </li>
        )
      })}
    </ol>
  )
}
