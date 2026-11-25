/**
 * Pure parts of the Mac release script (`tooling/native/release.ts`), kept apart so they are tested.
 */

export type ReleasePlatform = 'ios' | 'android'
export type ReleaseEnv = 'staging' | 'prod'

export function parseReleaseArgs(argv: string[], env: string | undefined): { platform: ReleasePlatform, appEnv: ReleaseEnv } {
  const platform = argv[0]
  if (platform !== 'ios' && platform !== 'android')
    throw new Error('Usage: pnpm release:ios | pnpm release:android   (APP_ENV=staging for a staging build; default prod)')
  const appEnv = env?.trim() || 'prod'
  if (appEnv !== 'staging' && appEnv !== 'prod')
    throw new Error(`Store builds are staging or prod, not "${appEnv}". Use cap:dev:${platform} for a dev build.`)
  return { platform, appEnv }
}

export interface KeystoreProperties {
  storeFile: string
  storePassword: string
  keyAlias: string
  keyPassword: string
}

/** Reads `android/keystore.properties` (gitignored). `storeFile` is relative to the `android/` folder. */
export function parseKeystoreProperties(text: string): KeystoreProperties {
  const values = Object.fromEntries(text.split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))
    .map((line) => {
      const index = line.indexOf('=')
      return index < 0 ? [line, ''] : [line.slice(0, index).trim(), line.slice(index + 1).trim()]
    }))
  const missing = ['storeFile', 'storePassword', 'keyAlias', 'keyPassword'].filter(key => !values[key])
  if (missing.length > 0)
    throw new Error(`android/keystore.properties is missing ${missing.join(', ')}. See docs/native-release.md, "Android signing".`)
  return values as unknown as KeystoreProperties
}

/** Gradle's own signing properties, so the upload key signs the bundle without a signingConfig in build.gradle. */
export function gradleSigningArgs(keystore: KeystoreProperties, storePath: string): string[] {
  return [
    `-Pandroid.injected.signing.store.file=${storePath}`,
    `-Pandroid.injected.signing.store.password=${keystore.storePassword}`,
    `-Pandroid.injected.signing.key.alias=${keystore.keyAlias}`,
    `-Pandroid.injected.signing.key.password=${keystore.keyPassword}`,
  ]
}

/** A store build talks to a real api over https. The simulator's localhost is for dev builds only. */
export function checkReleaseApiUrl(apiUrl: string | undefined, appEnv: ReleaseEnv): string | undefined {
  if (!apiUrl)
    return `environments.${appEnv}.apiUrl is empty in app.meta.ts. Set it to the api's https address.`
  if (!/^https:\/\/[^/]+/.test(apiUrl))
    return `environments.${appEnv}.apiUrl must be an https address, not ${apiUrl}.`
  return undefined
}

/** Lines of `git status --porcelain` for the native folders. Anything there would be lost by the restore step. */
export function dirtyNativeFiles(porcelain: string): string[] {
  return porcelain.split('\n').map(line => line.trimEnd()).filter(Boolean)
}
