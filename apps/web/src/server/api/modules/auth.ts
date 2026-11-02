//   POST /api/auth/login | /logout      GET /api/auth/me
//   POST /api/auth/password             (signed in: change own password)
import bcrypt from 'bcryptjs'
import { Hono } from 'hono'
import { deleteCookie, setCookie } from 'hono/cookie'
import { changePasswordSchema, loginSchema } from '#/lib/schemas'
import { SESSION_COOKIE, SESSION_TTL_SECONDS } from '#/server/session'
import { signSessionToken } from '#/server/session-core'
import { requireUser, sessionUser } from '../lib/auth'
import { audit } from '../lib/audit'
import { exec, one } from '../lib/db'
import { AppError } from '../lib/errors'
import { rateLimit } from '../lib/rate-limit'
import { validate } from '../lib/validate'

const MAX_ATTEMPTS = 5
const LOCK_MINUTES = 15
// Compared against when the email is unknown, so timing doesn't reveal which
// emails have accounts.
let dummyHash: string | null = null
const getDummyHash = () => (dummyHash ??= bcrypt.hashSync('not-a-real-password', 12))

export const authRoute = new Hono()
  .post('/login', rateLimit('login', 20, 300), validate('json', loginSchema), async (c) => {
    const { email, password } = c.req.valid('json')
    const user = await one<{
      id: number
      passwordHash: string
      isActive: number
      failedLoginAttempts: number
      lockedUntil: string | null
    }>('SELECT id, password_hash, is_active, failed_login_attempts, locked_until FROM users WHERE email = ?', [email])
    const ok = await bcrypt.compare(password, user?.passwordHash ?? getDummyHash())
    if (!user || !user.isActive) throw new AppError('Incorrect email or password.', 401)
    if (user.lockedUntil && new Date(user.lockedUntil.replace(' ', 'T')) > new Date()) {
      throw new AppError(`Too many failed attempts. Try again in ${LOCK_MINUTES} minutes.`, 423)
    }
    if (!ok) {
      const attempts = user.failedLoginAttempts + 1
      await exec(
        `UPDATE users SET failed_login_attempts = ?, locked_until = IF(? >= ?, NOW() + INTERVAL ? MINUTE, NULL) WHERE id = ?`,
        [attempts >= MAX_ATTEMPTS ? 0 : attempts, attempts, MAX_ATTEMPTS, LOCK_MINUTES, user.id],
      )
      throw new AppError('Incorrect email or password.', 401)
    }
    await exec('UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = NOW() WHERE id = ?', [
      user.id,
    ])
    setCookie(c, SESSION_COOKIE, await signSessionToken(user.id), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      path: '/',
      maxAge: SESSION_TTL_SECONDS,
    })
    return c.json({ ok: true })
  })
  .post('/logout', (c) => {
    deleteCookie(c, SESSION_COOKIE, { path: '/' })
    return c.json({ ok: true })
  })
  .get('/me', async (c) => {
    const user = await sessionUser(c)
    if (!user) return c.json({ user: null })
    // Investigators get their particulars, used to pre-fill the request forms.
    const profile = user.investigatorId
      ? await one(
          `SELECT title, first_name, middle_name, last_name, email, phone, college, faculty, department, designation
             FROM investigators WHERE id = ?`,
          [user.investigatorId],
        )
      : null
    return c.json({ user, profile })
  })
  .post('/password', requireUser, validate('json', changePasswordSchema), async (c) => {
    const me = c.get('user')
    const { currentPassword, newPassword } = c.req.valid('json')
    const row = await one<{ passwordHash: string }>('SELECT password_hash FROM users WHERE id = ?', [me.id])
    if (!row || !(await bcrypt.compare(currentPassword, row.passwordHash))) {
      throw new AppError('Your current password is incorrect.', 422)
    }
    await exec('UPDATE users SET password_hash = ? WHERE id = ?', [await bcrypt.hash(newPassword, 12), me.id])
    audit(me, 'update', 'user', me.id, 'Changed own password')
    return c.json({ ok: true })
  })
