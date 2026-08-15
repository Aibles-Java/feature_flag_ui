import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthState {
  token: string | null
  refreshToken: string | null
  userId: string | null
  email: string | null
  setAuth: (auth: { token: string; refreshToken: string; userId: string; email: string }) => void
  /** Replaces just the token pair after a silent refresh, leaving identity untouched. */
  setTokens: (tokens: { token: string; refreshToken: string }) => void
  /** Clears local state only. Revoking the family server-side is the caller's job (see `signOut`). */
  logout: () => void
}

/**
 * `token` is mirrored into plain localStorage because the axios interceptor reads it on every
 * request and must not import this store (that would be a cycle: store → api → store).
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      refreshToken: null,
      userId: null,
      email: null,
      setAuth: ({ token, refreshToken, userId, email }) => {
        localStorage.setItem('token', token)
        localStorage.setItem('refreshToken', refreshToken)
        set({ token, refreshToken, userId, email })
      },
      setTokens: ({ token, refreshToken }) => {
        localStorage.setItem('token', token)
        localStorage.setItem('refreshToken', refreshToken)
        set({ token, refreshToken })
      },
      logout: () => {
        localStorage.removeItem('token')
        localStorage.removeItem('refreshToken')
        set({ token: null, refreshToken: null, userId: null, email: null })
      },
    }),
    { name: 'auth' }
  )
)
