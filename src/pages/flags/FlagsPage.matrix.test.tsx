import { screen, waitFor, within } from '@testing-library/react'
import MockAdapter from 'axios-mock-adapter'
import { Route, Routes } from 'react-router-dom'
import { axe } from 'vitest-axe'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import api from '@/api/axios'
import { renderWithProviders } from '@/test/renderWithProviders'
import { ENV_DEV, ENV_PROD, ORG, PROJ, flag, mockBackend } from '@/test/fixtures'
import FlagsPage from './FlagsPage'

let mock: MockAdapter
const f1 = flag(1)
const f2 = flag(2, { valueType: 'STRING' })
const stateOf = (f: { id: string }, envId: string, over = {}) => ({
  flagId: f.id, environmentId: envId, enabled: false, value: 'x', rolloutPercent: 40, lastEvaluatedAt: null, ...over,
})

beforeEach(() => {
  window.__ENV__ = { FLAG_CENTRIC_NAV: 'true' }
  mock = new MockAdapter(api)
  // Specific state handlers first: mockBackend's catch-all state 404 would shadow them (first match wins).
  mock.onGet(`/flags/${f1.id}/environments/${ENV_DEV}`).reply(200, stateOf(f1, ENV_DEV))
  mock.onGet(`/flags/${f1.id}/environments/${ENV_PROD}`).reply(200, stateOf(f1, ENV_PROD, { enabled: true }))
  mock.onGet(`/flags/${f2.id}/environments/${ENV_DEV}`).reply(200, stateOf(f2, ENV_DEV, { enabled: true }))
  mockBackend(mock, [f1, f2])
})
afterEach(() => mock.restore())

const mountNew = (search = '') =>
  renderWithProviders(
    <Routes><Route path="/orgs/:orgId/projects/:projectId/flags" element={<FlagsPage />} /></Routes>,
    { route: `/orgs/${ORG}/projects/${PROJ}/flags${search}` },
  )
const mountLegacy = () =>
  renderWithProviders(
    <Routes><Route path="/orgs/:orgId/projects/:projectId/envs/:envId/flags" element={<FlagsPage />} /></Routes>,
    { route: `/orgs/${ORG}/projects/${PROJ}/envs/${ENV_DEV}/flags` },
  )

describe('FlagsPage matrix (S-1.4a/b) on the flag-centric route', () => {
  it('renders a flag x env grid: one row per flag, DEV before PROD, no quick toggles without ?env=', async () => {
    mountNew()
    const grid = await screen.findByRole('grid')
    expect(await within(grid).findByRole('img', { name: /Synthetic flag 1 in Synthetic Dev: disabled, value x, rollout 40%/ })).toBeInTheDocument()
    expect(screen.getAllByText('Synthetic flag 1')).toHaveLength(1)
    const heads = screen.getAllByRole('columnheader').map((h) => h.textContent ?? '')
    expect(heads.findIndex((t) => t.includes('Synthetic Dev'))).toBeLessThan(heads.findIndex((t) => t.includes('Synthetic Prod')))
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
    // f2 has no PROD state (404) -> "Not configured", not an error
    expect(await screen.findAllByText('Not configured')).not.toHaveLength(0)
  })

  it('?env=<dev> focuses that column: BOOLEAN flag gets a toggle, STRING flag does not', async () => {
    mountNew(`?env=${ENV_DEV}`)
    const sw = await screen.findAllByRole('switch')
    expect(sw).toHaveLength(1)
    expect(sw[0]).toHaveAccessibleName('Toggle Synthetic flag 1 in Synthetic Dev')
  })

  it('?env=<prod> focuses PROD: zero toggles', async () => {
    mountNew(`?env=${ENV_PROD}`)
    await screen.findByText(/Production changes are made from the flag detail page/)
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Synthetic flag 1.*Synthetic Prod/ }).getAttribute('href'))
      .toBe(`/orgs/${ORG}/projects/${PROJ}/flags/${f1.id}?env=${ENV_PROD}`)
  })

  it('quick toggle PUTs the full state (S-0.1) after reloading it', async () => {
    mock.onPut(`/flags/${f1.id}/environments/${ENV_DEV}`).reply(200, stateOf(f1, ENV_DEV, { enabled: true }))
    const { user } = mountNew(`?env=${ENV_DEV}`)
    await user.click(await screen.findByRole('switch'))
    await waitFor(() => expect(mock.history.put).toHaveLength(1))
    expect(JSON.parse(mock.history.put[0].data)).toEqual({ enabled: true, value: 'x', rolloutPercent: 40 })
  })

  it('page has no axe violations', async () => {
    const { container } = mountNew(`?env=${ENV_DEV}`)
    await screen.findByRole('switch')
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('FlagsPage legacy route toggle (S-0.1)', () => {
  it('AC1+AC2: GET state then PUT with enabled + value + rolloutPercent', async () => {
    mock.onPut(`/flags/${f1.id}/environments/${ENV_DEV}`).reply(200, stateOf(f1, ENV_DEV, { enabled: true }))
    const { user } = mountLegacy()
    const btn = await screen.findAllByRole('button', { name: 'Disabled' })
    mock.resetHistory()
    await user.click(btn[0])
    await waitFor(() => expect(mock.history.put).toHaveLength(1))
    expect(JSON.parse(mock.history.put[0].data)).toEqual({ enabled: true, value: 'x', rolloutPercent: 40 })
    expect(mock.history.map((r) => r.method).slice(0, 2)).toEqual(['get', 'put'])
  })

  it('AC3: a 403 keeps the old value and shows the error', async () => {
    mock.onPut(/.*/).reply(403, { title: 'Forbidden', detail: 'No permission' })
    const { user } = mountLegacy()
    const btn = await screen.findAllByRole('button', { name: 'Disabled' })
    await user.click(btn[0])
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Got it' }))
    expect((await screen.findAllByRole('button', { name: 'Disabled' }))[0]).toBeInTheDocument()
  })
})
