import type { CollectionConfig } from 'payload'
import { ownedCollection } from './owned'

/** Push notification tokens, one row per user and device. */
export const devicesCollection: CollectionConfig = ownedCollection({
  slug: 'devices',
  admin: { group: 'Accounts', useAsTitle: 'platform' },
  indexes: [{ fields: ['owner', 'token'], unique: true }],
  fields: [
    { name: 'token', type: 'text', required: true, maxLength: 4096 },
    { name: 'platform', type: 'select', required: true, options: ['ios', 'android', 'web'] },
    { name: 'appVersion', type: 'text', maxLength: 50 },
    { name: 'lastSeenAt', type: 'date' },
  ],
})
