import api from './axios'

// Matches backend org.aibles.feature_flag.dto.response.AuthResponse
export interface AuthResponse {
  accessToken: string
  refreshToken: string
  tokenType: string
  expiresIn: number
  userId: string
  email: string
}

export const login = (email: string, password: string) =>
  api.post<AuthResponse>('/auth/login', { email, password }).then((r) => r.data)

// Backend register returns 201 with no body — it does not auto-login.
export const register = (data: {
  email: string
  password: string
  firstName?: string
  lastName?: string
}) => api.post<void>('/auth/register', data).then(() => undefined)

// Exchange a (rotating) refresh token for a fresh access + refresh token pair.
export const refresh = (refreshToken: string) =>
  api.post<AuthResponse>('/auth/refresh', { refreshToken }).then((r) => r.data)

// Revoke the refresh token server-side. Backend answers 204 regardless.
export const logout = (refreshToken: string) =>
  api.post<void>('/auth/logout', { refreshToken }).then(() => undefined)
