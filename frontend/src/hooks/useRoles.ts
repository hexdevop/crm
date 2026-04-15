import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { rolesApi } from '@/api/roles'
import { getApiError } from '@/api/client'
import type { RoleCreate, RoleUpdate } from '@/types/role'

export function useRoles() {
  return useQuery({ queryKey: ['roles'], queryFn: rolesApi.list })
}

export function useRole(id: string) {
  return useQuery({
    queryKey: ['roles', id],
    queryFn: () => rolesApi.get(id),
    enabled: !!id,
  })
}

export function usePermissions() {
  return useQuery({ queryKey: ['permissions'], queryFn: rolesApi.listPermissions })
}

export function useCreateRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: RoleCreate) => rolesApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roles'] })
      toast.success('Role created')
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}

export function useUpdateRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: RoleUpdate }) =>
      rolesApi.update(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['roles'] })
      qc.invalidateQueries({ queryKey: ['roles', id] })
      toast.success('Role updated')
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}

export function useDeleteRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: rolesApi.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roles'] })
      toast.success('Role deleted')
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}

export function useUpdateRolePermissions() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, permissionIds }: { id: string; permissionIds: string[] }) =>
      rolesApi.updatePermissions(id, permissionIds),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['roles'] })
      qc.invalidateQueries({ queryKey: ['roles', id] })
      toast.success('Permissions updated')
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}
