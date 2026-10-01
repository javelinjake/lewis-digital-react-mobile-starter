import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { getRepoRoot } from '../lib/repo'
import { bootstrapProjectCms } from './bootstrap-project-cms'

const slugFlag = process.argv.indexOf('--site')
const slug = slugFlag >= 0 ? process.argv[slugFlag + 1] : ''

if (!slug) {
  console.error('Pass the project slug (e.g. pnpm directus:bootstrap-project -- --site acme)')
  process.exit(1)
}

const registry = JSON.parse(readFileSync(join(getRepoRoot(), 'tooling/apps/apps.config.json'), 'utf8')) as {
  apps: Array<{ slug: string, packageName: string, path: string }>
}
const app = registry.apps.find(entry => entry.slug === slug)

if (!app) {
  console.error(`No app registered for slug "${slug}"`)
  process.exit(1)
}

bootstrapProjectCms({
  slug: app.slug,
  packageName: app.packageName,
  appRelativePath: app.path,
  platform: 'react',
}).catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
