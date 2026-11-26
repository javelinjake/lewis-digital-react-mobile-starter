import { Buffer } from 'node:buffer'
import { createVerify, generateKeyPairSync } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { createFcmSender, parseServiceAccount } from '../../src/push/fcm'

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const account = {
  projectId: 'demo-app',
  clientEmail: 'push@demo-app.iam.gserviceaccount.com',
  privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
}

interface Call { url: string, init: RequestInit }

function fakeGoogle(sendStatus: number, sendBody: unknown = {}) {
  const calls: Call[] = []
  const request = (async (url: string, init: RequestInit) => {
    calls.push({ url, init })
    if (url.includes('oauth2'))
      return Response.json({ access_token: 'access-1', expires_in: 3600 })
    return Response.json(sendBody, { status: sendStatus })
  }) as unknown as typeof fetch
  return { calls, request }
}

describe('parseServiceAccount', () => {
  it('reads the downloaded key file, including escaped newlines from an env var', () => {
    const json = JSON.stringify({ project_id: 'p', client_email: 'e', private_key: '-----BEGIN-----\\nabc\\n-----END-----' })
    expect(parseServiceAccount(json)).toEqual({ projectId: 'p', clientEmail: 'e', privateKey: '-----BEGIN-----\nabc\n-----END-----' })
  })

  it('is undefined when not set, and explains a broken value', () => {
    expect(parseServiceAccount(undefined)).toBeUndefined()
    expect(() => parseServiceAccount('{nope')).toThrow('not valid JSON')
    expect(() => parseServiceAccount('{}')).toThrow('project_id')
  })
})

describe('createFcmSender', () => {
  it('signs a token request Google can verify, then sends with it', async () => {
    const google = fakeGoogle(200, { name: 'projects/demo-app/messages/1' })
    const sender = createFcmSender({ account, fetch: google.request, now: () => 1_700_000_000_000 })

    expect(await sender.send('device-token', { title: 'Hi', body: 'There', data: { path: '/notes/1' }, badge: 2 })).toBe('sent')

    const assertion = new URLSearchParams(String(google.calls[0].init.body)).get('assertion')!
    const [header, claims, signature] = assertion.split('.')
    const verifier = createVerify('RSA-SHA256')
    verifier.update(`${header}.${claims}`)
    expect(verifier.verify(publicKey, Buffer.from(signature, 'base64url'))).toBe(true)
    expect(JSON.parse(Buffer.from(claims, 'base64url').toString())).toMatchObject({ iss: account.clientEmail, iat: 1_700_000_000, exp: 1_700_003_600 })

    const send = google.calls[1]
    expect(send.url).toBe('https://fcm.googleapis.com/v1/projects/demo-app/messages:send')
    expect((send.init.headers as Record<string, string>).authorization).toBe('Bearer access-1')
    expect(JSON.parse(String(send.init.body)).message).toMatchObject({
      token: 'device-token',
      notification: { title: 'Hi', body: 'There' },
      data: { path: '/notes/1' },
      apns: { payload: { aps: { badge: 2 } } },
    })
  })

  it('reuses the access token until it is about to expire', async () => {
    const google = fakeGoogle(200)
    let now = 0
    const sender = createFcmSender({ account, fetch: google.request, now: () => now })
    await sender.send('a', { title: 't', body: 'b' })
    now = 30 * 60_000
    await sender.send('b', { title: 't', body: 'b' })
    now = 59.5 * 60_000
    await sender.send('c', { title: 't', body: 'b' })

    expect(google.calls.filter(call => call.url.includes('oauth2'))).toHaveLength(2)
  })

  it('reports a dead token so it can be removed, and keeps a token on any other failure', async () => {
    const dead = createFcmSender({ account, fetch: fakeGoogle(404, { error: { status: 'NOT_FOUND', details: [{ errorCode: 'UNREGISTERED' }] } }).request })
    const invalid = createFcmSender({ account, fetch: fakeGoogle(400, { error: { message: 'The registration token is not a valid FCM registration token', details: [{ errorCode: 'INVALID_ARGUMENT' }] } }).request })
    const badPayload = createFcmSender({ account, fetch: fakeGoogle(400, { error: { message: 'Invalid JSON payload', details: [{ errorCode: 'INVALID_ARGUMENT' }] } }).request })
    const down = createFcmSender({ account, fetch: fakeGoogle(503).request })

    expect(await dead.send('t', { title: 't', body: 'b' })).toBe('unregistered')
    expect(await invalid.send('t', { title: 't', body: 'b' })).toBe('unregistered')
    expect(await badPayload.send('t', { title: 't', body: 'b' })).toBe('failed')
    expect(await down.send('t', { title: 't', body: 'b' })).toBe('failed')
  })
})
