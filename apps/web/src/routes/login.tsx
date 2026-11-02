import { Link, createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { z } from 'zod'
import { ArrowLeft, Loader2, LockKeyhole } from 'lucide-react'
import { api, errorMessage } from '#/lib/api-client'
import { loginSchema } from '#/lib/schemas'
import { getSession } from '#/server/session'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Field } from '#/components/admin/form'

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
        <div className="relative flex items-center gap-3">
          <img src="/ucc-crest-sm.png" alt="" className="h-12 w-auto" />
          <div>
            <p className="font-extrabold tracking-tight">University of Cape Coast</p>
            <p className="text-xs text-white/60">Directorate of Research, Innovation and Consultancy</p>
          </div>
        </div>
        <div className="relative max-w-lg">
          <p className="font-mono text-xs tracking-widest text-secondary uppercase">DRIC Grants Portal</p>
          <p className="mt-4 text-4xl leading-tight font-extrabold">
            Every grant, phase, claim and tranche — in one place.
          </p>
          <p className="mt-4 text-white/65">For DRIC staff, accountants, clerks and project investigators.</p>
        </div>
        <img src="/adinkra.png" alt="" className="relative w-64 opacity-60" />
      </div>
      <div className="flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <img src="/ucc-crest-sm.png" alt="" className="mb-6 h-14 w-auto lg:hidden" />
          <div className="flex size-12 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground">
            <LockKeyhole className="size-5" />
          </div>
          <h1 className="mt-5 text-3xl font-extrabold tracking-tight text-primary">Sign in</h1>
          <p className="mt-1 text-sm text-muted-foreground">Use the account DRIC created for you.</p>
          <form onSubmit={handleSubmit((v) => login.mutate(v))} className="mt-8 flex flex-col gap-5" noValidate>
            <Field label="Email" error={errors.email?.message} htmlFor="email">
              <Input
                id="email"
                type="email"
                autoComplete="username"
                aria-invalid={Boolean(errors.email)}
                {...register('email')}
              />
            </Field>
            <Field label="Password" error={errors.password?.message} htmlFor="password">
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                aria-invalid={Boolean(errors.password)}
                {...register('password')}
              />
            </Field>
            {errors.root && (
              <p className="rounded-xl bg-secondary px-3 py-2 text-sm text-secondary-foreground">
                {errors.root.message}
              </p>
            )}
            <Button type="submit" size="lg" disabled={login.isPending}>
              {login.isPending && <Loader2 className="animate-spin" />}
              {login.isPending ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
          <p className="mt-6 text-xs text-muted-foreground">
            Forgotten your password? Ask a DRIC administrator to reset it.
          </p>
          <Link
            to="/"
            className="mt-10 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary"
          >
            <ArrowLeft className="size-4" /> Back to DRIC forms
          </Link>
        </div>
      </div>
    </div>
  )
}
