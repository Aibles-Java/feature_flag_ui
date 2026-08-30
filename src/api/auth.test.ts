import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./axios', () => ({
  default: { post: vi.fn() },
}))

import api from './axios'
import { login, register, refresh, logout } from './auth'

const post = api.post as unknown as ReturnType<typeof vi.fn>

beforeEach(() => {
  post.mockReset()
})

describe('auth api', () => {
  it('login posts credentials and returns the body', async () => {
    post.mockResolvedValue({
      data: { accessToken: 'a', refreshToken: 'r', userId: 'u', email: 'e' },
    })
    const res = await login('user@example.com', 'pw')
    expect(post).toHaveBeenCalledWith('/auth/login', {
      email: 'user@example.com',
      password: 'pw',
    })
    expect(res.accessToken).toBe('a')
  })

  it('register posts the payload and resolves void', async () => {
    post.mockResolvedValue({ data: undefined })
    await expect(
      register({ email: 'user@example.com', password: 'pw' })
    ).resolves.toBeUndefined()
    expect(post).toHaveBeenCalledWith('/auth/register', {
      email: 'user@example.com',
      password: 'pw',
    })
  })

  it('refresh posts the refresh token and returns the rotated pair', async () => {
    post.mockResolvedValue({ data: { accessToken: 'a2', refreshToken: 'r2' } })
    const res = await refresh('r1')
    expect(post).toHaveBeenCalledWith('/auth/refresh', { refreshToken: 'r1' })
    expect(res.refreshToken).toBe('r2')
  })

  it('logout posts the refresh token', async () => {
    post.mockResolvedValue({ data: undefined })
    await logout('r1')
    expect(post).toHaveBeenCalledWith('/auth/logout', { refreshToken: 'r1' })
  })
})
