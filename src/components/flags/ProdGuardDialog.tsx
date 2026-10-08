import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ShieldAlert } from 'lucide-react'
import { getEnvironmentWindow, type EnvironmentWindow } from '@/api/flagEnvironments'
import ApiError from '@/components/ApiError'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { previewValue } from '@/lib/flagValue'

export interface StateSnapshot {
  enabled: boolean
  value: string
  rolloutPercent: number
}

interface Props {
  open: boolean
  flagKey: string
  env: EnvironmentWindow
  before: StateSnapshot
  after: StateSnapshot
  saving: boolean
  error: unknown
  onConfirm: () => void
  onCancel: () => void
}

const hour = (h: number) => `${String(h).padStart(2, '0')}:00`
const show = (v: string) => (v === '' ? '(none)' : previewValue(v, 120))

function DiffRow({ label, before, after }: Readonly<{ label: string; before: string; after: string }>) {
  const changed = before !== after
  return (
    <tr className={changed ? 'font-medium' : 'text-muted-foreground'}>
      <th scope="row" className="py-1 pr-3 text-left font-medium">{label}</th>
      <td className="py-1 pr-3 break-all">{before}</td>
      <td className="py-1 break-all">{changed ? after : '(unchanged)'}</td>
    </tr>
  )
}

/**
 * S-1.9 / F9 / F20 - confirmation before saving a PRODUCTION flag state.
 *
 * ADVISORY ONLY (D-03, solution-design 8.2): the server alone decides (OWNER-only elevation and
 * change window). Typing the key is the user's own confirmation, NOT a four-eyes control, and the
 * dialog says so. The window state is the server's `changeWindowOpenNow`; it is never computed
 * from the browser clock. A 403 from the server is shown verbatim by {@link ApiError}.
 */
export default function ProdGuardDialog({ open, flagKey, env, before, after, saving, error, onConfirm, onCancel }: Readonly<Props>) {
  const [typed, setTyped] = useState('')
  const fresh = useQuery({
    queryKey: ['environment-window', env.id],
    queryFn: () => getEnvironmentWindow(env.id),
    enabled: open,
    gcTime: 0,
    staleTime: 0,
    retry: false,
  })
  const current = fresh.data ?? env
  const windowKnown = current.changeWindowOpenNow !== undefined && current.changeWindowOpenNow !== null
  const closed = current.changeWindowOpenNow === false
  const hasWindow = current.changeWindowStartHour != null && current.changeWindowEndHour != null
  const zone = current.changeWindowZone ?? current.changeWindowTimezone
  const keyMatches = typed === flagKey

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onCancel()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <ShieldAlert className="w-5 h-5 text-destructive" aria-hidden="true" />
            Confirm change to {env.name}
          </DialogTitle>
          <DialogDescription>
            {env.name} is a PRODUCTION environment. Review the change before saving.
          </DialogDescription>
        </DialogHeader>

        <table className="w-full text-xs" aria-label="Changes to apply">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th scope="col" className="py-1 pr-3 font-medium"><span className="sr-only">Field</span></th>
              <th scope="col" className="py-1 pr-3 font-medium">Before</th>
              <th scope="col" className="py-1 font-medium">After</th>
            </tr>
          </thead>
          <tbody>
            <DiffRow label="Enabled" before={String(before.enabled)} after={String(after.enabled)} />
            <DiffRow label="Value" before={show(before.value)} after={show(after.value)} />
            <DiffRow label="Rollout" before={`${before.rolloutPercent}%`} after={`${after.rolloutPercent}%`} />
          </tbody>
        </table>

        <div className="space-y-1 rounded-lg border border-border bg-muted/50 p-3 text-xs" data-testid="prod-guard-window">
          <p className="font-medium">Change window (reported by the server)</p>
          {hasWindow && (
            <p>
              Window: {hour(current.changeWindowStartHour as number)} to {hour(current.changeWindowEndHour as number)}
              {zone ? ` (${zone})` : ''}
            </p>
          )}
          {windowKnown ? (
            <p>{closed ? 'The change window is closed right now. The server will reject this change.' : 'The change window is open right now.'}</p>
          ) : (
            <p>Window status is unavailable. The server decides when you save.</p>
          )}
        </div>

        <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
          <li>Changing a PRODUCTION state requires the OWNER role. The server enforces this and the change window.</li>
          <li>This confirmation is your own acknowledgement. It is not a four-eyes review: nobody else approves this change.</li>
        </ul>

        <div className="space-y-1.5">
          <Label htmlFor="prod-guard-key">
            Type the flag key <code className="font-mono">{flagKey}</code> to confirm
          </Label>
          <Input id="prod-guard-key" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} />
        </div>

        <ApiError error={error} />

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button>
          <Button type="button" variant="destructive" disabled={!keyMatches || closed || saving} onClick={onConfirm}>
            {saving ? 'Saving...' : 'Save to PRODUCTION'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
