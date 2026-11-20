import type { SessionUser } from '@/lib/auth/session-user'
import { preferenceStorage } from '@/lib/platform/storage'

const PROFILE_KEY = 'session-profile'

export async function readSessionProfile(): Promise<SessionUser | null> {
  const raw = await preferenceStorage.get(PROFILE_KEY)
  if (!raw)
    return null

  try {
    const parsed = JSON.parse(raw) as SessionUser
    if (!parsed?.id)
      return null
    return parsed
  }
  catch {
    return null
  }
}

export async function writeSessionProfile(user: SessionUser) {
  await preferenceStorage.set(PROFILE_KEY, JSON.stringify(user))
}

export async function clearSessionProfile() {
  await preferenceStorage.remove(PROFILE_KEY)
}
