import type { SessionUser } from '@/lib/auth/session-user'
import { DirectusError } from '@ld/directus'
import { readOnlineHint } from '@ld/native'
import { create } from 'zustand'
import { loginUser } from '@/lib/auth/login-user'
import { logoutUser } from '@/lib/auth/logout-user'
import { readCurrentUser } from '@/lib/auth/read-current-user'
import { refreshSession } from '@/lib/auth/refresh-session'
import { clearSessionProfile, readSessionProfile, writeSessionProfile } from '@/lib/platform/session-profile'

interface AuthState {
  status: 'bootstrapping' | 'authenticated' | 'anonymous'
  user: SessionUser | null
  userId: string | null
  bootstrap: () => Promise<void>
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  expireSession: () => Promise<void>
}

let bootstrapPromise: Promise<void> | null = null

function isAuthFailure(error: unknown) {
  return error instanceof DirectusError && (error.status === 401 || error.status === 403)
}

function isOfflineFailure(error: unknown) {
  if (error instanceof TypeError)
    return true

  if (error instanceof DirectusError)
    return error.status === 0

  return false
}

export const useAuthStore = create<AuthState>(set => ({
  status: 'bootstrapping',
  user: null,
  userId: null,
  bootstrap: () => {
    if (!bootstrapPromise) {
      bootstrapPromise = (async () => {
        const cached = await readSessionProfile()
        const online = await readOnlineHint()

        if (!online && cached) {
          set({ status: 'authenticated', user: cached, userId: cached.id })
          return
        }

        try {
          await refreshSession()
          const user = await readCurrentUser()
          await writeSessionProfile(user)
          set({ status: 'authenticated', user, userId: user.id })
        }
        catch (error) {
          if (!isAuthFailure(error) && cached && (isOfflineFailure(error) || !online)) {
            set({ status: 'authenticated', user: cached, userId: cached.id })
            return
          }

          await clearSessionProfile()
          set({ status: 'anonymous', user: null, userId: null })
        }
      })()
    }

    return bootstrapPromise
  },
  login: async (email, password) => {
    await loginUser({ email, password })
    const user = await readCurrentUser()
    await writeSessionProfile(user)
    bootstrapPromise = Promise.resolve()
    set({ status: 'authenticated', user, userId: user.id })
  },
  logout: async () => {
    try {
      await logoutUser()
    }
    catch {
      // The local session still ends. Pending writes stay in this user's outbox.
    }
    await clearSessionProfile()
    bootstrapPromise = Promise.resolve()
    set({ status: 'anonymous', user: null, userId: null })
  },
  expireSession: async () => {
    try {
      await logoutUser()
    }
    catch {
      // The token is already rejected.
    }
    await clearSessionProfile()
    bootstrapPromise = Promise.resolve()
    set({ status: 'anonymous', user: null, userId: null })
  },
}))
