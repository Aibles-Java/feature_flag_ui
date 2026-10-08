import { getFlagState, updateFlagState, type FlagState } from './flags'

/**
 * The ONE place the UI toggles `enabled` (S-0.1, F7; S-2.16).
 *
 * The backend PUT replaces the whole state, so sending `{ enabled }` alone wiped `value` and reset
 * `rolloutPercent`. The write therefore carries the state's `value` + `rolloutPercent` and its
 * `version` (ADR-07):
 *
 * - `loaded` with a `version` (the state the user is looking at): written as is, no extra GET. If
 *   somebody changed it meanwhile the server answers 409 instead of being overwritten - callers
 *   run this through `withConflictReload`.
 * - otherwise (per-cell fallback data from a pre-version backend): reload immediately before the
 *   write as before (S-0.1 AC2); the freshly loaded `version`, if any, is still sent.
 */
export async function toggleFlagEnabled(
  flagId: string,
  envId: string,
  enabled: boolean,
  loaded?: FlagState | null,
): Promise<FlagState> {
  const base = loaded?.version != null ? loaded : await getFlagState(flagId, envId)
  return updateFlagState(flagId, envId, {
    enabled,
    // `value` may be absent/null for a state with no value; never send the literal "null".
    ...(base.value != null ? { value: base.value } : {}),
    rolloutPercent: base.rolloutPercent,
    ...(base.version != null ? { version: base.version } : {}),
  })
}
