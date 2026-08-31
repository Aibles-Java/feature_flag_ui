import api from './axios'
import { pageItems, type Page } from './page'

export interface Project {
  id: string
  name: string
  description?: string
  organisationId: string
  createdAt: string
}

export const getProjects = (organisationId: string) =>
  api
    .get<Page<Project>>('/projects', { params: { organisationId } })
    .then((r) => pageItems(r.data))

export const getProject = (id: string) =>
  api.get<Project>(`/projects/${id}`).then((r) => r.data)

export const createProject = (data: { organisationId: string; name: string; description?: string }) =>
  api.post<Project>('/projects', data).then((r) => r.data)

export const updateProject = (id: string, data: { name?: string; description?: string }) =>
  api.put<Project>(`/projects/${id}`, data).then((r) => r.data)

export const deleteProject = (id: string) => api.delete(`/projects/${id}`)
