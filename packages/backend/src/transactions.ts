import type { PayloadRequest } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { commitTransaction, initTransaction, killTransaction } from 'payload'

type SQL = ReturnType<typeof sql>

/**
 * Runs `fn` in one database transaction. Pass the same `req` to every Local API call inside so they join it.
 * If a transaction is already open on `req`, `fn` simply runs inside that one.
 */
export async function withTransaction<T>(req: PayloadRequest, fn: () => Promise<T>): Promise<T> {
  const shouldCommit = await initTransaction(req)
  try {
    const result = await fn()
    if (shouldCommit)
      await commitTransaction(req)
    return result
  }
  catch (error) {
    if (shouldCommit)
      await killTransaction(req)
    throw error
  }
}

interface DrizzleLike {
  execute: (query: SQL) => Promise<{ rows: Array<Record<string, unknown>> }>
}

/**
 * Locks the rows of `table` where `column` equals `value` until the transaction on `req` ends
 * (`SELECT … FOR UPDATE`). A second request for the same rows waits for the first to commit, then reads what it
 * wrote, so two devices acting at once are applied one after the other instead of one overwriting the other.
 * Payload's `update({ where })` cannot do this: it selects the ids first and updates them later. Call it inside
 * `withTransaction` or a `defineAction` handler, before reading the rows. Returns the locked ids.
 */
export async function lockRows(req: PayloadRequest, table: string, column: string, value: string | number): Promise<Array<string | number>> {
  if (!req.transactionID)
    throw new Error('lockRows needs an open transaction on req (use withTransaction or defineAction).')
  const adapter = req.payload.db as unknown as { drizzle: DrizzleLike, sessions: Record<string, { db: DrizzleLike } | undefined> }
  const db = adapter.sessions[String(await req.transactionID)]?.db
  if (!db)
    throw new Error('lockRows could not find the transaction on req.')
  const result = await db.execute(sql`SELECT id FROM ${sql.identifier(table)} WHERE ${sql.identifier(column)} = ${value} FOR UPDATE`)
  return result.rows.map(row => row.id as string | number)
}
