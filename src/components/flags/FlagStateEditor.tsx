import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { TriangleAlert } from 'lucide-react'
import { getFlagState, type FeatureFlag } from '@/api/flags'
import { saveFlagState, type EnvironmentWindow } from '@/api/flagEnvironments'
import { invalidateStateQueries } from '@/api/flagMatrix'
import { isStateConflict, withConflictReload } from '@/api/stateConflict'
import type { FlagState } from '@/api/flags'
import ApiError from '@/components/ApiError'
import ProdGuardDialog from '@/components/flags/ProdGuardDialog'
import StateConflictDialog from '@/components/flags/StateConflictDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SECRET_ADVISORY, validateRollout, validateValue } from '@/lib/flagValue'

interface Props {
  flag: FeatureFlag
  env: EnvironmentWindow
  open: boolean
  onClose: () => void
}

const FIELD = 'w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive'

/**
 * S-1.8 - edit enabled / value (by valueType) / rollout of one flag in one environment.
 *
 * - Reloads the state right before showing the form (6.2) and sends its `version` with the save
 *   (ADR-07, S-2.16). On a 409 it reloads the latest state, keeps the user's edits in the form,
 *   shows what changed (StateConflictDialog) and re-saves against the new version on request.
 * - Always sends the full state (F7); `clearValue` only when the user emptied an existing value.
 * - `value` is user input: it is only ever rendered as React text/attribute values, never as
 *   HTML (8.4). Validation here is UX only; the server's 400 is shown if it disagrees.
 * - PRODUCTION saves go through {@link ProdGuardDialog} (S-1.9), which is advisory only.
 */
export default function FlagStateEditor({ flag, env, open, onClose }: Readonly<Props>) {
  const fresh = useQuery({
    queryKey: ['flag-state-fresh', flag.id, env.id],
    queryFn: () => getFlagState(flag.id, env.id),
    enabled: open,
    gcTime: 0,
    staleTime: 0,
    retry: false,
    // One reload when the editor opens; later refetches must never rebuild the form and discard
    // the user's edits or an open PROD confirmation.
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: false,
  })

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg">Edit {env.name}</DialogTitle>
          <DialogDescription>
            <code className="font-mono">{flag.key}</code> in {env.name}
          </DialogDescription>
        </DialogHeader>
        {fresh.isPending && <p role="status" className="text-sm text-muted-foreground">Loading current state...</p>}
        {fresh.isError && <ApiError error={fresh.error} />}
        {fresh.data && (
          <EditorForm flag={flag} env={env} loaded={fresh.data} onClose={onClose} />
        )}
      </DialogContent>
    </Dialog>
  )
}

