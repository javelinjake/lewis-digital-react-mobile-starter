import { ownedCollection } from '@ld/backend'

/** Every change to a club's coins, gems or tokens, with why. For support and balancing; the club holds the balance. */
export const ledgerCollection = ownedCollection({
  slug: 'ledger',
  writes: 'server',
  admin: { defaultColumns: ['currency', 'amount', 'reason', 'owner', 'createdAt'] },
  fields: [
    { name: 'currency', type: 'select', required: true, options: ['coins', 'gems', 'tokens'] },
    { name: 'amount', type: 'number', required: true },
    { name: 'balance', type: 'number', required: true, admin: { description: 'The balance after this change.' } },
    { name: 'reason', type: 'text', required: true },
    { name: 'ref', type: 'text' },
  ],
})
