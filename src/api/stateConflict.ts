import { isAxiosError } from 'axios'
import { getFlagState, type FlagState } from './flags'

/** BE answers 409 when the sent `version` no longer matches the stored one (ADR-07, F18). */
export const isVersionConflict = (e: unknown): boolean => isAxiosError(e) && e.response?.status === 409

/**
 * Thrown by {@link withConflictReload} after a 409. `latest` is the state reloaded from the server
 * (null when that reload itself failed), so a caller can roll back to it and show what changed.
 */
export class StateConflictError extends Error {
  readonly latest: FlagState | null
  constructor(latest: FlagState | null) {
    super('Someone else changed this state')
    this.name = 'StateConflictError'
    this.latest = latest
  }
}

export const isStateConflict = (e: unknown): e is StateConflictError => e instanceof StateConflictError

/**
 * The ONE 409 handler for flag-state writes (S-2.16, ADR-07, solution-design 6.2): the matrix
 * quick toggle, the detail editor and the PROD guard all run their PUT through here. On a 409 it
 * reloads the latest state and rethrows a {@link StateConflictError}; any other error passes
 * through untouched. Callers own the UI (roll back, keep edits, show StateConflictDialog).
 */
export async function withConflictReload<T>(flagId: string, envId: string, write: () => Promise<T>): Promise<T> {
  try {
    return await write()
  } catch (e) {
    if (!isVersionConflict(e)) throw e
    let latest: FlagState | null = null
    try {
      latest = await getFlagState(flagId, envId)
    } catch {
      // The dialog tells the user the latest state could not be loaded.
    }
    throw new StateConflictError(latest)
  }
}
