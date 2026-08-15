/**
 * The backend wraps every admin *list* endpoint in a page envelope (ADR-0003) rather than
 * returning a bare JSON array:
 *
 *   { content: [...], page, size, totalElements, totalPages }
 *
 * The SDK evaluation endpoint is deliberately excluded from that rule, so it still returns
 * a plain array — don't apply these helpers to it.
 */
export interface PageResponse<T> {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

/** Query params accepted by every paginated endpoint. `sort` is Spring's `field,direction`. */
export interface PageParams {
  page?: number
  size?: number
  sort?: string
}

/**
 * Narrows an unknown payload to a page envelope.
 *
 * Deliberately structural rather than a cast: these helpers sit on the seam between two
 * independently-deployed services, which is exactly where an unchecked cast turns a clear
 * "shape changed" into a confusing `undefined.map is not a function` three components away.
 */
function isPageResponse<T>(data: unknown): data is PageResponse<T> {
  return typeof data === 'object' && data !== null && Array.isArray((data as PageResponse<T>).content)
}

/**
 * Returns just the rows, for callers that render a list and don't page through it.
 *
 * Tolerates a bare array so a single endpoint reverting to an unwrapped list (or a test
 * fixture written the old way) degrades to "works" instead of crashing the page.
 */
export function toList<T>(data: PageResponse<T> | T[]): T[] {
  if (Array.isArray(data)) return data
  if (isPageResponse<T>(data)) return data.content
  return []
}

/** Same tolerance, but keeps the paging metadata for callers that render pagination controls. */
export function toPage<T>(data: PageResponse<T> | T[]): PageResponse<T> {
  if (isPageResponse<T>(data)) return data
  const content = Array.isArray(data) ? data : []
  return { content, page: 0, size: content.length, totalElements: content.length, totalPages: 1 }
}
