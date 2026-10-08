import { isAxiosError } from 'axios'
import type { QueryClient } from '@tanstack/react-query'
import { MAX_CONCURRENT_STATE_REQUESTS, RETRY_AFTER_DEFAULT_S, RETRY_AFTER_MAX_S } from '@/config/matrixConfig'
import api from './axios'
import type { Environment } from './environments'
import { getFlagState, MAX_FLAGS_PAGE_SIZE, type FeatureFlag, type FlagState } from './flags'
import { toPage, type Page } from './page'

/**
 * Minimal FIFO concurrency limiter: at most `max` tasks run at once, the rest wait their turn.
 * A finishing task hands its slot DIRECTLY to the next waiter (the count never dips), so a caller
 * arriving in between cannot slip in and exceed `max`. An aborted `signal` removes a queued task
 * (it never runs) and rejects it.
 */
export function createLimiter(max: number) {
  if (!Number.isInteger(max) || max < 1) throw new Error('limit must be a positive integer')
  let active = 0
  const waiting: Array<() => void> = []
  const abortError = () => new DOMException('Aborted', 'AbortError')
  const release = () => {
    const next = waiting.shift()
    if (next) next() // slot transferred, active unchanged
    else active--
  }
  return async function run<T>(task: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    if (signal?.aborted) throw abortError()
    if (active < max) {
      active++
    } else {
      await new Promise<void>((resolve, reject) => {
        const onAbort = () => {
          const i = waiting.indexOf(wake)
          if (i >= 0) waiting.splice(i, 1)
          reject(abortError())
        }
        const wake = () => {
          signal?.removeEventListener('abort', onAbort)
          resolve()
        }
        waiting.push(wake)
        signal?.addEventListener('abort', onAbort, { once: true })
      })
    }
    try {
      return await task()
    } finally {
      release()
    }
  }
}

/** Shared by every matrix cell so the D-20 bound holds across rows and columns, not per cell. */
const limitStateRequests = createLimiter(MAX_CONCURRENT_STATE_REQUESTS)

/** `null` = the flag has no state in this env ("chua cau hinh", F11) - not an error, no create button. */
export type CellState = FlagState | null

export const cellQueryKey = (flagId: string, envId: string) => ['flag-cell', flagId, envId] as const

export const fetchCellState = (flagId: string, envId: string, signal?: AbortSignal): Promise<CellState> =>
  limitStateRequests(async () => {
    try {
      return await getFlagState(flagId, envId)
    } catch (e) {
      if (isAxiosError(e) && e.response?.status === 404) return null
      throw e
    }
  }, signal)

const ENV_ORDER: Record<string, number> = { DEVELOPMENT: 0, STAGING: 1, PRODUCTION: 2 }

/** Columns read DEV -> STAGING -> PROD (solution-design 6.1). */
export const sortEnvironments = <T extends Pick<Environment, 'name' | 'type'>>(envs: T[]): T[] =>
  [...envs].sort(
    (a, b) => (ENV_ORDER[a.type] ?? 99) - (ENV_ORDER[b.type] ?? 99) || a.name.localeCompare(b.name),
  )

// ---- Phase 2: one request for the whole page (S-2.15, ADR-02, solution-design 6.2/6.5) ----------

/** BE `FlagMatrixRowResponse`: a flag and its states (one per configured env; missing = none). */
export interface FlagMatrixRow {
  flag: FeatureFlag
  states: FlagState[]
}

/** `flagId -> envId -> state`. A flag absent from the index has no matrix data (use the cell path). */
export type MatrixIndex = Map<string, Map<string, FlagState>>

/**
 * `GET /flags/environment-states` (BE PR 150), paginated by flag, 0-based `page`. `size` is clamped
 * to 100 like the flag list (the server clamps too). Rate-limited at 60 req/min/user (D-12): see
 * {@link retryAfterSeconds}.
 */
export const getFlagMatrix = (projectId: string, page = 0, size = MAX_FLAGS_PAGE_SIZE, signal?: AbortSignal) =>
  api
    .get<Page<FlagMatrixRow> | FlagMatrixRow[]>('/flags/environment-states', {
      params: { projectId, page, size: Math.min(size, MAX_FLAGS_PAGE_SIZE) },
      signal,
    })
    .then((r) => toPage(r.data))

export const matrixQueryKey = (projectId: string, page: number) => ['flag-matrix', projectId, page] as const

export function indexMatrix(rows: FlagMatrixRow[]): MatrixIndex {
  const index: MatrixIndex = new Map()
  for (const row of rows) {
    index.set(row.flag.id, new Map(row.states.map((s) => [s.environmentId, s])))
  }
  return index
}

const statusOf = (e: unknown) => (isAxiosError(e) ? e.response?.status : undefined)

export const isRateLimited = (e: unknown): boolean => statusOf(e) === 429

/**
 * When the matrix call fails like this we fall back to the phase 1 per-cell path (AC: "loi matrix
 * -> quay ve luong pha 1"): the endpoint is missing (404, older BE), broken (5xx) or unreachable
 * (no response). Deliberately NOT 429 (the fallback would be exactly the request storm the limit
 * exists to stop), and not 400/401/403 (per-cell calls would fail the same way).
 */
export function isMatrixFallbackError(e: unknown): boolean {
  if (!isAxiosError(e)) return false
  const status = e.response?.status
  return status === undefined || status === 404 || status >= 500
}

/**
 * Seconds to wait after a 429, from the `Retry-After` header (BE sends whole seconds, min 1).
 * Missing/garbage -> default; clamped to [1, max] so a hostile or buggy value cannot park the
 * page for hours or make us retry in a tight loop.
 */
export function retryAfterSeconds(e: unknown): number {
  const raw = isAxiosError(e) ? e.response?.headers?.['retry-after'] : undefined
  const n = typeof raw === 'string' || typeof raw === 'number' ? Number(raw) : Number.NaN
  if (!Number.isFinite(n)) return RETRY_AFTER_DEFAULT_S
  return Math.min(Math.max(Math.ceil(n), 1), RETRY_AFTER_MAX_S)
}

/**
 * After a successful flag-state write (S-2.15 AC): refresh the matrix, the per-flag states and
 * history, plus the single-state caches. Also used after a 409 so the row shows the latest.
 */
export function invalidateStateQueries(qc: QueryClient, flag: Pick<FeatureFlag, 'id' | 'projectId'>, envId: string) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: ['flag-matrix', flag.projectId] }),
    qc.invalidateQueries({ queryKey: ['flag-states', flag.id] }),
    qc.invalidateQueries({ queryKey: ['flag-history', flag.id] }),
    qc.invalidateQueries({ queryKey: ['flag-state', flag.id, envId] }),
    qc.invalidateQueries({ queryKey: cellQueryKey(flag.id, envId) }),
  ])
}
