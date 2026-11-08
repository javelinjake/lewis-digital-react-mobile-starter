import type { Payload } from 'payload'
import { ownedCollectionSlugs } from '../collections/owned'
import { asSlug, toPayloadId } from '../loose'

type Id = string | number

/**
 * Moves everything one user owns to another. Used when a guest account is linked to an email, Apple or Google
 * sign-in and Better Auth merges the guest into the real account, so progress survives.
 * Returns how many documents moved per collection.
 */
export async function reassignOwner(payload: Payload, fromId: Id, toId: Id) {
  const moved: Record<string, number> = {}
  // Better Auth passes string ids. Payload's are numbers on Postgres.
  const from = toPayloadId(payload, fromId)
  const to = toPayloadId(payload, toId)

  for (const slug of ownedCollectionSlugs(payload.config.collections)) {
    const result = await payload.update({
      collection: asSlug(slug),
      overrideAccess: true,
      depth: 0,
      where: { owner: { equals: from } },
      data: { owner: to } as never,
    })
    moved[slug] = result.docs.length
  }

  return moved
}
