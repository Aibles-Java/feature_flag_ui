import api from './axios'
import { pageItems, type Page } from './page'
import type { Action } from './abac'

/**
 * A custom role is an org-scoped named set of `Action`s. It exists so a grant can confer
 * something narrower than OWNER/ADMIN/VIEWER.
 *
 * Worth knowing: a grant carrying a custom role is only honoured by the backend's `check(...)`
 * path. The legacy `requireRole*` adapters have no built-in role to compare against, so any
 * backend call site still on an adapter is invisible to custom roles.
 */
export interface CustomRole {
  id: string
  organizationId: string
  name: string
  actions: Action[]
}

export const getCustomRoles = (orgId: string) =>
  api
    .get<Page<CustomRole>>(`/organisations/${orgId}/roles`)
    .then((r) => pageItems(r.data))

/**
 * The backend refuses (403) if the set contains an action the caller does not hold at org
 * scope — "A custom role cannot include actions you do not have". The UI cannot pre-filter the
 * checklist to avoid that: no endpoint exposes the caller's effective action set.
 */
export const createCustomRole = (orgId: string, data: { name: string; actions: Action[] }) =>
  api.post<CustomRole>(`/organisations/${orgId}/roles`, data).then((r) => r.data)

export const updateCustomRole = (
  orgId: string,
  roleId: string,
  data: { name: string; actions: Action[] }
) => api.put<CustomRole>(`/organisations/${orgId}/roles/${roleId}`, data).then((r) => r.data)

export const deleteCustomRole = (orgId: string, roleId: string) =>
  api.delete(`/organisations/${orgId}/roles/${roleId}`)
