import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { getAuditLog, type AuditAction, type AuditLogEntry } from '@/api/audit'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ScrollText, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'

const PAGE_SIZE = 20

/** Colour carries the *risk* of the action, so destructive changes are scannable at a glance. */
const ACTION_STYLE: Record<AuditAction, string> = {
  CREATE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  UPDATE: 'bg-sky-50 text-sky-700 border-sky-200',
  DELETE: 'bg-rose-50 text-rose-700 border-rose-200',
  ARCHIVE: 'bg-amber-50 text-amber-700 border-amber-200',
  UNARCHIVE: 'bg-teal-50 text-teal-700 border-teal-200',
  ROTATE_KEY: 'bg-violet-50 text-violet-700 border-violet-200',
}

const formatWhen = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

const prettyEntity = (s: string) => s.replace(/_/g, ' ').toLowerCase()

/** Short id for display; the full value stays in the `title` tooltip. */
const shortId = (id: string | null) => (id ? id.slice(0, 8) : '—')

function StateBlock({ label, state }: { label: string; state: Record<string, unknown> | null }) {
  return (
    <div className="flex-1 min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-gray-400 mb-1.5">{label}</p>
      {state ? (
        <pre className="text-[11px] leading-relaxed bg-[#F8FAFC] border border-gray-200 rounded-lg p-3 overflow-x-auto text-gray-700">
          {JSON.stringify(state, null, 2)}
        </pre>
      ) : (
        <p className="text-[11px] text-gray-400 italic bg-[#F8FAFC] border border-dashed border-gray-200 rounded-lg p-3">
          none
        </p>
      )}
    </div>
  )
}

function AuditRow({ entry }: { entry: AuditLogEntry }) {
  const [open, setOpen] = useState(false)
  // API-key rotation deliberately records neither state — the key itself is never logged.
  const hasDetail = !!(entry.beforeState || entry.afterState)

  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        onClick={() => hasDetail && setOpen((v) => !v)}
        disabled={!hasDetail}
        className={cn(
          'w-full flex items-center gap-4 px-5 py-3.5 text-left transition-colors',
          hasDetail ? 'hover:bg-[#F8FAFC] cursor-pointer' : 'cursor-default'
        )}
      >
        <span
          className={cn(
            'shrink-0 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border',
            ACTION_STYLE[entry.action] ?? 'bg-gray-50 text-gray-600 border-gray-200'
          )}
        >
          {entry.action.replace('_', ' ')}
        </span>

        <span className="text-sm text-gray-800 font-medium capitalize shrink-0">
          {prettyEntity(entry.entityType)}
        </span>

        <span className="text-xs font-mono text-gray-400 shrink-0" title={entry.entityId ?? undefined}>
          {shortId(entry.entityId)}
        </span>

        <span className="flex-1" />

        <span className="text-xs text-gray-400 font-mono shrink-0" title={entry.actorUserId ?? 'system'}>
          {entry.actorUserId ? `by ${shortId(entry.actorUserId)}` : 'system'}
        </span>

        <span className="text-xs text-gray-500 shrink-0 tabular-nums">{formatWhen(entry.createdAt)}</span>

        {hasDetail ? (
          <ChevronDown
            className={cn('w-4 h-4 text-gray-300 shrink-0 transition-transform', open && 'rotate-180')}
          />
        ) : (
          <span className="w-4 shrink-0" />
        )}
      </button>

      {open && hasDetail && (
        <div className="flex gap-4 px-5 pb-4 pt-1">
          <StateBlock label="Before" state={entry.beforeState} />
          <StateBlock label="After" state={entry.afterState} />
        </div>
      )}
    </div>
  )
}

export default function AuditLogPage() {
  const { orgId } = useParams<{ orgId: string }>()
  const [page, setPage] = useState(0)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['audit-log', orgId, page],
    queryFn: () => getAuditLog(orgId!, { page, size: PAGE_SIZE }),
    enabled: !!orgId,
    // Keeps the previous page rendered while the next loads, so paging doesn't flash empty.
    placeholderData: keepPreviousData,
  })

  const entries = data?.content ?? []
  const totalPages = data?.totalPages ?? 0
  const totalElements = data?.totalElements ?? 0

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Audit log</h1>
          <p className="text-gray-500 mt-1.5">
            Every change to flags, projects, environments and members in this organization.
          </p>
        </div>
        {totalElements > 0 && (
          <span className="text-sm text-gray-400 font-medium tabular-nums">
            {totalElements.toLocaleString()} {totalElements === 1 ? 'entry' : 'entries'}
          </span>
        )}
      </div>

      {isLoading && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-14 border-b border-gray-100 last:border-0 animate-pulse bg-gray-50/60" />
          ))}
        </div>
      )}

      {isError && !isLoading && (
        <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border-2 border-dashed border-rose-200">
          <h3 className="text-lg font-bold text-gray-800 mb-1.5">Couldn't load the audit log</h3>
          <p className="text-gray-500 text-center max-w-sm">
            Viewing it requires membership of this organization. If you've just been added, try again.
          </p>
        </div>
      )}

      {!isLoading && !isError && entries.length === 0 && (
        <div className="flex flex-col items-center justify-center py-28 bg-white rounded-2xl border-2 border-dashed border-gray-200">
          <div className="w-20 h-20 rounded-3xl bg-[#EFF6FF] flex items-center justify-center mb-5">
            <ScrollText className="w-9 h-9 text-[#60A5FA]" />
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">Nothing recorded yet</h3>
          <p className="text-gray-500 text-center max-w-xs">
            Changes to flags, projects, environments and members will appear here as they happen.
          </p>
        </div>
      )}

      {!isLoading && !isError && entries.length > 0 && (
        <>
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            {entries.map((e) => (
              <AuditRow key={e.id} entry={e} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-5">
              <p className="text-sm text-gray-400 tabular-nums">
                Page {page + 1} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="gap-1.5 h-9"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  <ChevronLeft className="w-4 h-4" /> Previous
                </Button>
                <Button
                  variant="outline"
                  className="gap-1.5 h-9"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
