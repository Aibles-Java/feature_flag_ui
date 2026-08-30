import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import MockAdapter from 'axios-mock-adapter'
import axios from 'axios'
import api from '@/api/axios'
import { useAuthStore } from '@/stores/authStore'

let apiMock: MockAdapter
let axiosMock: MockAdapter

beforeEach(() => {
  apiMock = new MockAdapter(api)
  axiosMock = new MockAdapter(axios)
  localStorage.clear()
  useAuthStore.setState({ token: null, refreshToken: null, userId: null, email: null })
})

afterEach(() => {
  apiMock.restore()
  axiosMock.restore()
  vi.unstubAllGlobals()
})

describe('axios interceptors', () => {
  it('attaches the bearer token from the store', async () => {
    useAuthStore.setState({ token: 'tok', refreshToken: 'r', userId: 'u', email: 'e' })
    let auth: unknown
    apiMock.onGet('/thing').reply((config) => {
      auth = config.headers?.Authorization
      return [200, {}]
    })
    await api.get('/thing')
    expect(auth).toBe('Bearer tok')
  })

  it('passes through non-401 errors untouched', async () => {
    apiMock.onGet('/boom').reply(500)
    await expect(api.get('/boom')).rejects.toBeTruthy()
  })

  it('logs out on 401 when there is no refresh token', async () => {
    vi.stubGlobal('location', { pathname: '/', href: '' })
    useAuthStore.setState({ token: 'old', refreshToken: null, userId: 'u', email: 'e' })
    apiMock.onGet('/data').reply(401)
    await expect(api.get('/data')).rejects.toBeTruthy()
    expect(useAuthStore.getState().token).toBeNull()
    expect((globalThis.location as unknown as { href: string }).href).toBe('/login')
  })

  it('refreshes the token and retries the original request on 401', async () => {
    useAuthStore.setState({ token: 'old', refreshToken: 'r1', userId: 'u', email: 'e' })
    apiMock.onGet('/data').replyOnce(401)
    apiMock.onGet('/data').reply(200, { ok: true })
    axiosMock.onPost(/\/auth\/refresh$/).reply(200, { accessToken: 'new', refreshToken: 'r2' })
    const res = await api.get('/data')
    expect(res.data).toEqual({ ok: true })
    expect(useAuthStore.getState().token).toBe('new')
    expect(useAuthStore.getState().refreshToken).toBe('r2')
  })

  it('logs out when the refresh call itself fails', async () => {
    vi.stubGlobal('location', { pathname: '/', href: '' })
    useAuthStore.setState({ token: 'old', refreshToken: 'r1', userId: 'u', email: 'e' })
    apiMock.onGet('/data').reply(401)
    axiosMock.onPost(/\/auth\/refresh$/).reply(401)
    await expect(api.get('/data')).rejects.toBeTruthy()
    expect(useAuthStore.getState().token).toBeNull()
  })
})
