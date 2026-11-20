// Turns Vitest and Playwright JSON reports into a table for the GitHub Actions job summary.
// Usage: node tooling/ci/test-summary.mjs "Unit tests" apps/*/test-results/vitest.json packages/*/test-results/vitest.json
//        node tooling/ci/test-summary.mjs "End-to-end tests" apps/my-site/test-results/playwright.json
import { appendFileSync, existsSync, readFileSync } from 'node:fs'
import { dirname, relative } from 'node:path'
import { argv, cwd, env } from 'node:process'

const [title, ...files] = argv.slice(2)

function counts(report) {
  if (report.stats) {
    const { expected = 0, unexpected = 0, flaky = 0, skipped = 0 } = report.stats
    return { passed: expected + flaky, failed: unexpected, skipped }
  }
  return {
    passed: report.numPassedTests ?? 0,
    failed: report.numFailedTests ?? 0,
    skipped: (report.numPendingTests ?? 0) + (report.numTodoTests ?? 0),
  }
}

const rows = files
  .filter(file => existsSync(file))
  .map((file) => {
    const { passed, failed, skipped } = counts(JSON.parse(readFileSync(file, 'utf8')))
    const name = relative(cwd(), dirname(dirname(file)))
    return `| ${failed ? '❌' : '✅'} \`${name}\` | ${passed} | ${failed} | ${skipped} |`
  })

const table = [
  `### ${title}`,
  '',
  ...(rows.length
    ? ['| Package | Passed | Failed | Skipped |', '| --- | --- | --- | --- |', ...rows]
    : ['No test reports were produced.']),
  '',
].join('\n')

console.log(table)
if (env.GITHUB_STEP_SUMMARY)
  appendFileSync(env.GITHUB_STEP_SUMMARY, `${table}\n`)
