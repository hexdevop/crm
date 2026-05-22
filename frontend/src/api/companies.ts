import { apiClient } from './client'

export interface Company {
  id: string
  name: string
  slug: string
  description: string | null
  logo_url: string | null
  is_active: boolean
  access_expires_at: string | null
  created_at: string
  updated_at: string
}

export interface CompanyCreate {
  name: string
  slug: string
  description?: string
}

export interface CompanyUpdate {
  name?: string
  description?: string
  is_active?: boolean
  access_expires_at?: string | null
}

export const companiesApi = {
  list: () => apiClient.get<Company[]>('/companies').then((r) => r.data),

  get: (id: string) => apiClient.get<Company>(`/companies/${id}`).then((r) => r.data),

  getMe: () => apiClient.get<Company>('/companies/me').then((r) => r.data),

  create: (data: CompanyCreate) =>
    apiClient.post<Company>('/companies', data).then((r) => r.data),

  update: (id: string, data: CompanyUpdate) =>
    apiClient.patch<Company>(`/companies/${id}`, data).then((r) => r.data),

  delete: (id: string) =>
    apiClient.delete(`/companies/${id}`).then((r) => r.data),
}
