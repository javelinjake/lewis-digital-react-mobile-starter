import type { OutboxItem } from '@ld/offline'
import type { CreateNoteInput, Note } from '../types/note'
import { notesOutboxTypes } from '../api/register-outbox-handlers'

export function mergeNotes(server: Note[] | undefined, items: OutboxItem[]) {
  const byId = new Map<string, Note>()

  for (const note of server ?? [])
    byId.set(note.id, note)

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
