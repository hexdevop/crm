export interface TelegramSettings {
  id: string
  company_id: string
  is_enabled: boolean
  notification_events: Record<string, boolean>
}

export interface TelegramSettingsUpdate {
  is_enabled?: boolean
  notification_events?: Record<string, boolean>
}

export interface TelegramConnectResponse {
  link_token: string
  bot_username: string | null
  instructions: string
}
