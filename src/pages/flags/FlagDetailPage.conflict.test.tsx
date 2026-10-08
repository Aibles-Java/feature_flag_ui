// S-2.16: the detail editor and the PROD guard send `version` and share ONE 409 flow
// (reload latest, keep the user's edits visible, StateConflictDialog). Synthetic data only.
import { screen, waitFor, within } from '@testing-library/react'
import MockAdapter from 'axios-mock-adapter'
import { Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { axe } from 'vitest-axe'
import api from '@/api/axios'
import FlagDetailPage from '@/pages/flags/FlagDetailPage'
import { renderWithProviders } from '@/test/renderWithProviders'
import { ENV_DEV, ENV_PROD, FLAG_ID, ORG, PROJ, flag, pageOf } from '@/test/fixtures'

const envDev = { id: ENV_DEV, name: 'Synthetic Dev', projectId: PROJ, type: 'DEVELOPMENT', changeWindowStartHour: null, changeWindowEndHour: null, changeWindowTimezone: null }
const envProd = {
  id: ENV_PROD, name: 'Synthetic Prod', projectId: PROJ, type: 'PRODUCTION',
  changeWindowStartHour: 9, changeWindowEndHour: 17, changeWindowTimezone: null,
  changeWindowZone: 'Asia/Ho_Chi_Minh', changeWindowOpenNow: true,
}
const st = (environmentId: string, over: Record<string, unknown> = {}) => ({
  flagId: FLAG_ID, environmentId, enabled: true, value: 'hello', rolloutPercent: 50, version: 5, lastEvaluatedAt: null, ...over,
})
const url = (env: string) => `/flags/${FLAG_ID}/environments/${env}`

let mock: MockAdapter
const puts = () => mock.history.put
const body = (i = -1) => JSON.parse(puts().at(i)!.data)

/** `getState` serves the sequence: first the state the editor opens with, then whatever it reloads. */
function serve(env: string, ...states: ReturnType<typeof st>[]) {
  let i = 0
  mock.onGet(url(env)).reply(() => [200, states[Math.min(i++, states.length - 1)]])
}

beforeEach(() => {
  mock = new MockAdapter(api)
  mock.onGet(`/flags/${FLAG_ID}`).reply(200, flag(1, { id: FLAG_ID, key: 'checkout-banner', valueType: 'STRING' }))
  mock.onGet('/environments').reply(200, pageOf([envProd, envDev]))
  mock.onGet(`/environments/${ENV_PROD}`).reply(200, envProd)
})
afterEach(() => mock.restore())

const mount = () =>
  renderWithProviders(
    <Routes><Route path="/orgs/:orgId/projects/:projectId/flags/:flagId" element={<FlagDetailPage />} /></Routes>,
    { route: `/orgs/${ORG}/projects/${PROJ}/flags/${FLAG_ID}` },
  )

async function openDev(open: ReturnType<typeof st>, ...reloads: ReturnType<typeof st>[]) {
  mock.onGet(`/flags/${FLAG_ID}/environments`).reply(200, [open])
  serve(ENV_DEV, open, ...reloads)
  const utils = mount()
  await utils.user.click(await screen.findByRole('button', { name: 'Edit Synthetic Dev' }))
  const editor = await screen.findByRole('dialog')
  const value = await within(editor).findByLabelText(/^Value/)
  return { ...utils, editor, value }
}

describe('S-2.16 detail editor (non-PROD)', () => {
  it('sends the version of the state it loaded', async () => {
    mock.onPut(url(ENV_DEV)).reply(200, st(ENV_DEV, { version: 6 }))
    const { user, editor, value } = await openDev(st(ENV_DEV, { version: 5 }))
    await user.clear(value)
    await user.type(value, 'mine')
    await user.click(within(editor).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(puts()).toHaveLength(1))
    expect(body()).toEqual({ enabled: true, value: 'mine', rolloutPercent: 50, version: 5 })
  })

  it('with a version the editor no longer claims a silent overwrite', async () => {
    const { editor } = await openDev(st(ENV_DEV, { version: 5 }))
    expect(within(editor).queryByText(/may overwrite concurrent changes/i)).not.toBeInTheDocument()
    expect(within(editor).getByText(/save is rejected/i)).toBeInTheDocument()
  })

  it('409: keeps the user\'s edits, shows latest vs mine, then re-saves against the NEW version', async () => {
    const theirs = st(ENV_DEV, { value: 'theirs', rolloutPercent: 80, version: 7 })
    mock.onPut(url(ENV_DEV)).replyOnce(409, { title: 'Conflict', detail: 'modified by someone else' })
    mock.onPut(url(ENV_DEV)).reply(200, st(ENV_DEV, { value: 'mine', version: 8 }))
    const { user, editor, value } = await openDev(st(ENV_DEV, { version: 5 }), theirs)
    await user.clear(value)
    await user.type(value, 'mine')
    await user.click(within(editor).getByRole('button', { name: 'Save' }))

    const dlg = await screen.findByRole('dialog', { name: /Someone else changed this/ })
    const table = within(dlg).getByRole('table', { name: 'Latest state on the server' })
    expect(within(table).getByText('theirs')).toBeInTheDocument() // latest on server
    expect(within(table).getByText('mine')).toBeInTheDocument() // the user's edit, side by side
    expect(within(table).getByText('80%')).toBeInTheDocument()
    expect(screen.queryByText('modified by someone else')).not.toBeInTheDocument() // not the raw error banner
    expect(screen.queryByText('Someone else changed this state')).not.toBeInTheDocument() // nor the inline ApiError
    expect(puts()).toHaveLength(1)

    await user.click(within(dlg).getByRole('button', { name: 'Review my edits' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Someone else changed this/ })).not.toBeInTheDocument())
    // the form was NOT reset: the typed value is still there
    expect(screen.getByLabelText(/^Value/)).toHaveValue('mine')

    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(puts()).toHaveLength(2))
    expect(body(1)).toMatchObject({ value: 'mine', version: 7 })
  })

  it('409: when the other writer cleared nothing, re-save still sends the edits, not the server values', async () => {
    mock.onPut(url(ENV_DEV)).replyOnce(409)
    mock.onPut(url(ENV_DEV)).reply(200, st(ENV_DEV))
    const { user, editor, value } = await openDev(st(ENV_DEV), st(ENV_DEV, { value: 'theirs', version: 6 }))
    await user.clear(value)
    await user.type(value, 'mine')
    await user.click(within(editor).getByRole('button', { name: 'Save' }))
    await user.click(await screen.findByRole('button', { name: 'Review my edits' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(puts()).toHaveLength(2))
    expect(body(1).value).toBe('mine')
  })

  it('409 where the latest state could not be reloaded says so instead of showing stale values', async () => {
    mock.onPut(url(ENV_DEV)).reply(409)
    const open = st(ENV_DEV)
    mock.onGet(`/flags/${FLAG_ID}/environments`).reply(200, [open])
    let reads = 0
    mock.onGet(url(ENV_DEV)).reply(() => (reads++ === 0 ? [200, open] : [500]))
    const utils = mount()
    await utils.user.click(await screen.findByRole('button', { name: 'Edit Synthetic Dev' }))
    const editor = await screen.findByRole('dialog')
    await within(editor).findByLabelText(/^Value/)
    await utils.user.click(within(editor).getByRole('button', { name: 'Save' }))
    const dlg = await screen.findByRole('dialog', { name: /Someone else changed this/ })
    expect(within(dlg).getByText(/latest state could not be loaded/i)).toBeInTheDocument()
    expect(within(dlg).queryByRole('table')).not.toBeInTheDocument()
  })

  it('a 400 is still shown as a plain error, not as a conflict', async () => {
    mock.onPut(url(ENV_DEV)).reply(400, { title: 'Bad Request', detail: 'value invalid' })
    const { user, editor } = await openDev(st(ENV_DEV))
    await user.click(within(editor).getByRole('button', { name: 'Save' }))
    expect(await within(editor).findByText('value invalid')).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: /Someone else changed this/ })).not.toBeInTheDocument()
  })

  it('conflict dialog in the editor has no axe violations', async () => {
    mock.onPut(url(ENV_DEV)).reply(409)
    const { user, editor } = await openDev(st(ENV_DEV), st(ENV_DEV, { value: 'theirs', version: 6 }))
    await user.click(within(editor).getByRole('button', { name: 'Save' }))
    const dlg = await screen.findByRole('dialog', { name: /Someone else changed this/ })
    expect(await axe(dlg)).toHaveNoViolations()
  })
})

