import api from './axios'

/**
 * Mirrors the backend `AuthResponse`.
 *
 * Note the field names: the backend moved from `{ token, type }` to
 * `{ accessToken, refreshToken, tokenType, expiresIn }` when short-lived access tokens landed.
 * Reading `token` here silently yields `undefined`, which is then stored as the literal string
 * "undefined" and sent as `Authorization: Bearer undefined` — every admin call 401s while login
 * itself appears to succeed.
 */
export interface AuthResponse {
  accessToken: string
  refreshToken: string
  tokenType: string
  /** Access-token lifetime in seconds (900 = 15 min). */
  expiresIn: number
  userId: string
  email: string
}

export const login = (email: string, password: string) =>
  api.post<AuthResponse>('/auth/login', { email, password }).then((r) => r.data)

export const register = (data: {
  email: string
  password: string
  firstName: string
  lastName: string
}) => api.post<AuthResponse>('/auth/register', data).then((r) => r.data)

/**
 * Exchanges a refresh token for a new pair. The backend rotates on every use: the old refresh
 * token is invalidated, and re-using a rotated one revokes the entire family as a theft signal.
 * So the response's `refreshToken` must always be persisted — replaying the previous one logs
 * the user out everywhere.
 */
export const refresh = (refreshToken: string) =>
  api.post<AuthResponse>('/auth/refresh', { refreshToken }).then((r) => r.data)

/** Revokes the refresh-token family server-side. Idempotent: always 204, even for a stale token. */
export const logout = (refreshToken: string) => api.post('/auth/logout', { refreshToken })
