import type { Payload } from 'payload'
import { ownedCollectionSlugs } from '../collections/owned'
import { asSlug, toPayloadId } from '../loose'

type Id = string | number

/**
 * What happens to a guest's data when the guest signs in to a real account. `move` gives it all to the account (the
 * default: a guest who creates an account keeps their progress). `discard` deletes it and keeps the account as it
 * was: for an app where an account holds one thing (a game save) and signing in should bring back that thing, not mix
 * two of them.
 */
export type GuestLinkOutcome = 'move' | 'discard'

/** Decides the outcome for one link. `guestId` and `accountId` are Payload ids. */
export type GuestLinkPolicy = (input: { payload: Payload, guestId: Id, accountId: Id }) => Promise<GuestLinkOutcome> | GuestLinkOutcome

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

/** Deletes everything a user owns in the owned collections. Returns how many documents went per collection. */
export async function discardOwned(payload: Payload, ownerId: Id) {
  const removed: Record<string, number> = {}
  const owner = toPayloadId(payload, ownerId)
  for (const slug of ownedCollectionSlugs(payload.config.collections)) {
    const result = await payload.delete({
      collection: asSlug(slug),
      overrideAccess: true,
      depth: 0,
      where: { owner: { equals: owner } },
    })
    removed[slug] = result.docs.length
  }
  return removed
}

/** Runs when Better Auth links a guest to an account: asks the app's policy, then moves or discards. */
export async function linkGuest(payload: Payload, guestId: Id, accountId: Id, policy?: GuestLinkPolicy) {
  const outcome = policy
    ? await policy({ payload, guestId: toPayloadId(payload, guestId), accountId: toPayloadId(payload, accountId) })
    : 'move'
  if (outcome === 'discard')
    return { outcome, documents: await discardOwned(payload, guestId) }
  return { outcome, documents: await reassignOwner(payload, guestId, accountId) }
}
