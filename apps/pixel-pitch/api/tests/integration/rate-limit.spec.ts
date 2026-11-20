import { beforeAll, describe, expect, it } from 'vitest'

// The rest of the suite turns sign-in rate limiting off because many guests sign in from one address.
// This file turns it back on before the config loads, so the production behaviour is tested too.
process.env.AUTH_RATE_LIMIT = 'on'
const { boot, call } = await import('./harness')

beforeAll(async () => {
  await boot()
})

describe('sign-in rate limiting', () => {
  it('stops repeated guest sign-ins from one address', async () => {
    const statuses: number[] = []
    for (let i = 0; i < 14; i++)
      statuses.push((await call('POST', '/api/auth/sign-in/anonymous', { body: {} })).status)

    expect(statuses.slice(0, 5).every(status => status === 200)).toBe(true)
    expect(statuses).toContain(429)
  })

  it('stops repeated password guesses', async () => {
    const statuses: number[] = []
    for (let i = 0; i < 9; i++)
      statuses.push((await call('POST', '/api/auth/sign-in/email', { body: { email: 'nobody@example.com', password: 'wrong-password-123' } })).status)

    expect(statuses).toContain(429)
  })
})
