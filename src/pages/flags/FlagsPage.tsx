import { useState, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getFlags, getArchivedFlags, createFlag, updateFlag, deleteFlag,
  unarchiveFlag, updateFlagState, getFlagState,
  type FlagValueType, type FeatureFlag,
} from '@/api/flags'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  Flag, Plus, Search, ToggleLeft, Hash, Type, Braces,
  ToggleRight, Pencil, Archive, ArchiveRestore, ChevronDown, ChevronRight,
  Loader2,
} from 'lucide-react'

// ─── Type config ──────────────────────────────────────────────────────────────

const VALUE_TYPES: FlagValueType[] = ['BOOLEAN', 'STRING', 'INTEGER', 'JSON']

const typeConfig: Record<FlagValueType, { label: string; cls: string; icon: React.ReactNode }> = {
  BOOLEAN: { label: 'Boolean', cls: 'bg-indigo-50 text-indigo-600 border-indigo-100', icon: <ToggleRight className="w-3 h-3" /> },
  STRING:  { label: 'String',  cls: 'bg-emerald-50 text-emerald-600 border-emerald-100', icon: <Type className="w-3 h-3" /> },
  INTEGER: { label: 'Integer', cls: 'bg-orange-50 text-orange-600 border-orange-100', icon: <Hash className="w-3 h-3" /> },
  JSON:    { label: 'JSON',    cls: 'bg-purple-50 text-purple-600 border-purple-100', icon: <Braces className="w-3 h-3" /> },
}

// ─── Pill Toggle ──────────────────────────────────────────────────────────────

