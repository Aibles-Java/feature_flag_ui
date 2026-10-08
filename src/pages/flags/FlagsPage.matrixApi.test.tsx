// S-2.15 (one matrix request, fallback, 429) and S-2.16 (quick toggle version + 409). Synthetic data only.
import { act, screen, waitFor, within } from '@testing-library/react'
import MockAdapter from 'axios-mock-adapter'
import { Route, Routes } from 'react-router-dom'
import { axe } from 'vitest-axe'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import api from '@/api/axios'
import { renderWithProviders } from '@/test/renderWithProviders'
import { ENV_DEV, ENV_PROD, ORG, PROJ, flag, mockBackend, pageOf } from '@/test/fixtures'
import FlagsPage from './FlagsPage'

let mock: MockAdapter
const f1 = flag(1)
const f2 = flag(2, { valueType: 'STRING' })
const stateOf = (f: { id: string }, envId: string, over = {}) => ({
  flagId: f.id, environmentId: envId, enabled: false, value: 'x', rolloutPercent: 40, version: 5, lastEvaluatedAt: null, ...over,
})
const MATRIX = '/flags/environment-states'
const rows = (devOver = {}) => [
  { flag: f1, states: [stateOf(f1, ENV_DEV, devOver), stateOf(f1, ENV_PROD, { enabled: true })] },
  { flag: f2, states: [stateOf(f2, ENV_DEV, { enabled: true })] }, // f2 has no PROD state
]
const matrixCalls = () => mock.history.get.filter((r) => r.url === MATRIX)
const cellCalls = () => mock.history.get.filter((r) => /^\/flags\/[^/]+\/environments\/[^/]+$/.test(r.url ?? ''))

beforeEach(() => {
  window.__ENV__ = { FLAG_CENTRIC_NAV: 'true' }
  mock = new MockAdapter(api)
})
afterEach(() => {
  vi.useRealTimers()
  mock.restore()
})

// The shared backend's catch-all per-cell 404 shadows later handlers (first match wins), so it is
// registered at mount time, after each test has declared its own handlers.
const mount = (search = '') => {
  mockBackend(mock, [f1, f2])
  return renderWithProviders(
    <Routes><Route path="/orgs/:orgId/projects/:projectId/flags" element={<FlagsPage />} /></Routes>,
    { route: `/orgs/${ORG}/projects/${PROJ}/flags${search}` },
  )
}

