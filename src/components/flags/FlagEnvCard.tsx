import { Lock, Pencil } from 'lucide-react'
import type { FlagState } from '@/api/flags'
import type { EnvironmentWindow } from '@/api/flagEnvironments'
import { Button } from '@/components/ui/button'
import { previewValue } from '@/lib/flagValue'

interface Props {
  env: EnvironmentWindow
  state: FlagState | undefined
  onEdit: () => void
}

/**
 * One environment's state of a flag. `state.value` is user input and is rendered strictly as a
 * React text node (never HTML) - see the XSS test and 8.4. A missing state is shown as
 * "Not configured" (F11) with no way to create it from here.
 */
export default function FlagEnvCard({ env, state, onEdit }: Readonly<Props>) {
  const isProd = env.type === 'PRODUCTION'
  return (
    <section aria-label={`${env.name} state`} className={`rounded-xl border bg-card p-4 text-card-foreground ${isProd ? 'border-destructive/40' : 'border-border'}`}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="flex items-center gap-1.5 truncate text-sm font-semibold">
            {isProd && <Lock className="h-3.5 w-3.5 shrink-0 text-destructive" aria-hidden="true" />}
            {env.name}
          </h2>
          <p className="text-xs text-muted-foreground">{env.type}</p>
        </div>
        {state && (
          <Button type="button" variant="outline" size="sm" onClick={onEdit} aria-label={`Edit ${env.name}`}>
            <Pencil aria-hidden="true" /> Edit
          </Button>
        )}
      </div>

      {state ? (
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Status</dt>
            <dd>
              <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${state.enabled ? 'bg-success-soft text-success-text' : 'bg-chip-off text-chip-off-foreground'}`}>
                {state.enabled ? 'Enabled' : 'Disabled'}
              </span>
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Value</dt>
            <dd className="min-w-0 break-all text-right font-mono text-xs" data-testid="card-value">
              {state.value ? previewValue(state.value) : <span className="font-sans text-muted-foreground">(none)</span>}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Rollout</dt>
            <dd>{state.rolloutPercent}%</dd>
          </div>
        </dl>
      ) : (
        <p className="text-sm text-muted-foreground">Not configured</p>
      )}
    </section>
  )
}