function FlagToggle({ flagId, envId }: { flagId: string; envId: string }) {
  const qc = useQueryClient()
  const { data: state, isLoading } = useQuery({
    queryKey: ['flag-state', flagId, envId],
    queryFn: () => getFlagState(flagId, envId),
  })
  const toggle = useMutation({
    mutationFn: (enabled: boolean) => updateFlagState(flagId, envId, { enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['flag-state', flagId, envId] }),
  })

  const enabled = state?.enabled ?? false
  const pending = toggle.isPending || isLoading

  if (pending && state === undefined) {
    return <div className="w-24 h-7 rounded-full bg-slate-100 animate-pulse" />
  }

  return (
    <button
      onClick={() => toggle.mutate(!enabled)}
      disabled={pending}
      className={cn(
        'inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all select-none',
        enabled
          ? 'bg-[#10B981] text-white hover:bg-[#059669] shadow-sm shadow-[#10B981]/25'
          : 'bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0]',
        pending && 'opacity-60 cursor-not-allowed',
      )}
    >
      {pending
        ? <Loader2 className="w-3 h-3 animate-spin" />
        : <span className={cn('w-2 h-2 rounded-full', enabled ? 'bg-white' : 'bg-[#94A3B8]')} />}
      {enabled ? 'Enabled' : 'Disabled'}
    </button>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FlagsPage() {
  const { projectId, envId } = useParams<{ projectId: string; envId: string }>()
  const qc = useQueryClient()

  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState<{ name: string; key: string; description: string; valueType: FlagValueType }>({
    name: '', key: '', description: '', valueType: 'BOOLEAN',
  })
  const [editTarget, setEditTarget] = useState<FeatureFlag | null>(null)
  const [editForm, setEditForm] = useState({ name: '', description: '' })
  const [deleteTarget, setDeleteTarget] = useState<FeatureFlag | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  const { data: flags = [], isLoading } = useQuery({
    queryKey: ['flags', projectId],
    queryFn: () => getFlags(projectId!),
    enabled: !!projectId,
  })

  const activeFlags = flags.filter((f) => !f.archived)

  const flagStateQueries = useQueries({
    queries: envId ? activeFlags.map((f) => ({
      queryKey: ['flag-state', f.id, envId],
      queryFn: () => getFlagState(f.id, envId!),
    })) : [],
  })
  const enabledCount = flagStateQueries.filter((q) => q.data?.enabled).length

  // map flagId → enabled for row dot colour
  const enabledById = useMemo(() => {
    const m: Record<string, boolean> = {}
    activeFlags.forEach((f, i) => {
      m[f.id] = flagStateQueries[i]?.data?.enabled ?? false
    })
    return m
  }, [activeFlags, flagStateQueries])

  const filtered = useMemo(() => {
    if (!search.trim()) return activeFlags
    const q = search.toLowerCase()
    return activeFlags.filter(
      (f) => f.name.toLowerCase().includes(q) || f.key.toLowerCase().includes(q)
    )
  }, [activeFlags, search])

  const create = useMutation({
    mutationFn: () => createFlag({ projectId: projectId!, ...form }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['flags', projectId] })
      setOpen(false)
      setForm({ name: '', key: '', description: '', valueType: 'BOOLEAN' })
    },
  })

  const editMutation = useMutation({
    mutationFn: () => updateFlag(editTarget!.id, editForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['flags', projectId] })
      setEditTarget(null)
    },
  })

  const archiveMutation = useMutation({
    mutationFn: () => deleteFlag(deleteTarget!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['flags', projectId] })
      qc.invalidateQueries({ queryKey: ['flags-archived', projectId] })
      setDeleteTarget(null)
    },
  })

  const { data: archivedFlags = [] } = useQuery({
    queryKey: ['flags-archived', projectId],
    queryFn: () => getArchivedFlags(projectId!),
    enabled: !!projectId,
  })

  const unarchiveMutation = useMutation({
    mutationFn: (id: string) => unarchiveFlag(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['flags', projectId] })
      qc.invalidateQueries({ queryKey: ['flags-archived', projectId] })
    },
  })

  const openEdit = (flag: FeatureFlag) => {
    setEditTarget(flag)
    setEditForm({ name: flag.name, description: flag.description ?? '' })
  }

  const autoKey = (name: string) =>
    name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/g, '')

  const colsWithEnv = 'grid-cols-[1fr_220px_110px_80px_160px]'
  const colsNoEnv   = 'grid-cols-[1fr_220px_110px_80px]'

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Feature Flags</h1>
          <p className="text-sm text-gray-500 mt-1">
            {activeFlags.length} flag{activeFlags.length !== 1 ? 's' : ''} in this project
            {!envId && (
              <span className="ml-2 inline-flex items-center gap-1 text-amber-600 bg-amber-50 border border-amber-100 text-[11px] font-medium px-2 py-0.5 rounded-full">
                <ToggleLeft className="w-3 h-3" />
                Select an environment to toggle
              </span>
            )}
          </p>
        </div>
        <Button onClick={() => setOpen(true)} className="gap-2 h-9 px-4 shadow-sm">
          <Plus className="w-4 h-4" />
          New flag
        </Button>
      </div>

      {/* ── Stats ── */}
      {activeFlags.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total flags', value: activeFlags.length,              color: 'text-[#0F172A]',   accent: 'border-l-[#2563EB]',   icon: <Flag className="w-5 h-5 text-[#2563EB]" />,           bg: 'bg-[#EFF6FF]'  },
            { label: 'Enabled',     value: enabledCount,                    color: 'text-[#16A34A]',   accent: 'border-l-[#10B981]',   icon: <ToggleRight className="w-5 h-5 text-[#10B981]" />,     bg: 'bg-[#ECFDF5]'  },
            { label: 'Archived',    value: archivedFlags.length,            color: 'text-[#64748B]',   accent: 'border-l-[#E2E8F0]',   icon: <Archive className="w-5 h-5 text-[#64748B]" />,         bg: 'bg-[#F8FAFC]'  },
          ].map((s) => (
            <div key={s.label} className={cn('rounded-xl border border-[#E2E8F0] border-l-4 px-5 py-5 flex items-center gap-4 shadow-sm bg-white', s.accent)}>
              <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0', s.bg)}>
                {s.icon}
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{s.label}</p>
                <p className={cn('text-4xl font-bold leading-none mt-0.5', s.color)}>{s.value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Table ── */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">

        {/* Toolbar */}
        <div className="px-5 py-4 border-b border-[#F1F5F9] flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search flags…"
              className="pl-9 h-9 bg-gray-50 border-gray-200 text-sm focus:bg-white"
            />
          </div>
          <p className="text-xs text-gray-400 ml-auto">
            {filtered.length} of {activeFlags.length} shown
          </p>
        </div>

        {/* Loading skeleton */}
        {isLoading && (
          <div className="divide-y divide-gray-100">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4 animate-pulse">
                <div className="w-2 h-2 rounded-full bg-gray-200" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 bg-gray-200 rounded w-40" />
                  <div className="h-3 bg-gray-100 rounded w-24" />
                </div>
                <div className="h-6 w-16 bg-gray-100 rounded" />
                <div className="h-6 w-16 bg-gray-100 rounded" />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && activeFlags.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 px-6">
            <div className="w-16 h-16 rounded-2xl bg-[#EFF6FF] flex items-center justify-center mb-4">
              <Flag className="w-7 h-7 text-[#2563EB]" />
            </div>
            <p className="text-base font-semibold text-gray-800 mb-1">No feature flags yet</p>
            <p className="text-sm text-gray-400 mb-6 text-center max-w-xs">
              Create your first feature flag to start controlling what your users see.
            </p>
            <Button onClick={() => setOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Create first flag
            </Button>
          </div>
        )}

        {/* No search results */}
        {!isLoading && activeFlags.length > 0 && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <Search className="w-7 h-7 text-gray-300 mb-3" />
            <p className="text-sm font-medium text-gray-700">No flags match "{search}"</p>
            <button onClick={() => setSearch('')} className="text-xs text-[#2563EB] mt-1 hover:underline">
              Clear search
            </button>
          </div>
        )}

        {/* Table */}
        {!isLoading && filtered.length > 0 && (
          <>
            <div className={cn(
              'grid items-center px-5 py-3 bg-[#F8FAFC] border-b border-[#E2E8F0] text-[11px] font-bold text-[#64748B] uppercase tracking-wider',
              envId ? colsWithEnv : colsNoEnv
            )}>
              <div>Name</div>
              <div>Key</div>
              <div>Type</div>
              <div>Actions</div>
              {envId && <div className="text-right">Status</div>}
            </div>

            <div className="divide-y divide-[#F1F5F9]">
              {filtered.map((flag) => {
                const tc = typeConfig[flag.valueType]
                const isEnabled = enabledById[flag.id] ?? false
                return (
                  <div
                    key={flag.id}
                    className={cn(
                      'grid items-center px-5 py-4 hover:bg-[#F8FAFC] transition-colors',
                      envId ? colsWithEnv : colsNoEnv
                    )}
                  >
                    {/* Name */}
                    <div className="min-w-0 pr-4">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          'w-2 h-2 rounded-full shrink-0 transition-colors',
                          envId ? (isEnabled ? 'bg-[#10B981]' : 'bg-[#CBD5E1]') : 'bg-[#2563EB]'
                        )} />
                        <p className="text-sm font-semibold text-gray-900 truncate">{flag.name}</p>
                      </div>
                      {flag.description && (
                        <p className="text-xs text-gray-400 truncate ml-4 mt-0.5">{flag.description}</p>
                      )}
                    </div>

                    {/* Key */}
                    <div>
                      <code className="text-xs text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md font-mono">
                        {flag.key}
                      </code>
                    </div>

                    {/* Type */}
                    <div>
                      <span className={cn(
                        'inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-md border',
                        tc?.cls ?? 'bg-gray-50 text-gray-500 border-gray-100'
                      )}>
                        {tc?.icon}
                        {tc?.label ?? flag.valueType}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEdit(flag)}
                        className="p-1.5 rounded hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#2563EB] transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(flag)}
                        className="p-1.5 rounded hover:bg-amber-50 text-gray-400 hover:text-amber-500 transition-colors"
                        title="Archive"
                      >
                        <Archive className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Toggle */}
                    {envId && (
                      <div className="flex justify-end">
                        <FlagToggle flagId={flag.id} envId={envId} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* ── Archived ── */}
      <div className="rounded-xl border border-dashed border-[#E2E8F0] bg-white overflow-hidden">
        <button
          className="w-full flex items-center gap-2 px-5 py-3 text-sm font-medium text-[#64748B] hover:bg-[#F8FAFC] transition-colors"
          onClick={() => setShowArchived((v) => !v)}
        >
          {showArchived ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          Archived flags
          {archivedFlags.length > 0 && (
            <span className="ml-1 text-xs bg-[#F1F5F9] text-[#64748B] px-2 py-0.5 rounded-full">
              {archivedFlags.length}
            </span>
          )}
        </button>

        {showArchived && (
          <div className="border-t border-dashed border-gray-100 divide-y divide-gray-100">
            {archivedFlags.length === 0 ? (
              <p className="text-sm text-gray-300 text-center py-8">No archived flags</p>
            ) : (
              archivedFlags.map((flag) => {
                const tc = typeConfig[flag.valueType]
                return (
                  <div key={flag.id} className="flex items-center gap-4 px-5 py-3 opacity-60">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-500 truncate">{flag.name}</p>
                      <code className="text-xs text-gray-400 font-mono">{flag.key}</code>
                    </div>
                    <span className={cn(
                      'inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-md border',
                      tc?.cls ?? 'bg-gray-50 text-gray-500 border-gray-100'
                    )}>
                      {tc?.icon}{tc?.label ?? flag.valueType}
                    </span>
                    <button
                      onClick={() => unarchiveMutation.mutate(flag.id)}
                      disabled={unarchiveMutation.isPending}
                      className="flex items-center gap-1.5 text-xs text-[#2563EB] hover:text-[#1D4ED8] font-medium px-2.5 py-1.5 rounded-lg border border-[#BFDBFE] hover:bg-[#EFF6FF] transition-colors"
                    >
                      <ArchiveRestore className="w-3.5 h-3.5" />
                      Restore
                    </button>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>

      {/* ── Create dialog ── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="text-lg">New feature flag</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Name</Label>
              <Input
                value={form.name}
                onChange={(e) => {
                  const name = e.target.value
                  setForm((f) => ({ ...f, name, key: autoKey(name) }))
                }}
                placeholder="My new feature"
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Key</Label>
              <Input
                value={form.key}
                onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))}
                placeholder="my-new-feature"
                className="h-10 font-mono text-sm"
              />
              <p className="text-xs text-gray-400">Auto-generated from name. Cannot be changed after creation.</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Value type</Label>
              <Select value={form.valueType} onValueChange={(v) => setForm((f) => ({ ...f, valueType: v as FlagValueType }))}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VALUE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      <span className={cn('inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded border', typeConfig[t].cls)}>
                        {typeConfig[t].icon} {typeConfig[t].label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Description <span className="text-gray-400 font-normal">(optional)</span></Label>
              <Input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="What does this flag control?"
                className="h-10"
              />
            </div>
            <Button className="w-full h-10 mt-2" onClick={() => create.mutate()} disabled={create.isPending || !form.name || !form.key}>
              {create.isPending ? 'Creating…' : 'Create flag'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Edit dialog ── */}
      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="text-lg">Edit flag</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Name</Label>
              <Input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} className="h-10" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Description <span className="text-gray-400 font-normal">(optional)</span></Label>
              <Input value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} placeholder="What does this flag control?" className="h-10" />
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1 h-10" onClick={() => setEditTarget(null)}>Cancel</Button>
              <Button className="flex-1 h-10" onClick={() => editMutation.mutate()} disabled={editMutation.isPending || !editForm.name}>
                {editMutation.isPending ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Archive confirm dialog ── */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle className="text-lg">Archive flag</DialogTitle></DialogHeader>
          <div className="pt-1 space-y-4">
            <p className="text-sm text-gray-600">
              Archive <span className="font-semibold text-gray-900">«{deleteTarget?.name}»</span>? It will be hidden from the flag list but can be restored.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 h-10" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button variant="destructive" className="flex-1 h-10" onClick={() => archiveMutation.mutate()} disabled={archiveMutation.isPending}>
                {archiveMutation.isPending ? 'Archiving…' : 'Archive'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
