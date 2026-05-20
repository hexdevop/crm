export type MovementType = 'receipt' | 'expenditure' | 'write_off'

export const MOVEMENT_LABELS: Record<MovementType, string> = {
  receipt: 'Приход',
  expenditure: 'Расход',
  write_off: 'Списание',
}

export const MOVEMENT_COLORS: Record<MovementType, string> = {
  receipt: 'green',
  expenditure: 'red',
  write_off: 'gray',
}

export interface Movement {
  id: string
  company_id: string
  entity_id: string
  record_id: string
  movement_type: MovementType
  quantity: number
  unit: string | null
  notes: string | null
  reference_number: string | null
  performed_by: string | null
  performed_at: string
  created_at: string
}

export interface MovementCreate {
  movement_type: MovementType
  quantity: number
  unit?: string
  notes?: string
  reference_number?: string
  performed_at?: string
}

export interface MovementBalance {
  receipt: number
  expenditure: number
  write_off: number
  balance: number
  unit: string | null
}

export interface PaginatedMovements {
  items: Movement[]
  total: number
  page: number
  pages: number
  size: number
}
