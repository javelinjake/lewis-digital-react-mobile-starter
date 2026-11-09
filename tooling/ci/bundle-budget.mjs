// Fails when the JavaScript a first visit must download is over the app's budget.
// "Initial" means the entry script plus everything index.html preloads: what blocks the first screen.
// Lazy route chunks are not counted, which is the point of splitting them.
// Usage: node tooling/ci/bundle-budget.mjs apps/template/app [--budget 170]   (gzipped KB; default from apps.config.json or 170)
import { appendFileSync, existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { argv, env, exit } from 'node:process'
import { gzipSync } from 'node:zlib'

const appDir = resolve(argv[2] ?? '.')
const flag = name => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : '')

const root = new URL('../../', import.meta.url)
const registry = JSON.parse(readFileSync(new URL('tooling/apps/apps.config.json', root), 'utf8')).apps
const entry = registry.find(app => resolve(root.pathname, app.path) === appDir)
const budget = Number(flag('--budget') || entry?.budget?.initialJsKb || 170)

const indexPath = resolve(appDir, 'dist/index.html')
if (!existsSync(indexPath)) {
  console.error(`No build found at ${indexPath}. Build the app first.`)
  exit(1)
}

const html = readFileSync(indexPath, 'utf8')
const files = new Set()
for (const match of html.matchAll(/(?:src|href)="(\/[^"]+\.js)"/g))
  files.add(match[1])

const sizes = [...files].map((file) => {
  const bytes = gzipSync(readFileSync(resolve(appDir, 'dist', `.${file}`)), { level: 9 }).length
  return { file, kb: bytes / 1024 }
}).sort((a, b) => b.kb - a.kb)

const total = sizes.reduce((sum, item) => sum + item.kb, 0)
const ok = total <= budget
const table = [
  `### Bundle budget: ${entry?.packageName ?? appDir}`,
  '',
  `${ok ? '✅' : '❌'} Initial JavaScript is **${total.toFixed(1)} KB** gzipped. Budget ${budget} KB.`,
  '',
  '| File | KB gzipped |',
  '| --- | --- |',
  ...sizes.map(item => `| \`${item.file}\` | ${item.kb.toFixed(1)} |`),
  '',
].join('\n')

console.log(table)
if (env.GITHUB_STEP_SUMMARY)
  appendFileSync(env.GITHUB_STEP_SUMMARY, `${table}\n`)
if (!ok)
  exit(1)
