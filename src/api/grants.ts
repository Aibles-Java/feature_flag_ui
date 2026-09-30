import api from './axios'
import { pageItems, type Page } from './page'
import type { MemberRole } from './abac'

/**
 * A permission grant elevates one user on one **project**.
 *
 * Grants only ever *add* capability: the backend unions them with the user's org role, so a
 * narrow grant never demotes an org OWNER/ADMIN. `role` and `customRoleId` are mutually
 * exclusive — a grant carries either a built-in role or an org-scoped custom role.
 */
export interface ProjectGrant {
  userId: string
  email: string
  firstName: string
  lastName: string
  role: MemberRole | null
  customRoleId: string | null
  customRoleName: string | null
}

export interface UpsertGrantPayload {
  userId: string
  role?: MemberRole
  customRoleId?: string
}

export const getGrants = (projectId: string) =>
  api
    .get<Page<ProjectGrant>>(`/projects/${projectId}/members`)
    .then((r) => pageItems(r.data))

/**
 * Creates or replaces the grant for one user. The backend refuses (403) if the caller does not
 * already hold every action being conferred — "you cannot grant beyond your own".
 */
export const upsertGrant = (projectId: string, data: UpsertGrantPayload) =>
  api.post<ProjectGrant>(`/projects/${projectId}/members`, data).then((r) => r.data)

export const revokeGrant = (projectId: string, userId: string) =>
  api.delete(`/projects/${projectId}/members/${userId}`)
