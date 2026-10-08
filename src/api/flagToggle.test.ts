import MockAdapter from 'axios-mock-adapter'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import api from './axios'
import { toggleFlagEnabled } from './flagToggle'
import { ENV_DEV, FLAG_ID } from '@/test/fixtures'

let mock: MockAdapter
beforeEach(() => {
  mock = new MockAdapter(api)
})
afterEach(() => mock.restore())

const URL = `/flags/${FLAG_ID}/environments/${ENV_DEV}`
const state = (over = {}) => ({
  flagId: FLAG_ID,
  environmentId: ENV_DEV,
  enabled: false,
  value: 'x',
  rolloutPercent: 40,
  lastEvaluatedAt: null,
  ...over,
})

describe('toggleFlagEnabled (S-0.1, F7)', () => {
  it('AC1: PUT carries the new enabled AND the current value + rolloutPercent', async () => {
    mock.onGet(URL).reply(200, state())
    mock.onPut(URL).reply(200, state({ enabled: true }))
    await toggleFlagEnabled(FLAG_ID, ENV_DEV, true)
    expect(JSON.parse(mock.history.put[0].data)).toEqual({ enabled: true, value: 'x', rolloutPercent: 40 })
  })

  it('AC2: reloads state immediately before sending and uses the freshly loaded values (GET before PUT)', async () => {
    let call = 0
    mock.onGet(URL).reply(() => {
      call++
      return [200, state({ value: 'changed-by-someone-else', rolloutPercent: 75 })]
    })
    mock.onPut(URL).reply(200, state())
    await toggleFlagEnabled(FLAG_ID, ENV_DEV, true)
    const order = mock.history.map((r) => r.method)
    expect(order).toEqual(['get', 'put'])
    expect(call).toBe(1)
    expect(JSON.parse(mock.history.put[0].data)).toEqual({
      enabled: true,
      value: 'changed-by-someone-else',
      rolloutPercent: 75,
    })
  })

  it('omits value when the state has none (null/undefined) rather than sending the string "null"', async () => {
    mock.onGet(URL).reply(200, state({ value: null }))
    mock.onPut(URL).reply(200, state())
    await toggleFlagEnabled(FLAG_ID, ENV_DEV, false)
    expect(JSON.parse(mock.history.put[0].data)).toEqual({ enabled: false, rolloutPercent: 40 })
  })

  it.each([400, 403, 404, 500])('AC3: a %i on PUT rejects so the caller can revert and show the error', async (status) => {
    mock.onGet(URL).reply(200, state())
    mock.onPut(URL).reply(status)
    await expect(toggleFlagEnabled(FLAG_ID, ENV_DEV, true)).rejects.toBeTruthy()
  })

  it('does not PUT when the reload itself fails', async () => {
    mock.onGet(URL).reply(404)
    await expect(toggleFlagEnabled(FLAG_ID, ENV_DEV, true)).rejects.toBeTruthy()
    expect(mock.history.put).toHaveLength(0)
  })
})
