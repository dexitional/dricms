import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowRight, Clock } from 'lucide-react'
import { REQUEST_FORMS } from '#/lib/forms'
import { EmptyState, PageHeader } from '#/components/admin/page'
import { useUser } from '#/components/admin/session'
import { FormIcon } from '#/components/site/form-icon'

export const Route = createFileRoute('/admin/requests/new/')({ component: ChooseFormPage })

/** Investigators pick which DRIC request form to fill in from their portal. */
function ChooseFormPage() {
  const user = useUser()
  if (user.role !== 'investigator') {
    return (
      <EmptyState
        title="Request forms are filled in by investigators"
        description="Staff record requests from the forms site."
      />
    )
  }
  return (
    <>
      <PageHeader
        back={{ to: '/admin/requests', label: 'My requests' }}
        title="Create a request form"
        description="Choose the form you need. Your particulars are filled in for you, and the request is added to My requests once sent."
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {REQUEST_FORMS.map((f) => (
          <Link
            key={f.slug}
            to="/admin/requests/new/$slug"
            params={{ slug: f.slug }}
            className="lift group flex flex-col rounded-2xl border bg-white p-5"
          >
            <span
              className="flex size-11 items-center justify-center rounded-xl text-white shadow-sm"
              style={{ background: f.accent }}
            >
              <FormIcon name={f.icon} className="size-5" />
            </span>
            <p className="mt-4 font-bold text-slate-900">{f.shortTitle}</p>
            <p className="mt-1 flex-1 text-sm text-muted-foreground">{f.summary}</p>
            <p className="mt-4 flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Clock className="size-3.5" /> Allow {f.allowance}
              </span>
              <span className="inline-flex shrink-0 items-center gap-1 font-semibold whitespace-nowrap text-primary">
                Fill in <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </p>
          </Link>
        ))}
      </div>
    </>
  )
}