describe('S-2.15 FlagsPage reads the matrix in ONE request', () => {
  it('AC: envs + flags + matrix = 3 data requests, zero per-cell state calls, cells filled from the matrix', async () => {
    mock.onGet(MATRIX).reply(200, pageOf(rows()))
    mount()
    const grid = await screen.findByRole('grid')
    expect(await within(grid).findByRole('img', { name: /Synthetic flag 1 in Synthetic Dev: disabled, value x, rollout 40%/ })).toBeInTheDocument()
    expect(within(grid).getByRole('img', { name: /Synthetic flag 1 in Synthetic Prod: enabled/ })).toBeInTheDocument()
    expect(within(grid).getByRole('img', { name: /Synthetic flag 2 in Synthetic Prod: not configured/ })).toBeInTheDocument()
    const urls = mock.history.get.map((r) => r.url)
    expect(urls.filter((u) => u === MATRIX)).toHaveLength(1)
    expect(urls.filter((u) => u === '/flags')).toHaveLength(1)
    expect(urls.filter((u) => u === '/environments')).toHaveLength(1)
    expect(cellCalls()).toHaveLength(0)
  })

  it('asks for the same page as the flag list (?page= is 1-based in the URL, 0-based on the wire), size <= 100', async () => {
    mock.onGet(MATRIX).reply(200, pageOf([], { page: 2 }))
    mock.onGet('/flags').reply(200, pageOf([f1], { page: 2, totalElements: 201, totalPages: 3 }))
    mount('?page=3')
    await waitFor(() => expect(matrixCalls()).toHaveLength(1))
    expect(matrixCalls()[0].params).toEqual({ projectId: PROJ, page: 2, size: 100 })
  })

  it('falls back to the per-cell path when the matrix call returns 500', async () => {
    mock.onGet(MATRIX).reply(500)
    mock.onGet(`/flags/${f1.id}/environments/${ENV_DEV}`).reply(200, stateOf(f1, ENV_DEV, { value: 'cell-path' }))
    mount()
    expect(await screen.findByRole('img', { name: /Synthetic flag 1 in Synthetic Dev: disabled, value cell-path/ })).toBeInTheDocument()
    expect(matrixCalls()).toHaveLength(1) // no automatic retry of the broken endpoint
    expect(cellCalls().length).toBeGreaterThan(0)
  })

  it('falls back to the per-cell path when the matrix endpoint is missing (404, older backend)', async () => {
    mock.onGet(MATRIX).reply(404)
    mock.onGet(`/flags/${f1.id}/environments/${ENV_DEV}`).reply(200, stateOf(f1, ENV_DEV, { value: 'cell-path' }))
    mount()
    expect(await screen.findByRole('img', { name: /value cell-path/ })).toBeInTheDocument()
    expect(cellCalls().length).toBeGreaterThan(0)
  })

  it('does NOT fall back on 403: the error is shown and no per-cell request is made', async () => {
    mock.onGet(MATRIX).reply(403, { title: 'Forbidden', detail: 'No FLAG_READ on this project' })
    mount()
    expect(await screen.findByText('No FLAG_READ on this project')).toBeInTheDocument()
    expect(screen.queryByRole('grid')).not.toBeInTheDocument()
    expect(cellCalls()).toHaveLength(0)
  })

  it('does not issue per-cell requests while the matrix call is still pending', async () => {
    mock.onGet(MATRIX).reply(() => new Promise(() => {})) // never settles
    mount()
    expect(await screen.findByText('Loading flag states...')).toBeInTheDocument()
    await new Promise((r) => setTimeout(r, 30))
    expect(cellCalls()).toHaveLength(0)
    expect(screen.queryByRole('grid')).not.toBeInTheDocument()
  })

  it('the Enabled stat on a focused env comes from the matrix, not from per-cell calls', async () => {
    mock.onGet(MATRIX).reply(200, pageOf(rows({ enabled: true })))
    mount(`?env=${ENV_DEV}`)
    await screen.findByRole('grid')
    // both flags are enabled in DEV in this payload
    const label = await screen.findByText('Enabled (this page)')
    await waitFor(() => expect(label.parentElement).toHaveTextContent('2'))
    expect(cellCalls()).toHaveLength(0)
  })
})

