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
