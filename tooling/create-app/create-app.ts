import { execSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { getRepoRoot } from '../lib/repo'
import { bootstrapProjectCms } from '../directus-template/bootstrap-project-cms'

interface AppsRegistry {
  apps: Array<{
    slug: string
    packageName: string
    path: string
    deployable: boolean
    directusTemplate?: string
    deploy?: {
      staging?: { caproverApp: string }
      production?: { caproverApp: string }
    }
  }>
}

async function prompt(question: string, defaultValue = ''): Promise<string> {
  const rl = createInterface({ input, output })
  const answer = await rl.question(defaultValue ? `${question} [${defaultValue}]: ` : `${question}: `)
  await rl.close()
  return answer.trim() || defaultValue
}

function toSlug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function toBundleSegment(slug: string): string {
  return slug.replace(/-/g, '')
}

function isValidAppId(value: string): boolean {
  return /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/i.test(value)
}

function escapeSingleQuotes(value: string): string {
  return value.replace(/'/g, '\\\'')
}

function writeAppMeta(targetPath: string, meta: { name: string, shortName: string, appId: string, hostname: string }) {
  writeFileSync(join(targetPath, 'app.meta.ts'), [
    '/**',
    ' * Single source of truth for identity shared by the web manifest, Capacitor',
    ' * config and native project configuration.',
    ' */',
    'export const appMeta = {',
    `  name: '${escapeSingleQuotes(meta.name)}',`,
    `  shortName: '${escapeSingleQuotes(meta.shortName)}',`,
    `  description: '${escapeSingleQuotes(meta.name)} mobile app.',`,
    `  appId: '${meta.appId}',`,
    `  hostname: '${meta.hostname}',`,
    '  themeColor: \'#ffffff\',',
    '  backgroundColor: \'#ffffff\',',
    '} as const',
    '',
  ].join('\n'))
}

async function main() {
  const repoRoot = getRepoRoot()
  const displayName = await prompt('App display name', 'My App')
  const slug = await prompt('App slug', toSlug(displayName))
  const packageName = await prompt('Package name', `@ld/app-${slug}`)
  const appTitle = await prompt('Default app title', displayName)
  const version = await prompt('Initial version', '0.1.0')
  const shortName = await prompt('Home screen name (12 chars max)', appTitle.slice(0, 12))
  let appId = await prompt('Bundle / application ID', `uk.co.lewisdigital.${toBundleSegment(slug)}`)
  while (!isValidAppId(appId))
    appId = await prompt('Invalid ID. Use reverse-DNS like uk.co.lewisdigital.myapp', `uk.co.lewisdigital.${toBundleSegment(slug)}`)
  const hostname = await prompt('Production hostname for app links (blank to skip)', '')
  const includeCms = (await prompt('Include Directus CMS project? (y/n)', 'y')).toLowerCase() !== 'n'
  const addNative = (await prompt('Generate iOS and Android projects now? (y/n)', 'n')).toLowerCase() === 'y'

  const targetPath = join(repoRoot, 'apps', slug)
  if (existsSync(targetPath))
    throw new Error(`App already exists at ${targetPath}`)

  cpSync(join(repoRoot, 'apps/template'), targetPath, { recursive: true })
  const packageJsonPath = join(targetPath, 'package.json')
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as { name?: string, version?: string }
  packageJson.name = packageName
  packageJson.version = version
  writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`)

  writeFileSync(join(targetPath, 'src/config/app.config.ts'), `export const appConfig = {\n  name: '${escapeSingleQuotes(appTitle)}',\n  projectId: '${slug}',\n  defaultRoute: '/home',\n  layout: 'tabs' as const,\n}\n`)
  writeAppMeta(targetPath, { name: appTitle, shortName, appId, hostname })
  const indexHtml = join(targetPath, 'index.html')
  writeFileSync(indexHtml, readFileSync(indexHtml, 'utf8').replace('<title>Lewis Digital App</title>', `<title>${appTitle}</title>`))
  for (const relative of ['public/.well-known/apple-app-site-association', 'public/.well-known/assetlinks.json']) {
    const file = join(targetPath, relative)
    if (existsSync(file))
      writeFileSync(file, readFileSync(file, 'utf8').replaceAll('uk.co.lewisdigital.template', appId))
  }
  rmSync(join(targetPath, 'ios'), { recursive: true, force: true })
  rmSync(join(targetPath, 'android'), { recursive: true, force: true })

  const registryPath = join(repoRoot, 'tooling/apps/apps.config.json')
  const registry = JSON.parse(readFileSync(registryPath, 'utf8')) as AppsRegistry
  registry.apps.push({
    slug,
    packageName,
    path: `apps/${slug}`,
    deployable: false,
    ...(includeCms ? { directusTemplate: `cms/projects/${slug}` } : {}),
  })
  writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`)

  if (includeCms) {
    mkdirSync(join(repoRoot, 'cms/projects', slug), { recursive: true })
    const setupCms = (await prompt('Bootstrap Directus project marker now? (y/n)', 'y')).toLowerCase() !== 'n'
    if (setupCms) {
      await bootstrapProjectCms({
        slug,
        packageName,
        appRelativePath: `apps/${slug}`,
        platform: 'react',
      })
    }
  }

  if (addNative) {
    execSync('pnpm install', { cwd: repoRoot, stdio: 'inherit' })
    execSync(`pnpm --filter ${packageName} exec cap add ios`, { cwd: repoRoot, stdio: 'inherit' })
    execSync(`pnpm --filter ${packageName} exec cap add android`, { cwd: repoRoot, stdio: 'inherit' })
    execSync(`pnpm --filter ${packageName} native:configure`, { cwd: repoRoot, stdio: 'inherit' })
  }

  console.log(`\nCreated app at apps/${slug}`)
  console.log(`App ID: ${appId}`)
  console.log('Next: pnpm install && pnpm --filter ' + packageName + ' dev')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
