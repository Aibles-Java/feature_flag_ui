import api from './axios'
import { pageItems, type Page } from './page'

export type FlagValueType = 'BOOLEAN' | 'STRING' | 'INTEGER' | 'JSON'

export interface FeatureFlag {
  id: string
  name: string
  key: string
  description?: string
  valueType: FlagValueType
  archived: boolean
  projectId: string
  createdAt: string
}

export interface FlagState {
  flagId: string
  environmentId: string
  enabled: boolean
  value?: string
}

export const getFlags = (projectId: string) =>
  api.get<Page<FeatureFlag>>('/flags', { params: { projectId } }).then((r) => pageItems(r.data))

export const getFlag = (id: string) => api.get<FeatureFlag>(`/flags/${id}`).then((r) => r.data)

export const createFlag = (data: {
  projectId: string
  name: string
  key: string
  description?: string
  valueType: FlagValueType
}) => api.post<FeatureFlag>('/flags', data).then((r) => r.data)

export const updateFlag = (id: string, data: { name?: string; description?: string }) =>
  api.put<FeatureFlag>(`/flags/${id}`, data).then((r) => r.data)

export const deleteFlag = (id: string) => api.delete(`/flags/${id}`)

export const unarchiveFlag = (id: string) => api.post(`/flags/${id}/unarchive`)

export const getArchivedFlags = (projectId: string) =>
  api
    .get<Page<FeatureFlag>>('/flags/archived', { params: { projectId } })
    .then((r) => pageItems(r.data))

export const getFlagState = (flagId: string, envId: string) =>
  api.get<FlagState>(`/flags/${flagId}/environments/${envId}`).then((r) => r.data)

export const updateFlagState = (flagId: string, envId: string, data: { enabled: boolean; value?: string }) =>
  api.put<FlagState>(`/flags/${flagId}/environments/${envId}`, data).then((r) => r.data)
