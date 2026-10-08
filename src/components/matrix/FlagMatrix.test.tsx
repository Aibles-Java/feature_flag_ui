import { screen, waitFor, within } from '@testing-library/react'
import MockAdapter from 'axios-mock-adapter'
import { axe } from 'vitest-axe'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import api from '@/api/axios'
import type { Environment } from '@/api/environments'
import type { FeatureFlag } from '@/api/flags'
import { MAX_CONCURRENT_STATE_REQUESTS, STATE_STALE_TIME_MS } from '@/config/matrixConfig'
import { renderWithProviders } from '@/test/renderWithProviders'
import { PROJ, flag as baseFlag } from '@/test/fixtures'

const flag = (n: number, over: Record<string, unknown> = {}) => baseFlag(n, over) as FeatureFlag
import FlagMatrix from './FlagMatrix'

const env = (id: string, name: string, type: Environment['type']): Environment => ({
  id,
  name,
  projectId: PROJ,
  type,
  changeWindowStartHour: null,
  changeWindowEndHour: null,
  changeWindowTimezone: null,
  createdAt: '2026-01-01T00:00:00Z',
})
const E_DEV = '11111111-1111-4111-8111-111111111111'
const E_STG = '22222222-2222-4222-8222-222222222222'
const E_PRD = '33333333-3333-4333-8333-333333333333'
// Deliberately out of order: the matrix must sort DEV -> STAGING -> PROD.
const ENVS = [env(E_PRD, 'Prod', 'PRODUCTION'), env(E_DEV, 'Dev', 'DEVELOPMENT'), env(E_STG, 'Stage', 'STAGING')]

let mock: MockAdapter
beforeEach(() => {
  mock = new MockAdapter(api)
})
afterEach(() => mock.restore())

const st = (f: FeatureFlag, envId: string, over: Record<string, unknown> = {}) => ({
  flagId: f.id,
  environmentId: envId,
  enabled: true,
  value: undefined,
  rolloutPercent: 100,
  lastEvaluatedAt: null,
  ...over,
})

const mount = (flags: FeatureFlag[], focusEnvId?: string) =>
  renderWithProviders(
    <FlagMatrix
      flags={flags}
      environments={ENVS}
      focusEnvId={focusEnvId}
      renderRowHeader={(f) => <span>{f.name}</span>}
      renderActions={(f) => <button type="button">Edit {f.name}</button>}
      detailHref={(f, e) => `/flags/${f.id}?env=${e}`}
    />,
  )

const allChipsLoaded = () =>
  waitFor(() => {
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument()
    expect(screen.getAllByRole('img', { name: /enabled/ })).toHaveLength(3)
  })

