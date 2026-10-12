import { screen, waitFor, within } from '@testing-library/react'
import MockAdapter from 'axios-mock-adapter'
import { Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import api from '@/api/axios'
import { useAuthStore } from '@/stores/authStore'
import { useNavStore } from '@/stores/navStore'
import { renderWithProviders } from '@/test/renderWithProviders'
import { ENV_DEV, ORG, PROJ, mockBackend } from '@/test/fixtures'
import AppLayout from './AppLayout'

let mock: MockAdapter
const base = `/orgs/${ORG}/projects/${PROJ}`

function Loc() {
  const l = useLocation()
  return <p data-testid="loc">{l.pathname + l.search}</p>
}

function mount(route: string) {
  return renderWithProviders(
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/orgs/:orgId/projects/:projectId/flags" element={<Loc />} />
        <Route path="/orgs/:orgId/projects/:projectId" element={<Loc />} />
      </Route>
    </Routes>,
    { route },
  )
}

beforeEach(() => {
  window.__ENV__ = { FLAG_CENTRIC_NAV: 'true' }
  mock = new MockAdapter(api)
  mockBackend(mock)
  useAuthStore.setState({ token: 'synthetic-token', refreshToken: null, userId: 'u1', email: 'user@example.com' })
  // Simulates a fresh page load: nothing in the nav store.
  useNavStore.setState({ currentOrg: null, currentProject: null })
})
afterEach(() => mock.restore())

describe('AppLayout (S-1.3, kill-switch ON)', () => {
  it('has a "Flags" item under the selected project and no env switcher (0 env elements)', async () => {
    mount(`${base}/flags`)
    const nav = await screen.findByRole('navigation')
    expect(await within(nav).findByRole('button', { name: 'Flags' })).toBeInTheDocument()
    expect(within(nav).queryByRole('button', { name: /Synthetic Dev|Synthetic Prod/ })).not.toBeInTheDocument()
    expect(mock.history.get.filter((r) => r.url === '/environments')).toHaveLength(0)
  })

  it('"Flags" navigates to /flags', async () => {
    const { user } = mount(base)
    const nav = await screen.findByRole('navigation')
    await user.click(await within(nav).findByRole('button', { name: 'Flags' }))
    await waitFor(() => expect(screen.getByTestId('loc')).toHaveTextContent(`${base}/flags`))
  })

  it('after a reload on /flags?env=<valid>, URL keeps ?env= and sidebar still has "Flags"', async () => {
    mount(`${base}/flags?env=${ENV_DEV}`)
    const nav = await screen.findByRole('navigation')
    expect(await within(nav).findByRole('button', { name: 'Flags' })).toBeInTheDocument()
    expect(screen.getByTestId('loc')).toHaveTextContent(`${base}/flags?env=${ENV_DEV}`)
  })

  it('navStore no longer has currentEnv (S-1.2 AC3)', () => {
    expect('currentEnv' in useNavStore.getState()).toBe(false)
    expect('setCurrentEnv' in useNavStore.getState()).toBe(false)
  })
})
