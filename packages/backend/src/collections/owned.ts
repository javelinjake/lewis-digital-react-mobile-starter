import type { CollectionBeforeChangeHook, CollectionConfig, Endpoint, Field, PayloadRequest } from 'payload'
import { APIError } from 'payload'
import { authenticated, idOf, isAdminUser } from '../access'
import { asSlug } from '../loose'
import { withTransaction } from '../transactions'

export const OWNER_FIELD = 'owner'
export const MUTATION_ID_FIELD = 'clientMutationId'

type Where = NonNullable<Parameters<PayloadRequest['payload']['find']>[0]['where']>

export interface OwnedCollectionOptions extends Omit<CollectionConfig, 'access' | 'fields'> {
  slug: string
  fields: Field[]
  /**
   * Who can see a document. `owner` is the only scope for now. `group` is reserved for households and teams,
   * so apps that need sharing later can add it without changing how existing collections are declared.
   */
  scope?: 'owner'
}

/** Read, update and delete reach the signed-in user's own documents. Admins reach everything. */
export const ownerScoped: NonNullable<CollectionConfig['access']>['read'] = ({ req }) => {
  const user = req.user
  if (!user)
    return false
  if (isAdminUser(user))
    return true

  return { [OWNER_FIELD]: { equals: user.id } }
}

/**
 * Members never choose the owner. On create it is set from the session, and on update it cannot change.
 * Admins and server code (no session) may set it explicitly, which `reassignOwner` and data fixes rely on.
 */
export const enforceOwner: CollectionBeforeChangeHook = ({ data, operation, originalDoc, req }) => {
  const user = req.user
  const member = Boolean(user) && !isAdminUser(user)

  if (operation === 'create') {
    if (member)
      return { ...data, [OWNER_FIELD]: user!.id }
    if (idOf(data[OWNER_FIELD]) === undefined)
      throw new APIError('An owner is required.', 400)
    return data
  }

  if (member && data[OWNER_FIELD] !== undefined && idOf(data[OWNER_FIELD]) !== idOf(originalDoc?.[OWNER_FIELD]))
    throw new APIError('The owner of a document cannot be changed.', 403)

  return data
}

function json(body: unknown, status = 200) {
  return Response.json(body, { status })
}

/**
 * `POST /api/<slug>/idempotent`: creates the document unless this user already created one with the same
 * `clientMutationId`, in which case that document comes back unchanged. Outbox replays use it so a retry after a
 * dropped connection never duplicates a write. The unique `(owner, clientMutationId)` index is the backstop.
 */
function idempotentCreateEndpoint(slug: string): Endpoint {
  return {
    path: '/idempotent',
    method: 'post',
    handler: async (req) => {
      const user = req.user
      if (!user)
        return json({ errors: [{ message: 'You must be signed in.' }] }, 401)

      let data: Record<string, unknown>
      try {
        data = await req.json!() as Record<string, unknown>
      }
      catch {
        return json({ errors: [{ message: 'Send a JSON body.' }] }, 400)
      }

      const key = data[MUTATION_ID_FIELD]
      if (typeof key !== 'string' || key.length === 0 || key.length > 200)
        return json({ errors: [{ message: `${MUTATION_ID_FIELD} is required (a string of up to 200 characters).` }] }, 400)

      const findExisting = async () => {
        const where: Where = { and: [{ [OWNER_FIELD]: { equals: user.id } }, { [MUTATION_ID_FIELD]: { equals: key } }] }
        const result = await req.payload.find({
          collection: asSlug(slug),
          where,
          limit: 1,
          depth: 0,
          overrideAccess: false,
          user,
        })
        return result.docs[0]
      }

      const existing = await findExisting()
      if (existing)
        return json({ doc: existing, created: false })

      try {
        const doc = await withTransaction(req, () => req.payload.create({
          collection: asSlug(slug),
          data: data as never,
          depth: 0,
          overrideAccess: false,
          user,
          req,
        }))
        return json({ doc, created: true }, 201)
      }
      catch (error) {
        // A concurrent request with the same key won the race. Its document is the answer.
        const raced = await findExisting()
        if (raced)
          return json({ doc: raced, created: false })
        throw error
      }
    },
  }
}

/**
 * The only way to declare a collection that holds user data. It adds the `owner` field, owner-scoped access, the
 * `clientMutationId` idempotency key and the idempotent create endpoint. The architecture check rejects any other
 * collection in an api app unless it is marked `// architecture: public-data`.
 */
export function ownedCollection(options: OwnedCollectionOptions): CollectionConfig {
  const { fields, endpoints, hooks, custom, admin, indexes, scope = 'owner', ...rest } = options
  void scope

  return {
    ...rest,
    admin: { defaultColumns: ['id', OWNER_FIELD, 'createdAt'], ...admin },
    custom: { ...custom, owned: true },
    access: {
      create: authenticated,
      read: ownerScoped,
      update: ownerScoped,
      delete: ownerScoped,
    },
    indexes: [{ fields: [OWNER_FIELD, MUTATION_ID_FIELD], unique: true }, ...(indexes ?? [])],
    hooks: {
      ...hooks,
      beforeChange: [enforceOwner, ...(hooks?.beforeChange ?? [])],
    },
    endpoints: [...(endpoints === false ? [] : endpoints ?? []), idempotentCreateEndpoint(options.slug)],
    fields: [
      {
        name: OWNER_FIELD,
        type: 'relationship',
        relationTo: 'users',
        required: true,
        index: true,
        admin: { position: 'sidebar' },
      },
      {
        name: MUTATION_ID_FIELD,
        type: 'text',
        index: true,
        maxLength: 200,
        admin: { position: 'sidebar', readOnly: true, description: 'Set by the app so a retried write is applied once.' },
      },
      ...fields,
    ],
  }
}

/** Slugs of every owned collection in a config. The account export and deletion endpoints use it. */
export function ownedCollectionSlugs(collections: ReadonlyArray<{ slug: string, custom?: Record<string, unknown> }>) {
  return collections.filter(collection => collection.custom?.owned === true).map(collection => collection.slug)
}
