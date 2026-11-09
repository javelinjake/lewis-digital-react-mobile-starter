import { ownedCollection } from '@ld/backend'

/** Every match a club has played, with everything the replay needs. League matches are numbered from 0; the debut is -1. */
export const fixturesCollection = ownedCollection({
  slug: 'fixtures',
  writes: 'server',
  admin: { defaultColumns: ['no', 'owner', 'result', 'goalsFor', 'goalsAgainst'] },
  // A fixture number is played once per club, however many syncs race.
  indexes: [{ fields: ['owner', 'no'], unique: true }],
  defaultSort: '-no',
  fields: [
    { name: 'no', type: 'number', required: true },
    // Our formation and both squads' names, so the match report reads the same later. Optional: older rows have none.
    { name: 'formation', type: 'text' },
    { name: 'squads', type: 'json' },
    { name: 'kind', type: 'select', required: true, options: ['league', 'debut'] },
    { name: 'tier', type: 'number', required: true },
    { name: 'kickoffAt', type: 'number', required: true },
    { name: 'rival', type: 'json', required: true },
    { name: 'goalsFor', type: 'number', required: true },
    { name: 'goalsAgainst', type: 'number', required: true },
    { name: 'result', type: 'select', required: true, options: ['win', 'draw', 'loss'] },
    { name: 'points', type: 'number', required: true },
    { name: 'coins', type: 'number', required: true },
    { name: 'events', type: 'json', required: true },
    { name: 'warmupBonus', type: 'number', required: true },
    { name: 'promotedTo', type: 'number' },
    { name: 'configVersion', type: 'number', required: true },
  ],
})
