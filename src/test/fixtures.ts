import MockAdapter from 'axios-mock-adapter'

// Synthetic ids/names only - no real data.
export const ORG = '00000000-0000-4000-8000-0000000000a1'
export const PROJ = '00000000-0000-4000-8000-0000000000b1'
export const ENV_DEV = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
export const ENV_PROD = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
export const FLAG_ID = '00000000-0000-4000-8000-0000000000f1'

export const pageOf = <T,>(content: T[], extra: Partial<{ page: number; size: number; totalElements: number; totalPages: number }> = {}) => ({
  content,
  page: 0,
  size: 100,
  totalElements: content.length,
  totalPages: 1,
  ...extra,
})

export const flag = (n: number, over: Record<string, unknown> = {}) => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
  name: `Synthetic flag ${n}`,
  key: `synthetic-flag-${n}`,
  valueType: 'BOOLEAN',
  archived: false,
  projectId: PROJ,
  createdAt: '2026-01-01T00:00:00Z',
  ...over,
})

/** Standard happy-path backend for the layout + flags pages. */
export function mockBackend(mock: MockAdapter, flags = [flag(1), flag(2)]) {
  mock.onGet('/organisations').reply(200, pageOf([{ id: ORG, name: 'Synthetic Org', slug: 'synthetic', createdAt: '2026-01-01T00:00:00Z' }]))
  mock.onGet('/projects').reply(200, pageOf([{ id: PROJ, name: 'Synthetic Project', organisationId: ORG, createdAt: '2026-01-01T00:00:00Z' }]))
  mock.onGet('/environments').reply(200, pageOf([
    { id: ENV_DEV, name: 'Synthetic Dev', projectId: PROJ, type: 'DEVELOPMENT', changeWindowStartHour: null, changeWindowEndHour: null, changeWindowTimezone: null },
    { id: ENV_PROD, name: 'Synthetic Prod', projectId: PROJ, type: 'PRODUCTION', changeWindowStartHour: null, changeWindowEndHour: null, changeWindowTimezone: null },
  ]))
  mock.onGet('/flags').reply(200, pageOf(flags))
  mock.onGet('/flags/archived').reply(200, pageOf([]))
  mock.onGet(/\/flags\/.+\/environments\/.+/).reply(404)
}
