import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./axios', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

import api from './axios'
import { getFlagState, updateFlagState, type FlagState } from './flags'

const get = api.get as unknown as ReturnType<typeof vi.fn>
const put = api.put as unknown as ReturnType<typeof vi.fn>

beforeEach(() => {
  get.mockReset()
  put.mockReset()
})

describe('flags api: FlagState', () => {
  it('exposes rolloutPercent and lastEvaluatedAt returned by the backend', async () => {
    get.mockResolvedValue({
      data: {
        flagId: 'f1',
        environmentId: 'e1',
        enabled: true,
        value: 'x',
        rolloutPercent: 40,
        lastEvaluatedAt: '2026-01-01T00:00:00',
      },
    })

    const state: FlagState = await getFlagState('f1', 'e1')

    expect(get).toHaveBeenCalledWith('/flags/f1/environments/e1')
    expect(state.rolloutPercent).toBe(40)
    expect(state.lastEvaluatedAt).toBe('2026-01-01T00:00:00')
  })

  it('allows a never-evaluated state (lastEvaluatedAt null)', async () => {
    get.mockResolvedValue({
      data: { flagId: 'f1', environmentId: 'e1', enabled: false, rolloutPercent: 100, lastEvaluatedAt: null },
    })
    const state = await getFlagState('f1', 'e1')
    expect(state.lastEvaluatedAt).toBeNull()
  })

  it('sends rolloutPercent in the update body when provided', async () => {
    put.mockResolvedValue({
      data: { flagId: 'f1', environmentId: 'e1', enabled: true, value: 'x', rolloutPercent: 40 },
    })

    const state = await updateFlagState('f1', 'e1', { enabled: true, value: 'x', rolloutPercent: 40 })

    expect(put).toHaveBeenCalledWith('/flags/f1/environments/e1', {
      enabled: true,
      value: 'x',
      rolloutPercent: 40,
    })
    expect(state.rolloutPercent).toBe(40)
  })

  it('still accepts the existing {enabled} toggle body', async () => {
    put.mockResolvedValue({ data: { flagId: 'f1', environmentId: 'e1', enabled: true, rolloutPercent: 100 } })
    await updateFlagState('f1', 'e1', { enabled: true })
    expect(put).toHaveBeenCalledWith('/flags/f1/environments/e1', { enabled: true })
  })
})
