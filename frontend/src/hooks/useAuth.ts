import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { authApi } from '@/api/auth'
import { useAuthStore } from '@/store/auth.store'
import { getApiError } from '@/api/client'

export function useMe() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return useQuery({
    queryKey: ['me'],
    queryFn: authApi.me,
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  })
}

export function useLogin() {
  const { setAccessToken, setUser } = useAuthStore()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: authApi.login,
    onSuccess: async (data) => {
      setAccessToken(data.access_token)
      const user = await authApi.me()
      setUser(user)
      queryClient.setQueryData(['me'], user)
      navigate('/dashboard')
    },
    onError: (err) => {
      toast.error(getApiError(err))
    },
  })
}

export function useRegister() {
  const { setAccessToken, setUser } = useAuthStore()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: authApi.register,
    onSuccess: async (data) => {
      setAccessToken(data.access_token)
      const user = await authApi.me()
      setUser(user)
      queryClient.setQueryData(['me'], user)
      navigate('/dashboard')
      toast.success('Добро пожаловать! CRM готова к работе.')
    },
    onError: (err) => {
      toast.error(getApiError(err))
    },
  })
}

export function useLogout() {
  const { logout } = useAuthStore()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: authApi.logout,
    onSettled: () => {
      logout()
      queryClient.clear()
      navigate('/login')
    },
  })
}
