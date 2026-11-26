import type { Payload, PayloadRequest } from 'payload'
import { APIError } from 'payload'
import { defineAction } from '../actions'
import { sendPushToUser } from '../push'

const PLATFORMS = new Set(['ios', 'android'])

function readToken(body: Record<string, unknown>) {
  const token = typeof body.token === 'string' ? body.token.trim() : ''
  if (!token || token.length > 4096)
    throw new APIError('token is required.', 400)
  return token
}

async function devicesWithToken(payload: Payload, req: PayloadRequest, token: string) {
  const found = await payload.find({
    collection: 'devices',
    where: { token: { equals: token } },
    overrideAccess: true,
    depth: 0,
    limit: 100,
    pagination: false,
    req,
  })
  return found.docs as unknown as Array<{ id: number | string, owner: number | string | { id: number | string } }>
}

const ownerId = (owner: number | string | { id: number | string }) => String(typeof owner === 'object' ? owner.id : owner)

/**
 * `POST /api/actions/push/register` `{ token, platform, appVersion? }`. Saves this device's push token for the
 * signed-in user. A token belongs to one phone, so any other account's row for it is deleted: after someone signs
 * out and a friend signs in on the same phone, the first person's notifications stop arriving there.
 * Repeating it is harmless, so no Idempotency-Key is needed.
 */
export const registerDeviceAction = defineAction({
  path: '/actions/push/register',
  idempotent: false,
  rateLimit: { limit: 20, windowMs: 60_000 },
  handler: async ({ req, payload, user, body }) => {
    const token = readToken(body)
    const platform = typeof body.platform === 'string' ? body.platform : ''
    if (!PLATFORMS.has(platform))
      throw new APIError('platform must be ios or android.', 400)
    const appVersion = typeof body.appVersion === 'string' ? body.appVersion.slice(0, 50) : undefined

    const rows = await devicesWithToken(payload, req, token)
    const mine = rows.find(row => ownerId(row.owner) === String(user.id))
    for (const row of rows) {
      if (row !== mine)
        await payload.delete({ collection: 'devices', id: row.id, overrideAccess: true, req })
    }

    const data = { token, platform, appVersion, lastSeenAt: new Date().toISOString() }
    if (mine)
      await payload.update({ collection: 'devices', id: mine.id, data: data as never, overrideAccess: true, req })
    else
      await payload.create({ collection: 'devices', data: { ...data, owner: user.id } as never, overrideAccess: true, req })

    return { body: { registered: true } }
  },
})

/** `POST /api/actions/push/unregister` `{ token }`. Call before signing out, so this phone stops getting this account's pushes. */
export const unregisterDeviceAction = defineAction({
  path: '/actions/push/unregister',
  idempotent: false,
  rateLimit: { limit: 20, windowMs: 60_000 },
  handler: async ({ req, payload, user, body }) => {
    const token = readToken(body)
    const rows = await devicesWithToken(payload, req, token)
    for (const row of rows.filter(row => ownerId(row.owner) === String(user.id)))
      await payload.delete({ collection: 'devices', id: row.id, overrideAccess: true, req })
    return { body: { registered: false } }
  },
})

/**
 * `POST /api/actions/push/test`. Sends "Notifications are working" to the caller's own devices, for a settings
 * screen and for checking a new Firebase setup. Answers `configured: false` when the api has no Firebase key.
 */
export const testPushAction = defineAction({
  path: '/actions/push/test',
  idempotent: false,
  rateLimit: { limit: 5, windowMs: 60 * 60_000 },
  handler: async ({ req, payload, user }) => {
    const summary = await sendPushToUser(payload, user.id, { title: 'Notifications are working', body: 'This is a test from your settings.' }, { req })
    return { body: summary }
  },
})

export const pushEndpoints = [registerDeviceAction, unregisterDeviceAction, testPushAction]
