// Runs Lighthouse (mobile) against a running web build and fails if any score is below the minimum.
// Usage: node tooling/ci/lighthouse.mjs --app @ld/app-template --base-url http://localhost:4300
// Locally, set CHROME_PATH to a Chrome or Chromium binary if Google Chrome is not installed.
//
// Screens behind sign-in are reached with `?mock-user=ada`, which the mock data mode understands. Lighthouse
// therefore needs a build made with VITE_DATA_MODE=mock VITE_ALLOW_MOCK_BUILD=1 (never deployed). `/login` works
// in either mode.
import { appendFileSync, readFileSync } from 'node:fs'
import { argv, env, exit } from 'node:process'
import * as chromeLauncher from 'chrome-launcher'
import lighthouse from 'lighthouse'

const args = Object.fromEntries(argv.slice(2).reduce((pairs, value, index, list) => {
  if (value.startsWith('--'))
    pairs.push([value.slice(2), list[index + 1]])
  return pairs
}, []))

const config = JSON.parse(readFileSync(new URL('./lighthouse.config.json', import.meta.url), 'utf8'))
const app = args.app ?? 'default'
const baseUrl = (args['base-url'] ?? 'http://localhost:4300').replace(/\/$/, '')
const paths = config.paths[app] ?? config.paths.default
// An app can have its own floors under `appMinimums`, for example while a screen is being sped up.
const minimums = { ...config.minimumScores, ...config.appMinimums?.[app] }
const categories = Object.keys(minimums)
const labels = { 'performance': 'Performance', 'accessibility': 'Accessibility', 'best-practices': 'Best practices', 'seo': 'SEO' }

const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless=new', '--no-sandbox'] })
const rows = []
try {
  // Warm up: the first visit to a fresh server fills caches, which real visitors never wait for.
  // Load each page once without scoring it.
  for (const path of paths)
    await lighthouse(`${baseUrl}${path}`, { port: chrome.port, logLevel: 'error', onlyCategories: ['performance'], formFactor: 'mobile' })

  // Scores vary from run to run, so each page is measured several times and the median kept,
  // as Lighthouse recommends. `runs` in lighthouse.config.json sets how many.
  const runs = Math.max(1, config.runs ?? 3)
  for (const path of paths) {
    const samples = []
    for (let run = 0; run < runs; run++) {
      const result = await lighthouse(`${baseUrl}${path}`, {
        port: chrome.port,
        output: 'json',
        logLevel: 'error',
        onlyCategories: categories,
        formFactor: 'mobile',
      })
      samples.push(result.lhr)
    }
    const median = (values) => {
      const sorted = [...values].sort((a, b) => a - b)
      return sorted[Math.floor(sorted.length / 2)]
    }
    const scores = Object.fromEntries(categories.map(id => [id, median(samples.map(lhr => Math.round((lhr.categories[id]?.score ?? 0) * 100)))]))
    const middle = samples[Math.floor(samples.length / 2)]
    const timing = id => middle.audits[id]?.displayValue ?? ''
    rows.push({ path, scores, benchmark: middle.environment?.benchmarkIndex, timings: `FCP ${timing('first-contentful-paint')}, LCP ${timing('largest-contentful-paint')}, TBT ${timing('total-blocking-time')}, CLS ${timing('cumulative-layout-shift')}` })
  }
}
finally {
  await chrome.kill()
}

const failures = rows.flatMap(row => categories
  .filter(id => row.scores[id] < minimums[id])
  .map(id => `${row.path} ${id} ${row.scores[id]} < ${minimums[id]}`))

const mark = (id, score) => `${score >= minimums[id] ? '✅' : '❌'} ${score}`
const table = [
  `### Lighthouse: ${app}`,
  '',
  `Mobile, against a production build, median of ${Math.max(1, config.runs ?? 3)} runs. Minimums: ${categories.map(id => `${id} ${minimums[id]}`).join(', ')}.`,
  '',
  `| Page | ${categories.map(id => labels[id] ?? id).join(' | ')} |`,
  `| --- | ${categories.map(() => '---').join(' | ')} |`,
  ...rows.map(row => `| \`${row.path}\` | ${categories.map(id => mark(id, row.scores[id])).join(' | ')} |`),
  '',
  // The machine's speed affects performance scores; a slower runner scores lower.
  `Machine benchmark index: ${rows[0]?.benchmark ?? 'unknown'}.`,
  ...rows.map(row => `- \`${row.path}\`: ${row.timings}`),
  '',
].join('\n')

console.log(table)
if (env.GITHUB_STEP_SUMMARY)
  appendFileSync(env.GITHUB_STEP_SUMMARY, `${table}\n`)

if (failures.length) {
  console.error(`Below the minimum:\n${failures.join('\n')}`)
  exit(1)
}
