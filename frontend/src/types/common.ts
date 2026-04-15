export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  size: number
  pages: number
}

export interface ApiError {
  code: string
  message: string
}

export interface MessageResponse {
  message: string
}
