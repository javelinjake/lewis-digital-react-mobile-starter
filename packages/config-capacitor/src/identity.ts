/**
 * One place that turns an app's `app.meta.ts` and the `APP_ENV` it is built for into the identity the native project,
 * Capacitor config and tests all use, so they cannot disagree.
 *
 * The bundle id is the part that matters most: `dev`, `staging` and `prod` builds get different ids, so all three
 * install side by side on one phone and each talks to its own backend and store products.
 */
export type AppEnv = 'dev' | 'staging' | 'prod'
export type AppOrientation = 'portrait' | 'landscape' | 'any'

export interface EnvironmentMeta {
  /** Appended to `appId`. Defaults to `.dev` and `.staging`; production has none. */
  appIdSuffix?: string
  /** Appended to the display name. Defaults to " Dev" and " Staging". */
  nameSuffix?: string
  /**
   * The api for this environment. Native builds call it directly, so a native build uses this when `VITE_API_URL` is
   * not set. Web builds ignore it: they call `/api` on their own origin.
   */
  apiUrl?: string
  /**
   * SHA-256 fingerprints of the Android signing certificates for this bundle id, for `assetlinks.json` (App Links).
   * Use the **app signing key** from Play Console (Test and release > App integrity), plus the upload key if you
   * install upload-signed builds directly.
   */
  androidSha256?: string[]
}

/**
 * Native features that need a permission, an entitlement, a config file or a store privacy answer. Each one is off
 * until the app turns it on here and adds the matching plugin to its `package.json`. `native:configure` then writes
 * the permission strings, entitlements and manifest entries, and fails if the plugin is missing.
 */
export interface NativeCapabilities {
  /** Remote push through Firebase Cloud Messaging. Needs the Firebase files in `firebase/<env>/`. */
  push?: boolean
  /** Location while the app is open. */
  location?: boolean
  /** Face ID / Touch ID / fingerprint to unlock or confirm. */
  biometrics?: boolean
  /** Barcode and QR scanning with the camera. Raises Android's minimum version to 8.0 (API 26), which the scanner needs. */
  barcode?: boolean
  /** Low-latency sound effects and music. */
  audio?: boolean
  /** Pick any file (documents, not only photos). */
  filePicker?: boolean
  /** Live updates of the web bundle without a store release. */
  ota?: boolean
}

export type NativeCapability = keyof NativeCapabilities

export const NATIVE_CAPABILITIES: readonly NativeCapability[] = ['push', 'location', 'biometrics', 'barcode', 'audio', 'filePicker', 'ota']

/** Permission prompt wording. Apple reviews these: say what the app does with the access, in the app's own words. */
export interface UsageStrings {
  camera?: string
  photos?: string
  location?: string
  faceId?: string
}

export interface IdentityMeta {
  name: string
  shortName: string
  appId: string
  hostname?: string
  environments?: Partial<Record<AppEnv, EnvironmentMeta>>
  orientation?: AppOrientation
  /** False: the app is built for phones only (an iPad runs it letterboxed) and gets no tablet test project. */
  tablet?: boolean
  /** Apple Developer team id (10 characters, Membership details). Used for Universal Links. */
  appleTeamId?: string
  capabilities?: NativeCapabilities
  usage?: UsageStrings
}

export interface ResolvedIdentity {
  appEnv: AppEnv
  appId: string
  name: string
  shortName: string
  hostname?: string
  apiUrl?: string
  orientation: AppOrientation
  tablet: boolean
  appleTeamId?: string
  androidSha256: string[]
  capabilities: Required<NativeCapabilities>
  usage: Required<UsageStrings>
}

const APP_ENVS: readonly AppEnv[] = ['dev', 'staging', 'prod']

const DEFAULTS: Record<AppEnv, Required<Pick<EnvironmentMeta, 'appIdSuffix' | 'nameSuffix'>>> = {
  dev: { appIdSuffix: '.dev', nameSuffix: ' Dev' },
  staging: { appIdSuffix: '.staging', nameSuffix: ' Staging' },
  prod: { appIdSuffix: '', nameSuffix: '' },
}

/** `APP_ENV` is `prod` unless set, so a forgotten variable can never ship a dev-named store build. */
export function resolveAppEnv(raw: string | undefined): AppEnv {
  const value = (raw?.trim() || 'prod') as AppEnv
  if (!APP_ENVS.includes(value))
    throw new Error(`APP_ENV must be one of ${APP_ENVS.join(', ')}, not "${raw}".`)
  return value
}

export function resolveIdentity(meta: IdentityMeta, rawEnv?: string): ResolvedIdentity {
  const appEnv = resolveAppEnv(rawEnv)
  const environment = meta.environments?.[appEnv] ?? {}
  const defaults = DEFAULTS[appEnv]

  return {
    appEnv,
    appId: `${meta.appId}${environment.appIdSuffix ?? defaults.appIdSuffix}`,
    name: `${meta.name}${environment.nameSuffix ?? defaults.nameSuffix}`,
    shortName: meta.shortName,
    hostname: meta.hostname,
    apiUrl: environment.apiUrl,
    orientation: meta.orientation ?? 'any',
    tablet: meta.tablet ?? true,
    appleTeamId: meta.appleTeamId?.trim() || undefined,
    androidSha256: environment.androidSha256 ?? [],
    capabilities: resolveCapabilities(meta.capabilities),
    usage: resolveUsage(meta.name, meta.usage),
  }
}

export function resolveCapabilities(capabilities: NativeCapabilities = {}): Required<NativeCapabilities> {
  return Object.fromEntries(NATIVE_CAPABILITIES.map(key => [key, capabilities[key] === true])) as Required<NativeCapabilities>
}

/**
 * Defaults name the app (the production name, so a staging build asks the same question). They are deliberately
 * generic; replace them with the app's real reason before review.
 */
function resolveUsage(name: string, usage: UsageStrings = {}): Required<UsageStrings> {
  return {
    camera: usage.camera ?? `${name} uses the camera to take photos and scan codes you choose to add.`,
    photos: usage.photos ?? `${name} accesses your photo library so you can attach existing photos.`,
    location: usage.location ?? `${name} uses your location while the app is open to show what is near you.`,
    faceId: usage.faceId ?? `${name} uses Face ID to confirm it is you.`,
  }
}
