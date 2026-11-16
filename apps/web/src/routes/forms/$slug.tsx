import { createFileRoute, notFound } from '@tanstack/react-router'
import { REQUEST_FORM_BY_SLUG } from '#/lib/forms'
import { FormIcon } from '#/components/site/form-icon'
import { SiteFooter, SiteHeader } from '#/components/site/site-shell'
import { RequestForm, RequestFormAside } from '#/components/site/request-form'

export const Route = createFileRoute('/forms/$slug')({
  loader: ({ params }) => {
    const def = REQUEST_FORM_BY_SLUG[params.slug]
    if (!def) throw notFound()
    return { title: def.title }
  },
  head: ({ loaderData }) => ({ meta: [{ title: `${loaderData?.title ?? 'Request form'} · DRIC` }] }),
  component: RequestFormPage,
})

function RequestFormPage() {
  const { slug } = Route.useParams()
  const def = REQUEST_FORM_BY_SLUG[slug]!
  return (
    <div className="min-h-dvh bg-canvas">
      <SiteHeader />
      <div className="mx-auto max-w-7xl px-5 py-10">
        <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-center">
          <span
            className="flex size-14 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg"
            style={{ background: def.accent }}
          >
            <FormIcon name={def.icon} className="size-6" />
          </span>
          <div>
            <p className="eyebrow">University of Cape Coast · DRIC</p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">{def.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{def.summary}</p>
          </div>
        </div>
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="rounded-3xl border bg-white p-6 shadow-sm sm:p-8">
            <RequestForm def={def} />
          </div>
          <RequestFormAside def={def} />
        </div>
      </div>
      <SiteFooter />
    </div>
  )
}
