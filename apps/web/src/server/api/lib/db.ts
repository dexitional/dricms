// Thin helpers over mysql2. Rows come back with camelCase keys; insert() and
// update() take camelCase objects (always zod-parsed, so keys are trusted
// schema keys, never user-supplied) and write snake_case columns.
import { getPool } from '@dric/db'
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise'

type Conn = Pool | PoolConnection
export type Row = Record<string, any>

const toCamel = (key: string) => key.replace(/_([a-z0-9])/g, (_, ch: string) => ch.toUpperCase())
export const toSnake = (key: string) => key.replace(/[A-Z]/g, (ch) => `_${ch.toLowerCase()}`)

export function camel<T = Row>(row: RowDataPacket | Row): T {
  const out: Row = {}
  for (const [key, value] of Object.entries(row)) out[toCamel(key)] = value
  return out as T
}

export async function rows<T = Row>(
  sql: string,
  params: Array<unknown> = [],
  conn: Conn = getPool(),
): Promise<Array<T>> {
  const [result] = await conn.query<Array<RowDataPacket>>(sql, params)
  return result.map((r) => camel<T>(r))
}

export async function one<T = Row>(
  sql: string,
  params: Array<unknown> = [],
  conn: Conn = getPool(),
): Promise<T | null> {
  return (await rows<T>(sql, params, conn))[0] ?? null
}

export async function scalar<T = number>(sql: string, params: Array<unknown> = [], conn: Conn = getPool()): Promise<T> {
  const [result] = await conn.query<Array<RowDataPacket>>(sql, params)
  const first = result[0]
  return (first ? Object.values(first)[0] : null) as T
}

export async function exec(sql: string, params: Array<unknown> = [], conn: Conn = getPool()) {
  const [result] = await conn.query<ResultSetHeader>(sql, params)
  return result
}

function columns(data: Row) {
  const entries = Object.entries(data).filter(([, v]) => v !== undefined)
  return { cols: entries.map(([k]) => `\`${toSnake(k)}\``), values: entries.map(([, v]) => v) }
}

export async function insert(table: string, data: Row, conn: Conn = getPool()): Promise<number> {
  const { cols, values } = columns(data)
  const result = await exec(
    `INSERT INTO \`${table}\` (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
    values,
    conn,
  )
  return result.insertId
}

export async function update(table: string, id: number, data: Row, conn: Conn = getPool(), idColumn = 'id') {
  const { cols, values } = columns(data)
  if (!cols.length) return 0
  const result = await exec(
    `UPDATE \`${table}\` SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE \`${idColumn}\` = ?`,
    [...values, id],
    conn,
  )
  return result.affectedRows
}

export async function withTransaction<T>(fn: (conn: PoolConnection) => Promise<T>): Promise<T> {
  const conn = await getPool().getConnection()
  try {
    await conn.beginTransaction()
    const result = await fn(conn)
    await conn.commit()
    return result
  } catch (err) {
    await conn.rollback().catch(() => undefined)
    throw err
  } finally {
    conn.release()
  }
}

/** Builds LIMIT/OFFSET from ?page=&pageSize= query values. */
export function paging(query: Record<string, string | undefined>, defaultSize = 20) {
  const page = Math.max(1, Number(query.page) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || defaultSize))
  return { page, pageSize, limit: pageSize, offset: (page - 1) * pageSize }
}

/** "%term%" for LIKE, with LIKE wildcards in the term escaped. */
export const like = (term: string) => `%${term.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`

export function parseId(value: string | undefined): number {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : 0
}
