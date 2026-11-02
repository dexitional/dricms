import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Clock,
  FileSearch,
  Inbox,
  Lock,
  Printer,
  Search,
  Stamp,
} from 'lucide-react'
import { api } from '#/lib/api-client'
import { REQUEST_FORMS } from '#/lib/forms'
import { num } from '#/lib/format'
import { SiteFooter, SiteHeader } from '#/components/site/site-shell'
import { FormIcon } from '#/components/site/form-icon'

export const Route = createFileRoute('/')({ component: Landing })

const STEPS = [
  {
    icon: FileSearch,
    title: 'Fill the form online',
    text: 'Pick the request you need and complete it here — no printing, scanning or walking forms around campus.',
  },
  {
    icon: Inbox,
    title: 'DRIC receives it',
    text: 'Your request lands with DRIC immediately, with your attachments, and is logged with a reference number.',
  },
  {
    icon: Stamp,
    title: 'Review & decision',
    text: 'The Director (and Vice Chancellor where required) records a decision on the official-use section.',
  },
  {
    icon: Printer,
    title: 'Print-ready record',
    text: 'Download the completed official form as a PDF at any time using your reference.',
  },
]

function Landing() {
  const { data: stats } = useQuery({
    queryKey: ['public-stats'],
    queryFn: () => api.get<Record<string, number>>('/public/stats'),
  })
  return (
    <div className="bg-white">
      <section className="hero-band relative overflow-hidden text-white">
        <div className="dot-grid absolute inset-0 opacity-60" aria-hidden="true" />
        <img
          src="/ucc-crest.png"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute top-16 -right-16 hidden w-[26rem] opacity-[0.05] mix-blend-luminosity lg:block"
        />
        <SiteHeader dark />
        <div className="relative mx-auto max-w-7xl px-5 pt-14 pb-24 lg:pt-20 lg:pb-32">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 font-mono text-[0.7rem] tracking-widest text-secondary uppercase">
            <span className="size-1.5 animate-pulse rounded-full bg-secondary" /> Research · Innovation · Consultancy
          </p>
          <h1 className="mt-6 max-w-3xl text-4xl leading-[1.08] font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
            Grants and consultancies, <span className="text-secondary">managed end to end.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/70">
            Submit DRIC requests online — from your intent to apply, through letters of support and proposal reviews, to
            project close-out and equipment transfer — and follow every step.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <a
              href="#forms"
              className="btn-shine inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 font-semibold text-primary shadow-lg shadow-black/10 transition-transform hover:-translate-y-0.5"
            >
              Start a request <ArrowRight className="size-4" />
            </a>
            <Link
              to="/track"
              className="inline-flex items-center gap-2 rounded-full border border-white/25 px-6 py-3 font-semibold text-white transition-colors hover:bg-white/10"
            >
              <Search className="size-4" /> Track a request
            </Link>
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto -mt-12 max-w-6xl px-5">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-3xl border bg-border shadow-xl shadow-primary/5 md:grid-cols-4">
          {[
            ['Active projects', stats?.ongoingProjects],
            ['Projects managed', stats?.projects],
            ['Funding partners', stats?.funders],
            ['Investigators', stats?.investigators],
          ].map(([label, value]) => (
            <div key={label as string} className="bg-white px-6 py-6">
              <p className="text-3xl font-extrabold tracking-tight text-primary tabular-nums">
                {value === undefined ? '—' : num(value as number, 0)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="forms" className="mx-auto max-w-7xl scroll-mt-10 px-5 py-24">
        <div className="max-w-2xl">
          <p className="eyebrow text-secondary-foreground">Request forms</p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            What do you need from DRIC?
          </h2>
          <p className="mt-3 text-muted-foreground">
            Each form matches the official UCC-DRIC form and produces the same printout, completed and ready to file.
          </p>
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {REQUEST_FORMS.map((f) => (
            <Link
              key={f.slug}
              to="/forms/$slug"
              params={{ slug: f.slug }}
              className="lift group relative flex flex-col overflow-hidden rounded-3xl border bg-white p-6"
            >
              <span
                className="absolute inset-x-0 top-0 h-1 opacity-0 transition-opacity group-hover:opacity-100"
                style={{ background: f.accent }}
              />
              <span
                className="flex size-12 items-center justify-center rounded-2xl text-white shadow-lg"
                style={{ background: f.accent, boxShadow: `0 10px 24px -10px ${f.accent}` }}
              >
                <FormIcon name={f.icon} className="size-5" />
              </span>
              <h3 className="mt-5 text-lg font-bold text-slate-900">{f.shortTitle}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{f.summary}</p>
              <div className="mt-5 flex items-center justify-between border-t border-dashed pt-4 text-xs">
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="size-3.5" /> Allow {f.allowance.replace(/ \(\d+\)/, '').replace('at least ', '')}
                </span>
                <span className="inline-flex items-center gap-1 font-semibold text-primary">
                  Start <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
                </span>
              </div>
            </Link>
          ))}
          <Link
            to="/login"
            search={{ next: '/admin/claims/new' }}
            className="lift group relative flex flex-col overflow-hidden rounded-3xl border border-primary bg-primary p-6 text-white"
          >
            <div className="dot-grid absolute inset-0 opacity-50" aria-hidden="true" />
            <span className="relative flex size-12 items-center justify-center rounded-2xl bg-white text-primary">
              <FormIcon name="coins" className="size-5" />
            </span>
            <h3 className="relative mt-5 text-lg font-bold">Disbursement of project funds</h3>
            <p className="relative mt-2 flex-1 text-sm leading-relaxed text-white/70">
              Investigators on an active project request funds for a phase, paid in tranches. Sign in to the portal to
              submit.
            </p>
            <div className="relative mt-5 flex items-center justify-between border-t border-dashed border-white/20 pt-4 text-xs">
              <span className="inline-flex items-center gap-1.5 text-white/60">
                <Lock className="size-3.5" /> Investigators only
              </span>
              <span className="inline-flex items-center gap-1 font-semibold">
                Sign in <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
              </span>
            </div>
          </Link>
        </div>
      </section>

      <section className="border-y bg-canvas">
        <div className="mx-auto max-w-7xl px-5 py-24">
          <div className="grid gap-12 lg:grid-cols-[1fr_2fr]">
            <div>
              <p className="eyebrow text-secondary-foreground">How it works</p>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">
                From submission to signed decision
              </h2>
              <p className="mt-3 text-muted-foreground">
                Every request gets a reference so you can check where it is without calling or emailing.
              </p>
              <Link
                to="/track"
                className="mt-6 inline-flex items-center gap-2 font-semibold text-primary hover:underline"
              >
                Track a request <ArrowRight className="size-4" />
              </Link>
            </div>
            <ol className="grid gap-4 sm:grid-cols-2">
              {STEPS.map((s, i) => (
                <li key={s.title} className="relative rounded-3xl border bg-white p-6">
                  <span className="absolute top-6 right-6 font-mono text-xs text-subtle-foreground">0{i + 1}</span>
                  <span className="flex size-11 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground">
                    <s.icon className="size-5" />
                  </span>
                  <h3 className="mt-4 font-bold text-slate-900">{s.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-24">
        <div className="grid items-center gap-10 overflow-hidden rounded-[2rem] bg-secondary p-8 sm:p-12 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight text-primary">Running a DRIC project?</h2>
            <p className="mt-3 max-w-xl text-slate-700">
              Principal and co-investigators can sign in to see their projects, phases and activities, request funds and
              follow every tranche paid.
            </p>
            <ul className="mt-6 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
              {[
                'Project & phase overviews',
                'Request disbursement of funds',
                'Tranche payment history',
                'Printable official forms',
              ].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-secondary-foreground" /> {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col items-start gap-3 lg:items-end">
            <Link
              to="/login"
              className="btn-shine inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-semibold text-white"
            >
              <BadgeCheck className="size-4" /> Sign in to the portal
            </Link>
            <p className="text-xs text-slate-600">Accounts are issued by DRIC.</p>
          </div>
        </div>
      </section>
      <SiteFooter />
    </div>
  )
}
