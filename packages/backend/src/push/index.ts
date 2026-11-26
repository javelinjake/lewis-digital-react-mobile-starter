import type { Payload, PayloadRequest } from 'payload'
import type { FcmSender, PushMessage } from './fcm'
import process from 'node:process'
import { createFcmSender, parseServiceAccount } from './fcm'

export type { FcmSender, PushMessage, SendOutcome, ServiceAccount } from './fcm'
export { createFcmSender, parseServiceAccount } from './fcm'

export interface PushSummary {
  /** False when FIREBASE_SERVICE_ACCOUNT_JSON is not set: nothing was sent. */
  configured: boolean
  sent: number
  /** Dead tokens deleted. */
  removed: number
  failed: number
}

let defaultSender: FcmSender | null | undefined

/** The sender built from FIREBASE_SERVICE_ACCOUNT_JSON, or null when push is not set up for this api. */
export function getDefaultPushSender(): FcmSender | null {
  if (defaultSender === undefined) {
    const account = parseServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
    defaultSender = account ? createFcmSender({ account }) : null
  }
  return defaultSender
}

interface DeviceRow {
  id: number | string
  token: string
}

/**
 * Sends a notification to every device a user has registered, and deletes tokens Firebase says are dead. Server
 * code only: call it from an action, a hook or a cron, never with an id the client chose for someone else.
 * Pass `req` to run inside the caller's transaction.
 */
export async function sendPushToUser(
  payload: Payload,
  userId: number | string,
  message: PushMessage,
  options: { req?: PayloadRequest, sender?: FcmSender | null } = {},
): Promise<PushSummary> {
  const sender = options.sender === undefined ? getDefaultPushSender() : options.sender
  const summary: PushSummary = { configured: Boolean(sender), sent: 0, removed: 0, failed: 0 }
  if (!sender)
    return summary

  const devices = await payload.find({
    collection: 'devices',
    where: { owner: { equals: userId } },
    overrideAccess: true,
    depth: 0,
    limit: 50,
    pagination: false,
    req: options.req,
  })

  const outcomes = await Promise.all((devices.docs as unknown as DeviceRow[]).map(async device => ({ device, outcome: await sender.send(device.token, message) })))
  for (const { device, outcome } of outcomes) {
    if (outcome === 'sent') {
      summary.sent += 1
    }
    else if (outcome === 'unregistered') {
      summary.removed += 1
      await payload.delete({ collection: 'devices', id: device.id, overrideAccess: true, req: options.req })
    }
    else {
      summary.failed += 1
    }
  }
  return summary
}
