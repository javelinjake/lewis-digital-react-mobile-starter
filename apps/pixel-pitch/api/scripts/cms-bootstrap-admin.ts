import type { Auth } from '@ld/backend'
import process from 'node:process'
import config from '../payload.config'

/**
 * Creates the first administrator. Run it before the API is exposed: the plugin makes the first account on an
 * empty database an administrator, so on a fresh deploy this must be that account, not a visitor.
 *
 *   PAYLOAD_ADMIN_EMAIL=you@example.com PAYLOAD_ADMIN_PASSWORD=... pnpm cms:bootstrap-admin [--if-empty]
 */
const email = process.env.PAYLOAD_ADMIN_EMAIL?.trim().toLowerCase()
const password = process.env.PAYLOAD_ADMIN_PASSWORD

if (!email || !password) {
  console.error('Set PAYLOAD_ADMIN_EMAIL and PAYLOAD_ADMIN_PASSWORD in the environment. Do not commit them.')
  process.exit(1)
}

const { getPayload } = await import('payload')
const payload = await getPayload({ config })
const auth = (payload as unknown as { betterAuth: Auth }).betterAuth

const admins = await payload.count({ collection: 'users', where: { role: { equals: 'admin' } }, overrideAccess: true })
if (admins.totalDocs > 0) {
  if (process.argv.includes('--if-empty')) {
    console.log('An administrator already exists. Nothing to do.')
    process.exit(0)
  }
  console.error('Bootstrap is closed because an administrator already exists.')
  process.exit(1)
}

const existing = await payload.find({ collection: 'users', where: { email: { equals: email } }, limit: 1, depth: 0, overrideAccess: true })
// Better Auth owns passwords, so a new account is created through it (hashing and the credential record).
const userId = existing.docs[0]?.id ?? Number((await auth.api.signUpEmail({ body: { email, password, name: 'Administrator' } })).user.id)

await payload.update({
  collection: 'users',
  id: userId,
  overrideAccess: true,
  data: { role: 'admin', emailVerified: true },
})

console.log(`Administrator ready for ${email}.`)
process.exit(0)
