import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./axios', () => ({ default: { get: vi.fn() } }))

import api from './axios'
import { getAuditLog } from './audit'

const get = api.get as unknown as ReturnType<typeof vi.fn>

beforeEach(() => get.mockReset())

describe('audit api', () => {
  it('keeps the page envelope so the screen can render paging controls', async () => {
    const page = { content: [{ id: 'a1' }], page: 0, size: 20, totalElements: 1, totalPages: 1 }
    get.mockResolvedValue({ data: page })
    const res = await getAuditLog('o1')
    expect(get).toHaveBeenCalledWith('/organisations/o1/audit-log', { params: {} })
    expect(res).toEqual(page)
  })

  it('passes paging params through', async () => {
    get.mockResolvedValue({ data: { content: [], page: 2, size: 50, totalElements: 0, totalPages: 0 } })
    await getAuditLog('o1', { page: 2, size: 50 })
    expect(get).toHaveBeenCalledWith('/organisations/o1/audit-log', {
      params: { page: 2, size: 50 },
    })
  })
})
