import { directusRequest } from '@ld/directus'
import { getDirectus } from '@/lib/directus/client'
import { authRequestOptions } from '@/lib/platform/auth-mode'

export function refreshSession() {
  return directusRequest(getDirectus().refresh(authRequestOptions))
}
