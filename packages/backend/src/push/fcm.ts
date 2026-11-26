import { Buffer } from 'node:buffer'
import { createSign } from 'node:crypto'

/**
 * Firebase Cloud Messaging over its HTTP v1 api, which delivers to Android directly and to iOS through APNs (with
 * the APNs key uploaded to the Firebase project). Talks to Google with a service-account token signed here, so the
 * backend needs no Firebase SDK.
 */

export interface ServiceAccount {
  projectId: string
  clientEmail: string
  privateKey: string
}

/** Reads the service-account JSON downloaded from Firebase (Project settings > Service accounts). */
export function parseServiceAccount(json: string | undefined): ServiceAccount | undefined {
  if (!json?.trim())
    return undefined
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(json) as Record<string, unknown>
  }
  catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON. Paste the whole downloaded key file.')
  }
  const { project_id: projectId, client_email: clientEmail, private_key: privateKey } = parsed
  if (typeof projectId !== 'string' || typeof clientEmail !== 'string' || typeof privateKey !== 'string')
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON needs project_id, client_email and private_key.')
  return { projectId, clientEmail, privateKey: privateKey.replace(/\\n/g, '\n') }
}

export interface PushMessage {
  title: string
  body: string
  /** Read by the app when the notification is tapped, e.g. `{ path: '/notes/12' }`. Values must be strings. */
  data?: Record<string, string>
  /** The number on the app icon. Omit to leave it alone. */
  badge?: number
}

/**
 * `unregistered`: the token will never work again (app uninstalled, token rotated), so drop it.
 * `failed`: anything else, including Google being down. Keep the token.
 */
export type SendOutcome = 'sent' | 'unregistered' | 'failed'

export interface FcmSender {
  send: (token: string, message: PushMessage) => Promise<SendOutcome>
}

export interface FcmSenderOptions {
  account: ServiceAccount
  fetch?: typeof fetch
  now?: () => number
}

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging'

function base64url(value: string | Buffer) {
  return Buffer.from(value).toString('base64url')
}

export function signServiceAccountJwt(account: ServiceAccount, nowSeconds: number): string {
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = base64url(JSON.stringify({ iss: account.clientEmail, scope: SCOPE, aud: TOKEN_URL, iat: nowSeconds, exp: nowSeconds + 3600 }))
  const signer = createSign('RSA-SHA256')
  signer.update(`${header}.${claims}`)
  return `${header}.${claims}.${base64url(signer.sign(account.privateKey))}`
}

interface FcmError {
  error?: { status?: string, message?: string, details?: Array<{ errorCode?: string }> }
}

/** FCM says a token is dead with UNREGISTERED, or INVALID_ARGUMENT about the token itself. */
function isDeadToken(status: number, body: FcmError) {
  const codes = body.error?.details?.map(detail => detail.errorCode) ?? []
  if (status === 404 || codes.includes('UNREGISTERED'))
    return true
  return codes.includes('INVALID_ARGUMENT') && /registration token/i.test(body.error?.message ?? '')
}

export function createFcmSender({ account, fetch: request = fetch, now = Date.now }: FcmSenderOptions): FcmSender {
  let cached: { token: string, expiresAt: number } | undefined

  async function accessToken() {
    if (cached && cached.expiresAt - 60_000 > now())
      return cached.token
    const assertion = signServiceAccountJwt(account, Math.floor(now() / 1000))
    const response = await request(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }).toString(),
    })
    if (!response.ok)
      throw new Error(`Google refused the Firebase service account (${response.status}). Check FIREBASE_SERVICE_ACCOUNT_JSON.`)
    const body = await response.json() as { access_token: string, expires_in: number }
    cached = { token: body.access_token, expiresAt: now() + body.expires_in * 1000 }
    return cached.token
  }

  return {
    async send(token, message) {
      let response: Response
      try {
        response = await request(`https://fcm.googleapis.com/v1/projects/${account.projectId}/messages:send`, {
          method: 'POST',
          headers: { 'authorization': `Bearer ${await accessToken()}`, 'content-type': 'application/json' },
          body: JSON.stringify({
            message: {
              token,
              notification: { title: message.title, body: message.body },
              ...(message.data ? { data: message.data } : {}),
              android: { priority: 'HIGH', notification: { sound: 'default' } },
              apns: { payload: { aps: { sound: 'default', ...(message.badge === undefined ? {} : { badge: message.badge }) } } },
            },
          }),
        })
      }
      catch {
        return 'failed'
      }
      if (response.ok)
        return 'sent'
      const body = await response.json().catch(() => ({})) as FcmError
      return isDeadToken(response.status, body) ? 'unregistered' : 'failed'
    },
  }
}
