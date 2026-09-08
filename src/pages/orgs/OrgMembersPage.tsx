import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getMembers, inviteMember, removeMember, type Member } from '@/api/orgs'
import { getProjects } from '@/api/projects'
import { getCustomRoles } from '@/api/roles'
import { MEMBER_ROLES, type MemberRole } from '@/api/abac'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import ApiError from '@/components/ApiError'
import { Users, Plus, Trash2, Crown, Shield, Eye, UserRound } from 'lucide-react'
import { cn } from '@/lib/utils'

const ROLE_STYLE: Record<MemberRole, { badge: string; icon: typeof Crown; blurb: string }> = {
  OWNER: {
    badge: 'bg-violet-50 text-violet-700 border-violet-200',
    icon: Crown,
    blurb: 'Everything, including the production-only actions.',
  },
  ADMIN: {
    badge: 'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]',
    icon: Shield,
    blurb: 'Manage projects, flags and members, but not production-elevated actions.',
  },
  VIEWER: {
    badge: 'bg-slate-100 text-slate-600 border-slate-200',
    icon: Eye,
    blurb: 'Read-only, across every project in the organisation.',
  },
  MEMBER: {
    badge: 'bg-slate-50 text-slate-500 border-slate-200',
    icon: UserRound,
    blurb: 'Sees only the projects they are granted. Use this to scope someone to one project.',
  },
}

/**
 * A draft row of project access in the invite dialog.
 *
 * Held loosely on purpose: a row with a project but no role yet is a normal intermediate state
 * while someone fills the form in, so incomplete rows are dropped on submit rather than blocking
 * it. The backend applies whatever survives in one transaction.
 */
interface GrantRow {
  id: number
  projectId: string
  roleKind: 'BUILT_IN' | 'CUSTOM'
  role?: MemberRole
  customRoleId?: string
}

let nextRowId = 1

const displayName = (m: Member) =>
  [m.firstName, m.lastName].filter(Boolean).join(' ').trim() || m.email

