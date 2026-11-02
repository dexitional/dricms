import 'dotenv/config'
import mysql from 'mysql2/promise'

// Creates the database named in DATABASE_URL if it doesn't exist yet.
async function main() {
  const uri = process.env.DATABASE_URL
  if (!uri) throw new Error('DATABASE_URL is not set.')
  const url = new URL(uri)
  const name = decodeURIComponent(url.pathname.replace(/^\//, ''))
  if (!/^[A-Za-z0-9_]+$/.test(name)) throw new Error(`Unsupported database name "${name}".`)
  url.pathname = '/'
  const connection = await mysql.createConnection({ uri: url.toString() })
  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`)
  console.log(`Database "${name}" is ready.`)
  await connection.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
