import type { PayloadRequest } from 'payload'
import { commitTransaction, initTransaction, killTransaction } from 'payload'

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
