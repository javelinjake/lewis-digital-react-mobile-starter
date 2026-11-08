import type { Payload } from 'payload'
import { readLatestCapturedEmail } from '@ld/backend'
import { beforeAll, describe, expect, it } from 'vitest'
import { ADMIN_EMAIL, ADMIN_PASSWORD, boot, call, guest, Session } from './harness'

let payload: Payload
const mailDir = process.env.EMAIL_CAPTURE_DIR!

async function linkFrom(email: string) {
  const mail = await readLatestCapturedEmail(mailDir, email)
  expect(mail, `no email captured for ${email}`).toBeDefined()
  const match = mail!.text.match(/https?:\/\/\S+/)
  expect(match).not.toBeNull()
  return new URL(match![0])
}

beforeAll(async () => {
  payload = await boot()
})

describe('email sign-up', () => {
  const email = 'new.person@example.com'
  const password = 'correct horse battery'

  it('creates a member who cannot sign in until the email is verified', async () => {
    const session = new Session()
    const signUp = await session.post('/api/auth/sign-up/email', { email, password, name: 'New Person' })
    expect(signUp.status, JSON.stringify(signUp.json)).toBe(200)

    const user = (await payload.find({ collection: 'users', where: { email: { equals: email } }, overrideAccess: true })).docs[0]
    expect(user.role).toBe('member')
    expect(user.emailVerified).toBeFalsy()

    const early = await new Session().post('/api/auth/sign-in/email', { email, password })
    expect(early.status).toBeGreaterThanOrEqual(400)
  })

  it('verifies from the emailed link and then signs in', async () => {
    const link = await linkFrom(email)
    const verified = await call('GET', `${link.pathname}${link.search}`)
    expect([200, 302]).toContain(verified.status)

    const session = new Session()
    const signIn = await session.post('/api/auth/sign-in/email', { email, password })
    expect(signIn.status, JSON.stringify(signIn.json)).toBe(200)
    expect((await session.get('/api/users/me')).json.user.email).toBe(email)
  })

  it('refuses a short password', async () => {
    const response = await new Session().post('/api/auth/sign-up/email', { email: 'short@example.com', password: 'short', name: 'Short' })
    expect(response.status).toBeGreaterThanOrEqual(400)
  })

  it('does not let a sign-up choose its own role', async () => {
    const response = await new Session().post('/api/auth/sign-up/email', { email: 'sneaky@example.com', password: 'a-long-enough-password', name: 'Sneaky', role: 'admin' })
    const user = (await payload.find({ collection: 'users', where: { email: { equals: 'sneaky@example.com' } }, overrideAccess: true })).docs[0]
    expect(response.status).toBeLessThan(500)
    expect(user?.role ?? 'member').toBe('member')
  })
})

describe('administrators', () => {
  it('has one account made by the bootstrap, and it can sign in', async () => {
    const session = new Session()
    const response = await session.post('/api/auth/sign-in/email', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
    expect(response.status, JSON.stringify(response.json)).toBe(200)
    expect((await session.get('/api/users/me')).json.user.role).toBe('admin')

    const admins = await payload.count({ collection: 'users', where: { role: { equals: 'admin' } }, overrideAccess: true })
    expect(admins.totalDocs).toBe(1)
  })
})

describe('linking a guest account', () => {
  // Email sign-up needs a verified address, so sign-up creates no session. The guest is linked when the person
  // signs in from the same device, where the guest session is still held.
  it.each(['cookie', 'bearer'] as const)('keeps a guest\'s data when they verify and sign in with an email (%s)', async (mode) => {
    const session = await guest(mode)
    await session.post('/api/notes', { title: 'Made as a guest' })
    await session.post('/api/notes', { title: 'Also as a guest' })
    const guestId = session.user!.id

    const email = `linked-${mode}@example.com`
    const password = 'a-long-enough-password'
    const signUp = await session.post('/api/auth/sign-up/email', { email, password, name: 'Linked' })
    expect(signUp.status, JSON.stringify(signUp.json)).toBe(200)
    expect((await payload.count({ collection: 'notes', where: { owner: { equals: guestId } }, overrideAccess: true })).totalDocs).toBe(2)

    const link = await linkFrom(email)
    expect([200, 302]).toContain((await call('GET', `${link.pathname}${link.search}`)).status)

    const signIn = await session.post('/api/auth/sign-in/email', { email, password })
    expect(signIn.status, JSON.stringify(signIn.json)).toBe(200)

    const linked = (await payload.find({ collection: 'users', where: { email: { equals: email } }, overrideAccess: true })).docs[0]
    expect(linked.id).not.toBe(guestId)

    const notes = await payload.find({ collection: 'notes', where: { owner: { equals: linked.id } }, overrideAccess: true })
    expect(notes.docs.map(note => note.title).sort()).toEqual(['Also as a guest', 'Made as a guest'])
    expect((await payload.count({ collection: 'notes', where: { owner: { equals: guestId } }, overrideAccess: true })).totalDocs).toBe(0)
    expect((await payload.count({ collection: 'users', where: { id: { equals: guestId } }, overrideAccess: true })).totalDocs).toBe(0)
  })
})
