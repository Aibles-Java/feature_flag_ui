import { getFlagState, updateFlagState, type FlagState } from './flags'

/**
 * The ONE place the UI toggles `enabled` (S-0.1, F7).
 *
 * The backend PUT replaces the whole state, so sending `{ enabled }` alone wiped `value` and reset
 * `rolloutPercent`. Here the state is reloaded immediately before the write (AC2: GET then PUT) and
 * the freshly loaded `value` + `rolloutPercent` are sent back with the new `enabled`.
 *
 * Known limitation (AC4, solution-design 10 / F18): there is no optimistic lock yet, so a change
 * made between that GET and this PUT can still be overwritten (last write wins). The `version`
 * guard arrives with S-2.16 and plugs in here - this is the single `updateFlagState` call site for
 * toggles, so that story changes only this function.
 */
export async function toggleFlagEnabled(flagId: string, envId: string, enabled: boolean): Promise<FlagState> {
  const fresh = await getFlagState(flagId, envId)
  return updateFlagState(flagId, envId, {
    enabled,
    // `value` may be absent/null for a state with no value; never send the literal "null".
    ...(fresh.value != null ? { value: fresh.value } : {}),
    rolloutPercent: fresh.rolloutPercent,
  })
}
