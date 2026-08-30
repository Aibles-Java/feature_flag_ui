import axios, { type InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/stores/authStore'

// Resolution order:
//   1. window.__ENV__  — runtime config injected by the container (build once, deploy anywhere)
//   2. import.meta.env — Vite build-time value (dev via .env)
//   3. hardcoded fallback
const baseURL =
  window.__ENV__?.VITE_API_URL ??
  import.meta.env.VITE_API_URL ??
  'http://localhost:8080/api/v1'

const api = axios.create({ baseURL })

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

function forceLogout() {
  useAuthStore.getState().logout()
  if (window.location.pathname !== '/login') {
    window.location.href = '/login'
  }
}

// Single-flight refresh: many requests can 401 at once (access token just
// expired); they all await the same /auth/refresh call instead of firing one
// each. Uses a bare axios (not `api`) so it bypasses these interceptors — no
// recursion, no stale Authorization header.
let refreshing: Promise<string> | null = null

interface RefreshResult {
  accessToken: string
  refreshToken: string
}

async function runRefresh(): Promise<string> {
  const refreshToken = useAuthStore.getState().refreshToken
  if (!refreshToken) throw new Error('No refresh token')
  const { data } = await axios.post<RefreshResult>(`${baseURL}/auth/refresh`, {
    refreshToken,
  })
  // Refresh rotates the refresh token — the old one is now dead, so persist BOTH.
  useAuthStore.getState().setTokens(data.accessToken, data.refreshToken)
  return data.accessToken
}

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean }

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config as RetriableConfig | undefined
    const status = error.response?.status

    // Only try to recover a first-time 401 on a real request.
    if (status !== 401 || !original || original._retry) {
      throw error
    }
    // Nothing to refresh with → straight to login.
    if (!useAuthStore.getState().refreshToken) {
      forceLogout()
      throw error
    }

    original._retry = true
    try {
      refreshing ??= runRefresh().finally(() => {
        refreshing = null
      })
      const newToken = await refreshing
      original.headers.Authorization = `Bearer ${newToken}`
      return api(original)
    } catch (e) {
      // Refresh token expired/revoked — session is over.
      forceLogout()
      throw e
    }
  }
)

export default api
