import { createCredentialStorage, createKeyValueStorage } from '@ld/native'
import { createIdbStorage } from '@ld/offline'

/** Non-secret preferences. Not for tokens. */
export const preferenceStorage = createKeyValueStorage('app')

/** Keychain / Keystore. Native json auth only. */
export const credentialStorage = createCredentialStorage()

export const offlineStorage = createIdbStorage('app-offline')
