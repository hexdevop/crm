import { apiClient } from './client'
import type { Role, Permission, RoleCreate, RoleUpdate } from '@/types/role'

export const rolesApi = {
  list: () =>
    apiClient.get<Role[]>('/roles').then((r) => r.data),

  get: (id: string) =>
    apiClient.get<Role>(`/roles/${id}`).then((r) => r.data),

  create: (data: RoleCreate) =>
    apiClient.post<Role>('/roles', data).then((r) => r.data),

  update: (id: string, data: RoleUpdate) =>
    apiClient.patch<Role>(`/roles/${id}`, data).then((r) => r.data),

  delete: (id: string) =>
    apiClient.delete(`/roles/${id}`).then((r) => r.data),

  updatePermissions: (id: string, permissionIds: string[]) =>
    apiClient.put<Role>(`/roles/${id}/permissions`, { permission_ids: permissionIds }).then((r) => r.data),

  listPermissions: () =>
    apiClient.get<Permission[]>('/roles/permissions').then((r) => r.data),
}
