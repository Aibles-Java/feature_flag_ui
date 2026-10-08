import api from './axios'
import type { Environment } from './environments'
import type { FeatureFlag, FlagState } from './flags'

/**
 * Types and calls for the Flag detail page (S-1.7..S-1.9). Kept out of `flags.ts` on purpose so
 * the matrix work can change that file without conflicts. Shapes mirror the backend DTOs:
 * `FeatureFlagResponse`, `FlagStateResponse`, `EnvironmentResponse` (incl. `changeWindowZone` /
 * `changeWindowOpenNow`, BE PR 154) and `UpdateFlagStateRequest`.
 */

/** `FeatureFlagResponse` - the flag plus the planned-removal date the base type does not model. */
export interface FlagDetail extends FeatureFlag {
  /** Optional planned removal date. Reported, never auto-enforced by the server. */
  expiresAt?: string | null
}

/**
 * `EnvironmentResponse` with the advisory change-window fields. Both are informational snapshots:
 * the server re-checks the window on every write, and the browser clock must never be used to
 * recompute them (F20, solution-design 8.2).
 */
export interface EnvironmentWindow extends Environment {
  /** IANA zone the window is evaluated in (own timezone if valid, else the configured one). */
  changeWindowZone?: string | null
  /** Would a production change pass the window right now. Null/absent = unknown. */
  changeWindowOpenNow?: boolean | null
}

export const getFlagDetail = (flagId: string) =>
  api.get<FlagDetail>(`/flags/${flagId}`).then((r) => r.data)

/** `GET /flags/{flagId}/environments` (BE PR 151): a flat array, one entry per configured env. */
export const getFlagStates = (flagId: string) =>
  api.get<FlagState[]>(`/flags/${flagId}/environments`).then((r) => r.data)

export const getEnvironmentWindow = (envId: string) =>
  api.get<EnvironmentWindow>(`/environments/${envId}`).then((r) => r.data)

/** What the editor hands to {@link saveFlagState}. */
export interface SaveFlagStateInput {
  flagId: string
  envId: string
  enabled: boolean
  /** Value to store. Undefined/null = the state has none and the user did not set one. */
  value?: string | null
  rolloutPercent: number
  /** True only when the user deliberately emptied a value that the loaded state had. */
  clearValue?: boolean
  /** PROD only: the user saw the ProdGuardDialog. Audit evidence, never an authorisation (D-03). */
  prodAcknowledged?: boolean
}

/** Body of `PUT /flags/{flagId}/environments/{envId}` (BE `UpdateFlagStateRequest`). */
export interface UpdateFlagStateBody {
  enabled: boolean
  value?: string
  clearValue?: boolean
  rolloutPercent: number
  prodAcknowledged?: boolean
}

/**
 * The ONE place a flag-state write is built and sent (S-0.1 semantics, F7): always the full
 * state, `clearValue` only to clear (the server rejects `clearValue` together with `value`).
 * S-2.16 adds `version` + 409 handling here and nowhere else.
 */
export function buildUpdateBody(input: SaveFlagStateInput): UpdateFlagStateBody {
  const body: UpdateFlagStateBody = { enabled: input.enabled, rolloutPercent: input.rolloutPercent }
  if (input.clearValue) body.clearValue = true
  else if (input.value != null) body.value = input.value
  if (input.prodAcknowledged) body.prodAcknowledged = true
  return body
}

export const saveFlagState = (input: SaveFlagStateInput) =>
  api
    .put<FlagState>(`/flags/${input.flagId}/environments/${input.envId}`, buildUpdateBody(input))
    .then((r) => r.data)
