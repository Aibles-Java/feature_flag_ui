import type { FlagState } from '@/api/flags'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { previewValue } from '@/lib/flagValue'
import type { StateSnapshot } from './ProdGuardDialog'

interface Props {
  open: boolean
  /** What was being changed, e.g. "Synthetic flag 1 in Synthetic Dev". Plain text. */
  subject: string
  /** State reloaded from the server after the 409; null if that reload failed. */
  latest: FlagState | null
  /** The user's unsaved edits (editor only). When given, they are kept and compared with `latest`. */
  mine?: StateSnapshot
  onClose: () => void
}

const show = (v: string) => (v === '' ? '(none)' : previewValue(v, 120))

function Row({ label, latest, mine }: Readonly<{ label: string; latest: string; mine?: string }>) {
  const differs = mine !== undefined && mine !== latest
  return (
    <tr className={differs ? 'font-medium' : undefined}>
      <th scope="row" className="py-1 pr-3 text-left font-medium">{label}</th>
      <td className="py-1 pr-3 break-all">{latest}</td>
      {mine !== undefined && <td className="py-1 break-all">{mine}</td>}
    </tr>
  )
}

/**
 * The ONE conflict dialog (S-2.16, ADR-07): shown for a 409 from the matrix quick toggle, the
 * detail editor and the PROD guard. Values are rendered as text only (never HTML, 8.4).
 */
export default function StateConflictDialog({ open, subject, latest, mine, onClose }: Readonly<Props>) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg">Someone else changed this</DialogTitle>
          <DialogDescription>
            {subject} was changed by someone else after you loaded it. Your change was not saved.
          </DialogDescription>
        </DialogHeader>

        {latest ? (
          <table className="w-full text-xs" aria-label="Latest state on the server">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th scope="col" className="py-1 pr-3 font-medium"><span className="sr-only">Field</span></th>
                <th scope="col" className="py-1 pr-3 font-medium">Latest on server</th>
                {mine && <th scope="col" className="py-1 font-medium">Your edits</th>}
              </tr>
            </thead>
            <tbody>
              <Row label="Enabled" latest={String(latest.enabled)} mine={mine && String(mine.enabled)} />
              <Row label="Value" latest={show(latest.value ?? '')} mine={mine && show(mine.value)} />
              <Row label="Rollout" latest={`${latest.rolloutPercent}%`} mine={mine && `${mine.rolloutPercent}%`} />
            </tbody>
          </table>
        ) : (
          <p role="alert" className="text-sm text-destructive">
            The latest state could not be loaded. Close this and reopen to see the current values.
          </p>
        )}

        {mine && latest && (
          <p className="text-xs text-muted-foreground">
            Your edits are still in the form. Review them against the latest values, then save again to re-apply.
          </p>
        )}

        <DialogFooter>
          <Button type="button" onClick={onClose}>{mine ? 'Review my edits' : 'Got it'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