function EditorForm({ flag, env, loaded, onClose }: Readonly<{ flag: FeatureFlag; env: EnvironmentWindow; loaded: FlagState; onClose: () => void }>) {
  const qc = useQueryClient()
  const isProd = env.type === 'PRODUCTION'
  const [enabled, setEnabled] = useState(loaded.enabled)
  const [valueText, setValueText] = useState(loaded.value ?? '')
  const [rolloutText, setRolloutText] = useState(String(loaded.rolloutPercent))
  const [guardOpen, setGuardOpen] = useState(false)
  // Latest server state after a 409. It becomes the baseline (version, "before", clearValue
  // decision) WITHOUT touching the edit fields, so the user's input survives and can be re-applied.
  const [reloaded, setReloaded] = useState<FlagState | null>(null)
  const base = reloaded ?? loaded

  const valueError = validateValue(flag.valueType, valueText)
  const rolloutError = validateRollout(rolloutText)
  const invalid = valueError !== null || rolloutError !== null

  const save = useMutation({
    mutationFn: (prodAcknowledged: boolean) => {
      const original = base.value ?? ''
      // Single call site for writes (version + shared 409 handling, S-2.16).
      return withConflictReload(flag.id, env.id, () => saveFlagState({
        flagId: flag.id,
        envId: env.id,
        enabled,
        value: valueText === '' ? undefined : valueText,
        clearValue: valueText === '' && original !== '',
        rolloutPercent: Number(rolloutText),
        prodAcknowledged: prodAcknowledged || undefined,
        version: base.version,
      }))
    },
    onSuccess: () => {
      void invalidateStateQueries(qc, flag, env.id)
      setGuardOpen(false)
      onClose()
    },
    onError: (e) => {
      if (!isStateConflict(e)) return
      setGuardOpen(false) // the PROD confirmation was for a state that no longer exists
      if (e.latest) setReloaded(e.latest)
      void invalidateStateQueries(qc, flag, env.id)
    },
  })
  const conflict = isStateConflict(save.error) ? save.error : null
  const apiError = conflict ? null : save.error

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (invalid || save.isPending) return
    if (isProd) setGuardOpen(true)
    else save.mutate(false)
  }

  const valueId = `value-${env.id}`
  const rolloutId = `rollout-${env.id}`

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <p className="flex items-start gap-2 rounded-lg border border-warning-border bg-warning-soft p-2.5 text-xs text-warning-text">
        <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {base.version == null
          ? 'Saving may overwrite concurrent changes made by someone else since this state was loaded.'
          : 'If someone else changes this state before you save, the save is rejected and you can review their changes.'}
      </p>

      <div className="flex items-center justify-between">
        <Label htmlFor={`enabled-${env.id}`}>Enabled</Label>
        <Switch id={`enabled-${env.id}`} checked={enabled} onCheckedChange={setEnabled} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={valueId}>Value ({flag.valueType})</Label>
        {flag.valueType === 'BOOLEAN' ? (
          <select id={valueId} className={FIELD} value={valueText} aria-invalid={valueError !== null}
            aria-describedby={`${valueId}-hint`} onChange={(e) => setValueText(e.target.value)}>
            <option value="">(no value)</option>
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
        ) : flag.valueType === 'INTEGER' ? (
          <Input id={valueId} inputMode="numeric" autoComplete="off" value={valueText} aria-invalid={valueError !== null}
            aria-describedby={`${valueId}-hint`} onChange={(e) => setValueText(e.target.value)} />
        ) : (
          <textarea id={valueId} rows={flag.valueType === 'JSON' ? 6 : 3} className={`${FIELD} font-mono`} value={valueText}
            aria-invalid={valueError !== null} aria-describedby={`${valueId}-hint`} onChange={(e) => setValueText(e.target.value)} />
        )}
        <p id={`${valueId}-hint`} className="text-xs text-muted-foreground">{SECRET_ADVISORY}</p>
        {valueError && <p role="alert" className="text-xs text-destructive">{valueError}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={rolloutId}>Rollout (%)</Label>
        <Input id={rolloutId} inputMode="numeric" autoComplete="off" value={rolloutText} aria-invalid={rolloutError !== null}
          onChange={(e) => setRolloutText(e.target.value)} />
        {rolloutError && <p role="alert" className="text-xs text-destructive">{rolloutError}</p>}
      </div>

      {!guardOpen && <ApiError error={apiError} />}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={invalid || save.isPending}>
          {isProd ? 'Review and save...' : save.isPending ? 'Saving...' : 'Save'}
        </Button>
      </DialogFooter>

      {isProd && (
        <ProdGuardDialog
          open={guardOpen}
          flagKey={flag.key}
          env={env}
          before={{ enabled: base.enabled, value: base.value ?? '', rolloutPercent: base.rolloutPercent }}
          after={{ enabled, value: valueText, rolloutPercent: Number(rolloutText) || 0 }}
          saving={save.isPending}
          error={apiError}
          onConfirm={() => save.mutate(true)}
          onCancel={() => { save.reset(); setGuardOpen(false) }}
        />
      )}

      <StateConflictDialog
        open={conflict !== null}
        subject={`${flag.key} in ${env.name}`}
        latest={conflict?.latest ?? null}
        mine={{ enabled, value: valueText, rolloutPercent: Number(rolloutText) || 0 }}
        onClose={() => save.reset()}
      />
    </form>
  )
}
