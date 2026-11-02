const API_URL = '/api'

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

function toQueryString(query?: object) {
  if (!query) return ''
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue
    params.set(key, String(value))
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const isForm = init?.body instanceof FormData
  const options: RequestInit = {
    ...init,
    credentials: 'include',
    headers: isForm ? init?.headers : { 'Content-Type': 'application/json', ...init?.headers },
  }
  // During SSR there's no origin to fetch from; call the API in-process.
  const res = import.meta.env.SSR
    ? await (await import('#/server/internal-fetch')).serverFetch(`${API_URL}${path}`, options)
    : await fetch(`${API_URL}${path}`, options)
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    throw new ApiError(body.error ?? 'Request failed', res.status)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const api = {
  get: <T>(path: string, query?: object) => request<T>(`${path}${toQueryString(query)}`),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  upload: <T>(path: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    return request<T>(path, { method: 'POST', body: form })
  },
}

export function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : 'Something went wrong. Please try again.'
}

export interface Page<T> {
  data: Array<T>
  total: number
  page: number
  pageSize: number
}

export interface Option {
  value: number
  label: string
  hint?: string | null
  [key: string]: unknown
}
