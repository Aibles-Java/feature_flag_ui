import api from './axios'
import { pageItems, type Page } from './page'

/**
 * One SDK key for one environment.
 *
 * The plaintext is absent by design: the backend stores keys hashed and hands the value back
 * exactly once, from create and rotate. {@link ApiKeySecret} is that one moment. `keyPrefix` is
 * the only part that survives, and exists so a key can be told apart in a list without being
 * readable.
 */
export interface ApiKey {
  id: string
  environmentId: string
  name: string
  /** First characters of the key, enough to recognise it and not enough to use it. */
  keyPrefix: string
  expiresAt: string | null
  revokedAt: string | null
  lastUsedAt: string | null
  createdBy: string | null
  createdAt: string
  /** Computed by the backend against its own clock: neither revoked nor past expiry. */
  active: boolean
}

/** Returned only by create and rotate. Losing `apiKey` here means rotating again. */
export interface ApiKeySecret {
  key: ApiKey
  apiKey: string
}

export const getApiKeys = (environmentId: string) =>
  api
    .get<Page<ApiKey>>(`/environments/${environmentId}/api-keys`)
    .then((r) => pageItems(r.data))

export const createApiKey = (
  environmentId: string,
  data: { name: string; expiresAt?: string | null }
) => api.post<ApiKeySecret>(`/environments/${environmentId}/api-keys`, data).then((r) => r.data)

export const revokeApiKey = (environmentId: string, keyId: string) =>
  api.delete(`/environments/${environmentId}/api-keys/${keyId}`)

/**
 * Issues a replacement and decides how long the old key keeps working.
 *
 * `graceHours: 0` is a hard cutover — every SDK still holding the old key starts failing at once.
 * Anything above it is the reason the endpoint takes a parameter: both keys authenticate while
 * the fleet redeploys. Capped at 720 (30 days) by the backend.
 */
export const rotateApiKey = (environmentId: string, keyId: string, graceHours = 0) =>
  api
    .post<ApiKeySecret>(`/environments/${environmentId}/api-keys/${keyId}/rotate`, { graceHours })
    .then((r) => r.data)
