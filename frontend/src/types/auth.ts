export interface TokenResponse {
  access_token: string
  token_type: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  company_name: string
  company_slug: string
  first_name: string
  last_name: string
  email: string
  password: string
}
