import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getEnvironments, createEnvironment, updateEnvironment, deleteEnvironment, rotateApiKey, type Environment, type EnvironmentSecret } from '@/api/environments'
import { useNavStore } from '@/stores/navStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Globe, Plus, RefreshCw, Copy, Check, Pencil, Trash2, EyeOff, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Color system ──────────────────────────────────────────────────────────────

type EnvType = 'prod' | 'staging' | 'dev' | 'custom'

function getEnvType(name: string): EnvType {
  const n = name.toLowerCase()
  if (n.includes('prod')) return 'prod'
  if (n.includes('stag')) return 'staging'
  if (n.includes('dev')) return 'dev'
  return 'custom'
}

const ENV_CONFIG: Record<EnvType, {
  bar: string
  iconBg: string
  iconText: string
  badge: string
  label: string
}> = {
  prod:    { bar: 'bg-red-500',     iconBg: 'bg-red-50',     iconText: 'text-red-500',     badge: 'bg-red-50 text-red-700 border-red-100',      label: 'Production'  },
  staging: { bar: 'bg-amber-400',   iconBg: 'bg-amber-50',   iconText: 'text-amber-500',   badge: 'bg-amber-50 text-amber-700 border-amber-100',  label: 'Staging'     },
  dev:     { bar: 'bg-emerald-500', iconBg: 'bg-emerald-50', iconText: 'text-emerald-500', badge: 'bg-emerald-50 text-emerald-700 border-emerald-100', label: 'Development' },
  custom:  { bar: 'bg-[#60A5FA]',   iconBg: 'bg-[#EFF6FF]',  iconText: 'text-[#2563EB]',  badge: 'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]',  label: 'Custom'      },
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
 * The key cannot be displayed here: the backend keeps only a SHA-256 hash, so the plaintext exists
 * exactly once, in the response that mints it. This row therefore says so plainly and offers the
 * only action that can produce a readable key again — rotating it.
 */
function ApiKeyRow({ onRotate, rotating }: { onRotate: () => void; rotating: boolean }) {
  return (
    <div className="border-t border-slate-100 px-4 py-3 bg-slate-50/60 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">API Key</span>
      <span className="flex items-center gap-1.5 text-xs text-slate-400 flex-1 min-w-0">
        <EyeOff className="w-3.5 h-3.5 shrink-0" />
        <span className="truncate">Stored hashed — shown only once, when created or rotated</span>
      </span>
      <button
        onClick={onRotate}
        disabled={rotating}
        className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors shrink-0 disabled:opacity-50"
        title="Generate a new key and invalidate the current one"
      >
        <RefreshCw className={cn('w-3 h-3', rotating && 'animate-spin')} />
        Rotate
      </button>
    </div>
  )
}

/** Shows a freshly minted key once, with the warning that it cannot be retrieved again. */
function SecretDialog({ secret, onClose }: { secret: EnvironmentSecret | null; onClose: () => void }) {
  return (
    <Dialog open={!!secret} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>API key for «{secret?.name}»</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">
              Copy this now — it is stored hashed and <strong>cannot be shown again</strong>. If you
              lose it, rotate the key to get a new one.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <code className="text-xs text-slate-700 font-mono flex-1 break-all">{secret?.apiKey}</code>
            {secret && <CopyButton text={secret.apiKey} />}
          </div>
          <Button className="w-full" onClick={onClose}>Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function EnvironmentsPage() {
  const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const setCurrentEnv = useNavStore((s) => s.setCurrentEnv)

  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', description: '' })
  const [editTarget, setEditTarget] = useState<Environment | null>(null)
  const [editForm, setEditForm] = useState({ name: '', description: '' })
  const [deleteTarget, setDeleteTarget] = useState<Environment | null>(null)
  // The plaintext key exists only in the create/rotate response; hold it just long enough to show it.
  const [secret, setSecret] = useState<EnvironmentSecret | null>(null)

  const { data: envs = [], isLoading } = useQuery({
    queryKey: ['envs', projectId],
    queryFn: () => getEnvironments(projectId!),
    enabled: !!projectId,
  })

  const create = useMutation({
    mutationFn: () => createEnvironment({ projectId: projectId!, ...form }),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['envs', projectId] })
      setOpen(false)
      setForm({ name: '', description: '' })
      setSecret(created)
    },
  })

  const editMutation = useMutation({
    mutationFn: () => updateEnvironment(editTarget!.id, editForm),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['envs', projectId] }); setEditTarget(null) },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteEnvironment(deleteTarget!.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['envs', projectId] }); setDeleteTarget(null) },
  })

  const rotate = useMutation({
    mutationFn: (envId: string) => rotateApiKey(envId),
    onSuccess: (rotated) => {
      qc.invalidateQueries({ queryKey: ['envs', projectId] })
      setSecret(rotated)
    },
  })

  const select = (env: Environment) => {
    setCurrentEnv(env)
    navigate(`/orgs/${orgId}/projects/${projectId}/envs/${env.id}/flags`)
  }

  const openEdit = (e: React.MouseEvent, env: Environment) => {
    e.stopPropagation()
    setEditTarget(env)
    setEditForm({ name: env.name, description: env.description ?? '' })
  }

  const openDelete = (e: React.MouseEvent, env: Environment) => {
    e.stopPropagation()
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
        <Button onClick={() => setOpen(true)} className="gap-2 h-9 px-4 shadow-sm">
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
          <Button onClick={() => setOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            New environment
          </Button>
        </div>
      )}

      {/* ── Grid ── */}
      {!isLoading && envs.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {envs.map((env) => {
            const type = getEnvType(env.name)
            const cfg = ENV_CONFIG[type]
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
                        <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border', cfg.badge)}>
                          {cfg.label}
                        </span>
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

                {/* API Key row */}
                <ApiKeyRow
                  onRotate={() => rotate.mutate(env.id)}
                  rotating={rotate.isPending && rotate.variables === env.id}
                />
              </div>
            )
          })}
        </div>
      )}

      <SecretDialog secret={secret} onClose={() => setSecret(null)} />

      {/* ── Create dialog ── */}
      <Dialog open={open} onOpenChange={setOpen}>
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
              <p className="text-xs text-gray-400">e.g. production, staging, development</p>
            </div>
            <div className="space-y-1.5">
              <Label>Description <span className="text-gray-400">(optional)</span></Label>
              <Input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="A short description"
              />
            </div>
            <Button className="w-full" onClick={() => create.mutate()} disabled={create.isPending || !form.name.trim()}>
              {create.isPending ? 'Creating…' : 'Create environment'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Edit dialog ── */}
      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
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
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setEditTarget(null)}>Cancel</Button>
              <Button
                className="flex-1"
                onClick={() => editMutation.mutate()}
                disabled={editMutation.isPending || !editForm.name.trim()}
              >
                {editMutation.isPending ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirm dialog ── */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete environment</DialogTitle>
          </DialogHeader>
          <div className="pt-1 space-y-4">
            <p className="text-sm text-gray-600">
              Delete <span className="font-semibold text-gray-900">«{deleteTarget?.name}»</span>?{' '}
              All its feature flag states will be removed. This cannot be undone.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
