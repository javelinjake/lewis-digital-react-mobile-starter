import { ownedCollection } from '@ld/backend'

/**
 * One club per player. `state` is the rules' `ClubState` (timers, league, lineup, currencies). Only game actions
 * write it, through `mutateClub`, which checks `version` so two devices cannot overwrite each other.
 */
export const clubsCollection = ownedCollection({
  slug: 'clubs',
  writes: 'server',
  admin: { useAsTitle: 'name', defaultColumns: ['name', 'owner', 'tier', 'points', 'updatedAt'] },
  indexes: [{ fields: ['owner'], unique: true }],
  fields: [
    { name: 'name', type: 'text', required: true, maxLength: 24 },
    { name: 'crest', type: 'number', required: true, min: 0 },
    { name: 'kitPrimary', type: 'text', required: true },
    { name: 'kitSecondary', type: 'text', required: true },
    { name: 'state', type: 'json', required: true },
    { name: 'version', type: 'number', required: true, defaultValue: 0 },
    // Copies of a few state values, for the admin list and support queries.
    { name: 'tier', type: 'number', index: true },
    { name: 'points', type: 'number' },
    { name: 'coins', type: 'number' },
  ],
})
