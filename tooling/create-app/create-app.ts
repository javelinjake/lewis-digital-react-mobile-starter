import { execSync } from 'node:child_process'
import process from 'node:process'
import { parseArgs } from 'node:util'
import { getRepoRoot } from '../lib/repo'
import { type AppKind, scaffold, type ScaffoldOptions, type WebTarget } from './lib/scaffold'

/**
 * Creates a new app from the template: a client (apps/<slug>/app) and its backend (apps/<slug>/api), plus a pure
 * rules package (apps/<slug>/core) for a game.
 *
 *   pnpm create:app -- --name "Pixel Pitch" --kind game --bundle-id uk.co.lewisdigital.pixelpitch
 *
 * It only prints what it would do until you add --write.
 */
const USAGE = `Usage: pnpm create:app -- --name "My App" [options] [--write]

  --name         Display name (required)
  --slug         Folder and package name part. Default: the name, lower-cased with dashes
  --kind         app (default) or game. A game also gets a core rules package and an art folder
  --web          pwa (default for app), playtest (default for game: protected web build) or none
  --bundle-id    Reverse-DNS id. Default: uk.co.lewisdigital.<slug>
  --hostname     Production domain for app links. Can be filled in later
  --theme        Brand colour, #rrggbb. Default #ffffff
  --background   Splash and page colour, #rrggbb. Default: the theme colour
  --write        Make the files. Without it, only shows the plan
  --native       After --write, also install, add the iOS and Android projects and apply the identity`

// pnpm forwards the `--` in `pnpm create:app -- --name x`, which parseArgs would read as "no more options".
const args = process.argv.slice(2).filter((arg, index) => !(index === 0 && arg === '--'))

const { values } = parseArgs({
  args,
  options: {
    'name': { type: 'string' },
    'slug': { type: 'string' },
    'kind': { type: 'string' },
    'web': { type: 'string' },
    'bundle-id': { type: 'string' },
    'hostname': { type: 'string' },
    'theme': { type: 'string' },
    'background': { type: 'string' },
    'write': { type: 'boolean' },
    'native': { type: 'boolean' },
    'help': { type: 'boolean' },
  },
  allowPositionals: false,
})

if (values.help || !values.name) {
  console.log(USAGE)
  process.exit(values.help ? 0 : 1)
}

const kind = (values.kind ?? 'app') as AppKind
if (kind !== 'app' && kind !== 'game') {
  console.error(`--kind must be app or game, not "${values.kind}".`)
  process.exit(1)
}
const web = (values.web ?? (kind === 'game' ? 'playtest' : 'pwa')) as WebTarget
if (!['pwa', 'playtest', 'none'].includes(web)) {
  console.error(`--web must be pwa, playtest or none, not "${values.web}".`)
  process.exit(1)
}

const slug = values.slug ?? values.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const theme = values.theme ?? '#ffffff'

const options: ScaffoldOptions = {
  name: values.name,
  slug,
  kind,
  web,
  appId: values['bundle-id'] ?? `uk.co.lewisdigital.${slug.replace(/-/g, '')}`,
  hostname: values.hostname ?? '',
  themeColor: theme,
  backgroundColor: values.background ?? theme,
  orientation: kind === 'game' ? 'portrait' : 'any',
  tablet: kind !== 'game',
}

try {
  const root = getRepoRoot()
  const write = values.write === true
  const result = scaffold(root, options, { dryRun: !write })

  console.log(`${write ? 'Created' : 'Would create'} ${options.name} (${kind}, ${options.appId}):`)
  for (const path of result.created)
    console.log(`  + ${path}/`)
  for (const path of result.edited)
    console.log(`  ~ ${path}`)

  if (!write) {
    console.log('\nThis was a dry run. Add --write to make the files.')
    process.exit(0)
  }

  console.log('\nInstalling...')
  execSync('pnpm install', { cwd: root, stdio: 'inherit' })

  if (values.native) {
    const app = `@ld/app-${slug}`
    execSync(`pnpm --filter ${app} exec cap add ios`, { cwd: root, stdio: 'inherit' })
    execSync(`pnpm --filter ${app} exec cap add android`, { cwd: root, stdio: 'inherit' })
    execSync(`pnpm --filter ${app} native:configure`, { cwd: root, stdio: 'inherit' })
  }

  const db = slug.replace(/-/g, '_')
  console.log(`
Next:
  1. Create the databases:   pnpm db:dev -- ${db}      (or: docker exec ld-mobile-postgres createdb -U payload ${db} ${db}_test)
  2. Run the backend:        pnpm --filter @ld/api-${slug} cms:migrate && pnpm --filter @ld/api-${slug} dev
  3. Run the app:            pnpm --filter @ld/app-${slug} dev
  4. Fill in app.meta.ts: hostname, the staging and prod api addresses, and which sign-in methods to offer.
  5. Add the Vercel projects (see docs/deployment.md) and set API_ORIGIN on the app project.`)
}
catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}
