import type { DirectusUser } from '@/schemas/directus-schema'
import { passwordRequest, readMe, registerUser, registerUserVerify, updateMe } from '@directus/sdk'
import { directusRequest } from '@ld/directus'
import { create } from 'zustand'
import { getEnvConfig } from '@/config/env.config'
import { clearAllActiveLogs } from '@/lib/activity-log'
import { readSchool } from '@/lib/content-api'
import { clearAuthSession, getDirectus, getPublicDirectus, syncAccessTokenCache } from '@/lib/directus/client'
import { isAuthFailure, parseError } from '@/lib/errors'
import { clearPendingCredentials, readPendingCredentials, SCHOOL_SLUG_KEY, writePendingCredentials } from '@/lib/family-data'
import { getAuthRequestOptions } from '@/lib/platform/auth-mode'

export interface SessionUser {
  id: string
  email: string
  firstName: string
  lastName: string
  familyName: string
  balance: number
}

interface AuthState {
  status: 'bootstrapping' | 'authenticated' | 'anonymous'
  user: SessionUser | null
  error: string | null
  bootstrap: () => Promise<void>
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, schoolSlug?: string) => Promise<void>
  verify: (token: string) => Promise<boolean>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
  updateProfile: (updates: { first_name?: string, family_name?: string }) => Promise<void>
  requestPassword: (email: string) => Promise<void>
  setError: (message: string | null) => void
}

let bootstrapPromise: Promise<void> | null = null

function toSessionUser(user: DirectusUser): SessionUser {
  return {
    id: user.id,
    email: user.email || '',
    firstName: user.first_name || '',
    lastName: user.last_name || '',
    familyName: user.family_name || '',
    balance: user.zactivs_balance || 0,
  }
}

async function linkSchoolFromStorage() {
  if (typeof window === 'undefined')
    return

  const slug = window.localStorage.getItem(SCHOOL_SLUG_KEY)
  if (!slug)
    return

  const school = await readSchool(slug)
  if (!school?.id)
    return

  await getDirectus().request(updateMe({ school: school.id } as never))
  window.localStorage.removeItem(SCHOOL_SLUG_KEY)
}

async function fetchMe() {
  const user = await getDirectus().request(readMe({
    fields: ['id', 'email', 'first_name', 'last_name', 'family_name', 'zactivs_balance'],
  })) as DirectusUser
  return toSessionUser(user)
}

export const useAuthStore = create<AuthState>(set => ({
  status: 'bootstrapping',
  user: null,
  error: null,
  setError: message => set({ error: message }),
  bootstrap: () => {
    if (!bootstrapPromise) {
      bootstrapPromise = (async () => {
        try {
          const session = await directusRequest(getDirectus().refresh(getAuthRequestOptions()))
          const user = await fetchMe()
          await syncAccessTokenCache(session?.access_token)
          set({ status: 'authenticated', user, error: null })
        }
        catch (error) {
          if (isAuthFailure(error))
            await clearAuthSession()

          set({ status: 'anonymous', user: null })
        }
      })()
    }

    return bootstrapPromise
  },
  login: async (email, password) => {
    const session = await directusRequest(getDirectus().login({ email, password }, getAuthRequestOptions()))
    const user = await fetchMe()
    await syncAccessTokenCache(session?.access_token)
    clearPendingCredentials()
    bootstrapPromise = Promise.resolve()
    set({ status: 'authenticated', user, error: null })
  },
  register: async (email, password, schoolSlug) => {
    const base = `${getEnvConfig().VITE_FRONTEND_URL}/verification`
    const verificationUrl = schoolSlug ? `${base}?school=${encodeURIComponent(schoolSlug)}` : base
    await getPublicDirectus().request(registerUser(email, password, { verification_url: verificationUrl }))
    writePendingCredentials(email, password)
    if (schoolSlug)
      window.localStorage.setItem(SCHOOL_SLUG_KEY, schoolSlug)
  },
  verify: async (token) => {
    await getPublicDirectus().request(registerUserVerify(token))
    const pending = readPendingCredentials()
    if (!pending)
      return false

    const session = await directusRequest(getDirectus().login({ email: pending.email, password: pending.password }, getAuthRequestOptions()))
    await linkSchoolFromStorage().catch(() => {})
    const user = await fetchMe()
    await syncAccessTokenCache(session?.access_token)
    clearPendingCredentials()
    bootstrapPromise = Promise.resolve()
    set({ status: 'authenticated', user, error: null })
    return true
  },
  logout: async () => {
    try {
      await directusRequest(getDirectus().logout(getAuthRequestOptions()))
    }
    catch {
      // The local session still ends.
    }
    await clearAuthSession()
    clearAllActiveLogs()
    bootstrapPromise = Promise.resolve()
    set({ status: 'anonymous', user: null })
  },
  refreshUser: async () => {
    const user = await fetchMe()
    set({ user })
  },
  updateProfile: async (updates) => {
    await getDirectus().request(updateMe(updates))
    await linkSchoolFromStorage().catch(() => {})
    const user = await fetchMe()
    set({ user })
  },
  requestPassword: async (email) => {
    try {
      await getDirectus().request(passwordRequest(email))
    }
    catch (error) {
      throw new Error(parseError(error).userMessage)
    }
  },
}))
