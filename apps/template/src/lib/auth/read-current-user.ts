import type { SessionUser } from '@/lib/auth/session-user'
import { readMe } from '@directus/sdk'
import { directusRequest } from '@ld/directus'
import { getDirectus } from '@/lib/directus/client'

export function readCurrentUser() {
  return directusRequest(
    getDirectus().request(
      readMe({
        fields: ['id', 'email', 'first_name', 'last_name'],
      }),
    ),
  ) as Promise<SessionUser>
}
