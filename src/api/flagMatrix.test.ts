import MockAdapter from 'axios-mock-adapter'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import api from './axios'
import { createLimiter, fetchCellState, sortEnvironments } from './flagMatrix'
import { MAX_CONCURRENT_STATE_REQUESTS } from '@/config/matrixConfig'
import { ENV_DEV, FLAG_ID } from '@/test/fixtures'

let mock: MockAdapter
beforeEach(() => {
  mock = new MockAdapter(api)
})
afterEach(() => mock.restore())

describe('createLimiter', () => {
  it('never runs more than max tasks at once and runs all of them', async () => {
    const run = createLimiter(3)
    let active = 0
    let peak = 0
    const task = async () => {
      active++
      peak = Math.max(peak, active)
      await new Promise((r) => setTimeout(r, 2))
      active--
    }
    await Promise.all(Array.from({ length: 20 }, () => run(task)))
    expect(peak).toBe(3)
    expect(active).toBe(0)
  })

  it('releases the slot when a task throws', async () => {
    const run = createLimiter(1)
    await expect(run(() => Promise.reject(new Error('boom')))).rejects.toThrow('boom')
    await expect(run(async () => 'ok')).resolves.toBe('ok')
  })

  it('rejects a non-positive limit', () => {
    expect(() => createLimiter(0)).toThrow()
  })
})

describe('config', () => {
  it('D-20: the concurrency limit is a named constant equal to 6', () => {
    expect(MAX_CONCURRENT_STATE_REQUESTS).toBe(6)
  })
})

describe('fetchCellState', () => {
  const URL = `/flags/${FLAG_ID}/environments/${ENV_DEV}`
  it('returns the state on 200', async () => {
    mock.onGet(URL).reply(200, { flagId: FLAG_ID, environmentId: ENV_DEV, enabled: true, rolloutPercent: 100 })
    await expect(fetchCellState(FLAG_ID, ENV_DEV)).resolves.toMatchObject({ enabled: true })
  })
  it('F11: maps 404 to null ("not configured"), not an error', async () => {
    mock.onGet(URL).reply(404)
    await expect(fetchCellState(FLAG_ID, ENV_DEV)).resolves.toBeNull()
  })
  it('propagates other errors', async () => {
    mock.onGet(URL).reply(500)
    await expect(fetchCellState(FLAG_ID, ENV_DEV)).rejects.toBeTruthy()
  })
})

describe('sortEnvironments', () => {
  it('orders DEVELOPMENT -> STAGING -> PRODUCTION, stable by name within a type', () => {
    const e = (name: string, type: 'DEVELOPMENT' | 'STAGING' | 'PRODUCTION') => ({ name, type }) as never
    const out = sortEnvironments([e('p', 'PRODUCTION'), e('s', 'STAGING'), e('d2', 'DEVELOPMENT'), e('d1', 'DEVELOPMENT')])
    expect(out.map((x: { name: string }) => x.name)).toEqual(['d1', 'd2', 's', 'p'])
  })
})