describe('FlagMatrix (S-1.4a)', () => {
  it('AC1: rows are flags, columns are envs sorted DEV -> STAGING -> PROD; PROD column has a lock', async () => {
    const f = flag(1)
    mock.onGet(/\/flags\/.+\/environments\/.+/).reply(200, st(f, E_DEV))
    mount([f])
    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent)
    expect(headers.filter((t) => /Dev|Stage|Prod/.test(t ?? ''))).toEqual([
      expect.stringContaining('Dev'),
      expect.stringContaining('Stage'),
      expect.stringContaining('Prod'),
    ])
    const prod = screen.getByRole('columnheader', { name: /Prod/ })
    expect(within(prod).getByLabelText('Production environment (locked)')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /Dev/ })).not.toHaveTextContent('locked')
    await waitFor(() => expect(screen.getAllByText('On')).toHaveLength(3))
  })

  it('AC1: chip shows On/Off as text, truncated value, and rollout% only when < 100', async () => {
    const f = flag(1, { valueType: 'STRING' })
    mock.onGet(`/flags/${f.id}/environments/${E_DEV}`).reply(200, st(f, E_DEV, { enabled: true, value: 'abcdefghijklmnopqrstuvwxyz', rolloutPercent: 40 }))
    mock.onGet(`/flags/${f.id}/environments/${E_STG}`).reply(200, st(f, E_STG, { enabled: false, rolloutPercent: 100 }))
    mock.onGet(`/flags/${f.id}/environments/${E_PRD}`).reply(200, st(f, E_PRD, { enabled: true, value: 'v', rolloutPercent: 100 }))
    mount([f])
    expect(await screen.findByText('Off')).toBeInTheDocument()
    expect(screen.getByText('40%')).toBeInTheDocument()
    expect(screen.queryByText('100%')).not.toBeInTheDocument()
    expect(screen.getByText(/^abcdefghijkl/)).toHaveTextContent(/…$/)
    expect(screen.queryByText('abcdefghijklmnopqrstuvwxyz')).not.toBeInTheDocument()
  })

  it('AC2: a 404 cell reads "Not configured", is not an error and offers no create button', async () => {
    const f = flag(1)
    mock.onGet(/\/flags\/.+\/environments\/.+/).reply(404)
    mount([f])
    await waitFor(() => expect(screen.getAllByText('Not configured')).toHaveLength(3))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /create|add|configure/i })).not.toBeInTheDocument()
  })

  it('a 500 cell shows a text error (not colour only), other cells still render', async () => {
    const f = flag(1)
    mock.onGet(`/flags/${f.id}/environments/${E_DEV}`).reply(500)
    mock.onGet(/\/flags\/.+\/environments\/.+/).reply(200, st(f, E_STG))
    mount([f])
    expect(await screen.findByText('Failed to load')).toBeInTheDocument()
    await waitFor(() => expect(screen.getAllByText('On')).toHaveLength(2))
  })

  it('AC3: 20 flags x 3 envs -> at most 60 state requests, never more than D-20 (6) in flight', async () => {
    const flags = Array.from({ length: 20 }, (_, i) => flag(i + 1))
    let active = 0
    let peak = 0
    mock.onGet(/\/flags\/.+\/environments\/.+/).reply(async () => {
      active++
      peak = Math.max(peak, active)
      await new Promise((r) => setTimeout(r, 3))
      active--
      return [200, st(flags[0], E_DEV)]
    })
    mount(flags)
    await waitFor(() => expect(screen.getAllByText('On')).toHaveLength(60), { timeout: 8000 })
    expect(mock.history.get).toHaveLength(60)
    expect(peak).toBeGreaterThan(1)
    expect(peak).toBeLessThanOrEqual(MAX_CONCURRENT_STATE_REQUESTS)
  }, 15000)

  it('AC3: cell queries carry a staleTime (no refetch storm on re-render)', async () => {
    const f = flag(1)
    mock.onGet(/\/flags\/.+\/environments\/.+/).reply(200, st(f, E_DEV))
    const { queryClient } = mount([f])
    await screen.findAllByText('On')
    const q = queryClient.getQueryCache().find({ queryKey: ['flag-cell', f.id, E_DEV] })
    expect(q?.observers[0].options.staleTime).toBe(STATE_STALE_TIME_MS)
  })

  it('AC4: cells have descriptive accessible names and the grid has no axe violations', async () => {
    const f = flag(1)
    mock.onGet(`/flags/${f.id}/environments/${E_DEV}`).reply(200, st(f, E_DEV, { enabled: true, rolloutPercent: 40, value: 'x' }))
    mock.onGet(/\/flags\/.+\/environments\/.+/).reply(404)
    const { container } = mount([f])
    expect(await screen.findByRole('img', { name: /Synthetic flag 1 in Dev: enabled, value x, rollout 40%/ })).toBeInTheDocument()
    expect(await screen.findByRole('img', { name: /Synthetic flag 1 in Prod: not configured/ })).toBeInTheDocument()
    expect(screen.getByRole('grid')).toBeInTheDocument()
    expect(await axe(container)).toHaveNoViolations()
  })

  it('keyboard: arrow keys move focus between cells (roving tabindex)', async () => {
    const flags = [flag(1), flag(2)]
    mock.onGet(/\/flags\/.+\/environments\/.+/).reply(404)
    const { user } = mount(flags)
    await screen.findAllByText('Not configured')
    const cells = screen.getAllByRole('gridcell')
    const tabbable = [...screen.getAllByRole('gridcell'), ...screen.getAllByRole('rowheader'), ...screen.getAllByRole('columnheader')].filter(
      (c) => c.getAttribute('tabindex') === '0',
    )
    expect(tabbable).toHaveLength(1)
    tabbable[0].focus()
    await user.keyboard('{ArrowRight}')
    expect(document.activeElement).not.toBe(tabbable[0])
    await user.keyboard('{ArrowDown}')
    expect(cells.concat(screen.getAllByRole('rowheader'), screen.getAllByRole('columnheader'))).toContain(document.activeElement)
    await user.keyboard('{Home}')
    expect(document.activeElement).toHaveAttribute('aria-colindex', '1')
  })
})

