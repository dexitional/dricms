import { useEffect, useState } from 'react'
import { Link, Outlet, createFileRoute, redirect, useNavigate, useRouterState } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import {
  Activity,
  Banknote,
  Building2,
  ChevronsUpDown,
  ExternalLink,
  FileStack,
  FolderKanban,
  HandCoins,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  UserCog,
  Users,
  X,
} from 'lucide-react'
import { cn } from '@dric/ui'
import { getSession } from '#/server/session'
import { api } from '#/lib/api-client'
import { ROLE_LABELS } from '#/lib/labels'
import { can } from '#/lib/permissions'
import type { Module } from '#/lib/permissions'
import { Dropdown, DropdownContent, DropdownItem, DropdownSeparator, DropdownTrigger } from '#/components/ui/dropdown'
import { Avatar } from '#/components/admin/page'

export const Route = createFileRoute('/admin')({
  beforeLoad: async ({ location }) => {
    const user = await getSession()
    if (!user) throw redirect({ to: '/login', search: { next: location.href } })
    return { user }
  },
  head: () => ({ meta: [{ title: 'DRIC Grants Portal' }, { name: 'robots', content: 'noindex' }] }),
  component: AdminLayout,
})

type NavItem = {
  to: string
  label: string
  staffLabel?: string
  icon: typeof LayoutDashboard
  module: Module
  exact?: boolean
}

const NAV: Array<{ heading: string; items: Array<NavItem> }> = [
  {
    heading: 'Overview',
    items: [{ to: '/admin', label: 'Dashboard', icon: LayoutDashboard, module: 'dashboard', exact: true }],
  },
  {
    heading: 'Grants',
    items: [
      { to: '/admin/projects', label: 'Projects', icon: FolderKanban, module: 'projects' },
      { to: '/admin/funders', label: 'Funders', icon: Building2, module: 'funders' },
      { to: '/admin/requests', label: 'Form requests', icon: FileStack, module: 'requests' },
    ],
  },
  {
    heading: 'Finance',
    items: [
      { to: '/admin/claims', label: 'Claims', icon: HandCoins, module: 'claims' },
      { to: '/admin/payments', label: 'Payments', icon: Banknote, module: 'payments' },
    ],
  },
  {
    heading: 'People',
    items: [
      { to: '/admin/investigators', label: 'Investigators', icon: Users, module: 'investigators' },
      { to: '/admin/personnel', label: 'Personnel', icon: UserCog, module: 'personnel' },
    ],
  },
  {
    heading: 'System',
    items: [
      { to: '/admin/users', label: 'User accounts', icon: ShieldCheck, module: 'users' },
      { to: '/admin/activity', label: 'Activity log', icon: Activity, module: 'audit' },
    ],
  },
]

const INVESTIGATOR_LABELS: Record<string, string> = {
  '/admin/projects': 'My projects',
  '/admin/claims': 'My claims',
  '/admin/requests': 'My requests',
}

