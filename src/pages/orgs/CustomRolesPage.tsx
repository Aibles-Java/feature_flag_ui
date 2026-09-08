import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getCustomRoles,
  createCustomRole,
  updateCustomRole,
  deleteCustomRole,
  type CustomRole,
} from '@/api/roles'
import { ACTION_GROUPS, actionLabel, conferableActions, type Action, type MemberRole } from '@/api/abac'
import { useOrgRole } from '@/api/useOrgRole'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import ApiError from '@/components/ApiError'
import { KeyRound, Plus, Pencil, Trash2, ShieldAlert, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Editing surface for an org-scoped custom role.
 *
 * `conferable` is the set the current user may hand out — derived from their org role, which at
 * org scope determines the action set exactly (see `useOrgRole`). Anything outside it is
 * disabled with a reason, because the backend would refuse the save anyway
 * ("A custom role cannot include actions you do not have").
 *
 * `conferable === null` means the role is not known yet. Everything stays enabled in that case:
 * a slow request must not look like a loss of permissions, and the backend is still the real
 * gate.
 */
function ActionPicker({
  selected,
  conferable,
  role,
  onToggle,
}: {
  selected: Set<Action>
  conferable: Set<Action> | null
  role: MemberRole | null
  onToggle: (action: Action) => void
}) {
  return (
    <div className="space-y-4 max-h-[45vh] overflow-y-auto pr-1">
      {ACTION_GROUPS.map((group) => {
        const isProduction = group.label === 'Production'
        return (
          <div key={group.label}>
            <div className="flex items-center gap-1.5 mb-1.5">
              {isProduction && <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />}
              <p
                className={cn(
                  'text-[10px] font-bold uppercase tracking-wider',
                  isProduction ? 'text-amber-600' : 'text-slate-400'
                )}
              >
                {group.label}
              </p>
            </div>
            {group.hint && (
              <p className="text-xs text-slate-400 mb-2 leading-snug">{group.hint}</p>
            )}
            <div className="grid grid-cols-2 gap-1.5">
              {group.actions.map((action) => {
                const checked = selected.has(action)
                // Unknown role => offer everything; the backend decides.
                const locked = conferable !== null && !conferable.has(action)
                return (
                  <label
                    key={action}
                    title={
                      locked
                        ? `Your ${role} role does not include ${actionLabel(action)}, so you cannot grant it to anyone else.`
                        : undefined
                    }
                    className={cn(
                      'flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs transition-colors',
                      locked
                        ? 'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed'
                        : checked
                          ? isProduction
                            ? 'border-amber-300 bg-amber-50 text-amber-900 font-medium cursor-pointer'
                            : 'border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8] font-medium cursor-pointer'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer'
                    )}
                  >
                    <input
                      type="checkbox"
                      className="accent-[#2563EB] w-3.5 h-3.5"
                      checked={checked}
                      disabled={locked}
                      onChange={() => onToggle(action)}
                    />
                    <span className="truncate">{actionLabel(action)}</span>
                    {locked && <Lock className="w-3 h-3 shrink-0 ml-auto" />}
                  </label>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

const EMPTY_FORM = { name: '', actions: new Set<Action>() }

export default function CustomRolesPage() {
  const { orgId } = useParams<{ orgId: string }>()
  const qc = useQueryClient()
  const myRole = useOrgRole(orgId)
  const conferable = conferableActions(myRole)

  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<{ name: string; actions: Set<Action> }>(EMPTY_FORM)
  /** Non-null while editing; the dialog is shared between create and edit. */
  const [editTarget, setEditTarget] = useState<CustomRole | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CustomRole | null>(null)

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ['custom-roles', orgId],
    queryFn: () => getCustomRoles(orgId!),
    enabled: !!orgId,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['custom-roles', orgId] })

  const save = useMutation({
    mutationFn: () => {
      const payload = { name: form.name.trim(), actions: [...form.actions] }
      return editTarget
        ? updateCustomRole(orgId!, editTarget.id, payload)
        : createCustomRole(orgId!, payload)
    },
    onSuccess: () => {
      invalidate()
      closeDialog()
    },
  })

  const remove = useMutation({
    mutationFn: () => deleteCustomRole(orgId!, deleteTarget!.id),
    onSuccess: () => {
      invalidate()
      setDeleteTarget(null)
    },
  })

  const closeDialog = () => {
    setOpen(false)
    setEditTarget(null)
    setForm(EMPTY_FORM)
    save.reset()
  }

  const openCreate = () => {
    setEditTarget(null)
    setForm(EMPTY_FORM)
    save.reset()
    setOpen(true)
  }

  const openEdit = (role: CustomRole) => {
    setEditTarget(role)
    setForm({ name: role.name, actions: new Set(role.actions) })
    save.reset()
    setOpen(true)
  }

  const toggle = (action: Action) =>
    setForm((f) => {
      const actions = new Set(f.actions)
      if (actions.has(action)) actions.delete(action)
      else actions.add(action)
      return { ...f, actions }
    })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Custom roles</h1>
          {!isLoading && (
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
              {roles.length}
            </span>
          )}
        </div>
        <Button onClick={openCreate} className="gap-2 h-9 px-4 shadow-sm">
          <Plus className="w-4 h-4" />
          New role
        </Button>
      </div>

      <p className="text-sm text-slate-500 -mt-2 max-w-2xl">
        A custom role is a named set of actions, scoped to this organisation. Attach one to a
        project grant when OWNER, ADMIN and VIEWER are all the wrong shape.
      </p>

      {isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {[1, 2].map((i) => (
            <div key={i} className="h-36 bg-white rounded-2xl border border-slate-200 animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && roles.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border-2 border-dashed border-slate-200 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
            <KeyRound className="w-8 h-8 text-slate-300" />
          </div>
          <p className="text-lg font-semibold text-slate-800 mb-1">No custom roles yet</p>
          <p className="text-sm text-slate-400 mb-6 max-w-sm">
            Build one when a teammate needs something narrower than a built-in role, like toggling
            flags without being able to delete them.
          </p>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="w-4 h-4" />
            New role
          </Button>
        </div>
      )}

      {!isLoading && roles.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {roles.map((role) => (
            <div
              key={role.id}
              className="group bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-slate-300 transition-all"
            >
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-xl bg-[#EFF6FF] flex items-center justify-center shrink-0">
                  <KeyRound className="w-5 h-5 text-[#2563EB]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-bold text-slate-900 truncate">{role.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {role.actions.length} action{role.actions.length === 1 ? '' : 's'}
                  </p>
                </div>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button
                    onClick={() => openEdit(role)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-[#2563EB] hover:bg-[#EFF6FF] transition-colors"
                    title="Edit role"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(role)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    title="Delete role"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-1">
                {role.actions.slice(0, 6).map((a) => (
                  <span
                    key={a}
                    className={cn(
                      'text-[10px] font-medium px-2 py-0.5 rounded-full border',
                      a.endsWith('_PRODUCTION')
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-slate-50 text-slate-600 border-slate-200'
                    )}
                  >
                    {actionLabel(a)}
                  </span>
                ))}
                {role.actions.length > 6 && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                    +{role.actions.length - 6} more
                  </span>
                )}
                {role.actions.length === 0 && (
                  <span className="text-xs text-slate-300 italic">Grants nothing yet</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editTarget ? 'Edit role' : 'New custom role'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Flag operator"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Actions</Label>
                <span className="text-xs text-slate-400">{form.actions.size} selected</span>
              </div>
              {conferable && myRole !== 'OWNER' && (
                <p className="text-xs text-slate-400 leading-snug">
                  Greyed-out actions are outside your {myRole} role. You can only grant what you
                  already hold, so the backend would refuse a role containing them.
                </p>
              )}
              <ActionPicker
                selected={form.actions}
                conferable={conferable}
                role={myRole}
                onToggle={toggle}
              />
            </div>

            <ApiError error={save.error} />

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={closeDialog}>
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={() => save.mutate()}
                disabled={save.isPending || !form.name.trim()}
              >
                {save.isPending ? 'Saving...' : editTarget ? 'Save changes' : 'Create role'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(o) => {
          if (!o) {
            setDeleteTarget(null)
            remove.reset()
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete role</DialogTitle>
          </DialogHeader>
          <div className="pt-1 space-y-4">
            <p className="text-sm text-gray-600">
              Delete <span className="font-semibold text-gray-900">{deleteTarget?.name}</span>? Any
              project grant using it loses the capability it conferred.
            </p>
            <ApiError error={remove.error} />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                onClick={() => remove.mutate()}
                disabled={remove.isPending}
              >
                {remove.isPending ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
