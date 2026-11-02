import 'dotenv/config'
import bcrypt from 'bcryptjs'
import mysql from 'mysql2/promise'

// Region codes ICU knows that aren't countries or territories.
const NOT_COUNTRIES = new Set(['EU', 'EZ', 'UN', 'QO', 'XA', 'XB', 'ZZ', 'AC', 'CP', 'DG', 'EA', 'IC', 'TA', 'CQ'])

// Every ISO 3166-1 alpha-2 country, named from the runtime's ICU data so the
// list never has to be maintained by hand.
function countries(): Array<[string, string]> {
  const names = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' })
  const out: Array<[string, string]> = []
  for (let a = 65; a <= 90; a++) {
    for (let b = 65; b <= 90; b++) {
      const code = String.fromCharCode(a, b)
      if (NOT_COUNTRIES.has(code)) continue
      const name = names.of(code)
      if (name && name !== code) out.push([code, name])
    }
  }
  return out
}

async function main() {
  const { DATABASE_URL, SEED_ADMIN_NAME, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD } = process.env
  if (!DATABASE_URL) throw new Error('DATABASE_URL is not set.')
  if (!SEED_ADMIN_EMAIL || !SEED_ADMIN_PASSWORD) {
    throw new Error('SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set in the environment.')
  }
  const connection = await mysql.createConnection({ uri: DATABASE_URL })

  const list = countries()
  await connection.query('INSERT INTO countries (code, name) VALUES ? ON DUPLICATE KEY UPDATE name = VALUES(name)', [
    list,
  ])
  console.log(`Seeded ${list.length} countries.`)

  // Idempotent: re-running after changing SEED_ADMIN_PASSWORD rotates the
  // administrator's password instead of erroring on the duplicate email.
  const passwordHash = await bcrypt.hash(SEED_ADMIN_PASSWORD, 12)
  await connection.query(
    `INSERT INTO users (full_name, email, role, password_hash)
     VALUES (?, ?, 'administrator', ?)
     ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), role = 'administrator',
       is_active = 1, failed_login_attempts = 0, locked_until = NULL`,
    [SEED_ADMIN_NAME ?? 'DRIC Administrator', SEED_ADMIN_EMAIL.toLowerCase(), passwordHash],
  )
  console.log(`Seeded administrator: ${SEED_ADMIN_EMAIL}`)
  await connection.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
