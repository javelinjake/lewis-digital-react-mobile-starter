import { defineAction } from '@ld/backend'
import { APIError } from 'payload'

/**
 * Example of a server-authoritative action: `POST /api/actions/duplicate-note` with `{ "id": 12 }` and an
 * `Idempotency-Key` header. The client only asks. The server reads the note through the user's own access rules,
 * writes the copy inside one transaction, and a retry with the same key gets the first answer back instead of a
 * second copy. Games use the same shape for "open a pack" or "collect coins".
 */
export const duplicateNoteAction = defineAction({
  path: '/actions/duplicate-note',
  rateLimit: { limit: 30, windowMs: 60_000 },
  handler: async ({ body, payload, req, user }) => {
    const id = body.id
    if (typeof id !== 'number' && typeof id !== 'string')
      throw new APIError('Send the id of the note to duplicate.', 400)

    // overrideAccess: false makes this the user's own view: someone else's note is "not found", not copied.
    const original = await payload.findByID({ collection: 'notes', id, depth: 0, overrideAccess: false, user, req })

    const copy = await payload.create({
      collection: 'notes',
      overrideAccess: false,
      user,
      req,
      data: { owner: user.id, title: `${original.title} (copy)`, body: original.body },
    })

    return { status: 201, body: { doc: copy } }
  },
})
