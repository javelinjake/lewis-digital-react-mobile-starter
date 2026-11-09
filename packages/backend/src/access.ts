import type { Access, FieldAccess } from 'payload'

export type AppRole = 'admin' | 'member'

interface MaybeUser {
  id?: unknown
  role?: unknown
}

export function userRole(user: unknown): AppRole | undefined {
  if (!user || typeof user !== 'object')
    return undefined

  const role = (user as MaybeUser).role
  return role === 'admin' || role === 'member' ? role : undefined
}

export function isAdminUser(user: unknown) {
  return userRole(user) === 'admin'
}

export function userId(user: unknown): string | number | undefined {
  if (!user || typeof user !== 'object')
    return undefined

  const id = (user as MaybeUser).id
  return typeof id === 'string' || typeof id === 'number' ? id : undefined
}

/** Relationship values arrive as an id or a populated document. */
export function idOf(value: unknown): string | number | undefined {
  if (typeof value === 'string' || typeof value === 'number')
    return value
  if (value && typeof value === 'object' && 'id' in value)
    return idOf((value as { id: unknown }).id)
  return undefined
}

export const authenticated: Access = ({ req }) => Boolean(req.user)

export const adminOnly: Access = ({ req }) => isAdminUser(req.user)

export const nobody: Access = () => false

export const adminFieldAccess: FieldAccess = ({ req }) => isAdminUser(req.user)

/**
 * A user reads and edits only their own record. Admins reach everyone.
 *
 * The constraint is always the caller's own id. Payload passes the *requested* id to access functions, so
 * returning `{ id: { equals: requestedId } }` would allow any record to be read by asking for it by id.
 */
export const selfOrAdmin: Access = ({ req }) => {
  const user = req.user
  if (!user)
    return false
  if (isAdminUser(user))
    return true

  return { id: { equals: user.id } }
}
