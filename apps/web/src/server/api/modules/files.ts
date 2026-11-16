//   POST /api/files            (signed in) upload a project document
//   POST /api/files/photos     (signed in) upload a profile photo (JPG, PNG or WebP)
//   GET  /api/files/YYYY/MM/x  (signed in) download a stored document
import { Hono } from 'hono'
import { requireUser } from '../lib/auth'
import { AppError } from '../lib/errors'
import { ATTACHMENT_EXTENSIONS, MAX_PHOTO_BYTES, PHOTO_EXTENSIONS, readStored, saveUpload } from '../lib/storage'

export const filesRoute = new Hono()
  .post('/', requireUser, async (c) => {
    const body = await c.req.parseBody()
    const file = body.file
    if (!(file instanceof File)) throw new AppError('Choose a file to upload.', 422)
    return c.json(await saveUpload(file, ATTACHMENT_EXTENSIONS), 201)
  })
  .post('/photos', requireUser, async (c) => {
    const body = await c.req.parseBody()
    const file = body.file
    if (!(file instanceof File)) throw new AppError('Choose a photo to upload.', 422)
    return c.json(await saveUpload(file, PHOTO_EXTENSIONS, MAX_PHOTO_BYTES), 201)
  })
  .get('/*', requireUser, async (c) => {
    const relative = c.req.path.replace(/^.*?\/files\//, '')
    const stored = await readStored(relative)
    if (!stored) throw new AppError('File not found.', 404)
    const name = c.req.query('name')?.replace(/[^\w.\- ()]/g, '_') ?? relative.split('/').pop()!
    const inline = stored.mime === 'application/pdf' || stored.mime.startsWith('image/')
    return c.body(new Uint8Array(stored.data), 200, {
      'content-type': stored.mime,
      'content-disposition': `${inline ? 'inline' : 'attachment'}; filename="${name}"`,
      'x-content-type-options': 'nosniff',
      'cache-control': 'private, max-age=3600',
    })
  })
