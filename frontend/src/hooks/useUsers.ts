import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { usersApi } from '@/api/users'
import { getApiError } from '@/api/client'
import type { UserCreate, UserUpdate } from '@/types/user'

export function useUsers(params?: { page?: number; size?: number; search?: string; is_active?: boolean }) {
  return useQuery({
    queryKey: ['users', params],
    queryFn: () => usersApi.list(params),
  })
}

export function useUser(id: string) {
  return useQuery({
    queryKey: ['users', id],
    queryFn: () => usersApi.get(id),
    enabled: !!id,
  })
}

export function useCreateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: UserCreate) => usersApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      toast.success('Пользователь создан')
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}

export function useUpdateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UserUpdate }) =>
      usersApi.update(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['users'] })
      qc.invalidateQueries({ queryKey: ['users', id] })
      toast.success('Пользователь обновлён')
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}

export function useDeleteUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: usersApi.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      toast.success('Пользователь удалён')
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}

export function useToggleUserActive() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      active ? usersApi.activate(id) : usersApi.deactivate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      toast.success('Статус пользователя изменён')
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}

export function useAssignRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, roleId }: { userId: string; roleId: string }) =>
      usersApi.assignRole(userId, roleId),
    onSuccess: (_, { userId }) => {
      qc.invalidateQueries({ queryKey: ['users', userId] })
      qc.invalidateQueries({ queryKey: ['users'] })
      toast.success('Роль назначена')
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}

export function useRemoveRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, roleId }: { userId: string; roleId: string }) =>
      usersApi.removeRole(userId, roleId),
    onSuccess: (_, { userId }) => {
      qc.invalidateQueries({ queryKey: ['users', userId] })
      qc.invalidateQueries({ queryKey: ['users'] })
      toast.success('Роль снята')
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}
