import { useState, useMemo, useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getFlags, getArchivedFlags, createFlag, updateFlag, deleteFlag,
  unarchiveFlag, getFlagState,
  MAX_FLAGS_PAGE_SIZE, type FlagValueType, type FeatureFlag,
} from '@/api/flags'
import { toggleFlagEnabled } from '@/api/flagToggle'
import { cellQueryKey, fetchCellState, invalidateStateQueries } from '@/api/flagMatrix'
import { isStateConflict, withConflictReload } from '@/api/stateConflict'
import { useFlagMatrix } from '@/hooks/useFlagMatrix'
import StateConflictDialog from '@/components/flags/StateConflictDialog'
import FlagMatrix from '@/components/matrix/FlagMatrix'
import { useEnvParam } from '@/hooks/useEnvParam'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import ErrorDialog from '@/components/ErrorDialog'
import ApiError from '@/components/ApiError'
import {
  Flag, Plus, Search, ToggleLeft, Hash, Type, Braces,
  ToggleRight, Pencil, Archive, ArchiveRestore, ChevronDown, ChevronRight,
  Loader2, ChevronLeft,
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

function FlagToggle({ flag, envId }: Readonly<{ flag: FeatureFlag; envId: string }>) {
  const flagId = flag.id
  const qc = useQueryClient()
  const { data: state, isLoading } = useQuery({
    queryKey: ['flag-state', flagId, envId],
    queryFn: () => getFlagState(flagId, envId),
  })
  const toggle = useMutation({
    // S-0.1: reload + send the full state (value, rolloutPercent) - see api/flagToggle.ts.
    // Sends the version of the state shown here; a 409 reverts to the latest (S-2.16).
    mutationFn: (enabled: boolean) => withConflictReload(flagId, envId, () => toggleFlagEnabled(flagId, envId, enabled, state)),
    onSettled: () => invalidateStateQueries(qc, flag, envId),
  })
  const conflict = isStateConflict(toggle.error) ? toggle.error : null

  const enabled = state?.enabled ?? false
  const pending = toggle.isPending || isLoading

  if (pending && state === undefined) {
    return <div className="w-24 h-7 rounded-full bg-slate-100 animate-pulse" />
  }

  // A refused toggle used to be silent: the pill renders from server state, so a 403 left it
  // unchanged and the click looked like it did nothing. This is the single most likely place to
  // meet an authorization refusal (a plain permission gap, a production-elevated action, or a
  // change window), so it gets a dialog rather than text crammed beside the control — which
  // would otherwise repeat once per row as the user tries several flags.
  return (
    <>
      <button type="button"
        onClick={() => toggle.mutate(!enabled)}
        disabled={pending}
        className={cn(
          'inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all select-none',
          enabled
            ? 'bg-chip-on text-chip-on-foreground hover:bg-chip-on-hover shadow-sm shadow-success/25'
            : 'bg-chip-off text-chip-off-foreground hover:bg-chip-off-hover',
          pending && 'opacity-60 cursor-not-allowed',
        )}
      >
        {pending
          ? <Loader2 className="w-3 h-3 animate-spin" />
          : <span className={cn('w-2 h-2 rounded-full', enabled ? 'bg-white' : 'bg-faint')} />}
        {enabled ? 'Enabled' : 'Disabled'}
      </button>
      <ErrorDialog error={conflict ? null : toggle.error} onClose={() => toggle.reset()} />
      <StateConflictDialog open={conflict !== null} subject={flag.name} latest={conflict?.latest ?? null} onClose={() => toggle.reset()} />
    </>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────


/**
 * Announces the matrix request outcome (S-2.15). Loading and 429 replace the grid (nothing to
 * show yet); a 429 on a refresh keeps the grid and says the data may be stale. No retry button on
 * purpose: the single automatic retry waits for Retry-After, so there is no request storm.
 */
function MatrixStatus({ matrix }: Readonly<{ matrix: ReturnType<typeof useFlagMatrix> }>) {
  if (matrix.rateLimited) {
    return (
      <p role="status" className="mx-5 my-3 rounded-lg border border-warning-border bg-warning-soft px-3 py-2 text-sm text-warning-text">
        Too many requests. {matrix.index ? 'Showing the last loaded data. ' : ''}Retrying automatically in {matrix.retryAfter} seconds.
      </p>
    )
  }
  if (matrix.mode === 'loading') {
    return <p role="status" className="px-5 py-6 text-sm text-muted-foreground">Loading flag states...</p>
  }
  if (matrix.mode === 'error') return <div className="px-5 py-3"><ApiError error={matrix.error} /></div>
  return null
}

/** Status dot: blue with no environment selected, else green when on and grey when off. */
function dotColour(envId: string | undefined, isEnabled: boolean): string {
  if (!envId) return 'bg-primary'
  return isEnabled ? 'bg-success' : 'bg-faint-strong'
}
/** Upper bound for ?page= so absurd values never reach the API; the clamp effect then lands on the real last page. */
const MAX_PAGE_PARAM = 100000

export default function FlagsPage() {
  const { orgId, projectId, envId: legacyEnvId } = useParams<{ orgId: string; projectId: string; envId: string }>()
  const qc = useQueryClient()
  // Legacy route (kill-switch off): env comes from the path, as before. New route: env comes from
  // the validated ?env= search param (S-1.2) - never from zustand.
  const { envId: urlEnvId, environments } = useEnvParam(legacyEnvId ? undefined : projectId)
  const envId = legacyEnvId ?? urlEnvId
  const [searchParams, setSearchParams] = useSearchParams()
  // Page lives in the URL (?page=, 1-based) so reload and Back preserve it. Other params (?env=) are kept.
  const rawPage = Number.parseInt(searchParams.get('page') ?? '1', 10)
  const pageIndex = Number.isFinite(rawPage) && rawPage > 1 ? Math.min(rawPage, MAX_PAGE_PARAM) - 1 : 0
  const setPageIndex = (idx: number, replace = false) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (idx > 0) next.set('page', String(idx + 1))
        else next.delete('page')
        return next
      },
      { replace },
    )

  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState<{ name: string; key: string; description: string; valueType: FlagValueType }>({
    name: '', key: '', description: '', valueType: 'BOOLEAN',
  })
  const [editTarget, setEditTarget] = useState<FeatureFlag | null>(null)
  const [editForm, setEditForm] = useState({ name: '', description: '' })
  const [deleteTarget, setDeleteTarget] = useState<FeatureFlag | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  const { data: flagsPage, isLoading, isPlaceholderData } = useQuery({
    queryKey: ['flags', projectId, pageIndex],
    queryFn: () => getFlags(projectId!, pageIndex, MAX_FLAGS_PAGE_SIZE),
    enabled: !!projectId,
    // Keep the previous page while paging, but never another project's flags.
    placeholderData: (prev, prevQuery) => (prevQuery?.queryKey[1] === projectId ? prev : undefined),
  })
  const flags = useMemo(() => flagsPage?.content ?? [], [flagsPage])
  const totalElements = flagsPage?.totalElements ?? 0
  const totalPages = Math.max(flagsPage?.totalPages ?? 1, 1)

  // List shrank (archive/delete) while on a later page: clamp back to the last real page.
  const loadedPage = flagsPage && !isPlaceholderData
  useEffect(() => {
    if (loadedPage && pageIndex > 0 && pageIndex > totalPages - 1) setPageIndex(totalPages - 1, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedPage, pageIndex, totalPages])

  const activeFlags = useMemo(() => flags.filter((f) => !f.archived), [flags])

  // S-2.15: on the matrix route the whole page's states come from ONE request. If that fails with
  // 404/5xx/network the cells fall back to the phase 1 per-cell path (fetchCellState, D-20).
  const matrix = useFlagMatrix(projectId, pageIndex, !legacyEnvId)

  const flagStateQueries = useQueries({
    queries: envId ? activeFlags.map((f) => (legacyEnvId
      ? { queryKey: ['flag-state', f.id, envId], queryFn: () => getFlagState(f.id, envId) }
      // Matrix route: the cells own fetching (lazy, D-20-limited). This only observes their
      // cache for the "Enabled" stat, so it must not issue its own requests.
      : { queryKey: cellQueryKey(f.id, envId), queryFn: () => fetchCellState(f.id, envId), enabled: false })) : [],
  })
  // Matrix data wins when present; otherwise the per-cell cache (legacy route / fallback).
  const enabledIn = (flagId: string, i: number) =>
    (envId ? matrix.index?.get(flagId)?.get(envId)?.enabled : undefined) ?? flagStateQueries[i]?.data?.enabled ?? false
  const enabledCount = activeFlags.filter((f, i) => enabledIn(f.id, i)).length

  // map flagId → enabled for row dot colour
  const enabledById = useMemo(() => {
    const m: Record<string, boolean> = {}
    activeFlags.forEach((f, i) => {
      m[f.id] = enabledIn(f.id, i)
    })
    return m
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFlags, flagStateQueries, matrix.index, envId])

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
    name.toLowerCase().replaceAll(/\s+/g, '-').replaceAll(/[^a-z0-9-_]/g, '')

  const colsWithEnv = 'grid-cols-[1fr_220px_110px_80px_160px]'
  const colsNoEnv   = 'grid-cols-[1fr_220px_110px_80px]'

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Feature Flags</h1>
          <p className="text-sm text-gray-500 mt-1">
            <span data-testid="flags-total">{totalElements}</span> flag{totalElements !== 1 ? 's' : ''} in this project
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
            { label: 'Total flags', value: totalElements,              color: 'text-foreground',   accent: 'border-l-primary',   icon: <Flag className="w-5 h-5 text-primary" />,           bg: 'bg-brand-soft'  },
            { label: 'Enabled (this page)', value: enabledCount,                    color: 'text-success-text',   accent: 'border-l-success',   icon: <ToggleRight className="w-5 h-5 text-success" />,     bg: 'bg-success-soft'  },
            { label: 'Archived',    value: archivedFlags.length,            color: 'text-muted-foreground',   accent: 'border-l-border',   icon: <Archive className="w-5 h-5 text-muted-foreground" />,         bg: 'bg-background'  },
          ].map((s) => (
            <div key={s.label} className={cn('rounded-xl border border-border border-l-4 px-5 py-5 flex items-center gap-4 shadow-sm bg-white', s.accent)}>
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
      <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">

        {/* Toolbar */}
        <div className="px-5 py-4 border-b border-muted flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search this page…"
              className="pl-9 h-9 bg-gray-50 border-gray-200 text-sm focus:bg-white"
            />
          </div>
          <p className="text-xs text-gray-400 ml-auto">
            {filtered.length} of {activeFlags.length} on this page
          </p>
        </div>

        {/* Env filter (flag-centric route only): replaces the sidebar env switcher */}
        {!legacyEnvId && environments.length > 0 && (
          <div className="px-5 py-3 border-b border-muted flex items-center gap-2">
            <label htmlFor="env-filter" className="text-xs font-semibold text-gray-500">Environment</label>
            <select
              id="env-filter"
              value={envId ?? ''}
              onChange={(e) =>
                setSearchParams((prev) => {
                  const next = new URLSearchParams(prev)
                  if (e.target.value) next.set('env', e.target.value)
                  else next.delete('env')
                  return next
                })
              }
              className="h-8 rounded-md border border-gray-200 bg-white px-2 text-sm"
            >
              <option value="">All environments</option>
              {environments.map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>
        )}

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
            <div className="w-16 h-16 rounded-2xl bg-brand-soft flex items-center justify-center mb-4">
              <Flag className="w-7 h-7 text-primary" />
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
            <button type="button" onClick={() => setSearch('')} className="text-xs text-primary mt-1 hover:underline">
              Clear search
            </button>
          </div>
        )}

        {/* Matrix (flag-centric route, S-1.4a/b) */}
        {!isLoading && filtered.length > 0 && !legacyEnvId && (
          <MatrixStatus matrix={matrix} />
        )}
        {!isLoading && filtered.length > 0 && !legacyEnvId && matrix.mode !== 'loading' && matrix.mode !== 'rate-limited' && matrix.mode !== 'error' && (
          <FlagMatrix
            matrixStates={matrix.index}
            flags={filtered}
            environments={environments}
            focusEnvId={envId}
            detailHref={(f, e) => `/orgs/${orgId}/projects/${projectId}/flags/${f.id}?env=${encodeURIComponent(e)}`}
            renderRowHeader={(flag) => {
              const tc = typeConfig[flag.valueType]
              return (
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span aria-hidden="true" className={cn('w-2 h-2 rounded-full shrink-0', dotColour(envId, enabledById[flag.id] ?? false))} />
                    <p className="text-sm font-semibold text-foreground truncate">{flag.name}</p>
                  </div>
                  {flag.description && <p className="text-xs text-muted-foreground truncate ml-4 mt-0.5">{flag.description}</p>}
                  <div className="ml-4 mt-1 flex items-center gap-2">
                    <code className="text-xs text-foreground bg-muted px-2 py-0.5 rounded-md font-mono">{flag.key}</code>
                    <span className={cn('inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded-md border', tc?.cls ?? 'bg-muted text-muted-foreground border-border')}>
                      {tc?.icon}{tc?.label ?? flag.valueType}
                    </span>
                  </div>
                </div>
              )
            }}
            renderActions={(flag) => (
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => openEdit(flag)} aria-label={`Edit ${flag.name}`}
                  className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-primary transition-colors">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button type="button" onClick={() => setDeleteTarget(flag)} aria-label={`Archive ${flag.name}`}
                  className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                  <Archive className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          />
        )}

        {/* Table (legacy env-first route only) */}
        {!isLoading && filtered.length > 0 && !!legacyEnvId && (
          <>
            <div className={cn(
              'grid items-center px-5 py-3 bg-background border-b border-border text-[11px] font-bold text-muted-foreground uppercase tracking-wider',
              envId ? colsWithEnv : colsNoEnv
            )}>
              <div>Name</div>
              <div>Key</div>
              <div>Type</div>
              <div>Actions</div>
              {envId && <div className="text-right">Status</div>}
            </div>

            <div className="divide-y divide-muted">
              {filtered.map((flag) => {
                const tc = typeConfig[flag.valueType]
                const isEnabled = enabledById[flag.id] ?? false
                return (
                  <div
                    key={flag.id}
                    className={cn(
                      'grid items-center px-5 py-4 hover:bg-background transition-colors',
                      envId ? colsWithEnv : colsNoEnv
                    )}
                  >
                    {/* Name */}
                    <div className="min-w-0 pr-4">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          'w-2 h-2 rounded-full shrink-0 transition-colors',
                          dotColour(envId, isEnabled)
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
                      <button type="button"
                        onClick={() => openEdit(flag)}
                        className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button type="button"
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
                        <FlagToggle flag={flag} envId={envId} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* Pagination (D-18: page controls, no "load more") */}
        {(totalPages > 1 || pageIndex > 0) && (
          <nav aria-label="Flags pagination" className="flex items-center justify-between px-5 py-3 border-t border-muted">
            <p className="text-xs text-gray-500">Page {pageIndex + 1} of {totalPages}</p>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" aria-label="Previous page"
                disabled={pageIndex === 0} onClick={() => setPageIndex(Math.max(pageIndex - 1, 0))}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button type="button" variant="outline" size="sm" aria-label="Next page"
                disabled={pageIndex >= totalPages - 1} onClick={() => setPageIndex(pageIndex + 1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </nav>
        )}
      </div>

      {/* ── Archived ── */}
      <div className="rounded-xl border border-dashed border-border bg-white overflow-hidden">
        <button type="button"
          className="w-full flex items-center gap-2 px-5 py-3 text-sm font-medium text-muted-foreground hover:bg-background transition-colors"
          onClick={() => setShowArchived((v) => !v)}
        >
          {showArchived ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          Archived flags
          {archivedFlags.length > 0 && (
            <span className="ml-1 text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
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
                    <button type="button"
                      onClick={() => unarchiveMutation.mutate(flag.id)}
                      disabled={unarchiveMutation.isPending}
                      className="flex items-center gap-1.5 text-xs text-primary hover:text-brand-strong font-medium px-2.5 py-1.5 rounded-lg border border-brand-border hover:bg-brand-soft transition-colors"
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
                {/* Same reason as the environment type select: the list shows "Boolean" while
                    the trigger would otherwise show the raw enum "BOOLEAN" back. */}
                <SelectTrigger className="h-10">
                  <SelectValue>{(v) => typeConfig[v as FlagValueType]?.label ?? String(v)}</SelectValue>
                </SelectTrigger>
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
              <ApiError error={editMutation.error} className="mb-1" />
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
              <ApiError error={archiveMutation.error} className="mb-1" />
              <Button variant="destructive" className="flex-1 h-10" onClick={() => archiveMutation.mutate()} disabled={archiveMutation.isPending}>
                {archiveMutation.isPending ? 'Archiving…' : 'Archive'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Unarchive is an inline row action with no form to host a banner. */}
      <ErrorDialog error={unarchiveMutation.error} onClose={() => unarchiveMutation.reset()} />
    </div>
  )
}
