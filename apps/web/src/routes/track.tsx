import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { z } from 'zod'
import { Loader2, Printer, Search } from 'lucide-react'
import type { RequestType } from '@dric/db/types'
import { api, errorMessage } from '#/lib/api-client'
import { REQUEST_FORM_BY_TYPE } from '#/lib/forms'
import { REQUEST_STATUS_LABELS } from '#/lib/labels'
import { trackSchema } from '#/lib/schemas'
import { relative } from '#/lib/format'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Field } from '#/components/admin/form'
import { StatusBadge } from '#/components/admin/page'
import { RequestProgress } from '#/components/site/progress'
import { SiteFooter, SiteHeader } from '#/components/site/site-shell'

export const Route = createFileRoute('/track')({
  head: () => ({ meta: [{ title: 'Track a request · DRIC' }] }),
  component: TrackPage,
})

type Values = z.input<typeof trackSchema>
type Result = Record<string, any>

function TrackPage() {
  const [result, setResult] = useState<Result | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values, unknown, z.output<typeof trackSchema>>({ resolver: zodResolver(trackSchema) })
  const track = useMutation({
    mutationFn: (v: z.output<typeof trackSchema>) => api.post<Result>('/public/track', v),
    onSuccess: setResult,
    onError: () => setResult(null),
  })
  const def = result ? REQUEST_FORM_BY_TYPE[result.type as RequestType] : null
  return (
    <div className="min-h-dvh bg-canvas">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-5 py-14">
        <p className="eyebrow">Request tracker</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">Where is my request?</h1>
        <p className="mt-2 text-muted-foreground">
          Enter the reference you received when you submitted, and the email address on the form.
        </p>
        <form
          onSubmit={handleSubmit((v) => track.mutate(v))}
          noValidate
          className="mt-8 grid gap-4 rounded-3xl border bg-white p-6 shadow-sm sm:grid-cols-[1fr_1.4fr_auto] sm:items-end"
        >
          <Field label="Reference" error={errors.reference?.message}>
            <Input {...register('reference')} placeholder="RQ-XXXXXX" className="font-mono uppercase" />
          </Field>
          <Field label="Email address" error={errors.email?.message}>
            <Input type="email" {...register('email')} />
          </Field>
          <Button type="submit" size="lg" disabled={track.isPending}>
            {track.isPending ? <Loader2 className="animate-spin" /> : <Search />} Track
          </Button>
          {track.isError && (
            <p className="rounded-xl bg-secondary px-3 py-2 text-sm text-secondary-foreground sm:col-span-3">
              {errorMessage(track.error)}
            </p>
          )}
        </form>
        {result && def && (
          <div className="mt-6 space-y-6 rounded-3xl border bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="eyebrow">
                  {result.reference} · {def.shortTitle}
                </p>
                <p className="mt-1 text-lg font-bold">{result.projectTitle}</p>
                <p className="text-xs text-muted-foreground">Last updated {relative(result.updatedAt)}</p>
              </div>
              <StatusBadge
                status={result.status}
                label={REQUEST_STATUS_LABELS[result.status as keyof typeof REQUEST_STATUS_LABELS]}
              />
            </div>
            <RequestProgress
              status={result.status}
              createdAt={result.createdAt}
              receivedAt={result.receivedAt}
              decidedAt={result.directorDecidedAt}
            />
            <a
              href={`/print/request/${result.reference}?k=${encodeURIComponent(result.accessKey)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold hover:bg-accent"
            >
              <Printer className="size-4" /> View / print the form
            </a>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  )
}
