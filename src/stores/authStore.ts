import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthState {
  token: string | null
  userId: string | null
  email: string | null
  setAuth: (token: string, userId: string, email: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      userId: null,
      email: null,
      setAuth: (token, userId, email) => {
        localStorage.setItem('token', token)
        set({ token, userId, email })
      },
      logout: () => {
        localStorage.removeItem('token')
        set({ token: null, userId: null, email: null })
      },
    }),
    { name: 'auth' }
  )
)
