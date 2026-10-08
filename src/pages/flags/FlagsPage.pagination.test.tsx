import { screen, waitFor } from '@testing-library/react'
import MockAdapter from 'axios-mock-adapter'
import { Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import api from '@/api/axios'
import { renderWithProviders } from '@/test/renderWithProviders'
import { PROJ, ORG, flag, mockBackend, pageOf } from '@/test/fixtures'
import FlagsPage from './FlagsPage'

let mock: MockAdapter
const TOTAL = 130
const all = Array.from({ length: TOTAL }, (_, i) => flag(i + 1))

beforeEach(() => {
  window.__ENV__ = { FLAG_CENTRIC_NAV: 'true' }
  mock = new MockAdapter(api)
  mockBackend(mock)
  // Server-side paging, clamped to 100 like the real endpoint (F12).
  mock.onGet('/flags').reply((cfg) => {
    const page = Number(cfg.params.page ?? 0)
    const size = Math.min(Number(cfg.params.size ?? 20), 100)
    return [200, pageOf(all.slice(page * size, page * size + size), { page, size, totalElements: TOTAL, totalPages: Math.ceil(TOTAL / size) })]
  })
})
afterEach(() => mock.restore())

const mount = () =>
  renderWithProviders(
    <Routes>
      <Route path="/orgs/:orgId/projects/:projectId/flags" element={<FlagsPage />} />
    </Routes>,
    { route: `/orgs/${ORG}/projects/${PROJ}/flags` },
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
})
