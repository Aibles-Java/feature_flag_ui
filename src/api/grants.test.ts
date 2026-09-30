import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./axios', () => ({
  default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}))

import api from './axios'
import { getGrants, upsertGrant, revokeGrant } from './grants'

const get = api.get as unknown as ReturnType<typeof vi.fn>
const post = api.post as unknown as ReturnType<typeof vi.fn>
const del = api.delete as unknown as ReturnType<typeof vi.fn>

beforeEach(() => {
  get.mockReset()
  post.mockReset()
  del.mockReset()
})

describe('grants api', () => {
  it('lists grants under the project and unwraps the page envelope', async () => {
    get.mockResolvedValue({
      data: { content: [{ userId: 'u1' }], page: 0, size: 20, totalElements: 1, totalPages: 1 },
    })
    const res = await getGrants('p1')
    expect(get).toHaveBeenCalledWith('/projects/p1/members')
    expect(res).toEqual([{ userId: 'u1' }])
  })

  it('tolerates a bare array so an unpaginated response does not crash the page', async () => {
    get.mockResolvedValue({ data: [{ userId: 'u1' }] })
    await expect(getGrants('p1')).resolves.toEqual([{ userId: 'u1' }])
  })

  it('upserts a built-in role grant', async () => {
    post.mockResolvedValue({ data: { userId: 'u1', role: 'ADMIN' } })
    const res = await upsertGrant('p1', { userId: 'u1', role: 'ADMIN' })
    expect(post).toHaveBeenCalledWith('/projects/p1/members', { userId: 'u1', role: 'ADMIN' })
    expect(res.role).toBe('ADMIN')
  })

  it('upserts a custom role grant without a built-in role', async () => {
    post.mockResolvedValue({ data: { userId: 'u1', customRoleId: 'r1' } })
    await upsertGrant('p1', { userId: 'u1', customRoleId: 'r1' })
    expect(post).toHaveBeenCalledWith('/projects/p1/members', { userId: 'u1', customRoleId: 'r1' })
  })

  it('revokes by user id', async () => {
    del.mockResolvedValue({ data: undefined })
    await revokeGrant('p1', 'u1')
    expect(del).toHaveBeenCalledWith('/projects/p1/members/u1')
  })
})
