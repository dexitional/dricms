import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowUpRight, LogIn, Mail, MapPin, Phone } from 'lucide-react'
import { api } from '#/lib/api-client'
import { DRIC_EMAIL } from '#/lib/forms'

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: () => api.get<{ user: Record<string, any> | null; profile: Record<string, any> | null }>('/auth/me'),
    staleTime: 60_000,
  })
}

export function SiteHeader({ dark = false }: { dark?: boolean }) {
  const me = useMe()
  const signedIn = Boolean(me.data?.user)
  const link = dark ? 'text-white/75 hover:text-white' : 'text-slate-600 hover:text-primary'
  return (
    <header className={dark ? 'relative z-20' : 'sticky top-0 z-30 border-b bg-white/85 backdrop-blur'}>
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-5 py-4">
        <Link to="/" className="flex items-center gap-3">
          <img src="/ucc-crest-sm.png" alt="University of Cape Coast" className="h-10 w-auto" />
          <div className="leading-tight">
            <p className={`text-[0.95rem] font-extrabold tracking-tight ${dark ? 'text-white' : 'text-primary'}`}>
              DRIC · UCC
            </p>
            <p className={`hidden text-[0.68rem] sm:block ${dark ? 'text-white/60' : 'text-muted-foreground'}`}>
              Directorate of Research, Innovation and Consultancy
            </p>
          </div>
        </Link>
        <nav className="flex items-center gap-1 text-sm font-medium sm:gap-5">
          <a href="/#forms" className={`hidden sm:inline ${link}`}>
            Forms
          </a>
          <Link to="/track" className={`hidden sm:inline ${link}`}>
            Track a request
          </Link>
          <Link
            to={signedIn ? '/admin' : '/login'}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${dark ? 'bg-white text-primary hover:bg-secondary' : 'btn-shine bg-primary text-white hover:bg-primary-hover'}`}
          >
            {signedIn ? (
              <>
                Open portal <ArrowUpRight className="size-4" />
              </>
            ) : (
              <>
                <LogIn className="size-4" /> Sign in
              </>
            )}
          </Link>
        </nav>
      </div>
    </header>
  )
}

export function SiteFooter() {
  return (
    <footer className="bg-primary text-white/70">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 md:grid-cols-[1.5fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-3">
            <img src="/ucc-crest-sm.png" alt="" className="h-12 w-auto" />
            <div>
              <p className="font-extrabold text-white">University of Cape Coast</p>
              <p className="text-xs">Directorate of Research, Innovation and Consultancy</p>
            </div>
          </div>
          <p className="mt-5 max-w-md text-sm leading-relaxed">
            DRIC supports UCC researchers and consultants from the first call for proposals to the final close-out —
            reviews, institutional support, disbursement of funds and stewardship of project assets.
          </p>
          <img src="/adinkra.png" alt="" className="mt-6 w-48 opacity-50" />
        </div>
        <div>
          <p className="eyebrow text-white/50">Contact</p>
          <ul className="mt-4 space-y-3 text-sm">
            <li className="flex items-center gap-2">
              <Mail className="size-4" />{' '}
              <a href={`mailto:${DRIC_EMAIL}`} className="hover:text-white">
                {DRIC_EMAIL}
              </a>
            </li>
            <li className="flex items-center gap-2">
              <Phone className="size-4" /> +233 (0) 3321 30614
            </li>
            <li className="flex items-start gap-2">
              <MapPin className="mt-0.5 size-4" /> University of Cape Coast, Cape Coast, Ghana
            </li>
          </ul>
        </div>
        <div>
          <p className="eyebrow text-white/50">Quick links</p>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li>
              <a href="/#forms" className="hover:text-white">
                Request forms
              </a>
            </li>
            <li>
              <Link to="/track" className="hover:text-white">
                Track a request
              </Link>
            </li>
            <li>
              <Link to="/login" className="hover:text-white">
                Staff & investigator portal
              </Link>
            </li>
            <li>
              <a href="https://ucc.edu.gh" target="_blank" rel="noreferrer" className="hover:text-white">
                ucc.edu.gh
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-5 text-center text-xs">
        © {new Date().getFullYear()} University of Cape Coast · DRIC Grants Management System
      </div>
    </footer>
  )
}
