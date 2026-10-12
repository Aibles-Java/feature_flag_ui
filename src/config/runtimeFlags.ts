/**
 * Internal kill-switch for the flag-centric navigation (S-1.11, D-19, solution-design §10 phase 1
 * rollback). Read from `window.__ENV__` - the same runtime mechanism as `api/axios.ts` - so it can
 * be flipped by changing container config, with no rebuild.
 *
 * Safe default: anything other than the exact string "true" (missing, empty, unknown) keeps the
 * OLD behaviour (env-first routes, env switcher in the sidebar).
 */
export function isFlagCentricNavEnabled(): boolean {
  return window.__ENV__?.FLAG_CENTRIC_NAV === 'true'
}