describe('S-2.16 PROD guard', () => {
  async function openGuard(open: ReturnType<typeof st>, ...reloads: ReturnType<typeof st>[]) {
    mock.onGet(`/flags/${FLAG_ID}/environments`).reply(200, [open])
    serve(ENV_PROD, open, ...reloads)
    const utils = mount()
    await utils.user.click(await screen.findByRole('button', { name: 'Edit Synthetic Prod' }))
    const editor = await screen.findByRole('dialog')
    const value = await within(editor).findByLabelText(/^Value/)
    await utils.user.clear(value)
    await utils.user.type(value, 'new-prod')
    await utils.user.click(within(editor).getByRole('button', { name: /review and save/i }))
    const guard = await screen.findByRole('dialog', { name: /confirm change to synthetic prod/i })
    await waitFor(() => expect(within(guard).getByText(/change window is open/i)).toBeInTheDocument())
    await utils.user.type(within(guard).getByLabelText(/Type the flag key/), 'checkout-banner')
    return { ...utils, guard }
  }

  it('sends version + prodAcknowledged', async () => {
    mock.onPut(url(ENV_PROD)).reply(200, st(ENV_PROD, { version: 4 }))
    const { user, guard } = await openGuard(st(ENV_PROD, { value: 'prod-val', version: 3 }))
    await user.click(within(guard).getByRole('button', { name: /save to production/i }))
    await waitFor(() => expect(puts()).toHaveLength(1))
    expect(body()).toEqual({ enabled: true, value: 'new-prod', rolloutPercent: 50, prodAcknowledged: true, version: 3 })
  })

  it('409: the guard closes, the conflict dialog shows the latest, and re-confirming sends the new version', async () => {
    mock.onPut(url(ENV_PROD)).replyOnce(409)
    mock.onPut(url(ENV_PROD)).reply(200, st(ENV_PROD, { version: 10 }))
    const theirs = st(ENV_PROD, { value: 'their-prod', version: 9 })
    const { user, guard } = await openGuard(st(ENV_PROD, { value: 'prod-val', version: 3 }), theirs)
    await user.click(within(guard).getByRole('button', { name: /save to production/i }))

    const dlg = await screen.findByRole('dialog', { name: /Someone else changed this/ })
    expect(within(dlg).getByText('their-prod')).toBeInTheDocument()
    expect(within(dlg).getByText('new-prod')).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: /confirm change to synthetic prod/i })).not.toBeInTheDocument()
    expect(puts()).toHaveLength(1)

    await user.click(within(dlg).getByRole('button', { name: 'Review my edits' }))
    const editor = await screen.findByRole('dialog')
    expect(within(editor).getByLabelText(/^Value/)).toHaveValue('new-prod')
    await user.click(within(editor).getByRole('button', { name: /review and save/i }))
    const guard2 = await screen.findByRole('dialog', { name: /confirm change to synthetic prod/i })
    // the diff's "before" is now what the other person saved
    expect(within(within(guard2).getByRole('table', { name: 'Changes to apply' })).getByText('their-prod')).toBeInTheDocument()
    await waitFor(() => expect(within(guard2).getByText(/change window is open/i)).toBeInTheDocument())
    await user.type(within(guard2).getByLabelText(/Type the flag key/), 'checkout-banner')
    await user.click(within(guard2).getByRole('button', { name: /save to production/i }))
    await waitFor(() => expect(puts()).toHaveLength(2))
    expect(body(1)).toMatchObject({ value: 'new-prod', version: 9, prodAcknowledged: true })
  })
})
