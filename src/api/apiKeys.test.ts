import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./axios', () => ({
  default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}))

import api from './axios'
import { getApiKeys, createApiKey, revokeApiKey, rotateApiKey } from './apiKeys'

const get = api.get as unknown as ReturnType<typeof vi.fn>
const post = api.post as unknown as ReturnType<typeof vi.fn>
const del = api.delete as unknown as ReturnType<typeof vi.fn>

beforeEach(() => {
  get.mockReset()
  post.mockReset()
  del.mockReset()
})

describe('api keys', () => {
  it('lists keys for an environment and unwraps the page envelope', async () => {
    get.mockResolvedValue({
      data: {
        content: [{ id: 'k1', name: 'default', active: true }],
        page: 0,
        size: 20,
        totalElements: 1,
        totalPages: 1,
      },
    })
    const res = await getApiKeys('e1')
    expect(get).toHaveBeenCalledWith('/environments/e1/api-keys')
    expect(res).toHaveLength(1)
  })

  it('creates a key and returns the one-time plaintext alongside its metadata', async () => {
    post.mockResolvedValue({ data: { key: { id: 'k1', name: 'CI' }, apiKey: 'plaintext' } })
    const res = await createApiKey('e1', { name: 'CI' })
    expect(post).toHaveBeenCalledWith('/environments/e1/api-keys', { name: 'CI' })
    expect(res.apiKey).toBe('plaintext')
  })

  it('passes an expiry through when one is set', async () => {
    post.mockResolvedValue({ data: { key: {}, apiKey: 'x' } })
    await createApiKey('e1', { name: 'CI', expiresAt: '2027-01-01T00:00:00' })
    expect(post).toHaveBeenCalledWith('/environments/e1/api-keys', {
      name: 'CI',
      expiresAt: '2027-01-01T00:00:00',
    })
  })

  it('revokes by key id', async () => {
    del.mockResolvedValue({ data: undefined })
    await revokeApiKey('e1', 'k1')
    expect(del).toHaveBeenCalledWith('/environments/e1/api-keys/k1')
  })

  it('rotates with a hard cutover by default', async () => {
    // 0 reproduces the old single-key behaviour: every SDK holding the old key fails at once.
    // Defaulting to anything else would silently leave a second working credential behind.
    post.mockResolvedValue({ data: { key: {}, apiKey: 'fresh' } })
    await rotateApiKey('e1', 'k1')
    expect(post).toHaveBeenCalledWith('/environments/e1/api-keys/k1/rotate', { graceHours: 0 })
  })

  it('rotates with a grace period when asked', async () => {
    post.mockResolvedValue({ data: { key: {}, apiKey: 'fresh' } })
    const res = await rotateApiKey('e1', 'k1', 24)
    expect(post).toHaveBeenCalledWith('/environments/e1/api-keys/k1/rotate', { graceHours: 24 })
    expect(res.apiKey).toBe('fresh')
  })
})
