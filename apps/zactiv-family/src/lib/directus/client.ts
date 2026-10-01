import type { AuthenticationStorage } from '@directus/sdk'
import type { LdDirectusClient } from '@ld/directus'
import type { Schema } from '@/schemas/directus-schema'
import { createDirectus, rest } from '@directus/sdk'
import { createDirectusClient, createTokenStorage } from '@ld/directus'
import { isNativePlatform } from '@ld/native'
import { getEnvConfig } from '@/config/env.config'
import { getAuthMode } from '@/lib/platform/auth-mode'
import { credentialStorage } from '@/lib/platform/storage'
import { createWebTokenStorage, readWebAccessToken } from '@/lib/platform/web-token-storage'

let cachedAccessToken: string | null = null
let authStorage: AuthenticationStorage | undefined
let client: LdDirectusClient<Schema> | null = null
let publicDirectus: ReturnType<typeof buildPublic> | null = null

export function rememberAccessToken(token: string | null) {
  cachedAccessToken = token
}

function jsonStorage() {
  return isNativePlatform()
    ? createTokenStorage(credentialStorage)
    : createWebTokenStorage()
}

export async function syncAccessTokenCache(fallback?: string | null) {
  if (!authStorage) {
    rememberAccessToken(fallback ?? readWebAccessToken())
    return
  }

  const stored = await authStorage.get()
  rememberAccessToken(stored?.access_token ?? fallback ?? null)
}

export function readAccessToken() {
  return cachedAccessToken ?? readWebAccessToken()
}

function buildPublic() {
  return createDirectus<Schema>(getEnvConfig().VITE_DIRECTUS_URL).with(rest())
}

export function getDirectus() {
  if (!client) {
    const mode = getAuthMode()
    authStorage = mode === 'json' ? jsonStorage() : undefined
    client = createDirectusClient<Schema>({
      url: getEnvConfig().VITE_DIRECTUS_URL,
      mode,
      storage: authStorage,
    })
  }

  return client
}

export function getPublicDirectus() {
  if (!publicDirectus)
    publicDirectus = buildPublic()

  return publicDirectus
}

export async function clearAuthSession() {
  rememberAccessToken(null)
  await authStorage?.set(null)
}
