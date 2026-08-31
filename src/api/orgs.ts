import api from './axios'
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
  role: 'OWNER' | 'ADMIN' | 'VIEWER'
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

export const inviteMember = (orgId: string, data: { userId: string; role: string }) =>
  api.post<Member>(`/organisations/${orgId}/members`, data).then((r) => r.data)

export const removeMember = (orgId: string, userId: string) =>
  api.delete(`/organisations/${orgId}/members/${userId}`)
