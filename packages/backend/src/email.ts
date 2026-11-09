import type { EmailAdapter } from 'payload'
import type { BackendEnv } from './env'
import { randomUUID } from 'node:crypto'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { resendAdapter } from '@payloadcms/email-resend'

export interface CapturedEmail {
  to: string
  subject: string
  text: string
  html: string
  capturedAt: string
}

function recipient(to: unknown) {
  const first = Array.isArray(to) ? to[0] : to
  if (typeof first === 'string')
    return first
  if (first && typeof first === 'object' && 'address' in first)
    return String((first as { address: unknown }).address)
  return ''
}

/**
 * Resend in production. Everywhere else, every email is written to `captureDir` as a JSON file, so sign-up
 * verification and password reset links can be read by hand or by tests. Nothing leaves the machine.
 */
export function createEmailAdapter(env: BackendEnv): EmailAdapter | Promise<EmailAdapter> {
  if (env.emailDeliveryMode === 'resend' && env.resendApiKey) {
    return resendAdapter({
      apiKey: env.resendApiKey,
      defaultFromAddress: env.emailFrom,
      defaultFromName: env.emailFromName,
    })
  }

  const adapter: EmailAdapter = () => ({
    name: 'capture',
    defaultFromAddress: env.emailFrom,
    defaultFromName: env.emailFromName,
    sendEmail: async (message) => {
      await mkdir(env.captureDir, { recursive: true })
      const email: CapturedEmail = {
        to: recipient(message.to),
        subject: String(message.subject ?? ''),
        text: String(message.text ?? ''),
        html: String(message.html ?? ''),
        capturedAt: new Date().toISOString(),
      }
      await writeFile(path.join(env.captureDir, `${Date.now()}-${randomUUID()}.json`), JSON.stringify(email, null, 2))
      return { ok: true, id: 'captured' }
    },
  })

  return adapter
}

/** Newest captured email for an address, or undefined. For tests and local development. */
export async function readLatestCapturedEmail(captureDir: string, to: string): Promise<CapturedEmail | undefined> {
  const names = (await readdir(captureDir).catch(() => [] as string[])).filter(name => name.endsWith('.json')).sort().reverse()
  for (const name of names) {
    const email = JSON.parse(await readFile(path.join(captureDir, name), 'utf8')) as CapturedEmail
    if (email.to.toLowerCase() === to.toLowerCase())
      return email
  }
  return undefined
}
