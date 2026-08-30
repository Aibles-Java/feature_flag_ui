import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthStore } from '@/stores/authStore'

beforeEach(() => {
  localStorage.clear()
  useAuthStore.setState({ token: null, refreshToken: null, userId: null, email: null })
})

describe('authStore', () => {
  it('setAuth stores all fields', () => {
    useAuthStore.getState().setAuth('acc', 'ref', 'uid', 'user@example.com')
    const s = useAuthStore.getState()
    expect(s.token).toBe('acc')
    expect(s.refreshToken).toBe('ref')
    expect(s.userId).toBe('uid')
    expect(s.email).toBe('user@example.com')
  })

  it('setTokens updates the tokens but keeps identity', () => {
    useAuthStore.getState().setAuth('a', 'r', 'uid', 'user@example.com')
    useAuthStore.getState().setTokens('a2', 'r2')
    const s = useAuthStore.getState()
    expect(s.token).toBe('a2')
    expect(s.refreshToken).toBe('r2')
    expect(s.userId).toBe('uid')
    expect(s.email).toBe('user@example.com')
  })

  it('logout clears everything', () => {
    useAuthStore.getState().setAuth('a', 'r', 'uid', 'user@example.com')
    useAuthStore.getState().logout()
    const s = useAuthStore.getState()
    expect(s.token).toBeNull()
    expect(s.refreshToken).toBeNull()
    expect(s.userId).toBeNull()
    expect(s.email).toBeNull()
  })

  it('persists state under the "auth" key', () => {
    useAuthStore.getState().setAuth('a', 'r', 'uid', 'user@example.com')
    const raw = localStorage.getItem('auth')
    expect(raw).toContain('"refreshToken":"r"')
  })
})
