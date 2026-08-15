import api from './axios'
import { toList, type PageParams, type PageResponse } from './types'

/**
 * An environment as returned by read endpoints.
 *
 * **There is no `apiKey` here, and adding one back would be a bug.** The backend stores SDK keys
 * hashed (SHA-256) and returns the plaintext exactly once, from the endpoints that mint it — see
 * {@link EnvironmentSecret}. Declaring `apiKey: string` on this type is what produced a blank
 * Environments page: the field is always `undefined` at runtime, and the UI called `.slice()` on it.
 */
export interface Environment {
  id: string
  name: string
  description?: string
  projectId: string
  createdAt: string
}

/**
 * The one-time response from creating an environment or rotating its key. This is the only moment
 * the plaintext key exists outside the SDK client — it cannot be read back afterwards, so it has to
 * be surfaced to the user immediately or it is lost and the key must be rotated again.
 */
export interface EnvironmentSecret extends Environment {
  apiKey: string
}

export const getEnvironments = (projectId: string, params?: PageParams) =>
  api
    .get<PageResponse<Environment>>('/environments', { params: { projectId, ...params } })
    .then((r) => toList(r.data))

export const getEnvironment = (id: string) =>
  api.get<Environment>(`/environments/${id}`).then((r) => r.data)

/** Returns the plaintext key — the only time it is ever available. */
export const createEnvironment = (data: { projectId: string; name: string; description?: string }) =>
  api.post<EnvironmentSecret>('/environments', data).then((r) => r.data)

export const updateEnvironment = (id: string, data: { name?: string; description?: string }) =>
  api.put<Environment>(`/environments/${id}`, data).then((r) => r.data)

export const deleteEnvironment = (id: string) => api.delete(`/environments/${id}`)

/** Mints a new key and invalidates the old one. Returns the new plaintext, once. */
export const rotateApiKey = (id: string) =>
  api.post<EnvironmentSecret>(`/environments/${id}/api-key/rotate`).then((r) => r.data)
