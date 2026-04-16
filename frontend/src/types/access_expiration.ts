export interface AccessExpiration {
  id: string
  user_id: string
  company_id: string
  expires_at: string
  is_notified: boolean
  was_auto_blocked: boolean
  created_at: string
  updated_at: string
}

export interface AccessExpirationCreate {
  user_id: string
  expires_at: string
}

export interface AccessExpirationUpdate {
  expires_at: string
}
