import api from './axios'
import type { MemberRole } from './abac'
import { pageItems, type Page } from './page'

export interface Organization {
  id: string
  name: string
  slug: string
  createdAt: string
}

export interface Member {
  userId: string
  email: string
  firstName: string
  lastName: string
  role: MemberRole
}

export const getOrgs = () =>
  api.get<Page<Organization>>('/organisations').then((r) => pageItems(r.data))

export const getOrg = (id: string) =>
  api.get<Organization>(`/organisations/${id}`).then((r) => r.data)

export const createOrg = (data: { name: string; slug: string }) =>
  api.post<Organization>('/organisations', data).then((r) => r.data)

export const updateOrg = (id: string, data: { name: string }) =>
  api.put<Organization>(`/organisations/${id}`, data).then((r) => r.data)

export const deleteOrg = (id: string) => api.delete(`/organisations/${id}`)

export const getMembers = (orgId: string) =>
  api.get<Page<Member>>(`/organisations/${orgId}/members`).then((r) => pageItems(r.data))

/**
 * Adds someone by the address the admin already knows.
 *
 * The backend accepts `email` or `userId` and resolves the account itself. Email is what a UI can
 * actually ask for: there is no user-directory endpoint, so the frontend has no way to turn an
 * address into an id, which is why this used to demand a raw UUID.
 */
/** One project's worth of access, conferred as part of the invite. */
export interface ProjectGrantSpec {
  projectId: string
  role?: MemberRole
  customRoleId?: string
}

export interface InviteMemberPayload {
  email: string
  role: MemberRole
  /**
   * Applied in the same transaction as the membership, so a refusal on any one of them leaves
   * no member behind. Omit or leave empty to add someone with no project access at all.
   */
  projectGrants?: ProjectGrantSpec[]
}

export const inviteMember = (orgId: string, data: InviteMemberPayload) =>
  api.post<Member>(`/organisations/${orgId}/members`, data).then((r) => r.data)

export const removeMember = (orgId: string, userId: string) =>
  api.delete(`/organisations/${orgId}/members/${userId}`)
