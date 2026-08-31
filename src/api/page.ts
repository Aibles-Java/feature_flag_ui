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
