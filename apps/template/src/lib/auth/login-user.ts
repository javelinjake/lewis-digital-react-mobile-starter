import { directusRequest } from '@ld/directus'
import { getDirectus } from '@/lib/directus/client'
import { authRequestOptions } from '@/lib/platform/auth-mode'

export interface LoginCredentials {
  email: string
  password: string
}

export function loginUser(credentials: LoginCredentials) {
  return directusRequest(getDirectus().login(credentials, authRequestOptions))
}
