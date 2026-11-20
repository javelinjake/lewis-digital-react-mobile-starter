import type { Outbox } from '@ld/offline'
import { createNote } from './notes-api'

export const notesOutboxTypes = {
  create: 'note:create',
} as const

export function registerNotesOutboxHandlers(outbox: Outbox) {
  outbox.register(notesOutboxTypes.create, async (input) => {
    await createNote(input as { id: string, title: string, body: string })
  })
}
