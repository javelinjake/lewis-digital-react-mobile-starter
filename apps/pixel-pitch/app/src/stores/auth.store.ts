import type { SessionUser } from '@/lib/auth/session-user'
import { isApiError } from '@ld/api-client'
import { readOnlineHint } from '@ld/native'
import { create } from 'zustand'
import { onSessionLost } from '@/lib/api/client'
import { authApi } from '@/lib/auth/auth-api'
import { clearSessionProfile, readSessionProfile, writeSessionProfile } from '@/lib/platform/session-profile'

interface AuthState {
  status: 'bootstrapping' | 'authenticated' | 'anonymous'
  user: SessionUser | null
  userId: string | null
  bootstrap: () => Promise<void>
  /** Email and password. A guest who signs in carries their data into the account (done by the server). */
  login: (email: string, password: string) => Promise<void>
  /** A guest account, created on first launch so people can start without an account. */
  loginAsGuest: () => Promise<void>
  logout: () => Promise<void>
  /** The server rejected the session. Drops it locally. */
  expireSession: () => Promise<void>
  deleteAccount: () => Promise<void>
}

let bootstrapPromise: Promise<void> | null = null

/** A server that cannot be reached, or that is failing, says nothing about whether the session is valid. */
function isUnreachable(error: unknown) {
  return error instanceof TypeError || (isApiError(error) && (error.status >= 500 || error.status === 0))
}

export const useAuthStore = create<AuthState>((set) => {
  async function become(user: SessionUser) {
    await writeSessionProfile(user)
    bootstrapPromise = Promise.resolve()
    set({ status: 'authenticated', user, userId: user.id })
  }

  async function leave() {
    await clearSessionProfile()
    bootstrapPromise = Promise.resolve()
    set({ status: 'anonymous', user: null, userId: null })
  }

  return {
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
            const user = await authApi.getSession()
            if (user) {
              await writeSessionProfile(user)
              set({ status: 'authenticated', user, userId: user.id })
              return
            }
            await leave()
          }
          catch (error) {
            if (cached && (isUnreachable(error) || !online)) {
              set({ status: 'authenticated', user: cached, userId: cached.id })
              return
            }
            await leave()
          }
        })()
      }

      return bootstrapPromise
    },
    login: async (email, password) => {
      await become(await authApi.signInWithEmail(email, password))
    },
    loginAsGuest: async () => {
      await become(await authApi.signInAnonymously())
    },
    logout: async () => {
      try {
        await authApi.signOut()
      }
      catch {
        // The local session still ends.
      }
      await leave()
    },
    expireSession: async () => {
      try {
        await authApi.signOut()
      }
      catch {
        // The session is already rejected.
      }
      await leave()
    },
    deleteAccount: async () => {
      await authApi.deleteAccount()
      await leave()
    },
  }
})

onSessionLost(() => {
  void useAuthStore.getState().expireSession()
})
