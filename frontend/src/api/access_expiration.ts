import { apiClient } from './client'
import type { AccessExpiration, AccessExpirationCreate, AccessExpirationUpdate } from '@/types/access_expiration'

export const accessExpirationApi = {
  list: () =>
    apiClient.get<AccessExpiration[]>('/access-expiration').then((r) => r.data),

  get: (userId: string) =>
    apiClient.get<AccessExpiration>(`/access-expiration/${userId}`).then((r) => r.data),

  set: (data: AccessExpirationCreate) =>
    apiClient.post<AccessExpiration>('/access-expiration', data).then((r) => r.data),

  update: (userId: string, data: AccessExpirationUpdate) =>
    apiClient.patch<AccessExpiration>(`/access-expiration/${userId}`, data).then((r) => r.data),

  remove: (userId: string) =>
    apiClient.delete(`/access-expiration/${userId}`).then((r) => r.data),
}
