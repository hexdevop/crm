import { apiClient } from './client'
import type { Movement, MovementCreate, MovementBalance, PaginatedMovements } from '@/types/movement'

export const movementsApi = {
  create: (entityId: string, recordId: string, data: MovementCreate) =>
    apiClient
      .post<Movement>(`/movements/entities/${entityId}/records/${recordId}`, data)
      .then((r) => r.data),

  listByRecord: (entityId: string, recordId: string, limit = 100) =>
    apiClient
      .get<Movement[]>(`/movements/entities/${entityId}/records/${recordId}`, {
        params: { limit },
      })
      .then((r) => r.data),

  getBalance: (entityId: string, recordId: string) =>
    apiClient
      .get<MovementBalance>(`/movements/entities/${entityId}/records/${recordId}/balance`)
      .then((r) => r.data),

  listByEntity: (entityId: string, page = 1, size = 50) =>
    apiClient
      .get<PaginatedMovements>(`/movements/entities/${entityId}`, {
        params: { page, size },
      })
      .then((r) => r.data),

  delete: (movementId: string) =>
    apiClient.delete(`/movements/${movementId}`).then((r) => r.data),
}
