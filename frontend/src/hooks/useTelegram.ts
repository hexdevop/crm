import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { telegramApi } from '@/api/telegram'
import { getApiError } from '@/api/client'
import type { TelegramSettingsUpdate } from '@/types/telegram'

const SETTINGS_KEY = ['telegram-settings']

export function useTelegramSettings() {
  return useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: telegramApi.getSettings,
    retry: false,
  })
}

export function useUpdateTelegramSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: TelegramSettingsUpdate) => telegramApi.updateSettings(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SETTINGS_KEY })
      toast.success('Настройки Telegram сохранены')
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}

export function useGetTelegramConnectToken() {
  return useMutation({
    mutationFn: telegramApi.getConnectToken,
    onError: (err) => toast.error(getApiError(err)),
  })
}
