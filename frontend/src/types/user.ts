export interface RoleShort {
  id: string
  name: string
  system_type: string | null
}

export interface CompanyShort {
  id: string
  name: string
  slug: string
}

export interface User {
  id: string
  company_id: string
  email: string
  first_name: string
  last_name: string
  full_name: string
  is_active: boolean
  is_superadmin: boolean
  telegram_chat_id: string | null
  telegram_username: string | null
  roles: RoleShort[]
  created_at: string
  updated_at: string
}

export interface MeUser extends User {
  permissions: string[]
  company: CompanyShort | null
}

export interface UserCreate {
  email: string
  password: string
  first_name: string
  last_name: string
}

export interface UserUpdate {
  first_name?: string
  last_name?: string
  email?: string
}
