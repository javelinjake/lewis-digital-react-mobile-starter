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
  /** The api for this environment. Native builds call it directly. */
  apiUrl?: string
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
  }
}
