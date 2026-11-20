import type { Auth } from '@delmaredigital/payload-better-auth'
import type { Endpoint, Payload } from 'payload'
import { ownedCollectionSlugs } from '../collections/owned'
import { asSlug } from '../loose'
import { consumeRateLimit } from '../rate-limit'
import { withTransaction } from '../transactions'

const PAGE_SIZE = 500
const EXPORT_LIMIT = 10_000

type Id = string | number

function authOf(payload: Payload) {
  const auth = (payload as unknown as { betterAuth?: Auth }).betterAuth
  if (!auth)
    throw new Error('Better Auth is not initialised.')
  return auth
}

function unauthorized() {
  return Response.json({ errors: [{ message: 'You must be signed in.' }] }, { status: 401 })
}

/** Collections that belong to a user but are not declared with `ownedCollection` (server-written). */
const SERVER_OWNED = ['entitlements', 'idempotency-keys'] as const

/**
 * `DELETE /api/account`: removes the signed-in user and everything they own. App Store rules require an in-app
 * way to delete an account once accounts exist. Owned data goes first, in one transaction, so a failure leaves
 * the account intact. Better Auth then removes the user, their sessions and linked sign-ins. Safe to retry.
 */
export const deleteAccountEndpoint: Endpoint = {
  path: '/account',
  method: 'delete',
  handler: async (req) => {
    const user = req.user
    if (!user)
      return unauthorized()

    const payload = req.payload
    const owned = ownedCollectionSlugs(payload.config.collections)

    await withTransaction(req, async () => {
      for (const slug of [...owned, ...SERVER_OWNED]) {
        await payload.delete({
          collection: asSlug(slug),
          where: { owner: { equals: user.id } },
          overrideAccess: true,
          req,
        })
      }
    })

    const context = await authOf(payload).$context
    await context.internalAdapter.deleteUser(String(user.id))

    return Response.json({ deleted: true })
  },
}

async function readAll(payload: Payload, collection: string, owner: Id) {
  const docs: unknown[] = []
  for (let page = 1; docs.length < EXPORT_LIMIT; page++) {
    const result = await payload.find({
      collection: asSlug(collection),
      where: { owner: { equals: owner } },
      depth: 0,
      limit: PAGE_SIZE,
      page,
      overrideAccess: true,
    })
    docs.push(...result.docs)
    if (!result.hasNextPage)
      break
  }
  return docs
}

/** `GET /api/account/export`: everything the app holds about the signed-in user, as a JSON download. */
export const exportAccountEndpoint: Endpoint = {
  path: '/account/export',
  method: 'get',
  handler: async (req) => {
    const user = req.user
    if (!user)
      return unauthorized()

    const payload = req.payload
    const limited = await consumeRateLimit(payload, { key: `account:export:${user.id}`, limit: 5, windowMs: 60 * 60 * 1000 })
    if (!limited.allowed)
      return Response.json({ errors: [{ message: 'Too many exports. Try again later.' }] }, { status: 429 })

    const data: Record<string, unknown[]> = {}
    for (const slug of [...ownedCollectionSlugs(payload.config.collections), 'entitlements'])
      data[slug] = await readAll(payload, slug, user.id)

    const { id, email, name, image, role, isAnonymous, createdAt } = user as unknown as Record<string, unknown>
    const body = { exportedAt: new Date().toISOString(), account: { id, email, name, image, role, isAnonymous, createdAt }, data }

    return new Response(JSON.stringify(body, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': 'attachment; filename="my-data.json"',
        'Cache-Control': 'no-store',
      },
    })
  },
}