describe('FlagMatrix focus mode (S-1.4b)', () => {
  it('AC1: the focus env column is expanded to detail mode (full value, rollout, last evaluated)', async () => {
    const f = flag(1, { valueType: 'STRING' })
    mock.onGet(`/flags/${f.id}/environments/${E_DEV}`).reply(200, st(f, E_DEV, { value: 'abcdefghijklmnopqrstuvwxyz', rolloutPercent: 40, lastEvaluatedAt: '2026-02-03T04:05:06' }))
    mock.onGet(/\/flags\/.+\/environments\/.+/).reply(404)
    mount([f], E_DEV)
    expect(await screen.findByText('abcdefghijklmnopqrstuvwxyz')).toBeInTheDocument()
    expect(screen.getByText(/Rollout/)).toHaveTextContent('40%')
    expect(screen.getByText(/Last evaluated/)).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /Dev/ })).toHaveAttribute('data-focus', 'true')
  })

  it('AC1: no focus env -> no detail mode, no toggles anywhere', async () => {
    const f = flag(1)
    mock.onGet(/\/flags\/.+\/environments\/.+/).reply(200, st(f, E_DEV))
    mount([f])
    await allChipsLoaded()
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
  })

  it('AC2: BOOLEAN flag in a non-PROD focus env has exactly one quick toggle (in that column only)', async () => {
    const f = flag(1)
    mock.onGet(/\/flags\/.+\/environments\/.+/).reply(200, st(f, E_DEV))
    mount([f], E_STG)
    await allChipsLoaded()
    const toggles = screen.getAllByRole('switch')
    expect(toggles).toHaveLength(1)
    expect(toggles[0]).toHaveAccessibleName(/Synthetic flag 1.*Stage/)
    expect(toggles[0]).toHaveAttribute('aria-checked', 'true')
  })

  it.each(['STRING', 'INTEGER', 'JSON'] as const)('AC2: %s flag -> 0 toggle elements', async (valueType) => {
    const f = flag(1, { valueType })
    mock.onGet(/\/flags\/.+\/environments\/.+/).reply(200, st(f, E_DEV, { value: '1' }))
    mount([f], E_DEV)
    await allChipsLoaded()
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
    expect(document.querySelectorAll('[role="switch"], input[type="checkbox"]')).toHaveLength(0)
  })

  it('AC2 + PROD risk: PRODUCTION focus env -> 0 toggles, a lock notice and a link to the guarded detail page', async () => {
    const f = flag(1)
    mock.onGet(/\/flags\/.+\/environments\/.+/).reply(200, st(f, E_PRD))
    mount([f], E_PRD)
    await allChipsLoaded()
    expect(document.querySelectorAll('[role="switch"], input[type="checkbox"]')).toHaveLength(0)
    expect(screen.getByText(/Production changes are made from the flag detail page/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Synthetic flag 1.*Prod/ })).toHaveAttribute('href', `/flags/${f.id}?env=${E_PRD}`)
  })

  it('no toggle for a cell with no state (cannot create state from the matrix)', async () => {
    const f = flag(1)
    mock.onGet(/\/flags\/.+\/environments\/.+/).reply(404)
    mount([f], E_DEV)
    await screen.findAllByText('Not configured')
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
  })

  it('AC3: toggle reloads state then PUTs the full state (enabled + value + rolloutPercent)', async () => {
    const f = flag(1)
    let getCount = 0
    mock.onGet(`/flags/${f.id}/environments/${E_DEV}`).reply(() => {
      getCount++
      return [200, st(f, E_DEV, { enabled: false, value: 'x', rolloutPercent: 40 })]
    })
    mock.onGet(/\/flags\/.+\/environments\/.+/).reply(404)
    mock.onPut(`/flags/${f.id}/environments/${E_DEV}`).reply(200, st(f, E_DEV))
    const { user } = mount([f], E_DEV)
    const sw = await screen.findByRole('switch')
    expect(sw).toHaveAttribute('aria-checked', 'false')
    const before = getCount
    await user.click(sw)
    await waitFor(() => expect(mock.history.put).toHaveLength(1))
    expect(JSON.parse(mock.history.put[0].data)).toEqual({ enabled: true, value: 'x', rolloutPercent: 40 })
    expect(getCount).toBeGreaterThan(before) // reload happened before the write
    const methods = mock.history.map((r) => r.method)
    expect(methods.lastIndexOf('get', methods.indexOf('put'))).toBeGreaterThan(-1)
  })

  it('AC3: a failed toggle reverts the switch and shows the error', async () => {
    const f = flag(1)
    mock.onGet(`/flags/${f.id}/environments/${E_DEV}`).reply(200, st(f, E_DEV, { enabled: false }))
    mock.onGet(/\/flags\/.+\/environments\/.+/).reply(404)
    mock.onPut(/.*/).reply(403, { title: 'Forbidden', detail: 'No permission' })
    const { user } = mount([f], E_DEV)
    const sw = await screen.findByRole('switch')
    await user.click(sw)
    await waitFor(() => expect(mock.history.put).toHaveLength(1))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Got it' }))
    await waitFor(() => expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false'))
    expect(screen.getByRole('switch')).toBeEnabled()
  })

  it('focus-mode grid has no axe violations', async () => {
    const f = flag(1)
    mock.onGet(/\/flags\/.+\/environments\/.+/).reply(200, st(f, E_DEV, { value: 'x' }))
    const { container } = mount([f], E_STG)
    await screen.findAllByText('On')
    expect(await axe(container)).toHaveNoViolations()
  })
})
