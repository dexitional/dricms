// API calls made during SSR go straight into the Hono app in-process,
// carrying the visitor's cookies.
import { getRequestHeader } from '@tanstack/react-start/server'

export async function serverFetch(path: string, init?: RequestInit) {
  const { apiApp } = await import('./api/app')
  const headers = new Headers(init?.headers)
  try {
    const cookie = getRequestHeader('cookie')
    if (cookie) headers.set('cookie', cookie)
  } catch {
    // Outside a request: no cookies to forward.
  }
  const url = new URL(path.replace(/^\/api/, '') || '/', 'http://internal.dric')
  return apiApp.fetch(new Request(url, { ...init, headers }))
}
