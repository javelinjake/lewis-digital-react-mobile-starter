import type { Access, PayloadRequest } from 'payload'
import { describe, expect, it } from 'vitest'
import { ownedCollection } from '../../src/collections/owned'

const member = { req: { user: { id: 7, role: 'member', collection: 'users' } } as unknown as PayloadRequest }
const admin = { req: { user: { id: 1, role: 'admin', collection: 'users' } } as unknown as PayloadRequest }
const run = (access: Access | undefined, args: typeof member) => (access as Access)(args as never)

describe('ownedCollection', () => {
  it('lets members write their own documents by default, with the idempotent create endpoint', () => {
    const notes = ownedCollection({ slug: 'notes', fields: [] })
    expect(run(notes.access!.create, member)).toBe(true)
    expect(run(notes.access!.update, member)).toEqual({ owner: { equals: 7 } })
    expect((notes.endpoints || []).map(endpoint => endpoint.path)).toContain('/idempotent')
  })

  it('with writes: server, lets members read their own and nothing else', () => {
    const clubs = ownedCollection({ slug: 'clubs', fields: [], writes: 'server' })
    expect(run(clubs.access!.read, member)).toEqual({ owner: { equals: 7 } })
    expect(run(clubs.access!.create, member)).toBe(false)
    expect(run(clubs.access!.update, member)).toBe(false)
    expect(run(clubs.access!.delete, member)).toBe(false)
    expect(run(clubs.access!.update, admin)).toBe(true)
    expect(clubs.endpoints || []).toEqual([])
    expect(clubs.custom?.owned).toBe(true)
  })
})
