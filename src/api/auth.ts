import api from './axios'

export interface AuthResponse {
  token: string
  type: string
  userId: string
  email: string
}

export const login = (email: string, password: string) =>
  api.post<AuthResponse>('/auth/login', { email, password }).then((r) => r.data)

export const register = (data: {
  email: string
  password: string
  firstName?: string
  lastName?: string
}) => api.post<AuthResponse>('/auth/register', data).then((r) => r.data)
