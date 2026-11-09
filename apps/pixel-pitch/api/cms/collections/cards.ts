import { ownedCollection } from '@ld/backend'

/** A player a user owns. Written only by game actions (packs, merging, training, selling). */
export const cardsCollection = ownedCollection({
  slug: 'cards',
  writes: 'server',
  admin: { defaultColumns: ['playerId', 'stars', 'trained', 'owner'] },
  fields: [
    { name: 'playerId', type: 'text', required: true, index: true, admin: { description: 'The catalogue id of the player.' } },
    { name: 'stars', type: 'number', required: true, min: 1, defaultValue: 1 },
    { name: 'trained', type: 'number', required: true, min: 0, defaultValue: 0 },
    { name: 'source', type: 'select', required: true, options: ['starter', 'pack', 'merge', 'arcade'] },
  ],
})
