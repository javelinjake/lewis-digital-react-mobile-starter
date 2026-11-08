import type { OutboxItem } from '@ld/offline'
import type { CreateNoteInput, Note } from '../types/note'
import { notesOutboxTypes } from '../api/register-outbox-handlers'

export function mergeNotes(server: Note[] | undefined, items: OutboxItem[]) {
  const byId = new Map<string, Note>()

  // "Pending" comes from the outbox alone. A cached copy can still carry the flag from before its write was sent
  // (the cache is saved on the device), so it is cleared here and set again only for what the outbox still holds.
  for (const note of server ?? [])
    byId.set(note.id, { ...note, pending: undefined })

  for (const item of items) {
    if (item.type !== notesOutboxTypes.create)
      continue

    const payload = item.payload as CreateNoteInput
    byId.set(payload.id, {
      ...payload,
      updatedAt: new Date(item.createdAt).toISOString(),
      pending: true,
    })
  }

  return [...byId.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}
