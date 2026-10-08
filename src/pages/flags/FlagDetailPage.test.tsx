// S-1.7 / S-1.8 / S-1.9: Flag detail page, state editor, PROD guard. Synthetic data only.
import { act, screen, waitFor, within } from '@testing-library/react'
import { focusManager } from '@tanstack/react-query'
import MockAdapter from 'axios-mock-adapter'
import { Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { axe } from 'vitest-axe'
import api from '@/api/axios'
import { buildUpdateBody } from '@/api/flagEnvironments'
import FlagDetailPage from '@/pages/flags/FlagDetailPage'
import { renderWithProviders } from '@/test/renderWithProviders'
import { ENV_DEV, ENV_PROD, FLAG_ID, ORG, PROJ, flag, pageOf } from '@/test/fixtures'

const ENV_STG = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const base = `/orgs/${ORG}/projects/${PROJ}`
const route = `${base}/flags/${FLAG_ID}`

const envDev = { id: ENV_DEV, name: 'Synthetic Dev', projectId: PROJ, type: 'DEVELOPMENT', changeWindowStartHour: null, changeWindowEndHour: null, changeWindowTimezone: null }
const envStg = { id: ENV_STG, name: 'Synthetic Staging', projectId: PROJ, type: 'STAGING', changeWindowStartHour: null, changeWindowEndHour: null, changeWindowTimezone: null }
const envProd = {
  id: ENV_PROD, name: 'Synthetic Prod', projectId: PROJ, type: 'PRODUCTION',
  changeWindowStartHour: 9, changeWindowEndHour: 17, changeWindowTimezone: null,
  changeWindowZone: 'Asia/Ho_Chi_Minh', changeWindowOpenNow: true,
}
const st = (environmentId: string, over: Record<string, unknown> = {}) => ({
  flagId: FLAG_ID, environmentId, enabled: true, value: 'hello', rolloutPercent: 50, lastEvaluatedAt: null, ...over,
})

let mock: MockAdapter

function Probe() {
  return <p data-testid="loc">{useLocation().pathname}</p>
}
function mount() {
  return renderWithProviders(
    <Routes>
      <Route path="/orgs/:orgId/projects/:projectId/flags/:flagId" element={<FlagDetailPage />} />
      <Route path="*" element={<Probe />} />
    </Routes>,
    { route },
  )
}

interface Setup { flagOver?: Record<string, unknown>; states?: unknown[]; envs?: unknown[] }
function setup({ flagOver = {}, states, envs }: Setup = {}) {
  mock.onGet(`/flags/${FLAG_ID}`).reply(200, flag(1, { id: FLAG_ID, key: 'checkout-banner', description: 'Synthetic banner', valueType: 'STRING', expiresAt: '2026-12-31T00:00:00', ...flagOver }))
  mock.onGet('/environments').reply(200, pageOf(envs ?? [envProd, envDev, envStg]))
  const all = (states ?? [st(ENV_DEV), st(ENV_PROD, { value: 'prod-val' })]) as ReturnType<typeof st>[]
  mock.onGet(`/flags/${FLAG_ID}/environments`).reply(200, all)
  for (const s of all) mock.onGet(`/flags/${FLAG_ID}/environments/${s.environmentId}`).reply(200, s)
  mock.onGet(`/environments/${ENV_PROD}`).reply(200, envProd)
}
const puts = () => mock.history.put
const lastBody = () => JSON.parse(puts().at(-1)!.data)

beforeEach(() => { mock = new MockAdapter(api) })
afterEach(() => mock.restore())

describe('S-1.7 FlagDetailPage', () => {
  it('shows header (key, description, type, expiry, archive) and one card per env in DEV, STAGING, PROD order', async () => {
    setup()
    mount()
    expect(await screen.findByRole('heading', { level: 1, name: 'Synthetic flag 1' })).toBeInTheDocument()
    expect(screen.getByText('checkout-banner')).toBeInTheDocument()
    expect(screen.getByText('Synthetic banner')).toBeInTheDocument()
    expect(screen.getByText('STRING')).toBeInTheDocument()
    expect(screen.getByText('Expires 2026-12-31')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /archive/i })).toBeInTheDocument()
    const cards = await screen.findAllByRole('region', { name: /state$/ })
    expect(cards.map((c) => within(c).getByRole('heading').textContent)).toEqual(['Synthetic Dev', 'Synthetic Staging', 'Synthetic Prod'])
    expect(within(cards[0]).getByText('Enabled')).toBeInTheDocument()
    expect(within(cards[0]).getByText('hello')).toBeInTheDocument()
    expect(within(cards[0]).getByText('50%')).toBeInTheDocument()
  })

  it('shows "Not configured" for an env without state and offers no edit there', async () => {
    setup()
    mount()
    const cards = await screen.findAllByRole('region', { name: /state$/ })
    expect(within(cards[1]).getByText('Not configured')).toBeInTheDocument()
    expect(within(cards[1]).queryByRole('button')).not.toBeInTheDocument()
  })

  it('reports not found on 404 and has no History tab', async () => {
    mock.onGet(`/flags/${FLAG_ID}`).reply(404, { detail: 'Flag not found' })
    mock.onGet('/environments').reply(200, pageOf([]))
    mock.onGet(`/flags/${FLAG_ID}/environments`).reply(404)
    mount()
    expect(await screen.findByRole('heading', { name: 'Flag not found' })).toBeInTheDocument()
    expect(screen.queryByText(/history/i)).not.toBeInTheDocument()
  })

  it('has no History tab on a normal flag', async () => {
    setup()
    mount()
    await screen.findByRole('heading', { level: 1 })
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
    expect(screen.queryByText(/history/i)).not.toBeInTheDocument()
  })

  it('archives via DELETE after confirmation and returns to the list', async () => {
    setup()
    mock.onDelete(`/flags/${FLAG_ID}`).reply(204)
    const { user } = mount()
    await user.click(await screen.findByRole('button', { name: /^archive$/i }))
    const dlg = await screen.findByRole('dialog')
    await user.click(within(dlg).getByRole('button', { name: /^archive$/i }))
    await waitFor(() => expect(mock.history.delete).toHaveLength(1))
    expect(await screen.findByTestId('loc')).toHaveTextContent(`${base}/flags`)
  })

  it('has no axe violations', async () => {
    setup()
    const { container } = mount()
    await screen.findAllByRole('region', { name: /state$/ })
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('S-1.8 FlagStateEditor (non-PROD)', () => {
  const openDev = async (over: Setup = {}) => {
    setup(over)
    const utils = mount()
    await utils.user.click(await screen.findByRole('button', { name: 'Edit Synthetic Dev' }))
    const dlg = await screen.findByRole('dialog')
    await within(dlg).findByLabelText(/^Value/)
    return { ...utils, dlg }
  }

  it('AC1: reloads the state right before showing the form and warns about concurrent overwrite', async () => {
    const before = () => mock.history.get.filter((r) => r.url === `/flags/${FLAG_ID}/environments/${ENV_DEV}`).length
    setup()
    const { user } = mount()
    await screen.findAllByRole('region', { name: /state$/ })
    expect(before()).toBe(0)
    await user.click(screen.getByRole('button', { name: 'Edit Synthetic Dev' }))
    const dlg = await screen.findByRole('dialog')
    await within(dlg).findByLabelText(/^Value/)
    expect(before()).toBe(1)
    expect(within(dlg).getByText(/may overwrite concurrent changes/i)).toBeInTheDocument()
  })

  it('AC2: INTEGER "abc" is blocked client-side with a message and no PUT is sent', async () => {
    const { user, dlg } = await openDev({ flagOver: { valueType: 'INTEGER' }, states: [st(ENV_DEV, { value: '7' })] })
    const input = within(dlg).getByLabelText(/^Value/)
    await user.clear(input)
    await user.type(input, 'abc')
    expect(within(dlg).getByText('Value must be a whole number.')).toBeInTheDocument()
    expect(within(dlg).getByRole('button', { name: 'Save' })).toBeDisabled()
    await user.type(input, '{Enter}')
    expect(puts()).toHaveLength(0)
  })

  it('AC2: when the server answers 400 the error is shown and the card is unchanged', async () => {
    mock.onPut(`/flags/${FLAG_ID}/environments/${ENV_DEV}`).reply(400, { detail: 'Bad value from server' })
    const { user, dlg } = await openDev()
    const input = within(dlg).getByLabelText(/^Value/)
    await user.clear(input)
    await user.type(input, 'changed')
    await user.click(within(dlg).getByRole('button', { name: 'Save' }))
    expect(await within(dlg).findByText('Bad value from server')).toBeInTheDocument()
    const card = screen.getByRole('region', { name: 'Synthetic Dev state', hidden: true })
    expect(within(card).getByText('hello')).toBeInTheDocument()
    expect(within(card).queryByText('changed')).not.toBeInTheDocument()
  })

  it('AC3: PUT carries the full state (enabled, value, rolloutPercent) from the freshly loaded state', async () => {
    mock.onPut(`/flags/${FLAG_ID}/environments/${ENV_DEV}`).reply(200, st(ENV_DEV))
    const { user, dlg } = await openDev()
    await user.click(within(dlg).getByRole('switch', { name: 'Enabled' }))
    await user.click(within(dlg).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(puts()).toHaveLength(1))
    expect(lastBody()).toEqual({ enabled: false, value: 'hello', rolloutPercent: 50 })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('sends clearValue (and no value) only when the user empties an existing value', async () => {
    mock.onPut(`/flags/${FLAG_ID}/environments/${ENV_DEV}`).reply(200, st(ENV_DEV, { value: null }))
    const { user, dlg } = await openDev()
    await user.clear(within(dlg).getByLabelText(/^Value/))
    await user.click(within(dlg).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(puts()).toHaveLength(1))
    expect(lastBody()).toEqual({ enabled: true, clearValue: true, rolloutPercent: 50 })
  })

  it('omits value and clearValue when the state has no value and none is entered', async () => {
    mock.onPut(`/flags/${FLAG_ID}/environments/${ENV_DEV}`).reply(200, st(ENV_DEV))
    const { user, dlg } = await openDev({ states: [st(ENV_DEV, { value: null })] })
    await user.click(within(dlg).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(puts()).toHaveLength(1))
    expect(lastBody()).toEqual({ enabled: true, rolloutPercent: 50 })
  })

  it('validates rollout range and JSON', async () => {
    const { user, dlg } = await openDev({ flagOver: { valueType: 'JSON' }, states: [st(ENV_DEV, { value: '{"a":1}' })] })
    const rollout = within(dlg).getByLabelText(/Rollout/)
    await user.clear(rollout)
    await user.type(rollout, '101')
    expect(within(dlg).getByText(/Rollout must be a whole number from 0 to 100/)).toBeInTheDocument()
    await user.clear(rollout)
    await user.type(rollout, '10')
    const value = within(dlg).getByLabelText(/^Value/)
    await user.clear(value)
    await user.type(value, 'not json')
    expect(within(dlg).getByText('Value must be valid JSON.')).toBeInTheDocument()
    expect(within(dlg).getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('shows the secret-in-value advisory (D-10)', async () => {
    const { dlg } = await openDev()
    expect(within(dlg).getByText(/Do not put secrets in the value/)).toBeInTheDocument()
  })

  it('AC4: an HTML payload in value is rendered as inert text on the card and in the editor', async () => {
    const payload = '<img src=x onerror="window.__xss=1">'
    const { user, container } = await (async () => {
      setup({ states: [st(ENV_DEV, { value: payload })] })
      const u = mount()
      await screen.findAllByRole('region', { name: /state$/ })
      return u
    })()
    const card = screen.getByRole('region', { name: 'Synthetic Dev state', hidden: true })
    expect(within(card).getByTestId('card-value').textContent).toBe(payload)
    expect(container.querySelector('img')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Edit Synthetic Dev' }))
    const dlg = await screen.findByRole('dialog')
    expect(await within(dlg).findByDisplayValue(payload)).toBeInTheDocument()
    expect(document.querySelector('img')).toBeNull()
    expect((window as unknown as { __xss?: number }).__xss).toBeUndefined()
  })

  it('AC4: new code never uses dangerouslySetInnerHTML', () => {
    const files = import.meta.glob<string>(
      ['/src/pages/flags/FlagDetailPage.tsx', '/src/components/flags/*.tsx', '/src/lib/flagValue.ts', '/src/api/flagEnvironments.ts'],
      { query: '?raw', import: 'default', eager: true },
    )
    expect(Object.keys(files).length).toBeGreaterThanOrEqual(5)
    for (const [name, src] of Object.entries(files)) expect(src, name).not.toContain('dangerouslySetInnerHTML')
  })

  it('editor has no axe violations', async () => {
    await openDev()
    expect(await axe(document.body)).toHaveNoViolations()
  })
})

describe('buildUpdateBody (single write call site)', () => {
  it('never sends clearValue together with value', () => {
    expect(buildUpdateBody({ flagId: 'f', envId: 'e', enabled: true, value: 'x', clearValue: true, rolloutPercent: 1 })).toEqual({ enabled: true, clearValue: true, rolloutPercent: 1 })
  })
})

describe('S-1.9 ProdGuardDialog (advisory; server decides)', () => {
  const openProdGuard = async (envOver: Record<string, unknown> = {}) => {
    const prod = { ...envProd, ...envOver }
    setup({ envs: [prod, envDev, envStg] })
    mock.onGet(`/environments/${ENV_PROD}`).reply(200, prod)
    const utils = mount()
    await utils.user.click(await screen.findByRole('button', { name: 'Edit Synthetic Prod' }))
    const editor = await screen.findByRole('dialog')
    const value = await within(editor).findByLabelText(/^Value/)
    await utils.user.clear(value)
    await utils.user.type(value, 'new-prod')
    await utils.user.click(within(editor).getByRole('button', { name: /review and save/i }))
    const guard = await screen.findByRole('dialog', { name: /confirm change to synthetic prod/i })
    return { ...utils, guard }
  }

  it('shows env name, before/after diff, OWNER reminder and that this is not four-eyes', async () => {
    const { guard } = await openProdGuard()
    expect(within(guard).getByText(/Confirm change to Synthetic Prod/)).toBeInTheDocument()
    const diff = within(guard).getByRole('table', { name: 'Changes to apply' })
    expect(within(diff).getByText('prod-val')).toBeInTheDocument()
    expect(within(diff).getByText('new-prod')).toBeInTheDocument()
    expect(within(guard).getByText(/requires the OWNER role/i)).toBeInTheDocument()
    expect(within(guard).getByText(/not a four-eyes review/i)).toBeInTheDocument()
    expect(puts()).toHaveLength(0)
  })

  it('requires typing the flag key before the save button enables, then sends prodAcknowledged', async () => {
    mock.onPut(`/flags/${FLAG_ID}/environments/${ENV_PROD}`).reply(200, st(ENV_PROD))
    const { user, guard } = await openProdGuard()
    const confirm = within(guard).getByRole('button', { name: /save to production/i })
    await waitFor(() => expect(within(guard).getByText(/change window is open/i)).toBeInTheDocument())
    expect(confirm).toBeDisabled()
    await user.type(within(guard).getByLabelText(/Type the flag key/), 'checkout-bann')
    expect(confirm).toBeDisabled()
    await user.type(within(guard).getByLabelText(/Type the flag key/), 'er')
    expect(confirm).toBeEnabled()
    await user.click(confirm)
    await waitFor(() => expect(puts()).toHaveLength(1))
    expect(lastBody()).toEqual({ enabled: true, value: 'new-prod', rolloutPercent: 50, prodAcknowledged: true })
  })

  it('shows the server-reported window (zone and hours) and disables save when the server says it is closed', async () => {
    const { user, guard } = await openProdGuard({ changeWindowOpenNow: false })
    await user.type(within(guard).getByLabelText(/Type the flag key/), 'checkout-banner')
    const win = within(guard).getByTestId('prod-guard-window')
    await waitFor(() => expect(win).toHaveTextContent(/closed right now/i))
    expect(win).toHaveTextContent('09:00 to 17:00 (Asia/Ho_Chi_Minh)')
    expect(within(guard).getByRole('button', { name: /save to production/i })).toBeDisabled()
  })

  it('does not guess the window when the server did not report it', async () => {
    const { user, guard } = await openProdGuard({ changeWindowOpenNow: null })
    await user.type(within(guard).getByLabelText(/Type the flag key/), 'checkout-banner')
    await waitFor(() => expect(within(guard).getByTestId('prod-guard-window')).toHaveTextContent(/status unknown/i))
    expect(within(guard).getByRole('button', { name: /save to production/i })).toBeEnabled()
  })

  it('shows the server 403 reason verbatim and leaves the card unchanged', async () => {
    mock.onPut(`/flags/${FLAG_ID}/environments/${ENV_PROD}`).reply(403, { detail: 'Only an OWNER may change PRODUCTION' })
    const { user, guard } = await openProdGuard()
    await user.type(within(guard).getByLabelText(/Type the flag key/), 'checkout-banner')
    await user.click(within(guard).getByRole('button', { name: /save to production/i }))
    expect(await within(guard).findByText('Only an OWNER may change PRODUCTION')).toBeInTheDocument()
    const card = screen.getByRole('region', { name: 'Synthetic Prod state', hidden: true })
    expect(within(card).getByText('prod-val')).toBeInTheDocument()
  })

  it('resets the typed key after Cancel so a reopened guard needs the key again', async () => {
    const { user, guard } = await openProdGuard()
    await user.type(within(guard).getByLabelText(/Type the flag key/), 'checkout-banner')
    await user.click(within(guard).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /confirm change/i })).not.toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /review and save/i }))
    const again = await screen.findByRole('dialog', { name: /confirm change/i })
    expect(within(again).getByLabelText(/Type the flag key/)).toHaveValue('')
    expect(within(again).getByRole('button', { name: /save to production/i })).toBeDisabled()
  })

  it('treats a failed window reload as unknown: stale list data neither blocks nor claims open', async () => {
    const prod = { ...envProd, changeWindowOpenNow: false }
    setup({ envs: [prod, envDev, envStg] })
    mock.onGet(`/environments/${ENV_PROD}`).reply(500)
    const { user } = mount()
    await user.click(await screen.findByRole('button', { name: 'Edit Synthetic Prod' }))
    const editor = await screen.findByRole('dialog')
    await within(editor).findByLabelText(/^Value/)
    await user.click(within(editor).getByRole('button', { name: /review and save/i }))
    const guard = await screen.findByRole('dialog', { name: /confirm change/i })
    await user.type(within(guard).getByLabelText(/Type the flag key/), 'checkout-banner')
    await waitFor(() => expect(within(guard).getByTestId('prod-guard-window')).toHaveTextContent(/status unknown/i))
    expect(within(guard).getByTestId('prod-guard-window')).not.toHaveTextContent(/closed right now|open right now/i)
    expect(within(guard).getByRole('button', { name: /save to production/i })).toBeEnabled()
  })

  const freshGets = () => mock.history.get.filter((r) => r.url === `/flags/${FLAG_ID}/environments/${ENV_PROD}`).length

  it('window focus does not refetch the editor state (stale data, but the form must not be rebuilt)', async () => {
    const { guard } = await openProdGuard()
    expect(freshGets()).toBe(1)
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    act(() => { focusManager.setFocused(false); focusManager.setFocused(true) })
    await new Promise((r) => setTimeout(r, 50))
    expect(freshGets()).toBe(1)
    expect(within(guard).getByLabelText(/Type the flag key/)).toBeInTheDocument()
  })

  it('a refetch of the editor state keeps typed edits and the open guard', async () => {
    const { user, guard, queryClient } = await openProdGuard()
    await user.type(within(guard).getByLabelText(/Type the flag key/), 'checkout')
    expect(freshGets()).toBe(1)
    await act(() => queryClient.refetchQueries({ queryKey: ['flag-state-fresh'] }))
    expect(freshGets()).toBe(2)
    const still = screen.getByRole('dialog', { name: /confirm change/i })
    expect(within(still).getByLabelText(/Type the flag key/)).toHaveValue('checkout')
    await user.click(within(still).getByRole('button', { name: 'Cancel' }))
    const editor = await screen.findByRole('dialog')
    expect(within(editor).getByLabelText(/^Value/)).toHaveValue('new-prod')
  })

  it('returns focus to the trigger after the guard closes', async () => {
    const { user, guard } = await openProdGuard()
    await user.click(within(guard).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /confirm change/i })).not.toBeInTheDocument())
    await waitFor(() => expect(screen.getByRole('button', { name: /review and save/i })).toHaveFocus())
  })

  it('guard has no axe violations', async () => {
    await openProdGuard()
    expect(await axe(document.body)).toHaveNoViolations()
  })
})
