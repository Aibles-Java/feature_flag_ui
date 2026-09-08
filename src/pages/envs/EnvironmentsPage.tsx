import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getEnvironments,
  createEnvironment,
  updateEnvironment,
  deleteEnvironment,
  rotateApiKey,
  type Environment,
  type EnvironmentSecret,
} from '@/api/environments'
import { ENV_TYPES, type EnvType } from '@/api/abac'
import { useNavStore } from '@/stores/navStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import ApiError from '@/components/ApiError'
import { Globe, Plus, RefreshCw, Copy, Check, Pencil, Trash2, Clock, ShieldAlert, KeyRound } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Color system ──────────────────────────────────────────────────────────────

/**
 * Keyed off the backend's `EnvType`, not the environment's name.
 *
 * This used to guess from the name (a name containing "prod" meant production). The backend has
 * carried a real `type` since the ABAC work, and it is the field the authorization rules read —
 * so guessing could paint an environment green while the backend treated every write to it as
 * production-elevated.
 */
const ENV_CONFIG: Record<EnvType, {
  bar: string
  iconBg: string
  iconText: string
  badge: string
  label: string
}> = {
  PRODUCTION:  { bar: 'bg-red-500',     iconBg: 'bg-red-50',     iconText: 'text-red-500',     badge: 'bg-red-50 text-red-700 border-red-100',             label: 'Production'  },
  STAGING:     { bar: 'bg-amber-400',   iconBg: 'bg-amber-50',   iconText: 'text-amber-500',   badge: 'bg-amber-50 text-amber-700 border-amber-100',       label: 'Staging'     },
  DEVELOPMENT: { bar: 'bg-emerald-500', iconBg: 'bg-emerald-50', iconText: 'text-emerald-500', badge: 'bg-emerald-50 text-emerald-700 border-emerald-100', label: 'Development' },
}

const FALLBACK_CONFIG = {
  bar: 'bg-[#60A5FA]',
  iconBg: 'bg-[#EFF6FF]',
  iconText: 'text-[#2563EB]',
  badge: 'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]',
  label: 'Unknown',
}

const configFor = (type: EnvType) => ENV_CONFIG[type] ?? FALLBACK_CONFIG

const hh = (hour: number) => `${String(hour).padStart(2, '0')}:00`

/** Empty string is the "no window" input state; the backend takes null for that. */
const toHour = (value: string): number | null => {
  if (value.trim() === '') return null
  const n = Number(value)
  return Number.isInteger(n) && n >= 0 && n <= 23 ? n : null
}

/**
 * The backend rejects a half-specified window (`@AssertTrue changeWindowComplete`) and rejects
 * an hour outside 0-23. Checking here keeps a typo from costing a round trip, and keeps the
 * submit button honest about what will be accepted.
 */
function windowProblem(start: string, end: string): string | null {
  const filled = [start, end].filter((v) => v.trim() !== '')
  if (filled.length === 1) return 'Set both hours, or leave both empty.'
  if (filled.length === 2 && (toHour(start) === null || toHour(end) === null)) {
    return 'Hours must be whole numbers between 0 and 23.'
  }
  return null
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
      className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
      title="Copy"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  )
}

/**
 * Shows a freshly minted SDK key, once.
 *
 * The key is never in list data: the backend stores it hashed and returns the plaintext only
 * from create and rotate. So there is no "reveal" affordance to offer on a card — there is
 * nothing to reveal. Miss this dialog and the only way back is another rotation.
 */
