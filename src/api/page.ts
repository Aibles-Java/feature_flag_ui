// Backend list endpoints return a Spring PageResponse; the UI only needs the
// items. Kept tolerant of a bare array in case an endpoint isn't paginated.
export interface Page<T> {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

export const pageItems = <T>(data: Page<T> | T[]): T[] =>
  Array.isArray(data) ? data : (data?.content ?? [])

/** Normalise a paged or bare-array response into a Page (bare arrays become one page). */
export const toPage = <T>(data: Page<T> | T[]): Page<T> => {
  if (Array.isArray(data)) {
    return { content: data, page: 0, size: data.length, totalElements: data.length, totalPages: 1 }
  }
  return data
}