function AdminLayout() {
  const { user } = Route.useRouteContext()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const [mobileOpen, setMobileOpen] = useState(false)
  useEffect(() => setMobileOpen(false), [pathname])

  const logout = async () => {
    await api.post('/auth/logout')
    queryClient.clear()
    await navigate({ to: '/login' })
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      <Link to="/admin" className="flex items-center gap-2.5 px-3 pt-1 pb-4">
        <img src="/ucc-crest-sm.png" alt="" className="h-9 w-auto" />
        <div className="leading-tight">
          <p className="text-[0.95rem] font-extrabold tracking-tight text-primary">DRIC Grants</p>
          <p className="text-[0.68rem] font-medium text-muted-foreground">University of Cape Coast</p>
        </div>
      </Link>

      <div className="mb-3 flex items-center gap-2.5 rounded-full border border-border bg-white py-1.5 pr-3 pl-1.5 shadow-xs">
        <Avatar name={user.fullName} className="size-7" />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-xs font-semibold text-slate-800">{user.fullName}</p>
          <p className="text-[0.68rem] text-muted-foreground">{ROLE_LABELS[user.role]}</p>
        </div>
      </div>

      <nav className="no-scrollbar -mx-1 flex-1 overflow-y-auto px-1" aria-label="Portal">
        {NAV.map((group) => {
          const items = group.items.filter((i) => can(user.role, i.module))
          if (!items.length) return null
          return (
            <div key={group.heading} className="mb-3">
              <p className="eyebrow px-3 py-2">{group.heading}</p>
              <ul className="space-y-0.5">
                {items.map((item) => (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      activeOptions={{ exact: item.exact ?? false }}
                      className="group flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-white/70 hover:text-slate-900 [&.active]:bg-white [&.active]:font-semibold [&.active]:text-primary [&.active]:shadow-[0_1px_2px_rgb(15_23_42/0.06),0_0_0_1px_var(--border)]"
                    >
                      <item.icon className="size-4 text-slate-400 group-[.active]:text-secondary-foreground" />
                      {user.role === 'investigator' ? (INVESTIGATOR_LABELS[item.to] ?? item.label) : item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </nav>

      <div className="border-t border-border/70 pt-3">
        <a
          href="/#forms"
          target="_blank"
          rel="noreferrer"
          className="mb-1 flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-slate-600 hover:bg-white/70"
        >
          <ExternalLink className="size-4 text-slate-400" /> DRIC forms site
        </a>
        <Dropdown>
          <DropdownTrigger className="flex w-full items-center gap-2.5 rounded-full p-2 text-left hover:bg-white/70 data-[state=open]:bg-white/70">
            <Avatar name={user.fullName} className="size-7" />
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{user.email}</span>
            <ChevronsUpDown className="size-4 text-slate-400" />
          </DropdownTrigger>
          <DropdownContent align="start" side="top" className="w-56">
            <DropdownItem onSelect={() => navigate({ to: '/admin/account' })}>
              <KeyRound /> Change password
            </DropdownItem>
            <DropdownSeparator />
            <DropdownItem danger onSelect={() => void logout()}>
              <LogOut /> Sign out
            </DropdownItem>
          </DropdownContent>
        </Dropdown>
      </div>
    </div>
  )

  return (
    <div className="flex h-dvh overflow-hidden bg-canvas p-3 max-lg:block max-lg:h-auto max-lg:min-h-dvh max-lg:overflow-visible max-lg:p-0">
      <aside className="w-64 shrink-0 pr-3 max-lg:hidden">{sidebar}</aside>

      <header className="sticky top-0 z-40 flex items-center justify-between border-b bg-canvas/90 px-4 py-3 backdrop-blur lg:hidden">
        <Link to="/admin" className="flex items-center gap-2">
          <img src="/ucc-crest-sm.png" alt="" className="h-8 w-auto" />
          <span className="font-extrabold text-primary">DRIC Grants</span>
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="rounded-full bg-white p-2.5 shadow-xs"
          aria-label="Open menu"
        >
          <Menu className="size-4" />
        </button>
      </header>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/40"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          />
          <div className="relative h-full w-72 bg-canvas p-3 animate-in duration-200 slide-in-from-left">
            {sidebar}
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 -right-12 rounded-full bg-white p-2"
              aria-label="Close menu"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>
      )}

      <div
        className={cn(
          'flex min-w-0 flex-1 flex-col overflow-clip rounded-2xl border border-border bg-white shadow-sm',
          'max-lg:min-h-[calc(100dvh-62px)] max-lg:rounded-none max-lg:border-0 max-lg:shadow-none',
        )}
      >
        <div
          className="flex flex-1 flex-col overflow-y-auto overscroll-y-contain max-lg:overflow-visible"
          style={{ scrollbarGutter: 'stable' }}
        >
          <main className="mx-auto flex w-full max-w-screen-xl flex-1 flex-col p-6 max-md:px-4">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
