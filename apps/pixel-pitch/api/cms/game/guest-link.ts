import type { GuestLinkPolicy } from '@ld/backend'

/**
 * One club per account. When a guest signs in to an account that already has a club, the account's club is the one
 * they get: the guest's club, cards and history on this device are deleted rather than mixed in (a second club would
 * break the one-per-owner rule, and the guest's cards would land in the account's squad). A guest who signs in to an
 * account with no club yet (a new account) keeps everything.
 */
export const keepAccountClub: GuestLinkPolicy = async ({ payload, accountId }) => {
  const existing = await payload.count({ collection: 'clubs', where: { owner: { equals: accountId } }, overrideAccess: true })
  return existing.totalDocs > 0 ? 'discard' : 'move'
}
