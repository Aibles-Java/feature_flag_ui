import { ShieldAlert, AlertCircle } from 'lucide-react'
import { problemMessage, isForbidden } from '@/api/problem'
import { cn } from '@/lib/utils'

/**
 * Renders a failed request using the backend's own explanation.
 *
 * The ABAC screens lean on this heavily. There is no endpoint exposing the caller's effective
 * action set, so the UI cannot grey out what the user may not do — it offers every control and
 * reports the refusal. That makes the wording of the refusal the entire feedback loop, which is
 * why the backend's `detail` is shown verbatim instead of a generic "something went wrong".
 */
export default function ApiError({ error, className }: { error: unknown; className?: string }) {
  if (!error) return null
  const forbidden = isForbidden(error)
  const Icon = forbidden ? ShieldAlert : AlertCircle

  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm',
        forbidden
          ? 'border-amber-200 bg-amber-50 text-amber-900'
          : 'border-red-200 bg-red-50 text-red-900',
        className
      )}
    >
      <Icon className={cn('w-4 h-4 mt-0.5 shrink-0', forbidden ? 'text-amber-500' : 'text-red-500')} />
      <div className="min-w-0">
        {forbidden && <p className="font-semibold leading-tight">Not permitted</p>}
        <p className="leading-snug break-words">{problemMessage(error)}</p>
      </div>
    </div>
  )
}
