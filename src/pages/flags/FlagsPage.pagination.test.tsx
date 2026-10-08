import { screen, waitFor } from '@testing-library/react'
import MockAdapter from 'axios-mock-adapter'
import { Link, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import api from '@/api/axios'
import { renderWithProviders } from '@/test/renderWithProviders'
import { PROJ, ORG, flag, mockBackend, pageOf } from '@/test/fixtures'
import FlagsPage from './FlagsPage'

// These tests cover the pager (page size, page=, ?env=, clamping), not the cells. Mounting the real
// 100-row x 3-env matrix (300 cells, ARIA grid, roving tabindex) on every page change made them
// 10x slower on the CI runner under coverage and hit the 5s timeout. The stub keeps the real
// per-row header (flag names, counters) so "100 of 130" is still asserted on rendered rows.
vi.mock('@/components/matrix/FlagMatrix', () => ({
  default: ({ flags, renderRowHeader }: { flags: { id: string }[]; renderRowHeader: (f: never) => React.ReactNode }) => (
    <ul>
      {flags.map((f) => (
        <li key={f.id}>{renderRowHeader(f as never)}</li>
      ))}
    </ul>
  ),
}))

let mock: MockAdapter
const TOTAL = 130
let all = Array.from({ length: TOTAL }, (_, i) => flag(i + 1))
const OTHER = '00000000-0000-4000-8000-0000000000b2'

beforeEach(() => {
  all = Array.from({ length: TOTAL }, (_, i) => flag(i + 1))
  window.__ENV__ = { FLAG_CENTRIC_NAV: 'true' }
  mock = new MockAdapter(api)
  mockBackend(mock)
  // Server-side paging, clamped to 100 like the real endpoint (F12).
  mock.onGet('/flags').reply((cfg) => {
    if (cfg.params.projectId === OTHER) return [200, pageOf([flag(900, { name: 'Other project flag', projectId: OTHER })])]
    const page = Number(cfg.params.page ?? 0)
    const size = Math.min(Number(cfg.params.size ?? 20), 100)
    return [200, pageOf(all.slice(page * size, page * size + size), { page, size, totalElements: all.length, totalPages: Math.ceil(all.length / size) })]
  })
})
afterEach(() => mock.restore())

function Loc() {
  const l = useLocation()
  return <p data-testid="search">{l.search}</p>
}

const mount = (search = '') =>
  renderWithProviders(
    <>
      <Link to={`/orgs/${ORG}/projects/${OTHER}/flags`}>switch project</Link>
      <Loc />
      <Routes>
        <Route path="/orgs/:orgId/projects/:projectId/flags" element={<FlagsPage />} />
      </Routes>
    </>,
    { route: `/orgs/${ORG}/projects/${PROJ}/flags${search}` },
  )

const flagRequests = () => mock.history.get.filter((r) => r.url === '/flags')

describe('FlagsPage pagination (S-1.5, D-18)', () => {
  it('page 1 shows 100 of 130 with totalElements = 130 and page controls, no "load more"', async () => {
    mount()
    expect(await screen.findByText('Synthetic flag 1')).toBeInTheDocument()
    expect(screen.getAllByText(/^Synthetic flag \d+$/)).toHaveLength(100)
    expect(screen.getByTestId('flags-total')).toHaveTextContent('130')
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument()
    expect(flagRequests()[0].params).toMatchObject({ projectId: PROJ, page: 0, size: 100 })
  })

  it('next page requests page=1 (size <= 100) and shows the remaining 30', async () => {
    const { user } = mount()
    await screen.findByText('Synthetic flag 1')
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    expect(await screen.findByText('Synthetic flag 130')).toBeInTheDocument()
    expect(screen.getAllByText(/^Synthetic flag \d+$/)).toHaveLength(30)
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled()
    await waitFor(() => expect(flagRequests().some((r) => r.params.page === 1)).toBe(true))
    for (const r of flagRequests()) expect(r.params.size).toBeLessThanOrEqual(100)
  })

  it('previous page goes back; disabled on page 1', async () => {
    const { user } = mount()
    await screen.findByText('Synthetic flag 1')
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    await screen.findByText('Synthetic flag 130')
    await user.click(screen.getByRole('button', { name: 'Previous page' }))
    expect(await screen.findByText('Synthetic flag 1')).toBeInTheDocument()
  })

  it('list shrinks while on the last page: clamps back to the last real page, pager stays usable', async () => {
    all = all.slice(0, 100) // page 2 is now empty, totalPages = 1
    mount('?page=2')
    expect(await screen.findByText('Synthetic flag 1')).toBeInTheDocument()
    expect(flagRequests().some((r) => r.params.page === 1)).toBe(true)
    expect(flagRequests().at(-1)?.params.page).toBe(0)
  })

  it('0 results on a deep page shows the empty state, not a stuck empty page', async () => {
    all = []
    mount('?page=3')
    expect(await screen.findByText('No feature flags yet')).toBeInTheDocument()
    expect(screen.getByTestId('flags-total')).toHaveTextContent('0')
  })

  it('pager is rendered on a middle page and ?page= survives a reload', async () => {
    all = Array.from({ length: 250 }, (_, i) => flag(i + 1))
    const { user } = mount('?page=2')
    expect(await screen.findByText('Synthetic flag 101')).toBeInTheDocument()
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Next page' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    expect(await screen.findByText('Page 3 of 3')).toBeInTheDocument()
  })

  it('switching project shows that project\'s flags from page 1, never the previous project\'s', async () => {
    const { user } = mount('?page=2')
    await screen.findByText('Page 2 of 2')
    await user.click(screen.getByRole('link', { name: 'switch project' }))
    expect(await screen.findByText('Other project flag')).toBeInTheDocument()
    expect(screen.queryByText(/^Synthetic flag \d+$/)).not.toBeInTheDocument()
    const last = flagRequests().at(-1)!
    expect(last.params).toMatchObject({ projectId: OTHER, page: 0 })
  })

  it('labels are honest: page-scoped counters say "this page"', async () => {
    mount()
    await screen.findByText('Synthetic flag 1')
    expect(screen.getByText('Enabled (this page)')).toBeInTheDocument()
    expect(screen.getByText('100 of 100 on this page')).toBeInTheDocument()
  })

  it.each(['abc', '-5', '0', '1.5e3x', ''])('invalid ?page=%j falls back to page 1', async (bad) => {
    mount(`?page=${bad}`)
    expect(await screen.findByText('Page 1 of 2')).toBeInTheDocument()
    expect(flagRequests()[0].params.page).toBe(0)
  })

  it('huge ?page= never reaches the API as-is and lands on the real last page', async () => {
    mount('?page=100000000000000000000')
    expect(await screen.findByText('Page 2 of 2')).toBeInTheDocument()
    for (const r of flagRequests()) expect(r.params.page).toBeLessThanOrEqual(100000)
  })

  it('?env= is preserved across page changes', async () => {
    const env = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    const { user } = mount(`?env=${env}`)
    await screen.findByText('Page 1 of 2')
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    await screen.findByText('Page 2 of 2')
    expect(screen.getByTestId('search')).toHaveTextContent(`env=${env}`)
    expect(screen.getByTestId('search')).toHaveTextContent('page=2')
    await user.click(screen.getByRole('button', { name: 'Previous page' }))
    await screen.findByText('Page 1 of 2')
    expect(screen.getByTestId('search').textContent).toBe(`?env=${env}`)
  })
})
