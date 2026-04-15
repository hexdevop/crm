export interface Permission {
  id: string
  code: string
  description: string | null
}

export interface Role {
  id: string
  company_id: string
  name: string
  description: string | null
  is_system: boolean
  system_type: string | null
  permissions: Permission[]
  created_at: string
  updated_at: string
}

export interface RoleCreate {
  name: string
  description?: string
}

export interface RoleUpdate {
  name?: string
  description?: string
}
