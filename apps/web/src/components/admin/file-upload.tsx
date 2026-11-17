import { useRef, useState } from 'react'
import { Camera, FileText, Loader2, Paperclip, Trash2, UploadCloud, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@dric/ui'
import { api, errorMessage } from '#/lib/api-client'
import { fileSize } from '#/lib/format'

export interface UploadedFile {
  url: string
  name: string
  size: number
  type: string
}

function useUploader(endpoint: string) {
  const [busy, setBusy] = useState(false)
  const upload = async (file: File) => {
    setBusy(true)
    try {
      return await api.upload<UploadedFile>(endpoint, file)
    } catch (err) {
      toast.error(errorMessage(err))
      return null
    } finally {
      setBusy(false)
    }
  }
  return { busy, upload }
}

/** A single document (project contract, budget). */
export function FileField({
  value,
  onChange,
  accept = '.pdf,.doc,.docx',
  endpoint = '/files',
}: {
  value: { url: string | null; name: string | null }
  onChange: (value: { url: string | null; name: string | null }) => void
  accept?: string
  endpoint?: string
}) {
  const input = useRef<HTMLInputElement>(null)
  const { busy, upload } = useUploader(endpoint)
  return (
    <div className="flex items-center gap-3 rounded-xl border border-dashed border-border-strong bg-slate-50/60 p-3">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white text-primary shadow-xs">
        {busy ? <Loader2 className="size-5 animate-spin" /> : <FileText className="size-5" />}
      </div>
      <div className="min-w-0 flex-1">
        {value.url ? (
          <a
            href={value.url}
            target="_blank"
            rel="noreferrer"
            className="block truncate text-sm font-medium text-primary hover:underline"
          >
            {value.name ?? 'Document'}
          </a>
        ) : (
          <p className="text-sm text-muted-foreground">PDF or Word document, up to 10 MB</p>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept={accept}
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (!file) return
          const stored = await upload(file)
          if (stored) onChange({ url: stored.url, name: stored.name })
        }}
      />
      {value.url && (
        <button
          type="button"
          onClick={() => onChange({ url: null, name: null })}
          className="rounded-full p-1.5 text-muted-foreground hover:bg-white"
          aria-label="Remove file"
        >
          <X className="size-4" />
        </button>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() => input.current?.click()}
        className="rounded-full border bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:border-primary/30"
      >
        {value.url ? 'Replace' : 'Upload'}
      </button>
    </div>
  )
}

/** Several attachments (request forms). */
export function AttachmentsField({
  value,
  onChange,
  endpoint = '/public/uploads',
  max = 10,
}: {
  value: Array<UploadedFile>
  onChange: (value: Array<UploadedFile>) => void
  endpoint?: string
  max?: number
}) {
  const input = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const { busy, upload } = useUploader(endpoint)
  const addFiles = async (files: FileList | null) => {
    if (!files) return
    let next = [...value]
    for (const file of Array.from(files).slice(0, max - next.length)) {
      const stored = await upload(file)
      if (stored) next = [...next, stored]
      onChange(next)
    }
  }
  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={busy || value.length >= max}
        onClick={() => input.current?.click()}
        onDragOver={(e) => (e.preventDefault(), setDragging(true))}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          void addFiles(e.dataTransfer.files)
        }}
        className={cn(
          'flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-colors',
          dragging
            ? 'border-primary bg-primary-soft'
            : 'border-border-strong bg-slate-50/60 hover:border-primary/40 hover:bg-primary-soft/40',
        )}
      >
        <span className="flex size-11 items-center justify-center rounded-full bg-white text-primary shadow-sm">
          {busy ? <Loader2 className="size-5 animate-spin" /> : <UploadCloud className="size-5" />}
        </span>
        <span className="text-sm font-semibold text-slate-800">
          {busy ? 'Uploading…' : 'Drop files here or click to browse'}
        </span>
        <span className="text-xs text-muted-foreground">
          PDF, Word, Excel, JPG or PNG · up to 10 MB each · {max} files max
        </span>
      </button>
      <input
        ref={input}
        type="file"
        multiple
        hidden
        accept=".pdf,.doc,.docx,.xlsx,.jpg,.jpeg,.png"
        onChange={(e) => (void addFiles(e.target.files), (e.target.value = ''))}
      />
      {value.length > 0 && (
        <ul className="divide-y rounded-xl border bg-white">
          {value.map((f, i) => (
            <li key={f.url} className="flex items-center gap-3 px-3 py-2.5 text-sm">
              <Paperclip className="size-4 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              <span className="text-xs text-muted-foreground">{fileSize(f.size)}</span>
              <button
                type="button"
                onClick={() => onChange(value.filter((_, j) => j !== i))}
                className="rounded-full p-1 text-muted-foreground hover:bg-accent"
                aria-label={`Remove ${f.name}`}
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Uploaded files, read-only, each opening in a new tab. */
export function AttachmentList({
  files,
  empty = 'No documents attached.',
  className,
}: {
  files: Array<UploadedFile> | null | undefined
  empty?: string
  className?: string
}) {
  if (!files?.length) return <p className={cn('text-sm text-muted-foreground', className)}>{empty}</p>
  return (
    <ul className={cn('divide-y rounded-xl border bg-white', className)}>
      {files.map((f) => (
        <li key={f.url}>
          <a
            href={`${f.url}?name=${encodeURIComponent(f.name)}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-slate-50"
          >
            <Paperclip className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate font-medium text-primary">{f.name}</span>
            <span className="shrink-0 text-xs text-muted-foreground">{fileSize(f.size)}</span>
          </a>
        </li>
      ))}
    </ul>
  )
}

// Shrinks a photo to at most 512px on its longer side and re-encodes it as
// WebP (JPEG where WebP is unsupported), so uploads stay small and sharp.
async function shrinkPhoto(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.86))
  if (blob?.type === 'image/webp') return new File([blob], 'photo.webp', { type: 'image/webp' })
  const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88))
  if (!jpeg) throw new Error('This photo could not be read.')
  return new File([jpeg], 'photo.jpg', { type: 'image/jpeg' })
}

/** A profile photo with upload and remove, shown as a round preview. */
export function PhotoField({
  value,
  onChange,
  preview,
}: {
  value: string | null
  onChange: (url: string | null) => void
  // What shows when there is no uploaded photo (initials or the UCC photo).
  preview: React.ReactNode
}) {
  const input = useRef<HTMLInputElement>(null)
  const { busy, upload } = useUploader('/files/photos')
  const pick = async (file?: File) => {
    if (!file) return
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      toast.error('Choose a JPG, PNG or WebP photo.')
      return
    }
    try {
      const saved = await upload(await shrinkPhoto(file))
      if (saved) onChange(saved.url)
    } catch {
      toast.error('This photo could not be read. Try another one.')
    }
  }
  return (
    <div className="flex items-center gap-4">
      <div className="relative">
        {preview}
        {busy && (
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-white/70">
            <Loader2 className="size-5 animate-spin text-primary" />
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-xl border bg-white px-3 py-2 text-sm font-medium text-primary hover:bg-primary-soft disabled:opacity-60"
        >
          <Camera className="size-4" /> {value ? 'Change photo' : 'Upload photo'}
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-xl border bg-white px-3 py-2 text-sm font-medium text-destructive hover:bg-secondary disabled:opacity-60"
          >
            <Trash2 className="size-4" /> Remove
          </button>
        )}
        <p className="w-full text-xs text-muted-foreground">
          JPG, PNG or WebP. Without one, the UCC staff photo is used when there is a staff number.
        </p>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          void pick(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </div>
  )
}
