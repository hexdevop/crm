import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { accessExpirationApi } from '@/api/access_expiration'
import { getApiError } from '@/api/client'
import type { AccessExpirationCreate, AccessExpirationUpdate } from '@/types/access_expiration'

const QUERY_KEY = ['access-expiration']

export function useAccessExpirations() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: accessExpirationApi.list,
  })
}

export function useSetAccessExpiration() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: AccessExpirationCreate) => accessExpirationApi.set(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY })
      toast.success('Срок доступа установлен')
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}

export function useUpdateAccessExpiration() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: AccessExpirationUpdate }) =>
      accessExpirationApi.update(userId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY })
      toast.success('Срок доступа обновлён')
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}

export function useRemoveAccessExpiration() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => accessExpirationApi.remove(userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY })
      toast.success('Ограничение доступа снято')
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}
