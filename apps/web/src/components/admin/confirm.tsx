import { useCallback, useState } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { AlertDialog } from 'radix-ui'
import { Button } from '#/components/ui/button'

interface ConfirmOptions {
  title: string
  description?: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => Promise<unknown> | unknown
}

/** const { confirm, dialog } = useConfirm(); render {dialog}, call confirm({...}). */
export function useConfirm() {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null)
  const [busy, setBusy] = useState(false)
  const confirm = useCallback((o: ConfirmOptions) => setOpts(o), [])
  const dialog = (
    <AlertDialog.Root open={Boolean(opts)} onOpenChange={(o) => !o && !busy && setOpts(null)}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-white p-6 shadow-2xl data-[state=open]:animate-in data-[state=open]:zoom-in-95">
          <div className="flex gap-4">
            <div
              className={`flex size-10 shrink-0 items-center justify-center rounded-full ${opts?.danger ? 'bg-secondary text-secondary-foreground' : 'bg-primary-soft text-primary'}`}
            >
              <AlertTriangle className="size-5" />
            </div>
            <div>
              <AlertDialog.Title className="font-bold text-slate-900">{opts?.title}</AlertDialog.Title>
              <AlertDialog.Description className="mt-1 text-sm text-muted-foreground">
                {opts?.description ?? 'This cannot be undone.'}
              </AlertDialog.Description>
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <Button variant="outline" disabled={busy}>
                Cancel
              </Button>
            </AlertDialog.Cancel>
            <Button
              variant={opts?.danger ? 'destructive' : 'default'}
              disabled={busy}
              onClick={async () => {
                if (!opts) return
                setBusy(true)
                try {
                  await opts.onConfirm()
                  setOpts(null)
                } finally {
                  setBusy(false)
                }
              }}
            >
              {busy && <Loader2 className="animate-spin" />}
              {opts?.confirmLabel ?? 'Confirm'}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
  return { confirm, dialog }
}
