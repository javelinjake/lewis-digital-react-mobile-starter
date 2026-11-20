import { existsSync } from 'node:fs'
import process from 'node:process'
import EmbeddedPostgres from 'embedded-postgres'
import { getRepoRoot } from '../lib/repo'

/**
 * Local Postgres without Docker: `pnpm db:dev`. Same port, user and databases as tooling/cms/docker-compose.yaml,
 * so DATABASE_URI defaults work either way. Runs in the foreground; Ctrl+C stops it. Data lives in .data/postgres.
 *
 *   pnpm db:dev                 # start (creates `template` and `template_test`)
 *   pnpm db:dev -- app_a app_b  # also create these databases (and *_test twins)
 */
const port = Number(process.env.DB_PORT ?? 54330)
const databaseDir = `${getRepoRoot()}/.data/postgres`
const databases = ['template', 'template_test', ...process.argv.slice(2).filter(name => /^[a-z0-9_]+$/.test(name))]
  .flatMap(name => (name.endsWith('_test') ? [name] : [name, `${name}_test`]))

const server = new EmbeddedPostgres({
  databaseDir,
  user: 'payload',
  password: 'payload',
  port,
  persistent: true,
  onLog: () => {},
  onError: message => console.error(String(message)),
})

if (!existsSync(`${databaseDir}/PG_VERSION`))
  await server.initialise()

await server.start()

for (const name of new Set(databases)) {
  try {
    await server.createDatabase(name)
    console.log(`Created database ${name}`)
  }
  catch {
    // Already exists.
  }
}

console.log(`Postgres is ready on postgres://payload:payload@127.0.0.1:${port}. Press Ctrl+C to stop.`)

async function stop() {
  await server.stop()
  process.exit(0)
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
setInterval(() => {}, 1 << 30)
