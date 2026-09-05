import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getApiKeys, createApiKey, revokeApiKey, rotateApiKey, type ApiKey } from '@/api/apiKeys'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import ApiError from '@/components/ApiError'
import SecretDialog from '@/components/SecretDialog'
import { KeyRound, Plus, RefreshCw, Ban } from 'lucide-react'
import { cn } from '@/lib/utils'

const fmt = (iso: string | null) => {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString()
}

/**
 * An environment can hold several keys at once, which is the whole point: rotating with a grace
 * period leaves two working credentials while the SDK fleet redeploys. A list is therefore the
 * only honest way to show them — a single "the key" field cannot represent that state.
 */
function KeyRow({
  apiKey,
  onRevoke,
  onRotate,
  busy,
}: {
  apiKey: ApiKey
  onRevoke: () => void
  onRotate: () => void
  busy: boolean
}) {
  const expired = !apiKey.revokedAt && !apiKey.active
  const status = apiKey.revokedAt ? 'Revoked' : expired ? 'Expired' : 'Active'

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-xl border px-3.5 py-3',
        apiKey.active ? 'border-slate-200' : 'border-slate-100 bg-slate-50/60'
      )}
    >
      <KeyRound
        className={cn('w-4 h-4 mt-0.5 shrink-0', apiKey.active ? 'text-[#2563EB]' : 'text-slate-300')}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={cn(
              'text-sm font-semibold',
              apiKey.active ? 'text-slate-800' : 'text-slate-400'
            )}
          >
            {apiKey.name}
          </span>
          <span
            className={cn(
              'text-[10px] font-semibold px-2 py-0.5 rounded-full border',
              apiKey.active
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-slate-100 text-slate-500 border-slate-200'
            )}
          >
            {status}
          </span>
        </div>
        {/* The prefix is all that survives hashing: enough to recognise a key, not to use it. */}
        <code className="text-[11px] text-slate-400 font-mono">{apiKey.keyPrefix}…</code>
        <div className="text-[11px] text-slate-400 mt-1 space-x-3">
          <span>Created {fmt(apiKey.createdAt)}</span>
          {apiKey.expiresAt && <span>Expires {fmt(apiKey.expiresAt)}</span>}
          <span>{apiKey.lastUsedAt ? `Last used ${fmt(apiKey.lastUsedAt)}` : 'Never used'}</span>
        </div>
      </div>
      {apiKey.active && (
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={onRotate}
            disabled={busy}
            title="Rotate: issue a replacement"
            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
          >
            <RefreshCw className={cn('w-4 h-4', busy && 'animate-spin')} />
          </button>
          <button
            onClick={onRevoke}
            disabled={busy}
            title="Revoke: stop this key working now"
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <Ban className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}

export default function ApiKeysDialog({
  environmentId,
  environmentName,
  open,
  onClose,
}: {
  environmentId: string | null
  environmentName: string
  open: boolean
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [secret, setSecret] = useState<string | null>(null)
  const [rotateTarget, setRotateTarget] = useState<ApiKey | null>(null)
  const [graceHours, setGraceHours] = useState('0')

  const { data: keys = [], isLoading } = useQuery({
    queryKey: ['api-keys', environmentId],
    queryFn: () => getApiKeys(environmentId!),
    enabled: !!environmentId && open,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['api-keys', environmentId] })

  const create = useMutation({
    mutationFn: () =>
      createApiKey(environmentId!, {
        name: name.trim(),
        // datetime-local gives "YYYY-MM-DDTHH:mm"; the backend wants a LocalDateTime and rejects
        // anything not in the future.
        expiresAt: expiresAt ? `${expiresAt}:00` : null,
      }),
    onSuccess: (res) => {
      invalidate()
      setName('')
      setExpiresAt('')
      setSecret(res.apiKey)
    },
  })

  const revoke = useMutation({
    mutationFn: (keyId: string) => revokeApiKey(environmentId!, keyId),
    onSuccess: invalidate,
  })

  const rotate = useMutation({
    mutationFn: () => rotateApiKey(environmentId!, rotateTarget!.id, Number(graceHours) || 0),
    onSuccess: (res) => {
      invalidate()
      setRotateTarget(null)
      setGraceHours('0')
      setSecret(res.apiKey)
    },
  })

  const closeAll = () => {
    setName('')
    setExpiresAt('')
    create.reset()
    revoke.reset()
    onClose()
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && closeAll()}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>API keys for {environmentName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            {isLoading && <div className="h-24 rounded-xl bg-slate-100 animate-pulse" />}

            {!isLoading && keys.length === 0 && (
              <p className="text-sm text-slate-400">
                No keys yet. SDKs authenticate with one of these, so this environment cannot be read
                until you create one.
              </p>
            )}

            {!isLoading && keys.length > 0 && (
              <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
                {keys.map((k) => (
                  <KeyRow
                    key={k.id}
                    apiKey={k}
                    busy={revoke.isPending || rotate.isPending}
                    onRevoke={() => revoke.mutate(k.id)}
                    onRotate={() => {
                      rotate.reset()
                      setRotateTarget(k)
                    }}
                  />
                ))}
              </div>
            )}

            <ApiError error={revoke.error} />

            <div className="border-t border-slate-100 pt-4 space-y-3">
              <Label>New key</Label>
              <div className="flex gap-2">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="What will use it, e.g. mobile-app"
                />
                <Input
                  type="datetime-local"
                  className="w-52"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  title="Optional expiry"
                />
              </div>
              <p className="text-xs text-gray-400">
                Expiry is optional. A key with none works until revoked.
              </p>
              <ApiError error={create.error} />
              <Button
                className="w-full gap-2"
                onClick={() => create.mutate()}
                disabled={create.isPending || !name.trim()}
              >
                <Plus className="w-4 h-4" />
                {create.isPending ? 'Creating…' : 'Create key'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rotation asks for the grace period rather than assuming one: the answer decides whether
          a running SDK fleet keeps working or fails at once. */}
      <Dialog open={!!rotateTarget} onOpenChange={(o) => !o && setRotateTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rotate {rotateTarget?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label>Keep the old key working for</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={720}
                  value={graceHours}
                  onChange={(e) => setGraceHours(e.target.value)}
                />
                <span className="text-sm text-slate-400 shrink-0">hours</span>
              </div>
              <p className="text-xs text-gray-400 leading-snug">
                {Number(graceHours) > 0
                  ? 'Both keys authenticate until then, so SDKs can be redeployed without downtime.'
                  : 'Zero is a hard cutover: every SDK still holding the old key starts failing immediately.'}
              </p>
            </div>
            <ApiError error={rotate.error} />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setRotateTarget(null)}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={() => rotate.mutate()} disabled={rotate.isPending}>
                {rotate.isPending ? 'Rotating…' : 'Rotate'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <SecretDialog title="New API key" apiKey={secret} onClose={() => setSecret(null)} />
    </>
  )
}
