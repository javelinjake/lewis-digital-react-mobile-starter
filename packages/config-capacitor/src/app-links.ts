import { type IdentityMeta, resolveIdentity } from './identity.ts'

/**
 * The two files a web host serves so phones open its links in the app instead of the browser:
 * `/.well-known/apple-app-site-association` (Universal Links, and password autofill through `webcredentials`) and
 * `/.well-known/assetlinks.json` (Android App Links). Built from `app.meta.ts` for every APP_ENV, so a link on the
 * production site opens whichever of the dev, staging and prod apps is installed.
 *
 * A file is left out until its inputs exist: Apple needs `appleTeamId`, Android needs `androidSha256` for at least
 * one environment. The web build emits whatever this returns (see `createViteConfig`'s `appLinks`).
 */
export function buildAppLinkFiles(meta: IdentityMeta): Record<string, string> {
  const environments = (['prod', 'staging', 'dev'] as const).map(env => resolveIdentity(meta, env))
  const files: Record<string, string> = {}

  const team = meta.appleTeamId?.trim()
  if (team) {
    const appIds = environments.map(identity => `${team}.${identity.appId}`)
    files['.well-known/apple-app-site-association'] = `${JSON.stringify({
      applinks: { details: [{ appIDs: appIds, components: [{ '/': '/*' }] }] },
      webcredentials: { apps: appIds },
    }, null, 2)}\n`
  }

  const android = environments.filter(identity => identity.androidSha256.length > 0)
  if (android.length > 0) {
    files['.well-known/assetlinks.json'] = `${JSON.stringify(android.map(identity => ({
      relation: ['delegate_permission/common.handle_all_urls', 'delegate_permission/common.get_login_creds'],
      target: { namespace: 'android_app', package_name: identity.appId, sha256_cert_fingerprints: [...identity.androidSha256] },
    })), null, 2)}\n`
  }

  return files
}
