import { cn } from '@dric/ui'
import type { Tone } from '#/lib/labels'

const TONES: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-600 ring-slate-200',
  info: 'bg-info-soft text-blue-700 ring-blue-200',
  warning: 'bg-warning-soft text-amber-700 ring-amber-200',
  success: 'bg-success-soft text-emerald-700 ring-emerald-200',
  danger: 'bg-secondary text-secondary-foreground ring-red-200',
  brand: 'bg-primary-soft text-primary ring-indigo-200',
}

export function Badge({
  tone = 'neutral',
  dot = true,
  className,
  children,
}: {
  tone?: Tone
  dot?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[0.72rem] font-semibold whitespace-nowrap ring-1 ring-inset',
        TONES[tone],
        className,
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current opacity-80" aria-hidden="true" />}
      {children}
    </span>
  )
}
