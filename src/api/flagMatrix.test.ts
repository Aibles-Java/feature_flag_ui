import MockAdapter from 'axios-mock-adapter'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import api from './axios'
import { QueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import {
  createLimiter, fetchCellState, getFlagMatrix, indexMatrix, invalidateStateQueries, isMatrixFallbackError,
  isRateLimited, retryAfterSeconds, sortEnvironments,
} from './flagMatrix'
import { MAX_CONCURRENT_STATE_REQUESTS } from '@/config/matrixConfig'
import { ENV_DEV, FLAG_ID, PROJ, flag, pageOf } from '@/test/fixtures'

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

  it('handoff race: a caller arriving between release and the waiter waking cannot exceed max', async () => {
    const run = createLimiter(1)
    let active = 0
    let peak = 0
    const track = async () => {
      active++
      peak = Math.max(peak, active)
      await new Promise((r) => setTimeout(r, 1))
      active--
    }
    let finishA!: () => void
    const a = run(() => new Promise<void>((r) => (finishA = r)))
    const b = run(track) // queued
    finishA()
    queueMicrotask(() => void run(track).catch(() => {})) // lands right after A's release
    await Promise.all([a, b])
    await new Promise((r) => setTimeout(r, 10))
    expect(peak).toBe(1)
  })

  it('an aborted queued task never runs and rejects; the slot order is preserved', async () => {
    const run = createLimiter(1)
    let finishA!: () => void
    const a = run(() => new Promise<void>((r) => (finishA = r)))
    const ran: string[] = []
    const ac = new AbortController()
    const dropped = run(async () => void ran.push('dropped'), ac.signal)
    const kept = run(async () => void ran.push('kept'))
    ac.abort()
    await expect(dropped).rejects.toMatchObject({ name: 'AbortError' })
    finishA()
    await Promise.all([a, kept])
    expect(ran).toEqual(['kept'])
  })

  it('an already-aborted signal rejects without running', async () => {
    const run = createLimiter(2)
    const ac = new AbortController()
    ac.abort()
    let ran = false
    await expect(run(async () => void (ran = true), ac.signal)).rejects.toMatchObject({ name: 'AbortError' })
    expect(ran).toBe(false)
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

const failure = async (status: number, headers: Record<string, string> = {}) => {
  mock.onGet('/boom').reply(status, {}, headers)
  return api.get('/boom').catch((e: unknown) => e)
}

describe('getFlagMatrix (S-2.15, BE PR 150)', () => {
  it('requests ONE page for the project with page + size', async () => {
    mock.onGet('/flags/environment-states').reply(200, pageOf([]))
    await getFlagMatrix(PROJ, 2, 100)
    expect(mock.history.get).toHaveLength(1)
    expect(mock.history.get[0].params).toEqual({ projectId: PROJ, page: 2, size: 100 })
  })
  it('never asks for more than 100 rows (server maximum, ADR-02)', async () => {
    mock.onGet('/flags/environment-states').reply(200, pageOf([]))
    await getFlagMatrix(PROJ, 0, 5000)
    expect(mock.history.get[0].params.size).toBe(100)
  })
  it('returns the PageResponse of { flag, states }', async () => {
    const row = { flag: flag(1), states: [{ flagId: flag(1).id, environmentId: ENV_DEV, enabled: true, rolloutPercent: 100, version: 3 }] }
    mock.onGet('/flags/environment-states').reply(200, pageOf([row], { totalElements: 1 }))
    const page = await getFlagMatrix(PROJ)
    expect(page.content[0].states[0].version).toBe(3)
    expect(page.totalElements).toBe(1)
  })
})

describe('indexMatrix', () => {
  it('maps flagId -> envId -> state; a flag with no states is present but empty', () => {
    const f1 = flag(1)
    const f2 = flag(2)
    const st = { flagId: f1.id, environmentId: ENV_DEV, enabled: true, rolloutPercent: 10, version: 1 }
    const idx = indexMatrix([{ flag: f1, states: [st] } as never, { flag: f2, states: [] } as never])
    expect(idx.get(f1.id)?.get(ENV_DEV)).toBe(st)
    expect(idx.get(f2.id)?.size).toBe(0)
    expect(idx.has('nope')).toBe(false)
  })
})

describe('matrix failure classification (S-2.15 fallback + D-12)', () => {
  it.each([404, 500, 502, 503])('%i -> fall back to the per-cell path', async (status) => {
    expect(isMatrixFallbackError(await failure(status))).toBe(true)
  })
  it.each([400, 401, 403, 429])('%i -> NOT a fallback case (per-cell calls would fail or storm)', async (status) => {
    expect(isMatrixFallbackError(await failure(status))).toBe(false)
  })
  it('a network error (no response) falls back', async () => {
    mock.onGet('/boom').networkError()
    const e = await api.get('/boom').catch((x: unknown) => x)
    expect(isAxiosError(e) && e.response === undefined).toBe(true)
    expect(isMatrixFallbackError(e)).toBe(true)
  })
  it('a non-axios error is not a fallback case', () => {
    expect(isMatrixFallbackError(new Error('x'))).toBe(false)
  })
  it('isRateLimited is true only for 429', async () => {
    expect(isRateLimited(await failure(429))).toBe(true)
    expect(isRateLimited(await failure(503))).toBe(false)
  })
})

describe('retryAfterSeconds (BE AbstractRateLimitFilter sends whole seconds, min 1)', () => {
  it('honours the header', async () => {
    expect(retryAfterSeconds(await failure(429, { 'retry-after': '7' }))).toBe(7)
  })
  it('defaults to 60 when the header is missing or not a number', async () => {
    expect(retryAfterSeconds(await failure(429))).toBe(60)
    expect(retryAfterSeconds(await failure(429, { 'retry-after': 'soon' }))).toBe(60)
  })
  it('never returns less than 1 second (no tight retry loop)', async () => {
    expect(retryAfterSeconds(await failure(429, { 'retry-after': '0' }))).toBe(1)
    expect(retryAfterSeconds(await failure(429, { 'retry-after': '-5' }))).toBe(1)
  })
  it('caps a huge value at 120 seconds', async () => {
    expect(retryAfterSeconds(await failure(429, { 'retry-after': '86400' }))).toBe(120)
  })
})

describe('invalidateStateQueries (S-2.15 AC: after PUT invalidate flag-matrix, flag-states, flag-history)', () => {
  it('invalidates exactly those key families for the flag', async () => {
    const qc = new QueryClient()
    const spy = vi.spyOn(qc, 'invalidateQueries')
    await invalidateStateQueries(qc, { id: FLAG_ID, projectId: PROJ }, ENV_DEV)
    const keys = spy.mock.calls.map((c) => c[0]?.queryKey)
    expect(keys).toContainEqual(['flag-matrix', PROJ])
    expect(keys).toContainEqual(['flag-states', FLAG_ID])
    expect(keys).toContainEqual(['flag-history', FLAG_ID])
  })
})
