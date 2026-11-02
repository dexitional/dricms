import { randomBytes } from 'node:crypto'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { AppError } from './errors'

// Uploaded documents (contracts, budgets, request attachments) live on local
// disk under STORAGE_DIR and are served only to signed-in users through
// GET /api/files/... (modules/files.ts).
export function storageRoot() {
  return path.resolve(process.env.STORAGE_DIR || path.join(process.cwd(), 'storage'))
}

const TYPES: Record<string, { mime: string; magic: (b: Buffer) => boolean }> = {
  pdf: { mime: 'application/pdf', magic: (b) => b.subarray(0, 5).toString() === '%PDF-' },
  // .docx/.xlsx are zip containers.
  docx: {
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    magic: (b) => b[0] === 0x50 && b[1] === 0x4b,
  },
  xlsx: {
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    magic: (b) => b[0] === 0x50 && b[1] === 0x4b,
  },
  doc: { mime: 'application/msword', magic: (b) => b.readUInt32BE(0) === 0xd0cf11e0 },
  jpg: { mime: 'image/jpeg', magic: (b) => b[0] === 0xff && b[1] === 0xd8 },
  jpeg: { mime: 'image/jpeg', magic: (b) => b[0] === 0xff && b[1] === 0xd8 },
  png: { mime: 'image/png', magic: (b) => b.readUInt32BE(0) === 0x89504e47 },
}

export const DOCUMENT_EXTENSIONS = ['pdf', 'doc', 'docx']
export const ATTACHMENT_EXTENSIONS = ['pdf', 'doc', 'docx', 'xlsx', 'jpg', 'jpeg', 'png']
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

export interface StoredFile {
  url: string
  name: string
  size: number
  type: string
}

export async function saveUpload(file: File, allowed: Array<string>): Promise<StoredFile> {
  const ext = (file.name.split('.').pop() ?? '').toLowerCase()
  const kind = TYPES[ext]
  if (!kind || !allowed.includes(ext)) {
    throw new AppError(`Only ${allowed.map((e) => e.toUpperCase()).join(', ')} files can be uploaded.`, 415)
  }
  if (file.size > MAX_UPLOAD_BYTES) throw new AppError('Files must be 10 MB or smaller.', 413)
  const buffer = Buffer.from(await file.arrayBuffer())
  if (buffer.length < 4 || !kind.magic(buffer))
    throw new AppError('The file does not look like a valid ' + ext.toUpperCase() + '.', 415)

  const now = new Date()
  const dir = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`
  const filename = `${randomBytes(12).toString('hex')}.${ext === 'jpeg' ? 'jpg' : ext}`
  await mkdir(path.join(storageRoot(), dir), { recursive: true })
  await writeFile(path.join(storageRoot(), dir, filename), buffer)
  const name = file.name.replace(/[^\w.\- ()]/g, '_').slice(0, 200)
  return { url: `/api/files/${dir}/${filename}`, name, size: buffer.length, type: kind.mime }
}

export async function readStored(relative: string): Promise<{ data: Buffer; mime: string } | null> {
  // Only our own generated names: YYYY/MM/<hex>.<ext>
  if (!/^\d{4}\/\d{2}\/[a-f0-9]{24}\.[a-z]{3,4}$/.test(relative)) return null
  const full = path.join(storageRoot(), relative)
  const info = await stat(full).catch(() => null)
  if (!info?.isFile()) return null
  const ext = relative.split('.').pop() ?? ''
  return { data: await readFile(full), mime: TYPES[ext]?.mime ?? 'application/octet-stream' }
}
