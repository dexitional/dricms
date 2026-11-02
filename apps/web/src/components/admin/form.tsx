import { cn } from '@dric/ui'
import { Label } from '#/components/ui/input'

export function Field({
  label,
  error,
  hint,
  required,
  htmlFor,
  className,
  children,
}: {
  label: React.ReactNode
  error?: string
  hint?: React.ReactNode
  required?: boolean
  htmlFor?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {children}
      {error ? (
        <p className="text-xs font-medium text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}

export function FormSection({
  title,
  description,
  children,
  className,
  index,
}: {
  title: string
  description?: string
  children: React.ReactNode
  className?: string
  index?: number
}) {
  return (
    <section
      className={cn(
        'grid gap-6 border-b border-dashed border-border py-7 first:pt-0 last:border-0 lg:grid-cols-[15rem_minmax(0,1fr)]',
        className,
      )}
    >
      <div>
        {index !== undefined && <p className="eyebrow mb-1">Step {String(index).padStart(2, '0')}</p>}
        <h2 className="text-sm font-bold text-slate-900">{title}</h2>
        {description && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      <div className="grid gap-5 sm:grid-cols-2">{children}</div>
    </section>
  )
}

export function FormActions({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 -mx-6 mt-2 flex items-center justify-end gap-2 border-t bg-white/85 px-6 py-4 backdrop-blur max-md:-mx-4 max-md:px-4">
      {children}
    </div>
  )
}

/** First validation message for a nested react-hook-form error, if any. */
export function errorAt(errors: unknown, path: string): string | undefined {
  let node: any = errors
  for (const key of path.split('.')) node = node?.[key]
  return typeof node?.message === 'string' ? node.message : undefined
}
