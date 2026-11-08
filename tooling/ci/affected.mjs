// Lists the apps a change affects, as a JSON array for a GitHub Actions matrix.
//   --kind app  (default) client apps that have a test:e2e script
//   --kind api            backend apps that have a test:integration script
// Set TURBO_SCM_BASE to the commit to compare against. Pass --all to list everything, or --only <package> for one.
import { execFileSync } from 'node:child_process'
import { appendFileSync, readFileSync } from 'node:fs'
import { argv, env } from 'node:process'

const root = new URL('../../', import.meta.url)
const { apps } = JSON.parse(readFileSync(new URL('tooling/apps/apps.config.json', root), 'utf8'))

const flag = name => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : '')
const kind = flag('--kind') || 'app'
const script = kind === 'api' ? 'test:integration' : 'test:e2e'

const candidates = apps
  .map(entry => (kind === 'api' ? entry.api && { ...entry.api, slug: entry.slug } : { packageName: entry.packageName, path: entry.path, slug: entry.slug }))
  .filter(Boolean)
  .filter((entry) => {
    const pkg = JSON.parse(readFileSync(new URL(`${entry.path}/package.json`, root), 'utf8'))
    return Boolean(pkg.scripts?.[script])
  })

const only = flag('--only')
let selected = candidates
if (only) {
  selected = candidates.filter(entry => entry.packageName === only)
}
else if (!argv.includes('--all')) {
  const output = execFileSync('pnpm', ['exec', 'turbo', 'ls', '--affected', '--output=json'], { encoding: 'utf8' })
  const affected = new Set(JSON.parse(output.slice(output.indexOf('{'))).packages.items.map(item => item.name))
  selected = candidates.filter(entry => affected.has(entry.packageName))
}

const matrix = JSON.stringify(selected.map(entry => ({ name: entry.packageName, slug: entry.slug, path: entry.path })))
console.log(matrix)
if (env.GITHUB_OUTPUT)
  appendFileSync(env.GITHUB_OUTPUT, `${kind === 'api' ? 'apis' : 'apps'}=${matrix}\n`)
