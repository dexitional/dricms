import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { Copy, Mail, PartyPopper, Printer, Search } from 'lucide-react'
import { toast } from 'sonner'
import type { RequestType } from '@dric/db/types'
import { api } from '#/lib/api-client'
import { DRIC_EMAIL, REQUEST_FORM_BY_TYPE } from '#/lib/forms'
import { Skeleton } from '#/components/ui/skeleton'
import { RequestProgress } from '#/components/site/progress'
import { SiteFooter, SiteHeader } from '#/components/site/site-shell'

export const Route = createFileRoute('/submitted/$reference')({
  validateSearch: z.object({ k: z.string().default('') }),
  head: () => ({ meta: [{ title: 'Request submitted · DRIC' }, { name: 'robots', content: 'noindex' }] }),
  component: Submitted,
})

function Submitted() {
  const { reference } = Route.useParams()
  const { k } = Route.useSearch()
  const { data: r, isError } = useQuery({
    queryKey: ['public-request', reference, k],
    queryFn: () => api.get<Record<string, any>>(`/public/requests/${reference}`, { k }),
    retry: false,
  })
  const def = r ? REQUEST_FORM_BY_TYPE[r.type as RequestType] : null
  const printUrl = `/print/request/${reference}?k=${encodeURIComponent(k)}`
  return (
    <div className="min-h-dvh bg-canvas">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-5 py-14">
        <div className="overflow-hidden rounded-3xl border bg-white shadow-sm">
          <div className="hero-band relative px-8 py-10 text-white">
            <div className="dot-grid absolute inset-0 opacity-50" aria-hidden="true" />
            <PartyPopper className="relative size-9 text-secondary" />
            <h1 className="relative mt-4 text-3xl font-extrabold tracking-tight">Request submitted</h1>
            <p className="relative mt-2 text-white/70">{def ? def.title : 'Your request'} has been sent to DRIC.</p>
            <div className="relative mt-6 inline-flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-white/20">
              <span>
                <span className="block text-[0.68rem] tracking-widest text-white/60 uppercase">Your reference</span>
                <span className="font-mono text-2xl font-bold tracking-wider">{reference}</span>
              </span>
              <button
                type="button"
                onClick={() => (navigator.clipboard.writeText(reference), toast.success('Reference copied'))}
                className="rounded-full p-2 hover:bg-white/10"
                aria-label="Copy reference"
              >
                <Copy className="size-4" />
              </button>
            </div>
          </div>
          <div className="space-y-8 p-8">
            {isError ? (
              <p className="text-sm text-muted-foreground">
                Keep your reference safe — you can track this request with it and your email address.
              </p>
            ) : !r ? (
              <Skeleton className="h-20" />
            ) : (
              <>
                <RequestProgress
                  status={r.status}
                  createdAt={r.createdAt}
                  receivedAt={r.receivedAt}
                  decidedAt={r.directorDecidedAt}
                />
                <div className="rounded-2xl bg-muted p-5 text-sm">
                  <p className="font-semibold text-slate-900">{r.projectTitle}</p>
                  <p className="mt-1 text-muted-foreground">
                    Submitted by {r.firstName} {r.surname} · {r.email}
                  </p>
                  {def && (
                    <p className="mt-3 text-slate-700">
                      DRIC asks for <b>{def.allowance}</b> to process this request. Save or print a copy for your
                      records.
                    </p>
                  )}
                </div>
              </>
            )}
            <div className="flex flex-wrap gap-3">
              <a
                href={printUrl}
                target="_blank"
                rel="noreferrer"
                className="btn-shine inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white"
              >
                <Printer className="size-4" /> Print / save the completed form
              </a>
              <Link
                to="/track"
                className="inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-semibold hover:bg-accent"
              >
                <Search className="size-4" /> Track a request
              </Link>
            </div>
            <p className="flex items-start gap-2 border-t pt-6 text-xs text-muted-foreground">
              <Mail className="mt-0.5 size-3.5 shrink-0" /> Documents you didn’t upload can be emailed to {DRIC_EMAIL} —
              quote {reference} in the subject.
            </p>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
