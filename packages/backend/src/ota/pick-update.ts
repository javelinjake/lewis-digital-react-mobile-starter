/**
 * The decision behind `POST /api/ota/check`, kept pure so it is tested on its own. The device sends what it is
 * running; the answer is the bundle it should be on.
 *
 * The version gate: a bundle is only ever offered to shells whose native version (the app's `package.json` version
 * when it was built for the store) equals the bundle's `nativeVersion`. A bundle that needs a newer plugin or
 * permission therefore never reaches an older shell, and a version under store review has no bundles at all until
 * one is published for it.
 */

export interface BundleRow {
  appId: string
  nativeVersion: string
  version: string
  url: string
  checksum: string
  active?: boolean | null
  createdAt: string
}

export interface UpdateCheck {
  /** Bundle id, e.g. `uk.co.example.app.staging`. */
  app_id?: unknown
  /** The native version of the installed shell. */
  version_build?: unknown
  /** The bundle the device is running now; `builtin` for the one shipped in the store build. */
  version_name?: unknown
  platform?: unknown
}

export type UpdateAnswer
  = | { version: string, url: string, checksum: string }
    | { version: 'builtin' }
    | { kind: 'up_to_date', error: 'no_new_version_available', message: string }
    | { kind: 'failed', error: 'invalid_request', message: string }

const text = (value: unknown, max = 200) => (typeof value === 'string' && value.length > 0 && value.length <= max ? value : undefined)

export function pickUpdate(check: UpdateCheck, bundles: readonly BundleRow[]): UpdateAnswer {
  const appId = text(check.app_id)
  const nativeVersion = text(check.version_build, 50)
  const current = text(check.version_name, 100) ?? 'builtin'
  if (!appId || !nativeVersion)
    return { kind: 'failed', error: 'invalid_request', message: 'app_id and version_build are required.' }

  const latest = bundles
    .filter(bundle => bundle.active !== false && bundle.appId === appId && bundle.nativeVersion === nativeVersion)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]

  if (!latest) {
    // Nothing live for this shell. A device still on a downloaded bundle goes back to the one it shipped with, so
    // switching a bad bundle off in the admin panel rolls everyone back.
    return current === 'builtin'
      ? { kind: 'up_to_date', error: 'no_new_version_available', message: 'Running the version from the store.' }
      : { version: 'builtin' }
  }

  if (latest.version === current)
    return { kind: 'up_to_date', error: 'no_new_version_available', message: 'Running the latest bundle.' }

  return { version: latest.version, url: latest.url, checksum: latest.checksum }
}
