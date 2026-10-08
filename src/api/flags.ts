import api from './axios'
import { pageItems, toPage, type Page } from './page'

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
  rolloutPercent: number
  lastEvaluatedAt?: string | null
}

/** Server clamps `size` to 100 (F12); D-18: page-based paging, never "load more". */
export const MAX_FLAGS_PAGE_SIZE = 100

/** One page of flags. `page` is 0-based (Spring). Size is clamped to {@link MAX_FLAGS_PAGE_SIZE}. */
export const getFlags = (projectId: string, page = 0, size = MAX_FLAGS_PAGE_SIZE) =>
  api
    .get<Page<FeatureFlag>>('/flags', {
      params: { projectId, page, size: Math.min(size, MAX_FLAGS_PAGE_SIZE) },
    })
    .then((r) => toPage(r.data))

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

export const updateFlagState = (
  flagId: string,
  envId: string,
  data: { enabled: boolean; value?: string; rolloutPercent?: number },
) =>
  api.put<FlagState>(`/flags/${flagId}/environments/${envId}`, data).then((r) => r.data)
