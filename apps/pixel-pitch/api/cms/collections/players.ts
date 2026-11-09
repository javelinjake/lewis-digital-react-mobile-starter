// architecture: public-data
// The catalogue of fictional players. The same for everyone; seeded by a migration from `generateCatalogue`, and
// editable in the admin afterwards.
import type { CollectionConfig } from 'payload'
import { adminOnly } from '@ld/backend'
import { POSITIONS, RARITIES } from '@ld/pixel-pitch-core'

export const playersCollection: CollectionConfig = {
  slug: 'players',
  admin: { useAsTitle: 'name', defaultColumns: ['catalogueId', 'name', 'position', 'rarity', 'rating'] },
  access: { read: () => true, create: adminOnly, update: adminOnly, delete: adminOnly },
  fields: [
    { name: 'catalogueId', type: 'text', required: true, unique: true, index: true, admin: { description: 'Cards refer to this id. Never change it.' } },
    { name: 'name', type: 'text', required: true, maxLength: 40 },
    { name: 'nation', type: 'number', required: true, min: 0, max: 3 },
    { name: 'position', type: 'select', required: true, options: [...POSITIONS] },
    { name: 'altPosition', type: 'select', options: [...POSITIONS] },
    { name: 'rarity', type: 'select', required: true, options: [...RARITIES] },
    { name: 'rating', type: 'number', required: true, min: 1, max: 99 },
    { name: 'sprite', type: 'json', required: true },
  ],
}