function SecretDialog({ secret, onClose }: { secret: EnvironmentSecret | null; onClose: () => void }) {
  return (
    <Dialog open={!!secret} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>API key for {secret?.name}</DialogTitle>
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
            <code className="text-xs text-slate-700 font-mono flex-1 break-all">{secret?.apiKey}</code>
            {secret && <CopyButton text={secret.apiKey} />}
          </div>
          <Button className="w-full" onClick={onClose}>Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** Type + change window in one strip — the two attributes the backend's ABAC rules read. */
function ProtectionRow({ env }: { env: Environment }) {
  const cfg = configFor(env.type)
  const hasWindow = env.changeWindowStartHour !== null && env.changeWindowEndHour !== null

  return (
    <div className="border-t border-slate-100 px-4 py-2.5 bg-slate-50/60 flex items-center gap-3 flex-wrap">
      <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border', cfg.badge)}>
        {cfg.label}
      </span>
      {hasWindow ? (
        <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          Changes allowed {hh(env.changeWindowStartHour!)}–{hh(env.changeWindowEndHour!)}{' '}
          <span className="text-slate-400">({env.changeWindowTimezone ?? 'server time'})</span>
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
          <Clock className="w-3.5 h-3.5 text-slate-300" />
          No change window
        </span>
      )}
    </div>
  )
}

/** Type + change window fields, shared by the create and edit dialogs. */
function ProtectionFields({
  type,
  start,
  end,
  tz,
  mode,
  onChange,
}: {
  type: EnvType
  start: string
  end: string
  tz: string
  mode: 'create' | 'edit'
  onChange: (patch: { type?: EnvType; start?: string; end?: string; tz?: string }) => void
}) {
  const problem = windowProblem(start, end)
  return (
    <>
      <div className="space-y-1.5">
        <Label>Type</Label>
        <Select value={type} onValueChange={(v) => onChange({ type: v as EnvType })}>
          {/* The list shows "Production"; without a formatter the trigger would show the raw
              enum "PRODUCTION" back, so the closed and open states disagree. */}
          <SelectTrigger>
            <SelectValue>{(v) => configFor(v as EnvType).label}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {ENV_TYPES.map((t) => (
              <SelectItem key={t} value={t}>{configFor(t).label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {type === 'PRODUCTION' && (
          <p className="text-xs text-amber-600 leading-snug">
            Flag-state changes, archiving, key rotation and deletion here become OWNER-only.
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label>
          Change window <span className="text-gray-400">(optional, hour 0–23)</span>
        </Label>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            max={23}
            value={start}
            onChange={(e) => onChange({ start: e.target.value })}
            placeholder="From"
          />
          <span className="text-slate-300">–</span>
          <Input
            type="number"
            min={0}
            max={23}
            value={end}
            onChange={(e) => onChange({ end: e.target.value })}
            placeholder="To"
          />
        </div>
        {start.trim() !== '' && (
          <div className="pt-1">
            <Label className="text-xs text-slate-500">Timezone</Label>
            <Input
              className="mt-1"
              value={tz}
              onChange={(e) => onChange({ tz: e.target.value })}
              placeholder={BROWSER_ZONE}
              list="iana-zones"
            />
            {/* Not a full picker: the browser supplies the list, and the backend rejects
                anything that is not a real IANA id, so a typo fails loudly at save. */}
            <datalist id="iana-zones">
              {COMMON_ZONES.map((z) => (
                <option key={z} value={z} />
              ))}
            </datalist>
            <p className="text-xs text-gray-400 mt-1 leading-snug">
              The hours above are read in this zone. Leave it as your own unless the window is
              meant to follow somewhere else.
            </p>
          </div>
        )}

        {problem ? (
          <p className="text-xs text-red-600 leading-snug">{problem}</p>
        ) : mode === 'create' ? (
          <p className="text-xs text-gray-400 leading-snug">
            Leave both empty for no window. When set, production-elevated changes are refused
            outside these hours.
          </p>
        ) : (
          <p className="text-xs text-gray-400 leading-snug">
            Changing the hours works. Clearing an existing window does not: the backend&apos;s
            update endpoint ignores null on these fields, so emptying them here leaves the window
            as it was.
          </p>
        )}
      </div>
    </>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

// Defaults to the browser's zone: the person setting a window almost always means their own
// working hours, and the previous behaviour (the server's zone, unstated) was the silent bug.
const BROWSER_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone

/** Suggestions only; any IANA id the backend accepts is valid. */
const COMMON_ZONES = Array.from(
  new Set([
    BROWSER_ZONE,
    'UTC',
    'Asia/Ho_Chi_Minh',
    'Asia/Singapore',
    'Asia/Tokyo',
    'Europe/London',
    'Europe/Berlin',
    'America/New_York',
    'America/Los_Angeles',
  ])
)

const EMPTY_FORM = {
  name: '',
  description: '',
  type: 'DEVELOPMENT' as EnvType,
  start: '',
  end: '',
  tz: BROWSER_ZONE,
}

export default function EnvironmentsPage() {
  const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const setCurrentEnv = useNavStore((s) => s.setCurrentEnv)

  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editTarget, setEditTarget] = useState<Environment | null>(null)
  const [editForm, setEditForm] = useState(EMPTY_FORM)
  const [deleteTarget, setDeleteTarget] = useState<Environment | null>(null)
  const [secret, setSecret] = useState<EnvironmentSecret | null>(null)

  const { data: envs = [], isLoading } = useQuery({
    queryKey: ['envs', projectId],
    queryFn: () => getEnvironments(projectId!),
    enabled: !!projectId,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['envs', projectId] })

  const create = useMutation({
    mutationFn: () =>
      createEnvironment({
        projectId: projectId!,
        name: form.name,
        description: form.description || undefined,
        type: form.type,
        changeWindowStartHour: toHour(form.start),
        changeWindowEndHour: toHour(form.end),
        changeWindowTimezone: toHour(form.start) === null ? null : form.tz,
      }),
    onSuccess: (created) => {
      invalidate()
      setOpen(false)
      setForm(EMPTY_FORM)
      setSecret(created)
    },
  })

  const editMutation = useMutation({
    mutationFn: () =>
      updateEnvironment(editTarget!.id, {
        name: editForm.name,
        description: editForm.description || undefined,
        type: editForm.type,
        changeWindowStartHour: toHour(editForm.start),
        changeWindowEndHour: toHour(editForm.end),
        changeWindowTimezone: toHour(editForm.start) === null ? null : editForm.tz,
      }),
    onSuccess: () => { invalidate(); setEditTarget(null) },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteEnvironment(deleteTarget!.id),
    onSuccess: () => { invalidate(); setDeleteTarget(null) },
  })

  const rotate = useMutation({
    mutationFn: (envId: string) => rotateApiKey(envId),
    onSuccess: (rotated) => { invalidate(); setSecret(rotated) },
  })

  const select = (env: Environment) => {
    setCurrentEnv(env)
    navigate(`/orgs/${orgId}/projects/${projectId}/envs/${env.id}/flags`)
  }

  const openEdit = (e: React.MouseEvent, env: Environment) => {
    e.stopPropagation()
    editMutation.reset()
    setEditTarget(env)
    setEditForm({
      name: env.name,
      description: env.description ?? '',
      type: env.type,
      start: env.changeWindowStartHour === null ? '' : String(env.changeWindowStartHour),
      end: env.changeWindowEndHour === null ? '' : String(env.changeWindowEndHour),
      tz: env.changeWindowTimezone ?? BROWSER_ZONE,
    })
  }

  const openDelete = (e: React.MouseEvent, env: Environment) => {
    e.stopPropagation()
    deleteMutation.reset()
    setDeleteTarget(env)
  }

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Environments</h1>
          {!isLoading && (
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
              {envs.length}
            </span>
          )}
        </div>
        <Button onClick={() => { create.reset(); setOpen(true) }} className="gap-2 h-9 px-4 shadow-sm">
          <Plus className="w-4 h-4" />
          New environment
        </Button>
      </div>

      {/* ── Skeleton ── */}
      {isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {[1, 2].map((i) => (
            <div key={i} className="h-52 bg-white rounded-2xl border border-slate-200 animate-pulse" />
          ))}
        </div>
      )}

      {/* ── Empty state ── */}
      {!isLoading && envs.length === 0 && (
        <div className="flex flex-col items-center justify-center py-28 bg-white rounded-2xl border-2 border-dashed border-slate-200 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
            <Globe className="w-8 h-8 text-slate-300" />
          </div>
          <p className="text-lg font-semibold text-slate-800 mb-1">No environments yet</p>
          <p className="text-sm text-slate-400 mb-6 max-w-xs">
            Add environments like production, staging, or development to manage flags per context.
          </p>
          <Button onClick={() => { create.reset(); setOpen(true) }} className="gap-2">
            <Plus className="w-4 h-4" />
            New environment
          </Button>
        </div>
      )}

      {/* ── Grid ── */}
      {!isLoading && envs.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {envs.map((env) => {
            const cfg = configFor(env.type)
            return (
              <div
                key={env.id}
                className="group relative bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-200 cursor-pointer"
                onClick={() => select(env)}
              >
                {/* Color bar */}
                <div className={cn('h-1.5 w-full', cfg.bar)} />

                {/* Card body */}
                <div className="p-5">
                  {/* Top row: icon + name + actions */}
                  <div className="flex items-start gap-4">
                    <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center shrink-0', cfg.iconBg)}>
                      <Globe className={cn('w-6 h-6', cfg.iconText)} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-lg font-bold text-slate-900 leading-tight">{env.name}</p>
                      </div>
                      {env.description
                        ? <p className="text-sm text-slate-500 mt-0.5 truncate">{env.description}</p>
                        : <p className="text-sm text-slate-300 mt-0.5 italic">No description</p>}
                    </div>

                    {/* Action buttons — visible on hover */}
                    <div
                      className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={(e) => { e.stopPropagation(); rotate.mutate(env.id) }}
                        disabled={rotate.isPending && rotate.variables === env.id}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                        title="Rotate API key"
                      >
                        <RefreshCw className={cn('w-4 h-4', rotate.isPending && rotate.variables === env.id && 'animate-spin')} />
                      </button>
                      <button
                        onClick={(e) => openEdit(e, env)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-[#2563EB] hover:bg-[#EFF6FF] transition-colors"
                        title="Edit environment"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => openDelete(e, env)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Delete environment"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* CTA */}
                  <div className="mt-4 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2563EB] bg-[#EFF6FF] px-3 py-1.5 rounded-lg group-hover:bg-[#DBEAFE] transition-colors">
                      View Flags →
                    </span>
                  </div>
                </div>

                <ProtectionRow env={env} />
              </div>
            )
          })}
        </div>
      )}

      {/* Rotation failures have no dialog of their own — surface them on the page. */}
      <ApiError error={rotate.error} />

      {/* ── Create dialog ── */}
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) create.reset() }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New environment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="production"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description <span className="text-gray-400">(optional)</span></Label>
              <Input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="A short description"
              />
            </div>
            <ProtectionFields
              mode="create"
              type={form.type}
              start={form.start}
              end={form.end}
              tz={form.tz}
              onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
            />
            <ApiError error={create.error} />
            <Button className="w-full" onClick={() => create.mutate()} disabled={create.isPending || !form.name.trim() || !!windowProblem(form.start, form.end)}>
              {create.isPending ? 'Creating...' : 'Create environment'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Edit dialog ── */}
      <Dialog open={!!editTarget} onOpenChange={(o) => { if (!o) { setEditTarget(null); editMutation.reset() } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit environment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description <span className="text-gray-400">(optional)</span></Label>
              <Input
                value={editForm.description}
                onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="A short description"
              />
            </div>
            <ProtectionFields
              mode="edit"
              type={editForm.type}
              start={editForm.start}
              end={editForm.end}
              tz={editForm.tz}
              onChange={(patch) => setEditForm((f) => ({ ...f, ...patch }))}
            />
            <ApiError error={editMutation.error} />
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setEditTarget(null)}>Cancel</Button>
              <Button
                className="flex-1"
                onClick={() => editMutation.mutate()}
                disabled={editMutation.isPending || !editForm.name.trim() || !!windowProblem(editForm.start, editForm.end)}
              >
                {editMutation.isPending ? 'Saving...' : 'Save changes'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirm dialog ── */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) { setDeleteTarget(null); deleteMutation.reset() } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete environment</DialogTitle>
          </DialogHeader>
          <div className="pt-1 space-y-4">
            <p className="text-sm text-gray-600">
              Delete <span className="font-semibold text-gray-900">{deleteTarget?.name}</span>?{' '}
              All its feature flag states will be removed. This cannot be undone.
            </p>
            <ApiError error={deleteMutation.error} />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <SecretDialog secret={secret} onClose={() => setSecret(null)} />
    </div>
  )
}
