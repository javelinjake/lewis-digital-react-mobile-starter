import type { Payload } from 'payload'

/**
 * The shared package works with whatever collections an app declares, so it cannot name them in the type system.
 * An app's generated `payload-types.ts` narrows slugs to a closed union and ids to numbers. These casts keep the
 * same code compiling both on its own and inside an app.
 */
export type AnySlug = Parameters<Payload['find']>[0]['collection']

export function asSlug(slug: string) {
  return slug as AnySlug
}

/**
 * Better Auth identifies users with strings ("42") and so does RevenueCat's app user id, but Payload's Postgres
 * ids are numbers. Comparing the two without converting matches nothing, silently. Convert at every boundary.
 */
export function toPayloadId(payload: Payload, value: string | number): string | number {
  return payload.db.defaultIDType === 'number' ? Number(value) : String(value)
}

/** Whether `value` could be an id for this database (a number-like string when ids are numbers). */
export function isPayloadId(payload: Payload, value: string): boolean {
  return payload.db.defaultIDType === 'number' ? /^\d+$/.test(value) : value.length > 0
}
