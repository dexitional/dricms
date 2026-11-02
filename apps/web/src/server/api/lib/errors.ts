import type { ErrorHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'

export class AppError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 401 | 403 | 404 | 409 | 413 | 415 | 422 | 423 | 429 = 400,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export const notFound = (what: string) => new AppError(`${what} not found.`, 404)

export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof HTTPException) return err.getResponse()
  if (err instanceof AppError) return c.json({ error: err.message }, err.status)
  const code = (err as { code?: string }).code
  if (code === 'ER_ROW_IS_REFERENCED_2' || code === 'ER_ROW_IS_REFERENCED') {
    return c.json({ error: 'This record is in use elsewhere and cannot be deleted.' }, 409)
  }
  if (code === 'ER_DUP_ENTRY') return c.json({ error: 'A record with these details already exists.' }, 409)
  if (code === 'ER_NO_REFERENCED_ROW_2') return c.json({ error: 'A linked record no longer exists.' }, 422)
  console.error(err)
  if (code === 'ECONNREFUSED') {
    return c.json(
      { error: 'Could not reach the database. Check that MySQL is running and DATABASE_URL is correct.' },
      503,
    )
  }
  return c.json({ error: 'Internal server error' }, 500)
}
