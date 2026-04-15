import { apiClient } from './client'
import type { Entity, EntityField, EntityCreate, EntityFieldCreate, EntityRecord } from '@/types/entity'
import type { PaginatedResponse } from '@/types/common'

export const entitiesApi = {
  list: () =>
    apiClient.get<Entity[]>('/entities').then((r) => r.data),

  get: (id: string) =>
    apiClient.get<Entity>(`/entities/${id}`).then((r) => r.data),

  create: (data: EntityCreate) =>
    apiClient.post<Entity>('/entities', data).then((r) => r.data),

  update: (id: string, data: Partial<EntityCreate>) =>
    apiClient.patch<Entity>(`/entities/${id}`, data).then((r) => r.data),

  delete: (id: string) =>
    apiClient.delete(`/entities/${id}`).then((r) => r.data),

  // Fields
  addField: (entityId: string, data: EntityFieldCreate) =>
    apiClient.post<EntityField>(`/entities/${entityId}/fields`, data).then((r) => r.data),

  updateField: (entityId: string, fieldId: string, data: Partial<EntityFieldCreate>) =>
    apiClient.patch<EntityField>(`/entities/${entityId}/fields/${fieldId}`, data).then((r) => r.data),

  deleteField: (entityId: string, fieldId: string) =>
    apiClient.delete(`/entities/${entityId}/fields/${fieldId}`).then((r) => r.data),

  reorderFields: (entityId: string, fieldIds: string[]) =>
    apiClient.put(`/entities/${entityId}/fields/order`, { field_ids: fieldIds }).then((r) => r.data),

  // Records
  listRecords: (
    entityId: string,
    params?: { page?: number; size?: number; search?: string; sort?: string; order?: string }
  ) =>
    apiClient
      .get<PaginatedResponse<EntityRecord>>(`/entities/${entityId}/records`, { params })
      .then((r) => r.data),

  getRecord: (entityId: string, recordId: string) =>
    apiClient.get<EntityRecord>(`/entities/${entityId}/records/${recordId}`).then((r) => r.data),

  createRecord: (entityId: string, data: Record<string, unknown>) =>
    apiClient.post<EntityRecord>(`/entities/${entityId}/records`, { data }).then((r) => r.data),

  updateRecord: (entityId: string, recordId: string, data: Record<string, unknown>) =>
    apiClient.patch<EntityRecord>(`/entities/${entityId}/records/${recordId}`, { data }).then((r) => r.data),

  deleteRecord: (entityId: string, recordId: string) =>
    apiClient.delete(`/entities/${entityId}/records/${recordId}`).then((r) => r.data),
}
