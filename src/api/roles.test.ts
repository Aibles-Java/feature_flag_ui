import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./axios', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

import api from './axios'
import { getCustomRoles, createCustomRole, updateCustomRole, deleteCustomRole } from './roles'

const get = api.get as unknown as ReturnType<typeof vi.fn>
const post = api.post as unknown as ReturnType<typeof vi.fn>
const put = api.put as unknown as ReturnType<typeof vi.fn>
const del = api.delete as unknown as ReturnType<typeof vi.fn>

beforeEach(() => {
  get.mockReset()
  post.mockReset()
  put.mockReset()
  del.mockReset()
})

describe('custom roles api', () => {
  it('lists roles under the organisation and unwraps the page envelope', async () => {
    get.mockResolvedValue({
      data: { content: [{ id: 'r1' }], page: 0, size: 20, totalElements: 1, totalPages: 1 },
    })
    const res = await getCustomRoles('o1')
    expect(get).toHaveBeenCalledWith('/organisations/o1/roles')
    expect(res).toEqual([{ id: 'r1' }])
  })

  it('creates a role with its action set', async () => {
    post.mockResolvedValue({ data: { id: 'r1', actions: ['FLAG_READ'] } })
    await createCustomRole('o1', { name: 'Reader', actions: ['FLAG_READ'] })
    expect(post).toHaveBeenCalledWith('/organisations/o1/roles', {
      name: 'Reader',
      actions: ['FLAG_READ'],
    })
  })

  it('updates a role under its organisation', async () => {
    put.mockResolvedValue({ data: { id: 'r1' } })
    await updateCustomRole('o1', 'r1', { name: 'Reader', actions: [] })
    expect(put).toHaveBeenCalledWith('/organisations/o1/roles/r1', { name: 'Reader', actions: [] })
  })

  it('deletes a role', async () => {
    del.mockResolvedValue({ data: undefined })
    await deleteCustomRole('o1', 'r1')
    expect(del).toHaveBeenCalledWith('/organisations/o1/roles/r1')
  })
})
