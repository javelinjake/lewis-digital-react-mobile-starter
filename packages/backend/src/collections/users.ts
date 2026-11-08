import type { CollectionConfig } from 'payload'
import { betterAuthStrategy } from '@delmaredigital/payload-better-auth'
import { adminFieldAccess, adminOnly, isAdminUser, nobody, selfOrAdmin } from '../access'

/**
 * App users. This is the Better Auth `user`, stored in Payload so the admin, access rules and relationships all
 * see the same record. Sign-in, sessions and passwords belong to Better Auth.
 *
 * Members cannot create, delete, promote or re-email themselves here:
 * - accounts are created by Better Auth (the plugin writes with overrideAccess),
 * - deletion goes through `DELETE /api/account`, which removes their data first,
 * - `role`, `email` and `emailVerified` are admin-only fields.
 */
export const usersCollection: CollectionConfig = {
  slug: 'users',
  auth: {
    disableLocalStrategy: true,
    strategies: [betterAuthStrategy()],
  },
  admin: { group: 'Accounts', useAsTitle: 'email', defaultColumns: ['email', 'name', 'role', 'isAnonymous', 'createdAt'] },
  access: {
    admin: ({ req }) => isAdminUser(req.user),
    create: nobody,
    read: selfOrAdmin,
    update: selfOrAdmin,
    delete: adminOnly,
  },
  fields: [
    {
      name: 'email',
      type: 'email',
      required: true,
      unique: true,
      access: { create: adminFieldAccess, update: adminFieldAccess },
    },
    {
      name: 'emailVerified',
      type: 'checkbox',
      defaultValue: false,
      access: { create: adminFieldAccess, update: adminFieldAccess },
    },
    { name: 'name', type: 'text' },
    { name: 'image', type: 'text' },
    {
      name: 'isAnonymous',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'A guest account that has not been linked to an email, Apple or Google sign-in yet.' },
      access: { create: adminFieldAccess, update: adminFieldAccess },
    },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'member',
      saveToJWT: true,
      options: [
        { label: 'Member', value: 'member' },
        { label: 'Administrator', value: 'admin' },
      ],
      access: { create: adminFieldAccess, update: adminFieldAccess },
    },
  ],
}
