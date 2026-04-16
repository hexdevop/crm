import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { entitiesApi } from '@/api/entities'
import { getApiError } from '@/api/client'
import type { EntityCreate, EntityFieldCreate } from '@/types/entity'

export function useEntities() {
  return useQuery({ queryKey: ['entities'], queryFn: entitiesApi.list })
}

export function useEntity(id: string) {
  return useQuery({
    queryKey: ['entities', id],
    queryFn: () => entitiesApi.get(id),
    enabled: !!id,
  })
}

export function useCreateEntity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: EntityCreate) => entitiesApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['entities'] })
      toast.success('Сущность создана')
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}

export function useUpdateEntity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<EntityCreate> }) =>
      entitiesApi.update(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['entities'] })
      qc.invalidateQueries({ queryKey: ['entities', id] })
      toast.success('Сущность обновлена')
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}

export function useDeleteEntity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: entitiesApi.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['entities'] })
      toast.success('Сущность удалена')
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}

export function useEntityRecords(
  entityId: string,
  params?: { page?: number; size?: number; search?: string; sort?: string; order?: string }
) {
  return useQuery({
    queryKey: ['records', entityId, params],
    queryFn: () => entitiesApi.listRecords(entityId, params),
    enabled: !!entityId,
  })
}

export function useCreateRecord() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ entityId, data }: { entityId: string; data: Record<string, unknown> }) =>
      entitiesApi.createRecord(entityId, data),
    onSuccess: (_, { entityId }) => {
      qc.invalidateQueries({ queryKey: ['records', entityId] })
      toast.success('Запись создана')
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}

export function useUpdateRecord() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      entityId,
      recordId,
      data,
    }: {
      entityId: string
      recordId: string
      data: Record<string, unknown>
    }) => entitiesApi.updateRecord(entityId, recordId, data),
    onSuccess: (_, { entityId }) => {
      qc.invalidateQueries({ queryKey: ['records', entityId] })
      toast.success('Запись обновлена')
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}

export function useDeleteRecord() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ entityId, recordId }: { entityId: string; recordId: string }) =>
      entitiesApi.deleteRecord(entityId, recordId),
    onSuccess: (_, { entityId }) => {
      qc.invalidateQueries({ queryKey: ['records', entityId] })
      toast.success('Запись удалена')
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}
