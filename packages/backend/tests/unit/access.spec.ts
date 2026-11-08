import type { AccessArgs } from 'payload'
import { describe, expect, it } from 'vitest'
import { adminOnly, authenticated, idOf, isAdminUser, nobody, selfOrAdmin, userRole } from '../../src/access'
import { validateAuthMethods } from '../../src/auth/options'
import { enforceOwner } from '../../src/collections/owned'
import { assertNoShadowedEndpoints } from '../../src/endpoints/guard'

const args = (user: unknown, id?: string | number) => ({ req: { user }, id }) as unknown as AccessArgs

describe('roles', () => {
  it('recognises only the two known roles', () => {
    expect(userRole({ role: 'admin' })).toBe('admin')
    expect(userRole({ role: 'member' })).toBe('member')
    expect(userRole({ role: 'superuser' })).toBeUndefined()
    expect(userRole(null)).toBeUndefined()
    expect(isAdminUser({ role: 'member' })).toBe(false)
  })

  it('normalises relationship ids', () => {
    expect(idOf(5)).toBe(5)
    expect(idOf({ id: 'abc' })).toBe('abc')
    expect(idOf(undefined)).toBeUndefined()
  })
})

describe('access functions', () => {
  it('authenticated, adminOnly and nobody', () => {
    expect(authenticated(args(null))).toBe(false)
    expect(authenticated(args({ id: 1, role: 'member' }))).toBe(true)
    expect(adminOnly(args({ id: 1, role: 'member' }))).toBe(false)
    expect(adminOnly(args({ id: 1, role: 'admin' }))).toBe(true)
    expect(nobody(args({ id: 1, role: 'admin' }))).toBe(false)
  })

  it('selfOrAdmin always constrains a member to their own id, whatever id was requested', () => {
    const member = { id: 7, role: 'member' }
    expect(selfOrAdmin(args(member))).toEqual({ id: { equals: 7 } })
    // Asking for someone else's record by id must not widen the constraint.
    expect(selfOrAdmin(args(member, 8))).toEqual({ id: { equals: 7 } })
  })

  it('selfOrAdmin admits admins and rejects anonymous callers', () => {
    expect(selfOrAdmin(args({ id: 1, role: 'admin' }, 99))).toBe(true)
    expect(selfOrAdmin(args(null, 1))).toBe(false)
  })
})

describe('enforceOwner', () => {
  const run = (user: unknown, operation: 'create' | 'update', data: Record<string, unknown>, originalDoc?: Record<string, unknown>) =>
    enforceOwner({ data, operation, originalDoc, req: { user } } as never) as Record<string, unknown>

  it('stamps a member as the owner on create, ignoring what they sent', () => {
    expect(run({ id: 3, role: 'member' }, 'create', { title: 'x', owner: 99 }).owner).toBe(3)
  })

  it('requires an explicit owner for server code that has no session', () => {
    expect(() => run(null, 'create', { title: 'x' })).toThrow('owner is required')
    expect(run(null, 'create', { title: 'x', owner: 5 }).owner).toBe(5)
  })

  it('refuses to let a member move a document, but allows resending the same owner', () => {
    const member = { id: 3, role: 'member' }
    expect(() => run(member, 'update', { owner: 4 }, { owner: 3 })).toThrow('cannot be changed')
    expect(run(member, 'update', { owner: 3, title: 'y' }, { owner: 3 })).toMatchObject({ title: 'y' })
    expect(run(member, 'update', { owner: { id: 3 } }, { owner: 3 })).toBeDefined()
  })

  it('lets an administrator reassign', () => {
    expect(run({ id: 1, role: 'admin' }, 'update', { owner: 4 }, { owner: 3 }).owner).toBe(4)
  })
})

describe('validateAuthMethods', () => {
  it('requires Sign in with Apple whenever Google is offered', () => {
    expect(() => validateAuthMethods({ google: true })).toThrow('Sign in with Apple is required')
    expect(() => validateAuthMethods({ google: true, emailPassword: true })).toThrow('Apple')
    expect(() => validateAuthMethods({ google: true, apple: true })).not.toThrow()
  })

  it('needs at least one method, and allows email or guest only', () => {
    expect(() => validateAuthMethods({})).toThrow('at least one')
    expect(() => validateAuthMethods({ emailPassword: true })).not.toThrow()
    expect(() => validateAuthMethods({ anonymous: true })).not.toThrow()
  })
})

describe('assertNoShadowedEndpoints', () => {
  it('rejects a top-level endpoint hidden behind a collection slug', () => {
    expect(() => assertNoShadowedEndpoints([{ path: '/notes/duplicate', method: 'post' }], ['notes']))
      .toThrow('can never be reached')
  })

  it('accepts endpoints under a different first segment', () => {
    expect(() => assertNoShadowedEndpoints([{ path: '/actions/duplicate-note', method: 'post' }, { path: '/health', method: 'get' }], ['notes', 'users'])).not.toThrow()
  })

  it('tells the developer what to do instead', () => {
    expect(() => assertNoShadowedEndpoints([{ path: '/users/export', method: 'get' }], ['users'])).toThrow('/actions/')
  })
})
