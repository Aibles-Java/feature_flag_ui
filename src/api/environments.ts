import api from './axios'
import { toList, type PageParams, type PageResponse } from './types'

export interface Environment {
  id: string
  name: string
  description?: string
  projectId: string
  apiKey: string
  createdAt: string
}

export const getEnvironments = (projectId: string, params?: PageParams) =>
  api
    .get<PageResponse<Environment>>('/environments', { params: { projectId, ...params } })
    .then((r) => toList(r.data))

export const getEnvironment = (id: string) =>
  api.get<Environment>(`/environments/${id}`).then((r) => r.data)

export const createEnvironment = (data: { projectId: string; name: string; description?: string }) =>
  api.post<Environment>('/environments', data).then((r) => r.data)

export const updateEnvironment = (id: string, data: { name?: string; description?: string }) =>
  api.put<Environment>(`/environments/${id}`, data).then((r) => r.data)

export const deleteEnvironment = (id: string) => api.delete(`/environments/${id}`)

export const rotateApiKey = (id: string) =>
  api.post<{ apiKey: string }>(`/environments/${id}/api-key/rotate`).then((r) => r.data)