describe('S-2.15 / D-12 rate limit (429) on the matrix', () => {
  it('shows a message, retries ONCE after Retry-After and never touches the per-cell API', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    let n = 0
    mock.onGet(MATRIX).reply(() => (++n === 1 ? [429, { title: 'Too Many Requests' }, { 'retry-after': '5' }] : [200, pageOf(rows())]))
    mount()
    expect(await screen.findByText(/Too many requests\. Retrying automatically in 5 seconds/)).toBeInTheDocument()
    expect(screen.queryByRole('grid')).not.toBeInTheDocument()
    await act(() => vi.advanceTimersByTimeAsync(4_000))
    expect(matrixCalls()).toHaveLength(1) // still waiting: no storm
    await act(() => vi.advanceTimersByTimeAsync(1_500))
    expect(await screen.findByRole('grid')).toBeInTheDocument()
    expect(matrixCalls()).toHaveLength(2)
    expect(cellCalls()).toHaveLength(0)
    expect(screen.queryByText(/Too many requests/)).not.toBeInTheDocument()
  })

  it('a second 429 reschedules with its own Retry-After (still one request per window)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    let n = 0
    mock.onGet(MATRIX).reply(() => (++n < 3 ? [429, {}, { 'retry-after': n === 1 ? '2' : '10' }] : [200, pageOf(rows())]))
    mount()
    await screen.findByText(/Retrying automatically in 2 seconds/)
    await act(() => vi.advanceTimersByTimeAsync(2_500))
    await screen.findByText(/Retrying automatically in 10 seconds/)
    await act(() => vi.advanceTimersByTimeAsync(9_000))
    expect(matrixCalls()).toHaveLength(2)
    await act(() => vi.advanceTimersByTimeAsync(1_500))
    expect(await screen.findByRole('grid')).toBeInTheDocument()
    expect(matrixCalls()).toHaveLength(3)
  })

  it('a 429 on a REFRESH keeps the last data on screen and says so', async () => {
    let n = 0
    mock.onGet(MATRIX).reply(() => (++n === 1 ? [200, pageOf(rows())] : [429, {}, { 'retry-after': '30' }]))
    mock.onPut(`/flags/${f1.id}/environments/${ENV_DEV}`).reply(200, stateOf(f1, ENV_DEV, { enabled: true, version: 6 }))
    const { user } = mount(`?env=${ENV_DEV}`)
    await user.click(await screen.findByRole('switch', { name: /Toggle Synthetic flag 1/ }))
    expect(await screen.findByText(/Showing the last loaded data\. Retrying automatically in 30 seconds/)).toBeInTheDocument()
    expect(screen.getByRole('grid')).toBeInTheDocument()
  })
})

