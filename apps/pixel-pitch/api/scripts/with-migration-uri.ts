import { spawnSync } from 'node:child_process'
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import process from 'node:process'

// Migrations need a direct (unpooled) connection. Neon's Vercel integration names it DATABASE_URL_UNPOOLED.
const migrationUri = process.env.DATABASE_URI_MIGRATION || process.env.DATABASE_URL_UNPOOLED
if (migrationUri)
  process.env.DATABASE_URI = migrationUri

const args = process.argv.slice(2)
if (args.length === 0) {
  console.error('Usage: tsx scripts/with-migration-uri.ts <payload arguments>')
  process.exit(1)
}

const result = spawnSync('payload', args, { stdio: 'inherit', env: process.env })

// Payload generates migrations that import its argument types as values and take `{ db, payload, req }`.
// Tidy both so the files type-check and load under Vitest as well as the Payload CLI.
const GENERATED_IMPORT = 'import { MigrateUpArgs, MigrateDownArgs, sql } from \'@payloadcms/db-postgres\''
const TYPE_ONLY_IMPORT = 'import type { MigrateDownArgs, MigrateUpArgs } from \'@payloadcms/db-postgres\'\nimport { sql } from \'@payloadcms/db-postgres\''

if (result.status === 0 && args[0] === 'migrate:create') {
  const dir = 'cms/migrations'
  const newest = readdirSync(dir)
    .filter(name => /^\d.*\.ts$/.test(name))
    .sort((a, b) => statSync(`${dir}/${b}`).mtimeMs - statSync(`${dir}/${a}`).mtimeMs)[0]
  if (newest) {
    const file = `${dir}/${newest}`
    let source = readFileSync(file, 'utf8').replace(GENERATED_IMPORT, TYPE_ONLY_IMPORT)
    if (!/\bpayload\.|\breq\b[^:]/.test(source.replace(/\{ db, payload, req \}/g, '')))
      source = source.replace(/\{ db, payload, req \}/g, '{ db }')
    writeFileSync(file, source)
  }
}

process.exit(result.status ?? 1)
