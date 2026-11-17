import { Link, createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { z } from 'zod'
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react'
import { api, errorMessage } from '#/lib/api-client'
import { loginSchema } from '#/lib/schemas'
import { getSession } from '#/server/session'

// Only same-site paths, so ?next= can't be used as an open redirect.
const safeNext = (next?: string) => (next && next.startsWith('/') && !next.startsWith('//') ? next : '/admin')

export const Route = createFileRoute('/login')({
  validateSearch: z.object({ next: z.string().optional() }),
  beforeLoad: async ({ search }) => {
    if (await getSession()) throw redirect({ href: safeNext(search.next) })
  },
  head: () => ({ meta: [{ title: 'Sign in · DRIC Grants' }] }),
  component: LoginPage,
})

type Values = z.infer<typeof loginSchema>

// Bold, flat inputs with a hard offset shadow, in the DRIC navy.
const BRUTAL_INPUT =
  'h-11 w-full rounded-md border-2 border-primary bg-white px-3 text-[15px] font-semibold text-foreground shadow-[4px_4px_0_var(--primary)] outline-none placeholder:font-medium placeholder:text-muted-foreground focus:border-primary-hover focus:shadow-[2px_2px_0_var(--primary)] aria-[invalid=true]:border-secondary-foreground aria-[invalid=true]:shadow-[4px_4px_0_var(--secondary-foreground)]'

function LoginPage() {
  const navigate = useNavigate()
  const { next } = Route.useSearch()
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(loginSchema) })
  const login = useMutation({
    mutationFn: (values: Values) => api.post('/auth/login', values),
    onSuccess: () => navigate({ href: safeNext(next) }),
    onError: (err) => setError('root', { message: errorMessage(err) }),
  })
  return (
    <div className="grid min-h-dvh bg-white lg:grid-cols-[1.1fr_1fr]">
      <div className="hero-band relative hidden overflow-hidden text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="dot-grid absolute inset-0 opacity-50" aria-hidden="true" />
        {/* The UCC crest, large and faint, set into the gradient behind the text. */}
        <img
          src="/ucc-crest.png"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 -right-20 h-[34rem] w-auto -translate-y-1/2 opacity-[0.13] mix-blend-luminosity select-none xl:-right-8"
        />
        <div className="relative flex items-center gap-3">
          <img src="/ucc-crest-sm.png" alt="" className="h-12 w-auto" />
          <div>
            {/* Sized so the name runs exactly as wide as the line below it. */}
            <p className="text-[25.8px] leading-tight font-extrabold tracking-tight">University of Cape Coast</p>
            <p className="text-xs text-white/60">Directorate of Research, Innovation and Consultancy</p>
          </div>
        </div>
        <div className="relative max-w-lg">
          <p className="font-mono text-xs tracking-widest text-secondary uppercase">DRIC Grants Portal</p>
          <p className="mt-4 text-4xl leading-tight font-extrabold">
            Every grant, phase, claim and tranche — in one place.
          </p>
          <p className="mt-4 text-white/65">For DRIC officers and project investigators.</p>
        </div>
        {/* Adinkra band along the bottom edge, repeated from left to right.
            The motifs are dark navy, so they're turned white to show on the
            gradient. The spacer keeps the headline clear of it. */}
        <div aria-hidden="true" className="h-[72px]" />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[72px] bg-[url('/adinkra.png')] bg-[length:auto_72px] bg-bottom-left bg-repeat-x opacity-90 brightness-0 invert"
        />
      </div>
      <div className="flex flex-col items-center justify-center bg-primary-soft/40 px-6 py-12">
        <form
          onSubmit={handleSubmit((v) => login.mutate(v))}
          noValidate
          className="flex w-full max-w-sm flex-col gap-5 rounded-md border-2 border-primary bg-[color-mix(in_oklab,var(--secondary)_55%,white)] p-6 shadow-[5px_5px_0_var(--primary)]"
        >
          <div className="mb-4">
            <img src="/ucc-crest-sm.png" alt="University of Cape Coast crest" className="mb-3 h-14 w-auto" />
            <h1 className="text-xl font-black tracking-tight text-primary">DRIC Grants Portal</h1>
            <p className="text-base font-semibold text-muted-foreground">Sign in to continue</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="sr-only">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              placeholder="Email address"
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? 'email-error' : undefined}
              className={BRUTAL_INPUT}
              {...register('email')}
            />
            {errors.email && (
              <p id="email-error" className="text-xs font-semibold text-secondary-foreground">
                {errors.email.message}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="sr-only">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="Password"
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? 'password-error' : undefined}
              className={BRUTAL_INPUT}
              {...register('password')}
            />
            {errors.password && (
              <p id="password-error" className="text-xs font-semibold text-secondary-foreground">
                {errors.password.message}
              </p>
            )}
          </div>
          {errors.root && (
            <p
              role="alert"
              className="rounded-md border-2 border-primary bg-white px-3 py-2 text-sm font-semibold text-secondary-foreground"
            >
              {errors.root.message}
            </p>
          )}
          <button
            type="submit"
            disabled={login.isPending}
            className="mx-auto mt-6 inline-flex h-11 min-w-36 cursor-pointer items-center justify-center gap-2 rounded-md border-2 border-primary bg-primary px-5 text-base font-bold text-primary-foreground shadow-[4px_4px_0_var(--foreground)] transition-none active:translate-x-[3px] active:translate-y-[3px] active:shadow-none disabled:cursor-wait disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
          >
            {login.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Signing in…
              </>
            ) : (
              <>
                Sign in <ArrowRight className="size-4" />
              </>
            )}
          </button>
          <p className="w-full space-y-1.5 text-center text-xs font-medium">
            <span className="block text-muted-foreground">Forgotten your password?</span>
            <span className="block text-primary/70 italic">Ask a DRIC administrator to reset it.</span>
          </p>
        </form>
        <Link
          to="/"
          className="mt-8 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="size-4" /> Back to Homepage
        </Link>
      </div>
    </div>
  )
}
