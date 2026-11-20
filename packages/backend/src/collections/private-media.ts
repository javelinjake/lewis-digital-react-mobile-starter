import type { CollectionConfig } from 'payload'
import { ownedCollection } from './owned'

/**
 * Files only their owner can read. Payload serves them from `/api/private-media/file/<name>` through the same
 * owner-scoped read access as the documents, so a guessed URL returns nothing for anyone else.
 */
export function privateMediaCollection(staticDir: string): CollectionConfig {
  return ownedCollection({
    slug: 'private-media',
    admin: { group: 'Accounts', useAsTitle: 'filename' },
    upload: {
      staticDir,
      mimeTypes: ['image/*'],
      imageSizes: [
        { name: 'thumb', width: 320, formatOptions: { format: 'webp', options: { quality: 75 } } },
        { name: 'medium', width: 640, formatOptions: { format: 'webp', options: { quality: 75 } } },
        { name: 'large', width: 1280, formatOptions: { format: 'webp', options: { quality: 75 } } },
      ],
    },
    fields: [{ name: 'alt', type: 'text', maxLength: 300 }],
  })
}
