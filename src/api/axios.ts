import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8081/api/v1',
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

/** Auth endpoints must never trigger the refresh dance — a 401 from them IS the answer. */
const AUTH_PATHS = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout']
const isAuthCall = (url?: string) => !!url && AUTH_PATHS.some((p) => url.includes(p))

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean }

/**
 * Single-flight guard. Access tokens live 15 minutes, so an expiry typically lands on a page that
 * fires several queries at once. Without this, each one starts its own refresh; the first rotates
 * the token and the rest present the now-rotated one — which the backend treats as **token reuse**
 * and responds to by revoking the whole family. The naive retry would log the user out precisely
 * when it was trying to keep them signed in.
 */
let refreshInFlight: Promise<string> | null = null

function clearSession() {
  localStorage.removeItem('token')
  localStorage.removeItem('refreshToken')
  // Persisted zustand copy; removed directly to avoid an api → store import cycle.
  localStorage.removeItem('auth')
}

function redirectToLogin() {
  clearSession()
  if (window.location.pathname !== '/login') {
    window.location.href = '/login'
  }
}

async function refreshAccessToken(): Promise<string> {
  const refreshToken = localStorage.getItem('refreshToken')
  if (!refreshToken) throw new Error('no refresh token')

  // A bare axios call: going through `api` would re-enter this interceptor.
  const { data } = await axios.post(`${api.defaults.baseURL}/auth/refresh`, { refreshToken })

  // The backend rotates on every refresh, so the NEW refresh token must be stored. Keeping the
  // old one guarantees the next refresh looks like reuse and revokes the family.
  localStorage.setItem('token', data.accessToken)
  localStorage.setItem('refreshToken', data.refreshToken)
  return data.accessToken
}

/**
 * Which statuses mean "the access token might be stale".
 *
 * 403 is in the list because this backend returns **403, not 401**, for a missing, malformed or
 * expired JWT — Spring Security's default when no `AuthenticationEntryPoint` is configured turns
 * the anonymous request into an `AccessDeniedException`. Verified against the running API: no
 * token, a garbage token and a bad-signature token all return 403.
 *
 * Listening only for 401 (the textbook choice) means the refresh below never fires: after 15
 * minutes every request 403s and the UI silently renders empty lists instead of re-authenticating.
 *
 * The cost of including 403 is that a genuine permission denial (a VIEWER attempting a delete)
 * also triggers one wasted refresh. That is handled below by *not* signing the user out when the
 * retry still fails — only a failed refresh ends the session.
 */
const MAYBE_STALE_TOKEN = [401, 403]

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined
    const status = error.response?.status

    const shouldTryRefresh =
      status !== undefined &&
      MAYBE_STALE_TOKEN.includes(status) &&
      original &&
      !original._retried &&
      !isAuthCall(original.url) &&
      localStorage.getItem('refreshToken')

    if (!shouldTryRefresh) {
      // Nothing left to try: no refresh token at all means the session is genuinely over.
      // A 403 on an already-retried request is a real permission error — surface it, don't
      // bounce the user to the login page for a button they simply aren't allowed to press.
      const noRefreshToken = !localStorage.getItem('refreshToken')
      if (status === 401 && noRefreshToken && !isAuthCall(original?.url)) redirectToLogin()
      return Promise.reject(error)
    }

    original._retried = true
    try {
      refreshInFlight = refreshInFlight ?? refreshAccessToken().finally(() => { refreshInFlight = null })
      const token = await refreshInFlight
      original.headers.Authorization = `Bearer ${token}`
      return api(original)
    } catch {
      // The refresh token itself is rejected — expired, revoked, or reuse-detected. Session over.
      redirectToLogin()
      return Promise.reject(error)
    }
  }
)

export default api
