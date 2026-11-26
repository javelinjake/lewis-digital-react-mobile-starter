import { ownedCollection } from '@ld/backend'

/**
 * Daily challenge scores, one per club per day. Only the server writes them (`/game/challenge/finish`). The
 * leaderboard action reads everyone's, but answers only the public parts: club name, crest, kit and score. A score
 * the rules thought unlikely (`flagged`) stays off the boards until an admin ticks `reviewed`.
 */
export const challengeEntriesCollection = ownedCollection({
  slug: 'challenge-entries',
  writes: 'server',
  admin: { defaultColumns: ['day', 'cabinet', 'score', 'clubName', 'flagged', 'reviewed'] },
  indexes: [{ fields: ['owner', 'day'], unique: true }, { fields: ['day', 'score'] }],
  fields: [
    { name: 'day', type: 'number', required: true, index: true },
    { name: 'week', type: 'number', required: true, index: true },
    { name: 'cabinet', type: 'text', required: true },
    { name: 'score', type: 'number', required: true },
    // A copy of the club's look on the day, so a board is one query.
    { name: 'clubName', type: 'text', required: true },
    { name: 'crest', type: 'number', required: true },
    { name: 'kitPrimary', type: 'text', required: true },
    { name: 'kitSecondary', type: 'text', required: true },
    { name: 'flagged', type: 'text', admin: { description: 'Why this score is held off the boards (above-ceiling, too-regular). Empty when it is not.' } },
    { name: 'reviewed', type: 'checkbox', defaultValue: false, admin: { description: 'Tick to put a flagged score on the boards after checking it.' } },
  ],
})
