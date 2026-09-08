import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ShieldAlert, AlertCircle } from 'lucide-react'
import { problemMessage, isForbidden } from '@/api/problem'

/**
 * Modal for a failed action, used where there is no form to host an inline banner.
 *
 * A refusal on an inline control (a flag toggle in a table row) has nowhere good to go: text
 * beside the control is cramped, and repeats once per row when several are tried. A dialog says
 * it once, clearly, and makes the user acknowledge it.
 *
 * Pass `mutation.error` and `mutation.reset` — resetting is what closes it, so the next attempt
 * starts clean.
 */
export default function ErrorDialog({
  error,
  onClose,
}: {
  error: unknown
  onClose: () => void
}) {
  const forbidden = isForbidden(error)
  const Icon = forbidden ? ShieldAlert : AlertCircle

  return (
    <Dialog open={!!error} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className={forbidden ? 'w-5 h-5 text-amber-500' : 'w-5 h-5 text-red-500'} />
            {forbidden ? 'Not permitted' : 'Something went wrong'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <p className="text-sm text-slate-700 leading-relaxed">{problemMessage(error)}</p>

          {forbidden && (
            // One line, not a lecture. The backend's own message already says which rule was
            // hit (a missing action, a production-elevated one, a change window); all this adds
            // is who can fix it.
            <p className="text-xs text-slate-400">An OWNER or ADMIN can grant you access.</p>
          )}

          <Button className="w-full" onClick={onClose}>
            Got it
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
