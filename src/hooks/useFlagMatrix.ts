import { useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  getFlagMatrix, indexMatrix, isMatrixFallbackError, isRateLimited, matrixQueryKey, retryAfterSeconds,
  type MatrixIndex,
} from '@/api/flagMatrix'
import { MAX_FLAGS_PAGE_SIZE } from '@/api/flags'
import { STATE_STALE_TIME_MS } from '@/config/matrixConfig'

/**
 * - `off`          matrix not wanted (legacy route / no project)
 * - `loading`      first matrix response pending; cells must not fire their own requests yet
 * - `matrix`       one-request data is available (possibly stale while a refetch is rate limited)
 * - `rate-limited` 429 and nothing to show yet; one automatic retry after `Retry-After`
 * - `fallback`     matrix endpoint unusable (404/5xx/network): phase 1 per-cell path
 * - `error`        any other failure (403, 400, ...): per-cell calls would fail the same way
 */
export type MatrixMode = 'off' | 'loading' | 'matrix' | 'rate-limited' | 'fallback' | 'error'

export interface FlagMatrixState {
  mode: MatrixMode
  index?: MatrixIndex
  error: unknown
  /** True while a 429 is outstanding, also when older data is still displayed. */
  rateLimited: boolean
  /** Seconds the automatic retry waits (from `Retry-After`); null when not rate limited. */
  retryAfter: number | null
}

/**
 * S-2.15: the whole page's matrix in ONE request (`getFlagMatrix`, same page/size as the flag
 * list so both cover the same flags). No automatic react-query retries and no refocus refetch:
 * a failing or throttled endpoint is never hammered. After a 429 exactly one retry is scheduled
 * for `Retry-After` seconds later; a second 429 reschedules with its own header.
 */
export function useFlagMatrix(projectId: string | undefined, pageIndex: number, enabled: boolean): FlagMatrixState {
  const q = useQuery({
    queryKey: matrixQueryKey(projectId ?? '', pageIndex),
    queryFn: ({ signal }) => getFlagMatrix(projectId!, pageIndex, MAX_FLAGS_PAGE_SIZE, signal),
    enabled: enabled && !!projectId,
    retry: false,
    staleTime: STATE_STALE_TIME_MS,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  const rateLimited = isRateLimited(q.error)
  const retryAfter = rateLimited ? retryAfterSeconds(q.error) : null
  const { refetch, errorUpdatedAt } = q
  useEffect(() => {
    if (retryAfter === null) return
    const t = setTimeout(() => void refetch(), retryAfter * 1000)
    return () => clearTimeout(t)
  }, [retryAfter, errorUpdatedAt, refetch])

  const index = useMemo(() => (q.data ? indexMatrix(q.data.content) : undefined), [q.data])

  let mode: MatrixMode
  if (!enabled || !projectId) mode = 'off'
  else if (index) mode = 'matrix'
  else if (rateLimited) mode = 'rate-limited'
  else if (q.isError) mode = isMatrixFallbackError(q.error) ? 'fallback' : 'error'
  else mode = 'loading'

  return { mode, index, error: q.error, rateLimited, retryAfter }
}
