import { isAxiosError } from 'axios'
import { MAX_CONCURRENT_STATE_REQUESTS } from '@/config/matrixConfig'
import type { Environment } from './environments'
import { getFlagState, type FlagState } from './flags'

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