export default function OrgMembersPage() {
  const { orgId } = useParams<{ orgId: string }>()
  const qc = useQueryClient()

  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [isOrgAdmin, setIsOrgAdmin] = useState(false)
  /**
   * Rows of project access to confer with the invite. Kept as draft rows rather than validated
   * grants so a half-filled row can sit on screen without blocking the others.
   */
  const [grantRows, setGrantRows] = useState<GrantRow[]>([])
  const [removeTarget, setRemoveTarget] = useState<Member | null>(null)

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['org-members', orgId],
    queryFn: () => getMembers(orgId!),
    enabled: !!orgId,
  })

  // Both only load while the dialog is open; the members table itself needs neither.
  const { data: projects = [] } = useQuery({
    queryKey: ['projects', orgId],
    queryFn: () => getProjects(orgId!),
    enabled: !!orgId && open,
  })

  const { data: customRoles = [] } = useQuery({
    queryKey: ['custom-roles', orgId],
    queryFn: () => getCustomRoles(orgId!),
    enabled: !!orgId && open,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['org-members', orgId] })

  const invite = useMutation({
    mutationFn: () =>
      inviteMember(orgId!, {
        email: email.trim(),
        // The organisation role is only about administering the organisation now. Project reach
        // comes from the rows below, which is why this is a checkbox and not a four-way select.
        role: isOrgAdmin ? 'ADMIN' : 'MEMBER',
        projectGrants: grantRows
          .filter((r) => r.projectId && (r.roleKind === 'BUILT_IN' ? r.role : r.customRoleId))
          .map((r) =>
            r.roleKind === 'BUILT_IN'
              ? { projectId: r.projectId, role: r.role }
              : { projectId: r.projectId, customRoleId: r.customRoleId }
          ),
      }),
    onSuccess: () => {
      invalidate()
      closeDialog()
    },
  })

  const closeDialog = () => {
    setOpen(false)
    setEmail('')
    setIsOrgAdmin(false)
    setGrantRows([])
    invite.reset()
  }

  const updateRow = (id: number, patch: Partial<GrantRow>) =>
    setGrantRows((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)))

  const addRow = () =>
    setGrantRows((rows) => [
      ...rows,
      { id: nextRowId++, projectId: '', roleKind: 'BUILT_IN', role: 'VIEWER' },
    ])

  const remove = useMutation({
    mutationFn: () => removeMember(orgId!, removeTarget!.userId),
    onSuccess: () => {
      invalidate()
      setRemoveTarget(null)
    },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Members</h1>
          {!isLoading && (
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
              {members.length}
            </span>
          )}
        </div>
        <Button onClick={() => setOpen(true)} className="gap-2 h-9 px-4 shadow-sm">
          <Plus className="w-4 h-4" />
          Add member
        </Button>
      </div>

      <p className="text-sm text-slate-500 -mt-2 max-w-2xl">
        The organisation role is the baseline. A project grant adds to it, never takes away, so an
        OWNER here stays an OWNER everywhere. Pick MEMBER for someone who should reach only the
        projects you grant them.
      </p>

      {isLoading && (
        <div className="h-40 bg-white rounded-2xl border border-slate-200 animate-pulse" />
      )}

      {!isLoading && members.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border-2 border-dashed border-slate-200 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
            <Users className="w-8 h-8 text-slate-300" />
          </div>
          <p className="text-lg font-semibold text-slate-800 mb-1">No members yet</p>
          <p className="text-sm text-slate-400 max-w-xs">
            Add teammates to give them a baseline role across this organisation.
          </p>
        </div>
      )}

      {!isLoading && members.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/80 border-b border-slate-200">
                <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="px-5 py-3">Member</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3 w-12" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {members.map((m) => {
                  const style = ROLE_STYLE[m.role]
                  const RoleIcon = style.icon
                  return (
                    <tr key={m.userId} className="group hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#2563EB] flex items-center justify-center text-xs font-bold text-white shrink-0">
                            {displayName(m).charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-800 truncate">{displayName(m)}</p>
                            <p className="text-xs text-slate-400 truncate">{m.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border',
                            style.badge
                          )}
                        >
                          <RoleIcon className="w-3 h-3" />
                          {m.role}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <button
                          onClick={() => setRemoveTarget(m)}
                          className="p-1.5 rounded-lg text-slate-300 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                          title="Remove from organisation"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : closeDialog())}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teammate@company.com"
                autoFocus
              />
              <p className="text-xs text-gray-400">
                The person must already have an account. Adding someone does not create one.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Project access</Label>
                <button
                  type="button"
                  onClick={addRow}
                  className="inline-flex items-center gap-1 text-xs font-medium text-[#2563EB] hover:text-[#1D4ED8]"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add project
                </button>
              </div>

              {grantRows.length === 0 && (
                <p className="text-xs text-gray-400">
                  None yet. They will be able to sign in and see the organisation, but no project
                  until you grant one.
                </p>
              )}

              {grantRows.map((row) => (
                <div key={row.id} className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <Select
                      value={row.projectId}
                      onValueChange={(v) => updateRow(row.id, { projectId: v ?? '' })}
                    >
                      <SelectTrigger className="h-9">
                        {/*
                          Base UI renders the raw value unless given a formatter, and these
                          values are UUIDs — without this the trigger shows the id.
                        */}
                        <SelectValue>
                          {(v) =>
                            projects.find((p) => p.id === v)?.name ?? (
                              <span className="text-slate-400">Project</span>
                            )
                          }
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {projects.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <span className="text-xs text-slate-300 shrink-0">as</span>
                  <div className="flex-1 min-w-0">
                    <Select
                      value={
                        row.roleKind === 'BUILT_IN'
                          ? `role:${row.role}`
                          : `custom:${row.customRoleId}`
                      }
                      onValueChange={(v) => {
                        const value = v ?? ''
                        if (value.startsWith('role:')) {
                          updateRow(row.id, {
                            roleKind: 'BUILT_IN',
                            role: value.slice(5) as MemberRole,
                            customRoleId: undefined,
                          })
                        } else {
                          updateRow(row.id, {
                            roleKind: 'CUSTOM',
                            customRoleId: value.slice(7),
                            role: undefined,
                          })
                        }
                      }}
                    >
                      <SelectTrigger className="h-9">
                        {/* Values are prefixed to keep built-in and custom roles apart in one
                            list; the prefix is machinery, not something to show. */}
                        <SelectValue>
                          {(v) => {
                            const value = (v as string | null) ?? ''
                            if (value.startsWith('role:')) return value.slice(5)
                            const custom = customRoles.find((c) => c.id === value.slice(7))
                            return custom?.name ?? <span className="text-slate-400">Role</span>
                          }}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {/* Built-in and custom roles share one list because a grant carries
                            exactly one of them; two selects would imply you could pick both.
                            MEMBER is absent: as a grant it would confer nothing. */}
                        {MEMBER_ROLES.filter((r) => r !== 'MEMBER').map((r) => (
                          <SelectItem key={r} value={`role:${r}`}>
                            {r}
                          </SelectItem>
                        ))}
                        {customRoles.map((cr) => (
                          <SelectItem key={cr.id} value={`custom:${cr.id}`}>
                            {cr.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <button
                    type="button"
                    onClick={() => setGrantRows((rows) => rows.filter((r) => r.id !== row.id))}
                    className="p-1.5 rounded-lg text-slate-300 hover:text-red-600 hover:bg-red-50 shrink-0"
                    title="Remove"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <label className="flex items-start gap-2.5 rounded-xl border border-slate-200 px-3 py-2.5 cursor-pointer hover:bg-slate-50 transition-colors">
              <input
                type="checkbox"
                className="accent-[#2563EB] w-4 h-4 mt-0.5"
                checked={isOrgAdmin}
                onChange={(e) => setIsOrgAdmin(e.target.checked)}
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-slate-800">
                  Also an organisation admin
                </span>
                <span className="block text-xs text-slate-400 leading-snug">
                  Can add people and manage roles. Grants no project access on its own.
                </span>
              </span>
            </label>

            <ApiError error={invite.error} />
            <Button
              className="w-full"
              onClick={() => invite.mutate()}
              disabled={invite.isPending || !email.trim()}
            >
              {invite.isPending ? 'Adding...' : 'Add member'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!removeTarget}
        onOpenChange={(o) => {
          if (!o) {
            setRemoveTarget(null)
            remove.reset()
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove member</DialogTitle>
          </DialogHeader>
          <div className="pt-1 space-y-4">
            <p className="text-sm text-gray-600">
              Remove{' '}
              <span className="font-semibold text-gray-900">
                {removeTarget && displayName(removeTarget)}
              </span>{' '}
              from this organisation? Their project grants go with them.
            </p>
            <ApiError error={remove.error} />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setRemoveTarget(null)}>
                Cancel
              </Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                onClick={() => remove.mutate()}
                disabled={remove.isPending}
              >
                {remove.isPending ? 'Removing...' : 'Remove'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
