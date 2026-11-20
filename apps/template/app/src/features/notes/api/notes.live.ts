import type { CreateNoteInput, Note } from '../types/note'
import { ApiError } from '@ld/api-client'
import { getApi } from '@/lib/api/client'

/**
 * A note as the api returns it. Only the fields this screen uses; the client does not import the server's generated
 * types, which would tie it to Payload. `tests/integration/client-contract.spec.ts` in the api app checks they agree.
 */
interface NoteDoc {
  id: number
  title: string
  body?: string | null
  clientMutationId?: string | null
  updatedAt: string
}

const notes = () => getApi().collection<NoteDoc>('notes')

/**
 * The app's note id is the id it made up when the note was written, which may have been offline. The server keeps it
 * as `clientMutationId`, so one note has one id from the first draft to every device that reads it. A note made
 * somewhere else (the admin panel) has none, so the server id stands in.
 */
function toNote(doc: NoteDoc): Note {
  return {
    id: doc.clientMutationId ?? String(doc.id),
    title: doc.title,
    body: doc.body ?? '',
    updatedAt: doc.updatedAt,
  }
}

export async function readNotes(): Promise<Note[]> {
  const result = await notes().find({ sort: '-updatedAt', limit: 200 })
  return result.docs.map(toNote)
}

export async function readNote(id: string): Promise<Note> {
  const byServerId = /^\d+$/.test(id) ? [{ id: { equals: Number(id) } }] : []
  const result = await notes().find({
    where: { or: [{ clientMutationId: { equals: id } }, ...byServerId] },
    limit: 1,
  })

  const doc = result.docs[0]
  if (!doc)
    throw new ApiError(404, 'Note not found')
  return toNote(doc)
}

/** Safe to repeat: the server returns the note it already stored for this id. The outbox relies on that. */
export async function createNote(input: CreateNoteInput): Promise<Note> {
  const doc = await notes().createIdempotent({ clientMutationId: input.id, title: input.title, body: input.body })
  return toNote(doc)
}
