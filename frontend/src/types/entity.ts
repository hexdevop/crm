export type FieldType = 'text' | 'number' | 'date' | 'boolean' | 'select' | 'email' | 'phone'

export interface EntityField {
  id: string
  entity_id: string
  name: string
  slug: string
  field_type: FieldType
  is_required: boolean
  is_searchable: boolean
  position: number
  config: Record<string, unknown> | null
}

export interface Entity {
  id: string
  company_id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
  color: string | null
  fields: EntityField[]
  record_count: number
  created_at: string
  updated_at: string
}

export interface EntityCreate {
  name: string
  slug: string
  description?: string
  icon?: string
  color?: string
  fields?: EntityFieldCreate[]
}

export interface EntityFieldCreate {
  name: string
  slug: string
  field_type: FieldType
  is_required?: boolean
  is_searchable?: boolean
  position?: number
  config?: Record<string, unknown>
}

export interface EntityRecord {
  id: string
  entity_id: string
  company_id: string
  created_by: string | null
  data: Record<string, unknown>
  created_at: string
  updated_at: string
}
