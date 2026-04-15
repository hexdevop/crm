import { apiClient } from './client'
import type { User, UserCreate, UserUpdate } from '@/types/user'
import type { PaginatedResponse, MessageResponse } from '@/types/common'

export const usersApi = {
  list: (params?: { page?: number; size?: number; search?: string; is_active?: boolean }) =>
    apiClient.get<PaginatedResponse<User>>('/users', { params }).then((r) => r.data),

  get: (id: string) =>
    apiClient.get<User>(`/users/${id}`).then((r) => r.data),

  create: (data: UserCreate) =>
    apiClient.post<User>('/users', data).then((r) => r.data),

  update: (id: string, data: UserUpdate) =>
    apiClient.patch<User>(`/users/${id}`, data).then((r) => r.data),

  delete: (id: string) =>
    apiClient.delete(`/users/${id}`).then((r) => r.data),

  activate: (id: string) =>
    apiClient.post<MessageResponse>(`/users/${id}/activate`).then((r) => r.data),

  deactivate: (id: string) =>
    apiClient.post<MessageResponse>(`/users/${id}/deactivate`).then((r) => r.data),

  assignRole: (userId: string, roleId: string) =>
    apiClient.post<MessageResponse>(`/users/${userId}/roles`, { role_id: roleId }).then((r) => r.data),

  removeRole: (userId: string, roleId: string) =>
    apiClient.delete<MessageResponse>(`/users/${userId}/roles/${roleId}`).then((r) => r.data),

  changePassword: (userId: string, data: { current_password: string; new_password: string }) =>
    apiClient.post<MessageResponse>(`/users/${userId}/change-password`, data).then((r) => r.data),
}
