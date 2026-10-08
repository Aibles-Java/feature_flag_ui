import { screen, waitFor, within } from '@testing-library/react'
import MockAdapter from 'axios-mock-adapter'
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import api from '@/api/axios'
import { AppRoutes } from '@/App'
import { useAuthStore } from '@/stores/authStore'
import { useNavStore } from '@/stores/navStore'
import { ENV_DEV, FLAG_ID, ORG, PROJ, flag, mockBackend } from '@/test/fixtures'

let mock: MockAdapter
let navigateRef: ReturnType<typeof useNavigate>

function Probe() {
  const loc = useLocation()
  navigateRef = useNavigate()
  return <p data-testid="loc">{loc.pathname + loc.search}</p>
}

function mount(entries: string[]) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={entries} initialIndex={entries.length - 1}>
        <AppRoutes />
        <Probe />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const base = `/orgs/${ORG}/projects/${PROJ}`
const loc = () => screen.getByTestId('loc').textContent

beforeEach(() => {
  mock = new MockAdapter(api)
  mockBackend(mock)
  useAuthStore.setState({ token: 'synthetic-token', refreshToken: null, userId: 'u1', email: 'user@example.com' })
  useNavStore.setState({ currentOrg: null, currentProject: null })
})
afterEach(() => mock.restore())

describe('S-1.1 routes with the kill-switch ON', () => {
  beforeEach(() => {
    window.__ENV__ = { FLAG_CENTRIC_NAV: 'true' }
  })

  it('AC1: /projects/:p/flags shows the project Flags list without choosing an env', async () => {
    mount([`${base}/flags`])
    expect(await screen.findByRole('heading', { name: 'Feature Flags' })).toBeInTheDocument()
    expect(await screen.findByText('Synthetic flag 1')).toBeInTheDocument()
    expect(loc()).toBe(`${base}/flags`)
  })

  it('AC2: /projects/:p/flags/:flagId matches and passes flagId to the detail page', async () => {
    mock.onGet(`/flags/${FLAG_ID}`).reply(200, flag(7, { id: FLAG_ID, key: 'routed-flag' }))
    mock.onGet(`/flags/${FLAG_ID}/environments`).reply(200, [])
    mount([`${base}/flags/${FLAG_ID}`])
    expect(await screen.findByText('routed-flag')).toBeInTheDocument()
    expect(mock.history.get.some((r) => r.url === `/flags/${FLAG_ID}`)).toBe(true)
  })

  it('AC3: legacy envs/:e/flags redirects (replace) to /flags?env=:e and adds no history entry', async () => {
    mount(['/orgs', `${base}/envs/${ENV_DEV}/flags`])
    await waitFor(() => expect(loc()).toBe(`${base}/flags?env=${ENV_DEV}`))
    // Going back must skip the legacy URL and land on the previous entry.
    navigateRef(-1)
    await waitFor(() => expect(loc()).toBe('/orgs'))
  })

  it('AC4: the Environments page (/projects/:p) is unchanged', async () => {
    mount([base])
    expect(await screen.findByRole('heading', { name: 'Environments' })).toBeInTheDocument()
    expect(loc()).toBe(base)
  })
})

describe.each([
  ['unset', undefined],
  ['"false"', 'false'],
  ['unknown value', 'maybe'],
  ['empty', ''],
])('S-1.11 kill-switch OFF (%s) keeps old behaviour', (_label, value) => {
  beforeEach(() => {
    window.__ENV__ = value === undefined ? {} : { FLAG_CENTRIC_NAV: value }
  })

  it('legacy envs/:e/flags renders the old page and does not redirect', async () => {
    mount([`${base}/envs/${ENV_DEV}/flags`])
    expect(await screen.findByRole('heading', { name: 'Feature Flags' })).toBeInTheDocument()
    expect(loc()).toBe(`${base}/envs/${ENV_DEV}/flags`)
  })

  it('new routes are not registered (fall through to /orgs)', async () => {
    mount([`${base}/flags`])
    await waitFor(() => expect(loc()).toBe('/orgs'))
  })

  it('sidebar still shows the env switcher and no "Flags" item', async () => {
    mount([`${base}/envs/${ENV_DEV}/flags`])
    const nav = await screen.findByRole('navigation')
    expect(await within(nav).findByRole('button', { name: /Synthetic Dev/ })).toBeInTheDocument()
    expect(within(nav).queryByRole('button', { name: 'Flags' })).not.toBeInTheDocument()
  })
})

describe('S-1.11 kill-switch is runtime: flipping config changes routing without rebuild', () => {
  it('same build, ON then OFF', async () => {
    window.__ENV__ = { FLAG_CENTRIC_NAV: 'true' }
    const first = mount([`${base}/envs/${ENV_DEV}/flags`])
    await waitFor(() => expect(loc()).toBe(`${base}/flags?env=${ENV_DEV}`))
    first.unmount()
    window.__ENV__ = { FLAG_CENTRIC_NAV: 'false' }
    mount([`${base}/envs/${ENV_DEV}/flags`])
    expect(await screen.findByRole('heading', { name: 'Feature Flags' })).toBeInTheDocument()
    expect(loc()).toBe(`${base}/envs/${ENV_DEV}/flags`)
  })
})
