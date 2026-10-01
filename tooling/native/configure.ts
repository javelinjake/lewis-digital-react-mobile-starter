import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { execSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { buildTrapezeConfig, deriveBuildNumber } from './lib/build-trapeze-config'

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

  const { appMeta } = await import(pathToFileURL(metaPath).href) as {
    appMeta: { appId: string, name: string, hostname?: string }
  }
  const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as { version: string }

  const buildNumber = process.env.BUILD_NUMBER ? Number(process.env.BUILD_NUMBER) : deriveBuildNumber()

  const config = buildTrapezeConfig({
    appId: appMeta.appId,
    name: appMeta.name,
    version: pkg.version,
    buildNumber,
    hostname: appMeta.hostname,
    usage: {
      camera: `${appMeta.name} uses the camera to capture photos you attach to your records.`,
      photos: `${appMeta.name} accesses your photo library so you can attach existing photos.`,
    },
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

  console.log(`Applying ${appMeta.appId} v${pkg.version} (${buildNumber}) to ${projects.filter(p => !p.startsWith('--')).join(', ')}`)

  execSync(`npx trapeze run ${resolve(configPath)} ${projects.join(' ')} -y`, {
    cwd: appDir,
    stdio: 'inherit',
  })
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
