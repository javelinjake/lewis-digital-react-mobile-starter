import type { LdDirectusClient } from '@ld/directus'
import type { Schema } from '@/schemas/directus-schema'
import { createDirectusClient, createTokenStorage } from '@ld/directus'
import { getEnvConfig } from '@/config/env.config'
import { getAuthMode } from '@/lib/platform/auth-mode'
import { credentialStorage } from '@/lib/platform/storage'

let client: LdDirectusClient<Schema> | null = null

export function getDirectus() {
  if (!client) {
    const mode = getAuthMode()
    client = createDirectusClient<Schema>({
      url: getEnvConfig().VITE_DIRECTUS_URL,
      mode,
      storage: mode === 'json' ? createTokenStorage(credentialStorage) : undefined,
    })
  }

  return client
}
