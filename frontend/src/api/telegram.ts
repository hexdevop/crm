import { apiClient } from './client'
import type { TelegramSettings, TelegramSettingsUpdate, TelegramConnectResponse } from '@/types/telegram'

export const telegramApi = {
  getSettings: () =>
    apiClient.get<TelegramSettings>('/telegram/settings').then((r) => r.data),

  updateSettings: (data: TelegramSettingsUpdate) =>
    apiClient.put<TelegramSettings>('/telegram/settings', data).then((r) => r.data),

  getConnectToken: () =>
    apiClient.post<TelegramConnectResponse>('/telegram/connect').then((r) => r.data),
}