describe('S-2.16 quick toggle sends the version and handles 409', () => {
  const dev = `/flags/${f1.id}/environments/${ENV_DEV}`

  it('PUT carries the version of the displayed state, with no extra GET, then the row refreshes from ONE matrix call', async () => {
    let toggled = false
    mock.onGet(MATRIX).reply(() => [200, pageOf(rows(toggled ? { enabled: true, version: 6 } : {}))])
    mock.onPut(dev).reply(() => {
      toggled = true
      return [200, stateOf(f1, ENV_DEV, { enabled: true, version: 6 })]
    })
    const { user } = mount(`?env=${ENV_DEV}`)
    const sw = await screen.findByRole('switch', { name: 'Toggle Synthetic flag 1 in Synthetic Dev' })
    await user.click(sw)
    await waitFor(() => expect(mock.history.put).toHaveLength(1))
    expect(JSON.parse(mock.history.put[0].data)).toEqual({ enabled: true, value: 'x', rolloutPercent: 40, version: 5 })
    expect(cellCalls()).toHaveLength(0)
    await waitFor(() => expect(screen.getByRole('switch', { name: /Toggle Synthetic flag 1/ })).toBeChecked())
    expect(matrixCalls()).toHaveLength(2) // initial + invalidation after the successful PUT
  })

  it('409: reverts the toggle, refreshes the row, tells the user who won and does not retry on its own', async () => {
    let lost = false
    const theirs = stateOf(f1, ENV_DEV, { enabled: false, value: 'theirs', rolloutPercent: 77, version: 6 })
    mock.onGet(MATRIX).reply(() => [200, pageOf(lost ? [{ flag: f1, states: [theirs] }, rows()[1]] : rows())])
    mock.onGet(dev).reply(200, theirs)
    mock.onPut(dev).reply(() => {
      lost = true
      return [409, { title: 'Conflict', detail: 'The resource was modified by someone else. Reload and try again.' }]
    })
    const { user } = mount(`?env=${ENV_DEV}`)
    await user.click(await screen.findByRole('switch', { name: /Toggle Synthetic flag 1/ }))
    const dlg = await screen.findByRole('dialog', { name: /Someone else changed this/ })
    const table = within(dlg).getByRole('table', { name: 'Latest state on the server' })
    expect(within(table).getByText('theirs')).toBeInTheDocument()
    expect(within(table).getByText('77%')).toBeInTheDocument()
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument()
    // reverted: the switch shows the server value (off), and the row was re-read
    expect(screen.getByRole('switch', { name: /Toggle Synthetic flag 1/, hidden: true })).not.toBeChecked()
    await waitFor(() => expect(matrixCalls()).toHaveLength(2))
    await waitFor(() => expect(screen.getByRole('img', { name: /Synthetic flag 1 in Synthetic Dev: disabled, value theirs, rollout 77%/, hidden: true })).toBeInTheDocument())
    expect(mock.history.put).toHaveLength(1)
    await user.click(within(dlg).getByRole('button', { name: 'Got it' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('a non-409 failure keeps the generic error dialog (403 is not a conflict)', async () => {
    mock.onGet(MATRIX).reply(200, pageOf(rows()))
    mock.onPut(dev).reply(403, { title: 'Forbidden', detail: 'No permission' })
    const { user } = mount(`?env=${ENV_DEV}`)
    await user.click(await screen.findByRole('switch', { name: /Toggle Synthetic flag 1/ }))
    expect(await screen.findByText('No permission')).toBeInTheDocument()
    expect(screen.queryByText('Someone else changed this')).not.toBeInTheDocument()
  })

  it('conflict dialog has no axe violations', async () => {
    mock.onGet(MATRIX).reply(200, pageOf(rows()))
    mock.onGet(dev).reply(200, stateOf(f1, ENV_DEV, { version: 6 }))
    mock.onPut(dev).reply(409)
    const { user } = mount(`?env=${ENV_DEV}`)
    await user.click(await screen.findByRole('switch', { name: /Toggle Synthetic flag 1/ }))
    const dlg = await screen.findByRole('dialog', { name: /Someone else changed this/ })
    expect(await axe(dlg)).toHaveNoViolations()
  })

  it('matrix page has no axe violations', async () => {
    mock.onGet(MATRIX).reply(200, pageOf(rows()))
    const { container } = mount(`?env=${ENV_DEV}`)
    await screen.findByRole('switch')
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('S-2.16 fallback quick toggle (phase 1 data without version)', () => {
  it('reloads then writes without a version when the backend does not report one', async () => {
    mock.onGet(MATRIX).reply(404)
    const dev = `/flags/${f1.id}/environments/${ENV_DEV}`
    mock.onGet(dev).reply(200, stateOf(f1, ENV_DEV, { version: null }))
    mock.onPut(dev).reply(200, stateOf(f1, ENV_DEV, { enabled: true }))
    const { user } = mount(`?env=${ENV_DEV}`)
    await user.click(await screen.findByRole('switch', { name: /Toggle Synthetic flag 1/ }))
    await waitFor(() => expect(mock.history.put).toHaveLength(1))
    expect(JSON.parse(mock.history.put[0].data)).toEqual({ enabled: true, value: 'x', rolloutPercent: 40 })
  })
})

describe('S-2.16 legacy single-env route toggle', () => {
  const dev = `/flags/${f1.id}/environments/${ENV_DEV}`
  const mountLegacy = () => {
    mockBackend(mock, [f1])
    return renderWithProviders(
      <Routes><Route path="/orgs/:orgId/projects/:projectId/envs/:envId/flags" element={<FlagsPage />} /></Routes>,
      { route: `/orgs/${ORG}/projects/${PROJ}/envs/${ENV_DEV}/flags` },
    )
  }

  it('sends the displayed version; on 409 shows the shared conflict dialog', async () => {
    mock.onGet(dev).reply(200, stateOf(f1, ENV_DEV))
    mock.onPut(dev).reply(409)
    const { user } = mountLegacy()
    const btn = await screen.findByRole('button', { name: 'Disabled' })
    mock.resetHistory()
    await user.click(btn)
    expect(await screen.findByRole('dialog', { name: /Someone else changed this/ })).toBeInTheDocument()
    // written from the displayed state: the PUT is the first request after the click (no GET first)
    expect(mock.history[0].method).toBe('put')
    expect(JSON.parse(mock.history.put[0].data).version).toBe(5)
    expect(matrixCalls()).toHaveLength(0) // legacy route never calls the matrix endpoint
  })
})
