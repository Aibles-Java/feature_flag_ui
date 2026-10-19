import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface Props {
  open: boolean
  flagName: string
  /** Omitted when the page does not know the environment's name (legacy env route). */
  envName?: string
  /** The value the click asks for: true = enable, false = disable. */
  nextEnabled: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Confirmation before a one-click enable/disable (the flag-list pill and the matrix quick toggle),
 * in EVERY environment, not just PRODUCTION: a quick toggle takes effect for SDKs immediately, so a
 * stray click must not be enough. Names are rendered as text only (never HTML).
 *
 * Confirming only closes the dialog and starts the write; progress, refusals (403) and conflicts
 * (409) keep going through the caller's existing pending state, ErrorDialog and StateConflictDialog.
 */
export default function ToggleConfirmDialog({ open, flagName, envName, nextEnabled, onConfirm, onCancel }: Readonly<Props>) {
  const action = nextEnabled ? 'Enable' : 'Disable'
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-lg">{action} flag?</DialogTitle>
          <DialogDescription>
            {nextEnabled ? 'Turn on ' : 'Turn off '}
            <span className="font-semibold text-foreground">{flagName}</span>
            {envName && <> in <span className="font-semibold text-foreground">{envName}</span></>}? The change
            applies to SDK clients right away.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
          <Button type="button" variant={nextEnabled ? 'default' : 'destructive'} onClick={onConfirm}>{action}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
