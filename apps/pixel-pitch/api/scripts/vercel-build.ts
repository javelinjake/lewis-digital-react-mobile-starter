import { spawnSync } from 'node:child_process'
import process from 'node:process'

// Vercel build command: migrate, make sure the first administrator exists, then build.
// Data steps run with the build-phase flag so they do not need production email credentials.
const databaseConfigured = Boolean(
  process.env.DATABASE_URI_MIGRATION
  || process.env.DATABASE_URL_UNPOOLED
  || process.env.DATABASE_URI
  || process.env.DATABASE_URL,
)

function run(args: string[], extraEnv: Record<string, string> = {}) {
  const result = spawnSync('pnpm', ['exec', ...args], {
    stdio: 'inherit',
    env: { ...process.env, ...extraEnv },
  })
  if (result.status !== 0)
    process.exit(result.status ?? 1)
}

const dataEnv = { NEXT_PHASE: 'phase-production-build' }

if (!databaseConfigured) {
  console.error('No database configured. Add the Neon integration (DATABASE_URL) to this project before deploying.')
  process.exit(1)
}

console.log('Running migrations')
run(['tsx', 'scripts/with-migration-uri.ts', 'migrate'], dataEnv)

if (process.env.PAYLOAD_ADMIN_EMAIL && process.env.PAYLOAD_ADMIN_PASSWORD) {
  console.log('Ensuring the first administrator exists')
  run(['tsx', 'scripts/cms-bootstrap-admin.ts', '--if-empty'], dataEnv)
}
else {
  console.warn('PAYLOAD_ADMIN_EMAIL and PAYLOAD_ADMIN_PASSWORD are not set. The first account to sign up will become the administrator.')
}

run(['next', 'build'])
