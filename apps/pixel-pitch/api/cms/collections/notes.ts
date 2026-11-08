import { ownedCollection } from '@ld/backend'

/** The template app's example data: a note only its author can see, with an offline-safe create. */
export const notesCollection = ownedCollection({
  slug: 'notes',
  admin: { useAsTitle: 'title', defaultColumns: ['title', 'owner', 'updatedAt'] },
  fields: [
    { name: 'title', type: 'text', required: true, maxLength: 200 },
    { name: 'body', type: 'textarea', maxLength: 10_000 },
  ],
})
