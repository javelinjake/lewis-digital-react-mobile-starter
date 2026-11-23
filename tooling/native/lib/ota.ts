import { createHash } from 'node:crypto'

/** Pure parts of `pnpm ota:publish` (tooling/native/ota-publish.ts). */

export function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

export interface PublishEnv {
  secret: string
  blobToken: string
}

/** The two secrets live only in your shell: the api's OTA_PUBLISH_SECRET and the Vercel Blob store's token. */
export function readPublishEnv(env: Record<string, string | undefined>): PublishEnv {
  const secret = env.OTA_PUBLISH_SECRET?.trim()
  const blobToken = env.BLOB_READ_WRITE_TOKEN?.trim()
  const missing = [!secret && 'OTA_PUBLISH_SECRET (the same value as on the api)', !blobToken && 'BLOB_READ_WRITE_TOKEN (Vercel > Storage > your Blob store > .env.local)'].filter(Boolean)
  if (missing.length > 0)
    throw new Error(`Set these in your shell first:\n  - ${missing.join('\n  - ')}\nSee docs/ota.md.`)
  return { secret: secret!, blobToken: blobToken! }
}

export interface BundleRecord {
  appId: string
  nativeVersion: string
  version: string
  url: string
  checksum: string
}

/** Where the zip goes in the Blob store. One path per app and release, never overwritten. */
export function blobPath(appId: string, release: string) {
  return `ota/${appId}/${release.replace(/[^\w.+-]/g, '_')}.zip`
}
