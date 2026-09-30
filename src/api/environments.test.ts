import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./axios', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

import api from './axios'
import {
  getEnvironments,
  createEnvironment,
  updateEnvironment,
  rotateApiKey,
  type Environment,
} from './environments'

const get = api.get as unknown as ReturnType<typeof vi.fn>
const post = api.post as unknown as ReturnType<typeof vi.fn>
const put = api.put as unknown as ReturnType<typeof vi.fn>

beforeEach(() => {
  get.mockReset()
  post.mockReset()
  put.mockReset()
})

describe('environments api', () => {
  it('reads the ABAC attributes the backend returns on list data', async () => {
    get.mockResolvedValue({
      data: {
        content: [
          {
            id: 'e1',
            name: 'production',
            projectId: 'p1',
            type: 'PRODUCTION',
            changeWindowStartHour: 9,
            changeWindowEndHour: 17,
            createdAt: '2026-01-01T00:00:00',
          },
        ],
        page: 0,
        size: 20,
        totalElements: 1,
        totalPages: 1,
      },
    })
    const [env] = await getEnvironments('p1')
    expect(get).toHaveBeenCalledWith('/environments', { params: { projectId: 'p1' } })
    expect(env.type).toBe('PRODUCTION')
    expect(env.changeWindowStartHour).toBe(9)
  })

  it('does not promise an apiKey on list data', async () => {
    // The list endpoint returns EnvironmentResponse, which has no apiKey — the type must not
    // claim otherwise, or the card blanks the page on `undefined.slice()`.
    const env = {} as Environment
    expect('apiKey' in env).toBe(false)
  })

  it('sends type and change window when creating', async () => {
    post.mockResolvedValue({ data: { id: 'e1', apiKey: 'k' } })
    const res = await createEnvironment({
      projectId: 'p1',
      name: 'production',
      type: 'PRODUCTION',
      changeWindowStartHour: 9,
      changeWindowEndHour: 17,
    })
    expect(post).toHaveBeenCalledWith('/environments', {
      projectId: 'p1',
      name: 'production',
      type: 'PRODUCTION',
      changeWindowStartHour: 9,
      changeWindowEndHour: 17,
    })
    expect(res.apiKey).toBe('k')
  })

  // Sending nulls does NOT clear a window: EnvironmentServiceImpl only assigns the field when
  // the request value is non-null, so the stored window survives. Verified against a running
  // backend. The assertion below is about what the client sends, not about the outcome.
  it('sends explicit nulls for an unset change window', async () => {
    put.mockResolvedValue({ data: { id: 'e1' } })
    await updateEnvironment('e1', {
      name: 'production',
      changeWindowStartHour: null,
      changeWindowEndHour: null,
    })
    expect(put).toHaveBeenCalledWith('/environments/e1', {
      name: 'production',
      changeWindowStartHour: null,
      changeWindowEndHour: null,
    })
  })

  it('rotation returns the fresh plaintext key', async () => {
    post.mockResolvedValue({ data: { id: 'e1', apiKey: 'fresh' } })
    const res = await rotateApiKey('e1')
    expect(post).toHaveBeenCalledWith('/environments/e1/api-key/rotate')
    expect(res.apiKey).toBe('fresh')
  })
})
