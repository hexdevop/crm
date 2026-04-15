import { apiClient } from './client'
import type { LoginRequest, RegisterRequest, TokenResponse } from '@/types/auth'
import type { MeUser } from '@/types/user'

export const authApi = {
  login: (data: LoginRequest) =>
    apiClient.post<TokenResponse>('/auth/login', data).then((r) => r.data),

  register: (data: RegisterRequest) =>
    apiClient.post<TokenResponse>('/auth/register', data).then((r) => r.data),

  refresh: () =>
    apiClient.post<TokenResponse>('/auth/refresh').then((r) => r.data),

  logout: () =>
    apiClient.post('/auth/logout').then((r) => r.data),

  me: () =>
    apiClient.get<MeUser>('/auth/me').then((r) => r.data),
}
