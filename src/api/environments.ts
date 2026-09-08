import api from './axios'
import { pageItems, type Page } from './page'
import type { EnvType } from './abac'

/**
 * An environment as returned by the read endpoints.
 *
 * **There is deliberately no `apiKey` here.** The backend stores SDK keys hashed and returns the
 * plaintext only from the endpoints that mint one — see {@link EnvironmentSecret}. Declaring it
 * on this type is what blanked the Environments page: the field is always `undefined` on list
 * data and the card called `.slice()` on it.
 *
 * `type` and the change window are the attributes the backend's ABAC rules read. An environment
 * typed `PRODUCTION` rewrites flag-state updates, archives, key rotations and deletes to their
 * OWNER-only `*_PRODUCTION` counterparts, and confines them to the window when one is set.
 */
export interface Environment {
  id: string
  name: string
  description?: string
  projectId: string
  type: EnvType
  /** Hour-of-day 0-23, inclusive. Null on both fields means "no window - always open". */
  changeWindowStartHour: number | null
  changeWindowEndHour: number | null
  /**
   * IANA zone the window hours are read in. Null means the server's own zone, which is what every
   * window meant before the field existed - so a null here is "unspecified", not "UTC".
   */
  changeWindowTimezone: string | null
  createdAt: string
}

/**
 * The one-time response from creating an environment or rotating its key. This is the only
 * moment the plaintext key exists outside an SDK client: it cannot be read back afterwards, so
 * it has to be surfaced immediately or the key must be rotated again to recover access.
 *
 * Note the backend's create/rotate response is narrower than a read - it carries the key but not
 * the ABAC attributes, so callers that need `type` should read the environment back.
 */
export interface EnvironmentSecret {
  id: string
  name: string
  description?: string
  projectId: string
  apiKey: string
}

export interface EnvironmentPayload {
  name: string
  description?: string
  type?: EnvType
  changeWindowStartHour?: number | null
  changeWindowEndHour?: number | null
  changeWindowTimezone?: string | null
}

export const getEnvironments = (projectId: string) =>
  api
    .get<Page<Environment>>('/environments', { params: { projectId } })
    .then((r) => pageItems(r.data))

export const getEnvironment = (id: string) =>
  api.get<Environment>(`/environments/${id}`).then((r) => r.data)

/** Returns the plaintext key - the only time it is ever available. */
export const createEnvironment = (data: EnvironmentPayload & { projectId: string }) =>
  api.post<EnvironmentSecret>('/environments', data).then((r) => r.data)

export const updateEnvironment = (id: string, data: EnvironmentPayload) =>
  api.put<Environment>(`/environments/${id}`, data).then((r) => r.data)

export const deleteEnvironment = (id: string) => api.delete(`/environments/${id}`)

/** Also returns the plaintext key once; the previous key stops working immediately. */
export const rotateApiKey = (id: string) =>
  api.post<EnvironmentSecret>(`/environments/${id}/api-key/rotate`).then((r) => r.data)
