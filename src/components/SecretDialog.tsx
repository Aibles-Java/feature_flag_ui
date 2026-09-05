import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Copy, Check, KeyRound, ShieldAlert } from 'lucide-react'

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
      className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors shrink-0"
      title="Copy"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  )
}

/**
 * Shows a freshly minted SDK key, once.
 *
 * The plaintext is never in list data: the backend stores keys hashed and returns the value only
 * from the endpoints that mint one. So there is no "reveal" affordance to offer anywhere else —
 * there is nothing to reveal. Dismiss this without copying and the only way back is another
 * rotation, which is why it takes a deliberate click to close.
 */
export default function SecretDialog({
  title,
  apiKey,
  onClose,
}: {
  title: string
  apiKey: string | null
  onClose: () => void
}) {
  return (
    <Dialog open={!!apiKey} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900">
            <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
            <p className="leading-snug">
              Copy this now. The backend stores it hashed, so it can never be shown again. If you
              lose it, rotate the key to mint a new one.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <KeyRound className="w-4 h-4 text-slate-400 shrink-0" />
            <code className="text-xs text-slate-700 font-mono flex-1 break-all">{apiKey}</code>
            {apiKey && <CopyButton text={apiKey} />}
          </div>
          <Button className="w-full" onClick={onClose}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
