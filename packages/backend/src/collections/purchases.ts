import type { CollectionConfig } from 'payload'
import { adminOnly, nobody } from '../access'
import { ownerScoped } from './owned'

/**
 * What a user is entitled to (a subscription, a pack). Written only by the RevenueCat webhook, readable by its
 * owner so the app can show state without calling RevenueCat.
 */
export const entitlementsCollection: CollectionConfig = {
  slug: 'entitlements',
  admin: { group: 'Purchases', useAsTitle: 'entitlement', defaultColumns: ['owner', 'entitlement', 'active', 'expiresAt'] },
  access: { create: nobody, read: ownerScoped, update: nobody, delete: nobody },
  indexes: [{ fields: ['owner', 'entitlement'], unique: true }],
  fields: [
    { name: 'owner', type: 'relationship', relationTo: 'users', required: true, index: true },
    { name: 'entitlement', type: 'text', required: true, maxLength: 100 },
    { name: 'active', type: 'checkbox', required: true, defaultValue: false },
    { name: 'expiresAt', type: 'date' },
    { name: 'productId', type: 'text' },
    { name: 'store', type: 'text' },
    { name: 'lastEventId', type: 'text' },
  ],
}

/** Every webhook event, kept for support and so a replayed event is applied exactly once. */
export const purchaseEventsCollection: CollectionConfig = {
  slug: 'purchase-events',
  admin: { group: 'Purchases', useAsTitle: 'eventId', defaultColumns: ['eventId', 'type', 'appUserId', 'result', 'createdAt'] },
  access: { create: nobody, read: adminOnly, update: nobody, delete: nobody },
  fields: [
    { name: 'eventId', type: 'text', required: true, unique: true, index: true },
    { name: 'type', type: 'text', required: true },
    { name: 'appUserId', type: 'text', index: true },
    { name: 'result', type: 'select', required: true, options: ['applied', 'ignored'] },
    { name: 'payload', type: 'json' },
  ],
}
