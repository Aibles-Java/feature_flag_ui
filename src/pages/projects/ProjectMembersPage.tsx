import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getGrants, upsertGrant, revokeGrant, type ProjectGrant } from '@/api/grants'
import { getCustomRoles } from '@/api/roles'
import { getMembers } from '@/api/orgs'
import { MEMBER_ROLES, type MemberRole } from '@/api/abac'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import ApiError from '@/components/ApiError'
import { UserPlus, Users, Trash2, KeyRound, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'

/** A grant carries either a built-in role or a custom role, never both. */
type RoleKind = 'BUILT_IN' | 'CUSTOM'

const grantName = (g: ProjectGrant) =>
  [g.firstName, g.lastName].filter(Boolean).join(' ').trim() || g.email

export default function ProjectMembersPage() {
  const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>()
  const qc = useQueryClient()

  const [open, setOpen] = useState(false)
  const [userId, setUserId] = useState('')
  const [kind, setKind] = useState<RoleKind>('BUILT_IN')
  const [role, setRole] = useState<MemberRole>('VIEWER')
  const [customRoleId, setCustomRoleId] = useState('')
  const [revokeTarget, setRevokeTarget] = useState<ProjectGrant | null>(null)

  const { data: grants = [], isLoading } = useQuery({
    queryKey: ['grants', projectId],
    queryFn: () => getGrants(projectId!),
    enabled: !!projectId,
  })

  // Grants are only meaningful for someone already in the organisation, and the backend has no
  // global user search, so the org member list is the candidate pool.
  const { data: orgMembers = [] } = useQuery({
    queryKey: ['org-members', orgId],
    queryFn: () => getMembers(orgId!),
    enabled: !!orgId && open,
  })

  const { data: customRoles = [] } = useQuery({
    queryKey: ['custom-roles', orgId],
    queryFn: () => getCustomRoles(orgId!),
    enabled: !!orgId,
  })

  const save = useMutation({
    mutationFn: () =>
      upsertGrant(projectId!, {
        userId,
        ...(kind === 'BUILT_IN' ? { role } : { customRoleId }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['grants', projectId] })
      closeDialog()
    },
  })

  const revoke = useMutation({
    mutationFn: () => revokeGrant(projectId!, revokeTarget!.userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['grants', projectId] })
      setRevokeTarget(null)
    },
  })

  const closeDialog = () => {
    setOpen(false)
    setUserId('')
    setKind('BUILT_IN')
    setRole('VIEWER')
    setCustomRoleId('')
    save.reset()
  }

  const canSave = !!userId && (kind === 'BUILT_IN' ? !!role : !!customRoleId)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Project access</h1>
          {!isLoading && (
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
              {grants.length}
            </span>
          )}
        </div>
        <Button
          onClick={() => {
            save.reset()
            setOpen(true)
          }}
          className="gap-2 h-9 px-4 shadow-sm"
        >
          <UserPlus className="w-4 h-4" />
          Grant access
        </Button>
      </div>

      <p className="text-sm text-slate-500 -mt-2 max-w-2xl">
        A grant raises what someone can do on this project. It is unioned with their organisation
        role, so it only ever adds. Listed here are the grants, not everyone who can reach the
        project.
      </p>

      {isLoading && (
        <div className="h-40 bg-white rounded-2xl border border-slate-200 animate-pulse" />
      )}

      {!isLoading && grants.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border-2 border-dashed border-slate-200 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
            <Users className="w-8 h-8 text-slate-300" />
          </div>
          <p className="text-lg font-semibold text-slate-800 mb-1">No project grants</p>
          <p className="text-sm text-slate-400 max-w-sm">
            Everyone here has whatever their organisation role gives them. Add a grant to elevate
            one person on this project alone.
          </p>
        </div>
      )}

      {!isLoading && grants.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/80 border-b border-slate-200">
                <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="px-5 py-3">Member</th>
                  <th className="px-5 py-3">Grants</th>
                  <th className="px-5 py-3 w-12" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {grants.map((g) => (
                  <tr key={g.userId} className="group hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#2563EB] flex items-center justify-center text-xs font-bold text-white shrink-0">
                          {grantName(g).charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 truncate">{grantName(g)}</p>
                          <p className="text-xs text-slate-400 truncate">{g.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      {g.customRoleId ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border bg-violet-50 text-violet-700 border-violet-200">
                          <KeyRound className="w-3 h-3" />
                          {g.customRoleName ?? 'Custom role'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]">
                          <Shield className="w-3 h-3" />
                          {g.role}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <button
                        onClick={() => setRevokeTarget(g)}
                        className="p-1.5 rounded-lg text-slate-300 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                        title="Revoke grant"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Grant project access</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label>Member</Label>
              <Select value={userId} onValueChange={(v) => setUserId(v ?? '')}>
                <SelectTrigger>
                  {/* Base UI shows the raw value without a formatter, and that value is a UUID. */}
                  <SelectValue>
                    {(v) => {
                      const m = orgMembers.find((om) => om.userId === v)
                      if (!m) {
                        return (
                          <span className="text-slate-400">Select an organisation member</span>
                        )
                      }
                      return [m.firstName, m.lastName].filter(Boolean).join(' ').trim() || m.email
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {orgMembers.map((m) => (
                    <SelectItem key={m.userId} value={m.userId}>
                      {[m.firstName, m.lastName].filter(Boolean).join(' ').trim() || m.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {orgMembers.length === 0 && (
                <p className="text-xs text-gray-400">
                  No organisation members to grant to yet. Add them under Members first.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Confer</Label>
              <div className="grid grid-cols-2 gap-2">
                {(['BUILT_IN', 'CUSTOM'] as RoleKind[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setKind(k)}
                    className={cn(
                      'px-3 py-2 rounded-lg border text-sm font-medium transition-colors',
                      kind === k
                        ? 'border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8]'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    )}
                  >
                    {k === 'BUILT_IN' ? 'Built-in role' : 'Custom role'}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400">
                A grant carries one or the other, never both.
              </p>
            </div>

            {kind === 'BUILT_IN' ? (
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select value={role} onValueChange={(v) => setRole(v as MemberRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MEMBER_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>Custom role</Label>
                <Select value={customRoleId} onValueChange={(v) => setCustomRoleId(v ?? '')}>
                  <SelectTrigger>
                    <SelectValue>
                      {(v) =>
                        customRoles.find((r) => r.id === v)?.name ?? (
                          <span className="text-slate-400">Select a custom role</span>
                        )
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {customRoles.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {customRoles.length === 0 && (
                  <p className="text-xs text-gray-400">
                    This organisation has no custom roles yet.
                  </p>
                )}
              </div>
            )}

            <ApiError error={save.error} />

            <Button
              className="w-full"
              onClick={() => save.mutate()}
              disabled={save.isPending || !canSave}
            >
              {save.isPending ? 'Saving...' : 'Grant access'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!revokeTarget}
        onOpenChange={(o) => {
          if (!o) {
            setRevokeTarget(null)
            revoke.reset()
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Revoke grant</DialogTitle>
          </DialogHeader>
          <div className="pt-1 space-y-4">
            <p className="text-sm text-gray-600">
              Revoke the project grant for{' '}
              <span className="font-semibold text-gray-900">
                {revokeTarget && grantName(revokeTarget)}
              </span>
              ? They keep whatever their organisation role already gives them.
            </p>
            <ApiError error={revoke.error} />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setRevokeTarget(null)}>
                Cancel
              </Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                onClick={() => revoke.mutate()}
                disabled={revoke.isPending}
              >
                {revoke.isPending ? 'Revoking...' : 'Revoke'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
