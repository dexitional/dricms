import { HeadContent, Link, Scripts, createRootRouteWithContext } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import appCss from '../styles.css?url'

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'DRIC Grants — University of Cape Coast' },
      {
        name: 'description',
        content:
          'Grant and consultancy management for the Directorate of Research, Innovation and Consultancy (DRIC), University of Cape Coast.',
      },
      { name: 'theme-color', content: '#172554' },
    ],
    links: [
      { rel: 'icon', href: '/favicon.ico' },
      { rel: 'apple-touch-icon', href: '/ucc-crest-sm.png' },
      { rel: 'stylesheet', href: appCss },
    ],
  }),
  shellComponent: RootDocument,
  notFoundComponent: NotFound,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Toaster richColors position="top-right" closeButton />
        <Scripts />
      </body>
    </html>
  )
}

function NotFound() {
  return (
    <div className="grid min-h-[70vh] place-items-center px-6 text-center">
      <div>
        <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase">Error 404</p>
        <h1 className="mt-2 text-3xl font-extrabold text-primary">Page not found</h1>
        <p className="mt-2 text-muted-foreground">The page you are looking for doesn’t exist or has moved.</p>
        <Link to="/" className="mt-6 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white">
          Back to home
        </Link>
      </div>
    </div>
  )
}
