import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { type IdentityMeta, resolveIdentity } from '../../packages/config-capacitor/src/identity'
import { deriveBuildNumber } from './lib/build-trapeze-config'
import { checkReleaseApiUrl, dirtyNativeFiles, gradleSigningArgs, parseKeystoreProperties, parseReleaseArgs } from './lib/release'

/**
 * A store build from your Mac, run from the app folder:
 *
 *   pnpm release:android                 # signed .aab for Play (prod); APP_ENV=staging for the staging app
 *   pnpm release:ios                     # prepares the prod build and opens Xcode to Archive
 *
 * Builds the web bundle against the environment's api, applies that environment's bundle id, name and build number
 * to the native projects, and syncs. The committed ios/ and android/ folders carry the dev identity, so afterwards
 * `pnpm native:restore` puts both back (the Android release does it for you; iOS waits until you have archived).
 * Uploading stays a manual step: Play Console for the .aab, Xcode's Organizer for iOS.
 */

const appDir = process.cwd()
/** Set once the native projects may have been changed, so a failure says how to put them back. */
let touchedNative = false

function run(command: string, args: string[], env: Record<string, string> = {}, cwd = appDir) {
  console.log(`\n$ ${command} ${args.map(arg => arg.includes('password') ? arg.replace(/=.*/, '=***') : arg).join(' ')}`)
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', env: { ...process.env, ...env } })
  if (result.status !== 0)
    throw new Error(`${command} ${args[0] ?? ''} failed (exit ${result.status ?? result.signal}).`)
}

function git(args: string[]) {
  return execFileSync('git', args, { cwd: appDir, encoding: 'utf8' })
}

export function restoreNativeProjects(dirs: string[]) {
  const present = dirs.filter(dir => existsSync(join(appDir, dir)))
  if (present.length === 0)
    return
  git(['checkout', '--', ...present])
  // Only files a release created: the script refuses to start with uncommitted changes in these folders.
  git(['clean', '-fdq', '--', ...present])
  console.log(`Restored ${present.join(' and ')} to the committed (dev) identity.`)
}

/**
 * Android Studio's bundled Java (Gradle needs 21) and its SDK, when JAVA_HOME / ANDROID_HOME are not set and the
 * project has no local.properties. Both are where Android Studio puts them on a Mac.
 */
function androidToolchain(): Record<string, string> {
  const env: Record<string, string> = {}
  const java = '/Applications/Android Studio.app/Contents/jbr/Contents/Home'
  if (!process.env.JAVA_HOME && existsSync(java))
    env.JAVA_HOME = java
  const sdk = join(process.env.HOME ?? '', 'Library/Android/sdk')
  if (!process.env.ANDROID_HOME && !existsSync(join(appDir, 'android/local.properties')) && existsSync(sdk))
    env.ANDROID_HOME = sdk
  return env
}

async function main() {
  if (process.argv[2] === 'restore') {
    restoreNativeProjects(['ios', 'android'])
    return
  }

  const { platform, appEnv } = parseReleaseArgs(process.argv.slice(2), process.env.APP_ENV)
  const metaPath = join(appDir, 'app.meta.ts')
  if (!existsSync(metaPath))
    throw new Error('Run this from an app folder (one with app.meta.ts), e.g. `pnpm --filter @ld/app-<slug> release:android`.')
  if (!existsSync(join(appDir, platform === 'ios' ? 'ios/App' : 'android')))
    throw new Error(`This app has no ${platform} project yet. Run \`pnpm exec cap add ${platform}\` first (docs/native.md).`)
  if (platform === 'ios' && process.platform !== 'darwin')
    throw new Error('iOS builds need a Mac with Xcode.')

  const { appMeta } = await import(pathToFileURL(metaPath).href) as { appMeta: IdentityMeta }
  const identity = resolveIdentity(appMeta, appEnv)
  const apiProblem = checkReleaseApiUrl(identity.apiUrl, appEnv)
  if (apiProblem)
    throw new Error(apiProblem)

  const dirty = dirtyNativeFiles(git(['status', '--porcelain', '--', 'ios', 'android']))
  if (dirty.length > 0)
    throw new Error(`Commit or stash these first; the release restores ios/ and android/ afterwards and would lose them:\n${dirty.join('\n')}`)

  let signing: string[] = []
  if (platform === 'android') {
    const propertiesPath = join(appDir, 'android/keystore.properties')
    if (!existsSync(propertiesPath))
      throw new Error('android/keystore.properties is missing. See docs/native-release.md, "Android signing".')
    const keystore = parseKeystoreProperties(readFileSync(propertiesPath, 'utf8'))
    const storePath = resolve(appDir, 'android', keystore.storeFile)
    if (!existsSync(storePath))
      throw new Error(`The upload keystore is not at ${storePath} (storeFile in android/keystore.properties).`)
    signing = gradleSigningArgs(keystore, storePath)
  }

  const buildNumber = process.env.BUILD_NUMBER?.trim() || String(deriveBuildNumber())
  const env = { APP_ENV: appEnv, BUILD_NUMBER: buildNumber, VITE_DATA_MODE: 'live' }
  console.log(`Building ${identity.name} (${identity.appId}) for ${platform}, build ${buildNumber}, api ${identity.apiUrl}`)

  touchedNative = true
  try {
    run('pnpm', ['build:native'], env)
    run('pnpm', ['native:configure'], env)
    run('npx', ['cap', 'sync', platform], env)

    if (platform === 'android') {
      run('./gradlew', ['bundleRelease', ...signing], androidToolchain(), join(appDir, 'android'))
      const aab = join(appDir, 'android/app/build/outputs/bundle/release/app-release.aab')
      console.log(`\nSigned bundle: ${aab}\nUpload it in Play Console > ${identity.name} > Test and release > (a track) > Create new release.`)
    }
  }
  finally {
    // native:configure touched both projects. iOS keeps the release identity until it is archived; for Android
    // the build is done, so both go back straight away.
    if (platform === 'android')
      restoreNativeProjects(['ios', 'android'])
  }

  if (platform === 'ios') {
    run('npx', ['cap', 'open', 'ios'])
    console.log([
      '',
      `Xcode is open with ${identity.appId}, build ${buildNumber}. In Xcode:`,
      '  1. Choose "Any iOS Device (arm64)" as the destination.',
      '  2. Product > Archive.',
      '  3. In the Organizer: Distribute App > App Store Connect > Upload.',
      'Then run `pnpm native:restore` to put ios/ back to the dev identity.',
    ].join('\n'))
  }
}

main().catch((error) => {
  console.error(`\n${error instanceof Error ? error.message : error}`)
  if (touchedNative)
    console.error('If ios/ or android/ were left with a release identity, `pnpm native:restore` puts them back.')
  process.exit(1)
})
