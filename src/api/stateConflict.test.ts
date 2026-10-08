import MockAdapter from 'axios-mock-adapter'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import api from './axios'
import { StateConflictError, isVersionConflict, withConflictReload } from './stateConflict'
import { ENV_DEV, FLAG_ID } from '@/test/fixtures'

let mock: MockAdapter
beforeEach(() => {
  mock = new MockAdapter(api)
})
afterEach(() => mock.restore())

const URL = `/flags/${FLAG_ID}/environments/${ENV_DEV}`
const latest = { flagId: FLAG_ID, environmentId: ENV_DEV, enabled: true, value: 'theirs', rolloutPercent: 20, version: 8 }

describe('withConflictReload (the ONE 409 handler, ADR-07)', () => {
  it('passes a successful write through and does not reload', async () => {
    const out = await withConflictReload(FLAG_ID, ENV_DEV, async () => 'ok')
    expect(out).toBe('ok')
    expect(mock.history.get).toHaveLength(0)
  })

  it('on 409 reloads the latest state once and throws StateConflictError carrying it', async () => {
    mock.onPut(URL).reply(409, { detail: 'The resource was modified by someone else. Reload and try again.' })
    mock.onGet(URL).reply(200, latest)
    const err = await withConflictReload(FLAG_ID, ENV_DEV, () => api.put(URL, {})).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(StateConflictError)
    expect((err as StateConflictError).latest).toMatchObject({ version: 8, value: 'theirs' })
    expect(mock.history.get).toHaveLength(1)
  })

  it('still reports the conflict (latest = null) when the reload itself fails', async () => {
    mock.onPut(URL).reply(409)
    mock.onGet(URL).reply(500)
    const err = await withConflictReload(FLAG_ID, ENV_DEV, () => api.put(URL, {})).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(StateConflictError)
    expect((err as StateConflictError).latest).toBeNull()
  })

  it.each([400, 403, 404, 500])('%i is NOT a conflict: rethrown untouched, no reload', async (status) => {
    mock.onPut(URL).reply(status)
    const err = await withConflictReload(FLAG_ID, ENV_DEV, () => api.put(URL, {})).catch((e: unknown) => e)
    expect(err).not.toBeInstanceOf(StateConflictError)
    expect(isVersionConflict(err)).toBe(false)
    expect(mock.history.get).toHaveLength(0)
  })
})
