import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { execSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { MobileProject } from '@trapezedev/project'
import { resolveIdentity, type IdentityMeta } from '../../packages/config-capacitor/src/identity'
import { buildTrapezeConfig, deriveBuildNumber } from './lib/build-trapeze-config'
import { MIN_SDK_FOR, raiseMinSdk } from './lib/android-gradle'
import { checkFirebaseBundleId, FIREBASE_TARGETS, firebaseSources, patchAppDelegate } from './lib/firebase'
import { checkCapabilityPlugins } from './lib/native-features'

/**
 * Applies app identity (name, bundle id, version, build number, link domains)
 * to the generated ios/ and android/ projects with Trapeze.
 *
 * Run from an app directory: `pnpm native:configure`
 * Build number defaults to a timestamp; override with `BUILD_NUMBER=123`.
 */
async function main() {
  const appDir = process.cwd()
  const metaPath = join(appDir, 'app.meta.ts')
  const packageJsonPath = join(appDir, 'package.json')

  if (!existsSync(metaPath))
    throw new Error('Run this from an app directory containing app.meta.ts')

  const { appMeta } = await import(pathToFileURL(metaPath).href) as { appMeta: IdentityMeta }
  // APP_ENV=dev|staging|prod picks the bundle id and name (default prod).
  const identity = resolveIdentity(appMeta, process.env.APP_ENV)
  const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as { version: string, dependencies?: Record<string, string> }

  const problems = checkCapabilityPlugins(identity.capabilities, pkg.dependencies ?? {})
  if (problems.length > 0)
    throw new Error(`app.meta.ts and package.json disagree:\n  - ${problems.join('\n  - ')}`)

  const buildNumber = process.env.BUILD_NUMBER ? Number(process.env.BUILD_NUMBER) : deriveBuildNumber()

  const config = buildTrapezeConfig({
    appId: identity.appId,
    name: identity.name,
    version: pkg.version,
    buildNumber,
    hostname: identity.hostname,
    orientation: identity.orientation,
    tablet: identity.tablet,
    usage: identity.usage,
    capabilities: identity.capabilities,
  })

  const outDir = join(appDir, '.trapeze')
  mkdirSync(outDir, { recursive: true })
  const configPath = join(outDir, 'config.yaml')
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`)

  const projects: string[] = []
  if (existsSync(join(appDir, 'ios/App')))
    projects.push('--ios-project', 'ios/App')
  if (existsSync(join(appDir, 'android')))
    projects.push('--android-project', 'android')

  if (projects.length === 0)
    throw new Error('No native projects found. Run `pnpm cap add ios` / `pnpm cap add android` first.')

  console.log(`Applying ${identity.appId} (${identity.appEnv}) v${pkg.version} (${buildNumber}) to ${projects.filter(p => !p.startsWith('--')).join(', ')}`)

  execSync(`npx trapeze run ${resolve(configPath)} ${projects.join(' ')} -y`, {
    cwd: appDir,
    stdio: 'inherit',
  })

  if (identity.capabilities.push)
    await installFirebaseFiles(appDir, identity.appEnv, identity.appId)

  const variablesGradle = join(appDir, 'android/variables.gradle')
  if (identity.capabilities.barcode && existsSync(variablesGradle)) {
    const before = readFileSync(variablesGradle, 'utf8')
    const after = raiseMinSdk(before, MIN_SDK_FOR.barcode)
    if (after !== before) {
      writeFileSync(variablesGradle, after)
      console.log(`Raised Android minSdkVersion to ${MIN_SDK_FOR.barcode} for the barcode scanner.`)
    }
  }
}

/**
 * Push: copies this environment's Firebase files into both projects, adds the plist to the Xcode target (once) and
 * gives AppDelegate the methods the plugin needs. The copies are committed like the rest of the dev identity.
 */
async function installFirebaseFiles(appDir: string, appEnv: string, appId: string) {
  const sources = firebaseSources(appDir, appEnv)
  const android = existsSync(join(appDir, 'android'))
  const ios = existsSync(join(appDir, 'ios/App'))
  const missing = [android && !existsSync(sources.android) ? sources.android : '', ios && !existsSync(sources.ios) ? sources.ios : ''].filter(Boolean)
  if (missing.length > 0)
    throw new Error(`capabilities.push is on, but these Firebase files are missing:\n  - ${missing.join('\n  - ')}\nDownload them from the Firebase console for ${appId} (docs/native-release.md, "Push").`)

  const problems = checkFirebaseBundleId({
    android: android ? readFileSync(sources.android, 'utf8') : undefined,
    ios: ios ? readFileSync(sources.ios, 'utf8') : undefined,
  }, appId)
  if (problems.length > 0)
    throw new Error(problems.join('\n'))

  if (android)
    copyFileSync(sources.android, join(appDir, FIREBASE_TARGETS.android))

  if (ios) {
    copyFileSync(sources.ios, join(appDir, FIREBASE_TARGETS.ios))
    const project = new MobileProject(appDir, { ios: { path: 'ios/App' } })
    await project.load()
    // A no-op when the file is already in the project.
    await project.ios?.addFile(FIREBASE_TARGETS.iosProjectPath)
    await project.commit()

    const appDelegate = join(appDir, 'ios/App/App/AppDelegate.swift')
    const before = readFileSync(appDelegate, 'utf8')
    const after = patchAppDelegate(before)
    if (after !== before)
      writeFileSync(appDelegate, after)
  }
  console.log(`Installed the Firebase files for ${appId} (${appEnv}).`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
