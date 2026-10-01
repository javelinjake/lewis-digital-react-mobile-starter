import { describe, expect, it } from 'vitest'
import { createMemoryStorage, createOutbox, runOrQueue, scopeStorageKey } from '../src/index'

function outboxFor(userId: string, storage = createMemoryStorage()) {
  return createOutbox({
    storage,
    storageKey: scopeStorageKey('outbox', 'template', userId),
    userId,
    projectId: 'template',
  })
}

describe('write-ahead outbox', () => {
  it('persists the operation before the request runs', async () => {
    const storage = createMemoryStorage()
    const outbox = outboxFor('user-a', storage)
    let storedFirst = false

    const result = await runOrQueue(outbox, 'note:create', { id: 'n1' }, 'n1', async () => {
      const stored = await storage.get<{ items: Array<{ id: string }> }>(scopeStorageKey('outbox', 'template', 'user-a'))
      storedFirst = stored?.items.some(item => item.id === 'n1') ?? false
      throw new TypeError('Failed to fetch')
    })

    expect(storedFirst).toBe(true)
    expect(result).toBe('queued')
    expect(outbox.getItems()).toHaveLength(1)
  })

  it('replays a persisted item once when flush overlaps', async () => {
    const outbox = outboxFor('user-a')
    let calls = 0
    outbox.register('note:create', async () => {
      calls += 1
      await new Promise(resolve => setTimeout(resolve, 20))
    })

    await outbox.enqueue('note:create', { id: 'n1' }, 'n1')
    await Promise.all([outbox.flush(), outbox.flush()])

    expect(calls).toBe(1)
    expect(outbox.getItems()).toHaveLength(0)
  })

  it('keeps an expired session with the owning user', async () => {
    const storage = createMemoryStorage()
    const owner = outboxFor('user-a', storage)
    const other = createOutbox({
      storage,
      storageKey: scopeStorageKey('outbox', 'template', 'user-b'),
      userId: 'user-b',
      projectId: 'template',
    })

    owner.register('note:create', async () => {
      throw Object.assign(new Error('Token expired'), { status: 401 })
    })
    await owner.enqueue('note:create', { id: 'n1', title: 'A' }, 'n1')
    await owner.flush()

    expect(owner.getItems()[0]?.hold).toBe('auth')
    expect(owner.getItems()[0]?.userId).toBe('user-a')

    let otherCalls = 0
    other.register('note:create', async () => {
      otherCalls += 1
    })
    await other.flush()

    expect(otherCalls).toBe(0)
    expect(other.getItems()).toHaveLength(0)
    expect(owner.getItems()).toHaveLength(1)
  })

  it('does not replay another account queue', async () => {
    const storage = createMemoryStorage()
    const owner = outboxFor('user-a', storage)
    await owner.enqueue('note:create', { id: 'n1' }, 'n1')

    const other = createOutbox({
      storage,
      storageKey: scopeStorageKey('outbox', 'template', 'user-b'),
      userId: 'user-b',
      projectId: 'template',
    })
    let calls = 0
    other.register('note:create', async () => {
      calls += 1
    })
    await other.flush()

    expect(calls).toBe(0)
    expect(owner.getItems()).toHaveLength(1)
  })

  it('parks an unreadable storage version instead of replaying it', async () => {
    const storage = createMemoryStorage()
    const key = scopeStorageKey('outbox', 'template', 'user-a')
    await storage.set(key, {
      version: 99,
      items: [{ id: 'old', type: 'note:create', payload: {}, userId: 'user-a', projectId: 'template', createdAt: 1, attempts: 0 }],
    })

    const outbox = outboxFor('user-a', storage)
    await outbox.ready

    expect(outbox.getItems()).toHaveLength(0)
    expect(await storage.get(`${key}:unreadable`)).toMatchObject({ version: 99 })
  })
})
