import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthState {
  token: string | null
  refreshToken: string | null
  userId: string | null
  email: string | null
  setAuth: (token: string, refreshToken: string, userId: string, email: string) => void
  // Used by the axios interceptor after a successful /auth/refresh (rotates both tokens).
  setTokens: (token: string, refreshToken: string) => void
  logout: () => void
}

// Persisted under localStorage key "auth"; the axios layer reads tokens via
// useAuthStore.getState() so it works outside React.
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      refreshToken: null,
      userId: null,
      email: null,
      setAuth: (token, refreshToken, userId, email) =>
        set({ token, refreshToken, userId, email }),
      setTokens: (token, refreshToken) => set({ token, refreshToken }),
      logout: () => set({ token: null, refreshToken: null, userId: null, email: null }),
    }),
    { name: 'auth' }
  )
)
