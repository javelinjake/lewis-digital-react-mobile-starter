import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { put } from '@vercel/blob'
import { type IdentityMeta, resolveIdentity } from '../../packages/config-capacitor/src/identity'
import { deriveBuildNumber } from './lib/build-trapeze-config'
import { blobPath, type BundleRecord, readPublishEnv, sha256Hex } from './lib/ota'
import { checkReleaseApiUrl } from './lib/release'

/**
 * Publishes a live update (OTA) of the web bundle, run from the app folder:
 *
 *   pnpm ota:publish                    # prod; APP_ENV=staging for the staging app
 *
 * Builds the native bundle, zips it, uploads the zip to Vercel Blob and records it on the api, which offers it to
 * every installed shell with the same `package.json` version. Only web code changes: anything native (a plugin,
 * a permission, capacitor.config) needs a store release with a new version. See docs/ota.md.
 */

const appDir = process.cwd()

async function main() {
  const appEnv = process.env.APP_ENV?.trim() || 'prod'
  if (appEnv !== 'prod' && appEnv !== 'staging')
    throw new Error(`Live updates are for staging or prod, not "${appEnv}".`)

  const metaPath = join(appDir, 'app.meta.ts')
  if (!existsSync(metaPath))
    throw new Error('Run this from an app folder (one with app.meta.ts).')
  const { appMeta } = await import(pathToFileURL(metaPath).href) as { appMeta: IdentityMeta }
  const identity = resolveIdentity(appMeta, appEnv)
  if (!identity.capabilities.ota)
    throw new Error('capabilities.ota is off in app.meta.ts. Turn it on, add @capgo/capacitor-updater, and ship a store build first (docs/ota.md).')
  const apiProblem = checkReleaseApiUrl(identity.apiUrl, appEnv)
  if (apiProblem)
    throw new Error(apiProblem)
  const { secret, blobToken } = readPublishEnv(process.env)

  const { version } = JSON.parse(readFileSync(join(appDir, 'package.json'), 'utf8')) as { version: string }
  const build = process.env.BUILD_NUMBER?.trim() || String(deriveBuildNumber())
  const release = `${version}+${build}`
  console.log(`Publishing ${release} for ${identity.appId} shells on ${version}, via ${identity.apiUrl}`)

  const built = spawnSync('pnpm', ['build:native'], {
    cwd: appDir,
    stdio: 'inherit',
    env: { ...process.env, APP_ENV: appEnv, BUILD_NUMBER: build, VITE_DATA_MODE: 'live' },
  })
  if (built.status !== 0)
    throw new Error('The build failed; nothing was published.')

  const outDir = join(appDir, '.ota')
  mkdirSync(outDir, { recursive: true })
  const zipPath = join(outDir, `${identity.appId}-${release}.zip`)
  rmSync(zipPath, { force: true })
  // Files at the root of the zip, as the updater expects (index.html at the top).
  execFileSync('zip', ['-qrX', zipPath, '.'], { cwd: join(appDir, 'dist') })
  const zip = readFileSync(zipPath)
  const checksum = sha256Hex(zip)

  const { url } = await put(blobPath(identity.appId, release), zip, {
    access: 'public',
    token: blobToken,
    contentType: 'application/zip',
    addRandomSuffix: false,
  })

  const record: BundleRecord = { appId: identity.appId, nativeVersion: version, version: release, url, checksum }
  const response = await fetch(`${identity.apiUrl!.replace(/\/+$/, '')}/api/ota/bundles`, {
    method: 'POST',
    headers: { 'authorization': `Bearer ${secret}`, 'content-type': 'application/json' },
    body: JSON.stringify(record),
  })
  if (!response.ok)
    throw new Error(`The zip is uploaded (${url}) but the api refused to record it: ${response.status} ${await response.text()}`)

  console.log([
    '',
    `Live: ${release} (${(zip.length / 1024).toFixed(0)} KB, sha256 ${checksum.slice(0, 12)}…)`,
    `Installed ${identity.name} apps on ${version} download it in the background and switch the next time they are backgrounded.`,
    'To roll back: api admin > App bundles > untick Active on this one. Devices return to the previous active bundle, or the store one.',
  ].join('\n'))
}

main().catch((error) => {
  console.error(`\n${error instanceof Error ? error.message : error}`)
  process.exit(1)
})
