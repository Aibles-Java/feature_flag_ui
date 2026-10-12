/**
 * Flag matrix tuning (S-1.4a). Named, configurable constants - never inlined in components.
 *
 * D-20 (decision-log): at most 6 flag-state requests in flight at once. Phase 1 builds the matrix
 * from per-cell `getFlagState` calls (solution-design 6.2), so this bounds the burst against the
 * backend (risk "Pha 1 tai NxK request", solution-design 11).
 */
export const MAX_CONCURRENT_STATE_REQUESTS = 6

/** Cell data stays fresh this long, so re-renders / paging back do not refetch (S-1.4a AC3). */
export const STATE_STALE_TIME_MS = 30_000

/** Chars of `value` shown in a chip before truncation (full value stays in the accessible name). */
export const CHIP_VALUE_MAX_CHARS = 12

/** 429 without a usable `Retry-After` (BE always sends one; D-12 is 60 req/min, so a minute is safe). */
export const RETRY_AFTER_DEFAULT_S = 60

/** Upper bound for an honoured `Retry-After`, so a bogus header cannot park the page indefinitely. */
export const RETRY_AFTER_MAX_S = 120
