import type { CollectionConfig } from 'payload'
import { adminOnly, nobody } from '../access'

/** Server-only bookkeeping. Nothing here is readable or writable over REST except by an admin reading it. */
const serverOnlyAccess: CollectionConfig['access'] = {
  create: nobody,
  read: adminOnly,
  update: nobody,
  delete: nobody,
}

export const idempotencyKeysCollection: CollectionConfig = {
  slug: 'idempotency-keys',
  admin: { group: 'System', useAsTitle: 'key', defaultColumns: ['key', 'route', 'status', 'createdAt'] },
  access: serverOnlyAccess,
  indexes: [{ fields: ['owner', 'route', 'key'], unique: true }],
  fields: [
    { name: 'owner', type: 'relationship', relationTo: 'users', required: true, index: true },
    { name: 'route', type: 'text', required: true },
    { name: 'key', type: 'text', required: true, maxLength: 200 },
    { name: 'status', type: 'select', required: true, defaultValue: 'pending', options: ['pending', 'done'] },
    { name: 'responseStatus', type: 'number' },
    { name: 'responseBody', type: 'json' },
  ],
}

export const rateLimitsCollection: CollectionConfig = {
  slug: 'action-throttles',
  admin: { group: 'System', useAsTitle: 'key' },
  access: serverOnlyAccess,
  fields: [{ name: 'key', type: 'text', required: true, index: true }],
}
