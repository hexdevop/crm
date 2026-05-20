import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { movementsApi } from '@/api/movements'
import { getApiError } from '@/api/client'
import type { MovementCreate } from '@/types/movement'

export function useRecordMovements(entityId: string, recordId: string, enabled = true) {
  return useQuery({
    queryKey: ['movements', entityId, recordId],
    queryFn: () => movementsApi.listByRecord(entityId, recordId),
    enabled: enabled && !!entityId && !!recordId,
  })
}

export function useRecordBalance(entityId: string, recordId: string, enabled = true) {
  return useQuery({
    queryKey: ['balance', entityId, recordId],
    queryFn: () => movementsApi.getBalance(entityId, recordId),
    enabled: enabled && !!entityId && !!recordId,
  })
}

export function useEntityMovements(entityId: string, page = 1, size = 50) {
  return useQuery({
    queryKey: ['movements', entityId, { page, size }],
    queryFn: () => movementsApi.listByEntity(entityId, page, size),
    enabled: !!entityId,
  })
}

export function useCreateMovement(entityId: string, recordId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: MovementCreate) =>
      movementsApi.create(entityId, recordId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['movements', entityId, recordId] })
      qc.invalidateQueries({ queryKey: ['balance', entityId, recordId] })
      qc.invalidateQueries({ queryKey: ['movements', entityId] })
      toast.success('Операция добавлена')
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}

export function useDeleteMovement(entityId: string, recordId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (movementId: string) => movementsApi.delete(movementId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['movements', entityId, recordId] })
      qc.invalidateQueries({ queryKey: ['balance', entityId, recordId] })
      qc.invalidateQueries({ queryKey: ['movements', entityId] })
      toast.success('Операция удалена')
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}
