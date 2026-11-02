import { useRef, useState } from 'react'
import { FileText, Loader2, Paperclip, UploadCloud, X } from 'lucide-react'
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
