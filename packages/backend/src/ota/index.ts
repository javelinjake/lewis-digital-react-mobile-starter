import type { CollectionConfig, Endpoint } from 'payload'
import type { BundleRow } from './pick-update'
import { adminOnly, nobody } from '../access'
import { consumeRateLimit } from '../rate-limit'
import { bearerValue, secretMatches } from '../secret'
import { pickUpdate } from './pick-update'

export { type BundleRow, pickUpdate, type UpdateAnswer, type UpdateCheck } from './pick-update'

/**
 * Live updates of the web bundle (OTA) for apps with `capabilities.ota`, served to `@capgo/capacitor-updater`.
 * The zips live on a CDN (Vercel Blob, uploaded by `pnpm ota:publish`); this api only records them and answers
 * which one each device should run. Switch a bundle's `active` off in the admin panel to roll devices back.
 */

// architecture: public-data — release metadata (version, url, checksum). No user data.
export const appBundlesCollection: CollectionConfig = {
  slug: 'app-bundles',
  admin: { group: 'System', useAsTitle: 'version', defaultColumns: ['version', 'appId', 'nativeVersion', 'active', 'createdAt'] },
  access: { create: nobody, read: adminOnly, update: adminOnly, delete: adminOnly },
  indexes: [{ fields: ['appId', 'nativeVersion'] }, { fields: ['appId', 'version'], unique: true }],
  fields: [
    { name: 'appId', type: 'text', required: true, maxLength: 200, admin: { description: 'Bundle id of the app it is for, e.g. uk.co.example.app.staging.' } },
    { name: 'nativeVersion', type: 'text', required: true, maxLength: 50, admin: { description: 'Only shells with this store version receive it.' } },
    { name: 'version', type: 'text', required: true, maxLength: 100 },
    { name: 'url', type: 'text', required: true, maxLength: 2000 },
    { name: 'checksum', type: 'text', required: true, maxLength: 128, admin: { description: 'SHA-256 of the zip, hex.' } },
    { name: 'active', type: 'checkbox', defaultValue: true, admin: { description: 'Off: devices on this bundle go back to the store version.' } },
  ],
}

function json(body: unknown, status = 200) {
  return Response.json(body, { status })
}

async function readJson(req: Parameters<Endpoint['handler']>[0]): Promise<Record<string, unknown>> {
  try {
    const parsed: unknown = await req.json?.()
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {}
  }
  catch {
    return {}
  }
}

/**
 * `POST /api/ota/check`: the plugin's `updateUrl`. Public, since it runs before anyone signs in, and it reveals only
 * what any installed copy of the app downloads anyway. Rate limited per device.
 */
export const otaCheckEndpoint: Endpoint = {
  path: '/ota/check',
  method: 'post',
  handler: async (req) => {
    const body = await readJson(req)
    const device = typeof body.device_id === 'string' ? body.device_id.slice(0, 100) : 'unknown'
    const limited = await consumeRateLimit(req.payload, { key: `ota:${device}`, limit: 60, windowMs: 60 * 60_000 })
    if (!limited.allowed)
      return json({ kind: 'blocked', error: 'rate_limited', message: 'Too many update checks.' }, 429)

    const appId = typeof body.app_id === 'string' ? body.app_id : ''
    const nativeVersion = typeof body.version_build === 'string' ? body.version_build : ''
    const found = appId && nativeVersion
      ? await req.payload.find({
          collection: 'app-bundles' as never,
          where: { and: [{ appId: { equals: appId } }, { nativeVersion: { equals: nativeVersion } }, { active: { not_equals: false } }] },
          sort: '-createdAt',
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })
      : { docs: [] }

    const answer = pickUpdate(body, found.docs as unknown as BundleRow[])
    return json(answer, 'kind' in answer && answer.kind === 'failed' ? 400 : 200)
  },
}

const fields = ['appId', 'nativeVersion', 'version', 'url', 'checksum'] as const

/**
 * `POST /api/ota/bundles` with `Authorization: Bearer <OTA_PUBLISH_SECRET>`: records a bundle `pnpm ota:publish`
 * has uploaded. The newest active bundle for an app and native version is the one devices get.
 */
export function createOtaPublishEndpoint(secret: string | undefined): Endpoint {
  return {
    path: '/ota/bundles',
    method: 'post',
    handler: async (req) => {
      if (!secret)
        return json({ errors: [{ message: 'Live updates are not configured. Set OTA_PUBLISH_SECRET on the api.' }] }, 503)
      if (!secretMatches(bearerValue(req.headers.get('authorization')), secret))
        return json({ errors: [{ message: 'Unauthorized.' }] }, 401)

      const body = await readJson(req)
      const missing = fields.filter(field => typeof body[field] !== 'string' || !(body[field] as string).trim())
      if (missing.length > 0)
        return json({ errors: [{ message: `Missing ${missing.join(', ')}.` }] }, 400)
      if (!/^https:\/\//.test(body.url as string))
        return json({ errors: [{ message: 'url must be https.' }] }, 400)
      if (!/^[a-f0-9]{64}$/.test(body.checksum as string))
        return json({ errors: [{ message: 'checksum must be a SHA-256 in hex.' }] }, 400)

      const doc = await req.payload.create({
        collection: 'app-bundles' as never,
        data: { ...Object.fromEntries(fields.map(field => [field, (body[field] as string).trim()])), active: true } as never,
        overrideAccess: true,
      })
      return json({ doc }, 201)
    },
  }
}
