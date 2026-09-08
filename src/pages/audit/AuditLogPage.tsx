import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { getAuditLog, type AuditAction, type AuditLogEntry } from '@/api/audit'
import { Button } from '@/components/ui/button'
import ApiError from '@/components/ApiError'
import { ScrollText, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 20

/** Colour by blast radius: destructive red, permission-changing violet, everything else neutral. */
const ACTION_STYLE: Partial<Record<AuditAction, string>> = {
  DELETE: 'bg-red-50 text-red-700 border-red-200',
  REMOVE_MEMBER: 'bg-red-50 text-red-700 border-red-200',
  ARCHIVE: 'bg-amber-50 text-amber-700 border-amber-200',
  ROTATE_API_KEY: 'bg-amber-50 text-amber-700 border-amber-200',
  GRANT_PERMISSION: 'bg-violet-50 text-violet-700 border-violet-200',
  REVOKE_PERMISSION: 'bg-violet-50 text-violet-700 border-violet-200',
  CREATE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  UNARCHIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
}

const humanise = (value: string) => value.toLowerCase().replace(/_/g, ' ')

const formatTime = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString()
}

/** Entity snapshots vary per type, so they are shown as raw JSON rather than guessed at. */
function StateDiff({ entry }: { entry: AuditLogEntry }) {
  const [open, setOpen] = useState(false)
  if (!entry.beforeState && !entry.afterState) {
    return <span className="text-xs text-slate-300 italic">No snapshot</span>
  }

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 text-xs font-medium text-[#2563EB] hover:text-[#1D4ED8]"
      >
        <ChevronDown className={cn('w-3 h-3 transition-transform', !open && '-rotate-90')} />
        {open ? 'Hide' : 'Show'} snapshot
      </button>
      {open && (
        <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
          {(['beforeState', 'afterState'] as const).map((key) => (
            <div key={key} className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                {key === 'beforeState' ? 'Before' : 'After'}
              </p>
              <pre className="text-[11px] bg-slate-50 border border-slate-200 rounded-lg p-2 overflow-x-auto text-slate-600">
                {entry[key] ? JSON.stringify(entry[key], null, 2) : '-'}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function AuditLogPage() {
  const { orgId } = useParams<{ orgId: string }>()
  const [page, setPage] = useState(0)

  const { data, isLoading, error } = useQuery({
    queryKey: ['audit-log', orgId, page],
    queryFn: () => getAuditLog(orgId!, { page, size: PAGE_SIZE }),
    enabled: !!orgId,
    // Keeps the table on screen while the next page loads instead of flashing the skeleton.
    placeholderData: keepPreviousData,
  })

  const entries = data?.content ?? []
  const totalPages = data?.totalPages ?? 0
  const totalElements = data?.totalElements ?? 0

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Audit log</h1>
        {!isLoading && !error && (
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
            {totalElements}
          </span>
        )}
      </div>

      <p className="text-sm text-slate-500 -mt-2 max-w-2xl">
        Every write the backend records for this organisation, newest first, including the
        permission changes that grants and custom roles produce.
      </p>

      <ApiError error={error} />

      {isLoading && (
        <div className="h-64 bg-white rounded-2xl border border-slate-200 animate-pulse" />
      )}

      {!isLoading && !error && entries.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border-2 border-dashed border-slate-200 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
            <ScrollText className="w-8 h-8 text-slate-300" />
          </div>
          <p className="text-lg font-semibold text-slate-800 mb-1">Nothing recorded yet</p>
          <p className="text-sm text-slate-400 max-w-xs">
            Entries appear as people create, change and remove things in this organisation.
          </p>
        </div>
      )}

      {!isLoading && !error && entries.length > 0 && (
        <>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/80 border-b border-slate-200">
                  <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="px-5 py-3 whitespace-nowrap">When</th>
                    <th className="px-5 py-3">Action</th>
                    <th className="px-5 py-3">Entity</th>
                    <th className="px-5 py-3">Actor</th>
                    <th className="px-5 py-3">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {entries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-slate-50/60 transition-colors align-top">
                      <td className="px-5 py-3.5 whitespace-nowrap text-xs text-slate-500">
                        {formatTime(entry.createdAt)}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={cn(
                            'inline-block text-[11px] font-semibold px-2.5 py-1 rounded-full border capitalize whitespace-nowrap',
                            ACTION_STYLE[entry.action] ?? 'bg-slate-50 text-slate-600 border-slate-200'
                          )}
                        >
                          {humanise(entry.action)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-slate-700 capitalize whitespace-nowrap">
                          {humanise(entry.entityType)}
                        </p>
                        <code className="text-[11px] text-slate-400 font-mono">
                          {entry.entityId?.slice(0, 8) ?? '-'}
                        </code>
                      </td>
                      <td className="px-5 py-3.5">
                        <code className="text-[11px] text-slate-500 font-mono">
                          {entry.actorUserId?.slice(0, 8) ?? '-'}
                        </code>
                      </td>
                      <td className="px-5 py-3.5 min-w-[220px]">
                        <StateDiff entry={entry} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400">
              Page {page + 1} of {Math.max(totalPages, 1)}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => setPage((p) => p + 1)}
                disabled={page + 1 >= totalPages}
              >
                Next
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
